import { Store, Palette, Globe, CheckCircle2 } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export function LandingPillarCreate() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });

  const features = [
    {
      icon: <Palette className="w-5 h-5 text-[#0E7C66]" />,
      title: "Personnalisation ultra-simple",
      description: "Couleurs, logo et style à votre image sans écrire une ligne de code."
    },
    {
      icon: <Globe className="w-5 h-5 text-[#0E7C66]" />,
      title: "Domaine personnalisé",
      description: "Connectez votre propre nom de domaine pour une image pro."
    },
    {
      icon: <Store className="w-5 h-5 text-[#0E7C66]" />,
      title: "Boutique ultra-rapide",
      description: "Des temps de chargement optimisés pour ne perdre aucune vente."
    }
  ];

  return (
    <section id="features" className="py-24 bg-white overflow-hidden">
      <div className="container mx-auto px-4">
        <div 
          ref={ref}
          className={`flex flex-col lg:flex-row items-center gap-16 transition-all duration-1000 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
        >
          {/* Texte et Features */}
          <div className="flex-1 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-sm font-semibold">
              <span>1. CRÉER</span>
            </div>
            
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight">
              Une vitrine <br />
              <span className="text-[#0E7C66]">professionnelle</span> <br />
              en 3 minutes.
            </h2>
            
            <p className="text-lg text-slate-600">
              Ne payez plus de développeur. Obtenez une boutique au design premium, prête à encaisser, parfaitement adaptée au mobile.
            </p>

            <div className="space-y-6 pt-4">
              {features.map((feature, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="mt-1 w-10 h-10 rounded-full bg-green-50 flex items-center justify-center shrink-0">
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

          {/* Visual Composite */}
          <div className="flex-1 relative w-full h-[500px]">
            {/* Background Blob */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-green-100 rounded-full filter blur-3xl opacity-50"></div>
            
            {/* Main Window (Mockup Shop) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-10 animate-float">
              {/* Browser Header */}
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
              
              {/* Shop Content */}
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

            {/* Floating Widget 1: Color Picker */}
            <div className="absolute -left-4 bottom-1/4 bg-white p-3 rounded-xl shadow-xl border border-slate-100 z-20 animate-float-slow">
              <p className="text-xs font-semibold text-slate-500 mb-2">Thème principal</p>
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-[#0E7C66] border-2 border-white ring-2 ring-slate-200 cursor-pointer"></div>
                <div className="w-6 h-6 rounded-full bg-blue-600 cursor-pointer"></div>
                <div className="w-6 h-6 rounded-full bg-orange-500 cursor-pointer"></div>
              </div>
            </div>

            {/* Floating Widget 2: Success Toast */}
            <div className="absolute -right-8 top-1/4 bg-white p-3 rounded-xl shadow-xl border border-slate-100 z-20 flex items-center gap-2 animate-float">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm font-bold text-slate-900">Boutique publiée !</p>
                <p className="text-xs text-slate-500">Prête à recevoir des commandes</p>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </section>
  );
}
