"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Article, Dossier } from "@/lib/airtable";

export default function DossierPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [dossier, setDossier]   = useState<Dossier | null>(null);
  const [loading, setLoading]   = useState(true);
  const [filtre, setFiltre]     = useState("Tous");
  const [isAdmin, setIsAdmin]   = useState(false);
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
        fetch("/api/dossiers"),
        fetch(`/api/articles?dossierId=${id}`),
      ]);
      const dataD = await resD.json();
      const dataA = await resA.json();
      setDossier((dataD.dossiers || []).find((d: Dossier) => d.id === id) || null);
      setArticles(dataA.articles || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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
        <button onClick={() => router.push("/dossiers")} style={{ background: "none", border: "none", color: "#ff4d5a", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: "12px", display: "flex", alignItems: "center", gap: "4px" }}>‹ Retour</button>
        <h1 style={{ fontSize: "24px", fontWeight: 900, color: "#1a1f3a", marginBottom: "4px" }}>{dossier?.nom || "Dossier"}</h1>
        <p style={{ fontSize: "12px", color: "#8892b0", marginBottom: "16px" }}>{articles.length} article{articles.length > 1 ? "s" : ""}</p>
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
          {filtres.map(f => (
            <button key={f} onClick={() => setFiltre(f)} style={{ padding: "7px 14px", borderRadius: "50px", fontSize: "11px", fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", background: filtre === f ? "#ff4d5a" : "white", color: filtre === f ? "white" : "#8892b0", border: filtre === f ? "none" : "1px solid #e2e5f0", boxShadow: filtre === f ? "0 4px 12px rgba(255,77,90,0.3)" : "0 2px 6px rgba(26,31,58,0.06)" }}>{f}</button>
          ))}
        </div>
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
                    <img src={a.images[0].url} alt={a.nom} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}