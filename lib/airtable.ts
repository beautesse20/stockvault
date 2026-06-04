const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN!;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID!;
const TABLES = {
  articles:     process.env.AIRTABLE_TABLE_ARTICLES!,
  dossiers:     process.env.AIRTABLE_TABLE_DOSSIERS!,
  utilisateurs: process.env.AIRTABLE_TABLE_UTILISATEURS!,
};

const headers = {
  "Authorization": `Bearer ${AIRTABLE_TOKEN}`,
  "Content-Type":  "application/json",
  "Accept-Charset": "utf-8",
};

const BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;

// ── TYPES ──
export type Article = {
  id: string;
  ref: string;
  nom: string;
  type: string;
  prix?: number;
  fonctionnel?: string;
  description?: string;
  stockage?: string;
  couleur?: string;
  ecran?: string;
  coque?: string;
  batterie?: string;
  defaut?: string;
  images?: { url: string; filename: string }[];
  dossierId?: string;
};

export type Dossier = {
  id: string;
  nom: string;
  articleIds?: string[];
};

export type Utilisateur = {
  id: string;
  nom: string;
  pin: string;
  role: "Admin" | "Standard";
  dossierIds?: string[];
};

// ── DOSSIERS ──
export async function getDossiers(): Promise<Dossier[]> {
  const [resD, resA] = await Promise.all([
    fetch(`${BASE_URL}/${TABLES.dossiers}`, { headers, cache: "no-store" }),
    fetch(`${BASE_URL}/${TABLES.articles}`, { headers, cache: "no-store" }),
  ]);
  const dataD = await resD.json();
  const dataA = await resA.json();

  const articles = dataA.records || [];

  return (dataD.records || []).map((r: any) => {
    const count = articles.filter((a: any) =>
      a.fields["Dossier"]?.[0] === r.id
    ).length;
    return {
      id:         r.id,
      nom:        r.fields["Nom"] || "",
      articleIds: Array(count).fill("x"), // juste pour avoir la bonne longueur
    };
  });
}

export async function createDossier(nom: string): Promise<Dossier> {
  const res = await fetch(`${BASE_URL}/${TABLES.dossiers}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ fields: { Nom: nom } }),
  });
  const data = await res.json();
  return { id: data.id, nom: data.fields["Nom"] };
}

export async function deleteDossier(id: string): Promise<void> {
  await fetch(`${BASE_URL}/${TABLES.dossiers}/${id}`, {
    method: "DELETE",
    headers,
  });
}

// ── ARTICLES ──
export async function getArticles(dossierId?: string): Promise<Article[]> {
  const url = `${BASE_URL}/${TABLES.articles}`;
  const res  = await fetch(url, { headers, cache: "no-store" });
const data = await res.json();
  
  const all = (data.records || []).map((r: any) => ({
    id:          r.id,
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
    images:      r.fields["Images"]      || [],
    dossierId:   r.fields["Dossier"]?.[0] || null,
  }));

  if (dossierId) {
    return all.filter((a: Article) => a.dossierId === dossierId);
  }
  return all;
}

export async function getArticle(id: string): Promise<Article> {
  const res  = await fetch(`${BASE_URL}/${TABLES.articles}/${id}`, { headers });
  const r    = await res.json();
  return {
    id:          r.id,
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
    images:      r.fields["Images"]      || [],
    dossierId:   r.fields["Dossier"]?.[0] || null,
  };
}

export async function updateArticle(id: string, fields: Partial<Article> & { dossierId?: string }): Promise<void> {
  const airtableFields: any = {};
  if (fields.nom)         airtableFields["Nom"]         = fields.nom;
  if (fields.prix)        airtableFields["Prix"]        = fields.prix;
  if (fields.fonctionnel) airtableFields["Fonctionnel"] = fields.fonctionnel;
  if (fields.description) airtableFields["Description"] = fields.description;
  if (fields.stockage)    airtableFields["Stockage"]    = fields.stockage;
  if (fields.couleur)     airtableFields["Couleur"]     = fields.couleur;
  if (fields.ecran)       airtableFields["Écran"]       = fields.ecran;
  if (fields.coque)       airtableFields["Coque"]       = fields.coque;
  if (fields.batterie)    airtableFields["Batterie"]    = fields.batterie;
  if (fields.defaut)      airtableFields["Défaut"]      = fields.defaut;
  if (fields.dossierId)   airtableFields["Dossier"]     = [fields.dossierId];

  await fetch(`${BASE_URL}/${TABLES.articles}/${id}`, {
    method:  "PATCH",
    headers,
    body:    JSON.stringify({ fields: airtableFields }),
  });
}

export async function uploadImageToArticle(articleId: string, base64: string, filename: string): Promise<void> {
  await fetch(`${BASE_URL}/${TABLES.articles}/${articleId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      fields: {
        Images: [{ url: `data:image/jpeg;base64,${base64}`, filename }],
      },
    }),
  });
}

// ── UTILISATEURS ──
export async function getUtilisateurs(): Promise<Utilisateur[]> {
  const res  = await fetch(`${BASE_URL}/${TABLES.utilisateurs}`, { headers });
  const data = await res.json();
  return (data.records || []).map((r: any) => ({
    id:         r.id,
    nom:        r.fields["Nom"]    || "",
    pin:        r.fields["PIN"]    || "",
    role:       r.fields["Rôle"]   || "Standard",
    dossierIds: r.fields["Dossiers"] || [],
  }));
}

export async function loginByPin(pin: string): Promise<Utilisateur | null> {
  const users = await getUtilisateurs();
  return users.find(u => u.pin === pin) || null;
}

export async function createUtilisateur(nom: string, pin: string, role: "Admin" | "Standard", dossierIds: string[]): Promise<void> {
  await fetch(`${BASE_URL}/${TABLES.utilisateurs}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      fields: { Nom: nom, PIN: pin, Rôle: role, Dossiers: dossierIds },
    }),
  });
}

export async function updateUtilisateur(id: string, fields: Partial<Utilisateur>): Promise<void> {
  const airtableFields: any = {};
  if (fields.nom)        airtableFields["Nom"]      = fields.nom;
  if (fields.pin)        airtableFields["PIN"]       = fields.pin;
  if (fields.role)       airtableFields["Rôle"]      = fields.role;
  if (fields.dossierIds) airtableFields["Dossiers"]  = fields.dossierIds;
  await fetch(`${BASE_URL}/${TABLES.utilisateurs}/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ fields: airtableFields }),
  });
}

export async function deleteUtilisateur(id: string): Promise<void> {
  await fetch(`${BASE_URL}/${TABLES.utilisateurs}/${id}`, {
    method: "DELETE",
    headers,
  });
}