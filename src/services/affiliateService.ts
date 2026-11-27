import { supabase } from "@/integrations/supabase/client";
import { pageRange, type PageResult, readPage } from "@/lib/pagination";

export interface FounderAffiliateOverview {
  totalAffiliates: number;
  activeAffiliates: number;
  totalReferredUsers: number;
  totalSubscriptionsCount: number;
  pendingAmount: number;
  approvedAmount: number;
  payableAmount: number;
  paidAmount: number;
  totalPaidAmount: number;
  remainingPayableAmount: number;
}

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
  commissionsCount: number;
  payoutsCount: number;
}

export interface AffiliateReferral {
  id: string;
  referred_user_id: string;
  referral_code_used: string;
  created_at: string;
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
   * Totaux d'un affilié, comptés par la base. Lève une erreur si la lecture échoue : des zéros laisseraient
   * croire qu'il n'y a aucune commission.
   */
  async getStats(affiliateId: string): Promise<AffiliateStats> {
    const [threshold, summary, profile] = await Promise.all([
      this.getMinimumPayoutThreshold(),
      supabase.rpc("affiliate_summary" as never, { _affiliate_id: affiliateId } as never),
      supabase.from("affiliates").select("commission_rate").eq("id", affiliateId).single(),
    ]);
    if (summary.error) throw summary.error;
    const totals = summary.data as unknown as Record<
      "pending_amount" | "payable_amount" | "paid_amount" | "paid_customers" | "commissions_count" | "referred_count" | "payouts_count", number>;

    const payableAmount = Number(totals.payable_amount);
    const paidAmount = Number(totals.paid_amount);
    return {
      totalEarned: payableAmount + paidAmount,
      pendingAmount: Number(totals.pending_amount),
      payableAmount,
      paidAmount,
      referredCount: Number(totals.referred_count),
      paidCustomersCount: Number(totals.paid_customers),
      commissionsCount: Number(totals.commissions_count),
      payoutsCount: Number(totals.payouts_count),
      commissionRate: profile.data ? Number(profile.data.commission_rate) : 0.20,
      minimumThreshold: threshold,
      isEligibleForPayout: payableAmount >= threshold,
    };
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

  /** Une page des filleuls, les plus récents d'abord. */
  async getReferralsPage(affiliateId: string, page: number, pageSize: number): Promise<PageResult<AffiliateReferral>> {
    return readPage<AffiliateReferral>(page, pageSize, (from, to) =>
      supabase
        .from("affiliate_referrals")
        .select("id, referred_user_id, referral_code_used, created_at", { count: "exact" })
        .eq("affiliate_id", affiliateId)
        .order("created_at", { ascending: false }).order("id", { ascending: false })
        .range(from, to));
  },

  /** Une page des commissions, les plus récentes d'abord. */
  async getCommissionsPage(affiliateId: string, page: number, pageSize: number): Promise<PageResult<AffiliateCommission>> {
    return readPage<AffiliateCommission>(page, pageSize, (from, to) =>
      supabase
        .from("affiliate_commissions")
        .select("*", { count: "exact" })
        .eq("affiliate_id", affiliateId)
        .order("created_at", { ascending: false }).order("id", { ascending: false })
        .range(from, to));
  },

  /** Une page des versements reçus, les plus récents d'abord. */
  async getPayoutsPage(affiliateId: string, page: number, pageSize: number): Promise<PageResult<AffiliatePayout>> {
    return readPage<AffiliatePayout>(page, pageSize, (from, to) =>
      supabase
        .from("affiliate_payouts")
        .select("*", { count: "exact" })
        .eq("affiliate_id", affiliateId)
        .order("paid_at", { ascending: false }).order("id", { ascending: false })
        .range(from, to));
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
   * Founder Admin: Global Overview Metrics (additionnés en base).
   */
  async getFounderOverview(periodCode?: string): Promise<FounderAffiliateOverview> {
    // Fonctions absentes des types générés.
    const { data, error } = await supabase.rpc("founder_affiliate_overview" as never, {
      _period: periodCode || null,
    } as never);
    if (error) throw error;
    if (!data) throw new Error("Accès refusé.");
    return data as unknown as FounderAffiliateOverview;
  },

  /**
   * Founder Admin: une page d'affiliés avec leurs totaux sur la période.
   */
  async getFounderAffiliatePage(params: {
    periodCode?: string;
    search: string;
    page: number;
    pageSize: number;
  }): Promise<PageResult<FounderAffiliateListItem>> {
    const [from] = pageRange(params.page, params.pageSize);
    const { data, error } = await supabase.rpc("founder_affiliate_list" as never, {
      _period: params.periodCode || null,
      _query: params.search || null,
      _limit: params.pageSize,
      _offset: from,
    } as never);
    if (error) throw error;
    if (!data) throw new Error("Accès refusé.");
    return data as unknown as PageResult<FounderAffiliateListItem>;
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
