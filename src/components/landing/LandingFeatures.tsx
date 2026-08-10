import { useState, useEffect } from "react";
import { Store, Palette, Globe, CheckCircle2, TrendingUp, Sparkles, Box, ShieldCheck, Wallet, Bot } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const features = [
  {
    id: "create",
    tag: "1. CRÉER",
    tagColor: "bg-green-50 text-green-700",
    title: "Une vitrine professionnelle en 3 minutes.",
    description: "Ne payez plus de développeur. Obtenez une boutique au design premium, prête à encaisser, parfaitement adaptée au mobile.",
    icon: <Palette className="w-5 h-5 text-[#0E7C66]" />,
    visual: (
      <div className="relative w-full h-full bg-slate-50 rounded-2xl flex items-center justify-center p-8 overflow-hidden">
        {/* Background blob */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-green-100 rounded-full filter blur-3xl opacity-50"></div>
        {/* Mockup */}
        <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-10 animate-float">
          <div className="bg-slate-50 border-b border-slate-100 p-3 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-amber-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            <div className="mx-auto bg-white border border-slate-200 rounded-md px-3 py-1 text-xs text-slate-400 w-1/2 text-center truncate">
              maboutique.ecomfy.cloud
            </div>
          </div>
          <div className="p-4 bg-slate-50">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4">
              <div className="flex justify-between items-center mb-6">
                <div className="w-16 h-6 bg-slate-200 rounded animate-pulse"></div>
                <div className="flex gap-2">
                  <div className="w-4 h-4 bg-slate-200 rounded-full animate-pulse"></div>
                  <div className="w-4 h-4 bg-slate-200 rounded-full animate-pulse"></div>
                </div>
              </div>
              <div className="w-full h-32 bg-green-50 rounded-lg mb-4 flex items-center justify-center">
                <span className="text-green-600 font-medium">Bannière Promo</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="h-24 bg-slate-100 rounded-lg overflow-hidden">
                  <img src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=200&h=200" alt="Sneakers" className="w-full h-full object-cover" />
                </div>
                <div className="h-24 bg-slate-100 rounded-lg overflow-hidden">
                  <img src="https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=200&h=200" alt="Montre" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Floating elements */}
        <div className="absolute -left-4 bottom-1/4 bg-white p-3 rounded-xl shadow-xl border border-slate-100 z-20 animate-float-slow">
          <p className="text-xs font-semibold text-slate-500 mb-2">Thème principal</p>
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-[#0E7C66] border-2 border-white ring-2 ring-slate-200"></div>
            <div className="w-6 h-6 rounded-full bg-blue-600"></div>
            <div className="w-6 h-6 rounded-full bg-orange-500"></div>
          </div>
        </div>
      </div>
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
      <div className="relative w-full h-full bg-slate-50 rounded-2xl flex items-center justify-center p-8 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-100 rounded-full filter blur-3xl opacity-50"></div>
        <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-10 animate-float" style={{ animationDelay: '0.2s' }}>
          <div className="bg-[#0F1B2C] p-6 text-white text-center">
            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Paiement Validé</h3>
            <p className="text-slate-400 text-sm">Commande #1042</p>
          </div>
          <div className="p-6 bg-white space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Montant payé</span>
              <span className="font-bold">25 000 FCFA</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Méthode</span>
              <span className="font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500"></span> Mobile Money
              </span>
            </div>
            <div className="pt-4 border-t border-slate-100 flex gap-2">
              <div className="flex-1 h-10 bg-slate-100 rounded-lg"></div>
              <div className="flex-1 h-10 bg-[#0E7C66] rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
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
      <div className="relative w-full h-full bg-slate-50 rounded-2xl flex items-center justify-center p-8 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-purple-100 rounded-full filter blur-3xl opacity-50"></div>
        <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-10 animate-float" style={{ animationDelay: '0.4s' }}>
          <div className="p-4 border-b border-slate-100 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-slate-800">Générateur IA</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-purple-600" />
              </div>
              <div className="bg-slate-100 rounded-2xl rounded-tl-none p-3 text-sm text-slate-600">
                Génère un visuel publicitaire pour ce sac en cuir...
              </div>
            </div>
            <div className="flex gap-2 flex-row-reverse">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              </div>
              <div className="bg-purple-600 text-white rounded-2xl rounded-tr-none p-2 text-sm shadow-md">
                <img src="https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&q=80&w=300&h=200" className="w-full rounded-xl object-cover mb-2" alt="AI Generated" />
                <p className="px-1">Voici le résultat professionnel !</p>
              </div>
            </div>
          </div>
        </div>
      </div>
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
      <div className="relative w-full h-full bg-slate-50 rounded-2xl flex items-center justify-center p-8 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-orange-100 rounded-full filter blur-3xl opacity-50"></div>
        <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-10 animate-float" style={{ animationDelay: '0.1s' }}>
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-800">Tableau de bord</h3>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                <p className="text-xs text-slate-500 mb-1">Visiteurs</p>
                <p className="text-xl font-bold">1,204</p>
                <p className="text-xs text-green-500 flex items-center gap-1 mt-1"><TrendingUp className="w-3 h-3"/> +12%</p>
              </div>
              <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                <p className="text-xs text-slate-500 mb-1">Ventes</p>
                <p className="text-xl font-bold">45</p>
                <p className="text-xs text-green-500 flex items-center gap-1 mt-1"><TrendingUp className="w-3 h-3"/> +5%</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">Dernières commandes</p>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                      <Store className="w-4 h-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">Commande #{2040 + i}</p>
                      <p className="text-[10px] text-slate-500">Il y a {i*15} min</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full">Payée</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
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
      <div className="relative w-full h-full bg-slate-50 rounded-2xl flex items-center justify-center p-8 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-slate-200 rounded-full filter blur-3xl opacity-50"></div>
        <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-10 animate-float" style={{ animationDelay: '0.5s' }}>
          <div className="p-6 bg-[#0F1B2C] text-white">
            <p className="text-slate-400 text-sm mb-1">Solde disponible</p>
            <h3 className="text-3xl font-extrabold flex items-baseline gap-2">
              145 000 <span className="text-lg font-medium text-slate-400">FCFA</span>
            </h3>
          </div>
          <div className="p-4 border-b border-slate-100">
            <button className="w-full bg-[#0E7C66] text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition-colors">
              <Wallet className="w-4 h-4" /> Demander un retrait
            </button>
          </div>
          <div className="p-4">
            <p className="text-sm font-semibold text-slate-700 mb-3">Historique récent</p>
            <div className="space-y-3">
              {[
                { type: "Vente", amount: "+ 25 000 FCFA", color: "text-green-600" },
                { type: "Vente", amount: "+ 12 000 FCFA", color: "text-green-600" },
                { type: "Retrait", amount: "- 50 000 FCFA", color: "text-slate-600" }
              ].map((tx, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">{tx.type}</span>
                  <span className={`font-semibold ${tx.color}`}>{tx.amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
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
                <div className="block lg:hidden mt-8 h-[400px] w-full rounded-2xl overflow-hidden shadow-lg border border-slate-100">
                  {feature.visual}
                </div>
              </div>
            ))}
          </div>

          {/* Right: Sticky Visuals (Desktop only) */}
          <div className="hidden lg:block w-1/2 h-[600px] sticky top-32 rounded-3xl overflow-hidden shadow-2xl border border-slate-100 bg-white">
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
