import { serveCors } from "../_shared/http.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { isAuthorizedCron, cronUnauthorizedResponse } from "../_shared/cron-auth.ts";
import { APP_URL } from "../_shared/email-sender.ts";

// Envoyeur du canal e-mail des notifications Livraison (cahier §12).
// Planifié toutes les 2 minutes (pg_cron -> invoke_edge_function). Réserve les envois en attente
// (delivery_email_claim), les transmet à send-transactional-email (file, suppression, désinscription,
// garde dev EMAIL_MODE) puis note le résultat (delivery_email_mark).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};
const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Seuls les liens internes (chemin relatif) deviennent un bouton : jamais d'adresse externe venue d'une notification.
const absoluteLink = (link: string | null): string | undefined =>
  link && link.startsWith("/") && !link.startsWith("//") ? `${APP_URL}${link}` : undefined;

serveCors("app", async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!isAuthorizedCron(req)) return cronUnauthorizedResponse(corsHeaders);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: batch, error } = await supabase.rpc("delivery_email_claim", { _limit: 50 });
  if (error) {
    console.error("delivery_email_claim", error.message);
    return reply({ success: false, error: "Lecture de la file impossible." }, 500);
  }

  const rows = (batch || []) as Array<{
    id: string; email: string | null; kind: string; tone: string; title: string; body: string | null; link: string | null;
  }>;
  let sent = 0, skipped = 0, retried = 0, failed = 0;

  for (const r of rows) {
    const mark = (outcome: string, msg?: string) =>
      supabase.rpc("delivery_email_mark", { _id: r.id, _outcome: outcome, _error: msg ?? null });
    try {
      if (!r.email) { await mark("skipped", "aucune adresse e-mail"); skipped++; continue; }
      const { data, error: sendErr } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "delivery-notification",
          recipientEmail: r.email,
          idempotencyKey: `delivery-notif-${r.id}`,
          templateData: { title: r.title, body: r.body ?? undefined, link: absoluteLink(r.link), tone: r.tone },
        },
      });
      if (sendErr) { await mark("retry", sendErr.message); retried++; continue; }
      if (data?.reason === "email_suppressed") { await mark("skipped", "adresse désinscrite"); skipped++; continue; }
      if (data?.suppressed) { await mark("skipped", "envoi neutralisé (EMAIL_MODE)"); skipped++; continue; }
      if (data?.success === false || data?.error) { await mark("retry", String(data?.error ?? "échec d'envoi")); retried++; continue; }
      await mark("sent"); sent++;
    } catch (e) {
      await mark("retry", e instanceof Error ? e.message : "erreur inattendue");
      retried++;
    }
  }

  return reply({ success: true, claimed: rows.length, sent, skipped, retried, failed });
});
