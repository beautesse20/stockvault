"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Article, Dossier } from "@/lib/airtable";

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
  const fileRef                   = useRef<HTMLInputElement>(null);
  const touchStartX               = useRef(0);
  const router                    = useRouter();
  const params                    = useParams();
  const id                        = params.id as string;

  useEffect(() => {
    const user = getSession();
    if (!user) { router.push("/"); return; }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [resA, resD] = await Promise.all([
        fetch(`/api/articles/${id}`),
        fetch("/api/dossiers"),
      ]);
      const dataA = await resA.json();
      const dataD = await resD.json();
      setArticle(dataA.article);
      setForm(dataA.article);
      setDossiers(dataD.dossiers || []);
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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = 10 - (article?.images?.length || 0);
    const toUpload  = files.slice(0, remaining);
    setUploading(true);
    try {
      for (const file of toUpload) {
        const formData = new FormData();
        formData.append("file", file);
        await fetch(`/api/articles/${id}/images`, { method: "POST", body: formData });
      }
      await fetchData();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDeleteImage = async (index: number) => {
    if (!confirm("Supprimer cette photo ?")) return;
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

  return (
    <div style={{ minHeight: "100vh", background: "#1a1f3a", display: "flex", flexDirection: "column" }}>

      {/* Zone image blanche */}
      <div
        style={{
          background: "#f0f2fc",
          borderRadius: "0 0 0 80px",
          height: "260px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "80px", position: "relative", flexShrink: 0, zIndex: 2,
          overflow: "hidden",
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {images.length > 0 ? (
          <img src={images[photoIdx]?.url} alt={article.nom}
            style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
            onClick={() => setLightbox(true)}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", color: "rgba(26,31,58,0.2)" }}>
            <span>📷</span>
            <span style={{ fontSize: "14px" }}>Aucune photo</span>
          </div>
        )}

        {/* Bouton retour */}
        <button onClick={() => router.back()} style={{
          position: "absolute", top: "18px", left: "14px",
          width: "36px", height: "36px", borderRadius: "11px",
          background: "white", border: "none", cursor: "pointer",
          boxShadow: "0 2px 10px rgba(26,31,58,0.15)",
          fontSize: "16px", color: "#1a1f3a",
        }}>‹</button>

        {/* Compteur photos */}
        {images.length > 0 && (
          <div style={{
            position: "absolute", top: "18px", right: "14px",
            background: "white", borderRadius: "10px", padding: "5px 10px",
            fontSize: "10px", fontWeight: 700, color: "#1a1f3a",
            boxShadow: "0 2px 10px rgba(26,31,58,0.12)",
          }}>{images.length} / 10 📷</div>
        )}

        {/* Supprimer photo */}
        {images.length > 0 && (
          <button onClick={() => handleDeleteImage(photoIdx)} style={{
            position: "absolute", bottom: "18px", right: "14px",
            width: "32px", height: "32px", borderRadius: "10px",
            background: "rgba(255,77,90,0.9)", border: "none", cursor: "pointer",
            fontSize: "14px", color: "white",
          }}>🗑</button>
        )}

        {/* Dots */}
        {images.length > 1 && (
          <div style={{ position: "absolute", bottom: "14px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "5px" }}>
            {images.map((_: any, i: number) => (
              <button key={i} onClick={() => setPhotoIdx(i)} style={{
                height: "5px", width: i === photoIdx ? "14px" : "5px",
                borderRadius: "3px", border: "none", cursor: "pointer",
                background: i === photoIdx ? "#ff4d5a" : "rgba(26,31,58,0.2)",
                transition: "all 0.2s", padding: 0,
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Zone bleu nuit */}
      <div style={{
        flex: 1,
        background: "#1a1f3a",
        borderRadius: "0 80px 0 0",
        marginTop: "-40px",
        paddingTop: "50px",
        paddingLeft: "18px",
        paddingRight: "18px",
        paddingBottom: "100px",
        position: "relative",
        zIndex: 1,
      }}>
        {/* Header article */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
          <div>
            <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "#ff4d5a", marginBottom: "4px" }}>{article.ref}</p>
            <h1 style={{ fontSize: "22px", fontWeight: 900, color: "white" }}>{article.nom}</h1>
          </div>
          <p style={{ fontSize: "24px", fontWeight: 900, color: "#ff4d5a" }}>{article.prix ? `${article.prix}€` : "—"}</p>
        </div>

        {/* Badges */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
          <span style={{ padding: "5px 12px", borderRadius: "50px", fontSize: "10px", fontWeight: 700, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
            📂 {dossiers.find(d => d.id === article.dossierId)?.nom || "Sans dossier"}
          </span>
          {article.fonctionnel && (
            <span style={{
              padding: "5px 12px", borderRadius: "50px", fontSize: "10px", fontWeight: 700,
              background: article.fonctionnel === "Oui" ? "rgba(16,185,129,0.12)" : "rgba(255,77,90,0.12)",
              color: article.fonctionnel === "Oui" ? "#10b981" : "#ff4d5a",
              border: `1px solid ${article.fonctionnel === "Oui" ? "rgba(16,185,129,0.2)" : "rgba(255,77,90,0.2)"}`,
            }}>
              {article.fonctionnel === "Oui" ? "✅ Fonctionnel" : "❌ Non fonctionnel"}
            </span>
          )}
        </div>

        {/* Infos ou formulaire */}
        {!editing ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" }}>
            {[
              { label: "Stockage", val: article.stockage },
              { label: "Couleur",  val: article.couleur },
              { label: "Écran",    val: article.ecran },
              { label: "Coque",    val: article.coque },
              { label: "Batterie", val: article.batterie },
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
                <input
                  type={f.type || "text"}
                  value={(form as any)[f.key] || ""}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px",
                    padding: "12px 16px", color: "white", fontSize: "14px",
                    outline: "none", fontFamily: "inherit",
                  }}
                />
              </div>
            ))}
            <div>
              <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>Fonctionnel</p>
              <select
                value={form.fonctionnel || "Oui"}
                onChange={e => setForm(prev => ({ ...prev, fonctionnel: e.target.value }))}
                style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px", padding: "12px 16px", color: "white", fontSize: "14px", outline: "none", fontFamily: "inherit" }}
              >
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
              <button key={i} onClick={() => { setPhotoIdx(i); setLightbox(true); }} style={{
                width: "64px", height: "64px", borderRadius: "16px", overflow: "hidden",
                border: `2px solid ${i === photoIdx ? "#ff4d5a" : "transparent"}`,
                flexShrink: 0, cursor: "pointer", padding: 0, background: "none",
              }}>
                <img src={img.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </button>
            ))}
            {images.length < 10 && (
              <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{
                width: "64px", height: "64px", borderRadius: "16px",
                border: "2px dashed rgba(255,255,255,0.2)", flexShrink: 0,
                background: "none", cursor: "pointer", display: "flex",
                flexDirection: "column", alignItems: "center", justifyContent: "center",
                color: "rgba(255,255,255,0.3)", fontSize: "10px", gap: "3px",
              }}>
                {uploading ? (
                  <div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#ff4d5a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                ) : <><span style={{ fontSize: "20px" }}>📷</span><span>Photo</span></>}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
        </div>

        {/* Boutons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {!editing ? (
            <>
              <button onClick={() => setEditing(true)} style={{
                width: "100%", padding: "16px", borderRadius: "16px",
                background: "linear-gradient(135deg, #ff4d5a, #ff6b35)",
                border: "none", color: "white", fontSize: "15px", fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 8px 20px rgba(255,77,90,0.35)",
              }}>✏️ Modifier l'article</button>
              <button onClick={() => setShowMove(true)} style={{
                width: "100%", padding: "16px", borderRadius: "16px",
                background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
                color: "white", fontSize: "15px", fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}>📂 Déplacer vers un dossier</button>
            </>
          ) : (
            <>
              <button onClick={handleSave} disabled={saving} style={{
                width: "100%", padding: "16px", borderRadius: "16px",
                background: "linear-gradient(135deg, #ff4d5a, #ff6b35)",
                border: "none", color: "white", fontSize: "15px", fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 8px 20px rgba(255,77,90,0.35)",
                opacity: saving ? 0.6 : 1,
              }}>{saving ? "Enregistrement..." : "💾 Enregistrer"}</button>
              <button onClick={() => setEditing(false)} style={{
                width: "100%", padding: "16px", borderRadius: "16px",
                background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
                color: "white", fontSize: "15px", fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit",
              }}>Annuler</button>
            </>
          )}
        </div>
      </div>

      {/* Modal déplacer */}
      {showMove && (
        <div onClick={() => setShowMove(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(4px)", zIndex: 50, display: "flex",
          alignItems: "flex-end", justifyContent: "center",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#1a1f3a", borderRadius: "28px 28px 0 0",
            width: "100%", maxWidth: "480px", padding: "24px 20px 48px",
          }}>
            <div style={{ width: "40px", height: "4px", background: "rgba(255,255,255,0.2)", borderRadius: "2px", margin: "0 auto 20px" }} />
            <h2 style={{ fontSize: "20px", fontWeight: 900, color: "white", marginBottom: "16px", textAlign: "center" }}>Déplacer vers…</h2>
            {dossiers.map(d => (
              <button key={d.id} onClick={() => handleMove(d.id)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: "14px",
                padding: "14px 16px", borderRadius: "16px", marginBottom: "8px",
                background: d.id === article.dossierId ? "rgba(255,77,90,0.12)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${d.id === article.dossierId ? "rgba(255,77,90,0.3)" : "rgba(255,255,255,0.07)"}`,
                color: d.id === article.dossierId ? "#ff4d5a" : "white",
                cursor: "pointer", fontFamily: "inherit", fontSize: "14px", fontWeight: 600,
              }}>
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
  <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} style={{
    position: "fixed", inset: 0, background: "black", zIndex: 100,
    display: "flex", alignItems: "center", justifyContent: "center",
  }}>
    {/* Fermer */}
    <button onClick={() => setLightbox(false)} style={{
      position: "absolute", top: "20px", right: "16px",
      width: "36px", height: "36px", borderRadius: "50%",
      background: "rgba(255,255,255,0.1)", border: "none",
      color: "white", fontSize: "18px", cursor: "pointer",
    }}>✕</button>

    {/* Télécharger */}
    
      href={images[photoIdx]?.url}
      download
      target="_blank"
      rel="noopener noreferrer"
      style={{
        position: "absolute", top: "20px", left: "16px",
        width: "36px", height: "36px", borderRadius: "50%",
        background: "rgba(255,255,255,0.1)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "18px", textDecoration: "none",
      }}
    >⬇️</a>

    {/* Image */}
    <img src={images[photoIdx]?.url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />

    {/* Dots */}
    <div style={{ position: "absolute", bottom: "30px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "6px" }}>
      {images.map((_: any, i: number) => (
        <button key={i} onClick={() => setPhotoIdx(i)} style={{
          height: "5px", width: i === photoIdx ? "14px" : "5px",
          borderRadius: "3px", border: "none", cursor: "pointer",
          background: i === photoIdx ? "#ff4d5a" : "rgba(255,255,255,0.3)",
          transition: "all 0.2s", padding: 0,
        }} />
      ))}
    </div>
  </div>
)}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } input[type="file"].hidden { display: none; }`}</style>
    </div>
  );
}