import { prepareImageForUpload } from "@/lib/imageCompress";

/**
 * Reads a user selected image or video file from computer/mobile.
 * Uses FileReader to generate durable Data URLs (data:video/...) that survive F5 page reloads.
 */
export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type.startsWith("image/")) {
      // Compress image to max 800px & 0.75 quality for super fast storage & loading
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
      // For videos and other files, convert to data URL so it remains visible after refresh
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => {
        try {
          resolve(URL.createObjectURL(file));
        } catch (e) {
          reject(e);
        }
      };
      reader.readAsDataURL(file);
    }
  });
}

/**
 * Safely saves data to localStorage handling QuotaExceededError automatically while preserving video_url and media_urls
 */
export function safeLocalStorageSet(key: string, value: any): boolean {
  try {
    const jsonString = typeof value === "string" ? value : JSON.stringify(value);
    localStorage.setItem(key, jsonString);
    return true;
  } catch (error: any) {
    console.warn(`safeLocalStorageSet quota reached for key "${key}". Applying safe preservation...`, error);
    try {
      if (Array.isArray(value)) {
        // Keep posts intact with video_url preserved
        let pruned = value.slice(0, 25);
        try {
          localStorage.setItem(key, JSON.stringify(pruned));
          return true;
        } catch (e2) {
          let minimal = value.slice(0, 10);
          localStorage.setItem(key, JSON.stringify(minimal));
          return true;
        }
      } else {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      }
    } catch (e3) {
      console.warn("Failed to set localStorage:", e3);
    }
    return false;
  }
}
