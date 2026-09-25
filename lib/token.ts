// ============================================================
//  JETON DE SESSION SIGNÉ (HMAC-SHA256) — serveur uniquement
//  Format compact type JWT : base64url(header).base64url(payload).sig
//  Sert à prouver, côté serveur, QUI agit et AVEC QUELLES permissions,
//  sans faire confiance au navigateur (localStorage falsifiable).
//  Le même AUTH_SECRET doit être partagé par toutes les apps.
// ============================================================
import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET || "dev-secret-CHANGE-ME";
const TTL_MS = 30 * 24 * 3600 * 1000; // 30 jours

export type SessionClaims = {
  uid: string;
  nom: string;
  role: string;
  perms: string[];
  dossierIds: string[];
  exp: number;
};

const b64u = (buf: Buffer | string) =>
  (Buffer.isBuffer(buf) ? buf : Buffer.from(buf)).toString("base64url");

function sign(data: string): string {
  return crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function signToken(claims: Omit<SessionClaims, "exp"> & { exp?: number }): string {
  const payload: SessionClaims = { ...claims, exp: claims.exp ?? Date.now() + TTL_MS };
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64u(JSON.stringify(payload));
  const data = `${head}.${body}`;
  return `${data}.${sign(data)}`;
}

export function verifyToken(token: string | null | undefined): SessionClaims | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  const expected = sign(data);
  // comparaison à temps constant
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as SessionClaims;
    if (!claims.exp || claims.exp < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

// Lit le jeton depuis l'en-tête Authorization: Bearer <token>.
export function claimsFromRequest(req: Request): SessionClaims | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return verifyToken(m ? m[1] : null);
}

// Garde serveur : renvoie les claims si la permission est accordée, sinon null.
export function requireCap(req: Request, key: string): SessionClaims | null {
  const claims = claimsFromRequest(req);
  if (!claims) return null;
  if (claims.role === "Admin") return claims;
  return Array.isArray(claims.perms) && claims.perms.includes(key) ? claims : null;
}
