import { NextRequest, NextResponse } from "next/server";
import { loginByPin } from "@/lib/firebase";
import { permsOf } from "@/lib/permissions";
import { signToken } from "@/lib/token";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Connexion CÔTÉ SERVEUR : vérifie le PIN, calcule les permissions effectives,
// renvoie un jeton signé + l'utilisateur SANS son PIN (ni ceux des autres).
export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json();
    if (!pin) return NextResponse.json({ success: false, error: "PIN requis" }, { status: 400 });

    const u = await loginByPin(String(pin));
    if (!u) return NextResponse.json({ success: false, error: "Code incorrect" }, { status: 401 });

    const perms = permsOf(u);
    const dossierIds = u.dossierIds || [];
    const token = signToken({ uid: u.id, nom: u.nom, role: u.role, perms, dossierIds });

    // On ne renvoie JAMAIS le pin.
    const user = { id: u.id, nom: u.nom, role: u.role, dossierIds, permissions: perms };
    const res = NextResponse.json({ success: true, user, token });
    // Pont cookie : on pose aussi le jeton en cookie (lisible), pour que la
    // session tienne même si le client ne le stocke pas (compat + secours serveur).
    // Non-httpOnly volontairement : AUTH_BOOT le recopie dans localStorage.
    res.cookies.set("sv_token", token, {
      httpOnly: false, sameSite: "lax", secure: true, path: "/",
      maxAge: 30 * 24 * 3600,
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}
