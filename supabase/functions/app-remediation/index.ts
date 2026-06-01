import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Founder-only remediation actions. verify_jwt is false; we validate manually.

type Action =
  | "run_health_check"
  | "resolve_incident"
  | "retry_stuck_payments"
  | "release_stuck_queue"
  | "purge_translation_cache_table"
  | "test_email_alert"
  | "purge_resolved_incidents"
  | "rebuild_shop_order_stats"
  | "requeue_failed_emails"
  | "reset_email_rate_limit"
  | "clear_expired_unsubscribe_tokens"
  | "vacuum_image_cache";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Identify caller
  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return new Response(JSON.stringify({ success: false, error: "unauthenticated" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Check founder/co_founder role
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["founder", "co_founder"]);
  if (!roles || roles.length === 0) {
    return new Response(JSON.stringify({ success: false, error: "forbidden" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: { action: Action; params?: Record<string, unknown> };
  try { payload = await req.json(); }
  catch { return jsonOk({ success: false, error: "invalid_body" }); }

  const action = payload.action;
  const params = payload.params ?? {};

  try {
    switch (action) {
      case "run_health_check": {
        const r = await fetch(`${url}/functions/v1/app-health-monitor`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
          body: "{}",
        });
        const j = await r.json().catch(() => ({}));
        return jsonOk({ success: true, health: j });
      }

      case "resolve_incident": {
        const id = String(params.incident_id || "");
        const note = String(params.note || "Résolu manuellement par le fondateur");
        if (!id) return jsonOk({ success: false, error: "missing_incident_id" });
        const { error } = await admin
          .from("app_incidents")
          .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: user.id, resolution_note: note })
          .eq("id", id);
        return jsonOk({ success: !error, error: error?.message });
      }

      case "retry_stuck_payments": {
        // Mark payments stuck > 1h as failed so the user can retry; no money movement
        const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data, error } = await admin
          .from("payments")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("status", "pending")
          .lt("created_at", cutoff)
          .select("id");
        return jsonOk({ success: !error, updated: data?.length ?? 0, error: error?.message });
      }

      case "release_stuck_queue": {
        // Reset generation_queue items stuck in processing > 15min back to pending
        const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const { data, error } = await admin
          .from("generation_queue")
          .update({ status: "pending", started_at: null })
          .eq("status", "processing")
          .lt("started_at", cutoff)
          .select("id");
        return jsonOk({ success: !error, released: data?.length ?? 0, error: error?.message });
      }

      case "purge_translation_cache_table": {
        // Optional cache table; skip cleanly if absent
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { error } = await admin.from("image_cache").delete().lt("last_accessed_at", cutoff);
        return jsonOk({ success: !error, error: error?.message });
      }

      case "test_email_alert": {
        const { error } = await admin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "app-incident-alert",
            recipientEmail: user.email,
            idempotencyKey: `test-alert-${Date.now()}`,
            templateData: {
              incidents: [{
                title: "Test d'alerte santé application",
                category: "test",
                severity: "info",
                description: "Ceci est un email de test envoyé depuis le centre de dépannage.",
              }],
              dashboardUrl: "https://visuelpro.cloud/founder-troubleshooting",
              detectedAt: new Date().toISOString(),
            },
          },
        });
        return jsonOk({ success: !error, error: error?.message });
      }

      case "purge_resolved_incidents": {
        // Delete incidents resolved more than 30 days ago to keep the table lean
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await admin
          .from("app_incidents")
          .delete()
          .eq("status", "resolved")
          .lt("resolved_at", cutoff)
          .select("id");
        return jsonOk({ success: !error, deleted: data?.length ?? 0, error: error?.message });
      }

      case "rebuild_shop_order_stats": {
        // Recompute total_orders on shops from the orders table (best-effort)
        const { data: agg, error: aggErr } = await admin
          .from("orders")
          .select("shop_id");
        if (aggErr) return jsonOk({ success: false, error: aggErr.message });
        const counts = new Map<string, number>();
        for (const row of agg ?? []) {
          const sid = (row as any).shop_id as string | null;
          if (!sid) continue;
          counts.set(sid, (counts.get(sid) ?? 0) + 1);
        }
        let updated = 0;
        for (const [shop_id, total_orders] of counts) {
          const { error } = await admin.from("shops").update({ total_orders }).eq("id", shop_id);
          if (!error) updated++;
        }
        return jsonOk({ success: true, updated });
      }

      case "requeue_failed_emails": {
        // Move recently failed (last 24h) email log entries back to pending so the queue retries them
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await admin
          .from("email_send_log")
          .update({ status: "pending", retry_count: 0, next_retry_at: new Date().toISOString() })
          .in("status", ["failed", "dlq"])
          .gte("created_at", cutoff)
          .select("id");
        return jsonOk({ success: !error, requeued: data?.length ?? 0, error: error?.message });
      }

      case "reset_email_rate_limit": {
        // Clear any rate-limit hold so the dispatcher resumes immediately
        const { error } = await admin
          .from("email_send_state")
          .update({ rate_limit_until: null, last_rate_limit_seconds: null, updated_at: new Date().toISOString() })
          .eq("id", 1);
        return jsonOk({ success: !error, error: error?.message });
      }

      case "clear_expired_unsubscribe_tokens": {
        // Best-effort: token table is small; purge entries older than 1 year
        const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await admin
          .from("email_unsubscribe_tokens")
          .delete()
          .lt("created_at", cutoff)
          .select("id");
        return jsonOk({ success: !error, deleted: data?.length ?? 0, error: error?.message });
      }

      case "vacuum_image_cache": {
        // Delete cache entries not accessed in 60 days
        const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await admin
          .from("image_cache")
          .delete()
          .lt("last_accessed_at", cutoff)
          .select("id");
        return jsonOk({ success: !error, deleted: data?.length ?? 0, error: error?.message });
      }

      default:
        return jsonOk({ success: false, error: "unknown_action" });
    }
  } catch (e) {
    return jsonOk({ success: false, error: String(e) });
  }
});

function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}