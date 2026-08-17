import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const VENTES = "https://mes-outils-de-vente.vercel.app";

// POST { article } → prix RÉEL marché canadien (Vancouver) en CAD (app de ventes).
export async function POST(req: NextRequest) {
  try {
    const { article } = await req.json();
    if (!article) return NextResponse.json({ success: false, error: "article requis" }, { status: 400 });
    const nom = article.type === "Téléphone" ? (article.nom || "") : (article.nom || article.description || "");
    if (!nom) return NextResponse.json({ success: false, error: "nom manquant" }, { status: 400 });
    const etat = article.fonctionnel === "Non"
      ? "ne fonctionne pas"
      : [article.ecran, article.coque].filter(Boolean).join(", ") || "bon état";
    const details = { stockage: article.stockage || "", defaut: article.defaut || "" };

    const res = await fetch(`${VENTES}/api/prix-canada`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, etat, details }),
    });
    const data = await res.json();
    if (!data.success) return NextResponse.json({ success: false, error: data.error || "indispo" }, { status: 502 });
    return NextResponse.json({ success: true, prix: data.prix });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
