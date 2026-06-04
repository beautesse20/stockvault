import { NextRequest, NextResponse } from "next/server";
import { getArticle, updateArticle } from "@/lib/airtable";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const article = await getArticle(params.id);
    return NextResponse.json({ article });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fields = await req.json();
    await updateArticle(params.id, fields);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}