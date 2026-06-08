import { NextRequest, NextResponse } from "next/server";
import { updateUtilisateur, deleteUtilisateur } from "@/lib/firebase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fields = await req.json();
    await updateUtilisateur(id, fields);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteUtilisateur(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}