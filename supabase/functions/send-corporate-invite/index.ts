// supabase/functions/send-corporate-invite/index.ts
// Real Email Invitation Dispatcher for Ecomfy Corporate Governance

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, fullName, role, targetPercentage, targetShares, inviteToken, originUrl } = await req.json();

    if (!email || !fullName) {
      return new Response(
        JSON.stringify({ success: false, error: "Email et Nom complet requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = originUrl || "https://ecomfy.cloud";
    const onboardingUrl = `${baseUrl}/governance/onboarding?token=${inviteToken || 'demo-token'}&email=${encodeURIComponent(email)}`;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    let emailSent = false;
    let emailResponseData = null;

    if (resendApiKey) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #090D16; color: #E2E8F0; margin: 0; padding: 40px 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #0F172A; border: 1px solid #1E293B; border-radius: 20px; padding: 40px; }
            .logo { font-size: 24px; font-weight: 800; color: #0E7C66; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 24px; }
            .badge { display: inline-block; background: rgba(14, 124, 102, 0.2); color: #34D399; border: 1px solid rgba(14, 124, 102, 0.4); padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; margin-bottom: 16px; }
            h1 { font-size: 22px; font-weight: 700; color: #FFFFFF; margin-top: 0; }
            p { font-size: 14px; line-height: 1.6; color: #94A3B8; }
            .summary-box { background: #182238; border: 1px solid #334155; border-radius: 14px; padding: 20px; margin: 24px 0; }
            .summary-item { display: flex; justify-between: space-between; margin-bottom: 8px; font-size: 13px; }
            .summary-label { color: #64748B; font-weight: 600; }
            .summary-val { color: #34D399; font-weight: 700; font-family: monospace; }
            .btn { display: inline-block; background: #0E7C66; color: #FFFFFF; font-weight: 700; font-size: 14px; padding: 14px 28px; text-decoration: none; border-radius: 12px; margin-top: 16px; box-shadow: 0 4px 14px rgba(14, 124, 102, 0.4); }
            .footer { margin-top: 32px; font-size: 11px; color: #475569; text-align: center; border-top: 1px solid #1E293B; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">ECOMFY</div>
            <div class="badge">INVITATION OFFICIELLE GOUVERNANCE</div>
            <h1>Bonjour ${fullName},</h1>
            <p>Le Fondateur Principal de <strong>Ecomfy SAS</strong> vous invite à rejoindre officiellement la structure de gouvernance et l'actionnariat de la société.</p>
            
            <div class="summary-box">
              <div class="summary-item">
                <span class="summary-label">Rôle attribué :</span>
                <span class="summary-val" style="color:#A855F7;">${role || 'Associé / Vesting'}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Participation Cible :</span>
                <span class="summary-val">${targetPercentage || 10}%</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">Actions attribuées :</span>
                <span class="summary-val">${(targetShares || 100000).toLocaleString()} actions</span>
              </div>
            </div>

            <p>Conformément aux protocoles juridiques de la société, vous devez consulter les documents statutaires et valider votre signature électronique d'engagement pour confirmer votre intégration.</p>

            <a href="${onboardingUrl}" class="btn">CONSULTER & SIGNER LES DOCUMENTS STATUTAIRES</a>

            <div class="footer">
              Cet email contient un lien sécurisé d'intégration unique.<br>
              Ecomfy SAS — Plateforme Multi-tenant E-commerce & Gouvernance.
            </div>
          </div>
        </body>
        </html>
      `;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Gouvernance Ecomfy <gouvernance@ecomfy.cloud>",
          to: [email],
          subject: "Invitation Officielle — Gouvernance & Actionnariat Ecomfy",
          html: emailHtml,
        }),
      });

      emailResponseData = await res.json();
      emailSent = res.ok;
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailSent,
        onboardingUrl,
        emailResponseData,
        message: emailSent
          ? "Invitation envoyée par email avec succès !"
          : "Lien d'invitation généré avec succès. Transmettez le lien sécurisé à l'associé."
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
