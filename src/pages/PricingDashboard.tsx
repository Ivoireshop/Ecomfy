import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, ShieldCheck, Loader2, Crown } from "lucide-react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { computeShopSubscription, pricingPlanIdFor, pricingPlanIdFromAmount } from "@/lib/shopSubscription";
import { useBillingSettings, useSubscriptionPlans } from "@/hooks/useSubscriptionPlans";
import {
  annualMonthlyEquivalent,
  annualSavingsPercent,
  fetchMyShopCoverage,
  formatFcfa,
  planChargeAmount,
  publicPlans,
  shopsIncludedLabel,
  type SubscriptionPlan,
} from "@/lib/subscriptionPlans";

const GRID_COLS: Record<number, string> = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" };

export default function PricingDashboard() {
  const { session } = useAuthReady();
  const [loading, setLoading] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { plans: allPlans } = useSubscriptionPlans();
  const { settings } = useBillingSettings();
  const plans = publicPlans(allPlans);
  const anyAnnual = plans.some((p) => p.price_annual);
  const maxSavings = Math.max(0, ...plans.map((p) => annualSavingsPercent(p)));

  useEffect(() => {
    if (session?.user?.id) {
      loadActivePlan();
    }
  }, [session]);

  const loadActivePlan = async () => {
    if (!session?.user?.id) return;
    try {
      // Abonnement du compte (plan + échéance), tel que la base le couvre. Null si la fonction n'existe pas encore.
      const coverage = await fetchMyShopCoverage();
      if (coverage) {
        setActivePlanId(coverage.subscription_active && coverage.plan_code ? coverage.plan_code : null);
        return;
      }

      // Repli : comme côté base, seule la date de fin de la boutique fait foi (ni is_subscribed, ni subscriptions.status).
      const { data: shopData } = await supabase
        .from("shops")
        .select("subscription_plan, subscription_active_until")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (shopData) {
        const sub = computeShopSubscription(shopData);
        setActivePlanId(sub.isActive ? pricingPlanIdFor(sub.plan) : null);
        return;
      }

      // Pas de boutique : abonnement de compte, formule retrouvée par le montant payé.
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("amount, end_date, status")
        .eq("user_id", session.user.id)
        .eq("status", "active")
        .maybeSingle();
      const accountActive = !!subData?.end_date && new Date(subData.end_date).getTime() > Date.now();
      setActivePlanId(accountActive ? pricingPlanIdFromAmount(subData?.amount) : null);
    } catch (e) {
      console.error("Error loading active plan:", e);
    }
  };

  // Une seule formule est « actuelle » : celle de l'abonnement en cours, sinon la formule gratuite.
  // Un ancien code de plan absent de la vente (ex. « starter ») correspond à la formule Pro de la page.
  const currentPlanCode = (() => {
    if (!activePlanId) return null;
    if (plans.some((p) => p.code === activePlanId)) return activePlanId;
    return pricingPlanIdFor(activePlanId);
  })();
  const isPlanActive = (planId: string) => planId === (currentPlanCode ?? "starter_free");

  // Déclenchement automatique post-connexion si l'utilisateur avait sélectionné un plan
  useEffect(() => {
    if (session?.user?.id && plans.length > 0) {
      const pendingPlan = sessionStorage.getItem("ecomfy_pending_plan");
      if (pendingPlan) {
        try {
          const { planId, annual } = JSON.parse(pendingPlan);
          sessionStorage.removeItem("ecomfy_pending_plan");
          const plan = plans.find((p) => p.code === planId);
          if (plan) handleSubscribe(plan, !!annual);
        } catch (e) {
          sessionStorage.removeItem("ecomfy_pending_plan");
        }
      }
    }
  }, [session, allPlans]);

  const handleSubscribe = async (plan: SubscriptionPlan, annual: boolean) => {
    setLoading(plan.code);
    try {
      const userId = session?.user?.id;
      if (!userId) {
        // Stocker l'intention pour relancer le paiement dès la création de compte / connexion
        sessionStorage.setItem("ecomfy_pending_plan", JSON.stringify({ planId: plan.code, annual }));
        toast({
          title: "Création de compte requise",
          description: "Veuillez créer votre compte Ecomfy ou vous connecter pour procéder au paiement de votre abonnement.",
        });
        navigate("/auth?signup=true&redirect=/pricing");
        return;
      }

      // Montant du plan pour la période choisie (le serveur le revérifie)
      const chargeAmount = planChargeAmount(plan, annual);
      if (!chargeAmount) {
        toast({ title: "Formule indisponible", description: "Ce plan n'a pas de formule annuelle.", variant: "destructive" });
        return;
      }

      // Boutique la plus ancienne : toujours parmi les boutiques incluses du plan
      const { data: userShop } = await supabase
        .from("shops")
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: {
          amount: chargeAmount,
          user_id: userId,
          payment_type: "shop_subscription",
          shop_id: userShop?.id || undefined,
          plan: plan.code,
          billing_cycle: annual ? "annual" : "monthly"
        },
      });

      if (error || !data?.success) {
        console.warn("Payment edge function info:", error || data);
        let errorDetail = data?.error || data?.message;

        if (data?.details && Array.isArray(data.details) && data.details.length > 0) {
          errorDetail = `${data.error || "Données invalides"}: ${data.details.map((d: any) => `${d.field} (${d.message})`).join(", ")}`;
        }

        if (!errorDetail && error) {
          try {
            if ((error as any)?.context && typeof (error as any).context.json === "function") {
              const errJson = await (error as any).context.json();
              errorDetail = errJson?.error || errJson?.message;
            }
          } catch (e) {
            console.warn("Could not parse error context json:", e);
          }
          if (!errorDetail) {
            errorDetail = error.message;
          }
        }

        toast({
          title: "Paiement non démarré",
          description: errorDetail || "Impossible de générer le lien de paiement automatique. Veuillez réessayer dans quelques instants.",
          variant: "destructive",
        });
        return;
      }

      const url = data.checkout_url || data.payment_url || data.url;
      if (url) {
        window.location.href = url;
      } else {
        toast({
          title: "URL de paiement non générée",
          description: "Veuillez réessayer dans un instant.",
          variant: "destructive"
        });
      }
    } catch (err: any) {
      console.error("Subscription error:", err);
      toast({
        title: "Erreur de paiement",
        description: "Impossible d'initier le paiement automatique. Veuillez réessayer.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const commissionLabel = `${formatFcfa(settings.commission_per_order)} FCFA`;

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-10 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h1 className="font-space font-bold text-2xl sm:text-3xl md:text-4xl tracking-tight text-slate-900">
            Choisissez la formule adaptée à votre business 🚀
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm">
            Débloquez les fonctionnalités Pro ou rejoignez le Pass Premium Académie pour booster vos ventes.
          </p>

          {/* Mensuel / Annuel Switch Toggle */}
          {anyAnnual && (
            <div className="pt-2 flex items-center justify-center gap-3">
              <span className={`text-xs sm:text-sm font-bold transition-colors ${!isAnnual ? 'text-[#0E7C66]' : 'text-slate-400'}`}>
                Mensuel
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                aria-label="Basculer entre facturation mensuelle et annuelle"
                className="relative w-12 h-6.5 rounded-full bg-slate-200 p-0.5 transition-colors duration-300 focus:outline-none shadow-inner"
                style={{ backgroundColor: isAnnual ? '#0E7C66' : '#cbd5e1' }}
              >
                <div
                  className="w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300"
                  style={{ transform: isAnnual ? 'translateX(22px)' : 'translateX(0)' }}
                />
              </button>
              <span className={`text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors ${isAnnual ? 'text-[#0E7C66]' : 'text-slate-400'}`}>
                Annuel
                {maxSavings > 0 && (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    Économisez {maxSavings}%
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Plans : la formule gratuite puis un bloc par plan en vente (réglés par le fondateur) */}
        <div className={`grid grid-cols-1 ${GRID_COLS[Math.min(plans.length + 1, 4)]} gap-6 lg:gap-8 items-stretch`}>

          {/* Plan gratuit */}
          <div className={`rounded-3xl p-6 sm:p-8 border flex flex-col justify-between space-y-6 transition-all ${
            isPlanActive("starter_free")
              ? "bg-white border-2 border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.15)] relative"
              : "bg-white border-slate-200 shadow-sm"
          }`}>
            {isPlanActive("starter_free") && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] font-extrabold px-3.5 py-1 rounded-full uppercase tracking-wider shadow-md">
                [ ✓ PLAN ACTUEL ]
              </div>
            )}
            <div className="space-y-5">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Formule Débutant</span>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">Démarrage</h3>
                <p className="text-xs text-slate-500 mt-1">Gratuit pour toujours avec commission.</p>
              </div>

              <div className="py-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">0</span>
                  <span className="text-sm font-bold text-slate-700">FCFA</span>
                </div>
                <span className="text-[11px] text-slate-400 block mt-1">Pour toujours sans frais d'entrée</span>
              </div>

              <Button
                variant={isPlanActive("starter_free") ? "default" : "outline"}
                className={`w-full rounded-xl font-bold h-11 text-sm ${
                  isPlanActive("starter_free")
                    ? "bg-emerald-600 text-white cursor-default opacity-90"
                    : "border-slate-300 text-slate-700"
                }`}
                disabled={isPlanActive("starter_free")}
                onClick={() => navigate("/dashboard")}
              >
                {isPlanActive("starter_free") ? "✓ VOTRE PLAN ACTUEL" : "Plan Démarrage"}
              </Button>

              <ul className="space-y-3 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#0E7C66] shrink-0 mt-0.5" />
                  <span>Boutique e-commerce mobile complète</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#0E7C66] shrink-0 mt-0.5" />
                  <span>Paiements Mobile Money & Cash</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#0E7C66] shrink-0 mt-0.5" />
                  <span>Commission de {commissionLabel} par commande</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#0E7C66] shrink-0 mt-0.5" />
                  <span>2 vidéos & 5 images IA d'essai</span>
                </li>
              </ul>
            </div>
          </div>

          {plans.map((plan, index) => {
            const premium = index % 2 === 1;
            const active = isPlanActive(plan.code);
            const annualEquivalent = annualMonthlyEquivalent(plan);
            const showAnnual = isAnnual && annualEquivalent !== null;
            const price = showAnnual ? annualEquivalent! : plan.price_monthly;
            const saving = annualSavingsPercent(plan);
            const included = shopsIncludedLabel(plan.max_shops);
            const features = [...(included ? [included] : []), ...plan.features];
            return (
              <div
                key={plan.code}
                className={premium
                  ? `rounded-3xl p-6 sm:p-8 border-2 relative flex flex-col justify-between space-y-6 transition-all bg-gradient-to-b from-[#0F1B2C] via-[#0b1422] to-[#080d16] text-white ${
                      active ? "border-emerald-400 shadow-[0_0_35px_rgba(251,191,36,0.3)] ring-2 ring-emerald-400/50" : "border-amber-400/60 shadow-2xl"
                    }`
                  : `rounded-3xl p-6 sm:p-8 border relative flex flex-col justify-between space-y-6 transition-all bg-slate-900 text-white ${
                      active ? "border-2 border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.3)] ring-2 ring-emerald-500/40" : "border-emerald-500/40 shadow-xl"
                    }`}
              >
                {(plan.badge || active) && (
                  <div className={premium
                    ? "absolute top-0 right-6 transform -translate-y-1/2 bg-amber-400 text-slate-950 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1"
                    : "absolute top-0 right-6 transform -translate-y-1/2 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider"}>
                    {premium && <Crown className="w-3.5 h-3.5" />}
                    {active ? "[ ✓ PLAN ACTUEL ]" : plan.badge}
                  </div>
                )}

                <div className="space-y-5">
                  <div>
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${premium ? "text-amber-300" : "text-emerald-400"}`}>
                      {premium ? "Académie & Quotas MAX" : "Sans Commission"}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-bold text-white mt-0.5">{plan.name}</h3>
                    {plan.description && <p className="text-xs text-slate-300 mt-1">{plan.description}</p>}
                  </div>

                  <div className="py-2">
                    <div className="flex items-baseline flex-wrap gap-x-1.5 gap-y-0.5">
                      <span className={`text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight ${premium ? "text-amber-300" : "text-white"}`}>
                        {formatFcfa(price)}
                      </span>
                      <span className={`text-sm font-bold ${premium ? "text-amber-300" : "text-emerald-400"}`}>FCFA</span>
                      <span className="text-xs text-slate-400">/ mois</span>
                    </div>
                    <span className="text-[11px] text-emerald-400 font-medium block mt-1">
                      {showAnnual
                        ? `Facturé ${formatFcfa(plan.price_annual!)} FCFA / an${saving > 0 ? ` (-${saving}%)` : ""}`
                        : "Facturation mensuelle sans engagement"}
                    </span>
                  </div>

                  <Button
                    className={`w-full rounded-xl font-bold h-11 shadow-lg text-sm ${
                      active
                        ? "bg-emerald-600 text-white opacity-90 cursor-default"
                        : premium
                          ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 hover:opacity-95"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white"
                    }`}
                    onClick={() => handleSubscribe(plan, showAnnual)}
                    disabled={loading === plan.code || active}
                  >
                    {loading === plan.code ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 mr-2" />
                    )}
                    {active ? "✓ VOTRE PLAN ACTUEL (0 FCFA COMMISSION)" : `Activer ${plan.name}`}
                  </Button>
                  <div className="text-[10px] text-center text-emerald-400 font-medium">
                    Paiement 🟠 Orange · 🟡 MTN · 🔵 Wave · 🟢 Moov · 💳 Carte
                  </div>

                  <ul className={`space-y-3 text-xs ${premium ? "text-slate-100" : "text-slate-200"}`}>
                    {features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className={`w-4 h-4 shrink-0 mt-0.5 ${premium ? "text-amber-300" : "text-emerald-400"}`} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {included && (
                    <p className="text-[10px] text-slate-400">
                      Les boutiques au-delà paient la commission de {commissionLabel} par commande.
                    </p>
                  )}
                </div>
              </div>
            );
          })}

        </div>

      </div>
    </div>
  );
}
