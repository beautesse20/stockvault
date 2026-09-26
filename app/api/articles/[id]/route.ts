import { NextRequest, NextResponse } from "next/server";
import { getArticle, updateArticle, deleteArticle } from "@/lib/firebase";
import { requireCap } from "@/lib/token";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Un non-Admin ne peut toucher qu'un article de SES dossiers.
function dossierOk(g: any, article: any) {
  return g.role === "Admin" || (g.dossierIds || []).includes(article?.dossierId);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const g = requireCap(req, "stock.view");
    if (!g) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;
    const article = await getArticle(id);
    if (!dossierOk(g, article)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
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
    const g = requireCap(req, "stock.edit");
    if (!g) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;
    if (g.role !== "Admin") {
      const a = await getArticle(id);
      if (!dossierOk(g, a)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
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
    const g = requireCap(req, "stock.delete");
    if (!g) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { id } = await params;

    // Récupérer la ref avant de supprimer
    const article = await getArticle(id);
    if (!dossierOk(g, article)) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const ref     = article.ref;

    // Supprimer de Firebase
    await deleteArticle(id);

    // Griser la ligne dans le Sheet via Apps Script + noter la suppression.
    // Le texte est écrit dans la colonne P/H → grise la ligne ET empêche que
    // l'article soit recréé au prochain Sync (les lignes "vendues" sont ignorées).
    if (ref && process.env.APPS_SCRIPT_URL) {
      const dateFr = new Date().toLocaleDateString("fr-FR");
      const note   = `Supprimé depuis l'app / ${dateFr}`;
      const url    = `${process.env.APPS_SCRIPT_URL}?action=griser&ref=${encodeURIComponent(ref)}&note=${encodeURIComponent(note)}`;
      await fetch(url).catch(e => console.error("Erreur Apps Script:", e));
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}