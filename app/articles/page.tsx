"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Article, Dossier } from "@/lib/airtable";
import { thumb } from "@/lib/img";
import { getCache, setCache, invalidateCache } from "@/lib/cache";

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filtre, setFiltre]     = useState("Tous");
  const [search, setSearch]     = useState("");
  const [isAdmin, setIsAdmin]             = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected]           = useState<string[]>([]);
  const [busy, setBusy]                   = useState(false);
  const router = useRouter();

  useEffect(() => {
    const user = getSession();
    if (!user) { router.push("/"); return; }
    setIsAdmin(user.role === "Admin");
    fetchData(user);
  }, []);

  const fetchData = async (user: any, force = false) => {
    try {
      let dataA = !force && getCache<any>("articles");
      let dataD = !force && getCache<any>("dossiers");
      if (!dataA || !dataD) {
        const [resA, resD] = await Promise.all([
          !dataA ? fetch("/api/articles", { cache: "no-store" }) : Promise.resolve(null),
          !dataD ? fetch("/api/dossiers", { cache: "no-store" }) : Promise.resolve(null),
        ]);
        if (resA) { dataA = await resA.json(); setCache("articles", dataA); }
        if (resD) { dataD = await resD.json(); setCache("dossiers", dataD); }
      }
      const allDossiers: Dossier[] = dataD.dossiers || [];
      const allArticles: Article[] = dataA.articles || [];
      setDossiers(allDossiers);
      if (user.role === "Admin") {
        setArticles(allArticles);
      } else {
        setArticles(allArticles.filter(a => user.dossierIds?.includes(a.dossierId || "")));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const annulerSelection = () => { setSelectionMode(false); setSelected([]); };

  const appliquerVisibilite = async (masquer: boolean) => {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/articles/visibilite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected, masquer }),
      });
      if (!res.ok) throw new Error("échec");
      invalidateCache("articles");
      setArticles(prev => prev.map(a => selected.includes(a.id) ? { ...a, masquerDuSite: masquer } : a));
      annulerSelection();
    } catch (e) {
      console.error(e);
      alert("L'opération a échoué. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  const filtres = ["Tous", "Téléphone", "Divers", "Sans photo", "Sans dossier"];
  const articlesFiltres = articles
    .filter(a => {
      if (filtre === "Tous")          return true;
      if (filtre === "Sans photo")    return !a.images || a.images.length === 0;
      if (filtre === "Sans dossier")  return !a.dossierId;
      return a.type === filtre;
    })
    .filter(a => !search || a.nom.toLowerCase().includes(search.toLowerCase()) || a.ref.toLowerCase().includes(search.toLowerCase()));

  const gradients = [
    "linear-gradient(135deg, rgba(255,77,90,0.2), rgba(255,140,66,0.08))",
    "linear-gradient(135deg, rgba(108,99,255,0.2), rgba(16,185,129,0.08))",
    "linear-gradient(135deg, rgba(255,140,66,0.2), rgba(255,77,90,0.08))",
    "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(108,99,255,0.08))",
  ];

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
        <button onClick={() => router.push("/dossiers")} style={{ background: "none", border: "none", color: "#ff4d5a", fontSize: "21px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: "12px" }}>‹ Retour</button>
        <h1 style={{ fontSize: "24px", fontWeight: 900, color: "#1a1f3a", marginBottom: "4px" }}>Tous les articles</h1>
        <p style={{ fontSize: "12px", color: "#8892b0", marginBottom: "16px" }}>{articles.length} article{articles.length > 1 ? "s" : ""}</p>
        <div style={{ background: "white", borderRadius: "14px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "10px", boxShadow: "0 2px 8px rgba(26,31,58,0.08)", marginBottom: "14px" }}>
          <span style={{ color: "#8892b0" }}>🔍</span>
          <input type="text" placeholder="Rechercher un article ou une réf..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: "none", border: "none", outline: "none", fontSize: "13px", color: "#1a1f3a", flex: 1, fontFamily: "inherit" }} />
        </div>
        <div style={{ display: "flex", gap: "8px", overflowX: "auto" }}>
          {filtres.map(f => (
            <button key={f} onClick={() => setFiltre(f)} style={{ padding: "7px 14px", borderRadius: "50px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", fontFamily: "inherit", background: filtre === f ? "#ff4d5a" : "white", color: filtre === f ? "white" : "#8892b0", border: filtre === f ? "none" : "1px solid #e2e5f0", boxShadow: filtre === f ? "0 4px 12px rgba(255,77,90,0.3)" : "0 2px 6px rgba(26,31,58,0.06)" }}>{f}</button>
          ))}
        </div>
        {isAdmin && (
          <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => selectionMode ? annulerSelection() : setSelectionMode(true)} style={{ padding: "7px 14px", borderRadius: "50px", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: "1px solid #e2e5f0", background: selectionMode ? "#1a1f3a" : "white", color: selectionMode ? "white" : "#1a1f3a", boxShadow: "0 2px 6px rgba(26,31,58,0.06)" }}>{selectionMode ? "✕ Annuler" : "☑️ Sélectionner"}</button>
          </div>
        )}
      </div>

      {/* Zone bleu nuit */}
      <div style={{ flex: 1, background: "#1a1f3a", borderRadius: "0 60px 0 0", paddingTop: "40px", paddingLeft: "16px", paddingRight: "16px", paddingBottom: "100px", position: "relative", zIndex: 1 }}>
        {articlesFiltres.length === 0 && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", paddingTop: "60px" }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>📦</div>
            <p>Aucun article</p>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          {articlesFiltres.map((a, i) => (
            <div key={a.id} onClick={() => selectionMode ? toggleSelect(a.id) : router.push(`/articles/${a.id}`)} style={{ background: "rgba(255,255,255,0.05)", border: selected.includes(a.id) ? "2px solid #ff4d5a" : "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", overflow: "hidden", cursor: "pointer", position: "relative" }}>
              <div style={{ height: "100px", background: a.images && a.images.length > 0 ? "transparent" : gradients[i % gradients.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px", position: "relative" }}>
                {a.masquerDuSite && (
                  <div style={{ position: "absolute", bottom: "6px", left: "6px", zIndex: 2, background: "rgba(26,31,58,0.85)", borderRadius: "8px", padding: "2px 7px", fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>🚫 Masqué</div>
                )}
                {selectionMode && (
                  <div style={{ position: "absolute", top: "6px", left: "6px", zIndex: 2, width: "22px", height: "22px", borderRadius: "50%", border: "2px solid white", background: selected.includes(a.id) ? "#ff4d5a" : "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "white", lineHeight: 1 }}>{selected.includes(a.id) ? "✓" : ""}</div>
                )}
                {a.images && a.images.length > 0 ? (
                  <>
                    <img src={thumb(a.images[0].url)} alt={a.nom} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div style={{ position: "absolute", top: "6px", right: "6px", background: "rgba(0,0,0,0.5)", borderRadius: "8px", padding: "2px 7px", fontSize: "9px", color: "rgba(255,255,255,0.8)" }}>{a.images.length} 📷</div>
                  </>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", color: "rgba(255,255,255,0.2)" }}>
                    <span>📷</span>
                    <span style={{ fontSize: "10px" }}>Ajouter photo</span>
                  </div>
                )}
              </div>
              <div style={{ padding: "10px" }}>
                <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#ff4d5a", marginBottom: "3px" }}>{a.ref}</p>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nom}</p>
                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "1px" }}>{dossiers.find(d => d.id === a.dossierId)?.nom || "Sans dossier"}</p>
                <p style={{ fontSize: "13px", fontWeight: 800, color: "#ff8c42", marginTop: "3px" }}>{a.prix ? `${a.prix} €` : "—"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectionMode && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 60, background: "rgba(26,31,58,0.97)", borderTop: "1px solid rgba(255,255,255,0.1)", padding: "14px 16px calc(14px + env(safe-area-inset-bottom))", display: "flex", alignItems: "center", gap: "10px", boxShadow: "0 -6px 20px rgba(0,0,0,0.3)" }}>
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", fontWeight: 600, flexShrink: 0 }}>{selected.length} sél.</span>
          <button onClick={() => appliquerVisibilite(true)} disabled={busy || selected.length === 0} style={{ flex: 1, padding: "11px", borderRadius: "12px", border: "none", background: "rgba(255,255,255,0.12)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: (busy || selected.length === 0) ? 0.5 : 1 }}>🚫 Masquer</button>
          <button onClick={() => appliquerVisibilite(false)} disabled={busy || selected.length === 0} style={{ flex: 1, padding: "11px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #10b981, #059669)", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: (busy || selected.length === 0) ? 0.5 : 1 }}>✅ Afficher</button>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}