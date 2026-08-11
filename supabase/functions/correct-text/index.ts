import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceAiQuota } from "../_shared/ai-quota.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  const __quota = await enforceAiQuota(req, "correct-text");
  if (!__quota.allowed) return __quota.response;


  try {
    // Require authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authentification requise" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Authentification requise" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { text } = await req.json();
    
    if (!text || typeof text !== 'string') {
      throw new Error('Texte invalide');
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY n'est pas configuré");
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

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-1.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
        max_completion_tokens: 800,
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
      console.error("Erreur AI gateway:", response.status, errorText);
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
