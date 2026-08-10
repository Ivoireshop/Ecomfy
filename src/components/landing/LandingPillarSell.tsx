import { ShoppingCart, Clock, Star, Smartphone } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export function LandingPillarSell() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });

  const features = [
    {
      icon: <Clock className="w-5 h-5 text-orange-500" />,
      title: "Urgence marketing",
      description: "Comptes à rebours et jauges de stock pour booster les achats impulsifs."
    },
    {
      icon: <Star className="w-5 h-5 text-amber-400" />,
      title: "Preuve sociale",
      description: "Avis clients intégrés nativement pour rassurer vos prospects."
    },
    {
      icon: <Smartphone className="w-5 h-5 text-blue-500" />,
      title: "Paiement Mobile Money",
      description: "Intégration CinetPay pour accepter Wave, Orange Money et MTN."
    }
  ];

  return (
    <section className="py-24 bg-slate-50 overflow-hidden border-t border-slate-100">
      <div className="container mx-auto px-4">
        <div 
          ref={ref}
          className={`flex flex-col-reverse lg:flex-row items-center gap-16 transition-all duration-1000 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
        >
          {/* Visual Composite (Left side this time) */}
          <div className="flex-1 relative w-full h-[600px]">
            {/* Background Blob */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-orange-100 rounded-full filter blur-3xl opacity-50"></div>
            
            {/* Main Window (Product Page Mockup) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10">
              {/* Product Image Area */}
              <div className="h-48 bg-slate-100 relative overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&q=80&w=400&h=300" 
                  alt="Montre Connectée Pro X" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">PROMO -30%</div>
              </div>
              
              {/* Product Info */}
              <div className="p-5">
                <div className="flex gap-1 text-amber-400 mb-2">
                  {[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 fill-current" />)}
                  <span className="text-slate-400 text-xs ml-1">(128 avis)</span>
                </div>
                <h3 className="font-bold text-slate-900 mb-1">Montre Connectée Pro X</h3>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl font-black text-[#0E7C66]">25 000 FCFA</span>
                  <span className="text-sm text-slate-400 line-through">35 000 FCFA</span>
                </div>
                
                {/* Urgency */}
                <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 mb-4">
                  <p className="text-xs text-orange-800 font-semibold mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> L'offre expire dans :
                  </p>
                  <div className="flex gap-2">
                    <div className="bg-white rounded px-2 py-1 text-orange-600 font-bold text-xs shadow-sm">02h</div>
                    <div className="bg-white rounded px-2 py-1 text-orange-600 font-bold text-xs shadow-sm">45m</div>
                    <div className="bg-white rounded px-2 py-1 text-orange-600 font-bold text-xs shadow-sm">12s</div>
                  </div>
                </div>
                
                <button className="w-full bg-[#0E7C66] text-white font-bold py-3 rounded-xl mb-3 hover:bg-[#0A5F4F] transition-colors">
                  Acheter maintenant
                </button>
                <button className="w-full bg-[#25D366] text-white font-bold py-3 rounded-xl hover:bg-[#1DA851] transition-colors flex justify-center items-center gap-2">
                  Commander sur WhatsApp
                </button>
              </div>
            </div>

            {/* Floating Widget 1: Payment success */}
            <div className="absolute -left-4 bottom-1/3 bg-white p-3 rounded-xl shadow-xl border border-slate-100 z-20 flex items-center gap-3 animate-float">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="font-bold text-blue-600 text-xs">WAVE</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Paiement reçu</p>
                <p className="text-xs text-green-600 font-semibold">+ 25 000 FCFA</p>
              </div>
            </div>

            {/* Floating Widget 2: Bundle */}
            <div className="absolute -right-8 top-1/4 bg-white p-3 rounded-xl shadow-xl border border-slate-100 z-20 animate-float-slow">
              <p className="text-xs font-bold text-slate-900 mb-1">Offre Bundle (x2)</p>
              <p className="text-[10px] text-slate-500 mb-2">Augmentez le panier moyen</p>
              <div className="bg-green-50 border border-green-200 text-green-700 text-xs px-2 py-1 rounded font-semibold text-center">
                Livraison Gratuite
              </div>
            </div>
            
          </div>

          {/* Texte et Features */}
          <div className="flex-1 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 text-sm font-semibold">
              <span>2. VENDRE</span>
            </div>
            
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight">
              Une fiche produit <br />
              <span className="text-orange-500">optimisée pour</span> <br />
              la conversion.
            </h2>
            
            <p className="text-lg text-slate-600">
              Transformez plus de visiteurs en acheteurs. Nos fiches produits intègrent les meilleurs outils marketing pour maximiser votre chiffre d'affaires.
            </p>

            <div className="space-y-6 pt-4">
              {features.map((feature, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="mt-1 w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-lg">{feature.title}</h3>
                    <p className="text-slate-600">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </div>
    </section>
  );
}
