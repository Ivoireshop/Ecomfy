import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  enrollmentId: string;
  courseId: string;
  studentEmail: string;
  studentName: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { enrollmentId, courseId, studentEmail, studentName }: RequestBody = await req.json();

    // Generate a temporary password
    const tempPassword = Math.random().toString(36).slice(-12) + "A1!";

    // Create user account
    const { data: userData, error: userError } = await supabaseClient.auth.admin.createUser({
      email: studentEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: studentName,
      },
    });

    if (userError) throw userError;

    // Create profile
    const { error: profileError } = await supabaseClient
      .from("profiles")
      .insert({
        id: userData.user.id,
        email: studentEmail,
        full_name: studentName,
      });

    if (profileError && profileError.code !== "23505") {
      // Ignore duplicate key error
      console.error("Profile creation error:", profileError);
    }

    // Create student access
    const { error: accessError } = await supabaseClient
      .from("student_access")
      .insert({
        user_id: userData.user.id,
        course_id: courseId,
        enrollment_id: enrollmentId,
        is_active: true,
      });

    if (accessError) throw accessError;

    // Get course details including WhatsApp link
    const { data: courseData, error: courseError } = await supabaseClient
      .from("courses")
      .select("title, whatsapp_group_link")
      .eq("id", courseId)
      .single();

    if (courseError) {
      console.error("Error fetching course:", courseError);
    }

    const whatsappSection = courseData?.whatsapp_group_link
      ? `
        <div style="background-color: #dcf8c6; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3 style="color: #25D366; margin-top: 0;">🎉 Rejoignez le groupe WhatsApp d'accompagnement</h3>
          <p>Cliquez sur le lien ci-dessous pour rejoindre le groupe d'accompagnement de votre formation :</p>
          <p style="text-align: center; margin: 20px 0;">
            <a href="${courseData.whatsapp_group_link}" 
               style="background-color: #25D366; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Rejoindre le groupe WhatsApp
            </a>
          </p>
        </div>
      `
      : "";

    // Send email with credentials and WhatsApp link
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Bienvenue sur votre espace de formation !</h2>
        <p>Bonjour <strong>${studentName}</strong>,</p>
        <p>Votre paiement pour <strong>${courseData?.title || "la formation"}</strong> a été validé avec succès ! 🎉</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Vos identifiants d'accès :</h3>
          <ul style="list-style: none; padding: 0;">
            <li style="padding: 5px 0;"><strong>Email :</strong> ${studentEmail}</li>
            <li style="padding: 5px 0;"><strong>Mot de passe temporaire :</strong> <code style="background: #e5e7eb; padding: 3px 6px; border-radius: 3px;">${tempPassword}</code></li>
          </ul>
        </div>

        ${whatsappSection}

        <p>Pour accéder à votre formation :</p>
        <ol>
          <li>Connectez-vous sur votre espace étudiant</li>
          <li>Changez votre mot de passe temporaire</li>
          <li>Rejoignez le groupe WhatsApp d'accompagnement${courseData?.whatsapp_group_link ? " (lien ci-dessus)" : ""}</li>
          <li>Commencez votre formation</li>
        </ol>

        <p style="margin-top: 30px;">À bientôt sur la plateforme !</p>
        <p style="color: #6b7280; font-size: 14px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          Si vous avez des questions, n'hésitez pas à nous contacter.
        </p>
      </div>
    `;

    await supabaseClient.functions.invoke("send-email", {
      body: {
        to: studentEmail,
        subject: "Vos identifiants d'accès à votre formation",
        html: emailBody,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Compte créé avec succès",
        userId: userData.user.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
