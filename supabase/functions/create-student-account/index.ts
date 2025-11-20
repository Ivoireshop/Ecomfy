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

    // Send email with credentials
    const emailBody = `
      <h2>Bienvenue sur votre espace de formation !</h2>
      <p>Bonjour ${studentName},</p>
      <p>Votre paiement a été validé avec succès. Voici vos identifiants d'accès :</p>
      <ul>
        <li><strong>Email :</strong> ${studentEmail}</li>
        <li><strong>Mot de passe temporaire :</strong> ${tempPassword}</li>
      </ul>
      <p>Connectez-vous sur <a href="${Deno.env.get("VITE_SUPABASE_URL")}/auth">votre espace étudiant</a> et changez votre mot de passe.</p>
      <p>Vous pouvez désormais accéder à votre formation.</p>
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
