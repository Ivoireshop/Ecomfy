import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateCertificateHTML(
  studentName: string,
  courseTitle: string,
  completionDate: string,
  certificateNumber: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4 landscape; margin: 0; }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Times New Roman', serif;
      width: 297mm;
      height: 210mm;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
    }
    .certificate {
      width: 280mm;
      height: 195mm;
      border: 6px double #2563eb;
      padding: 20mm;
      position: relative;
      box-sizing: border-box;
    }
    .inner-border {
      border: 2px solid #2563eb;
      padding: 15mm;
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .header { text-align: center; margin-bottom: 15mm; }
    .title {
      font-size: 48px;
      color: #2563eb;
      font-weight: bold;
      margin: 0;
      letter-spacing: 4px;
    }
    .divider {
      width: 200px;
      height: 3px;
      background: linear-gradient(to right, transparent, #888, transparent);
      margin: 10px auto;
    }
    .content {
      text-align: center;
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 15px;
    }
    .certifies { font-size: 20px; color: #555; }
    .student-name {
      font-size: 36px;
      font-weight: bold;
      color: #000;
      border-bottom: 2px solid #888;
      display: inline-block;
      padding: 5px 50px;
      margin: 10px 0;
    }
    .completion-text { font-size: 20px; color: #555; }
    .course-title {
      font-size: 28px;
      color: #2563eb;
      font-weight: bold;
      margin: 15px 0;
      font-style: italic;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 20mm;
    }
    .date { font-size: 16px; color: #666; }
    .certificate-number { font-size: 12px; color: #888; }
    .signature-line { text-align: right; }
    .signature-text { font-size: 14px; color: #666; margin-bottom: 5px; }
    .line {
      width: 150px;
      border-top: 1px solid #888;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="inner-border">
      <div class="header">
        <h1 class="title">CERTIFICAT DE FORMATION</h1>
        <div class="divider"></div>
      </div>
      <div class="content">
        <p class="certifies">Ce certificat atteste que</p>
        <div class="student-name">${studentName}</div>
        <p class="completion-text">a complété avec succès la formation</p>
        <div class="course-title">"${courseTitle}"</div>
      </div>
      <div class="footer">
        <div>
          <p class="certificate-number">N° ${certificateNumber}</p>
          <p class="date">Délivré le ${completionDate}</p>
        </div>
        <div class="signature-line">
          <p class="signature-text">Signature autorisée</p>
          <div class="line"></div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { courseId } = await req.json();
    if (!courseId) {
      return new Response(JSON.stringify({ error: "Course ID required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generating certificate for user ${user.id}, course ${courseId}`);

    // Vérifier complétion
    const { data: progressData, error: progressError } = await supabaseClient
      .from("student_progress")
      .select("*")
      .eq("user_id", user.id)
      .eq("course_id", courseId);

    if (progressError) throw progressError;

    const completedCount = progressData?.filter((p) => p.is_completed).length || 0;
    const totalCount = progressData?.length || 1;
    const completionPercentage = (completedCount / totalCount) * 100;

    if (completionPercentage < 100) {
      return new Response(
        JSON.stringify({ error: "Formation non complétée", completionPercentage }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Récupérer détails
    const { data: course } = await supabaseClient
      .from("courses")
      .select("title")
      .eq("id", courseId)
      .single();

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const studentName = profile?.full_name || profile?.email || "Étudiant";

    // Vérifier si existe
    const { data: existingCert } = await supabaseClient
      .from("course_certificates")
      .select("certificate_url, certificate_number")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .single();

    if (existingCert) {
      return new Response(
        JSON.stringify({
          success: true,
          certificateUrl: existingCert.certificate_url,
          certificateNumber: existingCert.certificate_number,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Générer numéro
    const { data: certNumber } = await supabaseClient.rpc("generate_certificate_number");

    const completionDate = new Date().toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // Générer HTML
    const certificateHTML = generateCertificateHTML(
      studentName,
      course?.title || "Formation",
      completionDate,
      certNumber
    );

    const fileName = `certificate-${user.id}-${courseId}-${Date.now()}.html`;
    const filePath = `certificates/${fileName}`;

    // Upload
    const { error: uploadError } = await supabaseClient.storage
      .from("generated-content")
      .upload(filePath, certificateHTML, {
        contentType: "text/html",
        cacheControl: "3600",
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabaseClient.storage
      .from("generated-content")
      .getPublicUrl(filePath);

    const certificateUrl = urlData.publicUrl;

    // Enregistrer
    await supabaseClient.from("course_certificates").insert({
      user_id: user.id,
      course_id: courseId,
      student_name: studentName,
      course_title: course?.title || "Formation",
      certificate_url: certificateUrl,
      certificate_number: certNumber,
      completion_date: new Date().toISOString(),
    });

    console.log(`Certificate generated: ${certificateUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        certificateUrl,
        certificateNumber: certNumber,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    const error = err as Error;
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
