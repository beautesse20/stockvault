"use client";

// Page PUBLIQUE (sans login) — destinée à être partagée à un client potentiel.
// Affiche la fiche produit, le prix neuf vérifié (Amazon/Fnac/Darty) et un
// bouton de contact selon le lieu (WhatsApp Paris / Facebook Vancouver).

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { medium, thumb } from "@/lib/img";

const WHATSAPP = "33626979173";
const FACEBOOK = "https://www.facebook.com/share/1BFdUNaYg5/?mibextid=wwXIfr";

export default function PartagePage() {
  const params = useParams();
  const id = params.id as string;
  const [article, setArticle] = useState<any | null>(null);
  const [lieu, setLieu]       = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [neuf, setNeuf]       = useState<{ prix: number | null; source?: any } | null>(null);
  const [neufLoading, setNeufLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rA, rD] = await Promise.all([
          fetch(`/api/articles/${id}`, { cache: "no-store" }),
          fetch(`/api/dossiers`, { cache: "no-store" }),
        ]);
        const dA = await rA.json();
        const dD = await rD.json();
        const art = dA.article;
        setArticle(art);
        const dossier = (dD.dossiers || []).find((d: any) => d.id === art?.dossierId);
        const n = (dossier?.nom || "").toLowerCase();
        setLieu(n.includes("paris") ? "Paris" : n.includes("vancouver") ? "Vancouver" : null);

        // Prix neuf : on affiche UNIQUEMENT le cache (la recherche ne se lance que
        // côté vendeur, au clic Partager — jamais à l'ouverture de cette page).
        if (art?.prixNeuf && art.prixNeuf.prix) setNeuf(art.prixNeuf);
        setNeufLoading(false);
      } catch { /* noop */ }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f1ea" }}>
      <div style={{ width: "30px", height: "30px", border: "3px solid rgba(0,0,0,0.1)", borderTopColor: "#1a1f3a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!article || article.vendu) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f4f1ea", color: "#666", padding: "24px", textAlign: "center" }}>
      <div style={{ fontSize: "40px", marginBottom: "12px" }}>📦</div>
      <p style={{ fontSize: "15px" }}>Cet article n'est plus disponible.</p>
    </div>
  );

  const images = article.images || [];
  const specs = (article.type === "Téléphone"
    ? [["Stockage", article.stockage], ["Couleur", article.couleur], ["Écran", article.ecran], ["Coque", article.coque], ["Batterie", article.batterie], ["Fonctionnel", article.fonctionnel]]
    : [["Fonctionnel", article.fonctionnel], ["Description", article.description]]
  ).filter(([, v]) => v);

  const contactUrl = lieu === "Vancouver"
    ? FACEBOOK
    : `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Bonjour, je suis intéressé par : ${article.nom} (réf ${article.ref})`)}`;
  const contactLabel = lieu === "Vancouver" ? "Contacter sur Facebook" : "Contacter sur WhatsApp";

  return (
    <div style={{ minHeight: "100vh", background: "#f4f1ea", color: "#1a1f2e", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "460px", margin: "0 auto", background: "white", minHeight: "100vh" }}>

        <div style={{ padding: "14px 18px", borderBottom: "1px solid #eee", fontWeight: 700, fontSize: "14px", letterSpacing: "0.06em" }}>B&amp;M ELECTRONIC</div>

        {/* Photo principale */}
        <div style={{ aspectRatio: "1/1", background: "#f0f2fc", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {images.length > 0
            ? <img src={medium(images[photoIdx]?.url)} alt={article.nom} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            : <span style={{ fontSize: "60px", color: "#ccd" }}>📷</span>}
        </div>
        {images.length > 1 && (
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", padding: "10px 16px" }}>
            {images.map((img: any, i: number) => (
              <button key={i} onClick={() => setPhotoIdx(i)} style={{ width: "58px", height: "58px", borderRadius: "12px", overflow: "hidden", border: `2px solid ${i === photoIdx ? "#1a1f3a" : "transparent"}`, flexShrink: 0, padding: 0, background: "none", cursor: "pointer" }}>
                <img src={thumb(img.url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </button>
            ))}
          </div>
        )}

        <div style={{ padding: "18px" }}>
          <div style={{ fontSize: "20px", fontWeight: 700 }}>{article.nom}</div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", margin: "12px 0 16px" }}>
            {specs.slice(0, 4).map(([k, v]) => (
              <span key={k} style={{ fontSize: "12px", background: "#f1efe8", color: "#555", padding: "4px 10px", borderRadius: "20px" }}>{k} : {v}</span>
            ))}
          </div>

          {/* Prix */}
          <div style={{ background: "#f7f6f2", borderRadius: "14px", padding: "14px 16px", marginBottom: "16px" }}>
            {neuf && neuf.prix ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", color: "#888" }}>Neuf{neuf.source?.nom ? ` · ${neuf.source.nom}` : ""}</span>
                <span style={{ fontSize: "16px", color: "#999", textDecoration: "line-through" }}>{neuf.prix} €</span>
              </div>
            ) : null}
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#1a1f3a" }}>{neuf && neuf.prix ? "Reconditionné — prix sur demande" : "Prix sur demande"}</div>
            {neuf && neuf.prix && neuf.source?.url && (
              <a href={neuf.source.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "#999", textDecoration: "none" }}>Prix neuf vérifié ↗</a>
            )}
          </div>

          <a href={contactUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", background: "#1a1f3a", color: "white", borderRadius: "14px", padding: "15px", fontSize: "15px", fontWeight: 700, textDecoration: "none" }}>
            {contactLabel}
          </a>
          <p style={{ fontSize: "12px", color: "#aaa", textAlign: "center", marginTop: "10px" }}>B&amp;M Electronic — tech reconditionnée, Paris &amp; Vancouver</p>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
