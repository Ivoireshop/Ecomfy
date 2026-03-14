import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { message, shopName, shopDescription, products } = await req.json();
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
