// Cache client persistant (localStorage) avec stratégie "stale-while-revalidate".
// - getCache renvoie TOUJOURS la donnée si elle existe (même périmée) → l'écran
//   s'affiche instantanément, sans spinner.
// - isStale indique s'il faut rafraîchir en arrière-plan.
// - Le cache survit aux relances de la PWA (mémoire + localStorage).

const TTL = 60_000; // au-delà : on rafraîchit en arrière-plan (sans bloquer l'UI)
const PREFIX = "svcache:";

type Entry = { data: unknown; ts: number };
const mem = new Map<string, Entry>();

function read(key: string): Entry | null {
  const m = mem.get(key);
  if (m) return m;
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem(PREFIX + key);
    if (s) { const e = JSON.parse(s) as Entry; mem.set(key, e); return e; }
  } catch {}
  return null;
}

export function getCache<T>(key: string): T | null {
  const e = read(key);
  return e ? (e.data as T) : null; // renvoie même si périmé
}

export function isStale(key: string): boolean {
  const e = read(key);
  return !e || Date.now() - e.ts > TTL;
}

export function setCache(key: string, data: unknown): void {
  const e: Entry = { data, ts: Date.now() };
  mem.set(key, e);
  try {
    if (typeof window !== "undefined") localStorage.setItem(PREFIX + key, JSON.stringify(e));
  } catch {} // quota dépassé → on garde au moins la mémoire
}

export function invalidateCache(...keys: string[]): void {
  keys.forEach(k => {
    mem.delete(k);
    try { if (typeof window !== "undefined") localStorage.removeItem(PREFIX + k); } catch {}
  });
}
