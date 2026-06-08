import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAiQuota } from "../_shared/ai-quota.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateRequest {
  businessDescription: string;
  ownerName: string;
  whatsappNumber: string;
  phoneNumber: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  const __quota = await enforceAiQuota(req, "generate-showcase-site");
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

    const { businessDescription, ownerName, whatsappNumber, phoneNumber }: GenerateRequest = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating showcase site with AI...");

    const systemPrompt = `Tu es un expert en création de sites vitrines professionnels de style HubSpot. Tu génères du contenu de haute qualité, persuasif et professionnel pour des sites web d'entreprises et de formateurs.

Règles importantes:
1. Génère du contenu en français de qualité professionnelle
2. Utilise un ton persuasif mais authentique
3. Structure le contenu avec des sections claires
4. Inclus des appels à l'action (CTA) convaincants
5. Focalise sur les bénéfices pour le client
6. Utilise des titres accrocheurs et des descriptions engageantes
7. Adapte le contenu au marché africain si pertinent`;

    const userPrompt = `Génère le contenu complet pour un site vitrine professionnel basé sur cette description:

Description de l'entreprise/formation: ${businessDescription}
Nom du propriétaire: ${ownerName}

Le site doit inclure:
1. Un titre principal accrocheur (hero_title)
2. Un sous-titre persuasif (hero_subtitle)
3. Une description détaillée des services/formations (about_title, about_description)
4. 3-4 caractéristiques/avantages clés avec titres et descriptions (features array)
5. Un appel à l'action final convaincant (cta_title, cta_description)
6. Si c'est une formation: titre, description complète et prix suggéré (formation object)
7. Un thème visuel adapté au type d'activité (professional/creative/modern/elegant/vibrant)
8. Des couleurs primaire et secondaire harmonieuses en hex qui correspondent au secteur

Génère du contenu professionnel et authentique qui convertit les visiteurs en clients.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_showcase_content",
              description: "Generate professional showcase website content",
              parameters: {
                type: "object",
                properties: {
                  hero_title: {
                    type: "string",
                    description: "Main headline for the hero section (50-80 chars)"
                  },
                  hero_subtitle: {
                    type: "string",
                    description: "Subtitle for hero section (100-150 chars)"
                  },
                  about_title: {
                    type: "string",
                    description: "Title for about/services section"
                  },
                  about_description: {
                    type: "string",
                    description: "Detailed description of services/business (200-300 words)"
                  },
                  features: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" }
                      },
                      required: ["title", "description"]
                    },
                    description: "3-4 key features or benefits"
                  },
                  cta_title: {
                    type: "string",
                    description: "Final call-to-action section title"
                  },
                  cta_description: {
                    type: "string",
                    description: "CTA section description"
                  },
                  formation: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      price: { type: "string" }
                    },
                    description: "Formation details if applicable, null otherwise"
                  },
                  theme: {
                    type: "string",
                    enum: ["professional", "creative", "modern", "elegant", "vibrant"],
                    description: "Visual theme that best fits the business type"
                  },
                  primary_color: {
                    type: "string",
                    description: "Primary color in hex format (e.g., #2563eb)"
                  },
                  secondary_color: {
                    type: "string",
                    description: "Secondary color in hex format (e.g., #7c3aed)"
                  }
                },
                required: ["hero_title", "hero_subtitle", "about_title", "about_description", "features", "cta_title", "cta_description", "theme", "primary_color", "secondary_color"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "generate_showcase_content" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requêtes atteinte. Veuillez réessayer dans quelques instants." }), 
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits insuffisants. Veuillez recharger votre compte Lovable AI." }), 
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    console.log("AI Response received");
    
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const generatedContent = JSON.parse(toolCall.function.arguments);
    
    // Add contact information
    generatedContent.owner_name = ownerName;
    generatedContent.whatsapp_number = whatsappNumber;
    generatedContent.phone_number = phoneNumber;

    console.log("Site content generated successfully");

    return new Response(
      JSON.stringify(generatedContent),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Une erreur est survenue" }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});