// Image compression / size-guard used by all product/shop/rich-text image
// uploads. Heavy phone photos are the #1 cause of slow / broken shops. We
// resize to max 1600 px, re-encode to JPEG ~0.82 quality, and hard-reject
// anything still over the cap with a clear user-facing reason.

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB final cap
export const IMAGE_LIMIT_MESSAGE = "Visual Pro accepte uniquement les images de moins de 2 Mo. Compressez votre image puis réessayez.";
const MAX_DIMENSION = 1600;
const QUALITY = 0.82;

export const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} Ko`
    : `${(bytes / 1024 / 1024).toFixed(2)} Mo`;

export type PrepareResult =
  | { ok: true; file: File; wasCompressed: boolean; originalSize: number; finalSize: number; reason?: undefined }
  | { ok: false; reason: string; file?: undefined; wasCompressed?: undefined; originalSize?: undefined; finalSize?: undefined };

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Image illisible"));
    img.src = src;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), type, quality));

export async function prepareImageForUpload(file: File): Promise<PrepareResult> {
  const originalSize = file.size;
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
    return { ok: true, file, wasCompressed: false, originalSize, finalSize: file.size } as PrepareResult;
  }

  // Small + already JPEG/WebP/PNG: no need to recompress.
  if (file.size <= 800 * 1024) return { ok: true, file, wasCompressed: false, originalSize, finalSize: file.size } as PrepareResult;

  try {
    const url = URL.createObjectURL(file);
    let img: HTMLImageElement;
    try { img = await loadImage(url); } finally { URL.revokeObjectURL(url); }

    // Iteratively reduce dimension + quality until we land under MAX_IMAGE_BYTES.
    // Browser compression is best-effort: we try several passes before giving up.
    const attempts: Array<{ maxDim: number; quality: number }> = [
      { maxDim: MAX_DIMENSION, quality: QUALITY },
      { maxDim: 1400, quality: 0.78 },
      { maxDim: 1200, quality: 0.74 },
      { maxDim: 1000, quality: 0.7 },
      { maxDim: 900, quality: 0.65 },
      { maxDim: 800, quality: 0.6 },
      { maxDim: 720, quality: 0.55 },
    ];

    let best: { blob: Blob; w: number; h: number } | null = null;
    for (const { maxDim, quality } of attempts) {
      const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * ratio));
      const h = Math.max(1, Math.round(img.naturalHeight * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const blob = await canvasToBlob(canvas, "image/jpeg", quality);
      if (!blob) continue;
      if (!best || blob.size < best.blob.size) best = { blob, w, h };
      if (blob.size <= MAX_IMAGE_BYTES) break;
    }

    if (!best) {
      if (file.size > MAX_IMAGE_BYTES) {
        return { ok: false, reason: `Cette image fait ${formatSize(file.size)}. ${IMAGE_LIMIT_MESSAGE}` } as PrepareResult;
      }
      return { ok: true, file, wasCompressed: false, originalSize, finalSize: file.size } as PrepareResult;
    }

    // If even our smallest pass is still over the cap, refuse with a clear message.
    if (best.blob.size > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        reason: `Même après compression automatique, l'image fait ${formatSize(best.blob.size)}. ${IMAGE_LIMIT_MESSAGE}`,
      } as PrepareResult;
    }

    // If original was already under cap AND smaller than our compressed version, keep original.
    if (file.size <= MAX_IMAGE_BYTES && file.size <= best.blob.size) {
      return { ok: true, file, wasCompressed: false, originalSize, finalSize: file.size } as PrepareResult;
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    const compressed = new File([best.blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
    return { ok: true, file: compressed, wasCompressed: true, originalSize, finalSize: compressed.size } as PrepareResult;
  } catch (e: any) {
    if (file.size > MAX_IMAGE_BYTES) {
      return { ok: false, reason: e?.message || `Cette image fait ${formatSize(file.size)}. ${IMAGE_LIMIT_MESSAGE}` } as PrepareResult;
    }
    return { ok: true, file, wasCompressed: false, originalSize, finalSize: file.size } as PrepareResult;
  }
}