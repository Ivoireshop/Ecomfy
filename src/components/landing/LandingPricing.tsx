import { useState } from "react";
import { Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useNavigate } from "react-router-dom";
import { useSoundIdentity } from "@/hooks/useSoundIdentity";

export function LandingPricing() {
  const navigate = useNavigate();
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });
  const { playHoverSound, playClickSound } = useSoundIdentity();
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <section className="py-24 md:py-32 relative overflow-hidden" id="pricing">
      {/* Premium Background */}
      <div className="absolute inset-0 bg-[#FAFAF7] z-0"></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-[#0E7C66]/5 to-transparent rounded-full blur-3xl z-0"></div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div 
          ref={ref}
          className={`text-center max-w-3xl mx-auto mb-16 transition-all duration-1000 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0E7C66]/10 text-[#0E7C66] text-sm font-semibold mb-6">
            <span>TARIFS</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#0F1B2C] mb-6 tracking-tight">
            Des tarifs conçus pour <br className="hidden md:block" />
            <span className="text-[#0E7C66]">votre croissance.</span>
          </h2>
          <p className="text-lg text-slate-600 mb-10">
            Commencez gratuitement, passez à la vitesse supérieure quand vous êtes prêt.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-3">
            <span className={`text-sm font-medium ${!isAnnual ? 'text-[#0F1B2C]' : 'text-slate-400'}`}>Mensuel</span>
            <button 
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative w-16 h-8 rounded-full bg-slate-200 p-1 transition-colors duration-300 focus:outline-none"
              style={{ backgroundColor: isAnnual ? '#0E7C66' : '#e2e8f0' }}
            >
              <div 
                className="w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300"
                style={{ transform: isAnnual ? 'translateX(32px)' : 'translateX(0)' }}
              ></div>
            </button>
            <span className={`text-sm font-medium flex items-center gap-2 ${isAnnual ? 'text-[#0F1B2C]' : 'text-slate-400'}`}>
              Annuel <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Économisez 20%</span>
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto items-center">
          {/* Free Tier */}
          <div 
            className="rounded-[2.5rem] border border-slate-200/60 bg-white/60 backdrop-blur-xl p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)]"
            onMouseEnter={playHoverSound}
          >
            <h3 className="text-2xl font-bold text-[#0F1B2C] mb-2">Démarrage</h3>
            <p className="text-slate-500 mb-8 h-12">Pour lancer votre première boutique sans risque financier.</p>
            
            <div className="flex items-baseline gap-2 mb-8">
              <span className="text-6xl font-extrabold text-[#0F1B2C]">0</span>
              <div className="flex flex-col">
                <span className="text-slate-900 font-bold">FCFA</span>
                <span className="text-slate-500 text-sm">pour toujours</span>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              size="lg" 
              className="w-full rounded-full border-slate-300 text-slate-700 font-bold mb-10 hover:bg-slate-50 hover:text-[#0F1B2C] transition-all h-14 text-lg"
              onMouseEnter={playHoverSound}
              onClick={() => { playClickSound(); navigate("/auth"); }}
            >
              Créer ma boutique gratuite
            </Button>

            <ul className="space-y-5">
              {[
                { text: "Boutique e-commerce complète", included: true },
                { text: "Paiement Mobile Money & COD", included: true },
                { text: "Commission de 50 FCFA / commande", included: true },
                { text: "Domaine personnalisé (.com, .net)", included: false },
                { text: "Génération illimitée par IA", included: false },
                { text: "Zéro commission", included: false },
              ].map((feature, idx) => (
                <li key={idx} className="flex items-center gap-4">
                  <div className={`p-1.5 rounded-full shrink-0 ${feature.included ? 'bg-[#0E7C66]/10 text-[#0E7C66]' : 'bg-slate-100 text-slate-300'}`}>
                    {feature.included ? <Check className="w-4 h-4" /> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
                  </div>
                  <span className={`font-medium ${feature.included ? 'text-slate-700' : 'text-slate-400 line-through'}`}>{feature.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pro / Premium Académie Tier */}
          <div 
            className="rounded-[2.5rem] border border-[#0E7C66]/40 bg-[#0F1B2C] p-8 md:p-12 shadow-[0_20px_50px_rgba(14,124,102,0.2)] relative transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_30px_60px_rgba(14,124,102,0.3)] md:scale-105 z-10"
            onMouseEnter={playHoverSound}
          >
            <div className="absolute top-0 right-10 transform -translate-y-1/2 bg-gradient-to-r from-[#F7C04A] to-[#F59E0B] text-[#0F1B2C] text-xs font-extrabold px-4 py-1.5 rounded-full shadow-lg shadow-amber-500/30 tracking-wide uppercase">
              👑 OFFRE MEMBRE PRO & ACADÉMIE
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Premium Académie & Pro</h3>
            <p className="text-slate-400 mb-6 h-12">L'écosystème ultime : Formations vidéo, quotas IA renforcés et zéro commission.</p>
            
            <div className="flex flex-col mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold text-white">35 000</span>
                <span className="text-slate-200 font-bold">FCFA</span>
              </div>
              <p className="text-xs text-emerald-400 font-semibold mt-1">
                Abonnement initial • Puis seulement <strong className="text-white">5 000 FCFA / 3 mois</strong> lors du renouvellement !
              </p>
            </div>
            
            <Button 
              size="lg" 
              className="w-full rounded-full bg-[#0E7C66] hover:bg-[#0A5F4F] text-white font-bold mb-8 shadow-lg shadow-[#0E7C66]/30 transition-all hover:scale-[1.02] h-14 text-lg"
              onMouseEnter={playHoverSound}
              onClick={() => { playClickSound(); navigate("/auth"); }}
            >
              Rejoindre le Pass Premium
            </Button>

            <ul className="space-y-4">
              {[
                "🎓 Accès illimité aux Masterclasses Académie Ecomfy",
                "🎬 Jusqu'à 20 vidéos publicitaires animées IA par mois",
                "🖼️ Jusqu'à 40 images HD studio IA par mois",
                "👥 Espace Membre VIP & Communauté Marchande",
                "🛒 Zéro commission sur vos ventes (0 FCFA)",
                "🌐 Boutique illimitée + Domaine personnalisé (.com, .net)",
                "🔄 Renouvellement à seulement 5 000 FCFA tous les 3 mois",
                "💬 Support prioritaire WhatsApp 24/7",
              ].map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="bg-[#0E7C66]/30 p-1 rounded-full text-[#0E7C66] shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-[#4ade80]" />
                  </div>
                  <span className="text-slate-200 text-sm font-medium">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
