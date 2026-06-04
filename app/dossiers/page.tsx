"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, clearSession, isAdmin } from "@/lib/auth";
import { Dossier } from "@/lib/airtable";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function DossiersPage() {
  const [dossiers, setDossiers]   = useState<Dossier[]>([]);
  const [loading, setLoading]     = useState(true);
  const [userName, setUserName]   = useState("");
  const [admin, setAdmin]         = useState(false);
  const router = useRouter();

  useEffect(() => {
    const user = getSession();
    if (!user) { router.push("/"); return; }
    setUserName(user.nom);
    setAdmin(user.role === "Admin");
    fetchDossiers(user);
  }, []);

  const fetchDossiers = async (user: any) => {
    try {
      const res  = await fetch("/api/dossiers");
      const data = await res.json();
      const all: Dossier[] = data.dossiers || [];

      // Admin voit tout, Standard voit seulement ses dossiers
      if (user.role === "Admin") {
        setDossiers(all);
      } else {
        const allowed = all.filter(d => user.dossierIds?.includes(d.id));
        setDossiers(allowed);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const emojis = ["🏠","📦","🚗","🏪","🏭","📫"];
  const colors = [
    "from-indigo-500/20 to-indigo-500/5 border-indigo-500/20",
    "from-pink-500/20 to-pink-500/5 border-pink-500/20",
    "from-emerald-500/20 to-emerald-500/5 border-emerald-500/20",
  ];

  if (loading) return (
    <div className="min-h-screen bg-[#0f0f13] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/20 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f0f13] text-white">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">StockVault</span>
          <div className="flex items-center gap-3">
            {admin && (
              <button
                onClick={() => router.push("/admin")}
                className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-lg"
              >
                ⚙️
              </button>
            )}
            <button
              onClick={() => { clearSession(); router.push("/"); }}
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-lg"
            >
              👤
            </button>
          </div>
        </div>
        <h1 className="text-2xl font-black">Mes dossiers</h1>
        <p className="text-white/40 text-sm mt-1">Bonjour, {userName} 👋</p>
      </div>

      {/* Stats */}
      <div className="px-5 grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white/5 border border-white/8 rounded-2xl p-4">
          <div className="text-3xl font-black text-indigo-400">{dossiers.length}</div>
          <div className="text-white/40 text-xs mt-1">Dossiers actifs</div>
        </div>
        <div
  onClick={() => router.push("/articles")}
  className="bg-white/5 border border-white/8 rounded-2xl p-4 cursor-pointer active:scale-95 transition-all"
>
  <div className="text-3xl font-black text-emerald-400">
    {dossiers.reduce((s, d) => s + (d.articleIds?.length || 0), 0)}
  </div>
  <div className="text-white/40 text-xs mt-1">Articles total</div>
</div>
      </div>

      {/* Liste dossiers */}
      <div className="px-5 flex flex-col gap-3">
        {dossiers.length === 0 && (
          <div className="text-center text-white/30 py-16">
            <div className="text-5xl mb-4">📂</div>
            <p>Aucun dossier disponible</p>
          </div>
        )}
        {dossiers.map((d, i) => (
          <div
            key={d.id}
            onClick={() => router.push(`/dossiers/${d.id}`)}
            className={`bg-gradient-to-br ${colors[i % colors.length]} border rounded-3xl p-5 flex items-center gap-4 cursor-pointer active:scale-95 transition-all`}
          >
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-2xl flex-shrink-0">
              {emojis[i % emojis.length]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-base">{d.nom}</div>
              <div className="text-white/40 text-sm mt-0.5">
                {d.articleIds?.length || 0} article{(d.articleIds?.length || 0) > 1 ? "s" : ""}
              </div>
            </div>
            <div className="text-white/30 text-2xl">›</div>
          </div>
        ))}
      </div>

      <div className="h-24" />
    </div>
  );
}