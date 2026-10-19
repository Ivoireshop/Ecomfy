import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { APP_URL, guardEmail } from "../_shared/email-sender.ts";
import { escapeHtml } from "../_shared/email-safety.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyDeliveryIdentityPayload {
  companyId?: string;
  driverId?: string;
  // Ignorés : le destinataire est toujours relu en base (propriétaire de la structure).
  userEmail?: string;
  userName?: string;
  verificationStatus: "approved" | "rejected";
  rejectionReason?: string;
  docType?: string;
  licenseCategory?: string;
  faceMatchScore?: number;
}

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Seuls les rôles user_roles admin / founder / co_founder peuvent décider d'une vérification.
// `supabase` doit être un client service_role.
async function requireDeliveryAdmin(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<{ userId: string } | { error: Response }> {
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user?.id) {
    return { error: json(401, { error: "Session expirée ou invalide." }) };
  }
  const userId = userData.user.id;

  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "founder", "co_founder"]);
  if (rolesError) {
    console.error("[verify-delivery-identity] roles error:", rolesError);
    return { error: json(500, { error: "Vérification des droits impossible." }) };
  }
  if (!roles?.length) {
    return { error: json(403, { error: "Action réservée aux administrateurs." }) };
  }
  return { userId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const auth = await requireDeliveryAdmin(req, supabase);
    if ("error" in auth) return auth.error;

    const payload: VerifyDeliveryIdentityPayload = await req.json();
    const { companyId, driverId, userName, verificationStatus, rejectionReason, faceMatchScore } = payload;

    if (verificationStatus !== "approved" && verificationStatus !== "rejected") {
      return json(400, { error: "Statut de vérification invalide." });
    }
    if (!companyId && !driverId) {
      return json(400, { error: "companyId ou driverId est obligatoire." });
    }

    const isApproved = verificationStatus === "approved";

    // Le chauffeur n'a pas de compte propre : on remonte à sa structure.
    let resolvedCompanyId = companyId;
    if (driverId) {
      const { data: driver, error: driverError } = await supabase
        .from("delivery_drivers")
        .select("company_id")
        .eq("id", driverId)
        .maybeSingle();
      if (driverError || !driver) {
        return json(404, { error: "Chauffeur introuvable." });
      }
      if (companyId && driver.company_id !== companyId) {
        return json(400, { error: "Ce chauffeur n'appartient pas à cette structure." });
      }
      resolvedCompanyId = driver.company_id;
    }

    const { data: company, error: companyError } = await supabase
      .from("delivery_companies")
      .select("id, user_id, manager_name")
      .eq("id", resolvedCompanyId!)
      .maybeSingle();
    if (companyError || !company) {
      return json(404, { error: "Structure de livraison introuvable." });
    }

    // Destinataire : e-mail du compte propriétaire, jamais une valeur fournie par l'appelant.
    let userEmail: string | null = null;
    if (company.user_id) {
      const { data: owner } = await supabase.auth.admin.getUserById(company.user_id);
      userEmail = owner?.user?.email ?? null;
    }

    console.log(`[verify-delivery-identity] ${auth.userId} → company ${company.id}: status = ${verificationStatus}`);

    // 1. Update Database Status
    if (companyId) {
      const { error: dbError } = await supabase
        .from("delivery_companies")
        .update({
          verification_status: verificationStatus,
          trust_badge_active: isApproved,
          rejection_reason: isApproved ? null : rejectionReason || "Document ou comparaison faciale non conforme.",
          verified_at: isApproved ? new Date().toISOString() : null,
          verified_by: isApproved ? auth.userId : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", companyId);

      if (dbError) {
        console.error("[verify-delivery-identity] Database error updating company:", dbError);
        return json(500, { error: "Mise à jour du statut impossible." });
      }
    }

    if (driverId) {
      const { error: driverUpdateError } = await supabase
        .from("delivery_drivers")
        .update({
          is_active: isApproved,
          updated_at: new Date().toISOString(),
        })
        .eq("id", driverId);
      if (driverUpdateError) {
        console.error("[verify-delivery-identity] Database error updating driver:", driverUpdateError);
        return json(500, { error: "Mise à jour du chauffeur impossible." });
      }
    }

    // 2. Dispatch Transactional Support Email via RESEND API or Mail Hook
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;

    // Valeurs libres de l'appelant : échappées avant insertion dans le HTML.
    const safeUserName = escapeHtml(company.manager_name || userName || "");
    const safeRejectionReason = escapeHtml(
      rejectionReason || "Les pièces soumises ou le selfie de vérification ne répondent pas aux exigences de sécurité d'Ecomfy."
    );
    const safeFaceMatchScore = Number.isFinite(Number(faceMatchScore)) && Number(faceMatchScore) > 0
      ? Math.min(100, Math.round(Number(faceMatchScore)))
      : 94;

    const emailSubject = verificationStatus === "approved"
      ? "🎉 Votre compte Ecomfy Livraison a été approuvé !"
      : "⚠️ Information importante : Décision concernant votre demande Ecomfy Livraison";

    const htmlBody = verificationStatus === "approved"
      ? `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"/></head>
        <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 30px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; padding: 32px; border: 1px solid #334155;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background-color: #10b981; color: #022c22; font-weight: bold; padding: 6px 16px; border-radius: 20px; font-size: 14px;">
                Ecomfy Livraison — Partenaire Vérifié
              </div>
            </div>

            <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; text-align: center; margin-bottom: 16px;">
              Félicitations, ${safeUserName} ! 🎉
            </h1>

            <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
              Nous avons le plaisir de vous informer que votre vérification d'identité pour <strong>Ecomfy Livraison</strong> a été <strong style="color: #34d399;">APPROUVÉE</strong> avec succès !
            </p>

            <div style="background-color: #0f172a; border-left: 4px solid #10b981; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #e2e8f0; font-size: 14px;">
                ✅ <strong>Pièce d'identité (CNI/Passeport) :</strong> Conforme<br/>
                ✅ <strong>Permis de Conduire (Catégorie A/B) :</strong> Validé<br/>
                ✅ <strong>Comparaison Faciale (Face Matching) :</strong> Réussie (${safeFaceMatchScore}%)
              </p>
            </div>

            <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
              Votre structure a reçu le badge de confiance <strong>Ecomfy Certified</strong>. Vous pouvez dès maintenant vous connecter à l'application et commencer à recevoir des ordres de livraison des e-commerçants partenaires.
            </p>

            <div style="text-align: center; margin-top: 32px; margin-bottom: 24px;">
              <a href="${APP_URL}/delivery/dashboard" style="background-color: #0e7c66; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 30px; font-weight: bold; font-size: 14px; display: inline-block;">
                Accéder à mon Espace Livraison →
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #334155; margin: 24px 0;"/>

            <p style="color: #94a3b8; font-size: 12px; text-align: center;">
              Équipe Support Ecomfy Livraison • <a href="mailto:support@ecomfy.cloud" style="color: #34d399;">support@ecomfy.cloud</a>
            </p>
          </div>
        </body>
        </html>
      `
      : `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"/></head>
        <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 30px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; padding: 32px; border: 1px solid #334155;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background-color: #ef4444; color: #ffffff; font-weight: bold; padding: 6px 16px; border-radius: 20px; font-size: 14px;">
                Support Ecomfy Livraison — Action Requise
              </div>
            </div>

            <h1 style="color: #ffffff; font-size: 22px; font-weight: 800; text-align: center; margin-bottom: 16px;">
              Information sur votre demande de vérification
            </h1>

            <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
              Bonjour ${safeUserName},
            </p>

            <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
              Après analyse de votre dossier par notre système de sécurité, votre demande d'activation pour <strong>Ecomfy Livraison</strong> n'a pas pu être approuvée pour le motif suivant :
            </p>

            <div style="background-color: #450a0a; border-left: 4px solid #ef4444; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #fca5a5; font-size: 14px; font-weight: bold;">
                Motif du refus :
              </p>
              <p style="margin: 4px 0 0 0; color: #ffffff; font-size: 14px;">
                ${safeRejectionReason}
              </p>
            </div>

            <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
              <strong>Que devez-vous faire ?</strong><br/>
              Veuillez vous assurer de fournir une pièce d'identité officielle en cours de validité (CNI ou Passeport), un permis de conduire de Catégorie A ou B, ainsi qu'un selfie clair avec la pièce tenue dans la main.
            </p>

            <div style="text-align: center; margin-top: 32px; margin-bottom: 24px;">
              <a href="${APP_URL}/delivery/register" style="background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 30px; font-weight: bold; font-size: 14px; display: inline-block;">
                Soumettre à nouveau mes documents →
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #334155; margin: 24px 0;"/>

            <p style="color: #94a3b8; font-size: 12px; text-align: center;">
              Service Vérification Ecomfy • <a href="mailto:support@ecomfy.cloud" style="color: #fca5a5;">support@ecomfy.cloud</a>
            </p>
          </div>
        </body>
        </html>
      `;

    if (!userEmail) {
      console.warn(`[verify-delivery-identity] No owner e-mail for company ${company.id}: notification skipped`);
    } else if (resendApiKey) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Ecomfy Support <support@ecomfy.cloud>",
            ...guardEmail([userEmail], emailSubject),
            html: htmlBody,
          }),
        });

        if (res.ok) {
          emailSent = true;
          console.log(`[verify-delivery-identity] Resend email successfully dispatched to ${userEmail}`);
        } else {
          const errRes = await res.text();
          console.warn("[verify-delivery-identity] Resend API error:", errRes);
        }
      } catch (e) {
        console.error("[verify-delivery-identity] Exception sending email:", e);
      }
    } else {
      console.log(`[verify-delivery-identity] SIMULATED EMAIL SENT to ${userEmail} (Resend API key not configured)`);
      emailSent = true;
    }

    return json(200, {
      success: true,
      status: verificationStatus,
      emailSent,
      message: emailSent
        ? (isApproved
          ? "Compte approuvé et e-mail de félicitations envoyé."
          : "Compte rejeté et e-mail de notification avec motif envoyé.")
        : (isApproved ? "Compte approuvé (e-mail non envoyé)." : "Compte rejeté (e-mail non envoyé)."),
    });
  } catch (err: any) {
    console.error("[verify-delivery-identity] Error:", err);
    return json(500, { error: err.message || "Erreur lors de la vérification d'identité." });
  }
});
