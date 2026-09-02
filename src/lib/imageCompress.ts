// Image compression / size-guard used by all product/shop/rich-text image
// uploads. Heavy phone photos are the #1 cause of slow / broken shops. We
// use browser-image-compression to target < 2 Mo before upload.

import imageCompression from 'browser-image-compression';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 Mo final cap
export const IMAGE_LIMIT_MESSAGE = "Ecomfy n'accepte que les images de moins de 2 Mo. Compressez votre image puis réessayez.";

export const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} Ko`
    : `${(bytes / 1024 / 1024).toFixed(2)} Mo`;

export type PrepareResult =
  | { ok: true; file: File; wasCompressed: boolean; originalSize: number; finalSize: number; reason?: undefined }
  | { ok: false; reason: string; file?: undefined; wasCompressed?: undefined; originalSize?: undefined; finalSize?: undefined };

export async function prepareImageForUpload(file: File): Promise<PrepareResult> {
  const originalSize = file.size;
  if (!file.type.startsWith("image/")) {
    return { ok: false, reason: "Format non supporté. Importez une image JPG, PNG, WEBP ou GIF." } as PrepareResult;
  }

  // Animated GIFs lose animation if re-encoded via typical compression.
  if (file.type === "image/gif") {
    if (file.size > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        reason: `Ce GIF fait ${formatSize(file.size)}. Les GIFs doivent faire moins de 2 Mo.`,
      } as PrepareResult;
    }
    return { ok: true, file, wasCompressed: false, originalSize, finalSize: file.size } as PrepareResult;
  }

  // Small enough: no need to recompress.
  if (file.size <= MAX_IMAGE_BYTES) {
    return { ok: true, file, wasCompressed: false, originalSize, finalSize: file.size } as PrepareResult;
  }

  try {
    const options = {
      maxSizeMB: 1.9, // Targeting strictly under 2 Mo
      maxWidthOrHeight: 1600,
      useWebWorker: true,
      initialQuality: 0.85
    };

    const compressedBlob = await imageCompression(file, options);
    
    if (compressedBlob.size > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        reason: `Même après compression automatique, l'image fait ${formatSize(compressedBlob.size)}. ${IMAGE_LIMIT_MESSAGE}`,
      } as PrepareResult;
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    const ext = compressedBlob.type === "image/webp" ? "webp" : compressedBlob.type === "image/png" ? "png" : "jpg";
    const compressed = new File([compressedBlob], `${baseName}.${ext}`, { type: compressedBlob.type, lastModified: Date.now() });

    return { ok: true, file: compressed, wasCompressed: true, originalSize, finalSize: compressed.size } as PrepareResult;
  } catch (e: any) {
    return { ok: false, reason: e?.message || `Erreur lors de la compression de l'image. ${IMAGE_LIMIT_MESSAGE}` } as PrepareResult;
  }
}