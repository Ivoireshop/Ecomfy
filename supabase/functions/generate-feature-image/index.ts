import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to enforce timeouts on external calls
async function fetchWithTimeout(input: Request | string, init: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 20000, ...rest } = init as any;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    const res = await fetch(input as any, { ...rest, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { prompt, productName, niche, description, benefits, container, platform, style, price, promotionalPrice, posology, productImage, personDescription } = body;
    
    if (!prompt && !productName) {
      return new Response(
        JSON.stringify({ error: 'Prompt or product information is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Build professional advertising prompt if product details provided
    let finalPrompt = prompt;
    
    if (productName) {
      finalPrompt = `You are an expert advertising visual creator specializing in the African market. 

CRITICAL: All text in the generated image MUST be in perfect French with NO spelling errors. Double-check every word for correct French orthography, grammar, and accents.

PRODUCT INFORMATION:
- Product Name: ${productName}
- Niche: ${niche || 'Général'}
- Description: ${description || ''}`;
      
      if (price && promotionalPrice) {
        finalPrompt += `\n- Promotional Price (crossed out): ${promotionalPrice}`;
        finalPrompt += `\n- Current Price: ${price} (MUST be prominently displayed with promotional price crossed out to show discount)`;
      } else if (price) {
        finalPrompt += `\n- Price: ${price} (MUST be prominently displayed on the visual)`;
      }
      
      if (benefits) {
        finalPrompt += `\n- Key Benefits: ${benefits}`;
      }
      
      if (posology) {
        finalPrompt += `\n- Dosage/Usage: ${posology} (include this information on the visual)`;
      }
      
      if (container) {
        finalPrompt += `\n- Container/Packaging: ${container}`;
      }
      
      if (personDescription) {
        finalPrompt += `\n\nPERSON/SCENE STAGING:
The user wants to feature a person with the product. Description: "${personDescription}"
- Integrate this person naturally with the product
- The person should complement and highlight the product
- Ensure authentic and professional scene`;
      }

      finalPrompt += `\n\nVISUAL STYLE:`;
      
      if (style) {
        const styleDescriptions: Record<string, string> = {
          moderne: "Modern and clean design with contemporary African aesthetics - bold typography, vibrant colors, sleek product presentation",
          luxueux: "Luxury and premium design with elegant African touches - gold accents, sophisticated palettes, refined imagery",
          humoristique: "Fun, playful style resonating with African humor - bright colors, expressive faces, relatable situations",
          traditionnel: "Traditional African style celebrating cultural heritage - authentic patterns, warm earth tones, cultural symbols",
          minimaliste: "Minimalist and clean with African warmth - simple composition, focus on product, subtle cultural elements",
          dynamique: "Dynamic and energetic style capturing African vibrancy - motion effects, bold contrasts, youthful energy",
        };
        finalPrompt += `\n${styleDescriptions[style] || style}`;
      }
      
      const platformSpecs: Record<string, string> = {
        facebook: "\n\nFacebook ad (1200x628px): eye-catching headline, clear value proposition, product prominently displayed, high contrast, mobile-first design",
        instagram: "\n\nInstagram post (1080x1080px): aesthetically pleasing, lifestyle integration, authentic African settings, bold central focus",
        tiktok: "\n\nTikTok vertical (1080x1920px): authentic feel, engaging hook in top third, product demonstration angle, youthful energy",
        all: "\n\nMulti-platform versatile: clear focal point, readable text at any size, immediate visual impact, culturally resonant",
      };
      
      if (platform) {
        finalPrompt += platformSpecs[platform] || platformSpecs.all;
      }
      
      finalPrompt += `\n\nCREATIVE EXECUTION FOR FACEBOOK ADVERTISING:
- Create a professional advertising visual optimized for social media
- Use vibrant, attention-grabbing colors that work on mobile screens
- Product must be the hero of the composition with clear visibility
- Include the product in a real-world context or lifestyle setting
- Show the product being used or its benefits in action
- Use authentic African models, settings, or cultural elements when relevant
- Professional photography quality with perfect lighting and composition
- Text overlays must be bold, readable, and in perfect French
- Create thumb-stopping impact that makes people pause their scroll
- Balance professional quality with authentic, relatable aesthetics
${promotionalPrice && price ? `- Display promotional price "${promotionalPrice}" crossed out and current price "${price}" prominently to show discount` : price ? `- Display price "${price}" prominently and legibly` : ''}
${posology ? `- Include dosage/usage "${posology}" in clear, readable format` : ''}

TEXT REQUIREMENTS (CRITICAL):
- ALL text in PERFECT French with correct spelling, grammar, and accents
- Verify every word for orthographic accuracy
- Use proper French typography and punctuation
- Ensure all accents (é, è, ê, à, ô, etc.) are correctly placed

TECHNICAL SPECIFICATIONS:
- Ultra high resolution, professional advertising photography
- Commercial product shot quality
- Optimized for social media feeds (Facebook, Instagram)
- Colors and contrast optimized for mobile screens
- All text sharp, legible, and professionally rendered
- Create a conversion-focused advertising visual with authentic African appeal

Create a stunning Facebook advertising visual that looks like a professional marketing campaign. ZERO spelling errors in French text.`;
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Generating advertising image with prompt');

    // Build message content with product image if provided
    const messageContent = productImage 
      ? [
          {
            type: "text",
            text: finalPrompt,
          },
          {
            type: "image_url",
            image_url: {
              url: productImage,
            },
          },
        ]
      : finalPrompt;

    const response = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: messageContent
          }
        ],
        modalities: ['image', 'text']
      }),
      timeoutMs: 20000,
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requêtes dépassée. Veuillez réessayer plus tard.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
        if (OPENAI_API_KEY) {
          try {
            const openaiResp = await fetch('https://api.openai.com/v1/images/generations', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-image-1',
                prompt: finalPrompt,
                size: '1024x1024',
                n: 1,
              }),
            });

            if (openaiResp.ok) {
              const openaiData = await openaiResp.json();
              const b64 = openaiData.data?.[0]?.b64_json;
              if (b64) {
                const imageUrl = `data:image/png;base64,${b64}`;
                return new Response(
                  JSON.stringify({ imageUrl }),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            } else {
              const t = await openaiResp.text();
              console.error('OpenAI images API error:', openaiResp.status, t);
            }
          } catch (e) {
            console.error('OpenAI fallback failed:', e);
          }
        }

        return new Response(
          JSON.stringify({ error: 'Crédits IA épuisés. Ajoutez des crédits ou configurez OPENAI_API_KEY pour le fallback.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received');

    // Extract the generated image
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageUrl) {
      throw new Error('No image generated in response');
    }

    return new Response(
      JSON.stringify({ imageUrl }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in generate-feature-image:', error);
    const isTimeout = (error as any)?.name === 'AbortError' || (error as any)?.message === 'timeout' || (error as any) === 'timeout';
    const status = isTimeout ? 504 : 500;
    const errorMessage = isTimeout
      ? 'Le service est temporairement lent. Réessayez dans un instant.'
      : (error instanceof Error ? error.message : 'Une erreur est survenue');
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});