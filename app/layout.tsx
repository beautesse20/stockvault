import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import HomeButton from "@/components/HomeButton";
import RouteLogger from "./RouteLogger";

const dmSans = DM_Sans({ subsets: ["latin"] });

// Fait porter le jeton (localStorage) à tous les appels /api de StockVault, dès le
// chargement (avant tout JS d'app) → le serveur peut vérifier les permissions.
const AUTH_BOOT = `(function(){try{var TK="stockvault_token";if(window.__authFetchPatched)return;var orig=window.fetch.bind(window);window.fetch=function(input,init){init=init||{};try{var url=typeof input==="string"?input:(input&&input.url)||"";var isApi=url.indexOf("/api/")===0||url.indexOf(location.origin+"/api/")>-1;var tok="";try{tok=localStorage.getItem(TK)||"";}catch(e){}if(isApi&&tok){var hd=new Headers((init&&init.headers)||(typeof input!=="string"&&input.headers)||{});if(!hd.has("Authorization"))hd.set("Authorization","Bearer "+tok);return orig(input,Object.assign({},init,{headers:hd}));}}catch(e){}return orig(input,init);};window.__authFetchPatched=true;}catch(e){}})();`;

export const metadata: Metadata = {
  title: "StockVault",
  description: "Gestion de stock",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "StockVault",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <script dangerouslySetInnerHTML={{ __html: AUTH_BOOT }} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0f0f13" />
      </head>
      <body className={`${dmSans.className} bg-[#0f0f13] antialiased`}>
        {children}
        <RouteLogger />
        <HomeButton />
      </body>
    </html>
  );
}