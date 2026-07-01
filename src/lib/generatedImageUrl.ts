import { supabase } from "@/integrations/supabase/client";

/**
 * Extract the storage object path from a `generated-images` bucket URL
 * (works for both public and signed URLs).
 */
export function extractGeneratedImagePath(url: string): string | null {
  if (!url) return null;
  const m = url.match(/\/generated-images\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Return a fresh signed URL for a `generated-images` object. If the input
 * URL does not belong to that bucket (e.g. external CDN), it is returned as-is.
 */
export async function signGeneratedImageUrl(
  url: string,
  expiresIn = 60 * 60 * 24 * 7,
): Promise<string> {
  const path = extractGeneratedImagePath(url);
  if (!path) return url;
  const { data } = await supabase.storage
    .from("generated-images")
    .createSignedUrl(path, expiresIn);
  return data?.signedUrl || url;
}

/** Create a signed URL directly from a storage path. */
export async function signGeneratedImagePath(
  path: string,
  expiresIn = 60 * 60 * 24 * 365,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from("generated-images")
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) throw error ?? new Error("signed url failed");
  return data.signedUrl;
}