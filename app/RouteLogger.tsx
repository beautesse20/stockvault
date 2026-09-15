"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { logEvent } from "@/lib/audit";
import { getSession } from "@/lib/auth";

// Journalise les changements d'écran (navigation) — une entrée par écran ouvert,
// seulement pour un utilisateur connecté, en fire-and-forget.
export default function RouteLogger() {
  const path = usePathname();
  const last = useRef<string>("");
  useEffect(() => {
    if (!path || path === last.current) return;
    last.current = path;
    if (path === "/" || !getSession()) return;        // écran de code / pas connecté → on ignore
    if (path.startsWith("/admin/journal")) return;    // ne pas polluer avec l'ouverture du journal
    logEvent("navigation", { cible: path });
  }, [path]);
  return null;
}
