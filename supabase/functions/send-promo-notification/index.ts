import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PromoNotificationRequest {
  userName: string;
  userEmail: string;
  promoCode: string;
  discountPercentage: number;
  originalAmount: number;
  discountedAmount: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Promo notification function invoked");

    const { userName, userEmail, promoCode, discountPercentage, originalAmount, discountedAmount }: PromoNotificationRequest = await req.json();
    
    // Initialize Supabase client to get founders' emails
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get founders and co-founders emails
    const { data: founders, error: foundersError } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["founder", "co_founder"]);

    if (foundersError) {
      console.error("Error fetching founders:", foundersError);
      throw foundersError;
    }

    if (!founders || founders.length === 0) {
      console.log("No founders found to notify");
      return new Response(JSON.stringify({ message: "No founders to notify" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get founders' emails from profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("email")
      .in("id", founders.map(f => f.user_id));

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    const founderEmails = profiles?.map(p => p.email).filter(Boolean) || [];
    
    if (founderEmails.length === 0) {
      console.log("No founder emails found");
      return new Response(JSON.stringify({ message: "No founder emails found" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Sending notification to ${founderEmails.length} founder(s)`);

    const discountAmount = originalAmount - discountedAmount;

    // Send email to all founders
    const emailResponse = await resend.emails.send({
      from: "VisualPro <onboarding@resend.dev>",
      to: founderEmails,
      subject: `🎉 Code Promo Utilisé: ${promoCode}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background-color: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #2563eb; margin-bottom: 20px; border-bottom: 3px solid #2563eb; padding-bottom: 10px;">
              🎉 Nouveau Code Promo Utilisé!
            </h1>
            
            <div style="background-color: #f0f7ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <h2 style="color: #1e40af; margin-top: 0;">Code: <span style="font-family: 'Courier New', monospace; background-color: white; padding: 5px 10px; border-radius: 3px;">${promoCode}</span></h2>
              <p style="color: #1e40af; font-size: 18px; font-weight: bold; margin: 10px 0;">
                Réduction: ${discountPercentage}%
              </p>
            </div>

            <div style="margin: 25px 0;">
              <h3 style="color: #374151; margin-bottom: 15px;">📊 Détails de la Transaction</h3>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="background-color: #f9fafb;">
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">Utilisateur:</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${userName}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">Email:</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${userEmail}</td>
                </tr>
                <tr style="background-color: #f9fafb;">
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">Prix Original:</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #1f2937; text-decoration: line-through;">${originalAmount} XOF</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #4b5563;">Montant de la Réduction:</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #dc2626; font-weight: bold;">-${discountAmount} XOF</td>
                </tr>
                <tr style="background-color: #dcfce7;">
                  <td style="padding: 12px; font-weight: 600; color: #166534; font-size: 16px;">Prix Payé:</td>
                  <td style="padding: 12px; color: #166534; font-weight: bold; font-size: 16px;">${discountedAmount} XOF</td>
                </tr>
              </table>
            </div>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 5px 0;">
                📅 ${new Date().toLocaleDateString('fr-FR', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>

            <div style="margin-top: 20px; padding: 15px; background-color: #fef3c7; border-radius: 5px;">
              <p style="color: #92400e; margin: 0; font-size: 14px;">
                ℹ️ Cette notification est envoyée automatiquement lors de chaque utilisation d'un code promo sur VisualPro.
              </p>
            </div>
          </div>

          <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px;">
            <p>VisualPro - Plateforme de Création Publicitaire</p>
          </div>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-promo-notification function:", error);
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
