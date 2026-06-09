// Upload direct du navigateur vers Cloudinary, sans passer par le serveur Vercel.
// Utilise un "upload preset non signé" (le nom est public par nature, sans risque
// pour le contenu existant). Renvoie l'URL sécurisée de l'image.

const CLOUD_NAME    = "dv9hn2eff";
const UPLOAD_PRESET = "sjfvdj53";

export async function uploadToCloudinary(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: fd }
  );

  const data = await res.json();
  if (!res.ok || !data.secure_url) {
    throw new Error(data?.error?.message || "Upload Cloudinary échoué");
  }
  return data.secure_url as string;
}
