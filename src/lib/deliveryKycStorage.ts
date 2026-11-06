import { supabase } from "@/integrations/supabase/client";
import { compressImageForUpload, validateDocument, type DocumentCategory } from "@/lib/documentValidation";

// Pièces KYC / KYB de Ecomfy Livraison : bucket PRIVÉ « delivery-kyc », jamais d'URL publique.
// Les colonnes (manager_id_photo_url, license_photo_url…) contiennent le CHEMIN <id utilisateur>/<fichier> ;
// l'affichage passe par des liens signés de courte durée (propriétaire du dossier ou administrateur).

export const DELIVERY_KYC_BUCKET = "delivery-kyc";
export const DELIVERY_KYC_SIGNED_URL_TTL_SECONDS = 300;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export type DeliveryDocField =
  | "manager_id"
  | "manager_selfie"
  | "manager_photo"
  | "warehouse"
  | "tax_document"
  | "trade_register"
  | "driver_id"
  | "driver_license"
  | "driver_selfie"
  | "driver_photo";

/**
 * Contrôle le fichier (type, taille, résolution), le compresse puis le dépose dans le dossier de l'utilisateur.
 * Renvoie le chemin à enregistrer en base. Lève une erreur au message lisible en cas de refus.
 */
export async function uploadDeliveryDoc(
  field: DeliveryDocField,
  file: File | Blob,
  category: DocumentCategory = "national_id",
): Promise<string> {
  const named = file instanceof File ? file : new File([file], `${field}.jpg`, { type: file.type || "image/jpeg" });

  const check = await validateDocument(named, category);
  if (!check.valid) throw new Error(check.reason || "Document non conforme.");

  const prepared = await compressImageForUpload(named);
  const ext = EXT_BY_MIME[prepared.type];
  if (!ext) throw new Error("Format non accepté. Importez une image JPG, PNG, WEBP ou un PDF.");

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Session expirée : reconnectez-vous.");

  const path = `${session.user.id}/${field}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from(DELIVERY_KYC_BUCKET)
    .upload(path, prepared, { contentType: prepared.type, upsert: false });
  if (error) throw new Error(`Envoi du document impossible : ${error.message}`);
  return path;
}

/** Liens signés pour une liste de chemins ; null pour une valeur vide ou illisible. */
export async function getDeliveryDocUrls(values: (string | null | undefined)[]): Promise<(string | null)[]> {
  const paths = Array.from(new Set(values.filter((v): v is string => !!v)));
  if (paths.length === 0) return values.map(() => null);

  const { data, error } = await supabase.storage
    .from(DELIVERY_KYC_BUCKET)
    .createSignedUrls(paths, DELIVERY_KYC_SIGNED_URL_TTL_SECONDS);
  if (error || !data) return values.map(() => null);

  const byPath = new Map(data.map((d) => [d.path, d.signedUrl] as const));
  return values.map((v) => (v ? byPath.get(v) ?? null : null));
}

export const isPdfPath = (path?: string | null): boolean => !!path && path.toLowerCase().endsWith(".pdf");
