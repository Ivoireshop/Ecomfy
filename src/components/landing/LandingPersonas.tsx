import { Rocket, Store, Briefcase } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export function LandingPersonas() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });

  const personas = [
    {
      icon: <img src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&q=80&w=150&h=150" alt="Débutant" className="w-full h-full object-cover" />,
      title: "Pour les débutants",
      subtitle: "Lancez-vous sans risque",
      description: "Vous n'avez jamais vendu en ligne ? L'assistant IA vous guide pas à pas. De la création du logo à la rédaction de vos premières fiches produits.",
      color: "bg-blue-50",
      borderColor: "border-blue-100",
      delay: "0ms"
    },
    {
      icon: <img src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=150&h=150" alt="Vendeur" className="w-full h-full object-cover" />,
      title: "Pour les vendeurs existants",
      subtitle: "Structurez votre croissance",
      description: "Vous vendez déjà sur WhatsApp ou Facebook ? Centralisez vos commandes, automatisez vos paiements et suivez vos stocks pour enfin gagner du temps.",
      color: "bg-green-50",
      borderColor: "border-green-100",
      delay: "150ms"
    },
    {
      icon: <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=150&h=150" alt="Agence" className="w-full h-full object-cover" />,
      title: "Pour les agences",
      subtitle: "Gérez plusieurs clients",
      description: "Créez et administrez les boutiques de vos clients depuis une interface unique. Déployez des sites e-commerce professionnels en un temps record.",
      color: "bg-purple-50",
      borderColor: "border-purple-100",
      delay: "300ms"
    }
  ];

  return (
    <section className="py-24 bg-white border-t border-slate-100">
      <div className="container mx-auto px-4">
        <div 
          ref={ref}
          className={`transition-all duration-1000 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
        >
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6">
              Pensé pour <span className="text-[#0E7C66]">votre réalité</span>.
            </h2>
            <p className="text-lg text-slate-600">
              Que vous partiez de zéro ou que vous gériez déjà un volume important de commandes, Ecomfy s'adapte à vos besoins.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {personas.map((persona, index) => (
              <div 
                key={index}
                className={`p-8 rounded-3xl border ${persona.borderColor} ${persona.color} hover:-translate-y-2 transition-transform duration-300`}
                style={{ transitionDelay: persona.delay }}
              >
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-6 overflow-hidden">
                  {persona.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">{persona.title}</h3>
                <p className="text-sm font-semibold text-slate-500 mb-4">{persona.subtitle}</p>
                <p className="text-slate-600 leading-relaxed">
                  {persona.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
