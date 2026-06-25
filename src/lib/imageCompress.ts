// Image compression / size-guard used by all product/shop/rich-text image
// uploads. Heavy phone photos are the #1 cause of slow / broken shops. We
// resize to max 1600 px, re-encode to JPEG ~0.82 quality, and hard-reject
// anything still over the cap with a clear user-facing reason.

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB final cap
export const IMAGE_LIMIT_MESSAGE = "Visual Pro accepte uniquement les images de moins de 2 Mo. Compressez votre image puis réessayez.";
const MAX_DIMENSION = 1600;
const QUALITY = 0.82;

const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} Mo`;

export type PrepareResult =
  | { ok: true; file: File; wasCompressed: boolean; reason?: undefined }
  | { ok: false; reason: string; file?: undefined; wasCompressed?: undefined };

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Image illisible"));
    img.src = src;
  });

export async function prepareImageForUpload(file: File): Promise<PrepareResult> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, reason: "Format non supporté. Importez une image JPG, PNG, WEBP ou GIF de moins de 2 Mo." } as PrepareResult;
  }
  // Animated GIFs lose animation if re-encoded — leave them alone but enforce cap.
  if (file.type === "image/gif") {
    if (file.size > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        reason: `Ce GIF fait ${formatSize(file.size)}. ${IMAGE_LIMIT_MESSAGE}`,
      } as PrepareResult;
    }
    return { ok: true, file, wasCompressed: false } as PrepareResult;
  }

  // Small + already JPEG/WebP/PNG: no need to recompress.
  if (file.size <= 800 * 1024) return { ok: true, file, wasCompressed: false } as PrepareResult;

  try {
    const url = URL.createObjectURL(file);
    let img: HTMLImageElement;
    try { img = await loadImage(url); } finally { URL.revokeObjectURL(url); }

    const ratio = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * ratio);
    const h = Math.round(img.naturalHeight * ratio);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: `Cette image fait ${formatSize(file.size)}. ${IMAGE_LIMIT_MESSAGE}` } as PrepareResult;
      return { ok: true, file, wasCompressed: false } as PrepareResult;
    }
    ctx.drawImage(img, 0, 0, w, h);

    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", QUALITY)
    );
    if (!blob) {
      if (file.size > MAX_IMAGE_BYTES) {
        return { ok: false, reason: `Cette image fait ${formatSize(file.size)}. ${IMAGE_LIMIT_MESSAGE}` } as PrepareResult;
      }
      return { ok: true, file, wasCompressed: false } as PrepareResult;
    }

    // Only keep the compressed version if it actually got smaller.
    if (blob.size >= file.size) {
      if (file.size > MAX_IMAGE_BYTES) {
        return { ok: false, reason: `Cette image fait ${formatSize(file.size)}. ${IMAGE_LIMIT_MESSAGE}` } as PrepareResult;
      }
      return { ok: true, file, wasCompressed: false } as PrepareResult;
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    const compressed = new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
    if (compressed.size > MAX_IMAGE_BYTES) {
      return { ok: false, reason: `Même après optimisation, l'image fait ${formatSize(compressed.size)}. ${IMAGE_LIMIT_MESSAGE}` } as PrepareResult;
    }
    return { ok: true, file: compressed, wasCompressed: true } as PrepareResult;
  } catch (e: any) {
    if (file.size > MAX_IMAGE_BYTES) {
      return { ok: false, reason: e?.message || `Cette image fait ${formatSize(file.size)}. ${IMAGE_LIMIT_MESSAGE}` } as PrepareResult;
    }
    return { ok: true, file, wasCompressed: false } as PrepareResult;
  }
}