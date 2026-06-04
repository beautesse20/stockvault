import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

const AIRTABLE_TOKEN          = process.env.AIRTABLE_TOKEN!;
const AIRTABLE_BASE_ID        = process.env.AIRTABLE_BASE_ID!;
const AIRTABLE_TABLE_ARTICLES = process.env.AIRTABLE_TABLE_ARTICLES!;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key:    process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }   = await params;
    const formData = await req.formData();
    const file     = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const dataUri = `data:${file.type};base64,${base64}`;

    // 1) Upload vers Cloudinary
    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder:           "stockvault",
      resource_type:    "image",
      quality:          "auto",
      fetch_format:     "auto",
    });

    const publicUrl = uploadResult.secure_url;
    console.log("Cloudinary URL:", publicUrl);

    // 2) Récupérer images existantes dans Airtable
    const resGet = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ARTICLES}/${id}`,
      { headers: { "Authorization": `Bearer ${AIRTABLE_TOKEN}` } }
    );
    const article  = await resGet.json();
    const existing = (article.fields?.Images || []).map((img: any) => ({ id: img.id }));

    // 3) Ajouter la nouvelle image via URL Cloudinary
    const resPatch = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ARTICLES}/${id}`,
      {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${AIRTABLE_TOKEN}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          fields: {
            Images: [
              ...existing,
              { url: publicUrl, filename: file.name }
            ]
          }
        }),
      }
    );

    const result = await resPatch.json();
    console.log("Airtable status:", resPatch.status);

    if (!resPatch.ok) {
      return NextResponse.json({ error: result.error?.message || "Erreur Airtable" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.log("Erreur upload:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id }     = await params;
    const body       = await req.json();
    const imageIndex = body.imageIndex;

    const resGet = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ARTICLES}/${id}`,
      { headers: { "Authorization": `Bearer ${AIRTABLE_TOKEN}` } }
    );
    const article = await resGet.json();
    const images  = article.fields?.Images || [];
    images.splice(imageIndex, 1);

    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ARTICLES}/${id}`,
      {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${AIRTABLE_TOKEN}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({
          fields: {
            Images: images.map((img: any) => ({ id: img.id }))
          }
        }),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Erreur suppression" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}