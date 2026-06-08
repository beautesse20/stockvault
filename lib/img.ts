// Optimise les URLs Cloudinary en insérant des transformations
// (format auto, qualité auto, largeur cible) pour un chargement rapide.
// Si l'URL n'est pas une URL Cloudinary, elle est renvoyée telle quelle.

export function optimizeImage(url: string | undefined, width: number): string {
  if (!url) return "";
  if (!url.includes("/upload/")) return url;
  // Évite de transformer deux fois
  if (url.includes("/upload/f_auto")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
}

// Vignette de grille (petite)
export const thumb = (url?: string) => optimizeImage(url, 400);
// Image de détail (moyenne)
export const medium = (url?: string) => optimizeImage(url, 800);
