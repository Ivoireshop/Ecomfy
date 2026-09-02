// supabase/functions/gsc-oauth-flow/index.ts
// Secure backend handling for Google Search Console OAuth 2.0 flow.

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
    const clientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID") || "";
    const redirectUri = Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI") || "https://ecomfy.cloud/dashboard/seo";

    let body: any = {};
    try { body = await req.json(); } catch (_) { /* empty */ }

    const { action, code } = body;

    // Action 1: Get Authorization URL
    if (action === "get_auth_url") {
      const scope = encodeURIComponent("https://www.googleapis.com/auth/webmasters.readonly");
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&access_type=offline&prompt=consent`;

      return new Response(JSON.stringify({ success: true, authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action 2: Exchange Code for Tokens
    if (action === "exchange_code" && code) {
      const clientSecret = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET") || "";

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        return new Response(JSON.stringify({ success: false, error: tokenData.error_description || tokenData.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch user GSC properties list
      const sitesRes = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const sitesData = await sitesRes.json();

      return new Response(
        JSON.stringify({
          success: true,
          refreshToken: tokenData.refresh_token,
          accessToken: tokenData.access_token,
          expiresIn: tokenData.expires_in,
          sites: sitesData.siteEntry || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: false, error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
