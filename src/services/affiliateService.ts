import { supabase } from "@/integrations/supabase/client";

export interface AffiliateProfile {
  id: string;
  user_id: string;
  affiliate_code: string;
  commission_rate: number;
  status: "active" | "suspended" | "pending";
  created_at: string;
  updated_at: string;
}

export interface AffiliatePayoutMethod {
  id?: string;
  affiliate_id: string;
  provider: "orange_money" | "wave" | "mtn_money" | "moov_money" | "bank_transfer";
  account_phone?: string;
  account_name: string;
  bank_name?: string;
  account_number_iban?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AffiliateCommission {
  id: string;
  affiliate_id: string;
  referred_user_id: string;
  payment_id?: string;
  subscription_id?: string;
  amount_paid: number;
  commission_rate: number;
  commission_amount: number;
  status: "PENDING" | "APPROVED" | "PAYABLE" | "PAID" | "CANCELLED" | "REVERSED";
  period_code?: string;
  payout_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AffiliatePayout {
  id: string;
  affiliate_id: string;
  period_code?: string;
  amount_paid: number;
  payment_method: string;
  payment_reference?: string;
  notes?: string;
  created_by?: string;
  paid_at: string;
  created_at: string;
}

export interface PayoutPeriod {
  id: string;
  code: string;
  name: string;
  start_date: string;
  end_date: string;
  status: "open" | "closed" | "paid";
}

export interface AffiliateStats {
  totalEarned: number;
  pendingAmount: number;
  payableAmount: number;
  paidAmount: number;
  referredCount: number;
  paidCustomersCount: number;
  commissionRate: number;
  minimumThreshold: number;
  isEligibleForPayout: boolean;
}

export interface FounderAffiliateListItem {
  affiliate: AffiliateProfile;
  user_email?: string;
  user_name?: string;
  payout_method?: AffiliatePayoutMethod | null;
  referred_count: number;
  subscriptions_count: number;
  total_earned: number;
  payable_amount: number;
  paid_amount: number;
  status: string;
}

export const affiliateService = {
  /**
   * Helper to derive the user's real personal name from all available sources (Auth metadata, Profiles table, Email, Shop)
   */
  async getUserPersonalName(userId: string): Promise<string> {
    try {
      // 1. Try Supabase Auth user metadata
      const { data: authUser } = await supabase.auth.getUser();
      if (authUser?.user && authUser.user.id === userId) {
        const meta = authUser.user.user_metadata || {};
        const metaName = meta.full_name || meta.name || `${meta.first_name || ""} ${meta.last_name || ""}`.trim();
        if (metaName && metaName.trim().length >= 2) {
          return metaName.trim();
        }
      }

      // 2. Try DB profiles table
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("full_name, first_name, last_name, email")
        .eq("id", userId)
        .maybeSingle();

      if (userProfile?.full_name && userProfile.full_name.trim().length >= 2) {
        return userProfile.full_name.trim();
      }
      if (userProfile?.first_name || userProfile?.last_name) {
        const combined = `${userProfile.first_name || ""} ${userProfile.last_name || ""}`.trim();
        if (combined.length >= 2) return combined;
      }

      // 3. Try email prefix if available
      const email = userProfile?.email || authUser?.user?.email;
      if (email && email.includes("@")) {
        const prefix = email.split("@")[0].replace(/[._+]/g, " ").trim();
        if (prefix.length >= 2) return prefix;
      }

      // 4. Try shop owner or business name if name not set anywhere
      const { data: shop } = await supabase
        .from("shops")
        .select("business_name")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (shop?.business_name && shop.business_name.trim().length >= 2) {
        return shop.business_name.trim();
      }
    } catch (e) {
      console.error("Error fetching user personal name:", e);
    }

    return `UTILISATEUR-${userId.substring(0, 5).toUpperCase()}`;
  },

  /**
   * Fetch or create the affiliate profile of the current logged-in user (server-side RPC, code derived from the user name)
   */
  async getOrCreateProfile(userId: string): Promise<AffiliateProfile | null> {
    try {
      // Created server-side (H6): rate, status and code uniqueness are not decided by the browser.
      const realName = await this.getUserPersonalName(userId);
      const { data, error } = await supabase.rpc("get_or_create_my_affiliate", { p_name_hint: realName });
      if (error) throw error;
      return data as unknown as AffiliateProfile;
    } catch (err) {
      // No made-up profile: its id and code would not exist in the database, so the link would credit
      // nobody and saving a payout method would fail on the foreign key.
      console.error("Error in getOrCreateProfile:", err);
      return null;
    }
  },

  /**
   * Fetch payout method for affiliate
   */
  async getPayoutMethod(affiliateId: string): Promise<AffiliatePayoutMethod | null> {
    try {
      const { data, error } = await supabase
        .from("affiliate_payout_methods")
        .select("*")
        .eq("affiliate_id", affiliateId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error fetching payout method:", error);
      }
      return data as AffiliatePayoutMethod | null;
    } catch (err) {
      console.error("Error in getPayoutMethod:", err);
      return null;
    }
  },

  /**
   * Save / update payout method
   */
  async savePayoutMethod(method: AffiliatePayoutMethod): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("affiliate_payout_methods")
        .upsert(
          {
            affiliate_id: method.affiliate_id,
            provider: method.provider,
            account_phone: method.account_phone || null,
            account_name: method.account_name,
            bank_name: method.bank_name || null,
            account_number_iban: method.account_number_iban || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "affiliate_id" }
        );

      if (error) {
        console.error("Error saving payout method:", error);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Error in savePayoutMethod:", err);
      return false;
    }
  },

  /**
   * Calculate stats for an affiliate
   */
  async getStats(affiliateId: string): Promise<AffiliateStats> {
    try {
      // 1. Minimum threshold
      const threshold = await this.getMinimumPayoutThreshold();

      // 2. Referrals count
      const { count: referredCount } = await supabase
        .from("affiliate_referrals")
        .select("*", { count: "exact", head: true })
        .eq("affiliate_id", affiliateId);

      // 3. Commissions
      const { data: commissions } = await supabase
        .from("affiliate_commissions")
        .select("*")
        .eq("affiliate_id", affiliateId);

      let totalEarned = 0;
      let pendingAmount = 0;
      let payableAmount = 0;
      let paidAmount = 0;
      const paidUserIds = new Set<string>();

      if (commissions) {
        for (const c of commissions) {
          const amt = Number(c.commission_amount || 0);
          if (c.status === "PENDING") {
            pendingAmount += amt;
          } else if (c.status === "PAYABLE" || c.status === "APPROVED") {
            payableAmount += amt;
            totalEarned += amt;
            paidUserIds.add(c.referred_user_id);
          } else if (c.status === "PAID") {
            paidAmount += amt;
            totalEarned += amt;
            paidUserIds.add(c.referred_user_id);
          }
        }
      }

      // Profile for rate
      const { data: profile } = await supabase
        .from("affiliates")
        .select("commission_rate")
        .eq("id", affiliateId)
        .single();

      const rate = profile ? Number(profile.commission_rate) : 0.20;

      return {
        totalEarned,
        pendingAmount,
        payableAmount,
        paidAmount,
        referredCount: referredCount || 0,
        paidCustomersCount: paidUserIds.size,
        commissionRate: rate,
        minimumThreshold: threshold,
        isEligibleForPayout: payableAmount >= threshold,
      };
    } catch (err) {
      console.error("Error calculating affiliate stats:", err);
      return {
        totalEarned: 0,
        pendingAmount: 0,
        payableAmount: 0,
        paidAmount: 0,
        referredCount: 0,
        paidCustomersCount: 0,
        commissionRate: 0.20,
        minimumThreshold: 10000,
        isEligibleForPayout: false,
      };
    }
  },

  /**
   * Get minimum payout threshold (default 10,000 FCFA)
   */
  async getMinimumPayoutThreshold(): Promise<number> {
    try {
      const { data } = await supabase
        .from("affiliate_settings")
        .select("value")
        .eq("key", "minimum_payout_threshold")
        .single();

      if (data && data.value) {
        return Number(data.value);
      }
    } catch (e) {
      // Fallback default
    }
    return 10000;
  },

  /**
   * Update minimum payout threshold (Founder only)
   */
  async updateMinimumPayoutThreshold(newThreshold: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("affiliate_settings")
        .upsert({
          key: "minimum_payout_threshold",
          value: JSON.stringify(newThreshold),
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error("Error updating minimum payout threshold:", error);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Error in updateMinimumPayoutThreshold:", err);
      return false;
    }
  },

  /**
   * Fetch referrals list for affiliate
   */
  async getReferrals(affiliateId: string) {
    try {
      const { data, error } = await supabase
        .from("affiliate_referrals")
        .select(`
          id,
          referred_user_id,
          referral_code_used,
          created_at
        `)
        .eq("affiliate_id", affiliateId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Error fetching referrals:", err);
      return [];
    }
  },

  /**
   * Fetch commissions list for affiliate
   */
  async getCommissions(affiliateId: string): Promise<AffiliateCommission[]> {
    try {
      const { data, error } = await supabase
        .from("affiliate_commissions")
        .select("*")
        .eq("affiliate_id", affiliateId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as AffiliateCommission[];
    } catch (err) {
      console.error("Error fetching commissions:", err);
      return [];
    }
  },

  /**
   * Fetch payout history for affiliate
   */
  async getPayouts(affiliateId: string): Promise<AffiliatePayout[]> {
    try {
      const { data, error } = await supabase
        .from("affiliate_payouts")
        .select("*")
        .eq("affiliate_id", affiliateId)
        .order("paid_at", { ascending: false });

      if (error) throw error;
      return (data || []) as AffiliatePayout[];
    } catch (err) {
      console.error("Error fetching payouts:", err);
      return [];
    }
  },

  /**
   * Record the referral code for the logged-in user (the server attaches the caller, never another account)
   */
  async recordReferral(affiliateCode: string): Promise<boolean> {
    return (await this.recordReferralDetailed(affiliateCode)).success;
  },

  /**
   * Same as recordReferral, but tells a definitive refusal (invalid code, self-referral, already paid)
   * from a transient failure (network, RPC error) so callers know whether a retry can ever succeed.
   */
  async recordReferralDetailed(affiliateCode: string): Promise<{ success: boolean; definitive: boolean }> {
    const cleanCode = (affiliateCode || "").trim().toUpperCase();
    if (!cleanCode) return { success: false, definitive: true };

    try {
      const { data, error } = await supabase.rpc("record_affiliate_referral", {
        p_affiliate_code: cleanCode,
      });

      if (error) {
        console.error("Error recording affiliate referral:", error);
        return { success: false, definitive: false };
      }
      const success = (data as any)?.success === true;
      return { success, definitive: true };
    } catch (err) {
      console.error("Error in recordReferral:", err);
      return { success: false, definitive: false };
    }
  },

  /**
   * Record the referral code pending for the logged-in user, then forget it.
   * Sources, by priority: code typed for this email at signup, code of the last referral link
   * opened in this browser, code carried by the account itself (signup confirmed on another device).
   */
  async checkAndRecordPendingReferral(userId: string, email?: string, accountCode?: string | null): Promise<boolean> {
    try {
      const emailKey = email ? `referral_${email}` : null;
      const storedRefCode =
        (emailKey ? localStorage.getItem(emailKey) : null) ||
        localStorage.getItem("ecomfy_affiliate_ref") ||
        accountCode ||
        null;

      if (!storedRefCode || !storedRefCode.trim()) {
        return false;
      }

      const cleanCode = storedRefCode.trim().toUpperCase();
      console.log(`Processing pending referral for user ${userId} with code ${cleanCode}`);

      const { success, definitive } = await this.recordReferralDetailed(cleanCode);

      // A transient failure keeps the code for the next attempt; a definitive answer settles it.
      if (definitive) {
        localStorage.removeItem("ecomfy_affiliate_ref");
        if (emailKey) {
          localStorage.removeItem(emailKey);
        }
        if (accountCode) {
          const { error } = await supabase.auth.updateUser({ data: { referral_code: null } });
          if (error) console.warn("Could not clear referral_code from account metadata:", error);
        }
      }

      return success;
    } catch (err) {
      console.error("Error in checkAndRecordPendingReferral:", err);
      return false;
    }
  },

  /**
   * Fetch payout periods (Q1, Q2, Q3, Q4)
   */
  async getPayoutPeriods(): Promise<PayoutPeriod[]> {
    try {
      const { data, error } = await supabase
        .from("affiliate_payout_periods")
        .select("*")
        .order("start_date", { ascending: false });

      if (error) throw error;
      return (data || []) as PayoutPeriod[];
    } catch (err) {
      console.error("Error fetching payout periods:", err);
      return [];
    }
  },

  /**
   * Founder Admin: Global Overview Metrics
   */
  async getFounderOverview(periodCode?: string) {
    try {
      const { count: totalAffiliates } = await supabase
        .from("affiliates")
        .select("*", { count: "exact", head: true });

      const { count: activeAffiliates } = await supabase
        .from("affiliates")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      const { count: totalReferredUsers } = await supabase
        .from("affiliate_referrals")
        .select("*", { count: "exact", head: true });

      let commissionQuery = supabase.from("affiliate_commissions").select("*");
      if (periodCode && periodCode !== "ALL") {
        commissionQuery = commissionQuery.eq("period_code", periodCode);
      }

      const { data: commissions } = await commissionQuery;

      let pendingAmount = 0;
      let approvedAmount = 0;
      let payableAmount = 0;
      let paidAmount = 0;
      let subscriptionsCount = 0;

      if (commissions) {
        subscriptionsCount = commissions.length;
        for (const c of commissions) {
          const amt = Number(c.commission_amount || 0);
          if (c.status === "PENDING") pendingAmount += amt;
          else if (c.status === "APPROVED") approvedAmount += amt;
          else if (c.status === "PAYABLE") payableAmount += amt;
          else if (c.status === "PAID") paidAmount += amt;
        }
      }

      let payoutsQuery = supabase.from("affiliate_payouts").select("amount_paid");
      if (periodCode && periodCode !== "ALL") {
        payoutsQuery = payoutsQuery.eq("period_code", periodCode);
      }
      const { data: payouts } = await payoutsQuery;
      let totalPaidAmount = 0;
      if (payouts) {
        totalPaidAmount = payouts.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
      }

      return {
        totalAffiliates: totalAffiliates || 0,
        activeAffiliates: activeAffiliates || 0,
        totalReferredUsers: totalReferredUsers || 0,
        totalSubscriptionsCount: subscriptionsCount,
        pendingAmount,
        approvedAmount,
        payableAmount: payableAmount + approvedAmount,
        paidAmount: totalPaidAmount || paidAmount,
        totalPaidAmount: totalPaidAmount || paidAmount,
        remainingPayableAmount: payableAmount + approvedAmount,
      };
    } catch (err) {
      console.error("Error fetching founder overview:", err);
      return {
        totalAffiliates: 0,
        activeAffiliates: 0,
        totalReferredUsers: 0,
        totalSubscriptionsCount: 0,
        pendingAmount: 0,
        approvedAmount: 0,
        payableAmount: 0,
        paidAmount: 0,
        totalPaidAmount: 0,
        remainingPayableAmount: 0,
      };
    }
  },

  /**
   * Founder Admin: Fetch list of all affiliates with compiled financial stats
   */
  async getFounderAffiliateList(periodCode?: string): Promise<FounderAffiliateListItem[]> {
    try {
      const { data: affiliates, error } = await supabase
        .from("affiliates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!affiliates || affiliates.length === 0) return [];

      const affiliateIds = affiliates.map((a) => a.id);
      const userIds = affiliates.map((a) => a.user_id);

      // Fetch user profiles for email & names
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, first_name, last_name")
        .in("id", userIds);

      const profileMap = new Map<string, any>();
      if (profiles) {
        profiles.forEach((p) => profileMap.set(p.id, p));
      }

      // Fetch payout methods
      const { data: payoutMethods } = await supabase
        .from("affiliate_payout_methods")
        .select("*")
        .in("affiliate_id", affiliateIds);

      const payoutMap = new Map<string, AffiliatePayoutMethod>();
      if (payoutMethods) {
        payoutMethods.forEach((pm) => payoutMap.set(pm.affiliate_id, pm as AffiliatePayoutMethod));
      }

      // Fetch referral counts per affiliate
      const { data: referrals } = await supabase
        .from("affiliate_referrals")
        .select("affiliate_id");

      const referralCounts = new Map<string, number>();
      if (referrals) {
        referrals.forEach((r) => {
          referralCounts.set(r.affiliate_id, (referralCounts.get(r.affiliate_id) || 0) + 1);
        });
      }

      // Fetch commissions per affiliate
      let commQuery = supabase.from("affiliate_commissions").select("*");
      if (periodCode && periodCode !== "ALL") {
        commQuery = commQuery.eq("period_code", periodCode);
      }
      const { data: commissions } = await commQuery;

      const statsMap = new Map<string, { total_earned: number; payable: number; paid: number; count: number }>();
      if (commissions) {
        commissions.forEach((c) => {
          const affId = c.affiliate_id;
          const current = statsMap.get(affId) || { total_earned: 0, payable: 0, paid: 0, count: 0 };
          const amt = Number(c.commission_amount || 0);

          current.count += 1;
          if (c.status === "PAYABLE" || c.status === "APPROVED") {
            current.payable += amt;
            current.total_earned += amt;
          } else if (c.status === "PAID") {
            current.paid += amt;
            current.total_earned += amt;
          }
          statsMap.set(affId, current);
        });
      }

      return affiliates.map((aff) => {
        const prof = profileMap.get(aff.user_id);
        const pm = payoutMap.get(aff.id) || null;
        const refCount = referralCounts.get(aff.id) || 0;
        const st = statsMap.get(aff.id) || { total_earned: 0, payable: 0, paid: 0, count: 0 };

        const name = prof?.full_name || `${prof?.first_name || ""} ${prof?.last_name || ""}`.trim() || prof?.email || "Utilisateur";

        return {
          affiliate: aff as AffiliateProfile,
          user_email: prof?.email,
          user_name: name,
          payout_method: pm,
          referred_count: refCount,
          subscriptions_count: st.count,
          total_earned: st.total_earned,
          payable_amount: st.payable,
          paid_amount: st.paid,
          status: aff.status,
        };
      });
    } catch (err) {
      console.error("Error in getFounderAffiliateList:", err);
      return [];
    }
  },

  /**
   * Founder Admin: Mark payout as paid manually
   */
  async markPayoutPaid(params: {
    affiliate_id: string;
    amount: number;
    payment_method: string;
    payment_reference: string;
    period_code?: string;
    notes?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc("mark_affiliate_payout_paid", {
        p_affiliate_id: params.affiliate_id,
        p_amount: params.amount,
        p_payment_method: params.payment_method,
        p_payment_reference: params.payment_reference,
        p_period_code: params.period_code || null,
        p_notes: params.notes || null,
      });

      if (error) {
        console.error("RPC Error marking payout paid:", error);
        return { success: false, error: error.message };
      }

      return { success: (data as any)?.success === true };
    } catch (err: any) {
      console.error("Error in markPayoutPaid:", err);
      return { success: false, error: err.message || "Erreur lors du traitement" };
    }
  },
};
