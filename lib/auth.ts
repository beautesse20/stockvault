import { Utilisateur } from "./airtable";

const SESSION_KEY = "stockvault_user";

export function saveSession(user: Utilisateur): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
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

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

export function isAdmin(): boolean {
  const user = getSession();
  return user?.role === "Admin";
}

export function isLoggedIn(): boolean {
  return getSession() !== null;
}