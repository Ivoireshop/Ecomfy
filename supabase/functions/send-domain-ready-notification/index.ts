import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { Resend } from 'npm:resend@4.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);

interface NotificationRequest {
  showcaseId: string;
  customDomain: string;
  businessName: string;
  ownerEmail: string;
  ownerName: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { showcaseId, customDomain, businessName, ownerEmail, ownerName }: NotificationRequest = await req.json();

    if (!showcaseId || !customDomain || !ownerEmail) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Sending domain ready notification to ${ownerEmail} for domain ${customDomain}`);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; 
              background-color: #f3f4f6; 
              margin: 0; 
              padding: 40px 20px; 
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              background: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            }
            .header {
              background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
              padding: 40px 30px;
              text-align: center;
            }
            .header h1 { 
              color: #ffffff; 
              font-size: 28px; 
              font-weight: bold; 
              margin: 0;
            }
            .header .emoji {
              font-size: 48px;
              margin-bottom: 16px;
            }
            .content {
              padding: 40px 30px;
            }
            .greeting {
              color: #111827;
              font-size: 18px;
              margin-bottom: 24px;
            }
            .message {
              color: #374151;
              font-size: 16px;
              line-height: 1.6;
              margin-bottom: 24px;
            }
            .domain-box {
              background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
              border: 2px solid #10b981;
              border-radius: 12px;
              padding: 24px;
              text-align: center;
              margin: 24px 0;
            }
            .domain-label {
              color: #065f46;
              font-size: 14px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 8px;
            }
            .domain-name {
              color: #047857;
              font-size: 24px;
              font-weight: bold;
              word-break: break-all;
            }
            .ssl-badge {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              background: #10b981;
              color: #ffffff;
              padding: 8px 16px;
              border-radius: 20px;
              font-size: 14px;
              font-weight: 600;
              margin-top: 16px;
            }
            .feature-list {
              margin: 32px 0;
            }
            .feature-item {
              display: flex;
              align-items: flex-start;
              gap: 12px;
              padding: 12px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .feature-item:last-child {
              border-bottom: none;
            }
            .feature-icon {
              width: 24px;
              height: 24px;
              background: #dbeafe;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              color: #2563eb;
              font-size: 14px;
            }
            .feature-text {
              color: #374151;
              font-size: 15px;
            }
            .button-container {
              text-align: center;
              margin: 32px 0;
            }
            .button { 
              display: inline-block; 
              background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
              color: #ffffff; 
              text-decoration: none; 
              padding: 16px 32px; 
              border-radius: 8px; 
              font-weight: 600;
              font-size: 16px;
              box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.3);
            }
            .footer { 
              background: #f9fafb;
              padding: 24px 30px;
              text-align: center;
            }
            .footer-text {
              color: #6b7280; 
              font-size: 14px;
              margin: 0;
            }
            .footer-brand {
              color: #2563eb;
              font-weight: 600;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="emoji">🎉</div>
              <h1>Votre domaine est prêt !</h1>
            </div>
            
            <div class="content">
              <p class="greeting">Bonjour ${ownerName || 'cher utilisateur'},</p>
              
              <p class="message">
                Excellente nouvelle ! La configuration DNS de votre domaine personnalisé pour 
                <strong>${businessName || 'votre site vitrine'}</strong> est maintenant terminée et votre 
                certificat SSL a été provisionné avec succès.
              </p>
              
              <div class="domain-box">
                <div class="domain-label">Votre nouveau domaine</div>
                <div class="domain-name">${customDomain}</div>
                <div class="ssl-badge">
                  🔒 SSL Actif - Connexion sécurisée
                </div>
              </div>
              
              <div class="feature-list">
                <div class="feature-item">
                  <div class="feature-icon">✓</div>
                  <div class="feature-text">
                    <strong>Domaine actif</strong> — Votre site est accessible via votre domaine personnalisé
                  </div>
                </div>
                <div class="feature-item">
                  <div class="feature-icon">✓</div>
                  <div class="feature-text">
                    <strong>SSL/HTTPS activé</strong> — Vos visiteurs bénéficient d'une connexion sécurisée
                  </div>
                </div>
                <div class="feature-item">
                  <div class="feature-icon">✓</div>
                  <div class="feature-text">
                    <strong>Redirection automatique</strong> — Les anciennes URLs redirigent vers votre nouveau domaine
                  </div>
                </div>
              </div>
              
              <div class="button-container">
                <a href="https://${customDomain}" class="button" target="_blank">
                  Visiter mon site →
                </a>
              </div>
              
              <p class="message" style="font-size: 14px; color: #6b7280;">
                Il peut y avoir un court délai de quelques minutes pour que tous les serveurs DNS dans le monde 
                soient mis à jour. Si vous rencontrez des problèmes, veuillez patienter quelques instants.
              </p>
            </div>
            
            <div class="footer">
              <p class="footer-text">
                Cet email a été envoyé automatiquement par 
                <a href="https://visualpro.cloud" class="footer-brand">VisualPro</a>
                <br>
                Création de visuels publicitaires propulsée par l'IA
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: 'VisualPro <onboarding@resend.dev>',
      to: [ownerEmail],
      subject: `🎉 Votre domaine ${customDomain} est maintenant actif !`,
      html,
    });

    if (error) {
      console.error('Error sending email:', error);
      throw error;
    }

    console.log('Email sent successfully:', data);

    return new Response(
      JSON.stringify({ success: true, emailId: data?.id }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in send-domain-ready-notification function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
