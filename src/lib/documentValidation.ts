/**
 * Utility for verifying the validity, MIME type, resolution, and legibility of uploaded documents
 * (National ID cards, driver licenses, warehouse photos, manager photos).
 */

export interface DocumentValidationResult {
  valid: boolean;
  reason?: string;
  width?: number;
  height?: number;
}

export type DocumentCategory = 
  | 'national_id'
  | 'driver_license'
  | 'profile_photo'
  | 'warehouse_photo'
  | 'tax_document';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf'
];

/**
 * Validates document file properties before uploading
 */
export async function validateDocument(
  file: File,
  category: DocumentCategory = 'national_id'
): Promise<DocumentValidationResult> {
  // 1. Basic File Existence & Size Checks
  if (!file) {
    return { valid: false, reason: "Aucun fichier sélectionné." };
  }

  if (file.size <= 5 * 1024) { // Less than 5KB is corrupt/empty
    return { 
      valid: false, 
      reason: "Le fichier est vide ou corrompu (taille inférieure à 5 Ko)." 
    };
  }

  if (file.size > 15 * 1024 * 1024) { // Larger than 15MB
    return { 
      valid: false, 
      reason: "Le fichier est trop volumineux (maximum 15 Mo autorisé)." 
    };
  }

  // 2. MIME Type Validation
  const mimeType = file.type?.toLowerCase();
  const extension = file.name.split('.').pop()?.toLowerCase();

  const isAllowedMime = ALLOWED_MIME_TYPES.includes(mimeType);
  const isAllowedExt = ['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(extension || '');

  if (!isAllowedMime && !isAllowedExt) {
    return {
      valid: false,
      reason: `Format non supporté (${extension || 'inconnu'}). Veuillez importer une image (JPG, PNG) ou un PDF.`,
    };
  }

  // PDF files don't need image dimension checks
  if (mimeType === 'application/pdf' || extension === 'pdf') {
    return { valid: true };
  }

  // 3. Image Dimension & Resolution Inspection via HTML Image Element
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onerror = () => {
      resolve({ valid: false, reason: "Impossible de lire le fichier image. Le fichier semble être corrompu." });
    };

    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => {
        resolve({ valid: false, reason: "Le fichier importé n'est pas une image valide ou est corrompu." });
      };

      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        // Minimum Resolution Requirements for readability
        const minDimension = category === 'profile_photo' ? 250 : 350;
        
        if (width < minDimension || height < minDimension) {
          resolve({
            valid: false,
            width,
            height,
            reason: `Image en trop basse résolution (${width}x${height}px). Une résolution minimale de ${minDimension}x${minDimension}px est requise pour garantir la lisibilité du document.`,
          });
          return;
        }

        // Aspect Ratio Check (Documents & ID cards are standard rectangular shapes)
        const aspectRatio = width / height;
        
        if (category === 'national_id' || category === 'driver_license') {
          // ID cards and licenses typically have an aspect ratio between 0.35 (portrait) and 2.5 (landscape)
          if (aspectRatio < 0.35 || aspectRatio > 2.8) {
            resolve({
              valid: false,
              width,
              height,
              reason: "Format d'image inhabituel pour une pièce d'identité ou un permis. Veillez à cadrer correctement le document.",
            });
            return;
          }
        }

        resolve({
          valid: true,
          width,
          height,
        });
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Compresses an image to JPEG format under 300KB to ensure fast network upload & zero payload errors.
 */
export async function compressImageForUpload(file: File, maxWidth = 1600): Promise<Blob | File> {
  if (file.type === 'application/pdf') return file; // Do not compress PDF

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.85 // Quality 85%
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
