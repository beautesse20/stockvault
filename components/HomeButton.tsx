"use client";

import { useRouter, usePathname } from "next/navigation";

export default function HomeButton() {
  const router   = useRouter();
  const pathname = usePathname();

  if (pathname === "/" || pathname === "/dossiers" || pathname === "/launcher") return null;

  return (
    <button
      onClick={() => router.push("/dossiers")}
      style={{
        position: "fixed",
        bottom: "32px",
        right: "20px",
        width: "52px",
        height: "52px",
        borderRadius: "50%",
        background: "linear-gradient(135deg, #ff4d5a, #ff6b35)",
        border: "none",
        cursor: "pointer",
        fontSize: "22px",
        zIndex: 50,
        boxShadow: "0 8px 24px rgba(255,77,90,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s",
      }}
    >
      🏠
    </button>
  );
}