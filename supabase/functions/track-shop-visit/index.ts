import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ok = (data: unknown = {}) =>
  new Response(JSON.stringify({ success: true, ...data as object }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fail = (error: string, status = 200) =>
  new Response(JSON.stringify({ success: false, error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function pickIp(req: Request): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  
  try {
    const body = await req.json();
    const { shop_id, product_id, session_id, referrer, page_path, url_search } = body || {};
    
    if (!shop_id) return fail("Missing shop_id", 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const visitor_ip = pickIp(req) || "unknown";
    // cf-ipcountry is provided by Cloudflare (used by Supabase edge functions)
    const visitor_country = req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || "Unknown";
    const visitor_city = req.headers.get("cf-ipcity") || req.headers.get("x-vercel-ip-city") || "Unknown";
    const user_agent = req.headers.get("user-agent") || "unknown";
    
    // Parse device_type and browser
    const ua = user_agent.toLowerCase();
    let device_type = "Desktop";
    if (ua.includes("mobi") || ua.includes("android") || ua.includes("iphone")) device_type = "Mobile";
    else if (ua.includes("tablet") || ua.includes("ipad")) device_type = "Tablet";

    let browser = "Other";
    if (ua.includes("chrome") || ua.includes("crios")) browser = "Chrome";
    else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
    else if (ua.includes("firefox") || ua.includes("fxios")) browser = "Firefox";
    else if (ua.includes("edge") || ua.includes("edg/")) browser = "Edge";
    
    let cleanReferrer = referrer || "Direct";
    
    // Check UTMs first for 100% reliable source attribution
    if (url_search) {
      const params = new URLSearchParams(url_search);
      const utmSource = params.get("utm_source")?.toLowerCase();
      const ref = params.get("ref")?.toLowerCase();
      const source = utmSource || ref;
      
      if (source) {
        if (source.includes("facebook") || source.includes("fb") || source.includes("ig") || source.includes("instagram")) {
          cleanReferrer = "Meta (Facebook/Instagram)";
        } else if (source.includes("tiktok")) {
          cleanReferrer = "TikTok";
        } else if (source.includes("google")) {
          cleanReferrer = "Google";
        } else if (source.includes("snapchat")) {
          cleanReferrer = "Snapchat";
        } else if (source.includes("whatsapp")) {
          cleanReferrer = "WhatsApp";
        } else {
          // Capitalize first letter of custom source
          cleanReferrer = source.charAt(0).toUpperCase() + source.slice(1);
        }
      }
    }

    // Fallback to referrer parsing if UTMs didn't set a clear known source
    if (cleanReferrer === referrer || cleanReferrer === "Direct") {
      if (cleanReferrer.includes("facebook.com") || cleanReferrer.includes("fb.com") || cleanReferrer.includes("instagram.com")) {
        cleanReferrer = "Meta (Facebook/Instagram)";
      } else if (cleanReferrer.includes("tiktok.com")) {
        cleanReferrer = "TikTok";
      } else if (cleanReferrer.includes("google.")) {
        cleanReferrer = "Google";
      } else if (cleanReferrer.includes("snapchat.com")) {
        cleanReferrer = "Snapchat";
      } else if (cleanReferrer.includes("android-app://com.whatsapp")) {
        cleanReferrer = "WhatsApp";
      }
    }

    const visitData = {
      shop_id,
      product_id: product_id || null,
      session_id: session_id || null,
      visitor_ip,
      visitor_country,
      visitor_city,
      user_agent,
      device_type,
      browser,
      referrer: cleanReferrer,
      page_path: page_path || "/",
    };

    const { error } = await supabase.from("shop_visits").insert(visitData as any);
    
    if (error) {
      console.error("Error inserting shop visit:", error);
      return fail("database_error", 500);
    }

    return ok({ country: visitor_country });
    
  } catch (err: any) {
    console.error("Track shop visit error:", err);
    return fail(err.message, 500);
  }
});
