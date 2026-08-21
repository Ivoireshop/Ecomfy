import { Package, Users, Bell, ArrowRight } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export function LandingPillarManage() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });

  const features = [
    {
      icon: <Package className="w-5 h-5 text-blue-500" />,
      title: "Gestion des stocks",
      description: "Alerte de stock faible, gestion des variantes et inventaire synchronisé."
    },
    {
      icon: <Users className="w-5 h-5 text-blue-500" />,
      title: "CRM e-commerce",
      description: "Retrouvez l'historique d'achat de chaque client pour mieux les recibler."
    },
    {
      icon: <Bell className="w-5 h-5 text-blue-500" />,
      title: "Notifications temps réel",
      description: "Soyez alerté sur WhatsApp ou par email à chaque nouvelle commande."
    }
  ];

  return (
    <section id="marketing" className="py-24 bg-slate-50 border-t border-slate-100 overflow-hidden">
      <div className="container mx-auto px-4">
        <div 
          ref={ref}
          className={`flex flex-col-reverse lg:flex-row-reverse items-center gap-16 transition-all duration-1000 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
        >
          {/* Visual Composite */}
          <div className="flex-1 relative w-full h-[500px]">
            {/* Background Blob */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-100 rounded-full filter blur-3xl opacity-50"></div>
            
            {/* Main Window (Admin Table Mockup) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-10">
              {/* Header */}
              <div className="border-b border-slate-100 p-4 bg-slate-50 flex justify-between items-center">
                <span className="font-bold text-slate-900">Commandes récentes</span>
                <div className="flex gap-2">
                  <div className="w-20 h-8 bg-white border border-slate-200 rounded text-xs flex items-center justify-center text-slate-500 font-medium">Filtrer</div>
                </div>
              </div>
              
              {/* Table Body */}
              <div className="p-0">
                {[
                  { id: "#CMD-849", client: "Awa Sylla", status: "Livré", color: "text-green-700 bg-green-50 border-green-200", amount: "45 000 FCFA" },
                  { id: "#CMD-848", client: "Kouadio Jean", status: "En cours", color: "text-blue-700 bg-blue-50 border-blue-200", amount: "12 500 FCFA" },
                  { id: "#CMD-847", client: "Marie N'guessan", status: "En attente", color: "text-orange-700 bg-orange-50 border-orange-200", amount: "30 000 FCFA" },
                  { id: "#CMD-846", client: "Cheick Oumar", status: "Livré", color: "text-green-700 bg-green-50 border-green-200", amount: "15 000 FCFA" },
                ].map((row, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900">{row.id}</span>
                      <span className="text-xs text-slate-500">{row.client}</span>
                    </div>
                    <div className={`px-2 py-1 rounded text-[10px] font-bold border ${row.color}`}>
                      {row.status}
                    </div>
                    <div className="text-sm font-semibold text-slate-900">
                      {row.amount}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-slate-50 text-center text-xs text-blue-600 font-semibold cursor-pointer hover:bg-slate-100">
                Voir toutes les commandes <ArrowRight className="w-3 h-3 inline ml-1" />
              </div>
            </div>

            {/* Floating Widget 1: Low Stock Alert */}
            <div className="absolute -left-8 top-1/4 bg-white p-3 rounded-xl shadow-xl border border-red-100 z-20 flex items-center gap-3 animate-float-slow">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
              <div>
                <p className="text-sm font-bold text-slate-900">Stock faible</p>
                <p className="text-xs text-red-600 font-medium">Sérum Vitamine C (2 restants)</p>
              </div>
            </div>

            {/* Floating Widget 2: CRM Insight */}
            <div className="absolute -right-4 bottom-1/4 bg-white p-4 rounded-xl shadow-xl border border-slate-100 z-20 w-48 animate-float">
              <p className="text-xs text-slate-500 mb-1">Awa Sylla</p>
              <p className="text-sm font-bold text-slate-900 mb-2">Client VIP 🌟</p>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-slate-500">Commandes</span>
                <span className="text-slate-900">12</span>
              </div>
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-slate-500">Total</span>
                <span className="text-[#0E7C66]">250 000 F</span>
              </div>
            </div>
            
          </div>

          {/* Texte et Features */}
          <div className="flex-1 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold">
              <span>4. GÉRER</span>
            </div>
            
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 leading-tight">
              Gérez votre activité <br />
              <span className="text-blue-600">sans effort</span>.
            </h2>
            
            <p className="text-lg text-slate-600">
              Centralisez vos commandes, suivez vos stocks en temps réel et fidélisez votre clientèle grâce à notre CRM intégré.
            </p>

            <div className="space-y-6 pt-4">
              {features.map((feature, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="mt-1 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
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
