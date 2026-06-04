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
      }
    }
  };

  const handleDel = () => {
    setPin(prev => prev.slice(0, -1));
    setError("");
  };

  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

  return (
    <div className="min-h-screen bg-[#0f0f13] flex flex-col items-center justify-center px-8 gap-8">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-4xl shadow-2xl shadow-indigo-500/40">
          📦
        </div>
        <h1 className="text-3xl font-black text-white font-sans">StockVault</h1>
        <p className="text-white/50 text-sm">Entrez votre code PIN</p>
      </div>

      {/* Dots */}
      <div className="flex gap-5">
        {[0,1,2,3].map(i => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
              i < pin.length
                ? "bg-indigo-500 border-indigo-500 shadow-lg shadow-indigo-500/50"
                : "border-white/20"
            }`}
          />
        ))}
      </div>

      {/* Erreur */}
      {error && (
        <p className="text-red-400 text-sm font-medium">{error}</p>
      )}

      {/* Loading */}
      {loading && (
        <div className="w-6 h-6 border-2 border-white/20 border-t-indigo-500 rounded-full animate-spin" />
      )}

      {/* Clavier PIN */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
        {keys.map((key, i) => (
          <button
            key={i}
            onClick={() => key === "⌫" ? handleDel() : key !== "" ? handlePress(key) : undefined}
            disabled={loading}
            className={`h-20 rounded-2xl text-2xl font-bold text-white transition-all active:scale-90 disabled:opacity-50 ${
              key === ""
                ? "bg-transparent cursor-default"
                : key === "⌫"
                ? "bg-white/5 border border-white/10 text-lg"
                : "bg-white/10 border border-white/10 hover:bg-white/15"
            }`}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}