import { NextRequest, NextResponse } from "next/server";
import { getDossiers, createDossier } from "@/lib/firebase";
import { requireCap } from "@/lib/token";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const g = requireCap(req, "stock.view");
    if (!g) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    let dossiers = await getDossiers();
    // Non-Admin : ne voit que ses dossiers.
    if (g.role !== "Admin") {
      const autorises = new Set(g.dossierIds || []);
      dossiers = dossiers.filter((d: any) => autorises.has(d.id));
    }
    return NextResponse.json({ dossiers });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!requireCap(req, "admin.settings")) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const { nom } = await req.json();
    if (!nom) return NextResponse.json({ error: "Nom manquant" }, { status: 400 });
    const dossier = await createDossier(nom);
    return NextResponse.json({ dossier });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}