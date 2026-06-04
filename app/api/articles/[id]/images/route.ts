import { NextRequest, NextResponse } from "next/server";
import { getArticle } from "@/lib/airtable";

const AIRTABLE_TOKEN   = process.env.AIRTABLE_TOKEN!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const AIRTABLE_TABLE_ARTICLES = process.env.AIRTABLE_TABLE_ARTICLES!;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });

    // Lire le fichier en base64
    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const mimeType = file.type || "image/jpeg";

    // Récupérer les images existantes
    const article = await getArticle(params.id);
    const existingImages = article.images || [];

    if (existingImages.length >= 10) {
      return NextResponse.json({ error: "Maximum 10 photos atteint" }, { status: 400 });
    }

    // Ajouter la nouvelle image
    const newImage = {
      url:      `data:${mimeType};base64,${base64}`,
      filename: file.name,
    };

    const allImages = [...existingImages, newImage];

    // Mettre à jour dans Airtable
    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ARTICLES}/${params.id}`,
      {
        method:  "PATCH",
        headers: {
          "Authorization": `Bearer ${AIRTABLE_TOKEN}`,
          "Content-Type":  "application/json",
        },
        body: JSON.stringify({ fields: { Images: allImages } }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.error?.message || "Erreur Airtable" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { imageIndex } = await req.json();
    const article = await getArticle(params.id);
    const images  = article.images || [];
    images.splice(imageIndex, 1);

    await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ARTICLES}/${params.id}`,
      {