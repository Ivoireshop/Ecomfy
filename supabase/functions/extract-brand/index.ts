import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Extracting brand data from:", url);

    // Fetch the website HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VisualPro-BrandExtractor/1.0)',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.statusText}`);
    }

    const html = await response.text();

    // Extract product-focused data first
    const productInfo = extractProductInfo(html, url);

    // Build basic brand data prioritizing the specific page content
    const basicBrandData = {
      colors: extractColors(html),
      fonts: extractFonts(html),
      logo: extractLogo(html, url),
      images: Array.from(new Set([...(productInfo.images || []).map((i: string) => resolveUrl(i, url)), ...extractImages(html, url)])).slice(0, 10),
      companyName: productInfo.brandName || extractCompanyName(html),
      description: productInfo.description || extractDescription(html),
    };

    console.log("Basic brand data extracted:", basicBrandData);

    // Use AI to extract deeper insights about the product
    const aiAnalysis = await analyzeWithAI(html, basicBrandData, url);

    const brandData = {
      ...basicBrandData,
      productName: aiAnalysis.productName || basicBrandData.companyName,
      niche: aiAnalysis.niche || 'beaute',
      description: aiAnalysis.description || basicBrandData.description,
      productType: aiAnalysis.productType,
      productFeatures: aiAnalysis.productFeatures,
      productBenefits: aiAnalysis.productBenefits,
      targetMarket: aiAnalysis.targetMarket,
      keywords: aiAnalysis.keywords,
      price: aiAnalysis.price,
    };

    console.log("Complete brand data with AI analysis:", brandData);

    return new Response(
      JSON.stringify({ brandData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error extracting brand:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: 'Failed to extract brand data from the provided URL'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function analyzeWithAI(html: string, basicData: any, pageUrl: string) {
  try {
    // Extract text content from HTML
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000); // Give the model more in-page context

    const slug = (() => {
      try {
        const u = new URL(pageUrl);
        const segs = u.pathname.split('/').filter(Boolean);
        return segs[segs.length - 1] || '';
      } catch {
        return '';
      }
    })();

    const prompt = `Analyse uniquement CE LIEN précis et extrais les informations EXACTES du produit principal de CETTE page.

URL de la page: ${pageUrl}
Slug de la page (indice produit): ${slug}

IMPORTANT ET OBLIGATOIRE:
- NE PAS utiliser d'informations globales du domaine ou de la plateforme (Youcan, Shopify, etc.)
- NE PAS inférer à partir de la marque générale du site
- Utilise UNIQUEMENT le contenu HTML fourni de cette page.

Nom de la marque/boutique détecté: ${basicData.companyName || 'Inconnu'}
Description détectée: ${basicData.description || 'Non disponible'}

Contenu texte de la page (nettoyé):
${textContent}

INSTRUCTIONS CRITIQUES:
1. Identifie le NOM EXACT du produit principal de cette page (pas le nom de la boutique)
2. Donne la description du produit spécifique (pas des informations génériques du site)
3. Liste uniquement les caractéristiques et bénéfices de CE produit
4. Catégorise la niche parmi: beaute, mode, alimentation, tech, sante, maison
5. Si une info est introuvable dans le contenu ci-dessus, renvoie "Non spécifié"

Retourne UNIQUEMENT un objet JSON STRICTEMENT VALIDE avec la structure exacte suivante:
{
  "productName": "Nom exact du produit",
  "niche": "beaute|mode|alimentation|tech|sante|maison",
  "description": "Description détaillée du produit",
  "productType": "Type précis du produit",
  "productFeatures": ["caractéristique 1", "caractéristique 2", "caractéristique 3"],
  "productBenefits": ["avantage 1", "avantage 2", "avantage 3"],
  "targetMarket": "Marché cible africain",
  "keywords": ["mot-clé 1", "mot-clé 2", "mot-clé 3", "mot-clé 4", "mot-clé 5"],
  "price": "Prix trouvé (avec devise) ou 'Non spécifié'"
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'Tu es un expert en marketing digital pour l\'Afrique. Réponds UNIQUEMENT avec un objet JSON valide, sans texte supplémentaire.' 
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0].message.content.trim();
    
    // Extract JSON from potential markdown code blocks
    let jsonContent = content;
    if (content.includes('```json')) {
      jsonContent = content.split('```json')[1].split('```')[0].trim();
    } else if (content.includes('```')) {
      jsonContent = content.split('```')[1].split('```')[0].trim();
    }
    
    const analysis = JSON.parse(jsonContent);
    
    console.log("AI analysis completed:", analysis);
    
    return analysis;
  } catch (error) {
    console.error("AI analysis error:", error);
    // Return default structure if AI fails
    return {
      productName: basicData.companyName || "Produit",
      niche: "beaute",
      description: basicData.description || "Produit de qualité",
      productType: "Produit ou service",
      productFeatures: ["Qualité premium", "Service rapide", "Prix compétitif"],
      productBenefits: ["Gain de temps", "Satisfaction garantie", "Support client"],
      targetMarket: "Entrepreneurs et entreprises en Afrique",
      keywords: ["innovation", "qualité", "service", "professionnel", "africain"],
      price: "Non spécifié",
    };
  }
}

function extractColors(html: string): string[] {
  const colors = new Set<string>();
  
  // Extract from inline styles
  const inlineStyleRegex = /style="[^"]*color:\s*([^;"]+)/gi;
  let match;
  while ((match = inlineStyleRegex.exec(html)) !== null) {
    colors.add(normalizeColor(match[1]));
  }
  
  // Extract from style tags
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  while ((match = styleRegex.exec(html)) !== null) {
    const colorMatches = match[1].match(/(?:color|background(?:-color)?|border(?:-color)?):\s*([^;}\s]+)/gi);
    if (colorMatches) {
      colorMatches.forEach(cm => {
        const colorValue = cm.split(':')[1]?.trim();
        if (colorValue && !colorValue.includes('transparent') && !colorValue.includes('inherit')) {
          colors.add(normalizeColor(colorValue));
        }
      });
    }
  }
  
  return Array.from(colors).slice(0, 6);
}

function normalizeColor(color: string): string {
  color = color.trim();
  
  // Convert rgb/rgba to hex
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  
  if (color.startsWith('#')) {
    return color.toUpperCase();
  }
  
  const namedColors: Record<string, string> = {
    'white': '#FFFFFF',
    'black': '#000000',
    'red': '#FF0000',
    'blue': '#0000FF',
    'green': '#008000',
  };
  
  return namedColors[color.toLowerCase()] || color;
}

function extractFonts(html: string): string[] {
  const fonts = new Set<string>();
  
  const fontFamilyRegex = /font-family:\s*([^;"]+)/gi;
  let match;
  while ((match = fontFamilyRegex.exec(html)) !== null) {
    const fontFamily = match[1].split(',')[0].trim().replace(/['"]/g, '');
    if (fontFamily && !fontFamily.includes('inherit') && !fontFamily.includes('sans-serif')) {
      fonts.add(fontFamily);
    }
  }
  
  const googleFontsRegex = /fonts\.googleapis\.com\/css\?family=([^&"']+)/gi;
  while ((match = googleFontsRegex.exec(html)) !== null) {
    const fontName = decodeURIComponent(match[1].split(':')[0]).replace(/\+/g, ' ');
    fonts.add(fontName);
  }
  
  return Array.from(fonts).slice(0, 5);
}

function extractLogo(html: string, baseUrl: string): string | null {
  const logoPatterns = [
    /<img[^>]*class="[^"]*logo[^"]*"[^>]*src="([^"]+)"/i,
    /<img[^>]*src="([^"]*logo[^"]*\.(?:png|jpg|jpeg|svg))"/i,
    /<img[^>]*alt="[^"]*logo[^"]*"[^>]*src="([^"]+)"/i,
  ];
  
  for (const pattern of logoPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return resolveUrl(match[1], baseUrl);
    }
  }
  
  return null;
}

function extractImages(html: string, baseUrl: string): string[] {
  const images = new Set<string>();
  const imgRegex = /<img[^>]+src="([^"]+)"/gi;
  
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const imgUrl = match[1];
    if (!imgUrl.includes('icon') && 
        !imgUrl.includes('pixel') && 
        !imgUrl.includes('track') &&
        !imgUrl.endsWith('.svg')) {
      images.add(resolveUrl(imgUrl, baseUrl));
    }
  }
  
  return Array.from(images);
}

