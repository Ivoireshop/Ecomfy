import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAiQuota } from "../_shared/ai-quota.ts";
import { getOpenAiApiKey } from "../_shared/openai-key.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_TEXT_CHARS = 4000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  const __quota = await enforceAiQuota(req, "correct-text", 30);
  if (!__quota.allowed) return __quota.response;

  try {
    const { text } = await req.json();

    if (typeof text === 'string' && text.length > MAX_TEXT_CHARS) {
      return new Response(
        JSON.stringify({ error: `Texte trop long (${MAX_TEXT_CHARS} caractères maximum)` }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ correctedText: text || "" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = getOpenAiApiKey();
    if (!OPENAI_API_KEY) {
      // Fallback gracieux si aucune clé
      return new Response(
        JSON.stringify({ correctedText: text }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Tu es un correcteur de texte professionnel spécialisé dans la correction de textes publicitaires et marketing en français.

Ton rôle est de corriger TOUTES les erreurs présentes dans le texte fourni :
- Fautes d'orthographe
- Erreurs de grammaire
- Fautes de conjugaison
- Erreurs de syntaxe
- Formulations maladroites
- Erreurs de vocabulaire

RÈGLES IMPORTANTES :
1. Conserve le sens original et l'intention du message
2. Garde le même ton (publicitaire, promotionnel, informatif)
3. Ne change pas les noms de marques ou produits
4. Produis un texte parfait, fluide et professionnel
5. Si le texte contient des prix, garde-les exactement comme ils sont
6. Retourne UNIQUEMENT le texte corrigé, sans explications ni commentaires

Le texte corrigé doit être prêt à être utilisé directement dans un contexte professionnel.`;

    // L'appel au modèle avait été supprimé par erreur le 29/08/2026 (commit 0595507) : `response`
    // n'était plus défini et la fonction échouait systématiquement.
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requêtes atteinte. Veuillez réessayer dans quelques instants." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Erreur OpenAI:", response.status, errorText);
      throw new Error("Erreur lors de la correction du texte");
    }

    const data = await response.json();
    const correctedText = data.choices?.[0]?.message?.content;

    if (!correctedText) {
      throw new Error("Aucune correction générée");
    }

    return new Response(
      JSON.stringify({ correctedText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Erreur dans correct-text:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Une erreur est survenue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
