"use client";
import { useRef, useState } from "react";

// Curseur « glisser pour confirmer » : il faut faire glisser le bouton jusqu'au bout
// pour déclencher l'action (évite toute activation accidentelle).
export default function SlideToConfirm({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const [x, setX] = useState(0);
  const [done, setDone] = useState(false);
  const maxX = () => (track.current?.clientWidth || 300) - 52; // 44 (bouton) + 8 (marges)

  const start = () => { if (!done) drag.current = true; };
  const move = (clientX: number) => {
    if (!drag.current || !track.current) return;
    const r = track.current.getBoundingClientRect();
    let nx = clientX - r.left - 26;
    nx = Math.max(0, Math.min(nx, maxX()));
    setX(nx);
  };
  const end = () => {
    if (!drag.current) return;
    drag.current = false;
    if (x >= maxX() - 6) { setX(maxX()); setDone(true); onConfirm(); }
    else setX(0);
  };

  return (
    <div ref={track}
      onMouseMove={e => move(e.clientX)} onMouseUp={end} onMouseLeave={end}
      onTouchMove={e => move(e.touches[0].clientX)} onTouchEnd={end}
      style={{ position: "relative", height: "52px", borderRadius: "26px", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.4)", overflow: "hidden", userSelect: "none", touchAction: "none" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#c7b3ff", fontSize: "13px", fontWeight: 700, paddingLeft: "40px" }}>
        {done ? "✓ Activation…" : label}
      </div>
      <div onMouseDown={start} onTouchStart={start}
        style={{ position: "absolute", top: "4px", left: "4px", transform: `translateX(${x}px)`, width: "44px", height: "44px", borderRadius: "50%", background: "linear-gradient(135deg,#8b5cf6,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab", fontSize: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
        🎭
      </div>
    </div>
  );
}
