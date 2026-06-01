import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Public health monitor. Runs every 5 minutes via pg_cron.
// - Probes critical surfaces of the app
// - Records incidents (dedupe per check)
// - Sends one consolidated email to the founder when new incidents appear
// - Auto-resolves checks that recover

const FOUNDER_EMAILS = ["djateulrich@gmail.com", "regnis13@gmail.com"];
const APP_BASE = "https://visuelpro.cloud";

type Probe = {
  key: string;            // dedupe key
  category: string;
  title: string;
  ok: boolean;
  severity?: "info" | "warning" | "critical";
  description?: string;
  metadata?: Record<string, unknown>;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const probes: Probe[] = [];
  const startedAt = Date.now();

  // 1) Database reachable + critical reads
  try {
    const { error } = await admin.from("shops").select("id", { count: "exact", head: true }).limit(1);
    probes.push({
      key: "db.shops.read",
      category: "database",
      title: "Lecture table boutiques",
      ok: !error,
      severity: "critical",
      description: error?.message,
    });
  } catch (e) {
    probes.push({ key: "db.shops.read", category: "database", title: "Lecture table boutiques", ok: false, severity: "critical", description: String(e) });
  }

  // 2) Auth API reachable
  try {
    const r = await fetch(`${url}/auth/v1/health`, { headers: { apikey: serviceKey } });
    probes.push({
      key: "auth.health",
      category: "auth",
      title: "Service d'authentification",
      ok: r.ok,
      severity: "critical",
      description: r.ok ? undefined : `HTTP ${r.status}`,
    });
  } catch (e) {
    probes.push({ key: "auth.health", category: "auth", title: "Service d'authentification", ok: false, severity: "critical", description: String(e) });
  }

  // 3) Front-end public site reachable
  try {
    const r = await fetch(APP_BASE, { method: "HEAD", redirect: "follow" });
    probes.push({
      key: "frontend.public",
      category: "frontend",
      title: "Site public visuelpro.cloud",
      ok: r.ok || r.status === 304,
      severity: "critical",
      description: r.ok ? undefined : `HTTP ${r.status}`,
    });
  } catch (e) {
    probes.push({ key: "frontend.public", category: "frontend", title: "Site public visuelpro.cloud", ok: false, severity: "critical", description: String(e) });
  }

  // 4) Payments flow — no completed payments in 24h while pending exists
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [{ count: completed }, { count: pending }] = await Promise.all([
      admin.from("payments").select("id", { count: "exact", head: true }).eq("status", "completed").gte("created_at", since),
      admin.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending").gte("created_at", since),
    ]);
    const stuck = (pending ?? 0) >= 3 && (completed ?? 0) === 0;
    probes.push({
      key: "payments.flow.24h",
      category: "payments",
      title: "Flux de paiements bloqué",
      ok: !stuck,
      severity: "critical",
      description: stuck ? `${pending} paiements en attente, 0 complétés sur 24h.` : undefined,
      metadata: { completed_24h: completed, pending_24h: pending },
    });
  } catch (e) {
    probes.push({ key: "payments.flow.24h", category: "payments", title: "Flux de paiements bloqué", ok: false, severity: "warning", description: String(e) });
  }

  // 5) Orders flow — published activated shops with 0 orders in 48h
  try {
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const { count: recentOrders } = await admin.from("orders").select("id", { count: "exact", head: true }).gte("created_at", since);
    const { count: activeShops } = await admin.from("shops").select("id", { count: "exact", head: true }).eq("is_published", true).eq("is_activated", true);
    const noOrders = (activeShops ?? 0) >= 3 && (recentOrders ?? 0) === 0;
    probes.push({
      key: "orders.flow.48h",
      category: "commerce",
      title: "Aucune commande sur 48h",
      ok: !noOrders,
      severity: "warning",
      description: noOrders ? `${activeShops} boutiques actives, 0 commandes reçues sur 48h.` : undefined,
      metadata: { active_shops: activeShops, orders_48h: recentOrders },
    });
  } catch (e) {
    probes.push({ key: "orders.flow.48h", category: "commerce", title: "Aucune commande sur 48h", ok: false, severity: "info", description: String(e) });
  }

  // 6) Email queue — DLQ growing
  try {
    const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
    const { count: dlq } = await admin.from("email_send_log").select("id", { count: "exact", head: true }).eq("status", "dlq").gte("created_at", since);
    probes.push({
      key: "email.dlq.6h",
      category: "email",
      title: "Emails en échec (dead-letter)",
      ok: (dlq ?? 0) < 5,
      severity: "warning",
      description: (dlq ?? 0) >= 5 ? `${dlq} emails ont échoué après plusieurs tentatives sur 6h.` : undefined,
      metadata: { dlq_count_6h: dlq },
    });
  } catch {
    // email_send_log may not exist in older envs; skip silently
  }

  // 7) Cloudinary / generated content storage health (best-effort)
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: failedGen } = await admin.from("generation_queue").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since);
    probes.push({
      key: "generation.failures.24h",
      category: "generation",
      title: "Taux d'échec génération média",
      ok: (failedGen ?? 0) < 20,
      severity: "warning",
      description: (failedGen ?? 0) >= 20 ? `${failedGen} générations échouées sur 24h.` : undefined,
      metadata: { failed_24h: failedGen },
    });
  } catch { /* table optional */ }

  // 8) Sites vitrines (showcase) reachable
  try {
    const { error } = await admin.from("showcase_sites").select("id", { count: "exact", head: true }).limit(1);
    probes.push({
      key: "db.showcase.read",
      category: "showcase",
      title: "Lecture sites vitrines",
      ok: !error,
      severity: "critical",
      description: error?.message,
    });
  } catch (e) {
    probes.push({ key: "db.showcase.read", category: "showcase", title: "Lecture sites vitrines", ok: false, severity: "critical", description: String(e) });
  }

  // 9) Formations en ligne (courses) reachable + inscriptions actives
  try {
    const { error: cErr, count: courses } = await admin.from("courses").select("id", { count: "exact", head: true });
    probes.push({
      key: "db.courses.read",
      category: "courses",
      title: "Lecture formations en ligne",
      ok: !cErr,
      severity: "critical",
      description: cErr?.message,
      metadata: { total_courses: courses },
    });
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { count: enrollments } = await admin.from("enrollments").select("id", { count: "exact", head: true }).gte("created_at", since);
    probes.push({
      key: "courses.enrollments.7d",
      category: "courses",
      title: "Inscriptions formations (7j)",
      ok: true, // informational only
      severity: "info",
      metadata: { enrollments_7d: enrollments },
    });
  } catch (e) {
    probes.push({ key: "db.courses.read", category: "courses", title: "Lecture formations en ligne", ok: false, severity: "warning", description: String(e) });
  }

  // 10) Visuels publicitaires (image generation)
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: images24h } = await admin.from("generated_images").select("id", { count: "exact", head: true }).gte("created_at", since);
    probes.push({
      key: "generation.images.24h",
      category: "visuals",
      title: "Génération de visuels (24h)",
      ok: true,
      severity: "info",
      metadata: { images_24h: images24h },
    });
  } catch (e) {
    probes.push({ key: "generation.images.24h", category: "visuals", title: "Génération de visuels (24h)", ok: false, severity: "info", description: String(e) });
  }

  // 11) Vidéos publicitaires
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { count: videos7d } = await admin.from("generated_videos").select("id", { count: "exact", head: true }).gte("created_at", since);
    probes.push({
      key: "generation.videos.7d",
      category: "videos",
      title: "Génération de vidéos (7j)",
      ok: true,
      severity: "info",
      metadata: { videos_7d: videos7d },
    });
  } catch (e) {
    probes.push({ key: "generation.videos.7d", category: "videos", title: "Génération de vidéos (7j)", ok: false, severity: "info", description: String(e) });
  }

  // 12) Comptes publicitaires connectés (Meta token expiry monitoring)
  try {
    const soon = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const { count: expiring } = await admin
      .from("ad_accounts")
      .select("id", { count: "exact", head: true })
      .not("token_expires_at", "is", null)
      .lt("token_expires_at", soon);
    probes.push({
      key: "ads.tokens.expiring",
      category: "ads",
      title: "Tokens publicitaires expirant <7j",
      ok: (expiring ?? 0) === 0,
      severity: "warning",
      description: (expiring ?? 0) > 0 ? `${expiring} compte(s) publicitaire(s) avec un token qui expire bientôt.` : undefined,
      metadata: { expiring_count: expiring },
    });
  } catch { /* optional */ }

  // Persist incidents (record failures, resolve recoveries)
  const newIncidents: Array<{ title: string; category: string; severity: string; description?: string; occurrence_count?: number }> = [];

  for (const p of probes) {
    if (!p.ok) {
      const sev = p.severity || "warning";
      const { data: row } = await admin.rpc("record_app_incident", {
        _dedupe_key: p.key,
        _category: p.category,
        _severity: sev,
        _title: p.title,
        _description: p.description ?? null,
        _metadata: p.metadata ?? {},
      });
      const r = Array.isArray(row) ? row[0] : row;
      // Only notify on the very first occurrence (occurrence_count === 1 and notified_at is null)
      if (r && !r.notified_at && r.occurrence_count === 1) {
        newIncidents.push({
          title: r.title,
          category: r.category,
          severity: r.severity,
          description: r.description ?? p.description,
          occurrence_count: r.occurrence_count,
        });
      }
    } else {
      // Auto-resolve any open incident matching this dedupe_key
      await admin
        .from("app_incidents")
        .update({ status: "resolved", resolved_at: new Date().toISOString(), resolution_note: "Auto-résolu : la vérification est repassée au vert." })
        .eq("dedupe_key", p.key)
        .neq("status", "resolved");
    }
  }

  // Send one consolidated alert if new incidents appeared
  let emailed = 0;
  if (newIncidents.length > 0) {
    for (const to of FOUNDER_EMAILS) {
      try {
        const { error } = await admin.functions.invoke("send-transactional-email", {
          body: {
            templateName: "app-incident-alert",
            recipientEmail: to,
            idempotencyKey: `app-incident-${Date.now()}-${to}`,
            templateData: {
              incidents: newIncidents,
              dashboardUrl: `${APP_BASE}/founder-troubleshooting`,
              detectedAt: new Date().toISOString(),
            },
          },
        });
        if (!error) emailed++;
      } catch (e) {
        console.error("alert email failed", to, e);
      }
    }
    // mark notified
    const keys = probes.filter((p) => !p.ok).map((p) => p.key);
    if (keys.length > 0) {
      await admin.from("app_incidents").update({ notified_at: new Date().toISOString() }).in("dedupe_key", keys).is("notified_at", null);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      duration_ms: Date.now() - startedAt,
      probes: probes.map(({ key, ok, severity }) => ({ key, ok, severity })),
      new_incidents: newIncidents.length,
      emailed,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});