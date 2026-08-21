import { prepareImageForUpload } from "@/lib/imageCompress";

/**
 * Reads a user selected image or video file from computer/mobile.
 * For videos, uses URL.createObjectURL(file) to support videos of any length (50s, 1m50s, 5m+) instantly without memory freezes.
 */
export async function readFileAsDataUrl(file: File): Promise<string> {
  // If it's a video file, create an instant object URL (blob:) to handle long videos (up to 1m50s+)
  if (file.type.startsWith("video/")) {
    try {
      return URL.createObjectURL(file);
    } catch (e) {
      // Fallback if Blob URL creation fails
    }
  }

  return new Promise((resolve, reject) => {
    if (file.type.startsWith("image/")) {
      // Compress image to max 800px & 0.75 quality
      prepareImageForUpload(file, 800, 0.75)
        .then((compressedFile) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(compressedFile);
        })
        .catch(() => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
    } else {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }
  });
}

/**
 * Safely saves data to localStorage handling QuotaExceededError automatically
 */
export function safeLocalStorageSet(key: string, value: any): boolean {
  try {
    const jsonString = typeof value === "string" ? value : JSON.stringify(value);
    localStorage.setItem(key, jsonString);
    return true;
  } catch (error: any) {
    console.warn(`safeLocalStorageSet quota reached for key "${key}". Applying auto-cleanup...`, error);
    try {
      if (Array.isArray(value)) {
        // Prune blob URLs / heavy media before storing to prevent quota crashes
        let pruned = value.slice(0, 15).map((item: any) => {
          const isBlobVideo = item?.video_url?.startsWith("blob:");
          return {
            ...item,
            video_url: isBlobVideo ? null : item.video_url,
            media_urls: (item.media_urls || []).slice(0, 1),
          };
        });

        try {
          localStorage.setItem(key, JSON.stringify(pruned));
          return true;
        } catch (e2) {
          let minimal = value.slice(0, 5).map((item: any) => ({
            ...item,
            media_urls: [],
            video_url: null,
          }));
          localStorage.setItem(key, JSON.stringify(minimal));
          return true;
        }
      }
    } catch (e3) {
      console.warn("Failed to set localStorage even after cleanup:", e3);
    }
    return false;
  }
}
