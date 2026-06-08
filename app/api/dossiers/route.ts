import { NextRequest, NextResponse } from "next/server";
import { getDossiers, createDossier } from "@/lib/firebase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const dossiers = await getDossiers();
    return NextResponse.json({ dossiers });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { nom } = await req.json();
    if (!nom) return NextResponse.json({ error: "Nom manquant" }, { status: 400 });
    const dossier = await createDossier(nom);
    return NextResponse.json({ dossier });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}