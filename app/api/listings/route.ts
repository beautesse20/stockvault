import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Proxy vers le suivi "mis en ligne" de l'app de ventes (évite le CORS).
const VENTES = "https://mes-outils-de-vente.vercel.app";

export async function GET(req: NextRequest) {
  try {
    const ref = new URL(req.url).searchParams.get("ref") || "";
    const res = await fetch(`${VENTES}/api/listings?ref=${encodeURIComponent(ref)}`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${VENTES}/api/listings`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
