"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Utilisateur, Dossier } from "@/lib/airtable";
import Button from "@/components/ui/Button";

export default function AdminPage() {
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [dossiers, setDossiers]         = useState<Dossier[]>([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState<"users" | "dossiers">("users");

  // Formulaire création/édition utilisateur
  const [editingUser, setEditingUser]   = useState<Utilisateur | null>(null);
  const [showForm, setShowForm]         = useState(false);
  const [formNom, setFormNom]           = useState("");
  const [formPin, setFormPin]           = useState("");
  const [formRole, setFormRole]         = useState<"Admin" | "Standard">("Standard");
  const [formDossiers, setFormDossiers] = useState<string[]>([]);
  const [savingUser, setSavingUser]     = useState(false);

  // Formulaire dossier
  const [newDossierNom, setNewDossierNom] = useState("");
  const [savingDossier, setSavingDossier] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const user = getSession();
    if (!user || user.role !== "Admin") {
      router.push("/dossiers");
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [resU, resD] = await Promise.all([
        fetch("/api/utilisateurs"),
        fetch("/api/dossiers"),
      ]);
      const dataU = await resU.json();
      const dataD = await resD.json();
      setUtilisateurs(dataU.utilisateurs || []);
      setDossiers(dataD.dossiers || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingUser(null);
    setFormNom("");
    setFormPin("");
    setFormRole("Standard");
    setFormDossiers([]);
    setShowForm(true);
  };

  const openEditForm = (u: Utilisateur) => {
    setEditingUser(u);
    setFormNom(u.nom);
    setFormPin(u.pin);
    setFormRole(u.role);
    setFormDossiers(u.dossierIds || []);
    setShowForm(true);
  };

  const handleSaveUser = async () => {
    if (!formNom || !formPin || formPin.length !== 4) return;
    setSavingUser(true);
    try {
      if (editingUser) {
        // Modifier
        await fetch(`/api/utilisateurs/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nom:        formNom,
            pin:        formPin,
            role:       formRole,
            dossierIds: formDossiers,
          }),
        });
      } else {
        // Créer
        await fetch("/api/utilisateurs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nom:        formNom,
            pin:        formPin,
            role:       formRole,
            dossierIds: formDossiers,
          }),
        });
      }
      setShowForm(false);
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Supprimer cet utilisateur ?")) return;
    await fetch(`/api/utilisateurs/${id}`, { method: "DELETE" });
    await fetchData();
  };

  const handleCreateDossier = async () => {
    if (!newDossierNom) return;
    setSavingDossier(true);
    try {
      await fetch("/api/dossiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: newDossierNom }),
      });
      setNewDossierNom("");
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setSavingDossier(false);
    }
  };

  const handleDeleteDossier = async (id: string) => {
    if (!confirm("Supprimer ce dossier ?")) return;
    await fetch(`/api/dossiers/${id}`, { method: "DELETE" });
    await fetchData();
  };

  const toggleDossier = (id: string) => {
    setFormDossiers(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0f0f13] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/20 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f0f13] text-white">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <button
          onClick={() => router.push("/dossiers")}
          className="text-indigo-400 text-sm font-medium mb-3 flex items-center gap-1"
        >
          ‹ Retour
        </button>
        <h1 className="text-2xl font-black">Paramètres</h1>
        <p className="text-white/40 text-sm mt-1">Gestion des accès et dossiers</p>
      </div>

      {/* Tabs */}
      <div className="px-5 flex gap-2 mb-6">
        {(["users", "dossiers"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
              tab === t
                ? "bg-indigo-500 text-white"
                : "bg-white/8 text-white/50 border border-white/10"
            }`}
          >
            {t === "users" ? "👤 Utilisateurs" : "📂 Dossiers"}
          </button>
        ))}
      </div>

      <div className="px-5">

        {/* ── TAB UTILISATEURS ── */}
        {tab === "users" && (
          <div className="flex flex-col gap-3">

            {/* Liste utilisateurs */}
            {utilisateurs.map(u => (
              <div key={u.id} className="bg-white/5 border border-white/8 rounded-2xl p-4">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-indigo-500/20 flex items-center justify-center text-lg font-bold text-indigo-400 flex-shrink-0">
                    {u.nom.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{u.nom}</div>
                    <div className="text-white/40 text-xs mt-0.5">
                      PIN : {"•".repeat(u.pin.length)} · {u.role}
                    </div>
                    {u.dossierIds && u.dossierIds.length > 0 && (
                      <div className="text-white/30 text-xs mt-1">
                        📂 {u.dossierIds.map(did => dossiers.find(d => d.id === did)?.nom).filter(Boolean).join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditForm(u)}
                      className="w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center text-sm"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-sm"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Bouton créer */}
            <button
              onClick={openCreateForm}
              className="w-full py-4 rounded-2xl border-2 border-dashed border-white/15 text-white/40 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              ＋ Nouvel utilisateur
            </button>
          </div>
        )}

        {/* ── TAB DOSSIERS ── */}
        {tab === "dossiers" && (
          <div className="flex flex-col gap-3">
            {dossiers.map(d => (
              <div key={d.id} className="bg-white/5 border border-white/8 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/20 flex items-center justify-center text-xl flex-shrink-0">
                  📂
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{d.nom}</div>
                  <div className="text-white/40 text-xs mt-0.5">
                    {d.articleIds?.length || 0} article{(d.articleIds?.length || 0) > 1 ? "s" : ""}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteDossier(d.id)}
                  className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center text-sm"
                >
                  🗑
                </button>
              </div>
            ))}

            {/* Formulaire nouveau dossier */}
            <div className="bg-white/5 border border-white/8 rounded-2xl p-4 mt-2">
              <h3 className="font-bold mb-4 text-white/80">Nouveau dossier</h3>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Nom du dossier (ex: Chez Marc)"
                  value={newDossierNom}
                  onChange={e => setNewDossierNom(e.target.value)}
                  className="w-full bg-white/8 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500"
                />
                <Button
                  fullWidth
                  onClick={handleCreateDossier}
                  loading={savingDossier}
                  disabled={!newDossierNom}
                >
                  Créer le dossier
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal création/édition utilisateur */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-[#1a1a24] rounded-t-3xl w-full max-w-md p-6 pb-12 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
            <h2 className="text-xl font-black text-white mb-6 text-center">
              {editingUser ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
            </h2>

            <div className="flex flex-col gap-4">
              {/* Nom */}
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">Nom</label>
                <input
                  type="text"
                  placeholder="ex: Marc"
                  value={formNom}
                  onChange={e => setFormNom(e.target.value)}
                  className="w-full bg-white/8 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500"
                />
              </div>

              {/* PIN */}
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">PIN (4 chiffres)</label>
                <input
                  type="number"
                  placeholder="ex: 1234"
                  value={formPin}
                  onChange={e => setFormPin(e.target.value.slice(0, 4))}
                  className="w-full bg-white/8 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500"
                />
              </div>

              {/* Rôle */}
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">Rôle</label>
                <select
                  value={formRole}
                  onChange={e => setFormRole(e.target.value as "Admin" | "Standard")}
                  className="w-full bg-white/8 border border-white/10 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-indigo-500"
                >
                  <option value="Standard">Standard</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              {/* Dossiers accessibles */}
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-2 block">
                  Dossiers accessibles
                </label>
                <div className="flex flex-col gap-2">
                  {dossiers.map(d => (
                    <button
                      key={d.id}
                      onClick={() => toggleDossier(d.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        formDossiers.includes(d.id)
                          ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
                          : "bg-white/5 border-white/8 text-white/60"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs flex-shrink-0 ${
                        formDossiers.includes(d.id)
                          ? "bg-indigo-500 border-indigo-500 text-white"
                          : "border-white/20"
                      }`}>
                        {formDossiers.includes(d.id) && "✓"}
                      </div>
                      {d.nom}
                    </button>
                  ))}
                </div>
              </div>

              {/* Boutons */}
              <div className="flex flex-col gap-2 mt-2">
                <Button
                  fullWidth
                  onClick={handleSaveUser}
                  loading={savingUser}
                  disabled={!formNom || formPin.length !== 4}
                >
                  {editingUser ? "💾 Enregistrer" : "➕ Créer"}
                </Button>
                <Button
                  fullWidth
                  variant="secondary"
                  onClick={() => setShowForm(false)}
                >
                  Annuler
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="h-24" />
    </div>
  );
}