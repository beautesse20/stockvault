import { NextRequest, NextResponse } from "next/server";
import { deleteDossier, updateDossier } from "@/lib/firebase";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteDossier(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { nom } = await req.json();
    if (!nom || !nom.trim()) {
      return NextResponse.json({ error: "Nom manquant" }, { status: 400 });
    }
    // Ne modifie QUE le champ nom — aucune autre donnée n'est touchée
    await updateDossier(id, { nom: nom.trim() });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}