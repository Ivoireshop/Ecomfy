// @ts-nocheck
declare const Deno: any;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, fullName, role, inviteToken, originUrl } = await req.json();

    if (!email || !fullName) {
      return new Response(
        JSON.stringify({ success: false, error: "Email et Nom complet requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = originUrl || "https://ecomfy.cloud";
    const inviteUrl = `${baseUrl}/governance/invitation/${inviteToken || 'demo-token'}?email=${encodeURIComponent(email)}`;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    let emailSent = false;
    let emailResponseData = null;
    let usedSender = null;

    const roleLabels: Record<string, string> = {
      co_founder: "Cofondateur",
      cofounder: "Cofondateur",
      shareholder: "Associé / Actionnaire",
      investor: "Investisseur",
      corporate_admin: "Administrateur Autorisé",
      founder: "Fondateur",
    };
    const displayRole = roleLabels[role] || role || "Associé";

    if (resendApiKey) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090D16; color: #E2E8F0; margin: 0; padding: 40px 20px; }
            .container { max-width: 580px; margin: 0 auto; background: #0F172A; border: 1px solid #1E293B; border-radius: 20px; padding: 40px; }
            .logo { font-size: 24px; font-weight: 800; color: #0E7C66; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 24px; }
            .badge { display: inline-block; background: rgba(14, 124, 102, 0.2); color: #34D399; border: 1px solid rgba(14, 124, 102, 0.4); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; margin-bottom: 20px; letter-spacing: 1px; }
            h1 { font-size: 20px; font-weight: 700; color: #FFFFFF; margin-top: 0; margin-bottom: 16px; }
            p { font-size: 14px; line-height: 1.6; color: #94A3B8; margin-bottom: 16px; }
            .role-card { background: #182238; border: 1px solid #334155; border-radius: 12px; padding: 16px 20px; margin: 24px 0; text-align: center; }
            .role-label { font-size: 11px; color: #64748B; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; }
            .role-value { font-size: 18px; color: #34D399; font-weight: 800; margin-top: 4px; }
            .btn-container { text-align: center; margin: 32px 0 24px 0; }
            .btn { display: inline-block; background: #0E7C66; color: #FFFFFF; font-weight: 700; font-size: 14px; padding: 14px 28px; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 14px rgba(14, 124, 102, 0.4); }
            .link-fallback { font-size: 12px; color: #64748B; word-break: break-all; margin-top: 20px; }
            .footer { margin-top: 36px; font-size: 11px; color: #475569; text-align: center; border-top: 1px solid #1E293B; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">ECOMFY</div>
            <div class="badge">INVITATION OFFICIELLE</div>
            <h1>Bonjour ${fullName},</h1>
            <p>Vous avez été invité(e) par le fondateur d'Ecomfy à rejoindre la gouvernance de la plateforme en qualité de :</p>
            
            <div class="role-card">
              <div class="role-label">Rôle Proposé</div>
              <div class="role-value">${displayRole}</div>
            </div>

            <p>Avant l'activation de votre statut, vous devez consulter les informations et documents qui vous sont destinés, en prendre connaissance et confirmer votre acceptation.</p>

            <div class="btn-container">
              <a href="${inviteUrl}" class="btn">CONSULTER MON INVITATION</a>
            </div>

            <p class="link-fallback">
              Si le bouton ne s'affiche pas correctement, copiez ce lien sécurisé dans votre navigateur :<br/>
              <a href="${inviteUrl}" style="color: #38BDF8;">${inviteUrl}</a>
            </p>

            <p style="font-size: 12px; color: #64748B; margin-top: 24px;">
              <em>Cette invitation est personnelle et ne doit pas être transférée.</em>
            </p>

            <div class="footer">
              Ecomfy SAS — Plateforme Multi-tenant E-commerce & Gouvernance.<br/>
              © 2026 Ecomfy Inc. Tous droits réservés.
            </div>
          </div>
        </body>
        </html>
      `;

      const subject = "Vous êtes invité(e) à rejoindre la gouvernance d'Ecomfy";

      // 1. Primary attempt: custom domain
      const primaryFrom = "Gouvernance Ecomfy <gouvernance@ecomfy.cloud>";
      let res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: primaryFrom,
          to: [email],
          subject,
          html: emailHtml,
        }),
      });

      emailResponseData = await res.json().catch(() => ({}));
      emailSent = res.ok;
      usedSender = primaryFrom;

      // 2. Fallback to onboarding@resend.dev if primary sender fails
      if (!res.ok) {
        console.warn(`[send-corporate-invite] Primary sender (${primaryFrom}) failed:`, emailResponseData);
        const fallbackFrom = "Ecomfy Gouvernance <onboarding@resend.dev>";
        
        const fallbackRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fallbackFrom,
            to: [email],
            subject,
            html: emailHtml,
          }),
        });

        const fallbackData = await fallbackRes.json().catch(() => ({}));
        if (fallbackRes.ok) {
          emailSent = true;
          emailResponseData = fallbackData;
          usedSender = fallbackFrom;
          console.log(`[send-corporate-invite] Fallback sender (${fallbackFrom}) succeeded:`, fallbackData);
        } else {
          console.error(`[send-corporate-invite] Fallback sender (${fallbackFrom}) also failed:`, fallbackData);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailSent,
        usedSender,
        inviteUrl,
        emailResponseData,
        message: emailSent
          ? `Invitation envoyée avec succès.`
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


