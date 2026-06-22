import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key:    process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

const FB_URL = `https://firestore.googleapis.com/v1/projects/stockvault-a3ef3/databases/(default)/documents`;
const FB_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;

// Récupère tous les publicIds référencés dans Firebase (articles actifs ET vendus)
async function getReferencedPublicIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  let pageToken: string | undefined;

  do {
    const url = `${FB_URL}/articles?pageSize=300&key=${FB_KEY}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res  = await fetch(url);
    const data = await res.json();

    for (const doc of data.documents || []) {
      const images = doc.fields?.images?.arrayValue?.values || [];
      for (const v of images) {
        const fields = v.mapValue?.fields || {};
        const publicId = fields.publicId?.stringValue;
        const url      = fields.url?.stringValue || "";
        if (publicId) {
          ids.add(publicId);
        } else if (url) {
          // Fallback : extraire depuis l'URL pour les anciennes images sans publicId
          const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
          if (match) ids.add(match[1]);
        }
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return ids;
}

// Liste toutes les images Cloudinary (tous dossiers confondus)
async function getAllCloudinaryImages(): Promise<{ public_id: string }[]> {
  const images: { public_id: string }[] = [];
  let nextCursor: string | undefined;

  do {
    const result: any = await cloudinary.api.resources({
      type:        "upload",
      max_results: 500,
      next_cursor: nextCursor,
    });
    images.push(...(result.resources || []));
    nextCursor = result.next_cursor;
  } while (nextCursor);

  return images;
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const [referenced, allImages] = await Promise.all([
      getReferencedPublicIds(),
      getAllCloudinaryImages(),
    ]);

    const orphans = allImages.filter(img => !referenced.has(img.public_id));

    // Supprimer par lots de 100 (limite Cloudinary)
    let deleted = 0;
    for (let i = 0; i < orphans.length; i += 100) {
      const batch = orphans.slice(i, i + 100).map(img => img.public_id);
      await cloudinary.api.delete_resources(batch);
      deleted += batch.length;
    }

    return NextResponse.json({
      success:    true,
      total:      allImages.length,
      referenced: referenced.size,
      deleted,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
