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

    const bytes    = await file.arrayBuffer();
    const buffer   = Buffer.from(bytes);

    // Utiliser l'API d'upload natif Airtable
    const url = `https://content.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ARTICLES}/${id}/Images/uploadAttachment`;

    const airtableForm = new FormData();
    const blob = new Blob([buffer], { type: file.type });
    airtableForm.append("file", blob, file.name);
    airtableForm.append("filename", file.name);

    const res = await fetch(url, {
      method:  "POST",
      headers: { "Authorization": `Bearer ${AIRTABLE_TOKEN}` },
      body:    airtableForm,
    });

    const data = await res.json();
    console.log("Airtable response:", res.status, JSON.stringify(data));
    
    if (!res.ok) {
      return NextResponse.json({ error: data.error?.message || "Erreur Airtable" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (e: any) {
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

    // Récupérer l'article pour avoir les IDs des attachments
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
        method:  "PATCH",
        headers: { "Authorization": `Bearer ${AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ fields: { Images: images.map((img: any) => ({ id: img.id })) } }),
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