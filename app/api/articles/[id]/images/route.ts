import { NextRequest, NextResponse } from "next/server";
import { getArticle, updateArticle } from "@/lib/firebase";
import { v2 as cloudinary } from "cloudinary";

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

    // Upload vers Cloudinary
    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder:        "stockvault",
      resource_type: "image",
      quality:       "auto",
      fetch_format:  "auto",
    });

    // Récupérer images existantes et ajouter la nouvelle
    const article        = await getArticle(id);
    const existingImages = article.images || [];

    if (existingImages.length >= 10) {
      return NextResponse.json({ error: "Maximum 10 photos atteint" }, { status: 400 });
    }

    const newImages = [
      ...existingImages,
      { url: uploadResult.secure_url, filename: file.name },
    ];

    await updateArticle(id, { images: newImages });

    return NextResponse.json({ success: true });
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

    const article = await getArticle(id);
    const images  = [...(article.images || [])];
    images.splice(imageIndex, 1);

    await updateArticle(id, { images });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}