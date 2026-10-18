import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getClientIp, takeRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Rate limit (H9) : 20 messages / minute / IP, 200 / heure / IP, 2000 / heure au total.
    // Refus aussi si la vérification échoue (appel facturé au modèle à chaque message).
    const ip = getClientIp(req);
    const allowed =
      (await takeRateLimit('shop-chatbot:ip:min', ip, 20, 60)) &&
      (await takeRateLimit('shop-chatbot:ip:hour', ip, 200, 3600)) &&
      (await takeRateLimit('shop-chatbot:global', 'all', 2000, 3600));
    if (!allowed) {
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

    // Le catalogue vient du navigateur : on borne sa taille avant de le copier dans la consigne.
    const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);
    const productList = (Array.isArray(products) ? products : []).slice(0, 30)
      .map((p: any) => `- ${clip(p?.name, 100)}: ${clip(p?.price, 20)} FCFA${p?.description ? ` (${clip(p.description, 200)})` : ""}`).join("\n");
    const safeShopName = clip(shopName, 100);
    const safeShopDescription = clip(shopDescription, 500);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Tu es l'assistant de la boutique "${safeShopName}". ${safeShopDescription}\n\nProduits disponibles:\n${productList}\n\nRègles:\n- Réponds en français, sois amical et utile\n- Aide les clients avec des questions sur les produits, prix, disponibilité\n- Recommande des produits pertinents\n- Sois concis (2-3 phrases max)\n- Si on te pose des questions hors sujet, redirige poliment vers les produits`
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
