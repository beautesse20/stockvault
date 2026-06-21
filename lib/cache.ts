const TTL = 45_000;

type Entry = { data: unknown; ts: number };
const store = new Map<string, Entry>();

export function getCache<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL) { store.delete(key); return null; }
  return entry.data as T;
}

export function setCache(key: string, data: unknown): void {
  store.set(key, { data, ts: Date.now() });
}

export function invalidateCache(...keys: string[]): void {
  keys.forEach(k => store.delete(k));
}
