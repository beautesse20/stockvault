import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  arrayUnion,
  writeBatch,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db  = getFirestore(app);

// ── TYPES ──
export type Article = {
  id:          string;
  ref:         string;
  nom:         string;
  type:        string;
  prix?:       number | null;
  fonctionnel?: string;
  description?: string;
  stockage?:   string;
  couleur?:    string;
  ecran?:      string;
  coque?:      string;
  batterie?:   string;
  defaut?:     string;
  images?:     { url: string; filename: string }[];
  dossierId?:  string;
  masquerDuSite?: boolean;
};

export type Dossier = {
  id:          string;
  nom:         string;
  articleIds?: string[];
};

export type Utilisateur = {
  id:          string;
  nom:         string;
  pin:         string;
  role:        "Admin" | "Standard";
  dossierIds?: string[];
};

// ── DOSSIERS ──
export async function getDossiers(): Promise<Dossier[]> {
  const [dossierSnap, articleSnap] = await Promise.all([
    getDocs(collection(db, "dossiers")),
    getDocs(collection(db, "articles")),
  ]);

  const articles = articleSnap.docs.map(d => ({ id: d.id, ...d.data() } as Article));

  return dossierSnap.docs.map(d => {
    const count = articles.filter(a => a.dossierId === d.id).length;
    return {
      id:         d.id,
      nom:        (d.data() as any).nom || "",
      articleIds: Array(count).fill("x"),
    } as Dossier;
  });
}

export async function createDossier(nom: string): Promise<Dossier> {
  const ref = await addDoc(collection(db, "dossiers"), { nom });
  return { id: ref.id, nom };
}

export async function deleteDossier(id: string): Promise<void> {
  await deleteDoc(doc(db, "dossiers", id));
}

export async function updateDossier(id: string, data: Partial<Dossier>): Promise<void> {
  await updateDoc(doc(db, "dossiers", id), data as any);
}

// ── ARTICLES ──
export async function getArticles(dossierId?: string): Promise<Article[]> {
  let snap;
  if (dossierId) {
    const q = query(collection(db, "articles"), where("dossierId", "==", dossierId));
    snap = await getDocs(q);
  } else {
    snap = await getDocs(collection(db, "articles"));
  }
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Article));
}

export async function getArticle(id: string): Promise<Article> {
  const snap = await getDoc(doc(db, "articles", id));
  if (!snap.exists()) throw new Error("Article introuvable");
  return { id: snap.id, ...snap.data() } as Article;
}

export async function updateArticle(id: string, fields: Partial<Article>): Promise<void> {
  const clean: any = { ...fields, updatedAt: new Date().toISOString() };
  Object.keys(clean).forEach(k => {
    if (clean[k] === undefined) delete clean[k];
  });
  await updateDoc(doc(db, "articles", id), clean);
}

// Ajoute une image SANS écraser les autres (atomique, sûr en parallèle)
export async function appendArticleImage(
  id: string,
  image: { url: string; filename: string }
): Promise<void> {
  await updateDoc(doc(db, "articles", id), {
    images:    arrayUnion(image),
    updatedAt: new Date().toISOString(),
  });
}

// Assigne plusieurs articles à un dossier en une écriture groupée (atomique).
// Ne touche PAS updatedAt : le dossier est une organisation propre à l'app,
// pas une colonne du Sheet — inutile de déclencher une resynchro vers le Sheet.
export async function assignArticlesToDossier(ids: string[], dossierId: string): Promise<void> {
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const batch = writeBatch(db);
    chunk.forEach(id => batch.update(doc(db, "articles", id), { dossierId }));
    await batch.commit();
  }
}

// Affiche / masque plusieurs articles sur le site public (écriture groupée).
// masquerDuSite est un champ propre à l'app (pas une colonne du Sheet),
// donc on ne touche pas updatedAt et la synchro Sheet ne le réécrit jamais.
export async function setArticlesMasque(ids: string[], masquer: boolean): Promise<void> {
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const batch = writeBatch(db);
    chunk.forEach(id => batch.update(doc(db, "articles", id), { masquerDuSite: masquer }));
    await batch.commit();
  }
}

export async function createArticle(fields: Partial<Article>): Promise<string> {
  const ref = await addDoc(collection(db, "articles"), {
    ...fields,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return ref.id;
}

export async function deleteArticle(id: string): Promise<void> {
  await deleteDoc(doc(db, "articles", id));
}

// ── UTILISATEURS ──
export async function getUtilisateurs(): Promise<Utilisateur[]> {
  const snap = await getDocs(collection(db, "utilisateurs"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Utilisateur));
}

export async function loginByPin(pin: string): Promise<Utilisateur | null> {
  const q    = query(collection(db, "utilisateurs"), where("pin", "==", pin));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as Utilisateur;
}

export async function createUtilisateur(
  nom: string, pin: string, role: "Admin" | "Standard", dossierIds: string[]
): Promise<void> {
  await addDoc(collection(db, "utilisateurs"), { nom, pin, role, dossierIds });
}

export async function updateUtilisateur(id: string, fields: Partial<Utilisateur>): Promise<void> {
  const clean: any = {};
  Object.keys(fields).forEach(k => {
    if ((fields as any)[k] !== undefined) clean[k] = (fields as any)[k];
  });
  await updateDoc(doc(db, "utilisateurs", id), clean);
}

export async function deleteUtilisateur(id: string): Promise<void> {
  await deleteDoc(doc(db, "utilisateurs", id));
}