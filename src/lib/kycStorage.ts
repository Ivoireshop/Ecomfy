import { supabase } from "@/integrations/supabase/client";

// Pièces d'identité KYC (audit H1) : bucket privé, jamais d'URL publique.
// merchant_kyc.document_front_url / document_back_url / selfie_url contiennent le CHEMIN dans le bucket
// (<user_id>/<fichier>) ; l'affichage passe par des liens signés de courte durée.

export const KYC_BUCKET = "kyc-documents";
export const KYC_SIGNED_URL_TTL_SECONDS = 300;

export type KycDocField = "front" | "back" | "selfie";

const EXT_BY_MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Ancien dossier : l'URL publique du bucket shop-images, à renvoyer par le marchand. */
export const isLegacyKycValue = (value?: string | null): boolean => !!value && /^https?:\/\//i.test(value);

/** Dépose une pièce dans le dossier du marchand et renvoie son chemin (à enregistrer dans merchant_kyc). */
export async function uploadKycFile(field: KycDocField, file: Blob): Promise<string> {
  const ext = EXT_BY_MIME[file.type];
  if (!ext) throw new Error("Format non accepté. Importez une image JPG, PNG ou WEBP.");

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Non connecté");

  const path = `${session.user.id}/${field}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(KYC_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

/** Liens signés pour une liste de chemins ; null pour une valeur vide, héritée (URL) ou illisible. */
export async function getKycSignedUrls(values: (string | null | undefined)[]): Promise<(string | null)[]> {
  const paths = Array.from(new Set(values.filter((v): v is string => !!v && !isLegacyKycValue(v))));
  if (paths.length === 0) return values.map(() => null);

  const { data, error } = await supabase.storage.from(KYC_BUCKET).createSignedUrls(paths, KYC_SIGNED_URL_TTL_SECONDS);
  if (error || !data) return values.map(() => null);

  const byPath = new Map(data.map((d) => [d.path, d.signedUrl] as const));
  return values.map((v) => (v ? byPath.get(v) ?? null : null));
}
