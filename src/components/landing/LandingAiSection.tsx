import { useEffect, useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useNavigate } from "react-router-dom";

export function LandingAiSection() {
  const navigate = useNavigate();
  const { ref, isVisible } = useScrollReveal({ threshold: 0.3, triggerOnce: true });
  
  const fullText = "Génère une description de produit pour des chaussures en cuir faites à la main à Abidjan. Mets en avant le confort, l'artisanat local et propose 3 variantes de couleurs.";
  const [typedText, setTypedText] = useState("");
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex < fullText.length) {
        setTypedText(fullText.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
        setIsTypingComplete(true);
        setTimeout(() => setShowResult(true), 800);
      }
    }, 40);

    return () => clearInterval(typingInterval);
  }, [isVisible, fullText]);

  return (
    <section className="py-24 md:py-32 bg-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-slate-50 via-white to-white pointer-events-none"></div>
      
      <div className="container mx-auto px-4 md:px-6 relative z-10" ref={ref}>
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl md:text-5xl font-extrabold text-[#0F1B2C] mb-6 leading-tight tracking-tight">
            Votre assistant <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">IA personnel.</span>
          </h2>
          <p className="text-lg text-slate-600 leading-relaxed">
            De la description produit au script vidéo, notre intelligence artificielle comprend le contexte africain et travaille pour vous, 24/7.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* AI Terminal Window */}
          <div className="rounded-2xl border border-slate-200 shadow-2xl bg-white overflow-hidden flex flex-col">
            {/* Window header */}
            <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-slate-200"></div>
                <div className="w-3 h-3 rounded-full bg-slate-200"></div>
                <div className="w-3 h-3 rounded-full bg-slate-200"></div>
              </div>
              <div className="mx-auto flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-white px-3 py-1 rounded-md shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                Ecomfy AI
              </div>
            </div>

            <div className="p-6 md:p-10 flex flex-col gap-8 bg-slate-50/50 min-h-[400px]">
              {/* User Input bubble */}
              <div className="flex justify-end">
                <div className="bg-[#0F1B2C] text-white p-4 rounded-2xl rounded-tr-sm max-w-[85%] shadow-md">
                  <p className="text-sm md:text-base leading-relaxed">
                    {typedText}
                    {!isTypingComplete && <span className="inline-block w-1.5 h-4 ml-1 bg-white animate-pulse align-middle"></span>}
                  </p>
                </div>
              </div>

              {/* AI Response bubble */}
              <div className={`flex justify-start transition-all duration-700 transform ${showResult ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <div className="bg-white border border-slate-200 p-5 rounded-2xl rounded-tl-sm max-w-[90%] shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Réponse générée</span>
                  </div>
                  <div className="space-y-3 text-slate-700 text-sm md:text-base">
                    <p className="font-bold text-[#0F1B2C]">⭐ L'Élégance Artisanale Abidjanaise : Chaussures en Cuir Premium</p>
                    <p>Démarquez-vous avec nos chaussures confectionnées à la main au cœur d'Abidjan. Alliant le savoir-faire de nos meilleurs artisans cordonniers et un cuir véritable sélectionné avec rigueur, chaque paire garantit une durabilité exceptionnelle et un confort absolu pour vos journées actives.</p>
                    <ul className="list-disc pl-5 space-y-1 text-slate-600">
                      <li><strong className="text-slate-800">Noir Ébène :</strong> Pour un look professionnel et sobre.</li>
                      <li><strong className="text-slate-800">Marron Cognac :</strong> La touche d'élégance polyvalente.</li>
                      <li><strong className="text-slate-800">Bordeaux Royal :</strong> Pour affirmer votre style unique.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Loader (while waiting for response) */}
              {!showResult && isTypingComplete && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce"></div>
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="text-center mt-12">
          <Button 
            variant="outline" 
            size="lg" 
            className="border-slate-300 text-slate-700 hover:bg-slate-100 rounded-full font-semibold"
            onClick={() => navigate("/auth")}
          >
            Tester l'IA gratuitement
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
}
