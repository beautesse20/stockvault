import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const AIRTABLE_TOKEN   = process.env.AIRTABLE_TOKEN!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const AIRTABLE_TABLE_ARTICLES     = process.env.AIRTABLE_TABLE_ARTICLES!;
const AIRTABLE_TABLE_DOSSIERS     = process.env.AIRTABLE_TABLE_DOSSIERS!;
const AIRTABLE_TABLE_UTILISATEURS = process.env.AIRTABLE_TABLE_UTILISATEURS!;

const headers = { "Authorization": `Bearer ${AIRTABLE_TOKEN}` };

async function fetchAirtable(tableId: string) {
  const res  = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${tableId}`, { headers });
  const data = await res.json();
  return data.records || [];
}

async function migrate() {
  console.log("=== DÉBUT MIGRATION ===");

  // 1) Migrer les dossiers
  console.log("Migration dossiers...");
  const dossierRecords = await fetchAirtable(AIRTABLE_TABLE_DOSSIERS);
  const dossierMap: Record<string, string> = {}; // airtableId -> firebaseId

  for (const r of dossierRecords) {
    if (!r.fields["Nom"]) continue;
    const ref = await addDoc(collection(db, "dossiers"), {
      nom: r.fields["Nom"] || "",
    });
    dossierMap[r.id] = ref.id;
    console.log(`  Dossier: ${r.fields["Nom"]} → ${ref.id}`);
  }

  // 2) Migrer les utilisateurs
  console.log("Migration utilisateurs...");
  const userRecords = await fetchAirtable(AIRTABLE_TABLE_UTILISATEURS);

  for (const r of userRecords) {
    if (!r.fields["Nom"] || !r.fields["PIN"]) continue;
    const dossierIds = (r.fields["Dossiers"] || []).map((aid: string) => dossierMap[aid]).filter(Boolean);
    await addDoc(collection(db, "utilisateurs"), {
      nom:        r.fields["Nom"]  || "",
      pin:        r.fields["PIN"]  || "",
      role:       r.fields["Rôle"] || "Standard",
      dossierIds,
    });
    console.log(`  Utilisateur: ${r.fields["Nom"]}`);
  }

  // 3) Migrer les articles
  console.log("Migration articles...");
  const articleRecords = await fetchAirtable(AIRTABLE_TABLE_ARTICLES);

  for (const r of articleRecords) {
    if (!r.fields["Référence"]) continue;
    const dossierId = r.fields["Dossier"]?.[0] ? dossierMap[r.fields["Dossier"][0]] || "" : "";
    const images = (r.fields["Images"] || []).map((img: any) => ({
      url:      img.url || "",
      filename: img.filename || "",
    }));
    await addDoc(collection(db, "articles"), {
      ref:         r.fields["Référence"]   || "",
      nom:         r.fields["Nom"]         || "",
      type:        r.fields["Type"]        || "",
      prix:        r.fields["Prix"]        || null,
      fonctionnel: r.fields["Fonctionnel"] || "",
      description: r.fields["Description"] || "",
      stockage:    r.fields["Stockage"]    || "",
      couleur:     r.fields["Couleur"]     || "",
      ecran:       r.fields["Écran"]       || "",
      coque:       r.fields["Coque"]       || "",
      batterie:    r.fields["Batterie"]    || "",
      defaut:      r.fields["Défaut"]      || "",
      images,
      dossierId,
    });
    console.log(`  Article: ${r.fields["Référence"]} - ${r.fields["Nom"]}`);
  }

  console.log("=== MIGRATION TERMINÉE ===");
  process.exit(0);
}

migrate().catch(err => {
  console.error("ERREUR:", err);
  process.exit(1);
});