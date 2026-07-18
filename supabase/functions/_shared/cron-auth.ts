// Shared authorization for internal cron/batch edge functions.
// Accepts:
//   - Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY> (what pg_cron uses)
//   - Any JWT whose payload role === "service_role"
//   - Header x-cron-secret matching env CRON_SECRET (fallback for external schedulers)
export function isAuthorizedCron(req: Request): boolean {
  const auth = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (token && service && token === service) return true;
  if (token) {
    try {
      const part = token.split(".")[1] || "";
      const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
      const pad = b64.length % 4 ? b64 + "=".repeat(4 - (b64.length % 4)) : b64;
      const payload = JSON.parse(atob(pad));
      if (payload?.role === "service_role") return true;
    } catch { /* ignore */ }
  }
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  const provided = req.headers.get("x-cron-secret") || "";
  if (cronSecret && provided && provided === cronSecret) return true;
  return false;
}

export function cronUnauthorizedResponse(corsHeaders: Record<string, string> = {}): Response {
  return new Response(
    JSON.stringify({ success: false, error: "Unauthorized" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}