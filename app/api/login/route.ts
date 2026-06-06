import { NextRequest, NextResponse } from "next/server";
import { loginByPin } from "@/lib/firebase";

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json();
    if (!pin) return NextResponse.json({ error: "PIN manquant" }, { status: 400 });
    const user = await loginByPin(pin);
    if (!user) return NextResponse.json({ error: "PIN incorrect" }, { status: 401 });
    return NextResponse.json({ user });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}