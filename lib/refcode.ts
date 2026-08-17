// Encode une référence interne (ex. "I15PM-HS") en un "mot" prononçable de 7
// lettres, sans chiffre, pour glisser discrètement la réf dans les annonces
// (ex. "#voquvub"). Doit rester IDENTIQUE à lib/refcode.js de l'app de ventes
// (mes-outils-de-vente) pour que les codes correspondent des deux côtés.
export function refToCode(ref: string): string {
  const s = String(ref || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!s) return "";
  let h = 0x811c9dc5; // FNV-1a 32 bits
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h = h >>> 0;
  const C = "bcdfghjklmnpqrstvwxz", V = "aeiou";
  const pat = [C, V, C, V, C, V, C];
  let out = "";
  for (const set of pat) { out += set[h % set.length]; h = Math.floor(h / set.length); }
  return out;
}

export function refReelle(ref: string): boolean {
  const r = String(ref || "").trim().toLowerCase();
  return !!r && r !== "photo" && r !== "manuel";
}
