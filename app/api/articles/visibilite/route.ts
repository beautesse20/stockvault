import { NextRequest, NextResponse } from "next/server";
import { setArticlesMasque } from "@/lib/firebase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { ids, masquer } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Aucun article" }, { status: 400 });
    }
    await setArticlesMasque(ids, masquer === true);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
