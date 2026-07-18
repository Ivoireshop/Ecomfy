import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeHtml(input: unknown): string {
  return String(input ?? "").replace(/[&<>"'`\/]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "`": "&#96;",
    "/": "&#47;",
  }[c] as string));
}

function generateCertificateHTML(
  studentNameRaw: string,
  courseTitleRaw: string,
  completionDateRaw: string,
  certificateNumberRaw: string,
  logoUrlRaw: string | null,
  businessNameRaw: string,
  ownerNameRaw: string,
  verificationUrlRaw: string
): string {
  // HTML-escape every interpolated value to prevent stored XSS in shareable
  // certificate pages (student-controlled full_name would otherwise execute).
  const studentName = escapeHtml(studentNameRaw);
  const courseTitle = escapeHtml(courseTitleRaw);
  const completionDate = escapeHtml(completionDateRaw);
  const certificateNumber = escapeHtml(certificateNumberRaw);
  const businessName = escapeHtml(businessNameRaw);
  const ownerName = escapeHtml(ownerNameRaw);
  // Only allow http(s) logo URLs; drop anything else (e.g. javascript:).
  const safeLogoUrl =
    typeof logoUrlRaw === "string" && /^https?:\/\//i.test(logoUrlRaw)
      ? escapeHtml(logoUrlRaw)
      : null;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(String(verificationUrlRaw ?? ""))}`;
  
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
      border: 8px double #2563eb;
      padding: 20mm;
      position: relative;
      box-sizing: border-box;
      background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    }
    .inner-border {
      border: 3px solid #2563eb;
      padding: 15mm;
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }
    .logo {
      position: absolute;
      top: 20px;
      left: 20px;
      max-width: 120px;
      max-height: 80px;
      object-fit: contain;
    }
    .qr-code {
      position: absolute;
      top: 20px;
      right: 20px;
      width: 100px;
      height: 100px;
      border: 2px solid #2563eb;
      padding: 5px;
      background: white;
    }
    .header { text-align: center; margin-bottom: 10mm; margin-top: 30px; }
    .title {
      font-size: 52px;
      color: #2563eb;
      font-weight: bold;
      margin: 0;
      letter-spacing: 6px;
      text-transform: uppercase;
      text-shadow: 2px 2px 4px rgba(37, 99, 235, 0.1);
    }
    .subtitle {
      font-size: 18px;
      color: #7c3aed;
      margin-top: 10px;
      font-style: italic;
    }
    .divider {
      width: 250px;
      height: 4px;
      background: linear-gradient(to right, transparent, #2563eb, #7c3aed, #2563eb, transparent);
      margin: 15px auto;
    }
    .content {
      text-align: center;
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 20px;
    }
    .certifies { font-size: 22px; color: #555; font-weight: 500; }
    .student-name {
      font-size: 42px;
      font-weight: bold;
      color: #1e293b;
      border-bottom: 3px solid #2563eb;
      display: inline-block;
      padding: 10px 60px;
      margin: 15px 0;
      text-transform: capitalize;
    }
    .completion-text { font-size: 22px; color: #555; font-weight: 500; }
    .course-title {
      font-size: 32px;
      color: #2563eb;
      font-weight: bold;
      margin: 20px 0;
      font-style: italic;
      line-height: 1.4;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 15mm;
      padding-top: 10px;
      border-top: 2px solid #e2e8f0;
    }
    .left-footer {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
    .date { font-size: 16px; color: #666; margin: 5px 0; }
    .certificate-number { 
      font-size: 14px; 
      color: #2563eb; 
      font-weight: bold;
      margin: 5px 0;
    }
    .business-name {
      font-size: 14px;
      color: #888;
      margin: 5px 0;
    }
    .signature-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    .signature-box {
      width: 180px;
      height: 60px;
      border: 2px solid #2563eb;
      background: linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .signature-text {
      font-family: 'Brush Script MT', cursive;
      font-size: 28px;
      color: #2563eb;
      font-weight: bold;
    }
    .signature-label {
      font-size: 12px;
      color: #666;
      text-align: center;
    }
    .signature-name {
      font-size: 14px;
      color: #1e293b;
      font-weight: bold;
      text-align: center;
    }
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 120px;
      color: rgba(37, 99, 235, 0.03);
      font-weight: bold;
      pointer-events: none;
      z-index: 0;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="inner-border">
      <div class="watermark">CERTIFIÉ</div>
      ${safeLogoUrl ? `<img src="${safeLogoUrl}" alt="Logo" class="logo" />` : ''}
      <img src="${escapeHtml(qrCodeUrl)}" alt="QR Code" class="qr-code" />
      
      <div class="header">
        <h1 class="title">Certificat de Formation</h1>
        <p class="subtitle">Attestation Officielle de Complétion</p>
        <div class="divider"></div>
      </div>
      
      <div class="content">
        <p class="certifies">Ce certificat atteste officiellement que</p>
        <div class="student-name">${studentName}</div>
        <p class="completion-text">a complété avec succès la formation</p>
        <div class="course-title">"${courseTitle}"</div>
      </div>
      
      <div class="footer">
        <div class="left-footer">
          <p class="certificate-number">Certificat N° ${certificateNumber}</p>
          <p class="date">Délivré le ${completionDate}</p>
          <p class="business-name">${businessName}</p>
        </div>
        <div class="signature-section">
          <div class="signature-box">
            <span class="signature-text">${ownerName}</span>
          </div>
          <p class="signature-label">Signature autorisée</p>
          <p class="signature-name">${ownerName}</p>
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

    // Récupérer détails du cours et du site
    const { data: course } = await supabaseClient
      .from("courses")
      .select("title, showcase_site_id")
      .eq("id", courseId)
      .single();

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const { data: showcaseSite } = await supabaseClient
      .from("showcase_sites")
      .select("logo_url, business_name, owner_name")
      .eq("id", course?.showcase_site_id)
      .single();

    const studentName = profile?.full_name || profile?.email || "Étudiant";
    const businessName = showcaseSite?.business_name || "Formation";
    const ownerName = showcaseSite?.owner_name || "Formateur";

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

    // URL de vérification du certificat
    const verificationUrl = `${Deno.env.get("SUPABASE_URL")}/verify-certificate/${certNumber}`;

    // Générer HTML
    const certificateHTML = generateCertificateHTML(
      studentName,
      course?.title || "Formation",
      completionDate,
      certNumber,
      showcaseSite?.logo_url || null,
      businessName,
      ownerName,
      verificationUrl
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
