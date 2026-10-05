import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // L'ancienne route /launcher a été renommée en /accueil : on redirige pour que
  // les raccourcis / icônes existants continuent de fonctionner.
  async redirects() {
    return [
      { source: "/launcher", destination: "/accueil", permanent: true },
    ];
  },
};

export default nextConfig;
