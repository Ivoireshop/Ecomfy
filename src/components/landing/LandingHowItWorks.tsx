import { UserPlus, Settings, Rocket } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export function LandingHowItWorks() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });

  const steps = [
    {
      icon: <UserPlus className="w-8 h-8 text-white" />,
      title: "1. Créez votre compte",
      description: "Inscrivez-vous en 30 secondes. Aucune carte bancaire requise pour tester la plateforme.",
      color: "bg-blue-500",
      delay: "0ms"
    },
    {
      icon: <Settings className="w-8 h-8 text-white" />,
      title: "2. Configurez votre boutique",
      description: "Choisissez vos couleurs, ajoutez vos produits (ou générez-les avec l'IA) et configurez vos moyens de paiement.",
      color: "bg-orange-500",
      delay: "150ms"
    },
    {
      icon: <Rocket className="w-8 h-8 text-white" />,
      title: "3. Lancez vos ventes",
      description: "Partagez votre lien sur vos réseaux sociaux et encaissez vos premiers clients.",
      color: "bg-[#0E7C66]",
      delay: "300ms"
    }
  ];

  return (
    <section id="how-it-works" className="py-24 bg-[#0F1B2C] text-white">
      <div className="container mx-auto px-4">
        <div 
          ref={ref}
          className={`max-w-4xl mx-auto text-center transition-all duration-1000 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Votre boutique prête à vendre <br />
            <span className="text-[#0E7C66]">en 3 étapes simples</span>
          </h2>
          <p className="text-lg text-slate-400 mb-16 max-w-2xl mx-auto">
            Pas besoin de compétences techniques ou de faire appel à une agence. Ecomfy est conçu pour être pris en main immédiatement.
          </p>

          <div className="grid md:grid-cols-3 gap-8 relative text-left">
            {/* Ligne de connexion entre les étapes (visible seulement sur desktop) */}
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-slate-800 z-0"></div>

            {steps.map((step, index) => (
              <div 
                key={index}
                className="relative z-10 flex flex-col items-center md:items-start"
                style={{ transitionDelay: step.delay }}
              >
                <div className={`w-24 h-24 rounded-2xl ${step.color} flex items-center justify-center mb-6 shadow-xl transform transition-transform hover:scale-110 hover:rotate-3`}>
                  {step.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 text-center md:text-left">{step.title}</h3>
                <p className="text-slate-400 text-center md:text-left leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
