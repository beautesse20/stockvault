// ============================================================
//  CATALOGUE DES PERMISSIONS (à la carte)
//  Source de vérité partagée UI + serveur. Une permission = une
//  capacité précise. Admin = tout. Les clés ne changent JAMAIS de
//  sens (ajouter, ne pas renommer) : elles sont stockées par user.
// ============================================================

export type PermGroup = { groupe: string; items: { key: string; label: string; note?: string }[] };

export const PERMISSIONS: PermGroup[] = [
  {
    groupe: "Stock (StockVault)",
    items: [
      { key: "stock.view", label: "Voir le stock", note: "limité à ses dossiers" },
      { key: "stock.edit", label: "Créer / modifier des articles" },
      { key: "stock.delete", label: "Supprimer articles / photos" },
      { key: "article.transform", label: "Transformer un article en pièce" },
      { key: "article.history", label: "Voir l'historique / réparations (interne)" },
    ],
  },
  {
    groupe: "Pièces (PartStack)",
    items: [
      { key: "partstack.view", label: "Voir les pièces" },
      { key: "partstack.edit", label: "Ajouter / modifier des pièces" },
    ],
  },
  {
    groupe: "Ventes & annonces",
    items: [
      { key: "ventes.record", label: "Enregistrer des ventes" },
      { key: "ventes.dashboard", label: "Voir le Dashboard (CA, marges)", note: "sensible" },
      { key: "annonces.generate", label: "Générer des annonces" },
      { key: "site.publish", label: "Publier sur le site vitrine" },
    ],
  },
  {
    groupe: "Achat & finance",
    items: [
      { key: "analyse.lot", label: "Analyser un lot d'achat" },
      { key: "rentabilite.view", label: "Voir la rentabilité par lot", note: "sensible" },
      { key: "depenses.manage", label: "Gérer les dépenses" },
      { key: "reversements.view", label: "Voir les reversements vendeurs", note: "sensible" },
    ],
  },
  {
    groupe: "Outils",
    items: [
      { key: "recherche.use", label: "Recherche universelle" },
      { key: "conseiller.use", label: "Mon Conseiller (IA)", note: "voit beaucoup de données" },
    ],
  },
  {
    groupe: "Administration",
    items: [
      { key: "admin.users", label: "Gérer les utilisateurs & accès", note: "critique" },
      { key: "admin.journal", label: "Voir le journal d'audit" },
      { key: "admin.settings", label: "Réglages admin" },
    ],
  },
];

// Toutes les clés (à plat).
export const ALL_PERMS: string[] = PERMISSIONS.flatMap((g) => g.items.map((i) => i.key));

// Défaut rétro-compatible pour les anciens comptes "Standard" (aucune permission
// enregistrée) : ce qu'ils pouvaient déjà faire avant, ni plus ni moins.
export const LEGACY_STANDARD_PERMS = ["stock.view", "stock.edit"];

// Dépendances : une permission d'ACTION implique la permission de LECTURE
// correspondante (modifier/supprimer/transformer un article n'a aucun sens sans
// pouvoir le voir). On les ajoute automatiquement → un profil « stock.edit » sans
// « stock.view » fonctionne quand même (launcher + serveur), sans réédition.
const IMPLIES: Record<string, string[]> = {
  "stock.edit":        ["stock.view"],
  "stock.delete":      ["stock.view"],
  "article.transform": ["stock.view"],
  "article.history":   ["stock.view"],
  "partstack.edit":    ["partstack.view"],
};

// Ajoute les permissions impliquées (fermeture transitive simple, 1 niveau suffit ici).
export function expandPerms(keys: string[]): string[] {
  const out = new Set(keys);
  keys.forEach((k) => (IMPLIES[k] || []).forEach((d) => out.add(d)));
  return Array.from(out);
}

// Permissions EFFECTIVES d'un utilisateur (Admin = tout ; sinon ses permissions
// + les lectures impliquées, avec repli legacy pour les comptes non migrés).
export function permsOf(user: { role?: string; permissions?: string[] } | null | undefined): string[] {
  if (!user) return [];
  if (user.role === "Admin") return ALL_PERMS;
  if (Array.isArray(user.permissions)) return expandPerms(user.permissions);
  return LEGACY_STANDARD_PERMS;
}

// Le test unique utilisé PARTOUT (UI + serveur).
export function can(user: { role?: string; permissions?: string[] } | null | undefined, key: string): boolean {
  if (!user) return false;
  if (user.role === "Admin") return true;
  return permsOf(user).includes(key);
}
