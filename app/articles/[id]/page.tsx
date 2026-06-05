"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Article, Dossier } from "@/lib/airtable";
import Button from "@/components/ui/Button";

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
    } catch (e) {
      console.error(e);
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
      await fetch(`/api/articles/${id}/images`, {
        method: "POST",
        body: formData,
      });
    }
    await fetchData();
  } catch (e) {
    console.error(e);
  } finally {
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }
};
 

  const handleDeleteImage = async (index: number) => {
    if (!confirm("Supprimer cette photo ?")) return;
    try {
      await fetch(`/api/articles/${id}/images`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIndex: index }),
      });
      await fetchData();
      setPhotoIdx(0);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMove = async (dossierId: string) => {
    try {
      await fetch(`/api/articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dossierId }),
      });
      setShowMove(false);
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const nextPhoto = () => {
    if (!article?.images) return;
    setPhotoIdx(i => (i + 1) % article.images!.length);
  };

  const prevPhoto = () => {
    if (!article?.images) return;
    setPhotoIdx(i => (i - 1 + article.images!.length) % article.images!.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) nextPhoto();
      else prevPhoto();
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0f0f13] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/20 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  if (!article) return (
    <div className="min-h-screen bg-[#0f0f13] flex items-center justify-center text-white/40">
      Article introuvable
    </div>
  );

  const images = article.images || [];

  return (
    <div className="min-h-screen bg-[#0f0f13] text-white">

      {/* Galerie photo principale */}
      <div
        className="relative w-full aspect-square bg-white/5"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {images.length > 0 ? (
          <img
            src={images[photoIdx]?.url}
            alt={article.nom}
            className="w-full h-full object-cover cursor-pointer"
            onClick={() => setLightbox(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20 flex-col gap-3">
            <span className="text-6xl">📷</span>
            <span className="text-sm">Aucune photo</span>
          </div>
        )}

        {/* Bouton retour */}
        <button
          onClick={() => router.back()}
          className="absolute top-14 left-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-xl"
        >
          ‹
        </button>

        {/* Supprimer photo */}
        {images.length > 0 && (
          <button
            onClick={() => handleDeleteImage(photoIdx)}
            className="absolute top-14 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-sm"
          >
            🗑
          </button>
        )}

        {/* Flèches navigation */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevPhoto}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-lg"
            >
              ‹
            </button>
            <button
              onClick={nextPhoto}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-lg"
            >
              ›
            </button>
          </>
        )}

        {/* Dots navigation */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_: any, i: number) => (
              <button
                key={i}
                onClick={() => setPhotoIdx(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === photoIdx ? "w-5 bg-white" : "w-1.5 bg-white/40"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="px-5 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-indigo-400 text-xs font-semibold tracking-widest uppercase mb-1">
              {article.ref}
            </div>
            <h1 className="text-2xl font-black">{article.nom}</h1>
          </div>
          <div className="text-emerald-400 text-2xl font-black">
            {article.prix ? `${article.prix}€` : "—"}
          </div>
        </div>

        {/* Badges */}
        <div className="flex gap-2 flex-wrap mb-6">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
            📂 {dossiers.find(d => d.id === article.dossierId)?.nom || "Sans dossier"}
          </span>
          {article.fonctionnel && (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              article.fonctionnel === "Oui"
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/15 text-red-400 border-red-500/20"
            }`}>
              {article.fonctionnel === "Oui" ? "✅ Fonctionnel" : "❌ Non fonctionnel"}
            </span>
          )}
        </div>

        {/* Infos grille */}
        {!editing ? (
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { label: "Type",     val: article.type },
              { label: "Stockage", val: article.stockage },
              { label: "Couleur",  val: article.couleur },
              { label: "Écran",    val: article.ecran },
              { label: "Coque",    val: article.coque },
              { label: "Batterie", val: article.batterie },
              { label: "Défaut",   val: article.defaut },
            ].filter(f => f.val).map(f => (
              <div key={f.label} className="bg-white/5 rounded-2xl p-4">
                <div className="text-white/30 text-xs mb-1">{f.label}</div>
                <div className="text-sm font-semibold">{f.val}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3 mb-6">
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
                <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">
                  {f.label}
                </label>
                <input
                  type={f.type || "text"}
                  value={(form as any)[f.key] || ""}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  className="w-full bg-white/8 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500"
                />
              </div>
            ))}
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider mb-1 block">
                Fonctionnel
              </label>
              <select
                value={form.fonctionnel || "Oui"}
                onChange={e => setForm(prev => ({ ...prev, fonctionnel: e.target.value }))}
                className="w-full bg-white/8 border border-white/10 rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500"
              >
                <option value="Oui">Oui</option>
                <option value="Non">Non</option>
              </select>
            </div>
          </div>
        )}

        {/* Section photos */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-white/60">Photos</span>
            <span className="text-xs text-white/30 bg-white/5 rounded-full px-3 py-1">
              {images.length} / 10
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {images.map((img: any, i: number) => (
              <button
                key={i}
                onClick={() => { setPhotoIdx(i); setLightbox(true); }}
                className={`w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                  i === photoIdx ? "border-indigo-500" : "border-transparent"
                }`}
              >
                <img src={img.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
            {images.length < 10 && (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-16 h-16 rounded-2xl border-2 border-dashed border-white/20 flex-shrink-0 flex flex-col items-center justify-center text-white/30 text-xs gap-1"
              >
                {uploading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-indigo-500 rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="text-xl">📷</span>
                    <span>Photo</span>
                  </>
                )}
              </button>
            )}
          </div>
          {/* Input fichier */}
          <input
  ref={fileRef}
  type="file"
  accept="image/*"
  multiple
  className="hidden"
  onChange={handleUpload}
/>
        </div>

        {/* Boutons */}
        <div className="flex flex-col gap-3">
          {!editing ? (
            <>
              <Button fullWidth onClick={() => setEditing(true)}>
                ✏️ Modifier l'article
              </Button>
              <Button fullWidth variant="secondary" onClick={() => setShowMove(true)}>
                📂 Déplacer vers un dossier
              </Button>
            </>
          ) : (
            <>
              <Button fullWidth onClick={handleSave} loading={saving}>
                💾 Enregistrer
              </Button>
              <Button fullWidth variant="secondary" onClick={() => setEditing(false)}>
                Annuler
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Modal déplacer */}
      {showMove && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center"
          onClick={() => setShowMove(false)}
        >
          <div
            className="bg-[#1a1a24] rounded-t-3xl w-full max-w-md p-6 pb-12"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
            <h2 className="text-xl font-black text-white mb-5 text-center">Déplacer vers…</h2>
            <div className="flex flex-col gap-3">
              {dossiers.map(d => (
                <button
                  key={d.id}
                  onClick={() => handleMove(d.id)}
                  className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                    d.id === article.dossierId
                      ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
                      : "bg-white/5 border-white/8 text-white"
                  }`}
                >
                  <span className="text-2xl">📂</span>
                  <span className="font-semibold">{d.nom}</span>
                  {d.id === article.dossierId && (
                    <span className="ml-auto text-xs">✓ Actuel</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox plein écran */}
      {lightbox && images.length > 0 && (
        <div
          className="fixed inset-0 bg-black z-50 flex items-center justify-center"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-14 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl z-10"
          >
            ✕
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={prevPhoto}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-2xl z-10"
              >
                ‹
              </button>
              <button
                onClick={nextPhoto}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-2xl z-10"
              >
                ›
              </button>
            </>
          )}

          <img
            src={images[photoIdx]?.url}
            alt=""
            className="max-w-full max-h-full object-contain"
          />

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_: any, i: number) => (
              <button
                key={i}
                onClick={() => setPhotoIdx(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === photoIdx ? "w-5 bg-white" : "w-1.5 bg-white/40"
                }`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="h-24" />
    </div>
  );
}