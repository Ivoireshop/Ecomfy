// Vérification de signature des webhooks GeniusPay (même schéma que geniuspay-webhook).
// Signature : HMAC-SHA256(secret, `${timestamp}.${corps brut}`) en hexadécimal, en-têtes
// X-Webhook-Signature et X-Webhook-Timestamp (secondes Unix). Aucune dépendance Deno : testable sous Node.

export type SignatureCheck =
  | { ok: true }
  | { ok: false; reason: "missing_headers" | "timestamp_out_of_range" | "invalid_signature" };

export async function computeSignature(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyWebhookSignature(opts: {
  secret: string;
  rawBody: string;
  signature: string;
  timestamp: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): Promise<SignatureCheck> {
  const { secret, rawBody, signature, timestamp } = opts;
  const now = opts.nowSeconds ?? Date.now() / 1000;
  const tolerance = opts.toleranceSeconds ?? 300;

  if (!signature || !timestamp) return { ok: false, reason: "missing_headers" };

  if (!/^\d{1,12}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > tolerance) {
    return { ok: false, reason: "timestamp_out_of_range" };
  }

  const expected = await computeSignature(secret, `${timestamp}.${rawBody}`);
  if (!timingSafeEqual(expected, signature.toLowerCase())) {
    return { ok: false, reason: "invalid_signature" };
  }
  return { ok: true };
}
