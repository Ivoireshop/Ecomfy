import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingNotificationRequest {
  showcaseSiteId: string;
  bookingDetails: {
    full_name: string;
    email: string;
    phone: string | null;
    booking_date: string;
    booking_time: string;
    service_type: string;
    service_name: string;
    number_of_participants: number;
    message: string | null;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") || req.headers.get("apikey");
  if (!authHeader) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { showcaseSiteId, bookingDetails }: BookingNotificationRequest = await req.json();

    const esc = (s: unknown) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const escUrl = (s: unknown) => encodeURIComponent(String(s ?? ""));
    
    console.log("Processing booking notification for showcase site:", showcaseSiteId);

    // Créer le client Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer les informations du site vitrine et du propriétaire
    const { data: site, error: siteError } = await supabase
      .from('showcase_sites')
      .select('user_id, business_name, owner_name')
      .eq('id', showcaseSiteId)
      .single();

    if (siteError || !site) {
      console.error("Error fetching showcase site:", siteError);
      throw new Error("Site vitrine introuvable");
    }

    // Récupérer l'email du propriétaire
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', site.user_id)
      .single();

    if (profileError || !profile || !profile.email) {
      console.error("Error fetching profile:", profileError);
      throw new Error("Email du propriétaire introuvable");
    }

    const ownerEmail = profile.email;
    console.log("Sending notification to:", ownerEmail);

    // Formater la date
    const formattedDate = new Date(bookingDetails.booking_date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const serviceTypeLabel = bookingDetails.service_type === "formation" ? "Formation" : "Service";

    // Construire le contenu de l'email
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .booking-info { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .info-row { display: flex; margin: 10px 0; padding: 10px 0; border-bottom: 1px solid #eee; }
            .info-label { font-weight: bold; width: 200px; color: #667eea; }
            .info-value { flex: 1; }
            .message-box { background: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ffc107; }
            .footer { text-align: center; margin-top: 30px; color: #888; font-size: 12px; }
            .badge { display: inline-block; background: #28a745; color: white; padding: 5px 15px; border-radius: 20px; font-size: 14px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Nouvelle Réservation !</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px;">Vous avez reçu une nouvelle réservation sur ${esc(site.business_name)}</p>
            </div>
            <div class="content">
              <p style="font-size: 18px;"><span class="badge">NOUVEAU</span></p>
              
              <div class="booking-info">
                <h2 style="margin-top: 0; color: #667eea;">📋 Détails de la réservation</h2>
                
                <div class="info-row">
                  <div class="info-label">👤 Nom complet:</div>
                  <div class="info-value">${esc(bookingDetails.full_name)}</div>
                </div>
                
                <div class="info-row">
                  <div class="info-label">📧 Email:</div>
                  <div class="info-value"><a href="mailto:${escUrl(bookingDetails.email)}">${esc(bookingDetails.email)}</a></div>
                </div>
                
                ${bookingDetails.phone ? `
                  <div class="info-row">
                    <div class="info-label">📱 Téléphone:</div>
                    <div class="info-value"><a href="tel:${escUrl(bookingDetails.phone)}">${esc(bookingDetails.phone)}</a></div>
                  </div>
                ` : ''}
                
                <div class="info-row">
                  <div class="info-label">🎯 Type:</div>
                  <div class="info-value">${serviceTypeLabel}</div>
                </div>
                
                <div class="info-row">
                  <div class="info-label">✨ ${serviceTypeLabel}:</div>
                  <div class="info-value"><strong>${esc(bookingDetails.service_name)}</strong></div>
                </div>
                
                <div class="info-row">
                  <div class="info-label">📅 Date:</div>
                  <div class="info-value">${formattedDate}</div>
                </div>
                
                <div class="info-row">
                  <div class="info-label">🕐 Heure:</div>
                  <div class="info-value">${esc(bookingDetails.booking_time)}</div>
                </div>
                
                <div class="info-row">
                  <div class="info-label">👥 Participants:</div>
                  <div class="info-value">${Number(bookingDetails.number_of_participants) || 0} personne(s)</div>
                </div>
                
                ${bookingDetails.message ? `
                  <div class="message-box">
                    <strong>💬 Message du client:</strong>
                    <p style="margin: 10px 0 0 0; white-space: pre-wrap;">${esc(bookingDetails.message)}</p>
                  </div>
                ` : ''}
              </div>
              
              <p style="margin-top: 30px; font-size: 14px; color: #666;">
                💡 <strong>Action requise:</strong> Connectez-vous à votre tableau de bord pour confirmer ou gérer cette réservation.
              </p>
            </div>
            
            <div class="footer">
              <p>Cet email a été envoyé automatiquement par votre système de réservation VisualPro</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Envoyer l'email
    const emailResponse = await resend.emails.send({
      from: "VisualPro Réservations <onboarding@resend.dev>",
      to: [ownerEmail],
      subject: `🎉 Nouvelle réservation - ${bookingDetails.service_name}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, message: "Notification envoyée" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-booking-notification function:", error);
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
