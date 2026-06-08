import { NextRequest, NextResponse } from "next/server";
import { getArticle, updateArticle, deleteArticle } from "@/lib/firebase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const article = await getArticle(id);
    return NextResponse.json({ article });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fields = await req.json();
    await updateArticle(id, fields);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Récupérer la ref avant de supprimer
    const article = await getArticle(id);
    const ref     = article.ref;

    // Supprimer de Firebase
    await deleteArticle(id);

    // Griser la ligne dans le Sheet via Apps Script
    if (ref && process.env.APPS_SCRIPT_URL) {
      const url = `${process.env.APPS_SCRIPT_URL}?action=griser&ref=${encodeURIComponent(ref)}`;
      await fetch(url).catch(e => console.error("Erreur Apps Script:", e));
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}