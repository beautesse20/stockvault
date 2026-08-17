import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VENTES = "https://mes-outils-de-vente.vercel.app";

// POST { article } → prix neuf vérifié (Amazon/Fnac/Darty) via l'app de ventes.
export async function POST(req: NextRequest) {
  try {
    const { article } = await req.json();
    if (!article) return NextResponse.json({ success: false, error: "article requis" }, { status: 400 });
    const nom = article.type === "Téléphone"
      ? article.nom || ""
      : article.nom || article.description || "";
    if (!nom) return NextResponse.json({ success: true, neuf: { prix: null } });
    const details = { stockage: article.stockage || "", couleur: article.couleur || "" };

    const res = await fetch(`${VENTES}/api/prix-neuf`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, details }),
    });
    const data = await res.json();
    if (!data.success) return NextResponse.json({ success: true, neuf: { prix: null } });
    return NextResponse.json({ success: true, neuf: data.neuf || { prix: null } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
