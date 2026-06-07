"use client";

import { useState } from "react";
import { saveSession } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function PinLogin() {
  const [pin, setPin]         = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handlePress = async (val: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + val;
    setPin(newPin);
    setError("");
    if (newPin.length === 4) {
      setLoading(true);
      try {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin: newPin }),
        });
        const data = await res.json();
        if (res.ok && data.user) {
          saveSession(data.user);
          router.push("/dossiers");
        } else {
          setTimeout(() => { setPin(""); setError("Code incorrect, réessaie"); setLoading(false); }, 400);
        }
      } catch {
        setPin(""); setError("Erreur de connexion"); setLoading(false);
      }
    }
  };

  const handleDel = () => { setPin(prev => prev.slice(0, -1)); setError(""); };
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#1a1f3a" }}>
      <div style={{
        background: "#f7f8fc", borderRadius: "0 0 0 60px",
        paddingTop: "80px", paddingBottom: "80px",
        paddingLeft: "24px", paddingRight: "24px",
        display: "flex", flexDirection: "column", alignItems: "center",
        position: "relative", zIndex: 2,
      }}>
        <div style={{
          width: "110px", height: "110px", borderRadius: "50%",
          background: "linear-gradient(135deg, #e8eaf6, #f0f2fc)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "54px", marginBottom: "16px",
          boxShadow: "0 12px 30px rgba(26,31,58,0.1)",
        }}>📦</div>
        <h1 style={{ fontSize: "24px", fontWeight: 900, color: "#1a1f3a", marginBottom: "4px" }}>StockVault</h1>
        <p style={{ fontSize: "13px", color: "#8892b0" }}>Votre inventaire, partout</p>
      </div>

      <div style={{
        flex: 1, background: "#1a1f3a", borderRadius: "0 60px 0 0",
        paddingTop: "50px", paddingBottom: "40px",
        paddingLeft: "24px", paddingRight: "24px",
        display: "flex", flexDirection: "column", alignItems: "center",
        position: "relative", zIndex: 1,
      }}>
        <h2 style={{ fontSize: "22px", fontWeight: 800, color: "white", marginBottom: "6px" }}>Bon retour !</h2>
        <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", marginBottom: "24px" }}>Entrez votre code PIN</p>

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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 144px)", gridTemplateRows: "repeat(4, 112px)", gap: "10px" }}>
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } button:active { transform: scale(0.93) !important; }`}</style>
    </div>
  );
}