"use client";
import { useEffect, useState } from "react";

// Bandeau visible UNIQUEMENT quand le mode présentation est actif : permet de le
// quitter proprement depuis n'importe quel écran (vide le cache + recharge les vraies données).
export default function DemoBanner() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try { setOn(localStorage.getItem("bm_present") === "1"); } catch {}
  }, []);
  if (!on) return null;
  const quitter = () => {
    try {
      localStorage.setItem("bm_present", "0");
      Object.keys(localStorage).forEach(k => { if (k.indexOf("svcache:") === 0) localStorage.removeItem(k); });
    } catch {}
    // Redirection franche (pas un simple reload) → rechargement complet des vraies données.
    window.location.href = "/dossiers";
  };
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", padding: "8px 14px calc(8px + env(safe-area-inset-top))", background: "linear-gradient(135deg,#8b5cf6,#6366f1)", color: "white", fontSize: "13px", fontWeight: 700, fontFamily: "inherit", boxShadow: "0 4px 14px rgba(0,0,0,0.3)" }}>
      <span>🎭 Mode présentation — données fictives</span>
      <button onClick={quitter} style={{ padding: "5px 12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.15)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Quitter</button>
    </div>
  );
}
