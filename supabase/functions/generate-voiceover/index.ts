import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice = "Sarah" } = await req.json();
    
    if (!text) {
      throw new Error('Le texte est requis');
    }

    const ELEVEN_LABS_API_KEY = Deno.env.get('ELEVEN_LABS_API_KEY');
    if (!ELEVEN_LABS_API_KEY) {
      throw new Error('ELEVEN_LABS_API_KEY non configurée');
    }

    // Mapping des voix avec accent africain authentique
    const voiceMapping: Record<string, string> = {
      "Alice": "Xb7hH8MSUJpSbSDYk0k2", // British accent (convient pour accent anglophone africain)
      "Matilda": "XrExE9yKIg1WjnnlVkGX", // Warm female voice
      "Jessica": "cgSgspJ2msm6clMCkdW9", // Expressive female
      "Callum": "N2lVS1w4EtoT3dr4eOWO", // British male (convient pour accent anglophone africain)
      "George": "JBFqnCBsd6RMkjVDRZzb", // Warm male voice
      "Daniel": "onwK4e9ZLuTAKqWW03F9", // Deep British male
    };

    const voiceId = voiceMapping[voice] || voiceMapping["Alice"];

    console.log(`Génération de voix off avec la voix ${voice} (${voiceId})`);

    // Appel à l'API Eleven Labs
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': ELEVEN_LABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erreur Eleven Labs:', errorText);
      throw new Error(`Erreur Eleven Labs: ${response.status} - ${errorText}`);
    }

    // Convertir l'audio en base64 par morceaux pour éviter le dépassement de pile
    const audioBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(audioBuffer);
    const chunkSize = 8192;
    let binaryString = '';
    
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binaryString += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    const base64Audio = btoa(binaryString);

    return new Response(
      JSON.stringify({ 
        audioContent: base64Audio,
        voice: voice,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Erreur dans generate-voiceover:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
