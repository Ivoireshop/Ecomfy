import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  enrollmentId: string;
  courseId: string;
  studentEmail: string;
  studentName: string;
  resend?: boolean;
}

interface EmailSendResult {
  success: boolean;
  message: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function findExistingUserIdByEmail(supabaseClient: ReturnType<typeof createClient>, email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const { data: profileMatch } = await supabaseClient
    .from("profiles")
    .select("id, email")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (profileMatch?.id) {
    return profileMatch.id;
  }

  let page = 1;
  const perPage = 200;

  while (page <= 10) {
    const { data, error } = await supabaseClient.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw error;
    }

    const match = data.users.find(
      (user) => user.email?.trim().toLowerCase() === normalizedEmail
    );

    if (match?.id) {
      return match.id;
    }

    if (data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  return null;
}

function formatEmailErrorMessage(rawError: unknown) {
  const fallback = "l'envoi de l'email a échoué";

  if (!rawError || typeof rawError !== "object") {
    return fallback;
  }

  const errorMessage =
    ("message" in rawError && typeof rawError.message === "string" && rawError.message) ||
    ("error" in rawError && typeof rawError.error === "string" && rawError.error) ||
    fallback;

  const normalized = errorMessage.toLowerCase();

  if (normalized.includes("testing emails") || normalized.includes("sandbox")) {
    return "le service email est encore en mode test et ne peut pas envoyer vers des adresses externes";
  }

  if (normalized.includes("verify a domain") || normalized.includes("not verified") || normalized.includes("domain")) {
    return "le domaine d’envoi email n’est pas encore vérifié";
  }

  return errorMessage;
}

async function sendStudentEmail({
  studentEmail,
  studentName,
  courseTitle,
  whatsappGroupLink,
  tempPassword,
  resend,
  isNewAccount,
}: {
  studentEmail: string;
  studentName: string;
  courseTitle: string;
  whatsappGroupLink: string | null;
  tempPassword: string | null;
  resend: boolean;
  isNewAccount: boolean;
}): Promise<EmailSendResult> {
  if (!RESEND_API_KEY) {
    return {
      success: false,
      message: "le service d'envoi d'email n'est pas configuré",
    };
  }

  const whatsappSection = whatsappGroupLink
    ? `
        <div style="background-color: #dcf8c6; padding: 20px; border-radius: 10px; margin: 20px 0;">
          <h3 style="color: #25D366; margin-top: 0;">🎉 Rejoignez le groupe WhatsApp d'accompagnement</h3>
          <p>Cliquez sur le lien ci-dessous pour rejoindre le groupe d'accompagnement de votre formation :</p>
          <p style="text-align: center; margin: 20px 0;">
            <a href="${whatsappGroupLink}" style="background-color: #25D366; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Rejoindre le groupe WhatsApp
            </a>
          </p>
        </div>
      `
    : "";

  const credentialsBlock = isNewAccount && tempPassword
    ? `
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Vos identifiants d'accès :</h3>
        <ul style="list-style: none; padding: 0; margin: 0;">
          <li style="padding: 5px 0;"><strong>Email :</strong> ${studentEmail}</li>
          <li style="padding: 5px 0;"><strong>Mot de passe temporaire :</strong> <code style="background: #e5e7eb; padding: 3px 6px; border-radius: 3px;">${tempPassword}</code></li>
        </ul>
      </div>`
    : `
      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;">
          Connectez-vous avec votre adresse <strong>${studentEmail}</strong> et votre mot de passe habituel.
          Si vous l'avez oublié, utilisez le lien « Mot de passe oublié » sur la page de connexion.
        </p>
      </div>`;

  const emailBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">${isNewAccount ? (resend ? "Vos accès ont été préparés" : "Bienvenue sur votre espace de formation !") : "Accès à votre nouvelle formation"}</h2>
      <p>Bonjour <strong>${studentName}</strong>,</p>
      <p>Votre accès pour <strong>${courseTitle}</strong> est désormais actif.</p>

      ${credentialsBlock}

      ${whatsappSection}

      <p>Pour accéder à votre formation :</p>
      <ol>
        <li>Connectez-vous sur votre espace étudiant</li>
        ${isNewAccount ? "<li>Utilisez le mot de passe temporaire ci-dessus</li><li>Changez votre mot de passe après connexion</li>" : "<li>Utilisez vos identifiants habituels (ou réinitialisez-les si besoin)</li>"}
        ${whatsappGroupLink ? "<li>Rejoignez le groupe WhatsApp d'accompagnement</li>" : ""}
        <li>Commencez votre formation</li>
      </ol>

      <p style="margin-top: 30px;">À bientôt sur la plateforme !</p>
    </div>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "VisualPro <onboarding@resend.dev>",
        to: [studentEmail],
        subject: isNewAccount
          ? (resend ? "Vos accès à votre formation" : "Vos identifiants d'accès à votre formation")
          : "Accès à votre nouvelle formation",
        html: emailBody,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: formatEmailErrorMessage(result),
      };
    }

