import { NextRequest, NextResponse } from "next/server";
import { addAuditEvent, getAuditEvents } from "@/lib/firebase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// CORS permissif : les autres apps de l'écosystème (ventes, PartStack, dîmes)
// pourront envoyer leurs événements ici en Phase 2/3.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Append d'un événement — best-effort, appelé en fire-and-forget par le client.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const action = String(b.action || "").slice(0, 60);
    if (!action) return NextResponse.json({ success: false }, { status: 400, headers: CORS });
    await addAuditEvent({
      action,
      user:   String(b.user || "?").slice(0, 60),
      userId: String(b.userId || "").slice(0, 60),
      role:   String(b.role || "").slice(0, 20),
      app:    String(b.app || "stockvault").slice(0, 20),
      cible:  String(b.cible || "").slice(0, 200),
      details:String(b.details || "").slice(0, 500),
    });
    return NextResponse.json({ success: true }, { headers: CORS });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}

// Liste (écran Journal admin) — on renvoie les N plus récents, le filtrage se fait côté écran.
export async function GET(req: NextRequest) {
  try {
    const max = Math.min(parseInt(new URL(req.url).searchParams.get("limit") || "300", 10) || 300, 1000);
    const events = await getAuditEvents(max);
    return NextResponse.json({ success: true, events }, { headers: CORS });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500, headers: CORS });
  }
}
