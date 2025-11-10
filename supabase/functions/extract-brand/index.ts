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

    // Extract brand data using regex and parsing
    const brandData = {
      colors: extractColors(html),
      fonts: extractFonts(html),
      logo: extractLogo(html, url),
      images: extractImages(html, url).slice(0, 10), // Limit to 10 images
      companyName: extractCompanyName(html),
      description: extractDescription(html),
    };

    console.log("Extracted brand data:", brandData);

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
  
  return Array.from(colors).slice(0, 6); // Return top 6 colors
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
  
  // Return hex colors as-is
  if (color.startsWith('#')) {
    return color.toUpperCase();
  }
  
  // Common named colors to hex
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
  
  // Extract from inline styles
  const fontFamilyRegex = /font-family:\s*([^;"]+)/gi;
  let match;
  while ((match = fontFamilyRegex.exec(html)) !== null) {
    const fontFamily = match[1].split(',')[0].trim().replace(/['"]/g, '');
    if (fontFamily && !fontFamily.includes('inherit') && !fontFamily.includes('sans-serif')) {
      fonts.add(fontFamily);
    }
  }
  
  // Extract from Google Fonts links
  const googleFontsRegex = /fonts\.googleapis\.com\/css\?family=([^&"']+)/gi;
  while ((match = googleFontsRegex.exec(html)) !== null) {
    const fontName = decodeURIComponent(match[1].split(':')[0]).replace(/\+/g, ' ');
    fonts.add(fontName);
  }
  
  return Array.from(fonts).slice(0, 5);
}

function extractLogo(html: string, baseUrl: string): string | null {
  // Try to find logo in common locations
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
    // Filter out small images, icons, and tracking pixels
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
  // Try meta tags first
  const ogSiteNameMatch = html.match(/<meta\s+property="og:site_name"\s+content="([^"]+)"/i);
  if (ogSiteNameMatch) return ogSiteNameMatch[1];
  
  // Try title tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].split('|')[0].split('-')[0].trim();
  }
  
  // Try h1
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) return h1Match[1].trim();
  
  return "";
}

function extractDescription(html: string): string {
  // Try meta description
  const metaDescMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
  if (metaDescMatch) return metaDescMatch[1];
  
  // Try og:description
  const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
  if (ogDescMatch) return ogDescMatch[1];
  
  // Try first paragraph
  const pMatch = html.match(/<p[^>]*>([^<]{50,200})<\/p>/i);
  if (pMatch) return pMatch[1].trim();
  
  return "";
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
