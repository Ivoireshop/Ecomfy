import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Rate limit per IP: 20 messages / 60s
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: rl } = await admin.rpc('check_rate_limit', {
      _bucket: 'shop-chatbot', _key: ip, _max: 20, _window_seconds: 60,
    });
    if (rl && (rl as any).allowed === false) {
      return new Response(JSON.stringify({ reply: "Trop de messages, merci de patienter un instant." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const { message, shopName, shopDescription, products } = await req.json();
    if (typeof message !== 'string' || message.trim().length === 0 || message.length > 1000) {
      return new Response(JSON.stringify({ reply: "Message invalide." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const productList = (products || []).map((p: any) => `- ${p.name}: ${p.price} FCFA${p.description ? ` (${p.description})` : ""}`).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Tu es l'assistant de la boutique "${shopName}". ${shopDescription || ""}\n\nProduits disponibles:\n${productList}\n\nRègles:\n- Réponds en français, sois amical et utile\n- Aide les clients avec des questions sur les produits, prix, disponibilité\n- Recommande des produits pertinents\n- Sois concis (2-3 phrases max)\n- Si on te pose des questions hors sujet, redirige poliment vers les produits`
          },
          { role: "user", content: message }
        ],
        max_tokens: 300,
      }),
    });

    if (!response.ok) throw new Error(`AI error: ${response.status}`);
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Je suis désolé, je n'ai pas pu traiter votre demande.";

    return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ reply: "Désolé, une erreur s'est produite. Contactez le vendeur directement." }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  }
});
