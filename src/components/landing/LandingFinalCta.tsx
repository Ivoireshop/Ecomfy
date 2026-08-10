import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useSoundIdentity } from "@/hooks/useSoundIdentity";

export function LandingFinalCta() {
  const navigate = useNavigate();
  const { ref, isVisible } = useScrollReveal({ threshold: 0.3, triggerOnce: true });
  const { playHoverSound, playClickSound } = useSoundIdentity();

  return (
    <section className="py-24 md:py-32 bg-white relative overflow-hidden">
      {/* Decorative background elements with pulse animation */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#E3F1EC] rounded-full mix-blend-multiply filter blur-[100px] opacity-60 translate-x-1/3 -translate-y-1/3 pointer-events-none animate-pulse" style={{ animationDuration: '4s' }}></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-orange-50 rounded-full mix-blend-multiply filter blur-[100px] opacity-60 -translate-x-1/3 translate-y-1/3 pointer-events-none animate-pulse" style={{ animationDuration: '5s' }}></div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div 
          ref={ref}
          className={`max-w-5xl mx-auto rounded-[3rem] bg-[#0F1B2C] text-white p-10 md:p-20 text-center shadow-2xl relative overflow-hidden transition-all duration-1000 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}
        >
          {/* Inner subtle glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-32 bg-[#0E7C66] rounded-[100%] filter blur-[80px] opacity-40 animate-pulse"></div>
          
          <h2 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight relative z-10">
            Votre prochain client pourrait <br /> commander aujourd'hui.
          </h2>
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10 relative z-10">
            Rejoignez des milliers d'entrepreneurs africains. Lancez votre boutique, créez vos produits avec l'IA et commencez à vendre en quelques minutes.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4 relative z-10">
            <Button 
              size="lg" 
              className="bg-[#0E7C66] hover:bg-[#0A5F4F] text-white px-8 py-7 rounded-full text-lg font-bold shadow-lg shadow-[#0E7C66]/30 transition-transform hover:scale-105"
              onMouseEnter={playHoverSound}
              onClick={() => { playClickSound(); navigate("/auth"); }}
            >
              Démarrer mon essai gratuit
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
          <p className="mt-6 text-sm text-slate-400 relative z-10">Démarrage gratuit • 50 FCFA/commande • Évoluez à votre rythme</p>
        </div>
      </div>
    </section>
  );
}
