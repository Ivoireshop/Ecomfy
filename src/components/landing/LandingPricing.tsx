import { useState } from "react";
import { Check, Sparkles, Zap, GraduationCap, Crown } from "lucide-react";
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
            <span>TARIFS & ABONNEMENTS</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#0F1B2C] mb-6 tracking-tight">
            Des formules adaptées à <br className="hidden md:block" />
            <span className="text-[#0E7C66]">chaque étape de votre succès.</span>
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Commencez gratuitement, passez au plan Pro ou débloquez l'Académie complète selon vos ambitions.
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
              Annuel <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Économisez 20% sur le plan Pro</span>
            </span>
          </div>
        </div>

        {/* 3 Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto items-stretch">
          
          {/* 1. Plan Free / Démarrage */}
          <div 
            className="rounded-[2.5rem] border border-slate-200/80 bg-white/80 backdrop-blur-xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative flex flex-col justify-between transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)]"
            onMouseEnter={playHoverSound}
          >
            <div>
              <h3 className="text-2xl font-bold text-[#0F1B2C] mb-2">Démarrage</h3>
              <p className="text-slate-500 mb-6 text-sm">Pour lancer votre première boutique sans risque financier.</p>
              
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-5xl font-extrabold text-[#0F1B2C]">0</span>
                <div className="flex flex-col">
                  <span className="text-slate-900 font-bold">FCFA</span>
                  <span className="text-slate-500 text-xs">pour toujours</span>
                </div>
              </div>
              
              <Button 
                variant="outline" 
                size="lg" 
                className="w-full rounded-full border-slate-300 text-slate-700 font-bold mb-8 hover:bg-slate-50 hover:text-[#0F1B2C] transition-all h-12 text-base"
                onMouseEnter={playHoverSound}
                onClick={() => { playClickSound(); navigate("/auth"); }}
              >
                Créer ma boutique gratuite
              </Button>

              <ul className="space-y-4 text-sm">
                {[
                  "Boutique e-commerce mobile complète",
                  "Paiement Mobile Money & Cash à la livraison",
                  "Commission de 50 FCFA / commande",
                  "Accès d'initiation à l'Académie Ecomfy",
                  "2 vidéos IA & 5 images IA offertes",
                ].map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <div className="bg-[#0E7C66]/10 p-1 rounded-full text-[#0E7C66] shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-slate-700 font-medium">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 2. Plan Pro (12 000 FCFA / mois) */}
          <div 
            className="rounded-[2.5rem] border border-emerald-500/30 bg-slate-900 p-8 shadow-xl relative flex flex-col justify-between transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl text-white"
            onMouseEnter={playHoverSound}
          >
            <div>
              <div className="absolute top-0 right-8 transform -translate-y-1/2 bg-emerald-500 text-white text-[11px] font-extrabold px-3.5 py-1 rounded-full shadow-md uppercase tracking-wider">
                ⚡ POPULAIRE
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-2">Ecomfy Pro</h3>
              <p className="text-slate-300 mb-6 text-sm">Pour les marchands qui vendent chaque jour avec zéro commission.</p>
              
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-5xl font-extrabold text-white">{isAnnual ? "9 900" : "12 000"}</span>
                <div className="flex flex-col">
                  <span className="text-slate-200 font-bold">FCFA</span>
                  <span className="text-slate-400 text-xs">/ mois {isAnnual && "(facturé annuellement)"}</span>
                </div>
              </div>
              
              <Button 
                size="lg" 
                className="w-full rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold mb-8 shadow-lg transition-all h-12 text-base"
                onMouseEnter={playHoverSound}
                onClick={() => { playClickSound(); navigate("/auth"); }}
              >
                Passer au Plan Pro
              </Button>

              <ul className="space-y-4 text-sm">
                {[
                  "Zéro commission sur vos ventes (0 FCFA)",
                  "Boutique illimitée + Nom de domaine personnalisé",
                  "10 vidéos animées IA par mois",
                  "20 images HD studio IA par mois",
                  "Tableau de bord financier & analytique avancé",
                  "Support prioritaire WhatsApp 24/7",
                ].map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <div className="bg-emerald-500/20 p-1 rounded-full text-emerald-400 shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-slate-200 font-medium">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 3. Plan Premium Académie & VIP (35 000 FCFA initial, 5 000 FCFA / 3 mois) */}
          <div 
            className="rounded-[2.5rem] border-2 border-amber-400/60 bg-gradient-to-b from-[#0F1B2C] via-[#0b1422] to-[#080d16] p-8 shadow-[0_20px_50px_rgba(247,192,74,0.15)] relative flex flex-col justify-between transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_30px_60px_rgba(247,192,74,0.25)] text-white"
            onMouseEnter={playHoverSound}
          >
            <div>
              <div className="absolute top-0 right-8 transform -translate-y-1/2 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 text-[11px] font-extrabold px-4 py-1.5 rounded-full shadow-lg tracking-wide uppercase flex items-center gap-1">
                <Crown className="w-3.5 h-3.5" />
                MEMBRE VIP & ACADÉMIE
              </div>

              <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                Premium Académie & VIP
              </h3>
              <p className="text-slate-300 mb-6 text-sm">L'écosystème ultime : Formations vidéo Masterclasses, 20 vidéos + 40 images IA/mois & Communauté.</p>
              
              <div className="flex flex-col mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-extrabold text-amber-300">35 000</span>
                  <span className="text-slate-200 font-bold">FCFA</span>
                </div>
                <p className="text-xs text-emerald-400 font-semibold mt-1">
                  1er trimestre d'accès • Puis seulement <strong className="text-white">5 000 FCFA / 3 mois</strong> lors du renouvellement !
                </p>
              </div>
              
              <Button 
                size="lg" 
                className="w-full rounded-full bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 hover:opacity-95 text-slate-950 font-extrabold mb-8 shadow-xl transition-all h-12 text-base"
                onMouseEnter={playHoverSound}
                onClick={() => { playClickSound(); navigate("/auth"); }}
              >
                Rejoindre le Pass Premium
              </Button>

              <ul className="space-y-4 text-sm">
                {[
                  "🎓 Formations & Masterclasses vidéo Académie Ecomfy",
                  "🎬 Jusqu'à 20 vidéos publicitaires animées IA par mois",
                  "🖼️ Jusqu'à 40 images HD studio IA par mois",
                  "👥 Accès VIP à la Communauté des Marchands Ecomfy",
                  "🛒 Zéro commission sur vos ventes (0 FCFA)",
                  "🌐 Boutique illimitée + Domaine personnalisé (.com, .net)",
                  "🔄 Renouvellement à seulement 5 000 FCFA tous les 3 mois",
                  "💬 Support prioritaire VIP WhatsApp 24/7",
                ].map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <div className="bg-amber-400/20 p-1 rounded-full text-amber-300 shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-slate-100 font-medium">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
