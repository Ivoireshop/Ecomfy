import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, ShieldCheck, Loader2 } from "lucide-react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export default function PricingDashboard() {
  const { session } = useAuthReady();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const userId = session?.user?.id;
      if (!userId) {
        toast({ title: "Connectez-vous d'abord", variant: "destructive" });
        return;
      }
      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: {
          amount: 12000,
          user_id: userId,
          payment_type: "shop_subscription",
          plan: "starter",
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
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-12 px-4 md:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="font-space font-bold text-3xl tracking-tight text-slate-900 mb-3">
            Passez à la vitesse supérieure
          </h1>
          <p className="text-slate-500 text-sm">
            Débloquez toutes les fonctionnalités premium pour votre boutique e-commerce.
          </p>
        </div>

        <div className="rounded-[2rem] border-2 border-[#0E7C66] bg-[#0F1B2C] p-8 md:p-10 shadow-2xl relative max-w-xl mx-auto">
          <div className="absolute top-0 right-8 transform -translate-y-1/2 bg-[#F7C04A] text-[#0F1B2C] text-xs font-bold px-4 py-1 rounded-full shadow-lg tracking-wide uppercase">
            👑 Premium Académie & Pro
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Offre Membre VIP Ecomfy</h3>
          <p className="text-slate-400 mb-6">Formations Académie complètes, quotas IA renforcés et zéro commission.</p>
          
          <div className="flex flex-col mb-8">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-extrabold text-white">35 000 FCFA</span>
              <span className="text-slate-400 text-sm font-medium">(1er trimestre)</span>
            </div>
            <p className="text-xs text-emerald-400 font-semibold mt-1">
              Renouvelable à seulement <strong>5 000 FCFA tous les 3 mois</strong> !
            </p>
          </div>
          
          <Button 
            size="lg" 
            className="w-full rounded-full bg-[#0E7C66] hover:bg-[#0A5F4F] text-white font-bold mb-8 shadow-lg shadow-[#0E7C66]/20 transition-all hover:scale-105"
            onClick={handleSubscribe}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ShieldCheck className="h-5 w-5 mr-2" />}
            Activer l'Offre Premium (35 000 FCFA)
          </Button>

          <ul className="space-y-4">
            {[
              "🎓 Accès illimité à toutes les Masterclasses de l'Académie",
              "🎬 Jusqu'à 20 vidéos animées IA par mois",
              "🖼️ Jusqu'à 40 images HD studio IA par mois",
              "👥 Accès VIP à la Communauté des marchands Ecomfy",
              "🛒 Zéro commission par commande (0 FCFA)",
              "🌐 Boutique illimitée + Domaine personnalisé (.com, .net)",
              "🔄 Renouvellement à seulement 5 000 FCFA tous les 3 mois",
              "💬 Support prioritaire WhatsApp 24/7",
            ].map((feature, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <div className="bg-[#0E7C66]/20 p-1 rounded-full text-[#E3F1EC] shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5 text-[#4ade80]" />
                </div>
                <span className="text-slate-300 text-sm font-medium">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
