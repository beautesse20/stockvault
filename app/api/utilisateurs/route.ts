import { NextRequest, NextResponse } from "next/server";
import { getUtilisateurs, createUtilisateur } from "@/lib/firebase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const utilisateurs = await getUtilisateurs();
    return NextResponse.json({ utilisateurs });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { nom, pin, role, dossierIds } = await req.json();
    if (!nom || !pin || !role) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }
    await createUtilisateur(nom, pin, role, dossierIds || []);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}