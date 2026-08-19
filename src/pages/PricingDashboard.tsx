import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, ShieldCheck, Loader2, Crown, Zap, Sparkles } from "lucide-react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { ALL_PRICING_PLANS } from "@/config/pricingPlans";

export default function PricingDashboard() {
  const { session } = useAuthReady();
  const [loading, setLoading] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubscribe = async (planId: string, amount: number) => {
    setLoading(planId);
    try {
      const userId = session?.user?.id;
      if (!userId) {
        toast({ title: "Connectez-vous d'abord", variant: "destructive" });
        return;
      }
      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: {
          amount,
          user_id: userId,
          payment_type: "shop_subscription",
          plan: planId,
        },
      });
      
      if (error || !data?.success) {
        toast({
          title: "Paiement non démarré",
          description: data?.error || error?.message || "Réessayez dans un instant.",
          variant: "destructive",
        });
        return;
      }
      
      const url = data.checkout_url || data.payment_url || data.url;
      if (url) window.location.href = url;
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <h1 className="font-space font-bold text-3xl sm:text-4xl tracking-tight text-slate-900">
            Choisissez la formule adaptée à votre business 🚀
          </h1>
          <p className="text-slate-500 text-sm sm:text-base">
            Profitez du plan gratuit pour démarrer, ou débloquez l'abonnement Pro (12k FCFA) ou Premium Académie (35k FCFA) pour accélérer vos ventes.
          </p>
        </div>

        {/* 3 Plans Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          
          {/* Plan 1: Free */}
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Formule Débutant</span>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">Démarrage</h3>
                <p className="text-xs text-slate-500 mt-1">Gratuit pour toujours avec commission.</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-900">0 FCFA</span>
              </div>

              <Button
                variant="outline"
                className="w-full rounded-2xl font-bold border-slate-300 text-slate-700 h-12"
                onClick={() => navigate("/dashboard")}
              >
                Plan Actuel
              </Button>

              <ul className="space-y-3.5 text-xs text-slate-600">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#0E7C66] shrink-0 mt-0.5" />
                  <span>Boutique e-commerce mobile complète</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#0E7C66] shrink-0 mt-0.5" />
                  <span>Paiements Mobile Money & Cash à la livraison</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#0E7C66] shrink-0 mt-0.5" />
                  <span>Commission de 50 FCFA par commande</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#0E7C66] shrink-0 mt-0.5" />
                  <span>2 vidéos & 5 images IA d'essai</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Plan 2: Pro (12 000 FCFA / mois) */}
          <div className="bg-slate-900 text-white rounded-3xl p-8 border border-emerald-500/40 shadow-xl relative flex flex-col justify-between">
            <div className="absolute top-0 right-6 transform -translate-y-1/2 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              ⚡ POPULAIRE
            </div>

            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Sans Commission</span>
                <h3 className="text-2xl font-bold text-white mt-1">Ecomfy Pro</h3>
                <p className="text-xs text-slate-300 mt-1">Zéro commission & domaine propre.</p>
              </div>

              <div className="flex flex-col">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-white">12 000 FCFA</span>
                  <span className="text-xs text-slate-400">/ mois</span>
                </div>
                <span className="text-[11px] text-emerald-400 font-medium mt-1">Ou 9 900 FCFA / mois en annuel</span>
              </div>

              <Button
                className="w-full rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 shadow-lg"
                onClick={() => handleSubscribe("pro_monthly", 12000)}
                disabled={loading === "pro_monthly"}
              >
                {loading === "pro_monthly" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Activer le Plan Pro (12 000 FCFA)
              </Button>

              <ul className="space-y-3.5 text-xs text-slate-200">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Zéro commission sur vos ventes (0 FCFA)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Boutique illimitée + Domaine personnalisé</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>10 vidéos animées IA / mois</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>20 images HD studio IA / mois</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Support prioritaire WhatsApp 24/7</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Plan 3: Premium Académie & VIP (35 000 FCFA initial, 5 000 FCFA/3 mois) */}
          <div className="bg-gradient-to-b from-[#0F1B2C] via-[#0b1422] to-[#080d16] text-white rounded-3xl p-8 border-2 border-amber-400/60 shadow-2xl relative flex flex-col justify-between">
            <div className="absolute top-0 right-6 transform -translate-y-1/2 bg-amber-400 text-slate-950 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
              <Crown className="w-3.5 h-3.5" />
              OFFRE MEMBRE VIP
            </div>

            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">Académie & Quotas MAX</span>
                <h3 className="text-2xl font-bold text-white mt-1">Premium Académie & VIP</h3>
                <p className="text-xs text-slate-300 mt-1">Masterclasses vidéo, 20 vidéos + 40 images IA/mois.</p>
              </div>

              <div className="flex flex-col">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-amber-300">35 000 FCFA</span>
                </div>
                <p className="text-[11px] text-emerald-400 font-semibold mt-1">
                  1er trimestre d'accès • Puis seulement <strong className="text-white">5 000 FCFA / 3 mois</strong> !
                </p>
              </div>

              <Button
                className="w-full rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-extrabold h-12 shadow-xl hover:opacity-95"
                onClick={() => handleSubscribe("premium_academy_pro", 35000)}
                disabled={loading === "premium_academy_pro"}
              >
                {loading === "premium_academy_pro" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Activer le Pass Premium (35 000 FCFA)
              </Button>

              <ul className="space-y-3.5 text-xs text-slate-100">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                  <span>🎓 Accès illimité aux Masterclasses Académie Ecomfy</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                  <span>🎬 Jusqu'à 20 vidéos animées IA / mois</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                  <span>🖼️ Jusqu'à 40 images HD studio IA / mois</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                  <span>👥 Accès VIP à la Communauté des Marchands</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                  <span>🛒 Zéro commission sur vos ventes (0 FCFA)</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                  <span>🔄 Renouvellement à seulement 5 000 FCFA tous les 3 mois</span>
                </li>
              </ul>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
