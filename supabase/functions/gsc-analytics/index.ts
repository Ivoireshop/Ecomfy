// supabase/functions/gsc-analytics/index.ts
// Edge Function fetching real Google Search Console Analytics metrics (Clicks, Impressions, CTR, Position).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: any = {};
    try { body = await req.json(); } catch (_) { /* empty */ }

    const { accessToken, propertyUrl, startDate, endDate, dimensions = ["date"] } = body;

    if (!accessToken || !propertyUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Token d'accès ou propriété manquante", metrics: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const encodedSite = encodeURIComponent(propertyUrl);
    const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`;

    const requestBody = {
      startDate: startDate || new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10),
      endDate: endDate || new Date().toISOString().slice(0, 10),
      dimensions: dimensions,
      rowLimit: 100,
    };

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errText = await res.text();
      return new Response(
        JSON.stringify({ success: false, error: `Erreur API GSC (${res.status})`, details: errText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const json = await res.json();
    return new Response(JSON.stringify({ success: true, rows: json.rows || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
