"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { loginByPin } from "@/lib/firebase";
import { saveSession, getSession, getToken } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { logEvent } from "@/lib/audit";

const APPS = [
  {
    nom:         "StockVault",
    description: "Gestion de stock & inventaire",
    emoji:       "📦",
    url:         "/dossiers",
    internal:    true,
    adminOnly:   false,
    color:       "linear-gradient(135deg, #ff4d5a, #ff6b35)",
    shadow:      "rgba(255,77,90,0.35)",
  },
  {
    nom:         "Recherche",
    description: "Texte · photo · voix — stock, pièces, ventes",
    emoji:       "🔎",
    url:         "https://mes-outils-de-vente.vercel.app/recherche",
    internal:    false,
    adminOnly:   true,
    color:       "linear-gradient(135deg, #0ea5e9, #2563eb)",
    shadow:      "rgba(14,165,233,0.35)",
  },
  {
    nom:         "PartStack",
    description: "Gestion des pièces détachées",
    emoji:       "🔧",
    url:         "https://beautesse20.github.io/partstack",
    internal:    false,
    adminOnly:   false,
    color:       "linear-gradient(135deg, #6366f1, #8b5cf6)",
    shadow:      "rgba(99,102,241,0.35)",
  },
  {
    nom:         "Suivi des ventes",
    description: "Enregistrer une vente · Dashboard",
    emoji:       "🛒",
    url:         "https://mes-outils-de-vente.vercel.app/ventes",
    internal:    false,
    adminOnly:   true,
    color:       "linear-gradient(135deg, #10b981, #059669)",
    shadow:      "rgba(16,185,129,0.35)",
  },
  {
    nom:         "Générateur d'annonces",
    description: "LBC · Vinted · Rakuten",
    emoji:       "✍️",
    url:         "https://mes-outils-de-vente.vercel.app/annonces",
    internal:    false,
    adminOnly:   true,
    color:       "linear-gradient(135deg, #f59e0b, #d97706)",
    shadow:      "rgba(245,158,11,0.35)",
  },
  {
    nom:         "Analyse de lot",
    description: "Valeur de revente · prix max d'achat",
    emoji:       "📊",
    url:         "https://mes-outils-de-vente.vercel.app/analyse-lot",
    internal:    false,
    adminOnly:   true,
    color:       "linear-gradient(135deg, #6366f1, #4f46e5)",
    shadow:      "rgba(99,102,241,0.35)",
  },
  {
    nom:         "Rentabilité par lot",
    description: "Coût · revenu · marge par lot",
    emoji:       "💰",
    url:         "https://mes-outils-de-vente.vercel.app/rentabilite",
    internal:    false,
    adminOnly:   true,
    color:       "linear-gradient(135deg, #10b981, #047857)",
    shadow:      "rgba(16,185,129,0.35)",
  },
  {
    nom:         "Mon Conseiller",
    description: "Assistant qui connaît ton métier",
    emoji:       "🧠",
    url:         "https://mes-outils-de-vente.vercel.app/assistant",
    internal:    false,
    adminOnly:   true,
    color:       "linear-gradient(135deg, #8b5cf6, #6366f1)",
    shadow:      "rgba(139,92,246,0.35)",
  },
];

// Permissions qui rendent chaque app visible dans le launcher (au moins une suffit).
// Admin voit tout. Comptes Standard : uniquement les apps correspondant à leurs droits.
const APP_PERMS: Record<string, string[]> = {
  "StockVault":            ["stock.view"],
  "Recherche":             ["recherche.use"],
  "PartStack":             ["partstack.view"],
  "Suivi des ventes":      ["ventes.record", "ventes.dashboard"],
  "Générateur d'annonces": ["annonces.generate"],
  "Analyse de lot":        ["analyse.lot"],
  "Rentabilité par lot":   ["rentabilite.view"],
  "Mon Conseiller":        ["conseiller.use"],
};
function appsVisibles(user: any) {
  if (!user) return [];
  if (user.role === "Admin") return APPS;
  return APPS.filter(a => (APP_PERMS[a.nom] || []).some(p => can(user, p)));
}

