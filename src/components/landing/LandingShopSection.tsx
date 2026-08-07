import { useState, useRef } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useNavigate } from "react-router-dom";
import bentoEcom from "@/assets/bento-ecommerce.jpg";
import { useSoundIdentity } from "@/hooks/useSoundIdentity";

export function LandingShopSection() {
  const navigate = useNavigate();
  const { ref, isVisible } = useScrollReveal({ threshold: 0.2 });
  const { playHoverSound, playClickSound } = useSoundIdentity();
  
  const parallaxRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!parallaxRef.current) return;
    const rect = parallaxRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
  };

  const benefits = [
    "Éditeur visuel glisser-déposer sans code",
    "Intégration native du paiement à la livraison (COD)",
    "Paiements Mobile Money (Wave, Orange, MTN, Moov)",
    "Thèmes optimisés pour la conversion mobile",
  ];

  return (
    <section className="py-24 md:py-32 bg-[#FAFAF7] overflow-hidden" id="shop-builder">
      <div className="container mx-auto px-4 md:px-6">
        <div 
          ref={ref}
          className={`grid lg:grid-cols-2 gap-16 items-center transition-all duration-1000 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
        >
          {/* Left: Text Content */}
          <div className="order-2 lg:order-1">
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#0F1B2C] mb-6 leading-tight tracking-tight">
              Lancez votre boutique en <span className="text-[#0E7C66]">60 secondes.</span>
            </h2>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              Oubliez les configurations complexes. Avec Ecomfy, créez une boutique en ligne professionnelle, adaptée au marché africain, directement depuis votre téléphone ou votre ordinateur.
            </p>
            
            <ul className="space-y-4 mb-10">
              {benefits.map((benefit, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="mt-1 bg-[#E3F1EC] p-1 rounded-full text-[#0E7C66]">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-slate-700 font-medium">{benefit}</span>
                </li>
              ))}
            </ul>

            <Button 
              size="lg" 
              className="bg-[#0F1B2C] text-white hover:bg-[#0F1B2C]/90 px-8 rounded-full text-base font-semibold group hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
              onMouseEnter={playHoverSound}
              onClick={() => { playClickSound(); navigate("/auth"); }}
            >
              Créer ma boutique
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Right: Visual/Mockup */}
          <div 
            className="order-1 lg:order-2 relative perspective-1000"
            ref={parallaxRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <div 
              className="absolute inset-0 bg-gradient-to-tr from-[#0E7C66]/10 to-transparent rounded-3xl transition-transform duration-200 ease-out"
              style={{
                transform: `rotate(-3deg) scale(1.05) translate(${mousePos.x * -20}px, ${mousePos.y * -20}px)`
              }}
            ></div>
            <div 
              className="relative rounded-2xl overflow-hidden shadow-2xl border border-black/5 bg-white transition-transform duration-200 ease-out"
              style={{
                transform: `rotateX(${mousePos.y * -10}deg) rotateY(${mousePos.x * 10}deg)`
              }}
              onMouseEnter={playHoverSound}
            >
              {/* Fake browser bar */}
              <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                <div className="mx-auto bg-white rounded-md px-24 py-1 text-[10px] text-slate-400 shadow-sm">ecomfy.cloud/mon-shop</div>
              </div>
              <img 
                src={bentoEcom} 
                alt="Ecomfy Shop Builder" 
                className="w-full h-auto object-cover transform hover:scale-105 transition-transform duration-700" 
              />
            </div>
            
            {/* Floating stats card */}
            <div 
              className="absolute -bottom-6 -left-6 bg-white p-4 rounded-xl shadow-xl border border-slate-100 flex items-center gap-4 animate-bounce" 
              style={{ animationDuration: '3s' }}
            >
              <div className="bg-emerald-100 p-3 rounded-full text-emerald-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Chiffre d'affaires</p>
                <p className="text-lg font-bold text-[#0F1B2C]">+ 450 000 FCFA</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
