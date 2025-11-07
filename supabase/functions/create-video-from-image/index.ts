import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, audioBase64, duration = 10 } = await req.json();
    
    if (!imageUrl || !audioBase64) {
      throw new Error('Image URL et audio requis');
    }

    const REPLICATE_API_KEY = Deno.env.get('REPLICATE_API_KEY');
    if (!REPLICATE_API_KEY) {
      throw new Error('REPLICATE_API_KEY non configurée');
    }

    console.log('Création de la vidéo avec image et audio...');

    // Télécharger l'image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('Impossible de télécharger l\'image');
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBase64 = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));

    // Créer une vidéo statique avec l'audio en utilisant Replicate
    const replicateResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: "3abd7b78a4e8c5f2d6d9b5f8c7a4b3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6",
        input: {
          image: `data:image/png;base64,${imageBase64}`,
          audio: `data:audio/mpeg;base64,${audioBase64}`,
          duration: duration,
        }
      }),
    });

    if (!replicateResponse.ok) {
      const errorText = await replicateResponse.text();
      console.error('Erreur Replicate:', errorText);
      
      // Fallback: créer une vidéo simple en uploadant l'image sur Supabase
      // et retourner les URLs pour que le client puisse les combiner
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Uploader l'audio en MP3
      const audioBuffer = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
      const audioFileName = `audio-${Date.now()}.mp3`;
      const { data: audioData, error: audioError } = await supabase.storage
        .from('generated-content')
        .upload(audioFileName, audioBuffer, {
          contentType: 'audio/mpeg',
          cacheControl: '3600',
        });

      if (audioError) throw audioError;

      const { data: audioUrlData } = supabase.storage
        .from('generated-content')
        .getPublicUrl(audioFileName);

      return new Response(
        JSON.stringify({ 
          videoUrl: null,
          imageUrl: imageUrl,
          audioUrl: audioUrlData.publicUrl,
          message: 'Vidéo non disponible, utilisez l\'image et l\'audio séparément'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const prediction = await replicateResponse.json();
    
    // Attendre que la vidéo soit générée (max 60 secondes)
    let videoUrl = null;
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts && !videoUrl) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: {
            'Authorization': `Token ${REPLICATE_API_KEY}`,
          },
        }
      );

      const status = await statusResponse.json();
      
      if (status.status === 'succeeded') {
        videoUrl = status.output;
        break;
      } else if (status.status === 'failed') {
        throw new Error('Échec de la génération de la vidéo');
      }
      
      attempts++;
    }

    if (!videoUrl) {
      throw new Error('Délai d\'attente dépassé pour la génération de la vidéo');
    }

    return new Response(
      JSON.stringify({ 
        videoUrl: videoUrl,
        message: 'Vidéo créée avec succès'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Erreur dans create-video-from-image:', error);
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
