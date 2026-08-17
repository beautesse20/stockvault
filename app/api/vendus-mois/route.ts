import { NextResponse } from "next/server";
import { getVendusCeMois } from "@/lib/firebase";

export const dynamic = "force-dynamic";

// Articles vendus ce mois (depuis Firebase). Le dashboard filtre par dossier
// pour les non-admin ; l'admin utilise plutôt le total du Sheet (toutes ventes).
export async function GET() {
  try {
    const ventes = await getVendusCeMois();
    return NextResponse.json({ success: true, ventes });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
