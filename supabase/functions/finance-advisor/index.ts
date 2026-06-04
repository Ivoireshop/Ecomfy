import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ success: false, error: "Non authentifié" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { stats } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "AI non configurée" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `Tu es un comptable expert pour e-commerçants africains (FCFA). Analyse ces chiffres et donne 4 conseils concrets, courts (1-2 phrases chacun), avec emojis. Sois direct, bienveillant, sans jargon.

Données boutique:
${JSON.stringify(stats, null, 2)}

Réponds en français, format markdown avec puces.`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      let error = `Service IA indisponible (code ${r.status}). Réessayez dans un instant.`;
      if (r.status === 429) {
        error = "Trop de demandes en peu de temps. Patientez une minute puis réessayez.";
      } else if (r.status === 402) {
        error = "Le crédit IA mensuel de la plateforme est épuisé. L'équipe VisualPro a été notifiée — réessayez plus tard ou contactez le support.";
      }
      console.error("finance-advisor AI error", r.status, t);
      return new Response(JSON.stringify({ success: false, error }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await r.json();
    const advice = data.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ success: true, advice }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});