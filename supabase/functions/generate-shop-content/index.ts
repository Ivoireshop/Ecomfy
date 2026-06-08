import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAiQuota } from "../_shared/ai-quota.ts";

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

    const { businessDescription, businessName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Tu génères du contenu pour des boutiques e-commerce africaines. Réponds en JSON." },
          { role: "user", content: `Génère le contenu pour une boutique "${businessName}": ${businessDescription}. Retourne un JSON avec: about_description (description longue), theme (modern/elegant/vibrant), primary_color (hex), secondary_color (hex)` }
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_shop",
            description: "Generate shop content",
            parameters: {
              type: "object",
              properties: {
                about_description: { type: "string" },
                theme: { type: "string", enum: ["modern", "elegant", "vibrant"] },
                primary_color: { type: "string" },
                secondary_color: { type: "string" },
              },
              required: ["about_description", "theme", "primary_color", "secondary_color"],
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_shop" } }
      }),
    });

    if (!response.ok) throw new Error(`AI error: ${response.status}`);
    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call");
    const content = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(content), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Erreur de génération" }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});
