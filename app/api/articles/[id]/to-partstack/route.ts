import { NextRequest, NextResponse } from "next/server";
import { getArticle, deleteArticle } from "@/lib/firebase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// PartStack = projet Firebase séparé. On écrit la pièce via l'API REST.
const PART_FS  = "https://firestore.googleapis.com/v1/projects/partstack/databases/(default)/documents";
const PART_KEY = "AIzaSyAW112uEqUTDtgfVmrf7GSBuGAnReoH4fE";

// Codes réf identiques à PartStack (genRef).
const BRAND_CD: Record<string, string> = { Apple: "A", Samsung: "SA", Xiaomi: "XI", Huawei: "HU", OnePlus: "OP", Google: "GO", Autre: "AU" };
const CHA = "CHA"; // type imposé : Chassis
const mShort = (m: string) => (m || "").replace(/iphone/i, "").replace(/galaxy/i, "").replace(/redmi/i, "R").replace(/[^0-9A-Za-z+]/g, "").toUpperCase().slice(0, 5);

function deriveBrand(nom: string): string {
  const n = (nom || "").toLowerCase();
  if (/iphone|ipad|macbook|apple|airpod|\bwatch\b/.test(n)) return "Apple";
  if (/galaxy|samsung/.test(n)) return "Samsung";
  if (/redmi|xiaomi|poco|\bmi\b/.test(n)) return "Xiaomi";
  if (/huawei|honor/.test(n)) return "Huawei";
  if (/oneplus/.test(n)) return "OnePlus";
  if (/pixel|google/.test(n)) return "Google";
  return "Autre";
}

// Lit les réfs PartStack existantes (champ ref seul) → prochain n° de séquence.
async function nextRef(base: string): Promise<string> {
  const refs: string[] = [];
  let token = "";
  do {
    const r = await fetch(`${PART_FS}/parts?key=${PART_KEY}&pageSize=300&mask.fieldPaths=ref${token ? `&pageToken=${token}` : ""}`);
    const d = await r.json();
    (d.documents || []).forEach((doc: any) => { const rf = doc.fields?.ref?.stringValue; if (rf) refs.push(rf); });
    token = d.nextPageToken || "";
  } while (token);
  const n = refs.filter(rf => rf.startsWith(base + "-")).length + 1;
  return `${base}-${n}`;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const a: any = await getArticle(id);
    if (!a) return NextResponse.json({ success: false, error: "Article introuvable" }, { status: 404 });

    const brand = deriveBrand(a.nom);
    const base  = `${BRAND_CD[brand] || "AU"}${mShort(a.nom)}-${CHA}`;
    const ref   = await nextRef(base);

    // Notes = toutes les autres infos + mention en MAJUSCULES.
    const specs = [
      ["Stockage", a.stockage], ["Couleur", a.couleur], ["Écran", a.ecran],
      ["Coque", a.coque], ["Batterie", a.batterie], ["Fonctionnel", a.fonctionnel], ["Défaut", a.defaut],
    ].filter(([, v]) => v && String(v).trim()).map(([k, v]) => `${k}: ${v}`).join(" · ");
    const refLine = a.ref ? `Réf StockVault : ${a.ref}\n` : "";
    const notes = (specs ? specs + "\n" : "") + refLine + "/ AJOUTÉ AUTOMATIQUEMENT DEPUIS STOCKVAULT";

    // État : fonctionnel=Non → HS ; défaut présent → Partiel ; sinon OK.
    const condition = a.fonctionnel === "Non" ? "broken" : (a.defaut && String(a.defaut).trim() ? "partial" : "ok");

    // Toutes les photos (exceptionnellement, pas de limite à 2).
    const photos: string[] = (a.images || []).map((im: any) => im?.url).filter(Boolean);
    const hist: any[] = Array.isArray(a.historique) ? a.historique : [];

    const fields: any = {
      ref:        { stringValue: ref },
      brand:      { stringValue: brand },
      model:      { stringValue: a.nom || "" },
      type:       { stringValue: "Chassis" },
      condition:  { stringValue: condition },
      notes:      { stringValue: notes },
      compatible: { arrayValue: { values: [] } },
      photos:     { arrayValue: { values: photos.map(u => ({ stringValue: u })) } },
      createdAt:  { timestampValue: new Date().toISOString() },
      source:     { stringValue: "stockvault" },
    };
    if (hist.length) {
      fields.historique = { arrayValue: { values: hist.map((h: any) => ({
        mapValue: { fields: { date: { stringValue: h.date || "" }, texte: { stringValue: h.texte || "" }, auteur: { stringValue: h.auteur || "" } } },
      })) } };
    }

    // 1) Créer la pièce d'ABORD (si ça échoue, on ne supprime rien → aucune perte).
    const cr = await fetch(`${PART_FS}/parts?key=${PART_KEY}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields }),
    });
    const cd = await cr.json();
    if (!cr.ok || !cd.name) {
      return NextResponse.json({ success: false, error: cd?.error?.message || "Création PartStack échouée" }, { status: 502 });
    }

    // 2) Supprimer de StockVault + griser la ligne du Sheet (sinon le Sync recrée l'article).
    const refStock = a.ref;
    await deleteArticle(id);
    if (refStock && process.env.APPS_SCRIPT_URL) {
      const dateFr = new Date().toLocaleDateString("fr-FR");
      const note   = `Transformé en pièce PartStack (${ref}) / ${dateFr}`;
      await fetch(`${process.env.APPS_SCRIPT_URL}?action=griser&ref=${encodeURIComponent(refStock)}&note=${encodeURIComponent(note)}`).catch(() => {});
    }

    return NextResponse.json({ success: true, ref, brand });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
