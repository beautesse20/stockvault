import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_TOKEN          = process.env.AIRTABLE_TOKEN!;
const AIRTABLE_BASE_ID        = process.env.AIRTABLE_BASE_ID!;
const AIRTABLE_TABLE_ARTICLES = process.env.AIRTABLE_TABLE_ARTICLES!;

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

    // Récupérer les images existantes
    const resGet = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ARTICLES}/${id}`,
      { headers: { "Authorization": `Bearer ${AIRTABLE_TOKEN}` } }
    );
    const existing = await resGet.json();
    const currentImages = existing.fields?.Images || [];

    console.log("Images existantes:", currentImages.length);
    console.log("Fichier reçu:", file.name, file.type, buffer.length, "bytes");

    if (currentImages.length >= 10) {
      return NextResponse.json({ error: "Maximum 10 photos atteint" }, { status: 400 });
    }

    // Ajouter via URL data (méthode supportée par Airtable)
    const newImages = [
      ...currentImages.map((img: any) => ({ id: img.id })),
      {
        url: `data:${file.type};base64,${base64}`,
        filename: file.name,
      }
    ];

    const resPatch = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ARTICLES}/${id}`,
      {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields: { Images: newImages } }),
      }
    );

    const result = await resPatch.json();
    console.log("Airtable PATCH status:", resPatch.status);
    console.log("Airtable PATCH result:", JSON.stringify(result).substring(0, 300));

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
          "Content-Type": "application/json",
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