import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Limitation de débit partagée par les fonctions IA publiques (H9).
 * S'appuie sur la RPC `check_rate_limit` (table `rate_limit_hits`), donc commune à toutes
 * les instances, contrairement à un compteur en mémoire.
 */

/**
 * Adresse IP du client. Seul `cf-connecting-ip` est posé par l'infrastructure ; le premier
 * élément de `x-forwarded-for` est choisi par le client et ne doit pas servir de clé.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/**
 * Consomme un jeton dans le seau `bucket` pour `key`.
 * Renvoie `false` si la limite est atteinte **ou si la vérification échoue** : ces
 * endpoints coûtent de l'argent à chaque appel, une panne de la base ne doit pas les ouvrir.
 */
export async function takeRateLimit(
  bucket: string,
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await admin.rpc("check_rate_limit", {
      _bucket: bucket,
      _key: key,
      _max: max,
      _window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[rate-limit] RPC error", bucket, error);
      return false;
    }
    return (data as { allowed?: boolean } | null)?.allowed === true;
  } catch (e) {
    console.error("[rate-limit] exception", bucket, e);
    return false;
  }
}
