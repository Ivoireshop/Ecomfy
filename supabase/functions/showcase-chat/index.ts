import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getClientIp, takeRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Rate limit (H9) : 20 req / minute / IP, 150 / heure / IP, 3000 / heure au total.
    // Refus aussi si la vérification échoue (appel facturé au modèle à chaque message).
    const ip = getClientIp(req);
    const allowed =
      (await takeRateLimit("showcase-chat:ip:min", ip, 20, 60)) &&
      (await takeRateLimit("showcase-chat:ip:hour", ip, 150, 3600)) &&
      (await takeRateLimit("showcase-chat:global", "all", 3000, 3600));
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Trop de requêtes, merci de patienter un instant." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const { messages, siteContext } = body ?? {};

    // Input validation
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20) {
      return new Response(
        JSON.stringify({ error: "Requête invalide." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const sanitizedMessages: Array<{ role: string; content: string }> = [];
    for (const m of messages) {
      if (!m || typeof m !== "object") continue;
      const role = m.role;
      const content = m.content;
      // Pas de rôle `system` venant du visiteur : il écraserait les consignes du site.
      if (role !== "user" && role !== "assistant") continue;
      if (typeof content !== "string") continue;
      if (content.length === 0 || content.length > 2000) {
        return new Response(
          JSON.stringify({ error: "Message trop long." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      sanitizedMessages.push({ role, content });
    }
    if (sanitizedMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Requête invalide." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const ctx = (siteContext && typeof siteContext === "object") ? siteContext : {};
    const s = (v: unknown, max = 500): string => {
      if (typeof v !== "string") return "";
      return v.slice(0, max);
    };
    const safeCtx = {
      businessName: s(ctx.businessName, 200) || "cette entreprise",
      businessDescription: s(ctx.businessDescription, 1000),
      ownerName: s(ctx.ownerName, 200),
      aboutDescription: s(ctx.aboutDescription, 1500),
      whatsappNumber: s(ctx.whatsappNumber, 50),
      phoneNumber: s(ctx.phoneNumber, 50),
      formationTitle: s(ctx.formationTitle, 300),
      formationDescription: s(ctx.formationDescription, 1000),
      formationPrice: s(ctx.formationPrice, 50),
      features: Array.isArray(ctx.features)
        ? ctx.features.slice(0, 30).map((f: any) => ({
            title: s(f?.title, 200),
            description: s(f?.description, 500),
          }))
        : null,
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build system prompt with site context
    const systemPrompt = `Tu es un assistant virtuel intelligent pour ${safeCtx.businessName}. 
    
Informations sur l'entreprise:
- Nom: ${safeCtx.businessName}
- Description: ${safeCtx.businessDescription || "Non disponible"}
- Propriétaire: ${safeCtx.ownerName}
- À propos: ${safeCtx.aboutDescription || "Non disponible"}
${safeCtx.features ? `- Services/Caractéristiques: ${safeCtx.features.map((f: { title: string; description: string }) => `${f.title}: ${f.description}`).join(', ')}` : ''}
${safeCtx.formationTitle ? `- Formation: ${safeCtx.formationTitle} - ${safeCtx.formationDescription} (${safeCtx.formationPrice})` : ''}

Contacts:
- WhatsApp: ${safeCtx.whatsappNumber}
- Téléphone: ${safeCtx.phoneNumber}

Ton rôle:
1. Répondre aux questions sur l'entreprise et ses services
2. Être courtois, professionnel et utile
3. Si tu ne connais pas la réponse ou si la question est trop complexe, inviter poliment la personne à contacter directement l'équipe via WhatsApp (${safeCtx.whatsappNumber}) ou le formulaire de contact
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
          ...sanitizedMessages,
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
