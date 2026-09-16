import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAiQuota } from "../_shared/ai-quota.ts";
import { geminiChat } from "../_shared/openrouter-chat.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const __quota = await enforceAiQuota(req, "generate-shop-content");
  if (!__quota.allowed) return __quota.response;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentification requise" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const { data: ud, error: ue } = await sb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (ue || !ud?.user) {
      return new Response(JSON.stringify({ error: "Authentification requise" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { businessDescription = "", businessName = "" } = await req.json().catch(() => ({}));

    const systemPrompt = `Tu génères du contenu pour des boutiques e-commerce africaines.
Réponds en JSON STRICT avec les champs suivants :
{
  "about_description": "description persuasive et attrayante pour la page à propos de la boutique",
  "theme": "modern",
  "primary_color": "#3b82f6",
  "secondary_color": "#7c3aed"
}
Valeurs possibles pour theme: "modern", "elegant", "vibrant".`;

    const userPrompt = `Nom de la boutique : "${businessName}"
Description fournie : ${businessDescription || "Boutique en ligne"}`;

    const { content } = await geminiChat({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      jsonMode: true,
    });

    let shopContent: any = {};
    try {
      shopContent = JSON.parse(content);
    } catch {
      shopContent = {
        about_description: businessDescription || "Bienvenue dans notre boutique en ligne.",
        theme: "modern",
        primary_color: "#3b82f6",
        secondary_color: "#7c3aed"
      };
    }

    return new Response(JSON.stringify(shopContent), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("generate-shop-content error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Erreur de génération" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});
