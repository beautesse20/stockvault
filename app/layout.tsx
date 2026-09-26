import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import HomeButton from "@/components/HomeButton";
import RouteLogger from "./RouteLogger";
import DemoBanner from "@/components/DemoBanner";

const dmSans = DM_Sans({ subsets: ["latin"] });

// Fait porter le jeton (localStorage) à tous les appels /api de StockVault, dès le
// chargement (avant tout JS d'app) → le serveur peut vérifier les permissions.
const AUTH_BOOT = `(function(){try{var TK="stockvault_token";
function tok(){try{return localStorage.getItem(TK)||"";}catch(e){return "";}}
function tokValid(){var t=tok();if(!t)return false;try{var p=JSON.parse(atob(t.split(".")[1].replace(/-/g,'+').replace(/_/g,'/')));return !!(p&&p.exp&&p.exp>Date.now());}catch(e){return false;}}
try{if(tokValid())sessionStorage.removeItem("reauth_redir");}catch(e){}
function reauth(){try{if(sessionStorage.getItem("reauth_redir")==="1")return;sessionStorage.setItem("reauth_redir","1");localStorage.removeItem("stockvault_user");localStorage.removeItem(TK);}catch(e){}location.href="/";}
if(window.__authFetchPatched)return;
var orig=window.fetch.bind(window);
window.fetch=function(input,init){init=init||{};
 var url=typeof input==="string"?input:(input&&input.url)||"";
 var isApi=url.indexOf("/api/")===0||url.indexOf(location.origin+"/api/")>-1;
 var isLogin=url.indexOf("/api/login")>-1;
 var call;
 try{var t=tok();if(isApi&&t){var hd=new Headers((init&&init.headers)||(typeof input!=="string"&&input.headers)||{});if(!hd.has("Authorization"))hd.set("Authorization","Bearer "+t);call=orig(input,Object.assign({},init,{headers:hd}));}else{call=orig(input,init);}}catch(e){return orig(input,init);}
 if(isApi&&!isLogin){return call.then(function(r){try{if(r&&r.status===403&&!tokValid())reauth();}catch(e){}return r;});}
 return call;
};
window.__authFetchPatched=true;}catch(e){}})();`;

// MODE PRÉSENTATION : si activé (localStorage bm_present="1"), on renvoie de FAUSSES
// données pour toutes les routes sensibles (aucune vraie donnée chargée) et on bloque
// toute modification réelle (les POST/PATCH/DELETE ne touchent pas le serveur).
const DEMO_BOOT = `(function(){try{if(localStorage.getItem("bm_present")!=="1")return;
try{Object.keys(localStorage).forEach(function(k){if(k.indexOf("svcache:")===0)localStorage.removeItem(k);});}catch(e){}
var DOS=[{id:"d1",nom:"Démo · Paris",articleIds:["a1","a2","a3","a4"]},{id:"d2",nom:"Démo · Vancouver",articleIds:["a5","a6","a7","a8"]},{id:"d3",nom:"Démo · Lot Octobre",articleIds:["a9","a10","a11","a12"]}];
var N=[["iPhone 13","128 Go","Bleu",560,"d1"],["iPhone 12","64 Go","Noir",420,"d1"],["iPhone 14 Pro","256 Go","Graphite",820,"d1"],["iPhone 13 Pro","128 Go","Or",640,"d1"],["Galaxy S22","128 Go","Noir",430,"d2"],["Pixel 7","128 Go","Obsidian",380,"d2"],["iPad Air","64 Go","Gris",340,"d2"],["Galaxy S21","128 Go","Violet",350,"d2"],["iPhone 11","64 Go","Blanc",300,"d3"],["Galaxy A54","128 Go","Lime",240,"d3"],["iPhone SE","64 Go","Rouge",180,"d3"],["iPhone XR","64 Go","Corail",210,"d3"]];
var ART=N.map(function(n,i){return {id:"a"+(i+1),ref:"DEMO-"+("0"+(i+1)).slice(-2),nom:n[0],type:"Téléphone",stockage:n[1],couleur:n[2],ecran:"Bon état",coque:"Propre",batterie:(80+i%16)+"%",fonctionnel:"Oui",defaut:"",prix:n[3],dossierId:n[4],images:[],vendu:false,historique:[]};});
function J(o){return Promise.resolve(new Response(JSON.stringify(o),{status:200,headers:{"Content-Type":"application/json"}}));}
var orig=window.fetch.bind(window);
window.fetch=function(input,init){init=init||{};try{
 var url=typeof input==="string"?input:(input&&input.url)||"";var p=url.replace(location.origin,"");
 var m=((init&&init.method)||(typeof input!=="string"&&input.method)||"GET").toUpperCase();
 if(p.indexOf("/api/")===0){
  if(m==="POST"&&/^\\/api\\/annonces/.test(p))return J({success:true,annonces:[{plat:"facebook",nom:"Facebook Marketplace",titre:"iPhone 13 128GB Blue — Great condition",desc:"Fully tested & unlocked, clean unit.\\n\\n#demo"}]});
  if(m!=="GET")return J({success:true,demo:true});
  var mid=p.match(/^\\/api\\/articles\\/([^\\/?]+)/);if(mid){var a=ART.filter(function(x){return x.id===mid[1];})[0]||ART[0];return J({article:a});}
  if(/^\\/api\\/articles/.test(p)){var q=(p.split("?")[1]||"");var did=new URLSearchParams(q).get("dossierId");return J({articles:did?ART.filter(function(x){return x.dossierId===did;}):ART});}
  if(/^\\/api\\/dossiers/.test(p))return J({dossiers:DOS});
  if(/^\\/api\\/ventes-mois/.test(p))return J({success:true,ventes:9,ca:0});
  if(/^\\/api\\/vendus-mois/.test(p))return J({success:true,ventes:[{dossierId:"d1"},{dossierId:"d2"}]});
  if(/^\\/api\\/listings/.test(p))return J({success:true,listings:[]});
  if(/^\\/api\\/annonces/.test(p))return J({success:true,entries:[]});
 }
}catch(e){}return orig(input,init);};}catch(e){}})();`;

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
        <script dangerouslySetInnerHTML={{ __html: DEMO_BOOT }} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0f0f13" />
      </head>
      <body className={`${dmSans.className} bg-[#0f0f13] antialiased`}>
        {children}
        <RouteLogger />
        <HomeButton />
        <DemoBanner />
      </body>
    </html>
  );
}