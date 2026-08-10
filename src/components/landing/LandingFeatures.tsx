import { useState, useEffect } from "react";
import { Store, Palette, Globe, CheckCircle2, TrendingUp, Sparkles, Box, ShieldCheck, Wallet, Bot } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

import createImg from "@/assets/showcase-site-preview.jpg";
import sellImg from "@/assets/ecommerce-shopping.jpg";
import aiImg from "@/assets/feature-ia.jpg";
import manageImg from "@/assets/ecommerce-dashboard.jpg";
import secureImg from "@/assets/feature-afrique.jpg";

const features = [
  {
    id: "create",
    tag: "1. CRÉER",
    tagColor: "bg-green-50 text-green-700",
    title: "Une vitrine professionnelle en 3 minutes.",
    description: "Ne payez plus de développeur. Obtenez une boutique au design premium, prête à encaisser, parfaitement adaptée au mobile.",
    icon: <Palette className="w-5 h-5 text-[#0E7C66]" />,
    visual: (
      <img src={createImg} alt="Créer une vitrine" className="w-full h-full object-cover" />
    )
  },
  {
    id: "sell",
    tag: "2. VENDRE",
    tagColor: "bg-blue-50 text-blue-700",
    title: "Vendez en ligne sans friction.",
    description: "Encaissez via Mobile Money ou Carte Bancaire partout en Afrique. Proposez des paiements à la livraison et laissez vos clients acheter directement sur WhatsApp.",
    icon: <Store className="w-5 h-5 text-blue-600" />,
    visual: (
      <img src={sellImg} alt="Vendre en ligne" className="w-full h-full object-cover" />
    )
  },
  {
    id: "ai",
    tag: "3. IA",
    tagColor: "bg-purple-50 text-purple-700",
    title: "Votre agence marketing intégrée.",
    description: "Générez des photos produits professionnelles, des vidéos publicitaires captivantes et des descriptions SEO grâce à notre IA.",
    icon: <Bot className="w-5 h-5 text-purple-600" />,
    visual: (
      <img src={aiImg} alt="Intelligence Artificielle" className="w-full h-full object-cover" />
    )
  },
  {
    id: "manage",
    tag: "4. GÉRER",
    tagColor: "bg-orange-50 text-orange-700",
    title: "Pilotez toute votre activité.",
    description: "Gérez vos commandes, suivez vos stocks, relancez les paniers abandonnés et gardez un œil sur vos statistiques en temps réel.",
    icon: <Box className="w-5 h-5 text-orange-600" />,
    visual: (
      <img src={manageImg} alt="Gérer l'activité" className="w-full h-full object-cover" />
    )
  },
  {
    id: "finance",
    tag: "5. SÉCURISER",
    tagColor: "bg-slate-100 text-slate-800",
    title: "Une gestion financière claire.",
    description: "Zéro frais cachés. Retirez vos fonds facilement, consultez votre historique de facturation et profitez d'une infrastructure sécurisée.",
    icon: <ShieldCheck className="w-5 h-5 text-slate-700" />,
    visual: (
      <img src={secureImg} alt="Gestion financière" className="w-full h-full object-cover" />
    )
  }
];

export function LandingFeatures() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      // Find the feature block that is most visible
      const windowHeight = window.innerHeight;
      const middleOfScreen = windowHeight / 2;
      
      let closestIdx = 0;
      let minDistance = Infinity;

      features.forEach((_, idx) => {
        const el = document.getElementById(`feature-block-${idx}`);
        if (el) {
          const rect = el.getBoundingClientRect();
          // Distance from the middle of the element to the middle of the screen
          const elementMiddle = rect.top + rect.height / 2;
          const distance = Math.abs(elementMiddle - middleOfScreen);
          if (distance < minDistance) {
            minDistance = distance;
            closestIdx = idx;
          }
        }
      });

      if (closestIdx !== activeFeature) {
        setActiveFeature(closestIdx);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Trigger once on mount
    handleScroll();
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, [activeFeature]);

  return (
    <section id="features" className="py-24 bg-white relative">
      <div className="container mx-auto px-4 md:px-6">
        <div ref={ref} className={`text-center max-w-3xl mx-auto mb-16 md:mb-24 transition-all duration-1000 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
          <h2 className="text-3xl md:text-5xl font-extrabold text-[#0F1B2C] mb-6 tracking-tight">
            Tout ce dont vous avez besoin, <br />
            <span className="text-[#0E7C66]">intégré à un seul endroit.</span>
          </h2>
          <p className="text-lg text-slate-600">
            Oubliez les plugins complexes. Ecomfy réunit création, marketing IA et gestion en une plateforme puissante.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 relative items-start">
          
          {/* Left: Scrollable Text Blocks */}
          <div className="w-full lg:w-1/2 lg:py-48 pb-24">
            {features.map((feature, idx) => (
              <div 
                key={feature.id} 
                id={`feature-block-${idx}`} 
                className={`transition-opacity duration-500 mb-24 lg:mb-96 last:mb-0 ${activeFeature === idx ? 'opacity-100' : 'opacity-30 hover:opacity-70'}`}
              >
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${feature.tagColor} text-sm font-semibold mb-6`}>
                  <span>{feature.tag}</span>
                </div>
                
                <h3 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight mb-4">
                  {feature.title}
                </h3>
                
                <p className="text-lg text-slate-600 leading-relaxed mb-6">
                  {feature.description}
                </p>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                    {feature.icon}
                  </div>
                </div>

                {/* Mobile visual fallback (only visible on small screens when this feature is active) */}
                <div className="block lg:hidden mt-8 h-[400px] w-full rounded-2xl overflow-hidden shadow-lg border border-slate-100 bg-slate-100">
                  {feature.visual}
                </div>
              </div>
            ))}
          </div>

          {/* Right: Sticky Visuals (Desktop only) */}
          <div className="hidden lg:block w-1/2 h-[600px] sticky top-32 rounded-3xl overflow-hidden shadow-2xl border border-slate-100 bg-slate-100">
            {features.map((feature, idx) => (
              <div 
                key={`visual-${feature.id}`}
                className={`absolute inset-0 transition-all duration-700 ease-in-out ${activeFeature === idx ? 'opacity-100 translate-y-0 scale-100 z-10' : 'opacity-0 translate-y-8 scale-95 z-0 pointer-events-none'}`}
              >
                {feature.visual}
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
