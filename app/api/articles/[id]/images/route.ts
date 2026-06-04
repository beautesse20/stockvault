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

    // 1) Upload vers transfer.sh pour obtenir une URL publique
    const transferRes = await fetch(`https://transfer.sh/${file.name}`, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: buffer,
    });

    if (!transferRes.ok) {
      return NextResponse.json({ error: "Erreur hébergement temporaire" }, { status: 500 });
    }

    const publicUrl = await transferRes.text();
    console.log("URL publique:", publicUrl.trim());

    // 2) Récupérer images existantes
    const resGet = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ARTICLES}/${id}`,
      { headers: { "Authorization": `Bearer ${AIRTABLE_TOKEN}` } }
    );
    const article = await resGet.json();
    const existing = (article.fields?.Images || []).map((img: any) => ({ id: img.id }));

    // 3) Ajouter la nouvelle image via URL publique
    const resPatch = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ARTICLES}/${id}`,
      {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${AIRTABLE_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            Images: [
              ...existing,
              { url: publicUrl.trim(), filename: file.name }
            ]
          }
        }),
      }
    );

    const result = await resPatch.json();
    console.log("Airtable status:", resPatch.status, JSON.stringify(result).substring(0, 200));

    if (!resPatch.ok) {
      return NextResponse.json({ error: result.error?.message || "Erreur Airtable" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.log("Erreur:", e.message);
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