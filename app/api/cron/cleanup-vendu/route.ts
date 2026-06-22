import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key:    process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const FB_URL = `https://firestore.googleapis.com/v1/projects/stockvault-a3ef3/databases/(default)/documents`;
const FB_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;

function extractPublicId(url: string): string | null {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
  return match ? match[1] : null;
}

async function queryVendu() {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/stockvault-a3ef3/databases/(default)/documents:runQuery?key=${FB_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "articles" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "vendu" },
              op: "EQUAL",
              value: { booleanValue: true },
            },
          },
        },
      }),
    }
  );
  return res.json();
}

async function clearImages(docId: string) {
  await fetch(`${FB_URL}/articles/${docId}?updateMask.fieldPaths=images&key=${FB_KEY}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { images: { arrayValue: { values: [] } } } }),
  });
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

  try {
    const results = await queryVendu();
    let deleted = 0;
    let skipped = 0;

    for (const result of results) {
      if (!result.document) continue;
      const fields = result.document.fields || {};
      const vendedAt = fields.vendedAt?.stringValue;

      if (!vendedAt || vendedAt > cutoff) { skipped++; continue; }

      const images: { url: string; publicId?: string }[] =
        (fields.images?.arrayValue?.values || []).map((v: any) => {
          const m = v.mapValue?.fields || {};
          return {
            url:      m.url?.stringValue || "",
            publicId: m.publicId?.stringValue,
          };
        });

      if (!images.length) continue;

      for (const img of images) {
        const publicId = img.publicId || extractPublicId(img.url);
        if (!publicId) continue;
        try { await cloudinary.uploader.destroy(publicId); } catch {}
      }

      const docId = result.document.name.split("/").pop()!;
      await clearImages(docId);
      deleted++;
    }

    return NextResponse.json({ success: true, deleted, skipped });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
