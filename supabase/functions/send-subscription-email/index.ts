import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  email: string;
  full_name: string;
  amount: number;
  start_date: string;
  end_date: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, full_name, amount, start_date, end_date }: EmailRequest = await req.json();

    console.log("Sending subscription confirmation email to:", email);

    const emailResponse = await resend.emails.send({
      from: "VisualPro <onboarding@resend.dev>",
      to: [email],
      subject: "Félicitations ! Votre abonnement VisualPro est activé 🎉",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
                border-radius: 10px 10px 0 0;
              }
              .header h1 {
                margin: 0;
                font-size: 28px;
              }
              .content {
                background: #f9f9f9;
                padding: 30px;
                border-radius: 0 0 10px 10px;
              }
              .info-box {
                background: white;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
                border-left: 4px solid #667eea;
              }
              .info-row {
                display: flex;
                justify-content: space-between;
                padding: 10px 0;
                border-bottom: 1px solid #eee;
              }
              .info-row:last-child {
                border-bottom: none;
              }
              .label {
                font-weight: 600;
                color: #666;
              }
              .value {
                color: #333;
              }
              .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px 40px;
                text-decoration: none;
                border-radius: 8px;
                margin: 20px 0;
                font-weight: 600;
              }
              .features {
                margin: 20px 0;
              }
              .feature {
                padding: 10px 0;
                display: flex;
                align-items: center;
              }
              .checkmark {
                color: #667eea;
                margin-right: 10px;
                font-size: 20px;
              }
              .footer {
                text-align: center;
                color: #999;
                font-size: 12px;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #eee;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>🎉 Félicitations ${full_name} !</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px;">Votre abonnement VisualPro est maintenant actif</p>
            </div>
            
            <div class="content">
              <p>Bonjour <strong>${full_name}</strong>,</p>
              
              <p>Nous sommes ravis de vous accueillir parmi nos membres Premium ! Votre paiement a été confirmé et votre compte est désormais actif.</p>
              
              <div class="info-box">
                <h3 style="margin-top: 0; color: #667eea;">📋 Détails de votre abonnement</h3>
                <div class="info-row">
                  <span class="label">Montant facturé :</span>
                  <span class="value"><strong>${amount.toLocaleString()} FCFA</strong></span>
                </div>
                <div class="info-row">
                  <span class="label">Date de début :</span>
                  <span class="value">${new Date(start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                <div class="info-row">
                  <span class="label">Date d'expiration :</span>
                  <span class="value">${new Date(end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                <div class="info-row">
                  <span class="label">Statut :</span>
                  <span class="value" style="color: #22c55e; font-weight: 600;">✓ Actif</span>
                </div>
              </div>
              
              <h3 style="color: #667eea;">✨ Ce que vous pouvez faire maintenant :</h3>
              <div class="features">
                <div class="feature">
                  <span class="checkmark">✓</span>
                  <span>Génération illimitée de visuels publicitaires</span>
                </div>
                <div class="feature">
                  <span class="checkmark">✓</span>
                  <span>Édition d'images avec Intelligence Artificielle</span>
                </div>
                <div class="feature">
                  <span class="checkmark">✓</span>
                  <span>Accès à tous les styles et formats</span>
                </div>
                <div class="feature">
                  <span class="checkmark">✓</span>
                  <span>Support technique prioritaire</span>
                </div>
                <div class="feature">
                  <span class="checkmark">✓</span>
                  <span>Mises à jour automatiques des nouvelles fonctionnalités</span>
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${Deno.env.get("SUPABASE_URL")?.replace("supabase.co", "lovableproject.com")}/generator" class="cta-button">
                  Commencer à créer mes visuels →
                </a>
              </div>
              
              <p style="margin-top: 30px;">Si vous avez des questions ou besoin d'aide, n'hésitez pas à nous contacter. Notre équipe est là pour vous accompagner.</p>
              
              <p style="margin-top: 20px;">Bonne création ! 🎨</p>
              
              <p style="margin-top: 20px;">
                <strong>L'équipe VisualPro</strong>
              </p>
            </div>
            
            <div class="footer">
              <p>© ${new Date().getFullYear()} VisualPro - Tous droits réservés</p>
              <p>Cet email confirme votre abonnement actif sur VisualPro</p>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, email_id: emailResponse.data?.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending subscription email:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Une erreur est survenue",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