export default function LauncherPage() {
  const [pin, setPin]         = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser]       = useState<any>(null);
  const [showApp, setShowApp] = useState<{ url: string; nom: string } | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list"); // disposition des apps
  const changeView = (m: "list" | "grid") => {
    setViewMode(m);
    try { localStorage.setItem("sv_launcher_view", m); } catch {}
  };
  const iframeRef   = useRef<HTMLIFrameElement>(null);
  const pendingPrefill = useRef<any>(null);
  const router = useRouter();

  // Ouvre l'annonces app dès que user et params URL sont disponibles
  const checkAndOpenAnnonces = (session: any) => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("app") === "annonces" && can(session, "annonces.generate")) {
      const annApp = APPS.find(a => a.nom === "Générateur d'annonces");
      if (annApp) setShowApp({ url: withUser(annApp.url), nom: annApp.nom });
    }
    // Depuis une fiche produit : "Enregistrer la vente" → ouvre Suivi des ventes
    // avec l'article pré-sélectionné (préremplissage par URL, pas de handshake).
    if (p.get("app") === "ventes" && can(session, "ventes.record")) {
      const v = APPS.find(a => a.nom === "Suivi des ventes");
      if (v) {
        const ref = p.get("ref") || "", nom = p.get("nom") || "", type = p.get("type") || "";
        const prefill = ref ? `${ref}${nom ? " / " + nom : ""}` : "";
        const url = v.url + (prefill ? `?prefill=${encodeURIComponent(prefill)}&type=${encodeURIComponent(type)}` : "");
        setShowApp({ url: withUser(url), nom: v.nom });
      }
    }
  };

  useEffect(() => {
    try { const v = localStorage.getItem("sv_launcher_view"); if (v === "grid" || v === "list") setViewMode(v); } catch {}
    const session = getSession();
    if (session) {
      setUser(session);
      checkAndOpenAnnonces(session);
    }

    // Écoute le signal "prêt" de la page annonces
    // On lit window.location.search ICI (pas dans useEffect) pour éviter le cache du router Next.js
    const handleReady = (event: MessageEvent) => {
      // Demande d'aller au stock depuis l'app d'annonces (iframe) → on ferme
      // l'iframe et on ouvre la 1ère page de StockVault (pas le launcher).
      if (event.data?.type === "GO_TO_STOCK") {
        setShowApp(null);
        router.push("/dossiers");
        return;
      }
      // Depuis la Recherche (iframe) : ouvrir la fiche produit dans StockVault.
      if (event.data?.type === "GO_TO_ARTICLE" && event.data.id) {
        setShowApp(null);
        router.push("/articles/" + event.data.id);
        return;
      }
      if (event.data?.type !== "ANNONCES_READY") return;
      if (!iframeRef.current?.contentWindow) return;
      const p   = new URLSearchParams(window.location.search);
      const ref  = p.get("ref");
      const nom  = p.get("nom");
      const type = p.get("type");
      if (p.get("app") !== "annonces" || !ref || !type) return;
      iframeRef.current.contentWindow.postMessage(
        { type: "STOCKVAULT_PREFILL", ref, nom: nom || "", articleType: type },
        "*"
      );
    };
    window.addEventListener("message", handleReady);
    return () => window.removeEventListener("message", handleReady);
  }, []);

  const handlePress = async (val: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + val;
    setPin(newPin);
    setError("");
    if (newPin.length === 4) {
      setLoading(true);
      try {
        // Connexion côté serveur : renvoie l'utilisateur (sans PIN) + un jeton signé.
        let found: any = null, token: string | undefined;
        let serverErr = false;
        try {
          const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: newPin }) });
          const d = await res.json();
          if (d.success) { found = d.user; token = d.token; }
          else if (res.status !== 401) serverErr = true; // 401 = vrai mauvais code ; autre = souci serveur
        } catch { serverErr = true; }
        // Filet de sécurité : si l'API a un souci (pas un mauvais code), on retombe
        // sur l'ancienne connexion pour ne jamais bloquer l'accès.
        if (!found && serverErr) {
          try { const u = await loginByPin(newPin); if (u) found = { id: u.id, nom: u.nom, role: u.role, dossierIds: u.dossierIds || [], permissions: u.permissions }; } catch {}
        }
        if (found) {
          saveSession(found, token);
          logEvent("connexion", { cible: found.nom, details: `Rôle ${found.role}` });
          setUser(found);
          setPin("");
          // Standard : s'il n'a QUE StockVault, on l'y emmène directement (UX
          // inchangée pour les magasiniers). Sinon on affiche le launcher filtré.
          if (found.role === "Standard") {
            const av = appsVisibles(found);
            if (av.length <= 1 && (av.length === 0 || av[0].internal)) router.push("/dossiers");
          }
        } else {
          setTimeout(() => { setPin(""); setError("Code incorrect, réessaie"); setLoading(false); }, 400);
        }
      } catch {
        setPin(""); setError("Erreur de connexion"); setLoading(false);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDel = () => { setPin(p => p.slice(0, -1)); setError(""); };
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

  // Ajoute l'utilisateur connecté à l'URL (?u=) pour que les sous-apps (ventes,
  // PartStack…) attribuent leurs événements au bon utilisateur dans le journal.
  const withUser = (url: string) => {
    const nom = getSession()?.nom;
    let u = url;
    if (nom) u += (u.includes("?") ? "&" : "?") + "u=" + encodeURIComponent(nom);
    // Jeton signé transmis dans le hash (hors logs serveur) → l'app cible l'utilise
    // pour prouver l'identité + les permissions côté serveur.
    const tk = getToken();
    if (tk) u += (u.includes("#") ? "&" : "#") + "tk=" + encodeURIComponent(tk);
    // Propage le mode présentation aux sous-apps (fausses données côté Ventes/PartStack).
    let present = "0"; try { present = localStorage.getItem("bm_present") === "1" ? "1" : "0"; } catch {}
    u += (u.includes("?") ? "&" : "?") + "present=" + present;
    return u;
  };

  const handleApp = (app: typeof APPS[0]) => {
    if (app.internal) router.push(app.url);
    else setShowApp({ url: withUser(app.url), nom: app.nom });
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("stockvault_user");
  };

  // ── VUE IFRAME ──
  if (showApp) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#1a1f3a", zIndex: 100, display: "flex", flexDirection: "column" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
          paddingBottom: "12px", paddingLeft: "16px", paddingRight: "16px",
          background: "#1a1f3a", flexShrink: 0,
        }}>
          <button onClick={() => setShowApp(null)} style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(255,255,255,0.1)", border: "none", color: "white", fontSize: "20px", cursor: "pointer", fontFamily: "inherit" }}>‹</button>
          <span style={{ color: "white", fontSize: "14px", fontWeight: 600 }}>{showApp.nom}</span>
        </div>
        <iframe
          ref={iframeRef}
          src={showApp.url}
          style={{ flex: 1, border: "none", width: "100%" }}
          allow="camera; microphone"
        />
      </div>
    );
  }

  // ── VUE APPS (Admin = tout ; Standard = apps autorisées) ──
  if (user) {
    return (
      <div style={{ minHeight: "100vh", background: "#1a1f3a", display: "flex", flexDirection: "column" }}>

        {/* Zone blanche */}
        <div style={{
          background: "#f7f8fc",
          borderRadius: "0 0 0 60px",
          paddingTop: "60px",
          paddingBottom: "80px",
          paddingLeft: "20px",
          paddingRight: "20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 2,
        }}>
          <p style={{ fontSize: "13px", color: "#8892b0", marginBottom: "8px" }}>Connecté en tant que</p>
          <h1 style={{ fontSize: "36px", fontWeight: 900, color: "#1a1f3a", marginBottom: "8px", textAlign: "center" }}>
            {user.nom} 👋
          </h1>
          <p style={{ fontSize: "15px", color: "#8892b0", marginBottom: "20px" }}>Choisissez une application</p>
          <button onClick={handleLogout} style={{
            padding: "10px 24px", borderRadius: "50px",
            border: "1px solid #e2e5f0", background: "white",
            color: "#8892b0", fontSize: "13px", fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
          }}>Déconnexion</button>
        </div>

        {/* Zone bleu nuit avec les apps */}
        <div style={{
          flex: 1,
          background: "#1a1f3a",
          borderRadius: "0 60px 0 0",
          padding: "26px 20px 30px",
          display: "flex",
          flexDirection: "column",
          justifyContent: viewMode === "grid" ? "flex-start" : "center",
          gap: "16px",
          zIndex: 1,
        }}>
          {/* Toggle disposition : Liste / Icônes */}
          <div style={{ display: "inline-flex", alignSelf: "center", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "999px", padding: "4px", gap: "4px", marginBottom: "6px" }}>
            {([["list", "☰", "Liste"], ["grid", "▦", "Icônes"]] as const).map(([m, ic, lbl]) => (
              <button key={m} onClick={() => changeView(m)} style={{
                padding: "8px 16px", borderRadius: "999px", border: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px",
                background: viewMode === m ? "rgba(255,255,255,0.16)" : "transparent",
                color: viewMode === m ? "white" : "rgba(255,255,255,0.5)",
                transition: "background 0.15s, color 0.15s",
              }}>{ic} {lbl}</button>
            ))}
          </div>

          {viewMode === "list" ? (
            appsVisibles(user).map((app, i) => (
              <button key={i} onClick={() => handleApp(app)} style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "28px",
                padding: "20px",
                display: "flex",
                alignItems: "center",
                gap: "20px",
                cursor: "pointer",
                fontFamily: "inherit",
                width: "100%",
              }}>
                <div style={{
                  width: "90px", height: "90px", borderRadius: "22px",
                  background: app.color, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "44px", flexShrink: 0,
                  boxShadow: `0 8px 22px ${app.shadow}`,
                }}>{app.emoji}</div>

                <div style={{ flex: 1, textAlign: "left" }}>
                  <p style={{ fontSize: "20px", fontWeight: 800, color: "white", marginBottom: "4px" }}>{app.nom}</p>
                  <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>{app.description}</p>
                </div>

                <div style={{
                  width: "40px", height: "40px", borderRadius: "12px",
                  background: "rgba(255,255,255,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "rgba(255,255,255,0.4)", fontSize: "22px", flexShrink: 0,
                }}>›</div>
              </button>
            ))
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
              gap: "20px 12px",
              width: "100%",
              maxWidth: "540px",
              margin: "6px auto 0",
            }}>
              {appsVisibles(user).map((app, i) => (
                <button key={i} onClick={() => handleApp(app)} title={app.description} style={{
                  background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "9px", padding: "4px 2px",
                }}>
                  <div style={{
                    width: "clamp(64px, 20vw, 82px)", aspectRatio: "1", borderRadius: "22px",
                    background: app.color, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "clamp(30px, 9vw, 40px)", boxShadow: `0 8px 22px ${app.shadow}`,
                  }}>{app.emoji}</div>
                  <span style={{
                    fontSize: "12.5px", fontWeight: 700, color: "white", textAlign: "center",
                    lineHeight: 1.2, width: "100%", wordBreak: "break-word",
                  }}>{app.nom}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── VUE LOGIN ──
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#1a1f3a" }}>

      {/* Zone blanche */}
      <div style={{
        background: "#f7f8fc",
        borderRadius: "0 0 0 60px",
        paddingTop: "80px",
        paddingBottom: "60px",
        paddingLeft: "24px",
        paddingRight: "24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
        zIndex: 2,
      }}>
        <div style={{
          width: "90px", height: "90px", borderRadius: "28px",
          background: "linear-gradient(135deg, #ff4d5a, #ff6b35)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "42px", marginBottom: "16px",
          boxShadow: "0 12px 30px rgba(255,77,90,0.3)",
        }}>🚀</div>
        <h1 style={{ fontSize: "28px", fontWeight: 900, color: "#1a1f3a", marginBottom: "6px" }}>Launcher</h1>
        <p style={{ fontSize: "14px", color: "#8892b0" }}>Accès à vos applications</p>
      </div>

      {/* Zone bleu nuit — clavier centré */}
      <div style={{
        flex: 1,
        background: "#1a1f3a",
        borderRadius: "0 60px 0 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
        zIndex: 1,
        gap: "16px",
      }}>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 800, color: "white", marginBottom: "4px" }}>Bon retour !</h2>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>Entrez votre code PIN</p>
        </div>

        {/* Dots */}
        <div style={{ display: "flex", gap: "14px" }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: "13px", height: "13px", borderRadius: "50%",
              background: i < pin.length ? "#ff4d5a" : "rgba(255,255,255,0.1)",
              border: `1.5px solid ${i < pin.length ? "#ff4d5a" : "rgba(255,255,255,0.15)"}`,
              boxShadow: i < pin.length ? "0 0 12px rgba(255,77,90,0.7)" : "none",
              transition: "all 0.2s",
            }} />
          ))}
        </div>

        {error && <p style={{ color: "#ff4d5a", fontSize: "12px", fontWeight: 600, margin: 0 }}>{error}</p>}
        {loading && <div style={{ width: "20px", height: "20px", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#ff4d5a", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}

        {/* Clavier */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 30vw)",
          gridTemplateRows: "repeat(4, 10vh)",
          gap: "8px",
          width: "92vw",
        }}>
          {keys.map((key, i) => (
            <button key={i}
              onClick={() => key === "⌫" ? handleDel() : key !== "" ? handlePress(key) : undefined}
              disabled={loading}
              style={{
                borderRadius: "16px",
                background: key === "" ? "transparent" : "rgba(255,255,255,0.07)",
                border: key === "" ? "none" : "1px solid rgba(255,255,255,0.08)",
                fontSize: "28px",
                fontWeight: 700,
                color: key === "⌫" ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.85)",
                cursor: key === "" ? "default" : "pointer",
                fontFamily: "inherit",
              }}
            >{key}</button>
          ))}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
