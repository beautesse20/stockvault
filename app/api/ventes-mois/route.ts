import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Récupère les ventes du mois courant depuis l'app de ventes (onglet DashBoard Sales).
const VENTES = "https://mes-outils-de-vente.vercel.app";

export async function GET() {
  try {
    const res = await fetch(`${VENTES}/api/dashboard`, { cache: "no-store" });
    const data = await res.json();
    if (!data.success) return NextResponse.json({ success: false, error: data.error || "indispo" }, { status: 502 });
    return NextResponse.json({
      success: true,
      ventes: data.stats?.totalVentes ?? 0,
      ca:     data.stats?.totalNet ?? 0,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
