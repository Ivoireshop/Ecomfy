import { prepareImageForUpload } from "@/lib/imageCompress";

/**
 * Reads a user selected file from computer/mobile and returns a compressed data URL
 */
export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type.startsWith("image/")) {
      // Compress image aggressively to max 800px & 0.75 quality to prevent localStorage quota errors
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
        // 1. Keep only top 15 most recent items
        let pruned = value.slice(0, 15).map((item: any) => {
          if (item && item.media_urls && Array.isArray(item.media_urls)) {
            // Keep first media item if heavy
            return {
              ...item,
              media_urls: item.media_urls.slice(0, 1),
            };
          }
          return item;
        });

        try {
          localStorage.setItem(key, JSON.stringify(pruned));
          return true;
        } catch (e2) {
          // 2. Fallback: keep top 5 posts text only
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
