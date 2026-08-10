import { XCircle, CheckCircle2 } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export function LandingPositioning() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });

  const points = [
    {
      bad: "Bricolage entre WhatsApp, Canva et Excel",
      good: "Tout centralisé sur une seule plateforme"
    },
    {
      bad: "Visuels amateurs qui ne rassurent pas",
      good: "Design premium généré par l'IA"
    },
    {
      bad: "Gestion de stock chaotique et manuelle",
      good: "Suivi automatisé en temps réel"
    }
  ];

  return (
    <section id="solutions" className="py-24 bg-[#F8FAFC]">
      <div className="container mx-auto px-4">
        <div 
          ref={ref}
          className={`max-w-4xl mx-auto text-center transition-all duration-1000 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
        >
          <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6">
            Fini le bricolage. <br />
            <span className="text-[#0E7C66]">Passez au niveau supérieur.</span>
          </h2>
          <p className="text-lg md:text-xl text-slate-600 mb-16 max-w-2xl mx-auto">
            Ecomfy rassemble tout ce dont vous avez besoin pour vendre, en une seule plateforme pensée pour votre succès.
          </p>

          <div className="grid md:grid-cols-3 gap-6 text-left">
            {points.map((point, index) => (
              <div 
                key={index}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-6 relative"
                style={{
                  transitionDelay: `${index * 150}ms`
                }}
              >
                <div className="flex flex-col gap-2 opacity-50 grayscale">
                  <div className="flex items-center gap-2 text-slate-500 font-medium">
                    <XCircle className="w-5 h-5 text-red-500" />
                    Avant
                  </div>
                  <p className="text-sm text-slate-600 pl-7">{point.bad}</p>
                </div>
                
                <div className="h-px bg-slate-100 w-full"></div>
                
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[#0E7C66] font-semibold">
                    <CheckCircle2 className="w-5 h-5" />
                    Avec Ecomfy
                  </div>
                  <p className="text-base text-slate-900 font-medium pl-7">{point.good}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
