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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Non authentifié');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Utilisateur non authentifié');
    }

    const { imageUrl, audioBase64, audioUrl, duration = 10 } = await req.json();
    
    if (!imageUrl || (!audioBase64 && !audioUrl)) {
      throw new Error('Image URL et audio requis');
    }

    const CLOUDINARY_URL = Deno.env.get('CLOUDINARY_URL');
    if (!CLOUDINARY_URL) {
      throw new Error('CLOUDINARY_URL non configurée');
    }

    console.log('Création vidéo MP4 professionnelle avec Cloudinary...');

    // Parse Cloudinary credentials from URL: cloudinary://api_key:api_secret@cloud_name
    const cloudinaryMatch = CLOUDINARY_URL.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
    if (!cloudinaryMatch) {
      throw new Error('Format CLOUDINARY_URL invalide');
    }
    const [, apiKey, apiSecret, cloudName] = cloudinaryMatch;

    // Upload image to Cloudinary
    console.log('Upload de l\'image vers Cloudinary...');
    const imageUploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const imageFormData = new FormData();
    
    let imageBlob: Blob;
    if (imageUrl.startsWith('data:')) {
      // Data URL - convert to blob
      const base64Data = imageUrl.split(',')[1];
      const mimeMatch = imageUrl.match(/^data:(image\/[^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      const byteString = atob(base64Data);
      const byteArray = new Uint8Array(byteString.length);
      for (let i = 0; i < byteString.length; i++) {
        byteArray[i] = byteString.charCodeAt(i);
      }
      imageBlob = new Blob([byteArray], { type: mimeType });
    } else {
      // Public URL - fetch and convert to blob
      const imgResp = await fetch(imageUrl);
      if (!imgResp.ok) throw new Error('Impossible de télécharger l\'image');
      imageBlob = await imgResp.blob();
    }
    
    imageFormData.append('file', imageBlob);
    imageFormData.append('upload_preset', 'ml_default');
    imageFormData.append('api_key', apiKey);
    
    const imageUploadResp = await fetch(imageUploadUrl, {
      method: 'POST',
      body: imageFormData,
    });
    
    if (!imageUploadResp.ok) {
      const errorText = await imageUploadResp.text();
      console.error('Erreur upload image Cloudinary:', errorText);
      throw new Error('Échec upload image sur Cloudinary');
    }
    
    const imageData = await imageUploadResp.json();
    const imagePublicId = imageData.public_id;
    console.log('Image uploadée:', imagePublicId);

    // Upload audio to Cloudinary
    console.log('Upload de l\'audio vers Cloudinary...');
    const audioUploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
    const audioFormData = new FormData();
    
    let audioBlob: Blob;
    if (audioUrl) {
      // Fetch from URL
      const audResp = await fetch(audioUrl);
      if (!audResp.ok) throw new Error('Impossible de télécharger l\'audio');
      audioBlob = await audResp.blob();
    } else if (audioBase64) {
      // Convert base64 to blob
      const audioBinary = atob(audioBase64);
      const audioArray = new Uint8Array(audioBinary.length);
      for (let i = 0; i < audioBinary.length; i++) {
        audioArray[i] = audioBinary.charCodeAt(i);
      }
      audioBlob = new Blob([audioArray], { type: 'audio/mpeg' });
    } else {
      throw new Error('Aucune source audio valide');
    }
    
    audioFormData.append('file', audioBlob);
    audioFormData.append('upload_preset', 'ml_default');
    audioFormData.append('api_key', apiKey);
    audioFormData.append('resource_type', 'video');
    
    const audioUploadResp = await fetch(audioUploadUrl, {
      method: 'POST',
      body: audioFormData,
    });
    
    if (!audioUploadResp.ok) {
      const errorText = await audioUploadResp.text();
      console.error('Erreur upload audio Cloudinary:', errorText);
      throw new Error('Échec upload audio sur Cloudinary');
    }
    
    const audioData = await audioUploadResp.json();
    const audioPublicId = audioData.public_id;
    const audioDuration = audioData.duration || duration;
    console.log('Audio uploadé:', audioPublicId, 'durée:', audioDuration);

    // Create video with image + audio using Cloudinary transformation
    console.log('Création de la vidéo MP4 avec muxing audio/vidéo...');
    
    // Build transformation: image as video background + audio overlay
    const videoTransformationUrl = `https://res.cloudinary.com/${cloudName}/video/upload/` +
      `du_${Math.ceil(audioDuration)},` + // Duration matches audio
      `l_${audioPublicId.replace(/\//g, ':')},fl_layer_apply,fl_splice/` + // Audio layer
      `${imagePublicId}.mp4`; // Convert image to MP4
    
    console.log('URL vidéo générée:', videoTransformationUrl);
    
    // Verify the video is accessible
    const videoCheckResp = await fetch(videoTransformationUrl, { method: 'HEAD' });
    if (!videoCheckResp.ok) {
      console.warn('Vidéo Cloudinary pas encore disponible, attente...');
      // Wait a bit for Cloudinary processing
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    const videoUrl = videoTransformationUrl;

    // Décrémenter le compteur de vidéos gratuites pour les utilisateurs non-fondateurs
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isFounder = roles?.some(r => r.role === 'founder' || r.role === 'co_founder');

    if (!isFounder) {
      // Vérifier l'abonnement
      const { data: subscription } = await supabaseClient
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .single();

      const hasActiveSubscription = subscription?.status === 'active';

      // Décrémenter uniquement si pas d'abonnement actif
      if (!hasActiveSubscription) {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('free_video_generations_remaining')
          .eq('id', user.id)
          .single();

        if (profile && profile.free_video_generations_remaining > 0) {
          await supabaseClient
            .from('profiles')
            .update({ 
              free_video_generations_remaining: profile.free_video_generations_remaining - 1 
            })
            .eq('id', user.id);
        }
      }
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
