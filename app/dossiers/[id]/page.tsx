"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Article, Dossier } from "@/lib/airtable";
import { assignArticlesToDossier } from "@/lib/firebase";
import { thumb } from "@/lib/img";

export default function DossierPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [dossier, setDossier]   = useState<Dossier | null>(null);
  const [loading, setLoading]   = useState(true);
  const [filtre, setFiltre]     = useState("Tous");
  const [isAdmin, setIsAdmin]   = useState(false);

  // Sélecteur d'ajout en masse
  const [showPicker, setShowPicker]   = useState(false);
  const [allArticles, setAllArticles] = useState<Article[]>([]);
  const [allDossiers, setAllDossiers] = useState<Dossier[]>([]);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerFilter, setPickerFilter] = useState<"none" | "all">("none");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [assigning, setAssigning]     = useState(false);

  const router = useRouter();
  const params = useParams();
  const id     = params.id as string;

  useEffect(() => {
    const user = getSession();
    if (!user) { router.push("/"); return; }
    setIsAdmin(user.role === "Admin");
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [resD, resA] = await Promise.all([
        fetch("/api/dossiers", { cache: "no-store" }),
        fetch(`/api/articles?dossierId=${id}`, { cache: "no-store" }),
      ]);
      const dataD = await resD.json();
      const dataA = await resA.json();
      const tousDossiers: Dossier[] = dataD.dossiers || [];
      setAllDossiers(tousDossiers);
      setDossier(tousDossiers.find((d: Dossier) => d.id === id) || null);
      setArticles(dataA.articles || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openPicker = async () => {
    setShowPicker(true);
    setSelected(new Set());
    setPickerSearch("");
    setPickerFilter("none");
    setPickerLoading(true);
    try {
      const res  = await fetch("/api/articles", { cache: "no-store" });
      const data = await res.json();
      setAllArticles(data.articles || []);
    } catch (e) {
      console.error(e);
    } finally {
      setPickerLoading(false);
    }
  };

  const toggleSelect = (articleId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(articleId) ? next.delete(articleId) : next.add(articleId);
      return next;
    });
  };

  const handleAssign = async () => {
    if (selected.size === 0) return;
    setAssigning(true);
    try {
      await assignArticlesToDossier([...selected], id);
      setShowPicker(false);
      await fetchData();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'assignation");
    } finally {
      setAssigning(false);
    }
  };

  // Articles proposés dans le sélecteur (jamais ceux déjà dans CE dossier)
  // « Rangé » = appartient à un dossier qui existe encore. Un article dont le
  // dossier a été supprimé (orphelin) n'est PAS rangé → il est « sans dossier ».
  const dossierIdsValides = new Set(allDossiers.map(d => d.id));
  const estRange = (a: Article) => !!(a.dossierId && dossierIdsValides.has(a.dossierId));
  const pickerArticles = allArticles
    .filter(a => a.dossierId !== id)
    .filter(a => pickerFilter === "all" ? true : !estRange(a))
    .filter(a => {
      if (!pickerSearch.trim()) return true;
      const q = pickerSearch.toLowerCase();
      return (a.ref || "").toLowerCase().includes(q) || (a.nom || "").toLowerCase().includes(q);
    });

  const filtres = ["Tous", "Téléphone", "Divers", "Sans photo"];
  const articlesFiltres = articles.filter(a => {
    if (filtre === "Tous")       return true;
    if (filtre === "Sans photo") return !a.images || a.images.length === 0;
    return a.type === filtre;
  });

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
        paddingTop: "60px", paddingBottom: "32px",
        paddingLeft: "20px", paddingRight: "20px",
        position: "relative", zIndex: 2,
      }}>
        <button onClick={() => router.push("/dossiers")} style={{ background: "none", border: "none", color: "#ff4d5a", fontSize: "21px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: "12px", display: "flex", alignItems: "center", gap: "4px" }}>‹ Retour</button>
        <h1 style={{ fontSize: "24px", fontWeight: 900, color: "#1a1f3a", marginBottom: "4px" }}>{dossier?.nom || "Dossier"}</h1>
        <p style={{ fontSize: "12px", color: "#8892b0", marginBottom: "16px" }}>{articles.length} article{articles.length > 1 ? "s" : ""}</p>
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
          {filtres.map(f => (
            <button key={f} onClick={() => setFiltre(f)} style={{ padding: "7px 14px", borderRadius: "50px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", background: filtre === f ? "#ff4d5a" : "white", color: filtre === f ? "white" : "#8892b0", border: filtre === f ? "none" : "1px solid #e2e5f0", boxShadow: filtre === f ? "0 4px 12px rgba(255,77,90,0.3)" : "0 2px 6px rgba(26,31,58,0.06)" }}>{f}</button>
          ))}
        </div>

        {isAdmin && (
          <button onClick={openPicker} style={{ marginTop: "16px", width: "100%", padding: "13px", borderRadius: "14px", border: "1.5px solid #1a1f3a", background: "#1a1f3a", color: "white", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>＋</span> Ajouter des articles à ce dossier
          </button>
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
            <div key={a.id} onClick={() => router.push(`/articles/${a.id}`)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", overflow: "hidden", cursor: "pointer" }}>
              <div style={{ height: "100px", background: a.images && a.images.length > 0 ? "transparent" : gradients[i % gradients.length], display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px", position: "relative" }}>
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
                <p style={{ fontSize: "13px", fontWeight: 800, color: "#ff8c42", marginTop: "3px" }}>{a.prix ? `${a.prix} €` : "—"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bouton ajouter — Admin seulement */}
      {isAdmin && (
        <button onClick={() => router.push(`/ajouter?dossierId=${id}`)} style={{
          position: "fixed", bottom: "32px", left: "20px",
          width: "52px", height: "52px", borderRadius: "50%",
          background: "linear-gradient(135deg, #10b981, #059669)",
          border: "none", cursor: "pointer", fontSize: "26px", zIndex: 50,
          boxShadow: "0 8px 24px rgba(16,185,129,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>＋</button>
      )}

      {/* Sélecteur d'ajout en masse */}
      {showPicker && (
        <div onClick={() => !assigning && setShowPicker(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1a1f3a", borderRadius: "28px 28px 0 0", width: "100%", maxWidth: "480px", height: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

            <div style={{ padding: "20px 20px 14px", flexShrink: 0 }}>
              <div style={{ width: "40px", height: "4px", background: "rgba(255,255,255,0.2)", borderRadius: "2px", margin: "0 auto 18px" }} />
              <h2 style={{ fontSize: "19px", fontWeight: 900, color: "white", marginBottom: "14px", textAlign: "center" }}>Ajouter à « {dossier?.nom} »</h2>

              <div style={{ display: "flex", alignItems: "center", gap: "9px", background: "rgba(255,255,255,0.07)", borderRadius: "12px", padding: "10px 14px", marginBottom: "10px" }}>
                <span style={{ fontSize: "15px", color: "rgba(255,255,255,0.4)" }}>🔍</span>
                <input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="Chercher par réf ou nom…" style={{ flex: 1, border: "none", outline: "none", background: "none", color: "white", fontSize: "14px", fontFamily: "inherit" }} />
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                {([["none", "Sans dossier"], ["all", "Tous"]] as const).map(([val, lbl]) => (
                  <button key={val} onClick={() => setPickerFilter(val)} style={{ flex: 1, padding: "9px", borderRadius: "10px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 700, fontFamily: "inherit", background: pickerFilter === val ? "#ff4d5a" : "rgba(255,255,255,0.07)", color: pickerFilter === val ? "white" : "rgba(255,255,255,0.5)" }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "0 20px", minHeight: 0 }}>
              {pickerLoading ? (
                <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
                  <div style={{ width: "28px", height: "28px", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#ff4d5a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                </div>
              ) : pickerArticles.length === 0 ? (
                <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "13px", paddingTop: "40px" }}>
                  {pickerFilter === "none" ? "Aucun article sans dossier." : "Aucun article."}
                </p>
              ) : (
                pickerArticles.map(a => {
                  const isSel = selected.has(a.id);
                  return (
                    <button key={a.id} onClick={() => toggleSelect(a.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "14px", marginBottom: "8px", background: isSel ? "rgba(255,77,90,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${isSel ? "rgba(255,77,90,0.4)" : "rgba(255,255,255,0.07)"}`, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                      <div style={{ width: "24px", height: "24px", borderRadius: "7px", flexShrink: 0, border: `2px solid ${isSel ? "#ff4d5a" : "rgba(255,255,255,0.25)"}`, background: isSel ? "#ff4d5a" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "13px" }}>{isSel ? "✓" : ""}</div>
                      <div style={{ width: "42px", height: "42px", borderRadius: "10px", overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>
                        {a.images && a.images.length > 0 ? <img src={thumb(a.images[0].url)} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "📷"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#ff4d5a", marginBottom: "2px" }}>{a.ref}</p>
                        <p style={{ fontSize: "13px", fontWeight: 700, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nom}</p>
                      </div>
                      {estRange(a) && (
                        <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", flexShrink: 0 }}>déjà rangé</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div style={{ padding: "14px 20px calc(20px + env(safe-area-inset-bottom))", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <button onClick={handleAssign} disabled={selected.size === 0 || assigning} style={{ width: "100%", padding: "16px", borderRadius: "16px", border: "none", cursor: selected.size === 0 ? "default" : "pointer", fontSize: "15px", fontWeight: 700, fontFamily: "inherit", color: "white", background: selected.size === 0 ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #ff4d5a, #ff6b35)", opacity: assigning ? 0.6 : 1 }}>
                {assigning ? "Assignation…" : selected.size === 0 ? "Sélectionne des articles" : `Assigner ${selected.size} article${selected.size > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}