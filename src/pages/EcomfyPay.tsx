import React, { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ecomfyPayApi } from "@/lib/ecomfyPay";
import {
  MerchantKyc,
  PaymentLink,
  EcomfyPayment,
  Wallet,
  WalletLedgerEntry,
  WithdrawalRequest,
} from "@/types/ecomfyPay";
import { OverviewTab } from "@/components/ecomfy-pay/OverviewTab";
import { PaymentsTab } from "@/components/ecomfy-pay/PaymentsTab";
import { PaymentLinksTab } from "@/components/ecomfy-pay/PaymentLinksTab";
import { WalletTab } from "@/components/ecomfy-pay/WalletTab";
import { WithdrawalModal } from "@/components/ecomfy-pay/WithdrawalModal";
import { KycVerificationTab } from "@/components/ecomfy-pay/KycVerificationTab";
import { PaymentMethodsTab } from "@/components/ecomfy-pay/PaymentMethodsTab";
import { SettingsTab } from "@/components/ecomfy-pay/SettingsTab";
import {
  CreditCard,
  Wallet as WalletIcon,
  Link as LinkIcon,
  ShieldCheck,
  Settings as SettingsIcon,
  RefreshCw,
  Store,
  FlaskConical,
  Zap,
} from "lucide-react";

export default function EcomfyPay() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";

  const [loading, setLoading] = useState(true);
  const [kyc, setKyc] = useState<MerchantKyc | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [payments, setPayments] = useState<EcomfyPayment[]>([]);
  const [ledger, setLedger] = useState<WalletLedgerEntry[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string | undefined>();
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [isSandbox, setIsSandbox] = useState(false);

  const navigate = useNavigate();

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat("fr-FR").format(amount);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Load user shops
      const { data: shopData } = await supabase
        .from("shops")
        .select("id, name, business_name")
        .eq("user_id", session.user.id);

      if (shopData && shopData.length > 0) {
        const formatted = shopData.map((s) => ({
          id: s.id,
          name: s.business_name || s.name || "Ma boutique",
        }));
        setShops(formatted);
        if (!selectedShopId) setSelectedShopId(formatted[0].id);
      }

      const [kycRes, walletRes, paymentsRes, ledgerRes, withdrawalsRes, linksRes] =
        await Promise.all([
          ecomfyPayApi.getKycStatus(),
          ecomfyPayApi.getWallet(),
          ecomfyPayApi.getPayments(),
          ecomfyPayApi.getLedger(),
          ecomfyPayApi.getWithdrawals(),
          ecomfyPayApi.getPaymentLinks(selectedShopId),
        ]);

      setKyc(kycRes);
      setWallet(walletRes);
      setPayments(paymentsRes);
      setLedger(ledgerRes);
      setWithdrawals(withdrawalsRes);
      setPaymentLinks(linksRes);
    } catch (err) {
      console.error("[EcomfyPay] Failed to load data", err);
    } finally {
      setLoading(false);
    }
  }, [navigate, selectedShopId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  return (
    <div className="min-h-screen flex flex-col w-full bg-slate-50 text-slate-900 font-inter pb-20 md:pb-8">
      <Helmet>
        <title>Ecomfy Pay (BETA) — Infrastructure de Paiement &amp; Wallet Marchand</title>
      </Helmet>

      {/* Header Bar avec Mode Sandbox / Live & Badge BETA */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <SidebarTrigger />
          <div className="p-2 bg-[#0E7C66] text-white rounded-xl shadow-sm shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-lg sm:text-xl text-slate-900 tracking-tight">
                Ecomfy Pay
              </h1>
              <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-md border-0 uppercase tracking-wider">
                BETA
              </Badge>
            </div>
            <p className="text-xs text-slate-500 truncate hidden sm:block">
              Infrastructure de paiement centralisée &amp; Portefeuille marchands
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Commutateur Mode Sandbox vs Production */}
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold">
            {isSandbox ? (
              <FlaskConical className="w-3.5 h-3.5 text-amber-600" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span className={isSandbox ? "text-amber-800 font-bold" : "text-emerald-800 font-bold"}>
              {isSandbox ? "Sandbox (Test)" : "Production (Live)"}
            </span>
            <Switch
              checked={isSandbox}
              onCheckedChange={setIsSandbox}
              className="data-[state=checked]:bg-amber-500 data-[state=unchecked]:bg-emerald-600"
            />
          </div>

          {shops.length > 0 && (
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold">
              <Store className="w-3.5 h-3.5 text-[#0E7C66]" />
              <span>{shops.find((s) => s.id === selectedShopId)?.name}</span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl border-slate-200 text-slate-700 text-xs font-semibold gap-1.5"
            onClick={loadData}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Actualiser</span>
          </Button>
        </div>
      </header>

      {/* Mode Sandbox Notice */}
      {isSandbox && (
        <div className="bg-amber-500 text-white text-center py-1.5 px-4 text-xs font-bold flex items-center justify-center gap-2">
          <FlaskConical className="w-3.5 h-3.5" />
          <span>Mode Test (Sandbox) Actif — Les transactions générées utiliseront des paiements de démonstration sans débit réel.</span>
        </div>
      )}

      {/* Main Dashboard Workspace */}
      <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="bg-white border border-slate-200/80 p-1.5 rounded-2xl flex items-center justify-start overflow-x-auto w-full mb-6 shadow-sm gap-1">
            <TabsTrigger
              value="overview"
              className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white text-slate-600 shrink-0 gap-1.5 transition-all"
            >
              <CreditCard className="w-3.5 h-3.5" /> Vue d'ensemble
            </TabsTrigger>

            <TabsTrigger
              value="payments"
              className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white text-slate-600 shrink-0 gap-1.5 transition-all"
            >
              <CreditCard className="w-3.5 h-3.5" /> Paiements &amp; Transactions
            </TabsTrigger>

            <TabsTrigger
              value="payment_links"
              className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white text-slate-600 shrink-0 gap-1.5 transition-all"
            >
              <LinkIcon className="w-3.5 h-3.5" /> Payment Links
            </TabsTrigger>

            <TabsTrigger
              value="wallet"
              className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white text-slate-600 shrink-0 gap-1.5 transition-all"
            >
              <WalletIcon className="w-3.5 h-3.5" /> Wallet &amp; Retraits
            </TabsTrigger>

            <TabsTrigger
              value="methods"
              className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white text-slate-600 shrink-0 gap-1.5 transition-all"
            >
              Moyens de Paiement
            </TabsTrigger>

            <TabsTrigger
              value="kyc"
              className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white text-slate-600 shrink-0 gap-1.5 transition-all"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> KYC / Vérification
            </TabsTrigger>

            <TabsTrigger
              value="settings"
              className="rounded-xl px-4 py-2 text-xs font-bold data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white text-slate-600 shrink-0 gap-1.5 transition-all"
            >
              <SettingsIcon className="w-3.5 h-3.5" /> Paramètres
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab
              wallet={wallet}
              kyc={kyc}
              payments={payments}
              onOpenWithdrawal={() => setWithdrawalModalOpen(true)}
              onNavigateTab={handleTabChange}
              formatPrice={formatPrice}
            />
          </TabsContent>

          <TabsContent value="payments">
            <PaymentsTab
              payments={payments}
              onRefresh={loadData}
              formatPrice={formatPrice}
            />
          </TabsContent>

          <TabsContent value="payment_links">
            <PaymentLinksTab
              paymentLinks={paymentLinks}
              shopId={selectedShopId}
              shops={shops}
              onRefresh={loadData}
              formatPrice={formatPrice}
            />
          </TabsContent>

          <TabsContent value="wallet">
            <WalletTab
              wallet={wallet}
              ledger={ledger}
              withdrawals={withdrawals}
              onOpenWithdrawal={() => setWithdrawalModalOpen(true)}
              formatPrice={formatPrice}
            />
          </TabsContent>

          <TabsContent value="methods">
            <PaymentMethodsTab />
          </TabsContent>

          <TabsContent value="kyc">
            <KycVerificationTab kyc={kyc} onRefresh={loadData} />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsTab wallet={wallet} onRefresh={loadData} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Modal de Retrait */}
      <WithdrawalModal
        open={withdrawalModalOpen}
        onOpenChange={setWithdrawalModalOpen}
        wallet={wallet}
        kyc={kyc}
        onSuccess={loadData}
        formatPrice={formatPrice}
      />

      <MobileBottomNav />
    </div>
  );
}
