// Compresse une image côté navigateur AVANT l'upload.
// Redimensionne sur le plus grand côté et ré-encode en JPEG.
// En cas de souci (fichier non-image, navigateur récalcitrant), renvoie le fichier d'origine.

export async function compressImage(
  file: File,
  maxDim: number = 1600,
  quality: number = 0.8
): Promise<File> {
  // On ne touche qu'aux images
  if (!file.type.startsWith("image/")) return file;
  // Les images déjà petites (< 300 Ko) ne valent pas la peine
  if (file.size < 300 * 1024) return file;

  try {
    const dataUrl = await readAsDataURL(file);
    const img     = await loadImage(dataUrl);

    let { width, height } = img;
    if (width > height) {
      if (width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
    } else {
      if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
    }

    const canvas = document.createElement("canvas");
    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) return file;

    // Si la compression n'a rien gagné, on garde l'original
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.(png|webp|heic|heif|jpeg|jpg)$/i, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
