import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReminderRequest {
  userId: string;
  userEmail: string;
  userName?: string;
  reminderType: 'after_2_generations' | 'after_3_generations';
  freeGenerationsRemaining: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, userEmail, userName, reminderType, freeGenerationsRemaining }: ReminderRequest = await req.json();

    console.log(`Processing reminder request for user ${userId}, type: ${reminderType}`);

    // Create Supabase admin client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Check if reminder already sent to avoid duplicates
    const { data: existingReminder } = await supabaseClient
      .from("email_reminders")
      .select("id")
      .eq("user_id", userId)
      .eq("reminder_type", reminderType)
      .single();

    if (existingReminder) {
      console.log(`Reminder already sent for user ${userId}, type: ${reminderType}`);
      return new Response(
        JSON.stringify({ message: "Reminder already sent" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Prepare email content based on reminder type
    let subject: string;
    let html: string;

    if (reminderType === 'after_2_generations') {
      subject = "🎨 Il vous reste 1 génération gratuite !";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">Plus qu'une génération gratuite !</h1>
          <p>Bonjour ${userName || 'cher utilisateur'},</p>
          <p>Vous avez déjà utilisé <strong>2 de vos 3 générations gratuites</strong> ! 🎉</p>
          <p>Il vous reste encore <strong>1 génération gratuite</strong> pour créer vos visuels publicitaires professionnels.</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">Pourquoi passer à l'abonnement ?</h3>
            <ul style="color: #4b5563;">
              <li>✨ <strong>Générations illimitées</strong> d'images publicitaires</li>
              <li>🎯 Accès à tous les templates premium</li>
              <li>🚀 Formats adaptés à toutes les plateformes</li>
              <li>💎 Qualité professionnelle garantie</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovableproject.com') || ''}/subscription" 
               style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
              Voir les abonnements
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px;">
            Ne manquez pas cette opportunité de créer des publicités qui convertissent !
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            Cet email a été envoyé car vous avez utilisé notre service de génération d'images publicitaires.
          </p>
        </div>
      `;
    } else {
      // after_3_generations - 24h follow-up
      subject = "🔥 Prêt à passer au niveau supérieur ?";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">Vous avez aimé vos 3 générations gratuites ?</h1>
          <p>Bonjour ${userName || 'cher utilisateur'},</p>
          <p>Hier, vous avez utilisé votre <strong>dernière génération gratuite</strong>. 🎨</p>
          <p>Nous espérons que vous avez été impressionné par la qualité de vos visuels publicitaires !</p>
          
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin-top: 0; color: #92400e;">⚡ Offre spéciale pour vous</h3>
            <p style="color: #78350f; margin-bottom: 0;">
              Passez à l'abonnement <strong>dès maintenant</strong> et continuez à créer des publicités qui convertissent sans limite !
            </p>
          </div>

          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #1f2937;">Avec l'abonnement Pro :</h3>
            <ul style="color: #4b5563;">
              <li>🔄 <strong>Générations illimitées</strong> - Créez autant de visuels que vous voulez</li>
              <li>🎨 <strong>Tous les templates</strong> - Accès complet à notre bibliothèque</li>
              <li>📱 <strong>Tous les formats</strong> - Instagram, Facebook, LinkedIn, etc.</li>
              <li>⚡ <strong>Génération prioritaire</strong> - Résultats plus rapides</li>
              <li>💼 <strong>Support premium</strong> - Aide dédiée quand vous en avez besoin</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovableproject.com') || ''}/subscription" 
               style="background-color: #2563eb; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
              🚀 Commencer maintenant
            </a>
          </div>

          <p style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 20px;">
            <strong>Rejoignez des centaines d'entrepreneurs africains</strong> qui créent déjà des publicités professionnelles quotidiennement.
          </p>

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">
            Vous recevez cet email car vous avez épuisé vos générations gratuites.
          </p>
        </div>
      `;
    }

    // Send email via Resend API directly
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "AdGenius AI <onboarding@resend.dev>",
        to: [userEmail],
        subject,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      throw new Error(`Failed to send email: ${JSON.stringify(errorData)}`);
    }

    const emailData = await emailResponse.json();
    console.log("Email sent successfully:", emailData);

    // Record that reminder was sent
    const { error: insertError } = await supabaseClient
      .from("email_reminders")
      .insert({
        user_id: userId,
        reminder_type: reminderType,
      });

    if (insertError) {
      console.error("Error recording reminder:", insertError);
      // Don't fail the request if recording fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Reminder sent successfully",
        emailId: emailData.id 
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-generation-reminder function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);