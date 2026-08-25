import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, ShieldCheck, Loader2, Crown } from "lucide-react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function PricingDashboard() {
  const { session } = useAuthReady();
  const [loading, setLoading] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const navigate = useNavigate();

  // Déclenchement automatique post-connexion si l'utilisateur avait sélectionné un plan
  useEffect(() => {
    if (session?.user?.id) {
      const pendingPlan = sessionStorage.getItem("ecomfy_pending_plan");
      if (pendingPlan) {
        try {
          const { planId, monthlyRate } = JSON.parse(pendingPlan);
          sessionStorage.removeItem("ecomfy_pending_plan");
          handleSubscribe(planId, monthlyRate);
        } catch (e) {
          sessionStorage.removeItem("ecomfy_pending_plan");
        }
      }
    }
  }, [session]);

  const handleSubscribe = async (planId: string, monthlyRate: number) => {
    setLoading(planId);
    try {
      const userId = session?.user?.id;
      if (!userId) {
        // Stocker l'intention pour relancer le paiement dès la création de compte / connexion
        sessionStorage.setItem("ecomfy_pending_plan", JSON.stringify({ planId, monthlyRate, isAnnual }));
        toast({ 
          title: "Création de compte requise", 
          description: "Veuillez créer votre compte Ecomfy ou vous connecter pour procéder au paiement de votre abonnement.",
        });
        navigate("/auth?signup=true&redirect=/pricing");
        return;
      }

      // Calcul du montant total selon la période sélectionnée (Mensuel vs Annuel 12 mois)
      const chargeAmount = isAnnual ? monthlyRate * 12 : monthlyRate;

      // Récupération facultative de la boutique de l'utilisateur si elle existe déjà
      const { data: userShop } = await supabase
        .from("shops")
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: {
          amount: chargeAmount,
          user_id: userId,
          payment_type: "shop_subscription",
          shop_id: userShop?.id || null,
          plan: planId,
          billing_cycle: isAnnual ? "annual" : "monthly"
        },
      });
      
      if (error || !data?.success) {
        console.warn("Payment edge function info:", error || data);
        const errorDetail = data?.error || (error ? (error.message || String(error)) : null);
        
        toast({
          title: "Paiement en ligne non démarré",
          description: errorDetail && !errorDetail.includes("non-2xx") 
            ? errorDetail 
            : "Impossible de générer le lien de paiement automatique. Veuillez réessayer dans quelques instants.",
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

  const proPrice = isAnnual ? 9900 : 12000;
  const premiumPrice = isAnnual ? 28500 : 35000;

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
          <div className="pt-2 flex items-center justify-center gap-3">
            <span className={`text-xs sm:text-sm font-bold transition-colors ${!isAnnual ? 'text-[#0E7C66]' : 'text-slate-400'}`}>
              Mensuel
            </span>
            <button 
              onClick={() => setIsAnnual(!isAnnual)}
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
              <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                Économisez 20%
              </span>
            </span>
          </div>
        </div>

        {/* 3 Plans Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          
          {/* Plan 1: Free */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col justify-between space-y-6">
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
                variant="outline"
                className="w-full rounded-xl font-bold border-slate-300 text-slate-700 h-11 text-sm"
                onClick={() => navigate("/dashboard")}
              >
                Plan Actuel
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
                  <span>Commission de 50 FCFA par commande</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#0E7C66] shrink-0 mt-0.5" />
                  <span>2 vidéos & 5 images IA d'essai</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Plan 2: Pro (12 000 FCFA / mois - ou 9 900 FCFA / mois en annuel) */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-emerald-500/40 shadow-xl relative flex flex-col justify-between space-y-6">
            <div className="absolute top-0 right-6 transform -translate-y-1/2 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              ⚡ POPULAIRE
            </div>

            <div className="space-y-5">
              <div>
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Sans Commission</span>
                <h3 className="text-xl sm:text-2xl font-bold text-white mt-0.5">Ecomfy Pro</h3>
                <p className="text-xs text-slate-300 mt-1">Zéro commission & domaine propre.</p>
              </div>

              <div className="py-2">
                <div className="flex items-baseline flex-wrap gap-x-1.5 gap-y-0.5">
                  <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                    {proPrice.toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-emerald-400">FCFA</span>
                  <span className="text-xs text-slate-400">/ mois</span>
                </div>
                <span className="text-[11px] text-emerald-400 font-medium block mt-1">
                  {isAnnual ? "Facturé 118 800 FCFA / an (-20%)" : "Facturation mensuelle sans engagement"}
                </span>
              </div>

              <Button
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 shadow-lg text-sm"
                onClick={() => handleSubscribe("pro_monthly", proPrice)}
                disabled={loading === "pro_monthly"}
              >
                {loading === "pro_monthly" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Activer le Plan Pro
              </Button>

              <ul className="space-y-3 text-xs text-slate-200">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Zéro commission sur vos ventes (0 FCFA)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Boutique illimitée + Domaine propre</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>10 vidéos animées IA / mois</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>20 images HD studio IA / mois</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Support prioritaire WhatsApp 24/7</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Plan 3: Premium Académie & VIP (35 000 FCFA / mois - ou 28 500 FCFA / mois en annuel) */}
          <div className="bg-gradient-to-b from-[#0F1B2C] via-[#0b1422] to-[#080d16] text-white rounded-3xl p-6 sm:p-8 border-2 border-amber-400/60 shadow-2xl relative flex flex-col justify-between space-y-6">
            <div className="absolute top-0 right-6 transform -translate-y-1/2 bg-amber-400 text-slate-950 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
              <Crown className="w-3.5 h-3.5" />
              OFFRE MEMBRE VIP
            </div>

            <div className="space-y-5">
              <div>
                <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">Académie & Quotas MAX</span>
                <h3 className="text-xl sm:text-2xl font-bold text-white mt-0.5">Premium Académie & VIP</h3>
                <p className="text-xs text-slate-300 mt-1">Masterclasses vidéo, 20 vidéos + 40 images IA/mois.</p>
              </div>

              <div className="py-2">
                <div className="flex items-baseline flex-wrap gap-x-1.5 gap-y-0.5">
                  <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-amber-300 tracking-tight">
                    {premiumPrice.toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-amber-300">FCFA</span>
                  <span className="text-xs text-slate-400">/ mois</span>
                </div>
                <span className="text-[11px] text-emerald-400 font-semibold block mt-1">
                  {isAnnual ? "Facturé 342 000 FCFA / an (Économisez 20%)" : "Facturation mensuelle sans engagement"}
                </span>
              </div>

              <Button
                className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-extrabold h-11 shadow-xl hover:opacity-95 text-sm"
                onClick={() => handleSubscribe("premium_academy_pro", premiumPrice)}
                disabled={loading === "premium_academy_pro"}
              >
                {loading === "premium_academy_pro" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Activer le Pass Premium
              </Button>

              <ul className="space-y-3 text-xs text-slate-100">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                  <span>🎓 Masterclasses vidéo Académie Ecomfy</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                  <span>🎬 Jusqu'à 20 vidéos animées IA / mois</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                  <span>🖼️ Jusqu'à 40 images HD studio IA / mois</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                  <span>👥 Accès VIP à la Communauté Marchands</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                  <span>🛒 Zéro commission sur vos ventes (0 FCFA)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                  <span>💬 Support prioritaire VIP WhatsApp 24/7</span>
                </li>
              </ul>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
