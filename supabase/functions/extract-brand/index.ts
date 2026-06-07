import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h === '0.0.0.0') return true;
  // IPv6 loopback/local
  if (h === '::1' || h.startsWith('[::1]') || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
  // IPv4 ranges
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a,b] = [parseInt(m[1]),parseInt(m[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
  }
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authentication
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

    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SSRF protection: only http(s) + block private/loopback/metadata hosts
    let parsed: URL;
    try { parsed = new URL(url); } catch {
      return new Response(JSON.stringify({ error: "URL invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return new Response(JSON.stringify({ error: "Protocole non autorisé" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (isPrivateHost(parsed.hostname)) {
      return new Response(JSON.stringify({ error: "Hôte non autorisé" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
    // Extract product-specific content from HTML
    const productContent = extractProductContent(html);
    
    console.info('Extracted product content for AI:', {
      title: productContent.title,
      hasDescription: !!productContent.description,
      priceFound: !!productContent.price,
      featuresCount: productContent.features.length
    });

    // Extract text content from HTML for additional context
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000);

    const prompt = `Tu es un expert en extraction de données produit e-commerce. Analyse cette page et extrais les informations du PRODUIT PRINCIPAL.

URL: ${pageUrl}

DONNÉES EXTRAITES DU HTML (PRIORITAIRES):
Titre du produit: ${productContent.title || 'Non trouvé'}
Prix: ${productContent.price || 'Non trouvé'}
Description: ${productContent.description || 'Non trouvé'}
Caractéristiques: ${productContent.features.length > 0 ? productContent.features.join(', ') : 'Non trouvé'}

Images produit disponibles: ${basicData.images?.length || 0}

Contenu additionnel de la page:
${textContent}

INSTRUCTIONS CRITIQUES:
1. Utilise EN PRIORITÉ les "DONNÉES EXTRAITES DU HTML" ci-dessus
2. Le "Titre du produit" est le nom réel du produit - utilise-le pour productName
3. Si tu as une description, utilise-la (pas de textes génériques comme "troisième produit")
4. NE JAMAIS utiliser des textes génériques ou placeholder comme "Troisième produit"
5. Si une information n'est pas disponible, renvoie "Non spécifié"
6. Catégorise la niche parmi: beaute, mode, alimentation, tech, sante, maison, autre

Retourne UNIQUEMENT un objet JSON valide:
{
  "productName": "Nom exact du produit (utilise le titre extrait)",
  "niche": "beaute|mode|alimentation|tech|sante|maison|autre",
  "description": "Description détaillée du produit",
  "productType": "Type spécifique",
  "productFeatures": ["caractéristique 1", "caractéristique 2"],
  "productBenefits": ["bénéfice 1", "bénéfice 2"],
  "targetMarket": "Public cible",
  "keywords": ["mot-clé 1", "mot-clé 2"],
  "price": "Prix avec devise"
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

// Extract product-specific content from HTML structure
function extractProductContent(html: string): {
  title: string | null;
  description: string | null;
  price: string | null;
  features: string[];
} {
  let title = null;
  let description = null;
  let price = null;
  const features: string[] = [];
  
  // Extract title - prioritize product-specific selectors
  const titlePatterns = [
    /<h1[^>]*class="[^"]*product[^"]*"[^>]*>([^<]+)<\/h1>/i,
    /<h1[^>]*>([^<]+)<\/h1>/i,
    /<h2[^>]*class="[^"]*product[^"]*title[^"]*"[^>]*>([^<]+)<\/h2>/i,
  ];
  
  for (const pattern of titlePatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      // Avoid generic terms
      if (!extracted.toLowerCase().includes('shop') && 
          !extracted.toLowerCase().includes('store') &&
          extracted.length > 2 &&
          extracted.toLowerCase() !== 'troisième produit') {
        title = extracted;
        break;
      }
    }
  }
  
  // Extract description - look for product description sections
  const descPatterns = [
    /<div[^>]*class="[^"]*product.*description[^"]*"[^>]*>([^<]+)<\/div>/i,
    /<p[^>]*class="[^"]*description[^"]*"[^>]*>([^<]+)<\/p>/i,
    /<div[^>]*class="[^"]*description[^"]*"[^>]*>([^<]+)<\/div>/i,
  ];
  
  for (const pattern of descPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      if (extracted.length > 20 && extracted.toLowerCase() !== 'le troisième produit') {
        description = extracted;
        break;
      }
    }
  }
  
  // Extract price
  const pricePatterns = [
    /<span[^>]*class="[^"]*price[^"]*"[^>]*>([^<]+)<\/span>/i,
    /<div[^>]*class="[^"]*price[^"]*"[^>]*>([^<]+)<\/div>/i,
    /(\d+(?:[.,]\d+)?)\s*(?:FCFA|CFA|€|EUR|USD|\$|MAD|DH|دينار)/i,
  ];
  
  for (const pattern of pricePatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      price = match[1].trim();
      break;
    }
  }
  
  // Extract features from lists
  const listMatch = html.match(/<ul[^>]*class="[^"]*(?:feature|specification|benefit)[^"]*"[^>]*>([\s\S]*?)<\/ul>/i);
  if (listMatch) {
    const liMatches = listMatch[1].match(/<li[^>]*>([^<]+)<\/li>/gi);
    if (liMatches) {
      features.push(...liMatches.map(li => li.replace(/<\/?li[^>]*>/gi, '').trim()).filter(f => f.length > 0));
    }
  }
  
  console.info('Product content extraction:', { 
    title: title || 'NOT FOUND', 
    description: description ? description.substring(0, 50) + '...' : 'NOT FOUND',
    price: price || 'NOT FOUND',
    featuresCount: features.length 
  });
  
  return { title, description, price, features };
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
