"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Article, Dossier } from "@/lib/airtable";
import { thumb, medium } from "@/lib/img";
import { compressImage } from "@/lib/compress";
import { uploadToCloudinary } from "@/lib/cloudinary-direct";
import { appendArticleImage } from "@/lib/firebase";

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

  const fetchData = async (user?: any) => {
    try {
      const currentUser = user || userSession;
      const [resA, resD] = await Promise.all([
        fetch(`/api/articles/${id}`, { cache: "no-store" }),
        fetch("/api/dossiers", { cache: "no-store" }),
      ]);
      const dataA = await resA.json();
      const dataD = await resD.json();
      setArticle(dataA.article);
      setForm(dataA.article);

      // Filtrer les dossiers selon le rôle
      const allDossiers: Dossier[] = dataD.dossiers || [];
      if (currentUser?.role === "Admin") {
        setDossiers(allDossiers);
      } else {
        setDossiers(allDossiers.filter(d => currentUser?.dossierIds?.includes(d.id)));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
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
          const url = await uploadToCloudinary(compressed);
          await appendArticleImage(id, { url, filename: file.name });
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
    await fetchData();
    setPhotoIdx(0);
  };

  const handleMove = async (dossierId: string) => {
    await fetch(`/api/articles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dossierId }),
    });
    setShowMove(false);
    await fetchData();
  };

  const handleDeleteArticle = async () => {
    setSaving(true);
    try {
      await fetch(`/api/articles/${id}`, { method: "DELETE" });
      router.push(article?.dossierId ? `/dossiers/${article.dossierId}` : "/dossiers");
    } catch (e) {
      console.error(e);
      setSaving(false);
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
          <img src={medium(images[photoIdx]?.url)} alt={article.nom} style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }} onClick={() => setLightbox(true)} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", color: "rgba(26,31,58,0.2)" }}>
            <span>📷</span>
            <span style={{ fontSize: "14px" }}>Aucune photo</span>
          </div>
        )}

        <button onClick={() => router.back()} style={{ position: "absolute", top: "18px", left: "14px", width: "36px", height: "36px", borderRadius: "11px", background: "white", border: "none", cursor: "pointer", boxShadow: "0 2px 10px rgba(26,31,58,0.15)", fontSize: "16px", color: "#1a1f3a" }}>‹</button>

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
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.05)", borderRadius: "50px", padding: "3px 10px" }}>{images.length} / 10</span>
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

      {/* Lightbox */}
      {lightbox && images.length > 0 && (
        <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} style={{ position: "fixed", inset: 0, background: "black", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <button onClick={() => setLightbox(false)} style={{ position: "absolute", top: "calc(16px + env(safe-area-inset-top))", right: "16px", width: "44px", height: "44px", borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "none", color: "white", fontSize: "20px", cursor: "pointer", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          <a href={`/api/download?url=${encodeURIComponent(images[photoIdx]?.url)}&filename=photo-${photoIdx + 1}.jpg`} style={{ position: "absolute", top: "calc(16px + env(safe-area-inset-top))", left: "16px", width: "44px", height: "44px", borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", textDecoration: "none", zIndex: 2 }}>⬇️</a>
          <img src={medium(images[photoIdx]?.url)} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          <div style={{ position: "absolute", bottom: "30px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "6px" }}>
            {images.map((_: any, i: number) => (
              <button key={i} onClick={() => setPhotoIdx(i)} style={{ height: "5px", width: i === photoIdx ? "14px" : "5px", borderRadius: "3px", border: "none", cursor: "pointer", background: i === photoIdx ? "#ff4d5a" : "rgba(255,255,255,0.3)", transition: "all 0.2s", padding: 0 }} />
            ))}
          </div>
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