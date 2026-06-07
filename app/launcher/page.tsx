"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loginByPin } from "@/lib/firebase";
import { saveSession, getSession } from "@/lib/auth";

const APPS = [
  {
    nom:         "StockVault",
    description: "Gestion de stock & inventaire",
    emoji:       "📦",
    url:         "/dossiers",
    internal:    true,
    color:       "linear-gradient(135deg, #ff4d5a, #ff6b35)",
    shadow:      "rgba(255,77,90,0.35)",
  },
  {
    nom:         "PartStack",
    description: "Gestion des pièces détachées",
    emoji:       "🔧",
    url:         "https://beautesse20.github.io/partstack",
    internal:    false,
    color:       "linear-gradient(135deg, #6366f1, #8b5cf6)",
    shadow:      "rgba(99,102,241,0.35)",
  },
];

export default function LauncherPage() {
  const [pin, setPin]         = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser]       = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    // Si déjà connecté, afficher directement les apps
    const session = getSession();
    if (session) setUser(session);
  }, []);

  const handlePress = async (val: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + val;
    setPin(newPin);
    setError("");

    if (newPin.length === 4) {
      setLoading(true);
      try {
        const found = await loginByPin(newPin);
        if (found) {
          saveSession(found);
          setUser(found);
          setPin("");
          // Si Standard → directement dans StockVault
          if (found.role === "Standard") {
            router.push("/dossiers");
          }
        } else {
          setTimeout(() => {
            setPin("");
            setError("Code incorrect, réessaie");
            setLoading(false);
          }, 400);
        }
      } catch {
        setPin("");
        setError("Erreur de connexion");
        setLoading(false);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDel = () => { setPin(p => p.slice(0, -1)); setError(""); };
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

  const handleApp = (app: typeof APPS[0]) => {
    if (app.internal) {
      router.push(app.url);
    } else {
      window.location.href = app.url;
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("stockvault_user");
  };

  // ── VUE APPS (Admin connecté) ──
  if (user && user.role === "Admin") {
    return (
      <div style={{ minHeight: "100vh", background: "#1a1f3a", display: "flex", flexDirection: "column" }}>

        {/* Zone blanche */}
        <div style={{
          background: "#f7f8fc", borderRadius: "0 0 0 60px",
          paddingTop: "60px", paddingBottom: "80px",
          paddingLeft: "20px", paddingRight: "20px",
          position: "relative", zIndex: 2,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
            <div>
              <p style={{ fontSize: "12px", color: "#8892b0", marginBottom: "3px" }}>Connecté en tant que</p>
              <h1 style={{ fontSize: "24px", fontWeight: 900, color: "#1a1f3a" }}>{user.nom} 👋</h1>
            </div>
            <button onClick={handleLogout} style={{
              padding: "8px 16px", borderRadius: "50px", border: "1px solid #e2e5f0",
              background: "white", color: "#8892b0", fontSize: "12px", fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 2px 6px rgba(26,31,58,0.06)",
            }}>
              Déconnexion
            </button>
          </div>
          <p style={{ fontSize: "12px", color: "#8892b0" }}>Choisissez une application</p>
        </div>

        {/* Zone bleu nuit */}
        <div style={{
          flex: 1, background: "#1a1f3a", borderRadius: "0 60px 0 0",
          paddingTop: "40px", paddingLeft: "20px", paddingRight: "20px",
          paddingBottom: "60px", position: "relative", zIndex: 1,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {APPS.map((app, i) => (
              <button key={i} onClick={() => handleApp(app)} style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "24px", padding: "24px 20px",
                display: "flex", alignItems: "center", gap: "18px",
                cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.2s", textAlign: "left",
              }}>
                <div style={{
                  width: "64px", height: "64px", borderRadius: "20px",
                  background: app.color, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: "30px", flexShrink: 0,
                  boxShadow: `0 8px 20px ${app.shadow}`,
                }}>
                  {app.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "18px", fontWeight: 800, color: "white", marginBottom: "4px" }}>{app.nom}</p>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>{app.description}</p>
                </div>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "12px",
                  background: "rgba(255,255,255,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "rgba(255,255,255,0.4)", fontSize: "18px",
                }}>›</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── VUE LOGIN ──
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#1a1f3a" }}>

      {/* Zone blanche */}
      <div style={{
        background: "#f7f8fc", borderRadius: "0 0 0 60px",
        paddingTop: "80px", paddingBottom: "50px",
        paddingLeft: "24px", paddingRight: "24px",
        display: "flex", flexDirection: "column", alignItems: "center",
        position: "relative", zIndex: 2,
      }}>
        <div style={{
          width: "90px", height: "90px", borderRadius: "28px",
          background: "linear-gradient(135deg, #ff4d5a, #ff6b35)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "42px", marginBottom: "16px",
          boxShadow: "0 12px 30px rgba(255,77,90,0.3)",
        }}>🚀</div>
        <h1 style={{ fontSize: "24px", fontWeight: 900, color: "#1a1f3a", marginBottom: "4px" }}>
          Launcher
        </h1>
        <p style={{ fontSize: "13px", color: "#8892b0" }}>
          Accès à vos applications
        </p>
      </div>

      {/* Zone bleu nuit */}
      <div style={{
        flex: 1, background: "#1a1f3a", borderRadius: "0 60px 0 0",
        paddingTop: "50px", paddingBottom: "40px",
        paddingLeft: "24px", paddingRight: "24px",
        display: "flex", flexDirection: "column", alignItems: "center",
        position: "relative", zIndex: 1,
      }}>
        <h2 style={{ fontSize: "22px", fontWeight: 800, color: "white", marginBottom: "6px" }}>Bon retour !</h2>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", marginBottom: "24px" }}>Entrez votre code PIN</p>

        {/* Dots */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "28px" }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: "14px", height: "14px", borderRadius: "50%",
              background: i < pin.length ? "#ff4d5a" : "rgba(255,255,255,0.1)",
              border: `1.5px solid ${i < pin.length ? "#ff4d5a" : "rgba(255,255,255,0.15)"}`,
              boxShadow: i < pin.length ? "0 0 14px rgba(255,77,90,0.7)" : "none",
              transition: "all 0.2s",
            }} />
          ))}
        </div>

        {error && <p style={{ color: "#ff4d5a", fontSize: "13px", marginBottom: "16px", fontWeight: 600 }}>{error}</p>}
        {loading && <div style={{ width: "24px", height: "24px", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#ff4d5a", borderRadius: "50%", marginBottom: "16px", animation: "spin 0.8s linear infinite" }} />}

        {/* Clavier */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", width: "100%", maxWidth: "300px" }}>
          {keys.map((key, i) => (
            <button key={i}
              onClick={() => key === "⌫" ? handleDel() : key !== "" ? handlePress(key) : undefined}
              disabled={loading}
              style={{
                height: "64px", borderRadius: "18px",
                background: key === "" ? "transparent" : "rgba(255,255,255,0.07)",
                border: key === "" ? "none" : "1px solid rgba(255,255,255,0.08)",
                fontSize: "22px", fontWeight: 700,
                color: key === "⌫" ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.85)",
                cursor: key === "" ? "default" : "pointer",
                fontFamily: "inherit", transition: "all 0.15s",
              }}
            >{key}</button>
          ))}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}