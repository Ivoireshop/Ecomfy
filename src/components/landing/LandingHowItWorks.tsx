import { UserPlus, Settings, Rocket, ArrowRight } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

import step1Img from "@/assets/ecommerce-shopping.jpg";
import step2Img from "@/assets/feature-ia.jpg";
import step3Img from "@/assets/ecommerce-product-page.jpg";

export function LandingHowItWorks() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });
  const navigate = useNavigate();

  const steps = [
    {
      icon: <UserPlus className="w-6 h-6 text-[#0E7C66]" />,
      title: "1. Créez votre compte",
      description: "Inscrivez-vous en 30 secondes. Aucune carte bancaire requise, aucun engagement.",
      image: step1Img,
      delay: "0ms"
    },
    {
      icon: <Settings className="w-6 h-6 text-blue-600" />,
      title: "2. Personnalisez",
      description: "Choisissez vos couleurs, générez vos produits avec l'IA et ajoutez vos moyens de paiement.",
      image: step2Img,
      delay: "150ms"
    },
    {
      icon: <Rocket className="w-6 h-6 text-orange-600" />,
      title: "3. Lancez vos ventes",
      description: "Partagez votre lien et encaissez vos premiers clients partout dans le monde.",
      image: step3Img,
      delay: "300ms"
    }
  ];

  return (
    <section id="how-it-works" className="py-24 md:py-32 bg-[#0F1B2C] text-white overflow-hidden relative">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#0E7C66]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

      <div className="container mx-auto px-4 relative z-10">
        <div 
          ref={ref}
          className={`max-w-4xl mx-auto text-center transition-all duration-1000 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-300 text-sm font-semibold mb-6">
            <span>COMMENT ÇA MARCHE</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight">
            Votre boutique prête à vendre <br className="hidden md:block" />
            <span className="text-[#0E7C66]">en 3 étapes simples.</span>
          </h2>
          <p className="text-lg text-slate-400 mb-20 max-w-2xl mx-auto">
            L'excellence e-commerce ne devrait pas être compliquée. Nous avons réduit le processus de création de semaines à quelques minutes.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 md:gap-12 relative text-left max-w-6xl mx-auto">
          {/* Ligne de connexion (visible seulement sur desktop) */}
          <div className="hidden md:block absolute top-[150px] left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent z-0"></div>

          {steps.map((step, index) => (
            <div 
              key={index}
              className={`relative z-10 flex flex-col items-center md:items-start group transition-all duration-1000 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
              style={{ transitionDelay: step.delay }}
            >
              {/* Media Container */}
              <div className="w-full h-48 md:h-64 rounded-3xl overflow-hidden mb-8 relative border border-white/10 shadow-2xl group-hover:border-white/30 transition-all duration-500">
                <div className="absolute inset-0 bg-[#0F1B2C]/40 group-hover:bg-transparent transition-all duration-500 z-10"></div>
                <img 
                  src={step.image} 
                  alt={step.title} 
                  className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700 ease-in-out"
                />
                
                {/* Floating Icon */}
                <div className="absolute bottom-4 left-4 z-20 w-12 h-12 rounded-2xl bg-white/90 backdrop-blur-md flex items-center justify-center shadow-lg group-hover:translate-y-[-4px] transition-transform duration-300">
                  {step.icon}
                </div>
              </div>

              {/* Text content */}
              <div className="px-2 w-full text-center md:text-left">
                <h3 className="text-2xl font-bold mb-3 text-white">{step.title}</h3>
                <p className="text-slate-400 leading-relaxed text-base">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <Button 
            size="lg" 
            className="rounded-full bg-white text-[#0F1B2C] hover:bg-slate-100 font-bold px-8 py-6 text-lg hover:scale-105 transition-all shadow-xl shadow-white/10 group"
            onClick={() => navigate("/auth")}
          >
            Commencer maintenant
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    </section>
  );
}