function extractCompanyName(html: string): string {
  const ogSiteNameMatch = html.match(/<meta\s+property="og:site_name"\s+content="([^"]+)"/i);
  if (ogSiteNameMatch) return ogSiteNameMatch[1];
  
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].split('|')[0].split('-')[0].trim();
  }
  
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) return h1Match[1].trim();
  
  return "";
}

function extractDescription(html: string): string {
  const metaDescMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
  if (metaDescMatch) return metaDescMatch[1];
  
  const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
  if (ogDescMatch) return ogDescMatch[1];
  
  const pMatch = html.match(/<p[^>]*>([^<]{50,200})<\/p>/i);
  if (pMatch) return pMatch[1].trim();
  
  return "";
}

// --- Product-focused helpers ---
function extractOgMeta(html: string, property: string): string | null {
  const re = new RegExp(`<meta\\s+(?:property|name)="${property}"\\s+content="([^"]+)"`, 'i');
  const m = html.match(re);
  return m ? m[1] : null;
}

function extractProductFromJsonLd(html: string): any | null {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const s of scripts) {
    const raw = s[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const nodes: any[] = Array.isArray(parsed)
        ? parsed
        : (parsed['@graph'] && Array.isArray(parsed['@graph']))
          ? parsed['@graph']
          : [parsed];
      for (const node of nodes) {
        const type = node['@type'];
        const types: string[] = Array.isArray(type) ? type : [type];
        if (types && types.some((t) => String(t).toLowerCase() === 'product')) {
          const name = node.name || node.title || '';
          const description = node.description || '';
          let images: string[] = [];
          if (Array.isArray(node.image)) images = node.image;
          else if (typeof node.image === 'string') images = [node.image];
          else if (node.image?.url) images = [node.image.url];

          let price = '';
          const offers = node.offers;
          if (offers) {
            const offer = Array.isArray(offers) ? offers[0] : offers;
            if (offer?.price) {
              const currency = offer.priceCurrency || '';
              price = currency ? `${offer.price} ${currency}` : `${offer.price}`;
            }
          }

          let brandName = '';
          if (typeof node.brand === 'string') brandName = node.brand;
          else if (node.brand?.name) brandName = node.brand.name;

          return { name, description, images, price, brandName };
        }
      }
    } catch { /* ignore invalid JSON-LD blocks */ }
  }
  return null;
}

function extractProductInfo(html: string, pageUrl: string): { name?: string; description?: string; images?: string[]; price?: string; brandName?: string } {
  const fromJsonLd = extractProductFromJsonLd(html);
  if (fromJsonLd) return fromJsonLd;

  // Fallback to OG/meta
  const name = extractOgMeta(html, 'og:title') || undefined;
  const description = extractOgMeta(html, 'og:description') || extractDescription(html) || undefined;
  const ogImages = [
    ...[...html.matchAll(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["'][^>]*>/gi)].map(m => m[1])
  ];
  const price = extractOgMeta(html, 'product:price:amount') || extractOgMeta(html, 'og:price:amount') || undefined;
  const brandName = extractOgMeta(html, 'og:site_name') || undefined;

  return {
    name,
    description,
    images: ogImages.length ? ogImages : undefined,
    price,
    brandName,
  };
}

function resolveUrl(url: string, baseUrl: string): string {
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    const base = new URL(baseUrl);
    
    if (url.startsWith('//')) {
      return `${base.protocol}${url}`;
    }
    
    if (url.startsWith('/')) {
      return `${base.protocol}//${base.host}${url}`;
    }
    
    return `${base.protocol}//${base.host}/${url}`;
  } catch {
    return url;
  }
}