    return {
      success: true,
      message: resend
        ? "Les accès ont été renvoyés avec succès."
        : "La formation a été envoyée avec succès.",
    };
  } catch (error) {
    return {
      success: false,
      message: formatEmailErrorMessage(error),
    };
  }
}

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
    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await serviceClient.auth.getUser(token);

    if (userError || !user) {
      console.error("Auth error:", userError?.message);
      return jsonResponse({ error: "Session invalide" }, 401);
    }

    const body = (await req.json()) as RequestBody;
    const enrollmentId = body.enrollmentId?.trim();
    const courseId = body.courseId?.trim();
    const studentEmail = body.studentEmail?.trim().toLowerCase();
    const studentName = body.studentName?.trim();
    const resend = body.resend === true;

    if (!enrollmentId || !courseId || !studentEmail || !studentName) {
      return jsonResponse({ error: "Données manquantes" }, 400);
    }

    const { data: course, error: courseError } = await serviceClient
      .from("courses")
      .select("id, title, whatsapp_group_link, user_id")
      .eq("id", courseId)
      .single();

    if (courseError || !course) {
      return jsonResponse({ error: "Formation introuvable" }, 404);
    }

    if (!course.user_id || course.user_id !== user.id) {
      return jsonResponse({ error: "Vous ne pouvez pas gérer cette formation" }, 403);
    }

    const tempPassword = `${Math.random().toString(36).slice(-8)}A1!${Math.random().toString(36).slice(-2)}`;
    let userId = await findExistingUserIdByEmail(serviceClient, studentEmail);
    const isNewAccount = userId === null;

    if (!userId) {
      const { data: createdUser, error: createUserError } = await serviceClient.auth.admin.createUser({
        email: studentEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: studentName,
        },
      });

      if (createUserError) {
        if (createUserError.code !== "email_exists") {
          throw createUserError;
        }

        userId = await findExistingUserIdByEmail(serviceClient, studentEmail);

        if (!userId) {
          throw createUserError;
        }
      } else {
        userId = createdUser.user.id;
      }
    }

    if (!userId) {
      return jsonResponse({ error: "Impossible de retrouver l'utilisateur" }, 400);
    }

    // SECURITY: Never reset the password of an existing platform user.
    // Only set credentials when we just created the account; otherwise
    // leave the user's password untouched and only refresh display name.
    if (isNewAccount) {
      const { error: updateUserError } = await serviceClient.auth.admin.updateUserById(userId, {
        user_metadata: {
          full_name: studentName,
        },
      });
      if (updateUserError) {
        throw updateUserError;
      }
    }

    const { error: profileError } = await serviceClient
      .from("profiles")
      .upsert(
        {
          id: userId,
          email: studentEmail,
          full_name: studentName,
        },
        { onConflict: "id" }
      );

    if (profileError) {
      throw profileError;
    }

    const { error: accessError } = await serviceClient
      .from("student_access")
      .upsert(
        {
          user_id: userId,
          course_id: courseId,
          enrollment_id: enrollmentId,
          is_active: true,
        },
        { onConflict: "user_id,course_id" }
      );

    if (accessError) {
      throw accessError;
    }

    const emailResult = await sendStudentEmail({
      studentEmail,
      studentName,
      courseTitle: course.title,
      whatsappGroupLink: course.whatsapp_group_link,
      tempPassword: isNewAccount ? tempPassword : null,
      resend,
      isNewAccount,
    });

    return jsonResponse({
      success: emailResult.success,
      emailSent: emailResult.success,
      userId,
      message: emailResult.success
        ? emailResult.message
        : `Compte créé, mais ${emailResult.message}.`,
    });
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
    return jsonResponse({ error: errorMessage }, 400);
  }
});
