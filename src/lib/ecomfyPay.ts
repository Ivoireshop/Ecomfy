import { supabase } from "@/integrations/supabase/client";
import {
  MerchantKyc,
  PaymentLink,
  EcomfyPayment,
  Wallet,
  WalletLedgerEntry,
  WithdrawalRequest,
} from "@/types/ecomfyPay";

export const ecomfyPayApi = {
  // 1. KYC MARCHAND SÉCURISÉ
  async getKycStatus(): Promise<MerchantKyc | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { data, error } = await supabase
      .from("merchant_kyc")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) {
      console.warn("Error fetching KYC:", error);
      return null;
    }
    return data as MerchantKyc | null;
  },

  async submitKyc(kycData: Partial<MerchantKyc>): Promise<{ success: boolean; error?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { success: false, error: "Non connecté" };

    const payload = {
      ...kycData,
      user_id: session.user.id,
      verification_status: "PENDING",
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("merchant_kyc")
      .upsert(payload, { onConflict: "user_id" });

    if (error) {
      return { success: false, error: error.message };
    }

    // Appeler la fonction RPC d'évaluation de sécurité strict
    try {
      const { data: evalRes } = await supabase.rpc("evaluate_merchant_kyc_security", {
        p_merchant_id: session.user.id,
        p_doc_type: kycData.document_type || "cni",
        p_doc_number: kycData.document_number || "",
        p_declared_name: kycData.full_name || "",
        p_doc_front_url: kycData.document_front_url || "",
        p_selfie_url: kycData.selfie_url || null,
      });

      if (evalRes && evalRes.success === false) {
        return { success: false, error: evalRes.reason || "Document non conforme aux exigences KYC." };
      }
    } catch (e) {
      console.warn("RPC evaluate_merchant_kyc_security warning:", e);
    }

    return { success: true };
  },

  // 2. WALLET & CONFIGURATION DE RETRAIT PAR DÉFAUT
  async getWallet(): Promise<Wallet | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { data, error } = await supabase
      .rpc("get_or_create_merchant_wallet", { p_merchant_id: session.user.id });

    if (error) {
      console.warn("Error fetching wallet via RPC:", error);
      const { data: direct } = await supabase
        .from("wallets")
        .select("*")
        .eq("merchant_id", session.user.id)
        .maybeSingle();
      return direct as Wallet | null;
    }

    return data as Wallet | null;
  },

  async savePayoutConfig(params: {
    payout_phone: string;
    payout_name: string;
    payout_provider?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { success: false, error: "Non connecté" };

    const { data, error } = await supabase.rpc("save_merchant_payout_config", {
      p_merchant_id: session.user.id,
      p_payout_phone: params.payout_phone,
      p_payout_name: params.payout_name,
      p_payout_provider: params.payout_provider || "wave",
    });

    if (error || !data?.success) {
      return { success: false, error: error?.message || "Impossible d'enregistrer le numéro de retrait." };
    }
    return { success: true };
  },

  async getLedger(): Promise<WalletLedgerEntry[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return [];

    const { data, error } = await supabase
      .from("wallet_ledger")
      .select("*")
      .eq("merchant_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.warn("Error fetching ledger:", error);
      return [];
    }
    return (data || []) as WalletLedgerEntry[];
  },

  // 3. TRANSACTIONS / PAIEMENTS REÇUS
  async getPayments(): Promise<EcomfyPayment[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return [];

    const { data, error } = await supabase
      .from("ecomfy_payments")
      .select("*, shops(business_name)")
      .eq("merchant_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.warn("Error fetching payments:", error);
      return [];
    }
    return (data || []) as EcomfyPayment[];
  },

  // 4. DEMANDES DE RETRAIT
  async getWithdrawals(): Promise<WithdrawalRequest[]> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return [];

    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("merchant_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.warn("Error fetching withdrawals:", error);
      return [];
    }
    return (data || []) as WithdrawalRequest[];
  },

  async requestWithdrawal(params: {
    amount: number;
    payout_method: "mobile_money" | "bank_transfer";
    destination_phone?: string;
    destination_name?: string;
    destination_bank_iban?: string;
  }): Promise<{ success: boolean; error?: string; withdrawal_reference?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: "Session expirée." };

    try {
      const { data, error } = await supabase.functions.invoke("ecomfy-pay-withdraw", {
        body: params,
      });

      if (error || !data?.success) {
        return {
          success: false,
          error: data?.error || error?.message || "Échec de la demande de retrait.",
        };
      }

      return {
        success: true,
        withdrawal_reference: data.withdrawal_reference,
      };
    } catch (e: any) {
      return { success: false, error: e.message || "Erreur réseau" };
    }
  },

  // 5. PAYMENT LINKS (SANDBOX vs PRODUCTION)
  async getPaymentLinks(shopId?: string): Promise<PaymentLink[]> {
    let query = supabase.from("payment_links").select("*, products(name)");
    if (shopId) {
      query = query.eq("shop_id", shopId);
    }
    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.warn("Error fetching payment links:", error);
      return [];
    }
    return (data || []) as PaymentLink[];
  },

  async createPaymentLink(params: {
    shop_id: string;
    product_id?: string;
    title: string;
    description?: string;
    amount: number;
    currency?: string;
    is_sandbox?: boolean;
  }): Promise<{ success: boolean; paymentLink?: PaymentLink; error?: string }> {
    const prefix = params.is_sandbox ? "test_pay_" : "pay_";
    const linkKey = `${prefix}${Math.random().toString(36).substring(2, 12)}`;
    const payload = {
      ...params,
      link_key: linkKey,
      currency: params.currency || "XOF",
      is_active: true,
      is_sandbox: params.is_sandbox || false,
    };

    const { data, error } = await supabase
      .from("payment_links")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, paymentLink: data as PaymentLink };
  },

  // 6. INITIALISATION D'UN PAIEMENT CLIENT (CHECKOUT)
  async initiateCustomerPayment(params: {
    shop_id: string;
    product_id?: string;
    payment_link_id?: string;
    amount: number;
    currency?: string;
    payment_method: string;
    customer_name?: string;
    customer_phone?: string;
    customer_email?: string;
    customer_address?: string;
    customer_city?: string;
    order_id?: string;
    is_sandbox?: boolean;
  }): Promise<{ success: boolean; checkout_url?: string; internal_reference?: string; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke("ecomfy-pay-initiate", {
        body: params,
      });

      if (error || !data?.success) {
        return {
          success: false,
          error: data?.error || error?.message || "Impossible d'initialiser le paiement.",
        };
      }

      return {
        success: true,
        checkout_url: data.checkout_url,
        internal_reference: data.internal_reference,
      };
    } catch (e: any) {
      return { success: false, error: e.message || "Erreur d'initialisation du paiement." };
    }
  },
};
