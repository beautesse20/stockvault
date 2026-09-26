import { NextRequest, NextResponse } from "next/server";
import { getArticles } from "@/lib/firebase";
import { requireCap } from "@/lib/token";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const g = requireCap(req, "stock.view");
    if (!g) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { searchParams } = new URL(req.url);
    const dossierId = searchParams.get("dossierId") || undefined;
    let articles = await getArticles(dossierId);
    // Cloisonnement serveur : un non-Admin ne reçoit QUE les articles de ses dossiers.
    if (g.role !== "Admin") {
      const autorises = new Set(g.dossierIds || []);
      articles = articles.filter((a: any) => autorises.has(a.dossierId));
    }
    return NextResponse.json({ articles });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}