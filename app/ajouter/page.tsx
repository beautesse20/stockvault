"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createArticle, getDossiers } from "@/lib/firebase";
import { useEffect } from "react";

type Dossier = { id: string; nom: string };

export default function AjouterPage() {
  const [type, setType]             = useState<"Téléphone" | "Divers" | null>(null);
  const [dossiers, setDossiers]     = useState<Dossier[]>([]);
  const [saving, setSaving]         = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [images, setImages]         = useState<{ url: string; filename: string }[]>([]);
  const fileRef                     = useRef<HTMLInputElement>(null);
  const router                      = useRouter();

  // Champs communs
  const [ref, setRef]               = useState("");
  const [nom, setNom]               = useState("");
  const [prix, setPrix]             = useState("");
  const [fonctionnel, setFonctionnel] = useState("Oui");
  const [dossierId, setDossierId]   = useState("");

  // Champs téléphone
  const [stockage, setStockage]     = useState("");
  const [couleur, setCouleur]       = useState("");
  const [ecran, setEcran]           = useState("");
  const [coque, setCoque]           = useState("");
  const [batterie, setBatterie]     = useState("");
  const [defaut, setDefaut]         = useState("");

  // Champs divers
  const [description, setDescription] = useState("");

  useEffect(() => {
    const user = getSession();
    if (!user || user.role !== "Admin") { router.push("/dossiers"); return; }
    getDossiers().then(setDossiers);
  }, []);

  const genRef = () => {
    if (!nom) return "";
    const words = nom.trim().toUpperCase().split(" ");
    const code  = words.map(w => w.slice(0, 2)).join("").slice(0, 6);
    return code + "-" + Date.now().toString().slice(-4);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = 10 - images.length;
    const toUpload  = files.slice(0, remaining);
    setUploading(true);
    try {
      for (const file of toUpload) {
        const formData = new FormData();
        formData.append("file", file);
        const res  = await fetch("/api/upload-temp", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) setImages(prev => [...prev, { url: data.url, filename: file.name }]);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!nom) return;
    setSaving(true);
    try {
      const finalRef = ref.trim() || genRef();
      const fields: any = {
        ref:         finalRef,
        nom,
        type:        type || "Divers",
        prix:        prix ? parseFloat(prix) : null,
        fonctionnel,
        dossierId:   dossierId || "",
        images,
        createdFromApp: true,
        syncedToSheet:  false,
      };

      if (type === "Téléphone") {
        fields.stockage = stockage;
        fields.couleur  = couleur;
        fields.ecran    = ecran;
        fields.coque    = coque;
        fields.batterie = batterie;
        fields.defaut   = defaut;
      } else {
        fields.description = description;
        fields.defaut      = defaut;
      }

      await createArticle(fields);
      router.push(dossierId ? `/dossiers/${dossierId}` : "/dossiers");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px",
    padding: "12px 16px", color: "white", fontSize: "14px",
    outline: "none", fontFamily: "inherit",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "10px", color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px", display: "block",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#1a1f3a", display: "flex", flexDirection: "column" }}>

      {/* Zone blanche */}
      <div style={{
        background: "#f7f8fc", borderRadius: "0 0 0 60px",
        paddingTop: "60px", paddingBottom: "32px",
        paddingLeft: "20px", paddingRight: "20px",
        position: "relative", zIndex: 2,
      }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#ff4d5a", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: "12px" }}>‹ Retour</button>
        <h1 style={{ fontSize: "24px", fontWeight: 900, color: "#1a1f3a", marginBottom: "4px" }}>Ajouter un article</h1>
        <p style={{ fontSize: "12px", color: "#8892b0" }}>Choisissez le type d'article</p>

        {/* Choix type */}
        <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
          {(["Téléphone", "Divers"] as const).map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              flex: 1, padding: "14px", borderRadius: "16px", cursor: "pointer",
              fontFamily: "inherit", fontSize: "14px", fontWeight: 700,
              border: type === t ? "none" : "1px solid #e2e5f0",
              background: type === t ? "linear-gradient(135deg, #ff4d5a, #ff6b35)" : "white",
              color: type === t ? "white" : "#8892b0",
              boxShadow: type === t ? "0 6px 16px rgba(255,77,90,0.3)" : "0 2px 6px rgba(26,31,58,0.06)",
            }}>
              {t === "Téléphone" ? "📱 Téléphone" : "📦 Divers"}
            </button>
          ))}
        </div>
      </div>

      {/* Zone bleu nuit */}
      <div style={{
        flex: 1, background: "#1a1f3a", borderRadius: "0 60px 0 0",
        paddingTop: "40px", paddingLeft: "20px", paddingRight: "20px",
        paddingBottom: "100px", position: "relative", zIndex: 1,
        overflowY: "auto",
      }}>
        {!type && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.2)", paddingTop: "60px" }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>👆</div>
            <p>Choisissez un type ci-dessus</p>
          </div>
        )}

        {type && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

            {/* Référence */}
            <div>
              <label style={labelStyle}>Référence (optionnel — auto si vide)</label>
              <input type="text" placeholder="ex: I14P-BL" value={ref} onChange={e => setRef(e.target.value)} style={inputStyle} />
            </div>

            {/* Nom */}
            <div>
              <label style={labelStyle}>Nom *</label>
              <input type="text" placeholder={type === "Téléphone" ? "ex: iPhone 14 Pro" : "ex: Casque Bluetooth"} value={nom} onChange={e => setNom(e.target.value)} style={inputStyle} />
            </div>

            {/* Champs téléphone */}
            {type === "Téléphone" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>Stockage</label>
                    <input type="text" placeholder="ex: 128 Go" value={stockage} onChange={e => setStockage(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Couleur</label>
                    <input type="text" placeholder="ex: Bleu" value={couleur} onChange={e => setCouleur(e.target.value)} style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>État écran</label>
                    <input type="text" placeholder="ex: Nickel" value={ecran} onChange={e => setEcran(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>État coque</label>
                    <input type="text" placeholder="ex: Propre" value={coque} onChange={e => setCoque(e.target.value)} style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>Batterie</label>
                    <input type="text" placeholder="ex: 0.89" value={batterie} onChange={e => setBatterie(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Défaut</label>
                    <input type="text" placeholder="ex: Face ID HS" value={defaut} onChange={e => setDefaut(e.target.value)} style={inputStyle} />
                  </div>
                </div>
              </>
            )}

            {/* Champs divers */}
            {type === "Divers" && (
              <>
                <div>
                  <label style={labelStyle}>Description</label>
                  <input type="text" placeholder="ex: Casque avec chargeur" value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Défaut</label>
                  <input type="text" placeholder="ex: Câble abîmé" value={defaut} onChange={e => setDefaut(e.target.value)} style={inputStyle} />
                </div>
              </>
            )}

            {/* Fonctionnel */}
            <div>
              <label style={labelStyle}>Fonctionnel</label>
              <select value={fonctionnel} onChange={e => setFonctionnel(e.target.value)} style={inputStyle}>
                <option value="Oui">Oui</option>
                <option value="Non">Non</option>
              </select>
            </div>

            {/* Prix */}
            <div>
              <label style={labelStyle}>Prix (€)</label>
              <input type="number" placeholder="ex: 150" value={prix} onChange={e => setPrix(e.target.value)} style={inputStyle} />
            </div>

            {/* Dossier */}
            <div>
              <label style={labelStyle}>Dossier</label>
              <select value={dossierId} onChange={e => setDossierId(e.target.value)} style={inputStyle}>
                <option value="">Sans dossier</option>
                {dossiers.map(d => (
                  <option key={d.id} value={d.id}>{d.nom}</option>
                ))}
              </select>
            </div>

            {/* Photos */}
            <div>
              <label style={labelStyle}>Photos ({images.length}/10)</label>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {images.map((img, i) => (
                  <div key={i} style={{ position: "relative", width: "72px", height: "72px" }}>
                    <img src={img.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "14px" }} />
                    <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))} style={{ position: "absolute", top: "4px", right: "4px", width: "22px", height: "22px", borderRadius: "50%", background: "rgba(255,77,90,0.9)", border: "none", color: "white", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                  </div>
                ))}
                {images.length < 10 && (
                  <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ width: "72px", height: "72px", borderRadius: "14px", border: "2px dashed rgba(255,255,255,0.2)", background: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: "10px", gap: "4px" }}>
                    {uploading ? <div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#ff4d5a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /> : <><span style={{ fontSize: "22px" }}>📷</span><span>Photo</span></>}
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleUpload} />
            </div>

            {/* Bouton sauvegarder */}
            <button onClick={handleSave} disabled={!nom || saving} style={{
              width: "100%", padding: "16px", borderRadius: "16px",
              background: "linear-gradient(135deg, #ff4d5a, #ff6b35)",
              border: "none", color: "white", fontSize: "15px", fontWeight: 700,
              cursor: !nom ? "default" : "pointer", fontFamily: "inherit",
              opacity: !nom ? 0.5 : 1,
              boxShadow: "0 8px 20px rgba(255,77,90,0.35)",
            }}>
              {saving ? "Enregistrement..." : "✅ Enregistrer l'article"}
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}