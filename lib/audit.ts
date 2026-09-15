import { getSession } from "./auth";

// Journalise une action. Fire-and-forget : jamais attendu, jamais bloquant,
// erreur ignorée → aucune latence pour l'utilisateur. keepalive pour survivre
// à une navigation immédiate.
export function logEvent(action: string, opts: { cible?: string; details?: string } = {}): void {
  try {
    const u = getSession();
    const body = JSON.stringify({
      action,
      user:   u?.nom || "?",
      userId: (u as any)?.id || "",
      role:   u?.role || "",
      app:    "stockvault",
      cible:  opts.cible || "",
      details: opts.details || "",
    });
    fetch("/api/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch { /* jamais bloquant */ }
}
