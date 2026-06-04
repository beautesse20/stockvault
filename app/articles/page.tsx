"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Article, Dossier } from "@/lib/airtable";

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filtre, setFiltre]     = useState("Tous");
  const [search, setSearch]     = useState("");
  const router = useRouter();

  useEffect(() => {
    const user = getSession();
    if (!user) { router.push("/"); return; }
    fetchData(user);
  }, []);

  const fetchData = async (user: any) => {
    try {
      const [resA, resD] = await Promise.all([
        fetch("/api/articles"),
        fetch("/api/dossiers"),
      ]);
      const dataA = await resA.json();
      const dataD = await resD.json();

      const allDossiers: Dossier[] = dataD.dossiers || [];
      const allArticles: Article[] = dataA.articles || [];

      setDossiers(allDossiers);

      // Admin voit tout, Standard voit seulement ses dossiers
      if (user.role === "Admin") {
        setArticles(allArticles);
      } else {
        const allowed = allArticles.filter(a =>
          user.dossierIds?.includes(a.dossierId || "")
        );
        setArticles(allowed);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filtres = ["Tous", "Téléphone", "Divers", "Sans photo"];

  const articlesFiltres = articles
    .filter(a => {
      if (filtre === "Tous")       return true;
      if (filtre === "Sans photo") return !a.images || a.images.length === 0;
      return a.type === filtre;
    })
    .filter(a => {
      if (!search) return true;
      return (
        a.nom.toLowerCase().includes(search.toLowerCase()) ||
        a.ref.toLowerCase().includes(search.toLowerCase())
      );
    });

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
        <h1 className="text-2xl font-black">Tous les articles</h1>
        <p className="text-white/40 text-sm mt-1">{articles.length} article{articles.length > 1 ? "s" : ""}</p>
      </div>

      {/* Recherche */}
      <div className="px-5 mb-4">
        <div className="bg-white/5 border border-white/8 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-white/30">🔍</span>
          <input
            type="text"
            placeholder="Rechercher un article ou une ref..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-white text-sm outline-none flex-1 placeholder-white/30"
          />
        </div>
      </div>

      {/* Filtres */}
      <div className="px-5 flex gap-2 overflow-x-auto pb-2 mb-4">
        {filtres.map(f => (
          <button
            key={f}
            onClick={() => setFiltre(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              filtre === f
                ? "bg-indigo-500 text-white"
                : "bg-white/8 text-white/50 border border-white/10"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Grille articles */}
      <div className="px-5 grid grid-cols-2 gap-3">
        {articlesFiltres.length === 0 && (
          <div className="col-span-2 text-center text-white/30 py-16">
            <div className="text-5xl mb-4">📦</div>
            <p>Aucun article</p>
          </div>
        )}
        {articlesFiltres.map(a => (
          <div
            key={a.id}
            onClick={() => router.push(`/articles/${a.id}`)}
            className="bg-white/5 border border-white/8 rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-all"
          >
            {/* Image */}
            <div className="aspect-square bg-white/5 relative flex items-center justify-center">
              {a.images && a.images.length > 0 ? (
                <>
                  <img
                    src={a.images[0].url}
                    alt={a.nom}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-semibold">
                    {a.images.length} 📷
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-white/20">
                  <span className="text-3xl">📷</span>
                  <span className="text-xs">Ajouter photo</span>
                </div>
              )}
            </div>
            {/* Infos */}
            <div className="p-3">
              <div className="text-indigo-400 text-xs font-semibold tracking-wide uppercase mb-1">
                {a.ref}
              </div>
              <div className="text-sm font-semibold truncate">{a.nom}</div>
              <div className="text-white/30 text-xs mt-0.5">
                {dossiers.find(d => d.id === a.dossierId)?.nom || "Sans dossier"}
              </div>
              <div className="text-emerald-400 text-sm font-bold mt-1">
                {a.prix ? `${a.prix} €` : "—"}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="h-24" />
    </div>
  );
}