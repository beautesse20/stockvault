"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, clearSession } from "@/lib/auth";
import { Dossier } from "@/lib/airtable";

export default function DossiersPage() {
  const [dossiers, setDossiers]           = useState<Dossier[]>([]);
  const [loading, setLoading]             = useState(true);
  const [userName, setUserName]           = useState("");
  const [admin, setAdmin]                 = useState(false);
  const [totalArticles, setTotalArticles] = useState(0);
  const [articles, setArticles]           = useState<any[]>([]);
  const [query, setQuery]                 = useState("");
  const router = useRouter();

  useEffect(() => {
    const user = getSession();
    if (!user) { router.push("/"); return; }
    setUserName(user.nom);
    setAdmin(user.role === "Admin");
    fetchDossiers(user);
  }, []);

  const fetchDossiers = async (user: any) => {
    try {
      const res  = await fetch("/api/dossiers", { cache: "no-store" });
      const data = await res.json();
      const all: Dossier[] = data.dossiers || [];

      if (user.role === "Admin") {
        setDossiers(all);
        const resTotal  = await fetch("/api/articles", { cache: "no-store" });
        const dataTotal = await resTotal.json();
        const arts = dataTotal.articles || [];
        setArticles(arts);
        setTotalArticles(arts.length);
      } else {
  const filtered = all.filter(d => user.dossierIds?.includes(d.id));
  setDossiers(filtered);
  // Compter uniquement les articles dans ses dossiers
  const resTotal  = await fetch("/api/articles", { cache: "no-store" });
  const dataTotal = await resTotal.json();
  const allArticles = dataTotal.articles || [];
  const mine = allArticles.filter((a: any) =>
    user.dossierIds?.includes(a.dossierId)
  );
  setArticles(mine);
  setTotalArticles(mine.length);
}
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async (d: Dossier) => {
    const saisie = window.prompt("Nouveau nom du dossier :", d.nom);
    if (saisie === null) return;            // annulé
    const nom = saisie.trim();
    if (!nom || nom === d.nom) return;      // vide ou inchangé
    try {
      const res = await fetch(`/api/dossiers/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom }),
      });
      if (!res.ok) throw new Error("échec");
      setDossiers(prev => prev.map(x => (x.id === d.id ? { ...x, nom } : x)));
    } catch (e) {
      console.error(e);
      alert("La modification du nom a échoué. Réessaie.");
    }
  };

  const colors  = ["rgba(255,77,90,0.15)","rgba(255,140,66,0.15)","rgba(108,99,255,0.15)","rgba(16,185,129,0.15)","rgba(99,102,241,0.15)","rgba(236,72,153,0.15)"];
  const emojis  = ["🏠","📦","🚗","🏪","🏭","📫"];

  // ── Recherche (nom + référence) ──
  const dossierNom = (id?: string) => dossiers.find(d => d.id === id)?.nom || "—";
  const thumb = (url?: string) => url ? url.replace("/upload/", "/upload/w_120,h_120,c_fill,q_auto,f_auto/") : "";
  const q = query.trim().toLowerCase();
  const resultats = q.length === 0 ? [] : articles.filter((a: any) =>
    (a.ref || "").toLowerCase().includes(q) || (a.nom || "").toLowerCase().includes(q)
  );

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#1a1f3a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "32px", height: "32px", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#ff4d5a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#1a1f3a", display: "flex", flexDirection: "column" }}>

      {/* Zone blanche */}
      <div style={{
        background: "#f7f8fc", borderRadius: "0 0 0 60px",
        paddingTop: "60px", paddingBottom: "80px",
        paddingLeft: "20px", paddingRight: "20px",
        position: "relative", zIndex: 2,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
          <div>
            <p style={{ fontSize: "12px", color: "#8892b0", marginBottom: "3px" }}>Bonjour 👋</p>
            <h1 style={{ fontSize: "24px", fontWeight: 900, color: "#1a1f3a" }}>Mes dossiers</h1>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {admin && (
              <button onClick={() => router.push("/photos")} title="Photos en masse" style={{ width: "40px", height: "40px", borderRadius: "13px", background: "white", border: "none", cursor: "pointer", boxShadow: "0 3px 10px rgba(26,31,58,0.1)", fontSize: "18px" }}>📷</button>
            )}
            {admin && (
              <button onClick={() => router.push("/admin")} style={{ width: "40px", height: "40px", borderRadius: "13px", background: "white", border: "none", cursor: "pointer", boxShadow: "0 3px 10px rgba(26,31,58,0.1)", fontSize: "18px" }}>⚙️</button>
            )}
            <button onClick={() => { clearSession(); router.push("/"); }} style={{ width: "40px", height: "40px", borderRadius: "13px", background: "linear-gradient(135deg, #ff4d5a, #ff6b35)", border: "none", cursor: "pointer", fontSize: "16px", fontWeight: 800, color: "white", boxShadow: "0 6px 16px rgba(255,77,90,0.35)" }}>
              {userName.charAt(0).toUpperCase()}
            </button>
          </div>
        </div>

        {/* ── Barre de recherche (tous les utilisateurs) ── */}
        <div style={{ position: "relative", marginBottom: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "9px", background: "white", borderRadius: "14px", padding: "12px 14px", boxShadow: "0 5px 16px rgba(26,31,58,0.12)" }}>
            <span style={{ fontSize: "15px", opacity: 0.55 }}>🔍</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un article (réf, nom)…"
              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: "14px", color: "#1a1f3a", fontFamily: "inherit" }}
            />
            {query.length > 0 && (
              <button onClick={() => setQuery("")} title="Effacer" style={{ border: "none", background: "rgba(26,31,58,0.08)", borderRadius: "50%", width: "20px", height: "20px", cursor: "pointer", fontSize: "11px", color: "#1a1f3a", lineHeight: 1, flexShrink: 0 }}>✕</button>
            )}
          </div>
          <div style={{ position: "absolute", right: "-2px", top: "-10px", background: "#ff4d5a", color: "white", fontSize: "9px", fontWeight: 800, letterSpacing: "0.3px", padding: "3px 9px", borderRadius: "20px", boxShadow: "0 3px 9px rgba(255,77,90,0.45)" }}>NOUVEAU</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #1a1f3a 0%, #2d1b69 60%, #1e2d6b 100%)", borderRadius: "22px", padding: "18px", position: "relative", overflow: "hidden", boxShadow: "0 12px 30px rgba(26,31,58,0.3)" }}>
          <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "130px", height: "130px", background: "radial-gradient(circle, rgba(255,77,90,0.3), transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "-30px", left: "-20px", width: "110px", height: "110px", background: "radial-gradient(circle, rgba(108,99,255,0.25), transparent 70%)", pointerEvents: "none" }} />
          <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: "12px", position: "relative" }}>Vue d'ensemble</p>
          <div style={{ display: "flex", marginBottom: "14px", position: "relative" }}>
            {[{ num: dossiers.length, lbl: "Dossiers" }, { num: totalArticles, lbl: "Articles" }].map((s, i) => (
              <div key={i}
                style={{ flex: 1, textAlign: "center", cursor: s.lbl === "Articles" ? "pointer" : "default" }}
                onClick={() => s.lbl === "Articles" ? router.push("/articles") : undefined}
              >
                <div style={{ fontSize: "30px", fontWeight: 900, color: "white", lineHeight: 1 }}>{s.num}</div>
                <div style={{ fontSize: "10px", color: s.lbl === "Articles" ? "#ff8c42" : "rgba(255,255,255,0.4)", marginTop: "4px" }}>{s.lbl}</div>
              </div>
            ))}
          </div>
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "rgba(255,255,255,0.35)", marginBottom: "6px" }}>
              <span>Photos complétées</span><span>60%</span>
            </div>
            <div style={{ height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: "60%", background: "linear-gradient(90deg, #ff4d5a, #ff8c42)", borderRadius: "2px" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Zone bleu nuit */}
      <div style={{ flex: 1, background: "#1a1f3a", borderRadius: "0 60px 0 0", paddingTop: "40px", paddingLeft: "20px", paddingRight: "20px", paddingBottom: "100px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px" }}>{q.length === 0 ? "Dossiers récents" : `Résultats (${resultats.length})`}</p>
          {q.length === 0 && (
            <button onClick={() => router.push("/articles")} style={{ background: "none", border: "none", color: "#ff4d5a", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Voir tout →</button>
          )}
        </div>

        {q.length > 0 ? (
          <>
            {resultats.length === 0 && (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", paddingTop: "50px" }}>
                <div style={{ fontSize: "44px", marginBottom: "12px" }}>🔍</div>
                <p>Aucun article trouvé</p>
              </div>
            )}
            {resultats.map((a: any) => (
              <div key={a.id} onClick={() => router.push(`/articles/${a.id}`)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "12px 14px", display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px", cursor: "pointer" }}>
                {a.images && a.images[0] ? (
                  <img src={thumb(a.images[0].url)} alt="" style={{ width: "44px", height: "44px", borderRadius: "12px", objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>📱</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "white", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nom || "Sans nom"}</p>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{a.ref || "—"} · {dossierNom(a.dossierId)}</p>
                </div>
                <div style={{ padding: "4px 10px", borderRadius: "50px", fontSize: "10px", fontWeight: 700, background: "rgba(255,77,90,0.15)", color: "#ff4d5a" }}>›</div>
              </div>
            ))}
          </>
        ) : (
          <>
            {dossiers.length === 0 && (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", paddingTop: "60px" }}>
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>📂</div>
                <p>Aucun dossier disponible</p>
              </div>
            )}

            {dossiers.map((d, i) => (
              <div key={d.id} onClick={() => router.push(`/dossiers/${d.id}`)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px", cursor: "pointer" }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "14px", background: colors[i % colors.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>{emojis[i % emojis.length]}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "white", marginBottom: "2px" }}>{d.nom}</p>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>{d.articleIds?.length || 0} article{(d.articleIds?.length || 0) > 1 ? "s" : ""}</p>
                </div>
                {admin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRename(d); }}
                    title="Renommer le dossier"
                    style={{ width: "34px", height: "34px", borderRadius: "11px", background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer", fontSize: "15px", flexShrink: 0, color: "white" }}
                  >
                    ✏️
                  </button>
                )}
                <div style={{ padding: "4px 10px", borderRadius: "50px", fontSize: "10px", fontWeight: 700, background: "rgba(255,77,90,0.15)", color: "#ff4d5a" }}>›</div>
              </div>
            ))}
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {/* Bouton ajouter — Admin seulement */}
{admin && (
  <button
    onClick={() => router.push("/ajouter")}
    style={{
      position: "fixed",
      bottom: "32px",
      left: "20px",
      width: "52px",
      height: "52px",
      borderRadius: "50%",
      background: "linear-gradient(135deg, #10b981, #059669)",
      border: "none",
      cursor: "pointer",
      fontSize: "26px",
      zIndex: 50,
      boxShadow: "0 8px 24px rgba(16,185,129,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    ＋
  </button>
)}
    </div>
  );
}