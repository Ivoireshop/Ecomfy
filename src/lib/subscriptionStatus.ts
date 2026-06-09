import { supabase } from "@/integrations/supabase/client";

/**
 * Calls the backend RPC that auto-expires the current user's subscription
 * if its end_date has passed, then returns the fresh status payload.
 * Safe to call even when not logged in (returns inactive).
 */
export async function refreshMySubscriptionStatus() {
  try {
    // @ts-ignore - RPC types regenerate after migration
    const { data, error } = await supabase.rpc("get_my_subscription_status");
    if (error) {
      console.warn("[subscriptionStatus] rpc error", error);
      return null;
    }
    return data as {
      status: string;
      expired?: boolean;
      end_date?: string | null;
      start_date?: string | null;
      video_generations_remaining?: number;
    } | null;
  } catch (e) {
    console.warn("[subscriptionStatus] failed", e);
    return null;
  }
}