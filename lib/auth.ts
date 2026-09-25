import { Utilisateur } from "./airtable";
import { can as canPure } from "./permissions";

const SESSION_KEY = "stockvault_user";
const TOKEN_KEY   = "stockvault_token";

export function saveSession(user: Utilisateur, token?: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

export function getSession(): Utilisateur | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(SESSION_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data) as Utilisateur;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

// En-tête Authorization à ajouter aux appels d'API protégés.
export function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function isAdmin(): boolean {
  const user = getSession();
  return user?.role === "Admin";
}

export function isLoggedIn(): boolean {
  return getSession() !== null;
}

// Test de permission sur la session courante (UI).
export function can(key: string): boolean {
  return canPure(getSession() as any, key);
}
