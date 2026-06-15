import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContactNotificationRequest {
  showcaseSiteId: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Basic anti-spam: require an Authorization header (anon key is acceptable for public forms)
    const authHeader = req.headers.get("Authorization") || req.headers.get("apikey");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { showcaseSiteId, contactName, contactEmail, contactPhone, message }: ContactNotificationRequest = await req.json();

    console.log("Sending contact notification for site:", showcaseSiteId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate inputs
    const nameOk = typeof contactName === 'string' && contactName.trim().length > 0 && contactName.length <= 100;
    const emailOk = typeof contactEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) && contactEmail.length <= 255;
    const msgOk = typeof message === 'string' && message.trim().length > 0 && message.length <= 2000;
    if (!showcaseSiteId || !nameOk || !emailOk || !msgOk) {
      return new Response(JSON.stringify({ success: false, error: "Données invalides" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit per IP + per site: 5 messages / 10 min
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    const { data: rl } = await supabase.rpc('check_rate_limit', {
      _bucket: 'contact-form', _key: `${ip}:${showcaseSiteId}`, _max: 5, _window_seconds: 600,
    });
    if (rl && (rl as any).allowed === false) {
      return new Response(JSON.stringify({ success: false, error: "Trop de messages envoyés. Réessayez plus tard." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get site and owner information
    const { data: site, error: siteError } = await supabase
      .from("showcase_sites")
      .select(`
        business_name,
        subdomain,
        user_id,
        profiles!inner(email, full_name)
      `)
      .eq("id", showcaseSiteId)
      .single();

    if (siteError || !site) {
      console.error("Error fetching site:", siteError);
      throw new Error("Site not found");
    }

    const ownerEmail = (site.profiles as any).email;
    const ownerName = (site.profiles as any).full_name || "Propriétaire";

    if (!ownerEmail) {
      console.error("Owner email not found for site:", showcaseSiteId);
      throw new Error("Owner email not found");
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    // Send notification email using Resend API directly
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "VisualPro Notifications <onboarding@resend.dev>",
        to: [ownerEmail],
        subject: `📧 Nouveau message sur ${site.business_name}`,
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
                  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
                  color: white;
                  padding: 30px;
                  border-radius: 10px 10px 0 0;
                  text-align: center;
                }
                .content {
                  background: #f8f9fa;
                  padding: 30px;
                  border-radius: 0 0 10px 10px;
                }
                .message-box {
                  background: white;
                  padding: 20px;
                  border-radius: 8px;
                  border-left: 4px solid #2563eb;
                  margin: 20px 0;
                }
                .contact-info {
                  background: white;
                  padding: 15px;
                  border-radius: 8px;
                  margin: 15px 0;
                }
                .contact-info-item {
                  display: flex;
                  align-items: center;
                  margin: 8px 0;
                }
                .contact-info-label {
                  font-weight: 600;
                  color: #2563eb;
                  min-width: 100px;
                }
                .button {
                  display: inline-block;
                  padding: 12px 30px;
                  background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
                  color: white;
                  text-decoration: none;
                  border-radius: 6px;
                  margin: 20px 0;
                  font-weight: 600;
                }
                .footer {
                  text-align: center;
                  color: #666;
                  font-size: 12px;
                  margin-top: 30px;
                  padding-top: 20px;
                  border-top: 1px solid #ddd;
                }
              </style>
            </head>
            <body>
              <div class="header">
                <h1 style="margin: 0; font-size: 24px;">📧 Nouveau message reçu</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Votre site vitrine ${site.business_name}</p>
              </div>
              
              <div class="content">
                <p>Bonjour ${ownerName},</p>
                <p>Vous avez reçu un nouveau message via le formulaire de contact de votre site vitrine <strong>${site.business_name}</strong>.</p>
                
                <div class="contact-info">
                  <h3 style="margin-top: 0; color: #2563eb;">👤 Informations du contact</h3>
                  <div class="contact-info-item">
                    <span class="contact-info-label">Nom :</span>
                    <span>${contactName}</span>
                  </div>
                  <div class="contact-info-item">
                    <span class="contact-info-label">Email :</span>
                    <a href="mailto:${contactEmail}">${contactEmail}</a>
                  </div>
                  ${contactPhone ? `
                  <div class="contact-info-item">
                    <span class="contact-info-label">Téléphone :</span>
                    <a href="tel:${contactPhone}">${contactPhone}</a>
                  </div>
                  ` : ''}
                </div>
                
                <div class="message-box">
                  <h3 style="margin-top: 0; color: #2563eb;">💬 Message</h3>
                  <p style="white-space: pre-wrap; margin: 0;">${message}</p>
                </div>
                
                <div style="text-align: center;">
                  <a href="https://${site.subdomain}.visualpro.cloud" class="button">
                    Voir mon site vitrine
                  </a>
                </div>
                
                <p style="color: #666; font-size: 14px; margin-top: 20px;">
                  💡 <strong>Conseil :</strong> Répondez rapidement pour maintenir l'engagement de vos visiteurs !
                </p>
              </div>
              
              <div class="footer">
                <p>Cette notification a été envoyée par <strong>VisualPro</strong></p>
                <p>Vous recevez cet email car vous êtes propriétaire du site <strong>${site.business_name}</strong></p>
              </div>
            </body>
          </html>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend API error:", errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const emailData = await emailResponse.json();
    console.log("Email sent successfully:", emailData);

    return new Response(JSON.stringify({ success: true, emailData }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-contact-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
