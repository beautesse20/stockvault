import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // la recherche web peut dépasser 60s

const VENTES = "https://mes-outils-de-vente.vercel.app";

function buildProduit(article: any) {
  const type: "tels" | "divers" = article.type === "Téléphone" ? "tels" : "divers";
  const nom = type === "tels"
    ? article.nom || ""
    : article.description || article.nom || "";
  const etat = article.fonctionnel === "Non"
    ? "ne fonctionne pas"
    : [article.ecran, article.coque].filter(Boolean).join(", ") || "bon état";
  const details = {
    stockage: article.stockage || "", couleur: article.couleur || "",
    ecran: article.ecran || "", coque: article.coque || "",
    batterie: article.batterie || "", defaut: article.defaut || "",
  };
  return { nom, etat, details };
}

// POST { article } → cherche le prix réel via l'app de ventes (web search).
export async function POST(req: NextRequest) {
  try {
    const { article } = await req.json();
    if (!article) return NextResponse.json({ success: false, error: "article requis" }, { status: 400 });
    const { nom, etat, details } = buildProduit(article);
    if (!nom) return NextResponse.json({ success: false, error: "nom du produit manquant" }, { status: 400 });

    const res = await fetch(`${VENTES}/api/prix-reel`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, etat, details }),
    });
    const data = await res.json();
    if (!data.success) {
      return NextResponse.json({ success: false, error: data.error || "Prix indisponible" }, { status: 502 });
    }
    return NextResponse.json({ success: true, prix: data.prix });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
