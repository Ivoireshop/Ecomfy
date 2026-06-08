import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { enforceAiQuota } from "../_shared/ai-quota.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  const __quota = await enforceAiQuota(req, "create-video-from-image");
  if (!__quota.allowed) return __quota.response;


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

    const body = await req.json();
    const { imageUrl, audioBase64, audioUrl, duration = 10 } = body;
    console.log('Payload reçu pour create-video-from-image', {
      hasImageUrl: !!imageUrl,
      hasAudioBase64: !!audioBase64,
      hasAudioUrl: !!audioUrl,
      duration
    });
    
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
      if (audioUrl.startsWith('data:')) {
        // Data URL - convert to blob
        const base64Data = audioUrl.split(',')[1];
        const mimeMatch = audioUrl.match(/^data:(audio\/[^;]+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'audio/mpeg';
        const byteString = atob(base64Data);
        const audioArray = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
          audioArray[i] = byteString.charCodeAt(i);
        }
        audioBlob = new Blob([audioArray], { type: mimeType });
      } else {
        // Fetch from URL
        const audResp = await fetch(audioUrl);
        if (!audResp.ok) throw new Error('Impossible de télécharger l\'audio');
        audioBlob = await audResp.blob();
      }
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
      `e_loop:du_${Math.ceil(audioDuration)},` + // Loop image to match audio duration
      `l_video:${audioPublicId.replace(/\//g, ':')},fl_layer_apply/` + // Add audio track
      `${imagePublicId}.mp4`; // Render as MP4
    
    console.log('URL vidéo générée:', videoTransformationUrl);
    
    // Poll for video availability (Cloudinary may take a moment)
    let available = false;
    for (let i = 0; i < 3; i++) {
      const head = await fetch(videoTransformationUrl, { method: 'HEAD' });
      if (head.ok) { available = true; break; }
      console.warn('Vidéo Cloudinary pas encore disponible, nouvelle tentative...', i + 1);
      await new Promise(r => setTimeout(r, 3000));
    }
    
    const videoUrl = videoTransformationUrl;

    // Télécharger la vidéo depuis Cloudinary et l'uploader dans le bucket
    console.log('Téléchargement de la vidéo depuis Cloudinary pour stockage...');
    const videoResp = await fetch(videoUrl);
    if (!videoResp.ok) throw new Error('Impossible de télécharger la vidéo depuis Cloudinary');
    const videoBlob = await videoResp.blob();
    
    // Upload vers le bucket generated-content
    const videoPath = `${user.id}/videos/video-${Date.now()}.mp4`;
    const { error: uploadError } = await supabaseClient.storage
      .from('generated-content')
      .upload(videoPath, videoBlob, { contentType: 'video/mp4', upsert: true });
    
    if (uploadError) throw uploadError;
    
    // Obtenir l'URL publique
    const { data: publicUrlData } = supabaseClient.storage
      .from('generated-content')
      .getPublicUrl(videoPath);
    
    const publicVideoUrl = publicUrlData.publicUrl;
    console.log('Vidéo uploadée dans le bucket:', publicVideoUrl);

    // Créer une entrée dans generated_videos
    const { data: videoRecord, error: insertError } = await supabaseClient
      .from('generated_videos')
      .insert({
        user_id: user.id,
        video_url: publicVideoUrl,
        prompt: 'Vidéo MP4 créée à partir d\'image et voix off',
        status: 'completed',
        product_details: {
          imageUrl,
          audioDuration: Math.ceil(audioDuration),
          createdAt: new Date().toISOString()
        }
      })
      .select()
      .single();
    
    if (insertError) throw insertError;
    console.log('Vidéo enregistrée dans la bibliothèque:', videoRecord.id);

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
        videoUrl: publicVideoUrl,
        videoId: videoRecord.id,
        message: 'Vidéo créée et sauvegardée dans la bibliothèque'
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
