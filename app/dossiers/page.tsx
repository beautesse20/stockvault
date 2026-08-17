"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, clearSession } from "@/lib/auth";
import { Dossier } from "@/lib/airtable";
import { getCache, setCache, invalidateCache, isStale } from "@/lib/cache";

export default function DossiersPage() {
  const [dossiers, setDossiers]           = useState<Dossier[]>([]);
  const [loading, setLoading]             = useState(true);
  const [userName, setUserName]           = useState("");
  const [admin, setAdmin]                 = useState(false);
  const [totalArticles, setTotalArticles] = useState(0);
  const [articles, setArticles]           = useState<any[]>([]);
  const [query, setQuery]                 = useState(() => (typeof window !== "undefined" ? sessionStorage.getItem("dos-search") || "" : ""));
  const [ventesMois, setVentesMois]       = useState<{ ventes: number; ca: number } | null>(null);
  const [dashOpen, setDashOpen]           = useState(false); // admin : dashboard replié par défaut
  const [listingsByRef, setListingsByRef] = useState<Record<string, string[]> | null>(null);
  const router = useRouter();

  useEffect(() => {
    const user = getSession();
    if (!user) { router.push("/"); return; }
    setUserName(user.nom);
    setAdmin(user.role === "Admin");
    fetchDossiers(user);
    // Ventes du mois (admin uniquement) — total de TOUTES les ventes (Sheet outil de ventes)
    if (user.role === "Admin") {
      fetch("/api/ventes-mois", { cache: "no-store" })
        .then(r => r.json())
        .then(d => { if (d.success) setVentesMois({ ventes: d.ventes, ca: d.ca }); })
        .catch(() => {});
    }
  }, []);

  const appliquer = (user: any, dataD: any, dataTotal: any) => {
    const all: Dossier[] = dataD?.dossiers || [];
    const allArticles: any[] = dataTotal?.articles || [];
    if (user.role === "Admin") {
      setDossiers(all);
      setArticles(allArticles);
      setTotalArticles(allArticles.length);
    } else {
      setDossiers(all.filter(d => user.dossierIds?.includes(d.id)));
      const mine = allArticles.filter((a: any) => user.dossierIds?.includes(a.dossierId));
      setArticles(mine);
      setTotalArticles(mine.length);
    }
  };

  const revalider = async (user: any) => {
    try {
      const [resD, resA] = await Promise.all([
        fetch("/api/dossiers", { cache: "no-store" }),
        fetch("/api/articles", { cache: "no-store" }),
      ]);
      const dataD = await resD.json(); const dataTotal = await resA.json();
      setCache("dossiers", dataD); setCache("articles", dataTotal);
      appliquer(user, dataD, dataTotal);
    } catch (e) { console.error(e); }
  };

  const fetchDossiers = async (user: any) => {
    const dataD = getCache<any>("dossiers");
    const dataTotal = getCache<any>("articles");
    // Cache présent → affichage instantané, rafraîchissement en fond si périmé.
    if (dataD && dataTotal) {
      appliquer(user, dataD, dataTotal);
      setLoading(false);
      if (isStale("dossiers") || isStale("articles")) revalider(user);
      return;
    }
    try {
      await revalider(user);
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
      invalidateCache("dossiers");
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

  // Statut "en ligne" (plateformes marketplace) — chargé en LAZY + cache, uniquement
  // quand une recherche enrichie (≤3 résultats) le nécessite. Zéro impact ailleurs.
  const enrichi = resultats.length > 0 && resultats.length <= 3;
  useEffect(() => {
    if (!enrichi || listingsByRef !== null) return;
    (async () => {
      let all: any[] | null = getCache<any[]>("listings-all");
      if (!all) {
        try {
          const r = await fetch("/api/listings?ref=", { cache: "no-store" });
          const d = await r.json();
          if (d.success) { all = d.listings || []; setCache("listings-all", all); }
        } catch {}
      }
      const map: Record<string, string[]> = {};
      (all || []).forEach((l: any) => { if (l.active && l.ref) (map[l.ref] ||= []).push(l.platform); });
      setListingsByRef(map);
    })();
  }, [enrichi, listingsByRef]);
  const PLAT_NOMS: Record<string, string> = { lbc: "LeBonCoin", vinted: "Vinted", rakuten: "Rakuten", facebook: "Facebook" };

  // ── Stats du dashboard (calculées depuis Firebase) ──
  const lieuDe = (dossierId?: string) => {
    const n = (dossiers.find(d => d.id === dossierId)?.nom || "").toLowerCase();
    if (n.includes("paris")) return "Paris";
    if (n.includes("vancouver")) return "Vancouver";
    return null;
  };
  const aPhoto = (a: any) => Array.isArray(a.images) && a.images.length > 0;
  const actifs = articles.filter((a: any) => !a.vendu);
  const valeurStock = actifs.reduce((s: number, a: any) => s + (Number(a.prix) || 0), 0);
  const avecPhoto = actifs.filter(aPhoto).length;
  const visibles = actifs.filter((a: any) => aPhoto(a) && lieuDe(a.dossierId) && !(a as any).masquerDuSite).length;
  const aCompleter = actifs.length - visibles;
  const sansPhoto = actifs.filter((a: any) => !aPhoto(a)).length;
  const sansDossier = actifs.filter((a: any) => !a.dossierId).length;
  const sansPrix = actifs.filter((a: any) => !(Number(a.prix) > 0)).length;
  const seuil30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const dormant = actifs.filter((a: any) => { const t = Date.parse(a.createdAt || ""); return t && t < seuil30; }).length;
  const nbParis = actifs.filter((a: any) => lieuDe(a.dossierId) === "Paris").length;
  const nbVan = actifs.filter((a: any) => lieuDe(a.dossierId) === "Vancouver").length;
  const pct = (n: number, t: number) => (t > 0 ? Math.round((n / t) * 100) : 0);

  const goArticles = (filtre?: string) => {
    try { if (filtre) sessionStorage.setItem("art-filtre", filtre); } catch {}
    router.push("/articles");
  };

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
              onChange={(e) => { setQuery(e.target.value); try { sessionStorage.setItem("dos-search", e.target.value); } catch {} }}
              placeholder="Rechercher un article (réf, nom)…"
              style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: "14px", color: "#1a1f3a", fontFamily: "inherit" }}
            />
            {query.length > 0 && (
              <button onClick={() => { setQuery(""); try { sessionStorage.removeItem("dos-search"); } catch {} }} title="Effacer" style={{ border: "none", background: "rgba(26,31,58,0.08)", borderRadius: "50%", width: "20px", height: "20px", cursor: "pointer", fontSize: "11px", color: "#1a1f3a", lineHeight: 1, flexShrink: 0 }}>✕</button>
            )}
          </div>
          <div style={{ position: "absolute", right: "-2px", top: "-10px", background: "#ff4d5a", color: "white", fontSize: "9px", fontWeight: 800, letterSpacing: "0.3px", padding: "3px 9px", borderRadius: "20px", boxShadow: "0 3px 9px rgba(255,77,90,0.45)" }}>NOUVEAU</div>
        </div>

        <div style={{ background: "linear-gradient(135deg, #1a1f3a 0%, #2d1b69 60%, #1e2d6b 100%)", borderRadius: "22px", padding: "18px", position: "relative", overflow: "hidden", boxShadow: "0 12px 30px rgba(26,31,58,0.3)" }}>
          <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "130px", height: "130px", background: "radial-gradient(circle, rgba(255,77,90,0.3), transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "-30px", left: "-20px", width: "110px", height: "110px", background: "radial-gradient(circle, rgba(108,99,255,0.25), transparent 70%)", pointerEvents: "none" }} />
          {admin ? (
            <button onClick={() => setDashOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: dashOpen ? "14px" : 0, position: "relative" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, textAlign: "left" }}>
                <span style={{ color: "#10b981" }}>💰 {ventesMois ? ventesMois.ventes : "—"} ventes</span>
                <span style={{ color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>{ventesMois && ventesMois.ca ? ` · ${Math.round(ventesMois.ca).toLocaleString("fr-FR")} $` : ""} ce mois</span>
              </span>
              <span style={{ fontSize: "18px", color: "rgba(255,255,255,0.45)", lineHeight: 1, transform: dashOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>⌄</span>
            </button>
          ) : (
            <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: "12px", position: "relative" }}>Vue d'ensemble</p>
          )}

          {(!admin || dashOpen) && (<>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "14px", position: "relative" }}>
            <div onClick={() => router.push("/articles")} style={{ background: "rgba(255,255,255,0.06)", borderRadius: "12px", padding: "10px 12px", cursor: "pointer" }}>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#ff8c42", lineHeight: 1.1 }}>{valeurStock.toLocaleString("fr-FR")} €</div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", marginTop: "3px" }}>Valeur du stock</div>
            </div>
            {admin && (
              <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "12px", padding: "10px 12px" }}>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "white", lineHeight: 1.1 }}>{visibles}</div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", marginTop: "3px" }}>En ligne sur le site</div>
              </div>
            )}
            <div onClick={() => goArticles("Sans photo")} style={{ background: "rgba(255,77,90,0.12)", borderRadius: "12px", padding: "10px 12px", cursor: "pointer" }}>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#ff4d5a", lineHeight: 1.1 }}>{sansPhoto}</div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.55)", marginTop: "3px" }}>Sans photo</div>
            </div>
            {admin && (
              <div style={{ background: "rgba(16,185,129,0.12)", borderRadius: "12px", padding: "10px 12px" }}>
                <div style={{ fontSize: "20px", fontWeight: 800, color: "#10b981", lineHeight: 1.1 }}>{ventesMois ? ventesMois.ventes : "—"}</div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.55)", marginTop: "3px" }}>Vendus ce mois{ventesMois && ventesMois.ca ? ` · ${Math.round(ventesMois.ca).toLocaleString("fr-FR")} $` : ""}</div>
              </div>
            )}
          </div>

          {/* Entonnoir de publication */}
          <div style={{ position: "relative", marginBottom: "12px" }}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>Pipeline de publication</div>
            {[
              { lbl: `${actifs.length} en stock`, w: 100, c: "linear-gradient(90deg,#ff4d5a,#ff8c42)", o: 1 },
              { lbl: `${avecPhoto} avec photo`, w: pct(avecPhoto, actifs.length), c: "linear-gradient(90deg,#ff4d5a,#ff8c42)", o: 0.8 },
              { lbl: `${visibles} en ligne`, w: pct(visibles, actifs.length), c: "#10b981", o: 1 },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                <div style={{ flex: 1, height: "18px", background: "rgba(255,255,255,0.06)", borderRadius: "5px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.max(s.w, 4)}%`, background: s.c, opacity: s.o, borderRadius: "5px" }} />
                </div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", width: "108px", flexShrink: 0 }}>{s.lbl}</div>
              </div>
            ))}
          </div>

          {/* Répartition par lieu — admin uniquement */}
          {admin && (
            <div style={{ position: "relative", marginBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>
                <span>🇫🇷 Paris · {nbParis}</span><span>Vancouver · {nbVan} 🇨🇦</span>
              </div>
              <div style={{ height: "6px", background: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden", display: "flex" }}>
                <div style={{ height: "100%", width: `${pct(nbParis, nbParis + nbVan)}%`, background: "#ff4d5a" }} />
                <div style={{ height: "100%", flex: 1, background: "rgba(255,255,255,0.25)" }} />
              </div>
            </div>
          )}

          {/* À faire */}
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>À faire</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
              {[
                { lbl: "Sans photo", n: sansPhoto, c: "#ff4d5a", f: "Sans photo" },
                { lbl: "Sans dossier", n: sansDossier, c: "#ff8c42", f: "Sans dossier" },
                { lbl: "Sans prix", n: sansPrix, c: "rgba(255,255,255,0.7)", f: undefined as string | undefined },
                { lbl: "Dorment +30 j", n: dormant, c: "rgba(255,255,255,0.7)", f: undefined as string | undefined },
              ].map((it, i) => (
                <div key={i} onClick={() => goArticles(it.f)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.06)", borderRadius: "10px", padding: "9px 11px", cursor: "pointer" }}>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.65)" }}>{it.lbl}</span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: it.c }}>{it.n} ›</span>
                </div>
              ))}
            </div>
          </div>
          </>)}
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
            {resultats.map((a: any) => {
              // ≤ 3 résultats → carte enrichie (détails sans ouvrir la fiche) ; au-delà → compact.
              const isTel = /t[eé]l/.test(String(a.type || "").toLowerCase()) || !!(a.stockage || a.ecran || a.batterie);
              const sym = lieuDe(a.dossierId) === "Vancouver" ? "$" : "€";
              // 6 attributs : stockage, couleur, écran, coque, batterie (+ défaut en badge).
              const specs = (isTel
                ? [a.stockage, a.couleur, a.ecran && `écran ${a.ecran}`, a.coque && `coque ${a.coque}`, a.batterie && `batt ${a.batterie}`]
                : [a.description, a.commentaire]).filter(Boolean);
              // Plateformes marketplace où l'article est en ligne (site web = implicite, non affiché).
              const platsEnLigne = (listingsByRef?.[a.ref] || []).map(p => PLAT_NOMS[p] || p);

              if (!enrichi) {
                return (
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
                );
              }

              return (
                <div key={a.id} onClick={() => router.push(`/articles/${a.id}`)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "14px", display: "flex", gap: "12px", marginBottom: "10px", cursor: "pointer" }}>
                  {a.images && a.images[0] ? (
                    <img src={thumb(a.images[0].url)} alt="" style={{ width: "64px", height: "64px", borderRadius: "14px", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: "64px", height: "64px", borderRadius: "14px", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", flexShrink: 0 }}>📱</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <p style={{ fontSize: "15px", fontWeight: 800, color: "white", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nom || "Sans nom"}</p>
                      {a.prix > 0 && <span style={{ fontSize: "14px", fontWeight: 800, color: "white", flexShrink: 0 }}>{a.prix} {sym}</span>}
                    </div>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", margin: "2px 0 8px" }}>{a.ref || "—"} · {dossierNom(a.dossierId)}</p>
                    {specs.length > 0 && (
                      <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", margin: "0 0 6px", lineHeight: 1.5 }}>{specs.join(" · ")}</p>
                    )}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                      {a.defaut && <span style={{ padding: "3px 9px", borderRadius: "50px", fontSize: "10px", fontWeight: 700, background: "rgba(255,140,66,0.15)", color: "#ff8c42" }}>⚠️ {a.defaut}</span>}
                      {platsEnLigne.length > 0 && <span style={{ padding: "3px 9px", borderRadius: "50px", fontSize: "10px", fontWeight: 700, background: "rgba(16,185,129,0.15)", color: "#10b981" }}>🟢 En ligne : {platsEnLigne.join(" · ")}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
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