// Shared authorization for internal cron/batch edge functions.
// Accepts only (exact, constant-time comparison; no JWT payload is ever trusted):
//   - Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY> (what pg_cron uses)
//   - Header x-cron-secret matching env CRON_SECRET (fallback for external schedulers)

// Constant-time string comparison (no early exit on the first differing byte).
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const len = Math.max(x.length, y.length);
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export function isAuthorizedCron(req: Request): boolean {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (token && service && safeEqual(token, service)) return true;

  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  const provided = req.headers.get("x-cron-secret") || "";
  if (cronSecret && provided && safeEqual(provided, cronSecret)) return true;
  return false;
}

export function cronUnauthorizedResponse(corsHeaders: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({ success: false, error: "Unauthorized" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
