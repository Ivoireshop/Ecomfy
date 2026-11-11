import { serveCors } from "../_shared/http.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { APP_URL, guardEmail } from "../_shared/email-sender.ts";
import { escapeHtml } from "../_shared/email-safety.ts";

// Décision d'un administrateur sur un dossier de livraison (structure ou livreur).
//
// La décision elle-même est prise par les RPC `admin_decide_delivery_company` / `admin_decide_delivery_driver`, appelées
// avec le JWT de l'administrateur : la base vérifie le rôle, applique les règles (permis ↔ véhicule, pièces
// non expirées…), écrit le journal d'audit au nom de l'administrateur et crée la notification du candidat.
// Cette fonction ne fait que relayer l'appel puis envoyer l'e-mail de décision (secours hors application).
// Le destinataire est toujours relu en base (propriétaire de la structure), jamais fourni par l'appelant.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CompanyDecision = "approved" | "rejected" | "action_required" | "suspended";
type DriverDecision = "approved" | "rejected" | "suspended";

interface Payload {
  companyId?: string;
  driverId?: string;
  decision: CompanyDecision;
  reasonCode?: string;
  reason?: string;
  /** Message affiché au candidat pour un complément demandé. */
  message?: string;
  /** Note interne (jamais visible du candidat). */
  note?: string;
  /** Approuver aussi les livreurs en attente dont le permis est conforme. */
  cascadeDrivers?: boolean;
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const str = (v: unknown, max: number): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

// Erreurs de la base → statuts HTTP. Les messages de la base sont les nôtres (français, sans donnée sensible).
function mapDbError(error: { code?: string; message?: string }): Response {
  const message = error.message || "Opération refusée.";
  switch (error.code) {
    case "42501":
      return json(403, { error: message });
    case "P0002":
      return json(404, { error: message });
    case "22023":
    case "23514":
      return json(422, { error: message });
    case "23505":
      return json(409, { error: message });
    default:
      console.error("[verify-delivery-identity] RPC error:", error);
      return json(500, { error: "Décision impossible pour le moment." });
  }
}

function layout(opts: {
  badge: string;
  badgeBg: string;
  badgeFg: string;
  title: string;
  paragraphs: string[];
  boxTitle?: string;
  boxText?: string;
  boxBg?: string;
  boxBorder?: string;
  boxFg?: string;
  cta: { label: string; url: string; color: string };
}) {
  const paragraphs = opts.paragraphs
    .map((p) => `<p style="color:#cbd5e1;font-size:15px;line-height:1.6;">${p}</p>`)
    .join("");
  const box = opts.boxText
    ? `<div style="background-color:${opts.boxBg};border-left:4px solid ${opts.boxBorder};padding:16px;border-radius:8px;margin:20px 0;">
         <p style="margin:0;color:${opts.boxFg};font-size:14px;font-weight:bold;">${opts.boxTitle ?? ""}</p>
         <p style="margin:4px 0 0 0;color:#ffffff;font-size:14px;">${opts.boxText}</p>
       </div>`
    : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background-color:#0f172a;color:#f8fafc;margin:0;padding:30px;">
  <div style="max-width:600px;margin:0 auto;background-color:#1e293b;border-radius:16px;padding:32px;border:1px solid #334155;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background-color:${opts.badgeBg};color:${opts.badgeFg};font-weight:bold;padding:6px 16px;border-radius:20px;font-size:14px;">${opts.badge}</div>
    </div>
    <h1 style="color:#ffffff;font-size:22px;font-weight:800;text-align:center;margin-bottom:16px;">${opts.title}</h1>
    ${paragraphs}
    ${box}
    <div style="text-align:center;margin:32px 0 24px;">
      <a href="${opts.cta.url}" style="background-color:${opts.cta.color};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:30px;font-weight:bold;font-size:14px;display:inline-block;">${opts.cta.label}</a>
    </div>
    <hr style="border:none;border-top:1px solid #334155;margin:24px 0;"/>
    <p style="color:#94a3b8;font-size:12px;text-align:center;">Équipe Ecomfy Livraison • <a href="mailto:support@ecomfy.cloud" style="color:#34d399;">support@ecomfy.cloud</a></p>
  </div>
</body></html>`;
}

function buildEmail(kind: "company" | "driver", decision: CompanyDecision, name: string, driverName: string | undefined, detail: string | undefined) {
  const who = escapeHtml(name || "");
  const subjectName = escapeHtml(driverName || "");
  const text = escapeHtml(detail || "");
  const statusUrl = `${APP_URL}/delivery/status`;

  if (kind === "driver") {
    if (decision === "approved") {
      return {
        subject: `Livreur approuvé : ${driverName ?? ""}`.trim(),
        html: layout({
          badge: "Ecomfy Livraison — Livreur approuvé", badgeBg: "#10b981", badgeFg: "#022c22",
          title: `${subjectName} peut recevoir des courses`,
          paragraphs: [`Bonjour ${who},`, `Après examen de ses pièces par notre équipe, le livreur <strong>${subjectName}</strong> est approuvé et actif.`],
          cta: { label: "Ouvrir mon espace Livraison →", url: statusUrl, color: "#0e7c66" },
        }),
      };
    }
    return {
      subject: `${decision === "suspended" ? "Livreur suspendu" : "Livreur refusé"} : ${driverName ?? ""}`.trim(),
      html: layout({
        badge: decision === "suspended" ? "Ecomfy Livraison — Livreur suspendu" : "Ecomfy Livraison — Livreur refusé", badgeBg: "#ef4444", badgeFg: "#ffffff",
        title: `Décision concernant ${subjectName}`,
        paragraphs: [`Bonjour ${who},`, `Le livreur <strong>${subjectName}</strong> ne peut pas recevoir de courses pour le moment.`],
        boxTitle: "Motif :", boxText: text || "Consultez votre dossier pour le détail.", boxBg: "#450a0a", boxBorder: "#ef4444", boxFg: "#fca5a5",
        cta: { label: "Mettre à jour mon dossier →", url: statusUrl, color: "#dc2626" },
      }),
    };
  }

  switch (decision) {
    case "approved":
      return {
        subject: "Votre dossier Ecomfy Livraison a été approuvé",
        html: layout({
          badge: "Ecomfy Livraison — Dossier approuvé", badgeBg: "#10b981", badgeFg: "#022c22",
          title: `Bonne nouvelle, ${who}`,
          paragraphs: [
            "Notre équipe a examiné votre dossier (identité du responsable et documents de la structure) et l'a <strong style=\"color:#34d399;\">approuvé</strong>.",
            "Votre structure reçoit le badge de confiance Ecomfy et peut désormais recevoir des ordres de livraison des e-commerçants partenaires. Les livreurs doivent être approuvés individuellement avant de recevoir des courses.",
          ],
          cta: { label: "Accéder à mon espace Livraison →", url: statusUrl, color: "#0e7c66" },
        }),
      };
    case "action_required":
      return {
        subject: "Complément demandé pour votre dossier Ecomfy Livraison",
        html: layout({
          badge: "Ecomfy Livraison — Complément requis", badgeBg: "#a855f7", badgeFg: "#ffffff",
          title: "Il manque une information à votre dossier",
          paragraphs: [`Bonjour ${who},`, "Avant de pouvoir décider, notre équipe a besoin d'un complément de votre part."],
          boxTitle: "Ce que nous attendons :", boxText: text, boxBg: "#3b0764", boxBorder: "#a855f7", boxFg: "#d8b4fe",
          cta: { label: "Compléter mon dossier →", url: `${APP_URL}/delivery/resubmit`, color: "#7e22ce" },
        }),
      };
    case "suspended":
      return {
        subject: "Votre compte Ecomfy Livraison est suspendu",
        html: layout({
          badge: "Ecomfy Livraison — Compte suspendu", badgeBg: "#ef4444", badgeFg: "#ffffff",
          title: "Votre compte est suspendu",
          paragraphs: [`Bonjour ${who},`, "Votre structure ne peut plus recevoir de livraisons pour le moment."],
          boxTitle: "Motif :", boxText: text || "Consultez votre dossier pour le détail.", boxBg: "#450a0a", boxBorder: "#ef4444", boxFg: "#fca5a5",
          cta: { label: "Consulter mon dossier →", url: statusUrl, color: "#dc2626" },
        }),
      };
    default:
      return {
        subject: "Décision concernant votre demande Ecomfy Livraison",
        html: layout({
          badge: "Ecomfy Livraison — Décision", badgeBg: "#ef4444", badgeFg: "#ffffff",
          title: "Information sur votre demande",
          paragraphs: [
            `Bonjour ${who},`,
            "Après examen de votre dossier par notre équipe, votre demande n'a pas pu être approuvée.",
            "Vous pouvez corriger les éléments concernés et soumettre de nouveau vos documents : pièce d'identité en cours de validité, permis de conduire correspondant à votre véhicule (catégorie A pour une moto, B pour une voiture) et selfie avec la pièce.",
          ],
          boxTitle: "Motif du refus :", boxText: text || "Les pièces soumises ne répondent pas aux exigences d'Ecomfy.", boxBg: "#450a0a", boxBorder: "#ef4444", boxFg: "#fca5a5",
          cta: { label: "Soumettre à nouveau mes documents →", url: `${APP_URL}/delivery/resubmit`, color: "#dc2626" },
        }),
      };
  }
}

/** Retour JSON des RPC admin_decide_delivery_company / _driver (seuls les champs lus ici sont décrits). */
type DecisionResult = {
  owner_user_id?: string | null;
  company_id: string;
  drivers_approved?: unknown[];
  drivers_blocked?: unknown[];
};

serveCors("app", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Méthode non autorisée." });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { error: "Session expirée ou invalide." });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user?.id) return json(401, { error: "Session expirée ou invalide." });
    const adminId = userData.user.id;

    // Client « au nom de l'administrateur » : auth.uid() dans la base = cet administrateur.
    const asCaller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let body: Payload;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Corps de requête invalide." });
    }

    const decisions: CompanyDecision[] = ["approved", "rejected", "action_required", "suspended"];
    if (!decisions.includes(body.decision)) return json(400, { error: "Décision invalide." });
    if (!body.companyId && !body.driverId) return json(400, { error: "companyId ou driverId est obligatoire." });
    if (body.companyId && !isUuid(body.companyId)) return json(400, { error: "companyId invalide." });
    if (body.driverId && !isUuid(body.driverId)) return json(400, { error: "driverId invalide." });
    if (body.driverId && body.decision === "action_required") {
      return json(400, { error: "Un livreur est approuvé, refusé ou suspendu (pas de complément demandé)." });
    }

    const reasonCode = str(body.reasonCode, 40);
    const reason = str(body.reason, 1000);
    const message = str(body.message, 1000);
    const note = str(body.note, 2000);

    console.log(`[verify-delivery-identity] ${adminId} → ${body.driverId ? "driver " + body.driverId : "company " + body.companyId}: ${body.decision}`);

    let result: DecisionResult;
    if (body.driverId) {
      const { data, error } = await asCaller.rpc("admin_decide_delivery_driver", {
        p_driver_id: body.driverId,
        p_decision: body.decision as DriverDecision,
        p_reason_code: reasonCode ?? null,
        p_reason: reason ?? null,
        p_note: note ?? null,
      });
      if (error) return mapDbError(error);
      result = data as DecisionResult;
    } else {
      const { data, error } = await asCaller.rpc("admin_decide_delivery_company", {
        p_company_id: body.companyId,
        p_decision: body.decision,
        p_reason_code: reasonCode ?? null,
        p_reason: reason ?? null,
        p_message: message ?? null,
        p_note: note ?? null,
        p_cascade_drivers: body.cascadeDrivers === true,
      });
      if (error) return mapDbError(error);
      result = data as DecisionResult;
    }

    // E-mail de décision. La décision est déjà enregistrée : un échec d'envoi ne l'annule pas.
    let emailSent = false;
    let emailNote: string | undefined;
    const ownerId: string | null = result.owner_user_id ?? null;
    let ownerEmail: string | null = null;
    let companyName = "";
    let driverName: string | undefined;

    const companyId: string = result.company_id;
    const { data: company } = await admin.from("delivery_companies").select("manager_name, company_name").eq("id", companyId).maybeSingle();
    companyName = company?.manager_name || company?.company_name || "";
    if (body.driverId) {
      const { data: drv } = await admin.from("delivery_drivers").select("full_name").eq("id", body.driverId).maybeSingle();
      driverName = drv?.full_name;
    }
    if (ownerId) {
      const { data: owner } = await admin.auth.admin.getUserById(ownerId);
      ownerEmail = owner?.user?.email ?? null;
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!ownerEmail) {
      emailNote = "no_recipient";
    } else if (!resendApiKey) {
      emailNote = "not_configured";
      console.warn("[verify-delivery-identity] RESEND_API_KEY absent : e-mail non envoyé.");
    } else {
      const detail = body.decision === "action_required" ? message : reason;
      const mail = buildEmail(body.driverId ? "driver" : "company", body.decision, companyName, driverName, detail);
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
          body: JSON.stringify({
            from: "Ecomfy Support <support@ecomfy.cloud>",
            ...guardEmail([ownerEmail], mail.subject),
            html: mail.html,
          }),
        });
        if (res.ok) {
          emailSent = true;
        } else {
          emailNote = "provider_error";
          console.warn("[verify-delivery-identity] Resend API error:", await res.text());
        }
      } catch (e) {
        emailNote = "provider_error";
        console.error("[verify-delivery-identity] Exception sending email:", e);
      }
    }

    return json(200, {
      success: true,
      status: body.decision,
      emailSent,
      emailNote,
      driversApproved: result.drivers_approved ?? [],
      driversBlocked: result.drivers_blocked ?? [],
    });
  } catch (err) {
    console.error("[verify-delivery-identity] Error:", err);
    return json(500, { error: "Erreur lors de la décision." });
  }
});
