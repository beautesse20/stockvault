"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";
import { compressImage } from "@/lib/compress";
import { uploadToCloudinary } from "@/lib/cloudinary-direct";
import { appendArticleImage } from "@/lib/firebase";
import { thumb } from "@/lib/img";

type Img = { url: string; filename: string };
type Article = {
  id: string;
  ref?: string;
  nom?: string;
  type?: string;
  dossierId?: string;
  images?: Img[];
  createdAt?: string;
};

const CONCURRENCY = 3;
const MAX_PER_ARTICLE = 10;

export default function PhotosMassePage() {
  const [allArticles, setAllArticles] = useState<Article[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState<"none" | "all">("none");

  // Images et statut par article (état local, mis à jour en direct)
  const [imagesByArticle, setImagesByArticle] = useState<Record<string, Img[]>>({});
  const [busyByArticle, setBusyByArticle]     = useState<Record<string, number>>({});
  const [failedByArticle, setFailedByArticle] = useState<Record<string, number>>({});

  // Progression globale
  const [total, setTotal]   = useState(0);
  const [done, setDone]     = useState(0);
  const [failed, setFailed] = useState(0);

  // Ensemble des articles "sans photos" au chargement (figé pour stabilité d'affichage)
  const emptySetRef = useRef<Set<string>>(new Set());

  // File d'attente
  const queueRef  = useRef<{ articleId: string; file: File }[]>([]);
  const activeRef = useRef(0);

  const fileRef        = useRef<HTMLInputElement>(null);
  const targetArticle  = useRef<string | null>(null);
  const router         = useRouter();

  useEffect(() => {
    const user = getSession();
    if (!user) { router.push("/"); return; }
    if (user.role !== "Admin") { router.push("/dossiers"); return; }
    load();
  }, []);

  const load = async () => {
    try {
      const res  = await fetch("/api/articles", { cache: "no-store" });
      const data = await res.json();
      const arts: Article[] = (data.articles || []).sort((a: Article, b: Article) => {
        if (!a.createdAt && !b.createdAt) return 0;
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt.localeCompare(a.createdAt);
      });
      setAllArticles(arts);

      const imgMap: Record<string, Img[]> = {};
      const empty = new Set<string>();
      arts.forEach(a => {
        imgMap[a.id] = a.images || [];
        if (!a.images || a.images.length === 0) empty.add(a.id);
      });
      setImagesByArticle(imgMap);
      emptySetRef.current = empty;
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── FILE D'ATTENTE ──
  const pump = () => {
    while (activeRef.current < CONCURRENCY && queueRef.current.length > 0) {
      const item = queueRef.current.shift()!;
      activeRef.current++;
      processItem(item).finally(() => {
        activeRef.current--;
        pump();
      });
    }
  };

  const processItem = async (item: { articleId: string; file: File }) => {
    try {
      const compressed = await compressImage(item.file);
      const url        = await uploadToCloudinary(compressed);
      const image      = { url, filename: item.file.name };
      await appendArticleImage(item.articleId, image);

      setImagesByArticle(prev => ({
        ...prev,
        [item.articleId]: [...(prev[item.articleId] || []), image],
      }));
      setDone(d => d + 1);
    } catch (e) {
      console.error("Échec upload:", e);
      setFailed(f => f + 1);
      setFailedByArticle(prev => ({
        ...prev,
        [item.articleId]: (prev[item.articleId] || 0) + 1,
      }));
    } finally {
      setBusyByArticle(prev => {
        const n = (prev[item.articleId] || 0) - 1;
        const copy = { ...prev };
        if (n <= 0) delete copy[item.articleId]; else copy[item.articleId] = n;
        return copy;
      });
    }
  };

  const onPickPhotos = (articleId: string) => {
    targetArticle.current = articleId;
    fileRef.current?.click();
  };

  const onFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const articleId = targetArticle.current;
    const files = Array.from(e.target.files || []);
    if (fileRef.current) fileRef.current.value = "";
    if (!articleId || !files.length) return;

    // Respecter le max par article (photos déjà présentes + en cours)
    const already   = (imagesByArticle[articleId] || []).length + (busyByArticle[articleId] || 0);
    const remaining = Math.max(0, MAX_PER_ARTICLE - already);
    const toAdd     = files.slice(0, remaining);
    if (!toAdd.length) return;

    setBusyByArticle(prev => ({ ...prev, [articleId]: (prev[articleId] || 0) + toAdd.length }));
    setTotal(t => t + toAdd.length);
    toAdd.forEach(file => queueRef.current.push({ articleId, file }));
    pump();
  };

  const retryArticle = (articleId: string) => {
    // On ne peut pas relancer les fichiers (non conservés) — on prévient l'utilisateur
    setFailedByArticle(prev => { const c = { ...prev }; delete c[articleId]; return c; });
  };

  const visibleArticles = allArticles.filter(a =>
    filter === "all" ? true : emptySetRef.current.has(a.id)
  );

  const pct = total > 0 ? Math.round(((done + failed) / total) * 100) : 0;
  const inFlight = total - done - failed;

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#1a1f3a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "32px", height: "32px", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#ff4d5a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#1a1f3a", display: "flex", flexDirection: "column" }}>

      {/* Zone blanche */}
      <div style={{ background: "#f7f8fc", borderRadius: "0 0 0 60px", paddingTop: "60px", paddingBottom: "28px", paddingLeft: "20px", paddingRight: "20px", position: "relative", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
          <button onClick={() => router.push("/dossiers")} style={{ width: "40px", height: "40px", borderRadius: "13px", background: "white", border: "none", cursor: "pointer", boxShadow: "0 3px 10px rgba(26,31,58,0.1)", fontSize: "18px", color: "#1a1f3a" }}>‹</button>
          <div>
            <p style={{ fontSize: "12px", color: "#8892b0", marginBottom: "3px" }}>Ajout rapide</p>
            <h1 style={{ fontSize: "22px", fontWeight: 900, color: "#1a1f3a" }}>Photos en masse</h1>
          </div>
        </div>

        {/* Filtre */}
        <div style={{ display: "flex", gap: "8px", marginBottom: total > 0 ? "16px" : "0" }}>
          {([["none", "Sans photos"], ["all", "Tous"]] as const).map(([val, lbl]) => (
            <button key={val} onClick={() => setFilter(val)} style={{ flex: 1, padding: "10px", borderRadius: "12px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "inherit", background: filter === val ? "#1a1f3a" : "white", color: filter === val ? "white" : "#8892b0", boxShadow: "0 2px 8px rgba(26,31,58,0.06)" }}>
              {lbl}
            </button>
          ))}
        </div>

        {/* Progression globale */}
        {total > 0 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#8892b0", marginBottom: "6px" }}>
              <span>{done} / {total} photos envoyées{inFlight > 0 ? ` · ${inFlight} en cours` : ""}</span>
              <span>{pct}%</span>
            </div>
            <div style={{ height: "6px", background: "rgba(26,31,58,0.08)", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #10b981, #059669)", borderRadius: "3px", transition: "width 0.3s" }} />
            </div>
            {failed > 0 && (
              <p style={{ fontSize: "11px", color: "#ff4d5a", marginTop: "6px" }}>{failed} échec{failed > 1 ? "s" : ""} — ré-essaie sur les articles marqués.</p>
            )}
          </div>
        )}
      </div>

      {/* Zone bleu nuit — liste */}
      <div style={{ flex: 1, background: "#1a1f3a", borderRadius: "0 60px 0 0", paddingTop: "30px", paddingLeft: "20px", paddingRight: "20px", paddingBottom: "100px", position: "relative", zIndex: 1 }}>
        <p style={{ fontSize: "12px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "14px" }}>
          {visibleArticles.length} article{visibleArticles.length > 1 ? "s" : ""}
        </p>

        {visibleArticles.length === 0 && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", paddingTop: "50px" }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>📷</div>
            <p>{filter === "none" ? "Tous les articles ont déjà des photos !" : "Aucun article"}</p>
          </div>
        )}

        {visibleArticles.map(a => {
          const imgs   = imagesByArticle[a.id] || [];
          const busy   = busyByArticle[a.id] || 0;
          const fail   = failedByArticle[a.id] || 0;
          const full   = imgs.length >= MAX_PER_ARTICLE;
          return (
            <div key={a.id} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "14px 16px", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: imgs.length || busy ? "12px" : "0" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "#ff4d5a", marginBottom: "2px" }}>{a.ref || "—"}</p>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nom || "Sans nom"}</p>
                </div>

                {/* Statut */}
                {busy > 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#ff8c42", fontSize: "12px", fontWeight: 700 }}>
                    <div style={{ width: "14px", height: "14px", border: "2px solid rgba(255,140,66,0.3)", borderTopColor: "#ff8c42", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    {imgs.length}/{imgs.length + busy}
                  </div>
                ) : imgs.length > 0 ? (
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#10b981" }}>✓ {imgs.length}</span>
                ) : null}
              </div>

              {/* Vignettes */}
              {(imgs.length > 0 || busy > 0) && (
                <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px", marginBottom: "12px" }}>
                  {imgs.map((img, i) => (
                    <div key={i} style={{ width: "52px", height: "52px", borderRadius: "12px", overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.05)" }}>
                      <img src={thumb(img.url)} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  ))}
                  {Array.from({ length: busy }).map((_, i) => (
                    <div key={`b${i}`} style={{ width: "52px", height: "52px", borderRadius: "12px", flexShrink: 0, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "#ff8c42", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Bouton ajouter */}
              {full ? (
                <div style={{ textAlign: "center", fontSize: "12px", color: "rgba(255,255,255,0.3)", padding: "8px" }}>Maximum atteint (10)</div>
              ) : (
                <button onClick={() => onPickPhotos(a.id)} style={{ width: "100%", padding: "12px", borderRadius: "14px", border: "1.5px dashed rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.6)", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <span style={{ fontSize: "18px" }}>📷</span> Ajouter des photos
                </button>
              )}

              {fail > 0 && (
                <button onClick={() => retryArticle(a.id)} style={{ width: "100%", marginTop: "8px", padding: "8px", borderRadius: "12px", border: "1px solid rgba(255,77,90,0.3)", background: "rgba(255,77,90,0.1)", color: "#ff4d5a", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  ⚠️ {fail} échec{fail > 1 ? "s" : ""} — toucher pour ré-sélectionner
                </button>
              )}
            </div>
          );
        })}
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={onFilesSelected} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
