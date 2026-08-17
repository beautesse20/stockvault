import { NextRequest, NextResponse } from "next/server";
import { refToCode, refReelle } from "@/lib/refcode";

export const dynamic = "force-dynamic";

// Moteur d'annonces : on réutilise celui de l'app de ventes (proxy serveur →
// serveur, donc pas de CORS). StockVault a déjà toutes les données de l'article.
const VENTES = "https://mes-outils-de-vente.vercel.app";

const NOM_PLATS: Record<string, string> = {
  lbc: "LeBonCoin", vinted: "Vinted", rakuten: "Rakuten", facebook: "Facebook Marketplace",
};

// Réplique du parseur de l'app de ventes (extrait TITRE / DESCRIPTION du texte brut).
function extraire(txt: string, cle: string): string {
  if (!txt) return "";
  const m = txt.match(new RegExp(`${cle}:[\\s\\S]*?([^\\n]+(?:\\n(?![A-Z_]+:)[^\\n]*)*)`, "m"));
  return m?.[0] ? m[0].replace(`${cle}:`, "").trim() : "";
}

function buildProduit(article: any, type: "tels" | "divers") {
  if (type === "tels") {
    return {
      ref: article.ref || "", nom: article.nom || "",
      stockage: article.stockage || "", couleur: article.couleur || "",
      ecran: article.ecran || "", coque: article.coque || "",
      batterie: article.batterie || "", fonctionnel: article.fonctionnel || "Oui",
      defaut: article.defaut || "",
    };
  }
  return {
    ref: article.ref || "", nom: article.nom || "",
    description: article.description || article.nom || "",
    fonctionnel: article.fonctionnel || "Oui",
    commentaire: article.commentaire || "",
  };
}

// ── GET ?ref=XXX : annonces déjà enregistrées pour ce produit (onglet Annonces IA)
export async function GET(req: NextRequest) {
  try {
    const ref = new URL(req.url).searchParams.get("ref");
    if (!ref) return NextResponse.json({ success: true, entries: [] });
    const res = await fetch(`${VENTES}/api/annonces-historique?ref=${encodeURIComponent(ref)}`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json({ success: true, entries: data.entries || [] });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

// ── POST : génère les annonces (1 appel rapide), les enregistre dans le Sheet,
//          renvoie le résultat parsé. On ATTEND l'enregistrement avant de répondre
//          (sinon Vercel gèle la fonction et la sauvegarde est tuée à mi-chemin).
export async function POST(req: NextRequest) {
  try {
    const { article, plateformes, precision } = await req.json();
    if (!article || !Array.isArray(plateformes) || plateformes.length === 0) {
      return NextResponse.json({ success: false, error: "article et plateformes requis" }, { status: 400 });
    }
    // Détection robuste : "Téléphone" exact, OU type contenant tél/tel, OU présence
    // de specs téléphone (stockage/écran/batterie). Évite qu'un tel parte en "divers".
    const t = String(article.type || "").toLowerCase();
    const estTel = t.includes("tél") || t.includes("tel")
      || !!(article.stockage || article.ecran || article.batterie);
    const type: "tels" | "divers" = estTel ? "tels" : "divers";
    const produit = buildProduit(article, type);

    const genRes = await fetch(`${VENTES}/api/generer`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ produit, type, plateformes, precision: precision || "" }),
    });
    const genData = await genRes.json();
    if (!genData.success) {
      return NextResponse.json({ success: false, error: genData.error || "Génération échouée" }, { status: 502 });
    }

    // Marqueur discret : la réf encodée en mot prononçable (#voquvub), glissée en
    // fin de description sur TOUTES les plateformes (identique à l'app de ventes).
    const marqueur = refReelle(article.ref) ? `\n\n#${refToCode(article.ref)}` : "";
    const annonces = plateformes.map((p: string) => {
      const desc = extraire(genData.annonce, `${p.toUpperCase()}_DESCRIPTION`);
      return {
        plat: p,
        nom: NOM_PLATS[p] || p,
        titre: extraire(genData.annonce, `${p.toUpperCase()}_TITRE`),
        desc: desc.trim() ? desc + marqueur : desc, // marqueur seulement si desc pleine
      };
    });

    // Garde-fou : si le parsing n'a rien donné (annonces vides), on ne sauvegarde
    // RIEN et on renvoie une erreur claire pour que l'UI propose de réessayer.
    const pleines = annonces.filter(a => (a.titre || "").trim() || (a.desc || "").trim());
    if (pleines.length === 0) {
      return NextResponse.json(
        { success: false, error: "Génération vide, réessaie", raw: (genData.annonce || "").slice(0, 300) },
        { status: 502 }
      );
    }

    // Enregistre dans l'onglet "Annonces IA" (par référence) — seulement les pleines.
    if (article.ref) {
      await fetch(`${VENTES}/api/historique`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorie: type, ref: article.ref, annonces: pleines }),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, annonces: pleines });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
