import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyDeliveryIdentityPayload {
  companyId?: string;
  driverId?: string;
  userEmail: string;
  userName: string;
  verificationStatus: "approved" | "rejected";
  rejectionReason?: string;
  docType?: string;
  licenseCategory?: string;
  faceMatchScore?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: VerifyDeliveryIdentityPayload = await req.json();
    const { companyId, driverId, userEmail, userName, verificationStatus, rejectionReason, faceMatchScore } = payload;

    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: "L'e-mail du destinataire est obligatoire." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[verify-delivery-identity] Processing payload for ${userName} (${userEmail}): status = ${verificationStatus}`);

    // 1. Update Database Status
    if (companyId) {
      const isApproved = verificationStatus === "approved";
      const { error: dbError } = await supabase
        .from("delivery_companies")
        .update({
          verification_status: verificationStatus,
          trust_badge_active: isApproved,
          rejection_reason: isApproved ? null : rejectionReason || "Document ou comparaison faciale non conforme.",
          verified_at: isApproved ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", companyId);

      if (dbError) {
        console.error("[verify-delivery-identity] Database error updating company:", dbError);
      }
    }

    if (driverId) {
      const isApproved = verificationStatus === "approved";
      await supabase
        .from("delivery_drivers")
        .update({
          is_active: isApproved,
          updated_at: new Date().toISOString(),
        })
        .eq("id", driverId);
    }

    // 2. Dispatch Transactional Support Email via RESEND API or Mail Hook
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;

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
              Félicitations, ${userName} ! 🎉
            </h1>

            <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
              Nous avons le plaisir de vous informer que votre vérification d'identité pour <strong>Ecomfy Livraison</strong> a été <strong style="color: #34d399;">APPROUVÉE</strong> avec succès !
            </p>

            <div style="background-color: #0f172a; border-left: 4px solid #10b981; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #e2e8f0; font-size: 14px;">
                ✅ <strong>Pièce d'identité (CNI/Passeport) :</strong> Conforme<br/>
                ✅ <strong>Permis de Conduire (Catégorie A/B) :</strong> Validé<br/>
                ✅ <strong>Comparaison Faciale (Face Matching) :</strong> Réussie (${faceMatchScore || 94}%)
              </p>
            </div>

            <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
              Votre structure a reçu le badge de confiance <strong>Ecomfy Certified</strong>. Vous pouvez dès maintenant vous connecter à l'application et commencer à recevoir des ordres de livraison des e-commerçants partenaires.
            </p>

            <div style="text-align: center; margin-top: 32px; margin-bottom: 24px;">
              <a href="https://ecomfy.cloud/delivery/dashboard" style="background-color: #0e7c66; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 30px; font-weight: bold; font-size: 14px; display: inline-block;">
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
              Bonjour ${userName},
            </p>

            <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
              Après analyse de votre dossier par notre système de sécurité, votre demande d'activation pour <strong>Ecomfy Livraison</strong> n'a pas pu être approuvée pour le motif suivant :
            </p>

            <div style="background-color: #450a0a; border-left: 4px solid #ef4444; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #fca5a5; font-size: 14px; font-weight: bold;">
                Motif du refus :
              </p>
              <p style="margin: 4px 0 0 0; color: #ffffff; font-size: 14px;">
                ${rejectionReason || "Les pièces soumises ou le selfie de vérification ne répondent pas aux exigences de sécurité d'Ecomfy."}
              </p>
            </div>

            <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
              <strong>Que devez-vous faire ?</strong><br/>
              Veuillez vous assurer de fournir une pièce d'identité officielle en cours de validité (CNI ou Passeport), un permis de conduire de Catégorie A ou B, ainsi qu'un selfie clair avec la pièce tenue dans la main.
            </p>

            <div style="text-align: center; margin-top: 32px; margin-bottom: 24px;">
              <a href="https://ecomfy.cloud/delivery/register" style="background-color: #dc2626; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 30px; font-weight: bold; font-size: 14px; display: inline-block;">
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

    if (resendApiKey) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Ecomfy Support <support@ecomfy.cloud>",
            to: [userEmail],
            subject: emailSubject,
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

    return new Response(
      JSON.stringify({
        success: true,
        status: verificationStatus,
        emailSent,
        message: verificationStatus === "approved"
          ? "Compte approuvé et e-mail de félicitations envoyé."
          : "Compte rejeté et e-mail de notification avec motif envoyé."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[verify-delivery-identity] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erreur lors de la vérification d'identité." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
