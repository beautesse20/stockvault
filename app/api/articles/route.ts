import { NextRequest, NextResponse } from "next/server";
import { getArticles } from "@/lib/firebase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dossierId = searchParams.get("dossierId") || undefined;
    const articles = await getArticles(dossierId);
    return NextResponse.json({ articles });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}