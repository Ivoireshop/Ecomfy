import { Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useNavigate } from "react-router-dom";
import { useSoundIdentity } from "@/hooks/useSoundIdentity";

export function LandingPricing() {
  const navigate = useNavigate();
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });
  const { playHoverSound, playClickSound } = useSoundIdentity();

  return (
    <section className="py-24 md:py-32 bg-[#FAFAF7]" id="pricing">
      <div className="container mx-auto px-4 md:px-6">
        <div 
          ref={ref}
          className={`text-center max-w-3xl mx-auto mb-16 transition-all duration-1000 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
        >
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#0F1B2C] mb-6 tracking-tight">
            Des tarifs simples, <br className="hidden md:block" />
            <span className="text-[#0E7C66]">sans surprises.</span>
          </h2>
          <p className="text-lg text-slate-600">
            Commencez gratuitement. Évoluez quand vous êtes prêt.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Free Tier */}
          <div 
            className="rounded-[2rem] border border-slate-200 bg-white p-8 md:p-10 shadow-sm relative transition-all duration-500 hover:-translate-y-3 hover:shadow-2xl hover:scale-[1.02]"
            onMouseEnter={playHoverSound}
          >
            <h3 className="text-2xl font-bold text-[#0F1B2C] mb-2">Démarrage Gratuit</h3>
            <p className="text-slate-500 mb-6">Commencez sans frais fixes, payez uniquement à la vente.</p>
            <div className="flex items-baseline gap-2 mb-8">
              <span className="text-5xl font-extrabold text-[#0F1B2C]">0 FCFA</span>
              <span className="text-slate-500 font-medium">/ mois</span>
            </div>
            
            <Button 
              variant="outline" 
              size="lg" 
              className="w-full rounded-full border-slate-300 text-slate-700 font-bold mb-8 hover:bg-slate-50 transition-all"
              onMouseEnter={playHoverSound}
              onClick={() => { playClickSound(); navigate("/auth"); }}
            >
              Créer ma boutique gratuite
            </Button>

            <ul className="space-y-4">
              {[
                { text: "Boutique e-commerce standard", included: true },
                { text: "Commission de 50 FCFA / commande", included: true },
                { text: "Domaine personnalisé", included: false },
                { text: "Création de visuels et vidéos IA", included: false },
                { text: "Outils IA Pro", included: false },
              ].map((feature, idx) => (
                <li key={idx} className="flex items-center gap-3">
                  <div className={`p-1 rounded-full shrink-0 ${feature.included ? 'bg-[#E3F1EC] text-[#0E7C66]' : 'bg-red-50 text-red-500'}`}>
                    {feature.included ? <Check className="w-3.5 h-3.5" /> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
                  </div>
                  <span className={`font-medium ${feature.included ? 'text-slate-700' : 'text-slate-400 line-through'}`}>{feature.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pro Tier */}
          <div 
            className="rounded-[2rem] border-2 border-[#0E7C66] bg-[#0F1B2C] p-8 md:p-10 shadow-2xl relative transition-all duration-500 hover:-translate-y-3 hover:shadow-[0_20px_50px_rgba(14,124,102,0.3)] hover:scale-[1.02]"
            onMouseEnter={playHoverSound}
          >
            <div className="absolute top-0 right-8 transform -translate-y-1/2 bg-[#F7C04A] text-[#0F1B2C] text-xs font-bold px-3 py-1 rounded-full shadow-lg animate-pulse">
              Le plus populaire
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Pro Ecomfy</h3>
            <p className="text-slate-400 mb-6">Pour les e-commerçants qui veulent scaler.</p>
            <div className="flex items-baseline gap-2 mb-8">
              <span className="text-5xl font-extrabold text-white">12 000 FCFA</span>
              <span className="text-slate-400 font-medium">/ mois</span>
            </div>
            
            <Button 
              size="lg" 
              className="w-full rounded-full bg-[#0E7C66] hover:bg-[#0A5F4F] text-white font-bold mb-8 shadow-lg shadow-[#0E7C66]/20 transition-all hover:scale-105"
              onMouseEnter={playHoverSound}
              onClick={() => { playClickSound(); navigate("/auth"); }}
            >
              Passer en Pro
            </Button>

            <ul className="space-y-4">
              {[
                "Boutique illimitée + Domaine personnalisé",
                "Aucune commission par commande (0 FCFA)",
                "Commandes illimitées",
                "Visuels IA en illimité",
                "10 vidéos animées IA / mois",
                "Accès complet aux formations",
                "Intégration Mobile Money native",
                "Support prioritaire WhatsApp 24/7",
              ].map((feature, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="bg-[#0E7C66]/20 p-1 rounded-full text-[#E3F1EC] shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-slate-300 font-medium">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
