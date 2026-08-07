import { useEffect, useState } from "react";
import storeLocal from "@/assets/store-local.jpg";
import storeImported from "@/assets/store-imported.jpg";
import storeFashion from "@/assets/store-fashion.jpg";
import { Sparkles, MessageCircleQuestion } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const STORIES = [
  {
    id: 1,
    question: "Comment vendre mes produits locaux ?",
    answer: "Créez une boutique chaleureuse mettant en valeur l'artisanat africain. Ajoutez vos produits et encaissez via Mobile Money en quelques clics.",
    image: storeLocal,
    color: "from-amber-500 to-orange-500",
    badge: "Artisanat & Local"
  },
  {
    id: 2,
    question: "Comment distribuer mes imports ?",
    answer: "Déployez un design ultra-moderne pour vos produits high-tech ou accessoires. Synchronisez vos stocks et proposez le paiement à la livraison (COD).",
    image: storeImported,
    color: "from-blue-500 to-indigo-500",
    badge: "High-Tech & Imports"
  },
  {
    id: 3,
    question: "Comment lancer ma marque de mode ?",
    answer: "Affichez vos collections dans un écrin élégant. Générez des visuels IA portés par des mannequins virtuels et attirez des milliers de clients.",
    image: storeFashion,
    color: "from-emerald-500 to-teal-500",
    badge: "Mode & Vêtements"
  }
];

export function LandingScrollStory() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.2 });
  const [activeIndex, setActiveIndex] = useState(0);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Ne démarrer l'animation que lorsque la section est visible
    if (!isVisible) return;

    let currentText = "";
    const fullText = STORIES[activeIndex].answer;
    let charIndex = 0;
    
    // Réinitialiser les états au changement d'index
    setTypedAnswer("");
    setIsTyping(true);
    setIsFadingOut(false);

    // Effet "Machine à écrire"
    const typeInterval = setInterval(() => {
      if (charIndex < fullText.length) {
        currentText += fullText.charAt(charIndex);
        setTypedAnswer(currentText);
        charIndex++;
      } else {
        clearInterval(typeInterval);
        setIsTyping(false);
        
        // Attendre 4 secondes après la fin de la frappe, puis déclencher le fade out
        setTimeout(() => {
          setIsFadingOut(true);
          // Attendre 800ms pour l'animation de fondu, puis passer à la slide suivante
          setTimeout(() => {
            setActiveIndex((prev) => (prev + 1) % STORIES.length);
          }, 800);
        }, 4000);
      }
    }, 35); // Vitesse de frappe (35ms par caractère)

    return () => clearInterval(typeInterval);
  }, [activeIndex, isVisible]);

  const currentStory = STORIES[activeIndex];

  return (
    <section className="bg-white py-24 md:py-32 overflow-hidden" ref={ref}>
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#0F1B2C] mb-6 tracking-tight">
            De l'idée à <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0E7C66] to-emerald-400">l'empire.</span>
          </h2>
          <p className="text-lg text-slate-600">
            Peu importe ce que vous vendez, Ecomfy s'adapte à votre vision. Voici comment nos marchands réussissent.
          </p>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center min-h-[600px]">
            
            {/* Colonne Image (Gauche) */}
            <div className="relative h-[400px] md:h-[600px] w-full rounded-[2rem] overflow-hidden shadow-2xl group bg-slate-100">
              {STORIES.map((story, idx) => (
                <div 
                  key={story.id}
                  className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
                    activeIndex === idx 
                      ? "opacity-100 scale-100 z-10" 
                      : "opacity-0 scale-105 z-0"
                  } ${isFadingOut && activeIndex === idx ? "opacity-0" : ""}`}
                >
                  <img 
                    src={story.image} 
                    alt={story.badge}
                    className="w-full h-full object-cover object-top"
                  />
                  {/* Gradient Overlay for better contrast on mobile */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0F1B2C]/80 via-transparent to-transparent md:hidden"></div>
                  
                  {/* Badge thématique sur l'image */}
                  <div className="absolute top-6 left-6 px-4 py-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-white flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${story.color}`}></div>
                    <span className="text-sm font-bold text-[#0F1B2C]">{story.badge}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Colonne Texte Animé (Droite) */}
            <div className="relative flex flex-col justify-center h-full">
              <div 
                className={`transition-all duration-700 transform ${
                  isFadingOut ? "opacity-0 translate-y-8" : "opacity-100 translate-y-0"
                }`}
              >
                {/* Icône de message/IA */}
                <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-8 shadow-sm">
                  <MessageCircleQuestion className="w-7 h-7 text-[#0E7C66]" />
                </div>
                
                {/* Question statique */}
                <h3 className="text-3xl md:text-4xl font-extrabold text-[#0F1B2C] mb-8 leading-tight">
                  {currentStory.question}
                </h3>
                
                {/* Réponse avec effet machine à écrire */}
                <div className="bg-slate-50 border border-slate-100 p-6 md:p-8 rounded-[2rem] shadow-inner relative">
                  <Sparkles className="absolute top-6 right-6 w-5 h-5 text-amber-400 opacity-50" />
                  <p className="text-lg md:text-xl text-slate-700 leading-relaxed font-medium min-h-[120px]">
                    {typedAnswer}
                    {isTyping && (
                      <span className="inline-block w-2 h-5 ml-1 bg-[#0E7C66] animate-pulse align-middle"></span>
                    )}
                  </p>
                </div>
                
                {/* Indicateur de progression (Petits points) */}
                <div className="flex gap-2 mt-12">
                  {STORIES.map((_, idx) => (
                    <div 
                      key={idx}
                      className={`h-2 rounded-full transition-all duration-500 ${
                        activeIndex === idx ? "w-8 bg-[#0E7C66]" : "w-2 bg-slate-200"
                      }`}
                    ></div>
                  ))}
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
