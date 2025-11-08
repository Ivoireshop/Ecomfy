import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_CONCURRENT_GENERATIONS = 10;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    console.log("Processing queue: checking for pending items...");

    // Count current processing generations
    const { data: processingCount, error: countError } = await supabaseClient
      .rpc("count_processing_generations");

    if (countError) {
      console.error("Error counting processing generations:", countError);
      throw countError;
    }

    console.log(`Current processing count: ${processingCount}`);

    // If we're at capacity, don't process more
    if (processingCount >= MAX_CONCURRENT_GENERATIONS) {
      console.log("Queue is at capacity, waiting for slots to free up");
      return new Response(
        JSON.stringify({ 
          message: "Queue at capacity", 
          processing: processingCount 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get next pending item
    const { data: nextId, error: nextError } = await supabaseClient
      .rpc("get_next_queue_item");

    if (nextError) {
      console.error("Error getting next queue item:", nextError);
      throw nextError;
    }

    if (!nextId) {
      console.log("No pending items in queue");
      return new Response(
        JSON.stringify({ message: "No pending items" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Processing queue item: ${nextId}`);

    // Get the queue item details
    const { data: queueItem, error: itemError } = await supabaseClient
      .from("generation_queue")
      .select("*")
      .eq("id", nextId)
      .single();

    if (itemError || !queueItem) {
      console.error("Error fetching queue item:", itemError);
      throw itemError || new Error("Queue item not found");
    }

    // Update status to processing
    await supabaseClient
      .from("generation_queue")
      .update({ 
        status: "processing",
        started_at: new Date().toISOString()
      })
      .eq("id", nextId);

    console.log("Updated queue item to processing, invoking generate-ad-visual...");

    // Create auth client for the user
    const userAuthClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { 
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` 
          },
        },
      }
    );

    // Call generate-ad-visual edge function for this user
    const startTime = Date.now();
    const { data: genData, error: genError } = await userAuthClient.functions.invoke(
      "generate-ad-visual",
      {
        body: {
          prompt: queueItem.prompt,
          productName: queueItem.product_details?.productName || "product",
          category: queueItem.product_details?.category || "general",
          platform: queueItem.platform,
          queueItemId: nextId, // Pass queue item ID to prevent re-queuing
          userId: queueItem.user_id,
        },
      }
    );

    const processingTime = Date.now() - startTime;

    if (genError) {
      console.error("Generation error:", genError);
      // Mark as failed
      await supabaseClient
        .from("generation_queue")
        .update({ 
          status: "failed",
          error_message: genError.message || "Generation failed",
          completed_at: new Date().toISOString(),
          processing_time_ms: processingTime
        })
        .eq("id", nextId);

      // Continue processing other items in background
      fetch(req.url, { method: "POST" }).catch(console.error);

      return new Response(
        JSON.stringify({ 
          message: "Item processed with error", 
          error: genError.message 
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Mark as completed
    await supabaseClient
      .from("generation_queue")
      .update({ 
        status: "completed",
        image_url: genData?.imageUrl || null,
        completed_at: new Date().toISOString(),
        processing_time_ms: processingTime
      })
      .eq("id", nextId);

    console.log(`Queue item ${nextId} completed successfully in ${processingTime}ms`);

    // Trigger processing of next item in background
    fetch(req.url, { method: "POST" }).catch(console.error);

    return new Response(
      JSON.stringify({ 
        message: "Item processed successfully",
        queueItemId: nextId,
        imageUrl: genData?.imageUrl
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Process queue error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});