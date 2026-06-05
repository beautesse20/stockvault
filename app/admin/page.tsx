"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Utilisateur, Dossier } from "@/lib/airtable";

export default function AdminPage() {
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [dossiers, setDossiers]         = useState<Dossier[]>([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState<"users" | "dossiers">("users");
  const [editingUser, setEditingUser]   = useState<Utilisateur | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [formNom, setFormNom]           = useState("");
  const [formPin, setFormPin]           = useState("");
  const [formRole, setFormRole]         = useState<"Admin" | "Standard">("Standard");
  const [formDossiers, setFormDossiers] = useState<string[]>([]);
  const [savingUser, setSavingUser]     = useState(false);
  const [newDossierNom, setNewDossierNom] = useState("");
  const [savingDossier, setSavingDossier] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const user = getSession();
    if (!user || user.role !== "Admin") { router.push("/dossiers"); return; }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [resU, resD] = await Promise.all([fetch("/api/utilisateurs"), fetch("/api/dossiers")]);
      const dataU = await resU.json();
      const dataD = await resD.json();
      setUtilisateurs(dataU.utilisateurs || []);
      setDossiers(dataD.dossiers || []);
    } finally {
      setLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingUser(null);
    setFormNom(""); setFormPin(""); setFormRole("Standard"); setFormDossiers([]);
    setShowForm(true);
  };

  const openEditForm = (u: Utilisateur) => {
    setEditingUser(u);
    setFormNom(u.nom); setFormPin(u.pin); setFormRole(u.role);
    setFormDossiers(u.dossierIds || []);
    setShowForm(true);
  };

  const handleSaveUser = async () => {
    if (!formNom || formPin.length !== 4) return;
    setSavingUser(true);
    try {
      if (editingUser) {
        await fetch(`/api/utilisateurs/${editingUser.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nom: formNom, pin: formPin, role: formRole, dossierIds: formDossiers }),
        });
      } else {
        await fetch("/api/utilisateurs", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nom: formNom, pin: formPin, role: formRole, dossierIds: formDossiers }),
        });
      }
      setShowForm(false);
      await fetchData();
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser    = async (id: string) => { if (!confirm("Supprimer ?")) return; await fetch(`/api/utilisateurs/${id}`, { method: "DELETE" }); await fetchData(); };
  const handleDeleteDossier = async (id: string) => { if (!confirm("Supprimer ?")) return; await fetch(`/api/dossiers/${id}`, { method: "DELETE" }); await fetchData(); };
  const toggleDossier = (id: string) => setFormDossiers(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);

  const handleCreateDossier = async () => {
    if (!newDossierNom) return;
    setSavingDossier(true);
    try {
      await fetch("/api/dossiers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nom: newDossierNom }) });
      setNewDossierNom(""); await fetchData();
    } finally { setSavingDossier(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px",
    padding: "12px 16px", color: "white", fontSize: "14px",
    outline: "none", fontFamily: "inherit",
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
        background: "#f7f8fc", borderRadius: "0 0 0 100px",
        paddingTop: "60px", paddingBottom: "32px",
        paddingLeft: "20px", paddingRight: "20px",
        position: "relative", zIndex: 2,
      }}>
        <button onClick={() => router.push("/dossiers")} style={{
          background: "none", border: "none", color: "#ff4d5a",
          fontSize: "14px", fontWeight: 600, cursor: "pointer",
          fontFamily: "inherit", marginBottom: "12px",
        }}>‹ Retour</button>
        <h1 style={{ fontSize: "24px", fontWeight: 900, color: "#1a1f3a", marginBottom: "4px" }}>Paramètres</h1>
        <p style={{ fontSize: "12px", color: "#8892b0", marginBottom: "16px" }}>Gestion des accès et dossiers</p>
        <div style={{ display: "flex", gap: "8px" }}>
          {(["users", "dossiers"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "8px 18px", borderRadius: "50px", fontSize: "12px",
              fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              background: tab === t ? "#ff4d5a" : "white",
              color: tab === t ? "white" : "#8892b0",
              border: tab === t ? "none" : "1px solid #e2e5f0",
              boxShadow: tab === t ? "0 4px 12px rgba(255,77,90,0.3)" : "0 2px 6px rgba(26,31,58,0.06)",
            }}>
              {t === "users" ? "👤 Utilisateurs" : "📂 Dossiers"}
            </button>
          ))}
        </div>
      </div>

      {/* Zone bleu nuit */}
      <div style={{
        flex: 1, background: "#1a1f3a", borderRadius: "0 100px 0 0",
        paddingTop: "40px", paddingLeft: "20px", paddingRight: "20px",
        paddingBottom: "100px", position: "relative", zIndex: 1,
      }}>

        {/* TAB UTILISATEURS */}
        {tab === "users" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {utilisateurs.map(u => (
              <div key={u.id} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "44px", height: "44px", borderRadius: "14px", background: "rgba(255,77,90,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 800, color: "#ff4d5a", flexShrink: 0 }}>
                    {u.nom.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "white", marginBottom: "2px" }}>{u.nom}</p>
                    <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>PIN : {"•".repeat(u.pin.length)} · {u.role}</p>
                    {u.dossierIds && u.dossierIds.length > 0 && (
                      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "2px" }}>
                        📂 {u.dossierIds.map(did => dossiers.find(d => d.id === did)?.nom).filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={() => openEditForm(u)} style={{ width: "34px", height: "34px", borderRadius: "11px", background: "rgba(255,255,255,0.07)", border: "none", cursor: "pointer", fontSize: "14px" }}>✏️</button>
                    <button onClick={() => handleDeleteUser(u.id)} style={{ width: "34px", height: "34px", borderRadius: "11px", background: "rgba(255,77,90,0.12)", border: "none", cursor: "pointer", fontSize: "14px" }}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={openCreateForm} style={{ width: "100%", padding: "16px", borderRadius: "18px", border: "2px dashed rgba(255,255,255,0.15)", background: "none", color: "rgba(255,255,255,0.4)", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              ＋ Nouvel utilisateur
            </button>
          </div>
        )}

        {/* TAB DOSSIERS */}
        {tab === "dossiers" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {dossiers.map(d => (
              <div key={d.id} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "14px", background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>📂</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "white" }}>{d.nom}</p>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>{d.articleIds?.length || 0} article{(d.articleIds?.length || 0) > 1 ? "s" : ""}</p>
                </div>
                <button onClick={() => handleDeleteDossier(d.id)} style={{ width: "34px", height: "34px", borderRadius: "11px", background: "rgba(255,77,90,0.12)", border: "none", cursor: "pointer", fontSize: "14px" }}>🗑</button>
              </div>
            ))}
            <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px", padding: "16px" }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: "12px" }}>Nouveau dossier</p>
              <input type="text" placeholder="Nom du dossier (ex: Chez Marc)" value={newDossierNom} onChange={e => setNewDossierNom(e.target.value)} style={{ ...inputStyle, marginBottom: "10px" }} />
              <button onClick={handleCreateDossier} disabled={!newDossierNom || savingDossier} style={{ width: "100%", padding: "14px", borderRadius: "14px", background: "linear-gradient(135deg, #ff4d5a, #ff6b35)", border: "none", color: "white", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: !newDossierNom ? 0.5 : 1, boxShadow: "0 8px 20px rgba(255,77,90,0.3)" }}>
                {savingDossier ? "Création..." : "Créer le dossier"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal utilisateur */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#1a1f3a", borderRadius: "28px 28px 0 0", width: "100%", maxWidth: "480px", padding: "24px 20px 48px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ width: "40px", height: "4px", background: "rgba(255,255,255,0.2)", borderRadius: "2px", margin: "0 auto 20px" }} />
            <h2 style={{ fontSize: "20px", fontWeight: 900, color: "white", marginBottom: "20px", textAlign: "center" }}>
              {editingUser ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>Nom</p>
                <input type="text" placeholder="ex: Marc" value={formNom} onChange={e => setFormNom(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>PIN (4 chiffres)</p>
                <input type="number" placeholder="ex: 1234" value={formPin} onChange={e => setFormPin(e.target.value.slice(0, 4))} style={inputStyle} />
              </div>
              <div>
                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>Rôle</p>
                <select value={formRole} onChange={e => setFormRole(e.target.value as "Admin" | "Standard")} style={inputStyle}>
                  <option value="Standard">Standard</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div>
                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Dossiers accessibles</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {dossiers.map(d => (
                    <button key={d.id} onClick={() => toggleDossier(d.id)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "14px", cursor: "pointer", fontFamily: "inherit", fontSize: "14px", fontWeight: 600, background: formDossiers.includes(d.id) ? "rgba(255,77,90,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${formDossiers.includes(d.id) ? "rgba(255,77,90,0.3)" : "rgba(255,255,255,0.07)"}`, color: formDossiers.includes(d.id) ? "#ff4d5a" : "rgba(255,255,255,0.6)", textAlign: "left" }}>
                      <div style={{ width: "20px", height: "20px", borderRadius: "6px", border: `2px solid ${formDossiers.includes(d.id) ? "#ff4d5a" : "rgba(255,255,255,0.2)"}`, background: formDossiers.includes(d.id) ? "#ff4d5a" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "white", flexShrink: 0 }}>
                        {formDossiers.includes(d.id) && "✓"}
                      </div>
                      {d.nom}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                <button onClick={handleSaveUser} disabled={!formNom || formPin.length !== 4 || savingUser} style={{ width: "100%", padding: "16px", borderRadius: "16px", background: "linear-gradient(135deg, #ff4d5a, #ff6b35)", border: "none", color: "white", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: !formNom || formPin.length !== 4 ? 0.5 : 1, boxShadow: "0 8px 20px rgba(255,77,90,0.3)" }}>
                  {savingUser ? "Enregistrement..." : editingUser ? "💾 Enregistrer" : "➕ Créer"}
                </button>
                <button onClick={() => setShowForm(false)} style={{ width: "100%", padding: "16px", borderRadius: "16px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}