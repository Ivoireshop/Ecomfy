import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  enrollmentId: string;
  action: "revoke" | "restore" | "delete";
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return jsonResponse({ error: "Non autorisé" }, 401);
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Session invalide" }, 401);
    }

    const body = (await req.json()) as RequestBody;
    const enrollmentId = body.enrollmentId?.trim();
    const action = body.action;

    if (!enrollmentId || !action) {
      return jsonResponse({ error: "Données manquantes" }, 400);
    }

    if (!["revoke", "restore", "delete"].includes(action)) {
      return jsonResponse({ error: "Action invalide" }, 400);
    }

    const { data: enrollment, error: enrollmentError } = await serviceClient
      .from("enrollments")
      .select("id, course_id, student_email, student_name")
      .eq("id", enrollmentId)
      .single();

    if (enrollmentError || !enrollment) {
      return jsonResponse({ error: "Inscription introuvable" }, 404);
    }

    const { data: course, error: courseError } = await serviceClient
      .from("courses")
      .select("id, user_id")
      .eq("id", enrollment.course_id)
      .single();

    if (courseError || !course) {
      return jsonResponse({ error: "Formation introuvable" }, 404);
    }

    if (!course.user_id || course.user_id !== user.id) {
      return jsonResponse({ error: "Vous ne pouvez pas gérer cet étudiant" }, 403);
    }

    if (action === "revoke") {
      const { error: enrollmentUpdateError } = await serviceClient
        .from("enrollments")
        .update({
          payment_status: "revoked",
          validated_at: null,
        })
        .eq("id", enrollmentId);

      if (enrollmentUpdateError) {
        throw enrollmentUpdateError;
      }

      const { error: accessUpdateError } = await serviceClient
        .from("student_access")
        .update({ is_active: false })
        .eq("enrollment_id", enrollmentId);

      if (accessUpdateError) {
        throw accessUpdateError;
      }

      return jsonResponse({
        success: true,
        message: "Accès retiré avec succès.",
      });
    }

    if (action === "restore") {
      const { error: enrollmentUpdateError } = await serviceClient
        .from("enrollments")
        .update({
          payment_status: "paid",
          validated_at: new Date().toISOString(),
        })
        .eq("id", enrollmentId);

      if (enrollmentUpdateError) {
        throw enrollmentUpdateError;
      }

      const { error: accessUpdateError } = await serviceClient
        .from("student_access")
        .update({ is_active: true })
        .eq("enrollment_id", enrollmentId);

      if (accessUpdateError) {
        throw accessUpdateError;
      }

      return jsonResponse({
        success: true,
        message: "Accès réactivé avec succès.",
      });
    }

    const { error: accessDeleteError } = await serviceClient
      .from("student_access")
      .delete()
      .eq("enrollment_id", enrollmentId);

    if (accessDeleteError) {
      throw accessDeleteError;
    }

    const { error: enrollmentDeleteError } = await serviceClient
      .from("enrollments")
      .delete()
      .eq("id", enrollmentId);

    if (enrollmentDeleteError) {
      throw enrollmentDeleteError;
    }

    return jsonResponse({
      success: true,
      message: "Étudiant supprimé de cette formation.",
    });
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
    return jsonResponse({ error: errorMessage }, 400);
  }
});
