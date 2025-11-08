import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Running 24h reminder check...");

    // Create Supabase admin client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Find users who should receive the 24h follow-up
    // Looking for records where sent_at is in the past (scheduled for now or earlier)
    const now = new Date().toISOString();
    const { data: pendingReminders, error: fetchError } = await supabaseClient
      .from("email_reminders")
      .select("id, user_id")
      .eq("reminder_type", "after_3_generations")
      .lte("sent_at", now)
      .limit(50); // Process max 50 per run

    if (fetchError) {
      console.error("Error fetching pending reminders:", fetchError);
      throw fetchError;
    }

    if (!pendingReminders || pendingReminders.length === 0) {
      console.log("No pending 24h reminders to send");
      return new Response(
        JSON.stringify({ message: "No pending reminders", count: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Found ${pendingReminders.length} pending reminders`);
    let sentCount = 0;
    let errorCount = 0;

    // Process each reminder
    for (const reminder of pendingReminders) {
      try {
        // Get user email and profile
        const { data: userData } = await supabaseClient.auth.admin.getUserById(reminder.user_id);
        
        if (!userData?.user?.email) {
          console.log(`No email found for user ${reminder.user_id}`);
          // Delete the reminder since we can't send email
          await supabaseClient
            .from("email_reminders")
            .delete()
            .eq("id", reminder.id);
          errorCount++;
          continue;
        }

        const { data: profileData } = await supabaseClient
          .from("profiles")
          .select("full_name")
          .eq("id", reminder.user_id)
          .single();

        // Call the send-generation-reminder function
        const reminderUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-generation-reminder`;
        const response = await fetch(reminderUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            userId: reminder.user_id,
            userEmail: userData.user.email,
            userName: profileData?.full_name || userData.user.email.split('@')[0],
            reminderType: 'after_3_generations',
            freeGenerationsRemaining: 0
          })
        });

        if (response.ok) {
          console.log(`Sent 24h reminder to user ${reminder.user_id}`);
          sentCount++;
          
          // Delete the scheduled reminder since it was sent
          await supabaseClient
            .from("email_reminders")
            .delete()
            .eq("id", reminder.id);
        } else {
          const errorText = await response.text();
          console.error(`Failed to send reminder to user ${reminder.user_id}:`, errorText);
          errorCount++;
        }
      } catch (err) {
        console.error(`Error processing reminder ${reminder.id}:`, err);
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({ 
        message: "24h reminders processed",
        sent: sentCount,
        errors: errorCount,
        total: pendingReminders.length
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-24h-reminder function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);