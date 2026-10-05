import { supabase } from "@/integrations/supabase/client";

export interface UserProfileData {
  id: string;
  email?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  country?: string | null;
  avatar_url?: string | null;
  whatsapp_consent?: boolean | null;
  profile_completed?: boolean | null;
  created_at?: string | null;
  has_existing_shop?: boolean;
}

// Cut-off timestamp for feature release (Oct 5 2026 17:30 UTC)
const FEATURE_ACTIVATION_DATE = new Date("2026-10-05T17:30:00Z").getTime();

export const profileCompletionService = {
  /**
   * Check if a profile has all mandatory business information or is an existing account.
   * ABSOLUTE RULE: Existing active accounts with shops or created before feature release are ALWAYS considered complete!
   */
  isProfileComplete(profile: UserProfileData | null | undefined): boolean {
    if (!profile) return true; // Default to true if profile is unknown to prevent blocking existing users

    // 1. Existing merchants with shops are ALWAYS exempt from completion blocks
    if (profile.has_existing_shop === true) {
      return true;
    }

    // 2. Pre-existing accounts created before this feature update are ALWAYS exempt
    if (profile.created_at) {
      const createdAtTime = new Date(profile.created_at).getTime();
      if (!isNaN(createdAtTime) && createdAtTime < FEATURE_ACTIVATION_DATE) {
        return true;
      }
    }

    // 3. If explicit flag is set
    if (profile.profile_completed === true) {
      return true;
    }

    // 4. Check if phone number is present and valid
    const hasPhone = !!(profile.phone && profile.phone.trim().length >= 6);
    const hasName = !!(
      (profile.first_name && profile.first_name.trim()) ||
      (profile.full_name && profile.full_name.trim())
    );

    return hasPhone && hasName;
  },

  /**
   * Fetch current user profile from DB along with shop check
   */
  async getUserProfile(userId: string): Promise<UserProfileData | null> {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user profile for completion check:", error);
        return null;
      }

      if (!data) return null;

      // Check if user already owns any shop (existing active merchant)
      const { count: shopCount } = await supabase
        .from("shops")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      return {
        ...(data as UserProfileData),
        has_existing_shop: (shopCount || 0) > 0,
      };
    } catch (err) {
      console.error("Exception in getUserProfile:", err);
      return null;
    }
  },

  /**
   * Complete and save user profile
   */
  async completeProfile(params: {
    userId: string;
    firstName: string;
    lastName: string;
    phone: string;
    whatsappConsent: boolean;
    country?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const fullName = `${params.firstName.trim()} ${params.lastName.trim()}`.trim();

      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: params.firstName.trim(),
          last_name: params.lastName.trim(),
          full_name: fullName,
          phone: params.phone.trim(),
          whatsapp_consent: params.whatsappConsent,
          profile_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.userId);

      if (error) {
        console.error("Error saving completed profile:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      console.error("Exception in completeProfile:", err);
      return { success: false, error: err.message || "Erreur lors de la sauvegarde" };
    }
  }
};
