import { supabase } from "@/integrations/supabase/client";

/** Bucket privé des fichiers vendus (migration 20261112120000). Jamais d'URL publique : lien signé côté serveur. */
export const DIGITAL_BUCKET = "digital-products";
export const DIGITAL_MAX_FILES = 10;
export const DIGITAL_MAX_BYTES = 50 * 1024 * 1024;

export interface DigitalFile {
  id: string;
  product_id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  storage_path: string;
  display_order: number;
}

export interface DownloadFile {
  id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  /** Téléchargements restants (null = illimité). */
  remaining: number | null;
}

export interface DownloadList {
  paid: boolean;
  order_number?: string;
  shop: { name: string; slug: string; primary_color: string | null; contact: string | null } | null;
  items: { product_name: string; files: DownloadFile[] }[];
}

/** Nom de fichier sûr pour un chemin de stockage (le nom d'origine reste dans file_name). */
export function safeStorageName(name: string): string {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^[._]+/, "");
  return (base || "fichier").slice(-120);
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/** Vérifie un fichier avant dépôt ; renvoie un message d'erreur ou null. */
export function validateDigitalFile(file: File, existingCount: number): string | null {
  if (existingCount >= DIGITAL_MAX_FILES) return `Dix fichiers au maximum par produit.`;
  if (file.size <= 0) return "Ce fichier est vide.";
  if (file.size > DIGITAL_MAX_BYTES) return `Fichier trop lourd (${formatFileSize(file.size)}) : 50 Mo au maximum.`;
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tables absentes des types générés de Supabase
const db = supabase as any;

export async function listDigitalFiles(productId: string): Promise<DigitalFile[]> {
  const { data, error } = await db
    .from("product_digital_files")
    .select("id, product_id, file_name, file_size, mime_type, storage_path, display_order")
    .eq("product_id", productId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message || "Impossible de lire les fichiers.");
  return (data ?? []) as DigitalFile[];
}

export async function uploadDigitalFile(shopId: string, productId: string, file: File, order: number): Promise<DigitalFile> {
  const path = `${shopId}/${productId}/${crypto.randomUUID()}-${safeStorageName(file.name)}`;
  const { error: upErr } = await supabase.storage.from(DIGITAL_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (upErr) throw new Error(upErr.message || "Dépôt du fichier impossible.");

  const { data, error } = await db
    .from("product_digital_files")
    .insert({
      product_id: productId,
      shop_id: shopId,
      storage_path: path,
      file_name: file.name.slice(0, 255),
      file_size: file.size,
      mime_type: file.type || null,
      display_order: order,
    })
    .select("id, product_id, file_name, file_size, mime_type, storage_path, display_order")
    .single();
  if (error) {
    // La ligne n'a pas pu être créée : on ne laisse pas un fichier orphelin dans le bucket.
    await supabase.storage.from(DIGITAL_BUCKET).remove([path]);
    throw new Error(error.message || "Enregistrement du fichier impossible.");
  }
  return data as DigitalFile;
}

export async function deleteDigitalFile(file: DigitalFile): Promise<void> {
  const { error } = await db.from("product_digital_files").delete().eq("id", file.id);
  if (error) throw new Error(error.message || "Suppression impossible.");
  await supabase.storage.from(DIGITAL_BUCKET).remove([file.storage_path]);
}

/** Lien signé de 5 minutes pour que le marchand vérifie son propre fichier. */
export async function previewDigitalFile(file: DigitalFile): Promise<string> {
  const { data, error } = await supabase.storage.from(DIGITAL_BUCKET).createSignedUrl(file.storage_path, 300, { download: file.file_name });
  if (error || !data?.signedUrl) throw new Error(error?.message || "Lien indisponible.");
  return data.signedUrl;
}

export async function setDownloadLimit(productId: string, limit: number | null): Promise<void> {
  const { error } = await db.from("products").update({ digital_download_limit: limit }).eq("id", productId);
  if (error) throw new Error(error.message || "Limite non enregistrée.");
}

export async function getDownloadLimit(productId: string): Promise<number | null> {
  const { data } = await db.from("products").select("digital_download_limit").eq("id", productId).maybeSingle();
  if (!data) return 5;
  return data.digital_download_limit === undefined ? 5 : data.digital_download_limit;
}

// ---------- Côté acheteur : Edge Function digital-download ----------
async function callDownload<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("digital-download", { body });
  if (error) {
    // Les codes 4xx portent un message utile dans le corps de la réponse.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ctx = (error as any).context;
    try {
      const parsed = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
      if (parsed?.error) throw new Error(parsed.error);
    } catch (e) {
      if (e instanceof Error && e.message) throw e;
    }
    throw new Error("Téléchargement indisponible pour le moment.");
  }
  if (!data?.success) throw new Error(data?.error || "Téléchargement indisponible pour le moment.");
  return data as T;
}

export async function resolveDownloadToken(paymentRef: string): Promise<{ token: string | null; paid: boolean; digital: boolean }> {
  const r = await callDownload<{ token: string | null; paid: boolean; digital: boolean }>({ action: "resolve", payment_ref: paymentRef });
  return { token: r.token ?? null, paid: r.paid === true, digital: r.digital === true };
}

/** Lien perdu : renvoie le mail à l'adresse de la commande. Réponse toujours identique (aucun indice sur la commande). */
export async function requestDownloadEmail(orderNumber: string, email: string): Promise<string> {
  const r = await callDownload<{ message?: string }>({ action: "recover", order_number: orderNumber, email });
  return r.message || "Si une commande payée correspond, un e-mail contenant le lien vient d'être envoyé.";
}

export async function listDownloads(token: string): Promise<DownloadList> {
  return callDownload<DownloadList>({ action: "list", token });
}

export async function getDownloadLink(token: string, fileId: string): Promise<{ url: string; file_name: string; remaining: number | null }> {
  return callDownload({ action: "link", token, file_id: fileId });
}
