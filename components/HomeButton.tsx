"use client";

import { useRouter, usePathname } from "next/navigation";

export default function HomeButton() {
  const router   = useRouter();
  const pathname = usePathname();

  // Cacher sur la page login et la page dossiers (accueil)
  if (pathname === "/" || pathname === "/dossiers") return null;

  return (
    <button
      onClick={() => router.push("/dossiers")}
      className="fixed bottom-8 right-5 w-14 h-14 rounded-full bg-indigo-500 shadow-lg shadow-indigo-500/40 flex items-center justify-center text-2xl z-50 active:scale-90 transition-all"
    >
      🏠
    </button>
  );
}