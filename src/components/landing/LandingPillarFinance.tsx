import { PieChart, TrendingUp, DollarSign, BarChart3 } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export function LandingPillarFinance() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });

  const features = [
    {
      icon: <TrendingUp className="w-5 h-5 text-emerald-500" />,
      title: "Tableaux de bord intuitifs",
      description: "Visualisez l'évolution de vos ventes, de vos visites et de votre panier moyen."
    },
    {
      icon: <DollarSign className="w-5 h-5 text-emerald-500" />,
      title: "Calcul des marges",
      description: "Suivez vos coûts d'achat et maîtrisez votre rentabilité nette."
    },
    {
      icon: <PieChart className="w-5 h-5 text-emerald-500" />,
      title: "Rapports détaillés",
      description: "Identifiez vos meilleurs produits et les canaux qui convertissent le mieux."
    }
  ];

  return (
    <section id="finance" className="py-24 bg-white overflow-hidden border-t border-slate-100">
      <div className="container mx-auto px-4">
        <div 
          ref={ref}
          className={`flex flex-col-reverse lg:flex-row items-center gap-16 transition-all duration-1000 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
        >
          {/* Visual Composite (Left side) */}
          <div className="flex-1 relative w-full h-[500px]">
            {/* Background Blob */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-100 rounded-full filter blur-3xl opacity-50"></div>
            
            {/* Main Window (Analytics Mockup) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-10 animate-float">
              
              {/* Header */}
              <div className="border-b border-slate-100 p-4 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-slate-900">Aperçu Financier</span>
                </div>
                <div className="bg-white px-2 py-1 border border-slate-200 rounded text-xs text-slate-500 font-medium">Ce mois</div>
              </div>
              
              {/* Metrics */}
              <div className="p-4 grid grid-cols-2 gap-4 bg-white">
                <div className="border border-slate-100 rounded-xl p-4 shadow-sm relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-16 h-16 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 opacity-50 pointer-events-none"></div>
                  <p className="text-xs text-slate-500 mb-1 font-semibold">Revenus (Net)</p>
                  <p className="text-xl font-black text-slate-900 mb-2">3 450 000 F</p>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 w-max px-2 py-0.5 rounded">
                    <TrendingUp className="w-3 h-3" /> +24.5%
                  </div>
                </div>
                <div className="border border-slate-100 rounded-xl p-4 shadow-sm relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-16 h-16 bg-blue-50 rounded-bl-full -mr-4 -mt-4 opacity-50 pointer-events-none"></div>
                  <p className="text-xs text-slate-500 mb-1 font-semibold">Panier Moyen</p>
                  <p className="text-xl font-black text-slate-900 mb-2">28 500 F</p>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 w-max px-2 py-0.5 rounded">
                    <TrendingUp className="w-3 h-3" /> +5.2%
                  </div>
                </div>
              </div>

              {/* Chart Mockup */}
              <div className="p-4 bg-slate-50">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 h-32 flex items-end gap-2 justify-between">
                  {[40, 65, 45, 80, 55, 90, 75].map((height, idx) => (
                    <div key={idx} className="w-full bg-emerald-100 rounded-t-sm relative group">
                      <div 
                        className="absolute bottom-0 w-full bg-emerald-500 rounded-t-sm transition-all duration-1000 group-hover:bg-emerald-600" 
                        style={{ height: `${height}%` }}
                      ></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating Widget 1: Profit Margin */}
            <div className="absolute -left-4 bottom-1/4 bg-slate-900 p-4 rounded-xl shadow-xl border border-slate-800 z-20 w-40 animate-float text-white">
              <p className="text-xs text-slate-400 font-semibold mb-1">Marge Nette</p>
              <p className="text-2xl font-black text-white">42%</p>
              <div className="mt-2 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-400 h-full w-[42%]"></div>
              </div>
            </div>

            {/* Floating Widget 2: Best Seller */}
            <div className="absolute -right-8 top-1/4 bg-white p-3 rounded-xl shadow-xl border border-slate-100 z-20 flex items-center gap-3 animate-float-slow">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex justify-center items-center">
                <span className="text-orange-600 font-bold">🏆</span>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold">Top Produit</p>
                <p className="text-sm font-bold text-slate-900">Kit Beauté Pro</p>
                <p className="text-xs text-emerald-600 font-semibold">124 ventes</p>
              </div>
            </div>
            
          </div>

          {/* Texte et Features */}
          <div className="flex-1 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-sm font-semibold">
              <span>5. ANALYSER</span>
            </div>
            
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight">
              La finance <br />
              <span className="text-emerald-600">claire et nette</span>.
            </h2>
            
            <p className="text-lg text-slate-600">
              Suivez vos revenus, vos marges et vos performances en un coup d'œil. Prenez des décisions basées sur des données fiables pour faire croître votre activité.
            </p>

            <div className="space-y-6 pt-4">
              {features.map((feature, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="mt-1 w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
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
