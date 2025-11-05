import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, siteContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build system prompt with site context
    const systemPrompt = `Tu es un assistant virtuel intelligent pour ${siteContext.businessName}. 
    
Informations sur l'entreprise:
- Nom: ${siteContext.businessName}
- Description: ${siteContext.businessDescription || "Non disponible"}
- Propriétaire: ${siteContext.ownerName}
- À propos: ${siteContext.aboutDescription || "Non disponible"}
${siteContext.features ? `- Services/Caractéristiques: ${siteContext.features.map((f: any) => `${f.title}: ${f.description}`).join(', ')}` : ''}
${siteContext.formationTitle ? `- Formation: ${siteContext.formationTitle} - ${siteContext.formationDescription} (${siteContext.formationPrice})` : ''}

Contacts:
- WhatsApp: ${siteContext.whatsappNumber}
- Téléphone: ${siteContext.phoneNumber}

Ton rôle:
1. Répondre aux questions sur l'entreprise et ses services
2. Être courtois, professionnel et utile
3. Si tu ne connais pas la réponse ou si la question est trop complexe, inviter poliment la personne à contacter directement l'équipe via WhatsApp (${siteContext.whatsappNumber}) ou le formulaire de contact
4. Rester dans le contexte de l'entreprise
5. Parler en français

Réponds de manière concise et claire.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requêtes atteinte, veuillez réessayer plus tard." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporairement indisponible." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
