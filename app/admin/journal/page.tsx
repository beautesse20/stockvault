"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";

const CODE = "0658";

// Couleur + libellé par type d'action.
function meta(action: string): { c: string; bg: string; label: string } {
  const a = action || "";
  if (a === "connexion")            return { c: "#38bdf8", bg: "rgba(56,189,248,0.14)", label: "Connexion" };
  if (a.startsWith("article.ajout"))    return { c: "#10b981", bg: "rgba(16,185,129,0.14)", label: "Ajout" };
  if (a.startsWith("article.modif"))    return { c: "#f59e0b", bg: "rgba(245,158,11,0.14)", label: "Modif" };
  if (a.startsWith("article.suppr"))    return { c: "#ff4d5a", bg: "rgba(255,77,90,0.16)", label: "Suppression" };
  if (a.startsWith("article.transform"))return { c: "#a78bfa", bg: "rgba(167,139,250,0.16)", label: "Transform" };
  if (a.startsWith("article.deplace"))  return { c: "#2dd4bf", bg: "rgba(45,212,191,0.14)", label: "Déplacement" };
  if (a.startsWith("article.visib"))    return { c: "#94a3b8", bg: "rgba(148,163,184,0.14)", label: "Visibilité" };
  if (a.startsWith("vente"))            return { c: "#22c55e", bg: "rgba(34,197,94,0.16)", label: "Vente" };
  if (a === "navigation")           return { c: "#6b7280", bg: "rgba(148,163,184,0.10)", label: "Navigation" };
  return { c: "#cbd5e1", bg: "rgba(203,213,225,0.12)", label: action };
}

function quand(ts: string): string {
  const d = new Date(ts); if (isNaN(d.getTime())) return ts || "";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function JournalPage() {
  const router = useRouter();
  const [ok, setOk]         = useState(false);
  const [code, setCode]     = useState("");
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ]           = useState("");
  const [fUser, setFUser]   = useState("");
  const [fType, setFType]   = useState("");
  const [showNav, setShowNav] = useState(false);

  useEffect(() => {
    const u = getSession();
    if (!u || u.role !== "Admin") { router.push("/dossiers"); return; }
    if (typeof window !== "undefined" && sessionStorage.getItem("audit_unlock") === "1") setOk(true);
  }, []);

  const charger = async () => {
    setLoading(true);
    try { const r = await fetch("/api/audit?limit=500", { cache: "no-store" }); const d = await r.json(); if (d.success) setEvents(d.events || []); }
    catch {} finally { setLoading(false); }
  };
  useEffect(() => { if (ok) charger(); }, [ok]);

  const users = useMemo(() => [...new Set(events.map(e => e.user).filter(Boolean))].sort(), [events]);
  const types = useMemo(() => [...new Set(events.map(e => (e.action || "").split(".")[0]).filter(Boolean))].sort(), [events]);

  const liste = events.filter(e => {
    if (!showNav && e.action === "navigation") return false;
    if (fUser && e.user !== fUser) return false;
    if (fType && !(e.action || "").startsWith(fType)) return false;
    if (q) { const t = `${e.user} ${e.action} ${e.cible} ${e.details}`.toLowerCase(); if (!t.includes(q.toLowerCase())) return false; }
    return true;
  });

  const valider = () => { if (code === CODE) { try { sessionStorage.setItem("audit_unlock", "1"); } catch {} setOk(true); } else setCode(""); };

  const inp: React.CSSProperties = { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "9px 12px", color: "white", fontSize: "13px", outline: "none", fontFamily: "inherit" };

  if (!ok) return (
    <div style={{ minHeight: "100vh", background: "#0f0f13", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: "300px", textAlign: "center" }}>
        <div style={{ fontSize: "34px", marginBottom: "10px" }}>🔒</div>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px", marginBottom: "16px" }}>Zone réservée — entre le code d'accès</p>
        <input type="password" inputMode="numeric" value={code} autoFocus onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === "Enter" && valider()} placeholder="••••" style={{ ...inp, width: "100%", textAlign: "center", letterSpacing: "6px", fontSize: "20px", marginBottom: "12px" }} />
        <button onClick={valider} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#ff4d5a,#ff6b35)", color: "white", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Ouvrir</button>
        <button onClick={() => router.push("/admin")} style={{ marginTop: "10px", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "12px", fontFamily: "inherit" }}>Retour</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f13", color: "white", paddingBottom: "80px" }}>
      <div style={{ position: "sticky", top: 0, background: "#0f0f13", zIndex: 5, padding: "18px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <button onClick={() => router.push("/admin")} style={{ background: "none", border: "none", color: "#ff4d5a", fontSize: "20px", cursor: "pointer", fontFamily: "inherit" }}>‹</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "18px", fontWeight: 800 }}>Journal d'activité</div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{liste.length} événement{liste.length > 1 ? "s" : ""} affiché{liste.length > 1 ? "s" : ""}</div>
          </div>
          <button onClick={charger} disabled={loading} style={{ ...inp, cursor: "pointer" }}>{loading ? "…" : "↻"}</button>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Rechercher…" style={{ ...inp, flex: 1, minWidth: "120px" }} />
          <select value={fUser} onChange={e => setFUser(e.target.value)} style={inp}><option value="">Tous</option>{users.map(u => <option key={u} value={u}>{u}</option>)}</select>
          <select value={fType} onChange={e => setFType(e.target.value)} style={inp}><option value="">Toutes actions</option>{types.map(t => <option key={t} value={t}>{t}</option>)}</select>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
            <input type="checkbox" checked={showNav} onChange={e => setShowNav(e.target.checked)} /> navigation
          </label>
        </div>
      </div>

      <div style={{ padding: "10px 12px" }}>
        {liste.length === 0 && !loading && <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", paddingTop: "50px" }}>Aucun événement</div>}
        {liste.map(e => {
          const m = meta(e.action);
          return (
            <div key={e.id} style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 4px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ flexShrink: 0, fontSize: "10px", fontWeight: 700, color: m.c, background: m.bg, padding: "3px 8px", borderRadius: "20px", whiteSpace: "nowrap" }}>{m.label}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.92)", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <b>{e.user || "?"}</b>{e.cible ? <> · {e.cible}</> : null}{e.details ? <span style={{ color: "rgba(255,255,255,0.45)" }}> — {e.details}</span> : null}
                </div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", marginTop: "2px" }}>{quand(e.ts)}{e.role ? ` · ${e.role}` : ""}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
