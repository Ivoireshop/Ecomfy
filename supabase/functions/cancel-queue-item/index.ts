import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentification requise" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (!user || userError) {
      return new Response(
        JSON.stringify({ error: "Authentification requise" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { queueItemId } = await req.json();

    if (!queueItemId) {
      return new Response(
        JSON.stringify({ error: "ID de file d'attente requis" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify ownership and status
    const { data: queueItem, error: fetchError } = await supabaseClient
      .from("generation_queue")
      .select("*")
      .eq("id", queueItemId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !queueItem) {
      return new Response(
        JSON.stringify({ error: "Item de file d'attente non trouvé" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Only allow canceling pending or processing items
    if (queueItem.status !== "pending" && queueItem.status !== "processing") {
      return new Response(
        JSON.stringify({ error: "Impossible d'annuler cet item" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Mark as failed with cancellation message
    const { error: updateError } = await supabaseClient
      .from("generation_queue")
      .update({
        status: "failed",
        error_message: "Annulé par l'utilisateur",
        completed_at: new Date().toISOString(),
      })
      .eq("id", queueItemId);

    if (updateError) {
      console.error("Error canceling queue item:", updateError);
      throw updateError;
    }

    console.log(`Queue item ${queueItemId} canceled successfully`);

    return new Response(
      JSON.stringify({ success: true, message: "Génération annulée" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in cancel-queue-item function:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Une erreur est survenue" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
