"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Article, Dossier } from "@/lib/airtable";
import { thumb, medium } from "@/lib/img";
import { compressImage } from "@/lib/compress";
import { uploadToCloudinary } from "@/lib/cloudinary-direct";
import { appendArticleImage } from "@/lib/firebase";
import { getCache, setCache, invalidateCache, isStale } from "@/lib/cache";

export default function ArticlePage() {
  const [article, setArticle]     = useState<Article | null>(null);
  const [dossiers, setDossiers]   = useState<Dossier[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showMove, setShowMove]   = useState(false);
  const [photoIdx, setPhotoIdx]   = useState(0);
  const [lightbox, setLightbox]   = useState(false);
  const [form, setForm]           = useState<Partial<Article>>({});
  const [isAdmin, setIsAdmin]     = useState(false);
  const [userSession, setUserSession] = useState<any>(null);
  const [visSaving, setVisSaving] = useState(false);
  const [modal, setModal]         = useState<null | { message: string; onConfirm?: () => void }>(null);
  // Rédaction d'annonce inline
  const [showAnnonce, setShowAnnonce]   = useState(false);
  const [annPlats, setAnnPlats]         = useState<string[]>([]);
  const [annPrecision, setAnnPrecision] = useState("");
  const [annLoading, setAnnLoading]     = useState(false);
  const [annResults, setAnnResults]     = useState<any[] | null>(null);
  const [annErr, setAnnErr]             = useState("");
  const [annSaved, setAnnSaved]         = useState<any[]>([]);
  const [copiedKey, setCopiedKey]       = useState("");
  // Suivi "mis en ligne" (rotation)
  const [listings, setListings]         = useState<any[]>([]);
  const [postePlats, setPostePlats]     = useState<string[]>([]);
  const [posteSaved, setPosteSaved]     = useState(false);
  const [posteBusy, setPosteBusy]       = useState(false);
  // Prix réel (recherche web, asynchrone)
  const [prixReel, setPrixReel]         = useState<any | null>(null);
  const [prixLoading, setPrixLoading]   = useState(false);
  const [prixErr, setPrixErr]           = useState(false);
  const [prixLbc, setPrixLbc]           = useState<any | null>(null);
  const [prixLbcLoading, setPrixLbcLoading] = useState(false);
  const [prixLbcErr, setPrixLbcErr]     = useState(false);
  const [prixCanada, setPrixCanada]     = useState<any | null>(null);
  const [prixCanadaLoading, setPrixCanadaLoading] = useState(false);
  const [prixCanadaErr, setPrixCanadaErr] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const fileRef                   = useRef<HTMLInputElement>(null);
  const touchStartX               = useRef(0);
  const router                    = useRouter();
  const params                    = useParams();
  const id                        = params.id as string;

  useEffect(() => {
    const user = getSession();
    if (!user) { router.push("/"); return; }
    setIsAdmin(user.role === "Admin");
    setUserSession(user);
    fetchData(user);
  }, []);

  // Navigation clavier quand on est en plein écran (lightbox) :
  // flèches ← → pour changer de photo, Échap pour fermer.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      const n = article?.images?.length || 0;
      if (e.key === "Escape") { setLightbox(false); return; }
      if (n < 2) return;
      if (e.key === "ArrowRight") setPhotoIdx(i => (i + 1) % n);
      else if (e.key === "ArrowLeft") setPhotoIdx(i => (i - 1 + n) % n);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, article]);

  // Charge les annonces déjà enregistrées pour ce produit (onglet Annonces IA).
  useEffect(() => {
    if (!article?.ref) return;
    (async () => {
      try {
        const res = await fetch(`/api/annonces?ref=${encodeURIComponent(article.ref)}`, { cache: "no-store" });
        const data = await res.json();
        if (data.success) setAnnSaved(data.entries || []);
      } catch {}
      try {
        const r = await fetch(`/api/listings?ref=${encodeURIComponent(article.ref)}`, { cache: "no-store" });
        const d = await r.json();
        if (d.success) setListings(d.listings || []);
      } catch {}
    })();
  }, [article?.ref]);

  // Marque / retire une plateforme en ligne pour cet article.
  const majListing = async (platform: string, active: boolean) => {
    if (!article?.ref) return;
    setListings(prev => {
      const o = prev.filter(l => l.platform !== platform);
      return [...o, { platform, active, postedAt: active ? new Date().toISOString() : (prev.find(l => l.platform === platform)?.postedAt || null) }];
    });
    await fetch("/api/listings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref: article.ref, platform, active }) }).catch(() => {});
  };
  const confirmPoste = async () => {
    if (!article?.ref || posteBusy) return;
    setPosteBusy(true);
    await Promise.all(postePlats.map(p => majListing(p, true)));
    setPosteBusy(false); setPosteSaved(true);
  };
  const joursDepuis = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

  const ANN_PLATEFORMES = [
    { id: "lbc", nom: "LeBonCoin" },
    { id: "vinted", nom: "Vinted" },
    { id: "rakuten", nom: "Rakuten" },
    { id: "facebook", nom: "Facebook" },
  ];

  const toggleAnnPlat = (pid: string) =>
    setAnnPlats(prev => prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]);

  // Recherche du prix réel (web) — lancée en parallèle, s'affiche quand prête.
  const lancerPrixReel = () => {
    if (!article) return;
    setPrixReel(null); setPrixErr(false); setPrixLoading(true);
    fetch("/api/prix-reel", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ article }),
    })
      .then(r => r.json())
      .then(d => { if (d.success) setPrixReel(d.prix); else setPrixErr(true); })
      .catch(() => setPrixErr(true))
      .finally(() => setPrixLoading(false));
  };

  // Prix LeBonCoin réel (Bright Data) — en parallèle de Brave, pour comparer.
  const lancerPrixLbc = () => {
    if (!article) return;
    setPrixLbc(null); setPrixLbcErr(false); setPrixLbcLoading(true);
    fetch("/api/prix-lbc", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ article }),
    })
      .then(r => r.json())
      .then(d => { if (d.success && d.prix?.fourchette) setPrixLbc(d.prix); else setPrixLbcErr(true); })
      .catch(() => setPrixLbcErr(true))
      .finally(() => setPrixLbcLoading(false));
  };

  const lancerPrixCanada = () => {
    if (!article) return;
    setPrixCanada(null); setPrixCanadaErr(false); setPrixCanadaLoading(true);
    fetch("/api/prix-canada", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ article }),
    })
      .then(r => r.json())
      .then(d => { if (d.success && d.prix?.fourchette) setPrixCanada(d.prix); else setPrixCanadaErr(true); })
      .catch(() => setPrixCanadaErr(true))
      .finally(() => setPrixCanadaLoading(false));
  };

  const genererAnnonces = async () => {
    if (!article || annPlats.length === 0) return;
    setAnnLoading(true); setAnnErr(""); setAnnResults(null);
    // Prix conscients des plateformes cochées → on n'appelle QUE ce qui sert (économie tokens/coût).
    const frSel = annPlats.some(p => ["lbc", "vinted", "rakuten"].includes(p)); // marché France €
    const fbSel = annPlats.includes("facebook");                                 // marché Canada CAD
    if (frSel) { lancerPrixReel(); lancerPrixLbc(); }  // Brave FR + LeBonCoin réel (Bright Data)
    if (fbSel) { lancerPrixCanada(); }                 // Marché canadien Vancouver (CAD)
    try {
      const res = await fetch("/api/annonces", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article, plateformes: annPlats, precision: annPrecision }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Génération échouée");
      setAnnResults(data.annonces);
      setPostePlats([...annPlats]); setPosteSaved(false); // pré-coche pour la confirmation "mis en ligne"
      try {
        const r2 = await fetch(`/api/annonces?ref=${encodeURIComponent(article.ref)}`, { cache: "no-store" });
        const d2 = await r2.json();
        if (d2.success) setAnnSaved(d2.entries || []);
      } catch {}
    } catch (e: any) {
      setAnnErr(e.message || "Erreur");
    } finally {
      setAnnLoading(false);
    }
  };

  const copierAnn = async (txt: string, key: string) => {
    try { await navigator.clipboard.writeText(txt); setCopiedKey(key); setTimeout(() => setCopiedKey(""), 1500); } catch {}
  };

  const appliquer = (currentUser: any, dataA: any, dataD: any) => {
    setArticle(dataA?.article);
    setForm(dataA?.article);
    const allDossiers: Dossier[] = dataD?.dossiers || [];
    setDossiers(currentUser?.role === "Admin" ? allDossiers : allDossiers.filter(d => currentUser?.dossierIds?.includes(d.id)));
  };

  const revalider = async (currentUser: any) => {
    const [resA, resD] = await Promise.all([
      fetch(`/api/articles/${id}`, { cache: "no-store" }),
      fetch("/api/dossiers", { cache: "no-store" }),
    ]);
    const dataA = await resA.json(); const dataD = await resD.json();
    setCache(`article:${id}`, dataA); setCache("dossiers", dataD);
    appliquer(currentUser, dataA, dataD);
  };

  const fetchData = async (user?: any) => {
    const currentUser = user || userSession;
    const cA = getCache<any>(`article:${id}`);
    const cD = getCache<any>("dossiers");
    if (cA && cD) {
      appliquer(currentUser, cA, cD);
      setLoading(false);
      if (isStale(`article:${id}`) || isStale("dossiers")) revalider(currentUser).catch(e => console.error(e));
      return;
    }
    try { await revalider(currentUser); } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      invalidateCache("articles", `article:${id}`);
      await fetchData();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleVisible = async () => {
    if (!article) return;
    const nouveauMasque = !(article.masquerDuSite === true); // on inverse l'état
    setVisSaving(true);
    try {
      const res = await fetch(`/api/articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ masquerDuSite: nouveauMasque }),
      });
      if (!res.ok) throw new Error("échec");
      setArticle(prev => (prev ? { ...prev, masquerDuSite: nouveauMasque } : prev));
      setForm(prev => ({ ...prev, masquerDuSite: nouveauMasque }));
    } catch (e) {
      console.error(e);
      setModal({ message: "Impossible de modifier l'affichage en ligne. Réessaie." });
    } finally {
      setVisSaving(false);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (fileRef.current) fileRef.current.value = "";
    if (!files.length) return;
    setTimeout(async () => {
      const remaining = 10 - (article?.images?.length || 0);
      const toUpload  = files.slice(0, remaining);
      if (!toUpload.length) return;
      setUploading(true);
      try {
        await Promise.all(toUpload.map(async (file) => {
          const compressed = await compressImage(file);
          const { url, publicId } = await uploadToCloudinary(compressed);
          await appendArticleImage(id, { url, filename: file.name, publicId });
        }));
        await fetchData();
      } finally {
        setUploading(false);
      }
    }, 150);
  };

  const handleDeleteImage = async (index: number) => {
    await fetch(`/api/articles/${id}/images`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIndex: index }),
    });
    invalidateCache("articles", `article:${id}`);
    await fetchData();
    setPhotoIdx(0);
  };

  const handleMove = async (dossierId: string) => {
    await fetch(`/api/articles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dossierId }),
    });
    invalidateCache("articles", "dossiers", `article:${id}`);
    setShowMove(false);
    await fetchData();
  };

  // Partage natif (AirDrop / WhatsApp / Mail…). Texte court + lien vers la
  // fiche publique. Appel synchrone dans le geste utilisateur (pas d'await avant
  // navigator.share, sinon iOS bloque l'ouverture du menu).
  const handlePartager = () => {
    if (!article) return;
    const url   = `${window.location.origin}/partage/${id}`;
    const texte = `👋 Regarde ce ${article.nom}${article.fonctionnel === "Oui" ? ", en parfait état" : ""}. Photos et détails ici :`;
    const data: any = { title: article.nom, text: texte, url };
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      (navigator as any).share(data).catch(() => {});
    } else {
      navigator.clipboard?.writeText(`${texte} ${url}`)
        .then(() => setModal({ message: "Lien copié dans le presse-papier !" }))
        .catch(() => setModal({ message: url }));
    }
    // Réchauffe le prix neuf en arrière-plan pour que la page partagée l'ait direct.
    if (!(article as any).prixNeuf) {
      fetch("/api/prix-neuf", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article }),
      })
        .then(r => r.json())
        .then(d => {
          if (d.success && d.neuf?.prix) {
            fetch(`/api/articles/${id}`, {
              method: "PATCH", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prixNeuf: d.neuf }),
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }
  };

  const handleDeleteArticle = async () => {
    setSaving(true);
    try {
      await fetch(`/api/articles/${id}`, { method: "DELETE" });
      invalidateCache("articles", "dossiers", `article:${id}`);
      router.push(article?.dossierId ? `/dossiers/${article.dossierId}` : "/dossiers");
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  const handleShareImage = async (url: string, filename: string) => {
    try {
      const res  = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        // Fallback navigateur desktop
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error(e);
    }
  };

  // Télécharger TOUTES les photos (originales) d'un coup. Mobile → menu natif
  // (« Enregistrer N images » dans la pellicule). Desktop → téléchargements multiples.
  const handleDownloadAll = async () => {
    const imgs = article?.images || [];
    if (!imgs.length || downloadingAll) return;
    setDownloadingAll(true);
    try {
      const ref = article?.ref || "photo";
      const files: File[] = [];
      for (let i = 0; i < imgs.length; i++) {
        const res  = await fetch(imgs[i].url);          // url originale Cloudinary (pleine qualité)
        const blob = await res.blob();
        files.push(new File([blob], `${ref}-${i + 1}.jpg`, { type: blob.type || "image/jpeg" }));
      }
      const nav: any = navigator;
      if (nav.canShare && nav.canShare({ files })) {
        await nav.share({ files, title: article?.nom || "Photos" });
      } else {
        // Repli desktop : un téléchargement par photo
        for (let i = 0; i < files.length; i++) {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(files[i]);
          a.download = files[i].name;
          a.click();
          await new Promise(r => setTimeout(r, 300));
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") setModal({ message: "Échec du téléchargement, réessaie." });
    } finally {
      setDownloadingAll(false);
    }
  };

  const nextPhoto = () => { if (article?.images) setPhotoIdx(i => (i + 1) % article.images!.length); };
  const prevPhoto = () => { if (article?.images) setPhotoIdx(i => (i - 1 + article.images!.length) % article.images!.length); };
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd   = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { diff > 0 ? nextPhoto() : prevPhoto(); }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#1a1f3a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "32px", height: "32px", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#ff4d5a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!article) return (
    <div style={{ minHeight: "100vh", background: "#1a1f3a", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)" }}>
      Article introuvable
    </div>
  );

  const images = article.images || [];
  const dossierNom = dossiers.find(d => d.id === article.dossierId)?.nom || "";
  const lieuOk = /paris|vancouver/i.test(dossierNom);
  const masque = article.masquerDuSite === true;
  const eligibleEnLigne = lieuOk && images.length > 0;

  // Affiche la batterie en pourcentage : 0.95 → "95 %", 95 → "95 %", "95%" → "95 %"
  const fmtBatterie = (v?: string | number) => {
    if (v === undefined || v === null || String(v).trim() === "") return "";
    const n = parseFloat(String(v).replace(",", ".").replace("%", "").trim());
    if (isNaN(n)) return String(v);
    const pct = n <= 1 ? n * 100 : n;
    return Math.round(pct) + " %";
  };

  return (
    <div style={{ minHeight: "100vh", background: "#1a1f3a", display: "flex", flexDirection: "column" }}>

      {/* Zone image blanche */}
      <div
        style={{ background: "#f0f2fc", borderRadius: "0 0 0 60px", height: "260px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "80px", position: "relative", flexShrink: 0, zIndex: 2, overflow: "hidden" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {images.length > 0 ? (
          <img src={medium(images[photoIdx]?.url)} alt={article.nom} style={{ width: "100%", height: "100%", objectFit: "contain", cursor: "pointer" }} onClick={() => setLightbox(true)} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", color: "rgba(26,31,58,0.2)" }}>
            <span>📷</span>
            <span style={{ fontSize: "14px" }}>Aucune photo</span>
          </div>
        )}

        <button onClick={() => router.back()} style={{ position: "absolute", top: "18px", left: "14px", width: "54px", height: "54px", borderRadius: "14px", background: "white", border: "none", cursor: "pointer", boxShadow: "0 2px 10px rgba(26,31,58,0.15)", fontSize: "22px", color: "#1a1f3a" }}>‹</button>

        {images.length > 0 && (
          <div style={{ position: "absolute", top: "18px", right: "14px", background: "white", borderRadius: "10px", padding: "5px 10px", fontSize: "10px", fontWeight: 700, color: "#1a1f3a", boxShadow: "0 2px 10px rgba(26,31,58,0.12)" }}>{images.length} / 10 📷</div>
        )}

        {/* Bouton supprimer photo — Admin seulement */}
        {images.length > 0 && (
          <button onClick={() => setModal({ message: "Supprimer cette photo ?", onConfirm: () => handleDeleteImage(photoIdx) })} style={{ position: "absolute", bottom: "18px", right: "14px", width: "64px", height: "64px", borderRadius: "18px", background: "rgba(255,77,90,0.9)", border: "none", cursor: "pointer", fontSize: "26px", color: "white" }}>🗑</button>
        )}

        {images.length > 1 && (
          <div style={{ position: "absolute", bottom: "14px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "5px" }}>
            {images.map((_: any, i: number) => (
              <button key={i} onClick={() => setPhotoIdx(i)} style={{ height: "5px", width: i === photoIdx ? "14px" : "5px", borderRadius: "3px", border: "none", cursor: "pointer", background: i === photoIdx ? "#ff4d5a" : "rgba(26,31,58,0.2)", transition: "all 0.2s", padding: 0 }} />
            ))}
          </div>
        )}
      </div>

      {/* Zone bleu nuit */}
      <div style={{ flex: 1, background: "#1a1f3a", borderRadius: "0 60px 0 0", paddingTop: "40px", paddingLeft: "18px", paddingRight: "18px", paddingBottom: "100px", position: "relative", zIndex: 1 }}>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
          <div>
            <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "#ff4d5a", marginBottom: "4px" }}>{article.ref}</p>
            <h1 style={{ fontSize: "22px", fontWeight: 900, color: "white" }}>{article.nom}</h1>
          </div>
          <p style={{ fontSize: "24px", fontWeight: 900, color: "#ff4d5a" }}>{article.prix ? `${article.prix}€` : "—"}</p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
          <span style={{ padding: "5px 12px", borderRadius: "50px", fontSize: "10px", fontWeight: 700, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
            📂 {dossiers.find(d => d.id === article.dossierId)?.nom || "Sans dossier"}
          </span>
          {article.fonctionnel && (
            <span style={{ padding: "5px 12px", borderRadius: "50px", fontSize: "10px", fontWeight: 700, background: article.fonctionnel === "Oui" ? "rgba(16,185,129,0.12)" : "rgba(255,77,90,0.12)", color: article.fonctionnel === "Oui" ? "#10b981" : "#ff4d5a", border: `1px solid ${article.fonctionnel === "Oui" ? "rgba(16,185,129,0.2)" : "rgba(255,77,90,0.2)"}` }}>
              {article.fonctionnel === "Oui" ? "✅ Fonctionnel" : "❌ Non fonctionnel"}
            </span>
          )}
        </div>

        {/* Affichage sur le site — Admin seulement */}
        {isAdmin && !editing && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", padding: "12px 14px", marginBottom: "16px" }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "white", marginBottom: "3px" }}>🌐 Affichage sur le site</p>
              <p style={{ fontSize: "10px", color: masque ? "#8892b0" : (eligibleEnLigne ? "#10b981" : "#E58A00") }}>
                {masque
                  ? "Masqué manuellement"
                  : eligibleEnLigne
                    ? "Visible en ligne"
                    : "Pas en ligne (photo ou dossier Paris/Vancouver manquant)"}
              </p>
            </div>
            <button
              onClick={toggleVisible}
              disabled={visSaving}
              title={masque ? "Afficher sur le site" : "Masquer du site"}
              style={{ position: "relative", width: "50px", height: "28px", borderRadius: "50px", border: "none", cursor: "pointer", flexShrink: 0, background: masque ? "rgba(255,255,255,0.18)" : "linear-gradient(135deg, #10b981, #059669)", opacity: visSaving ? 0.5 : 1, transition: "background 0.2s" }}
            >
              <span style={{ position: "absolute", top: "3px", left: masque ? "3px" : "25px", width: "22px", height: "22px", borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
            </button>
          </div>
        )}

        {/* Infos article */}
        {!editing ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" }}>
            {[
              { label: "Stockage", val: article.stockage },
              { label: "Couleur",  val: article.couleur },
              { label: "Écran",    val: article.ecran },
              { label: "Coque",    val: article.coque },
              { label: "Batterie", val: fmtBatterie(article.batterie) },
              { label: "Défaut",   val: article.defaut },
            ].filter(f => f.val).map(f => (
              <div key={f.label} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "10px 12px" }}>
                <p style={{ fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.5px", color: "rgba(255,255,255,0.25)", fontWeight: 600, marginBottom: "3px" }}>{f.label}</p>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{f.val}</p>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
            {[
              { label: "Nom",      key: "nom" },
              { label: "Prix (€)", key: "prix", type: "number" },
              { label: "Stockage", key: "stockage" },
              { label: "Couleur",  key: "couleur" },
              { label: "Écran",    key: "ecran" },
              { label: "Coque",    key: "coque" },
              { label: "Batterie", key: "batterie" },
              { label: "Défaut",   key: "defaut" },
            ].map(f => (
              <div key={f.key}>
                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>{f.label}</p>
                <input type={f.type || "text"} value={(form as any)[f.key] || ""} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "12px 16px", color: "white", fontSize: "14px", outline: "none", fontFamily: "inherit" }} />
              </div>
            ))}
            <div>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>Fonctionnel</p>
              <select value={form.fonctionnel || "Oui"} onChange={e => setForm(prev => ({ ...prev, fonctionnel: e.target.value }))} style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "12px 16px", color: "white", fontSize: "14px", outline: "none", fontFamily: "inherit" }}>
                <option value="Oui">Oui</option>
                <option value="Non">Non</option>
              </select>
            </div>
          </div>
        )}

        {/* Section photos */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.5)" }}>Photos</p>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {images.length > 0 && (
                <button onClick={handleDownloadAll} disabled={downloadingAll} style={{ fontSize: "11px", fontWeight: 700, color: downloadingAll ? "rgba(255,255,255,0.4)" : "#6366f1", background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: "50px", padding: "4px 12px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px" }}>
                  {downloadingAll ? <><span style={{ width: "10px", height: "10px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#6366f1", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} /> Préparation…</> : "⬇️ Tout télécharger"}
                </button>
              )}
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.05)", borderRadius: "50px", padding: "3px 10px" }}>{images.length} / 10</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "6px" }}>
            {images.map((img: any, i: number) => (
              <button key={i} onClick={() => { setPhotoIdx(i); setLightbox(true); }} style={{ width: "64px", height: "64px", borderRadius: "16px", overflow: "hidden", border: `2px solid ${i === photoIdx ? "#ff4d5a" : "transparent"}`, flexShrink: 0, cursor: "pointer", padding: 0, background: "none" }}>
                <img src={thumb(img.url)} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </button>
            ))}
            {/* Upload photo — Admin seulement */}
            {images.length < 10 && (
              <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ width: "64px", height: "64px", borderRadius: "16px", border: "2px dashed rgba(255,255,255,0.2)", flexShrink: 0, background: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: "10px", gap: "3px" }}>
                {uploading ? <div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#ff4d5a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> : <><span style={{ fontSize: "20px" }}>📷</span><span>Photo</span></>}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ position: "fixed", top: "-200px", opacity: 0, width: 0, height: 0 }} onChange={handleUpload} />
        </div>

        {/* Boutons — selon rôle */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {!editing ? (
            <>
              {/* Modifier — Admin seulement */}
              {isAdmin && (
                <button onClick={() => setEditing(true)} style={{ width: "100%", padding: "16px", borderRadius: "16px", background: "linear-gradient(135deg, #ff4d5a, #ff6b35)", border: "none", color: "white", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 20px rgba(255,77,90,0.35)" }}>✏️ Modifier l'article</button>
              )}
              {/* Rédiger annonce — Admin seulement (panneau inline, plus de détour launcher) */}
              {isAdmin && (
                <button onClick={() => { setAnnPlats([]); setAnnPrecision(""); setAnnResults(null); setAnnErr(""); setPrixReel(null); setPrixErr(false); setPrixLoading(false); setPrixLbc(null); setPrixLbcErr(false); setPrixLbcLoading(false); setPrixCanada(null); setPrixCanadaErr(false); setPrixCanadaLoading(false); setShowAnnonce(true); }} style={{ width: "100%", padding: "16px", borderRadius: "16px", background: "linear-gradient(135deg, #f59e0b, #d97706)", border: "none", color: "white", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 20px rgba(245,158,11,0.35)" }}>✍️ Rédiger une annonce</button>
              )}
              {/* Enregistrer la vente — Admin : ouvre Suivi des ventes avec l'article pré-sélectionné */}
              {isAdmin && article && (
                <button onClick={() => router.push(`/launcher?app=ventes&ref=${encodeURIComponent(article.ref || "")}&nom=${encodeURIComponent(article.nom || "")}&type=${encodeURIComponent(article.type || "")}`)} style={{ width: "100%", padding: "16px", borderRadius: "16px", background: "linear-gradient(135deg, #10b981, #059669)", border: "none", color: "white", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 20px rgba(16,185,129,0.35)" }}>💵 Enregistrer la vente</button>
              )}
              {/* Partager — envoie un lien vers la fiche publique via le menu natif */}
              <button onClick={handlePartager} style={{ width: "100%", padding: "16px", borderRadius: "16px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", color: "white", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 20px rgba(99,102,241,0.35)" }}>📤 Partager</button>
              {/* Déplacer — tous les utilisateurs, mais dossiers filtrés */}
              <button onClick={() => setShowMove(true)} style={{ width: "100%", padding: "16px", borderRadius: "16px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>📂 Déplacer vers un dossier</button>
              {/* Supprimer l'article — Admin seulement */}
              {isAdmin && (
                <button onClick={() => setModal({ message: "Supprimer définitivement cet article ?", onConfirm: handleDeleteArticle })} disabled={saving} style={{ width: "100%", padding: "16px", borderRadius: "16px", background: "rgba(255,77,90,0.12)", border: "1px solid rgba(255,77,90,0.3)", color: "#ff4d5a", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}>🗑 Supprimer l'article</button>
              )}
            </>
          ) : (
            <>
              <button onClick={handleSave} disabled={saving} style={{ width: "100%", padding: "16px", borderRadius: "16px", background: "linear-gradient(135deg, #ff4d5a, #ff6b35)", border: "none", color: "white", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 8px 20px rgba(255,77,90,0.35)", opacity: saving ? 0.6 : 1 }}>{saving ? "Enregistrement..." : "💾 Enregistrer"}</button>
              <button onClick={() => setEditing(false)} style={{ width: "100%", padding: "16px", borderRadius: "16px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
            </>
          )}
        </div>

        {/* Statut "en ligne" par plateforme (suivi rotation) — TOUJOURS visible (admin) */}
        {isAdmin && (
          <div style={{ marginTop: "22px" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: "10px" }}>📍 En ligne (clique pour marquer / retirer)</p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {[["lbc", "LeBonCoin"], ["vinted", "Vinted"], ["rakuten", "Rakuten"], ["facebook", "Facebook"]].map(([id, nom]) => {
                const l = listings.find(x => x.platform === id); const on = !!(l && l.active);
                return (
                  <button key={id} onClick={() => majListing(id, !on)} title={on && l?.postedAt ? `depuis ${joursDepuis(l.postedAt)} j` : ""} style={{ padding: "8px 12px", borderRadius: "99px", border: `1.5px solid ${on ? "#10b981" : "rgba(255,255,255,0.12)"}`, background: on ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)", color: on ? "#10b981" : "rgba(255,255,255,0.55)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    {on ? "🟢" : "⚪"} {nom}{on && l?.postedAt ? ` · ${joursDepuis(l.postedAt)}j` : ""}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Annonces enregistrées pour ce produit (relues depuis l'onglet Annonces IA) */}
        {isAdmin && annSaved.length > 0 && (
          <div style={{ marginTop: "22px" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: "10px" }}>📢 Annonces générées ({annSaved.length})</p>
            {annSaved.map((a, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "14px", marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{a.plateforme}</span>
                  <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{a.date} {a.heure}</span>
                </div>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "white", lineHeight: 1.35 }}>{a.titre}</p>
                {a.prix && <p style={{ fontSize: "13px", fontWeight: 700, color: "#f59e0b", marginTop: "6px" }}>💰 {a.prix}</p>}
                <button onClick={() => copierAnn(a.titre, `st${i}`)} style={{ width: "100%", padding: "8px", marginTop: "8px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "12px", fontWeight: 600, color: copiedKey === `st${i}` ? "#f59e0b" : "rgba(255,255,255,0.6)", cursor: "pointer", fontFamily: "inherit" }}>{copiedKey === `st${i}` ? "✓ Titre copié" : "Copier le titre"}</button>
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", lineHeight: 1.55, whiteSpace: "pre-line", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>{a.description}</p>
                <button onClick={() => copierAnn(a.description, `sd${i}`)} style={{ width: "100%", padding: "8px", marginTop: "8px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "12px", fontWeight: 600, color: copiedKey === `sd${i}` ? "#f59e0b" : "rgba(255,255,255,0.6)", cursor: "pointer", fontFamily: "inherit" }}>{copiedKey === `sd${i}` ? "✓ Description copiée" : "Copier la description"}</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal déplacer */}
      {showMove && (
        <div onClick={() => setShowMove(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1a1f3a", borderRadius: "28px 28px 0 0", width: "100%", maxWidth: "480px", padding: "24px 20px 48px" }}>
            <div style={{ width: "40px", height: "4px", background: "rgba(255,255,255,0.2)", borderRadius: "2px", margin: "0 auto 20px" }} />
            <h2 style={{ fontSize: "20px", fontWeight: 900, color: "white", marginBottom: "16px", textAlign: "center" }}>Déplacer vers…</h2>
            {dossiers.length === 0 && (
              <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>Aucun dossier disponible</p>
            )}
            {dossiers.map(d => (
              <button key={d.id} onClick={() => handleMove(d.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "14px", padding: "14px 16px", borderRadius: "16px", marginBottom: "8px", background: d.id === article.dossierId ? "rgba(255,77,90,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${d.id === article.dossierId ? "rgba(255,77,90,0.3)" : "rgba(255,255,255,0.07)"}`, color: d.id === article.dossierId ? "#ff4d5a" : "white", cursor: "pointer", fontFamily: "inherit", fontSize: "14px", fontWeight: 600 }}>
                <span style={{ fontSize: "20px" }}>📂</span>
                <span>{d.nom}</span>
                {d.id === article.dossierId && <span style={{ marginLeft: "auto", fontSize: "11px" }}>✓ Actuel</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Panneau Rédiger une annonce */}
      {showAnnonce && (
        <div onClick={() => { if (!annLoading) setShowAnnonce(false); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1a1f3a", borderRadius: "28px 28px 0 0", width: "100%", maxWidth: "480px", padding: "24px 20px 48px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ width: "40px", height: "4px", background: "rgba(255,255,255,0.2)", borderRadius: "2px", margin: "0 auto 20px" }} />
            <h2 style={{ fontSize: "20px", fontWeight: 900, color: "white", marginBottom: "4px", textAlign: "center" }}>✍️ Rédiger une annonce</h2>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", textAlign: "center", marginBottom: "20px" }}>{article.nom}</p>

            {!annResults ? (
              <>
                <p style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>Plateformes</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "18px" }}>
                  {ANN_PLATEFORMES.map(p => (
                    <button key={p.id} onClick={() => toggleAnnPlat(p.id)} style={{ padding: "14px", borderRadius: "14px", border: `1px solid ${annPlats.includes(p.id) ? "#f59e0b" : "rgba(255,255,255,0.1)"}`, background: annPlats.includes(p.id) ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.05)", color: annPlats.includes(p.id) ? "#f59e0b" : "white", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                      {annPlats.includes(p.id) && <span>✓</span>}{p.nom}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Précision (optionnel)</p>
                <input type="text" value={annPrecision} onChange={e => setAnnPrecision(e.target.value)} placeholder="ex: insiste sur la batterie neuve" style={{ width: "100%", padding: "13px 14px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "white", fontSize: "14px", fontFamily: "inherit", marginBottom: "18px", boxSizing: "border-box" }} />
                {annErr && <p style={{ color: "#ff4d5a", fontSize: "13px", marginBottom: "12px" }}>{annErr}</p>}
                <button onClick={genererAnnonces} disabled={annPlats.length === 0 || annLoading} style={{ width: "100%", padding: "16px", borderRadius: "16px", background: "linear-gradient(135deg, #f59e0b, #d97706)", border: "none", color: "white", fontSize: "15px", fontWeight: 700, cursor: annPlats.length === 0 ? "default" : "pointer", fontFamily: "inherit", opacity: (annPlats.length === 0 || annLoading) ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                  {annLoading ? <><span style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Génération...</> : "Générer les annonces"}
                </button>
              </>
            ) : (
              <>
                {/* Prix réel (recherche web) */}
                {(prixLoading || prixReel || prixErr) && (
                  <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "16px", padding: "14px", marginBottom: "14px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>💰 Marché web (Brave)</div>
                    {prixLoading ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>
                        <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#10b981", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Recherche d'annonces réelles en cours…
                      </div>
                    ) : prixErr ? (
                      <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>Prix réel indisponible. <button onClick={lancerPrixReel} style={{ background: "none", border: "none", color: "#10b981", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", padding: 0, textDecoration: "underline" }}>Réessayer</button></div>
                    ) : prixReel && !prixReel.fourchette && (!prixReel.annonces || prixReel.annonces.length === 0) ? (
                      <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)" }}>Aucun prix d'occasion trouvé pour ce modèle.</div>
                    ) : prixReel ? (
                      <>
                        {prixReel.fourchette && (
                          <p style={{ fontSize: "20px", fontWeight: 900, color: "white", marginBottom: "8px" }}>{prixReel.fourchette.min} – {prixReel.fourchette.max} €</p>
                        )}
                        {Array.isArray(prixReel.annonces) && prixReel.annonces.map((a: any, i: number) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", padding: "6px 0", borderTop: i === 0 ? "1px solid rgba(255,255,255,0.08)" : "none", fontSize: "12px" }}>
                            <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{a.plateforme} — {a.titre} ↗</a>
                            <span style={{ color: "#10b981", fontWeight: 700, flexShrink: 0 }}>{a.prix} €</span>
                          </div>
                        ))}
                        {prixReel.conseil && (
                          <div style={{ marginTop: "8px", fontSize: "12px", color: "rgba(255,255,255,0.5)", fontStyle: "italic", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>💡 {prixReel.conseil}</div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}

                {/* Prix LeBonCoin réel (Bright Data) — pour comparaison */}
                {(prixLbcLoading || prixLbc || prixLbcErr) && (
                  <div style={{ background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.25)", borderRadius: "16px", padding: "14px", marginBottom: "14px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#ff6b35", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>📍 LeBonCoin (annonces réelles)</div>
                    {prixLbcLoading ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>
                        <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#ff6b35", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Analyse LeBonCoin en cours…
                      </div>
                    ) : prixLbcErr ? (
                      <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>Indisponible. <button onClick={lancerPrixLbc} style={{ background: "none", border: "none", color: "#ff6b35", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", padding: 0, textDecoration: "underline" }}>Réessayer</button></div>
                    ) : prixLbc && prixLbc.fourchette ? (
                      <>
                        <p style={{ fontSize: "20px", fontWeight: 900, color: "white", marginBottom: "4px" }}>{prixLbc.fourchette.min} – {prixLbc.fourchette.max} €</p>
                        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>Médiane {prixLbc.median} € · sur {prixLbc.count} annonces LeBonCoin réelles</div>
                      </>
                    ) : null}
                  </div>
                )}
                {(prixCanadaLoading || prixCanada || prixCanadaErr) && (
                  <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.28)", borderRadius: "16px", padding: "14px", marginBottom: "14px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>📘 Facebook Marketplace — Canada (Vancouver)</div>
                    {prixCanadaLoading ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>
                        <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#8b5cf6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> Recherche marché canadien…
                      </div>
                    ) : prixCanadaErr ? (
                      <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>Indisponible. <button onClick={lancerPrixCanada} style={{ background: "none", border: "none", color: "#8b5cf6", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", padding: 0, textDecoration: "underline" }}>Réessayer</button></div>
                    ) : prixCanada && prixCanada.fourchette ? (
                      <>
                        <p style={{ fontSize: "20px", fontWeight: 900, color: "white", marginBottom: "6px" }}>{prixCanada.fourchette.min} – {prixCanada.fourchette.max} $ CAD</p>
                        {Array.isArray(prixCanada.annonces) && prixCanada.annonces.slice(0, 3).map((a: any, i: number) => (
                          <div key={i} style={{ fontSize: "12px", marginBottom: "3px" }}>
                            <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none" }}>{a.prix} CAD — {a.plateforme || "annonce"} ↗</a>
                          </div>
                        ))}
                        {prixCanada.conseil && <div style={{ marginTop: "6px", fontSize: "12px", color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>💡 {prixCanada.conseil}</div>}
                      </>
                    ) : null}
                  </div>
                )}
                {annResults.map((a, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "14px", marginBottom: "10px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{a.nom}</span>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "white", lineHeight: 1.35, marginTop: "8px" }}>{a.titre}</p>
                    <button onClick={() => copierAnn(a.titre, `rt${i}`)} style={{ width: "100%", padding: "8px", marginTop: "8px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "12px", fontWeight: 600, color: copiedKey === `rt${i}` ? "#f59e0b" : "rgba(255,255,255,0.6)", cursor: "pointer", fontFamily: "inherit" }}>{copiedKey === `rt${i}` ? "✓ Titre copié" : "Copier le titre"}</button>
                    <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", lineHeight: 1.55, whiteSpace: "pre-line", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>{a.desc}</p>
                    <button onClick={() => copierAnn(a.desc, `rd${i}`)} style={{ width: "100%", padding: "8px", marginTop: "8px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", fontSize: "12px", fontWeight: 600, color: copiedKey === `rd${i}` ? "#f59e0b" : "rgba(255,255,255,0.6)", cursor: "pointer", fontFamily: "inherit" }}>{copiedKey === `rd${i}` ? "✓ Description copiée" : "Copier la description"}</button>
                  </div>
                ))}
                {!posteSaved ? (
                  <div style={{ background: "rgba(99,102,241,0.1)", border: "1px solid #6366f1", borderRadius: "14px", padding: "14px", marginBottom: "10px" }}>
                    <p style={{ fontSize: "14px", fontWeight: 800, color: "white", margin: "0 0 4px" }}>📤 Tu l&apos;as mis en ligne ?</p>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", margin: "0 0 10px" }}>Coche là où tu l&apos;as posté (suivi de rotation). Sinon « juste le prix ».</p>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
                      {annResults.map((a: any) => { const on = postePlats.includes(a.plat); const nom: any = { lbc: "LeBonCoin", vinted: "Vinted", rakuten: "Rakuten", facebook: "Facebook" }; return (
                        <button key={a.plat} onClick={() => setPostePlats(prev => prev.includes(a.plat) ? prev.filter(x => x !== a.plat) : [...prev, a.plat])} style={{ padding: "8px 14px", borderRadius: "99px", border: `1.5px solid ${on ? "#6366f1" : "rgba(255,255,255,0.15)"}`, background: on ? "rgba(99,102,241,0.2)" : "transparent", color: on ? "#c7d2fe" : "rgba(255,255,255,0.6)", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{on ? "✓ " : ""}{nom[a.plat] || a.plat}</button>
                      ); })}
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={confirmPoste} disabled={posteBusy || postePlats.length === 0} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "white", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: (posteBusy || postePlats.length === 0) ? 0.5 : 1 }}>{posteBusy ? "..." : "Confirmer la mise en ligne"}</button>
                      <button onClick={() => { setPostePlats([]); setPosteSaved(true); }} style={{ padding: "12px 14px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.7)", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Juste le prix</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: "rgba(99,102,241,0.12)", border: "1px solid #6366f1", borderRadius: "12px", padding: "10px 14px", marginBottom: "10px", fontSize: "12px", color: "#c7d2fe" }}>{postePlats.length ? "✓ Mise en ligne enregistrée (suivi rotation)." : "Ok, noté — pas mis en ligne."}</div>
                )}
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", textAlign: "center", margin: "12px 0" }}>Enregistré sur la fiche ✓</p>
                <button onClick={() => { setAnnResults(null); setAnnPlats([]); setAnnPrecision(""); setPrixReel(null); setPrixErr(false); setPrixLoading(false); setPrixLbc(null); setPrixLbcErr(false); setPrixLbcLoading(false); setPrixCanada(null); setPrixCanadaErr(false); setPrixCanadaLoading(false); }} style={{ width: "100%", padding: "14px", borderRadius: "14px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: "8px" }}>← Générer d'autres</button>
                <button onClick={() => setShowAnnonce(false)} style={{ width: "100%", padding: "14px", borderRadius: "14px", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Fermer</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && images.length > 0 && (
        <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} style={{ position: "fixed", inset: 0, background: "black", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <button onClick={() => setLightbox(false)} style={{ position: "absolute", top: "calc(16px + env(safe-area-inset-top))", right: "16px", width: "44px", height: "44px", borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "none", color: "white", fontSize: "20px", cursor: "pointer", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          <button onClick={() => handleShareImage(images[photoIdx]?.url, `photo-${photoIdx + 1}.jpg`)} style={{ position: "absolute", top: "calc(16px + env(safe-area-inset-top))", left: "16px", width: "44px", height: "44px", borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", cursor: "pointer", zIndex: 2 }}>⬇️</button>
          <img src={medium(images[photoIdx]?.url)} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          {/* Supprimer la photo en plein écran (en plus du bouton de la fiche) */}
          {images.length > 0 && (
            <button onClick={() => setModal({ message: "Supprimer cette photo ?", onConfirm: () => handleDeleteImage(photoIdx) })} style={{ position: "absolute", bottom: `calc(${images.length > 1 ? 92 : 24}px + env(safe-area-inset-bottom))`, right: "20px", width: "56px", height: "56px", borderRadius: "16px", background: "rgba(255,77,90,0.92)", border: "none", cursor: "pointer", fontSize: "24px", color: "white", zIndex: 3, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(0,0,0,0.4)" }}>🗑</button>
          )}
          {/* Bande de miniatures cliquables (plein écran) */}
          {images.length > 1 && (
            <div style={{ position: "absolute", bottom: "calc(16px + env(safe-area-inset-bottom))", left: 0, right: 0, overflowX: "auto", padding: "0 14px", zIndex: 2 }}>
              <div style={{ display: "flex", gap: "8px", width: "max-content", margin: "0 auto" }}>
                {images.map((img: any, i: number) => (
                  <button key={i} onClick={() => setPhotoIdx(i)} style={{ width: "52px", height: "52px", borderRadius: "12px", overflow: "hidden", flexShrink: 0, padding: 0, cursor: "pointer", border: `2px solid ${i === photoIdx ? "#ff4d5a" : "rgba(255,255,255,0.25)"}`, background: "none", opacity: i === photoIdx ? 1 : 0.55, transition: "opacity 0.15s, border-color 0.15s" }}>
                    <img src={thumb(img.url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fenêtre de confirmation / message intégrée (remplace les confirm/alert natifs) */}
      {modal && (
        <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#222845", borderRadius: "22px", width: "100%", maxWidth: "340px", padding: "24px 20px", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
            <p style={{ fontSize: "15px", fontWeight: 700, color: "white", textAlign: "center", marginBottom: "20px", lineHeight: 1.4 }}>{modal.message}</p>
            <div style={{ display: "flex", gap: "10px" }}>
              {modal.onConfirm ? (
                <>
                  <button onClick={() => setModal(null)} style={{ flex: 1, padding: "13px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Annuler</button>
                  <button onClick={() => { const fn = modal.onConfirm; setModal(null); if (fn) fn(); }} style={{ flex: 1, padding: "13px", borderRadius: "14px", border: "none", background: "linear-gradient(135deg, #ff4d5a, #ff6b35)", color: "white", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Confirmer</button>
                </>
              ) : (
                <button onClick={() => setModal(null)} style={{ flex: 1, padding: "13px", borderRadius: "14px", border: "none", background: "linear-gradient(135deg, #ff4d5a, #ff6b35)", color: "white", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>OK</button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}