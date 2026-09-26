"use client";
import { useEffect, useState } from "react";
import { getSession } from "@/lib/auth";

// Bouton discret (Admin uniquement) pour activer/couper le Mode présentation.
// Quand actif, l'app affiche de fausses données (voir DEMO_BOOT dans layout).
export default function PresentToggle() {
  const [admin, setAdmin] = useState(false);
  const [on, setOn] = useState(false);
  useEffect(() => {
    try { setAdmin(getSession()?.role === "Admin"); setOn(localStorage.getItem("bm_present") === "1"); } catch {}
  }, []);
  if (!admin) return null;
  const toggle = () => {
    try {
      localStorage.setItem("bm_present", localStorage.getItem("bm_present") === "1" ? "0" : "1");
      // Vide le cache client (sinon de vraies données en cache pourraient s'afficher en démo,
      // ou de fausses données rester après la démo).
      Object.keys(localStorage).forEach(k => { if (k.indexOf("svcache:") === 0) localStorage.removeItem(k); });
    } catch {}
    location.reload();
  };
  return (
    <button onClick={toggle} title="Mode présentation — affiche de fausses données pour une démo"
      style={{ position: "fixed", left: "14px", bottom: "calc(14px + env(safe-area-inset-bottom))", zIndex: 150, padding: "8px 12px", borderRadius: "12px", border: `1px solid ${on ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.15)"}`, background: on ? "linear-gradient(135deg,#8b5cf6,#6366f1)" : "rgba(20,20,28,0.85)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", backdropFilter: "blur(8px)", boxShadow: "0 6px 18px rgba(0,0,0,0.35)" }}>
      {on ? "🎭 Démo ON" : "🎭 Démo"}
    </button>
  );
}
