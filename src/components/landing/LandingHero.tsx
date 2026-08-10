import { useState, useRef } from "react";
import { ArrowRight, PlayCircle, Sparkles, ShoppingBag, TrendingUp, ImageIcon, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import heroDesktop from "@/assets/hero-desktop-dashboard.jpg";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useSoundIdentity } from "@/hooks/useSoundIdentity";

export function LandingHero() {
  const navigate = useNavigate();
  const { ref: heroRef, isVisible } = useScrollReveal({ threshold: 0.1 });
  const { playHoverSound, playClickSound } = useSoundIdentity();
  
  // État pour l'effet 3D
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const sectionRef = useRef<HTMLElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!sectionRef.current) return;
    const { innerWidth, innerHeight } = window;
    const x = (e.clientX / innerWidth - 0.5) * 2;
    const y = (e.clientY / innerHeight - 0.5) * 2;
    setMousePos({ x: x * 15, y: -y * 15 });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
  };

  return (
    <section 
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full overflow-hidden bg-[#0F1B2C] text-white pt-24 md:pt-32 pb-20 md:pb-40 [perspective:2000px]"
    >
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#0E7C66] rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-[#0A5F4F] rounded-full mix-blend-screen filter blur-[150px] opacity-30"></div>
      </div>

      <div className="container relative z-10 mx-auto px-4 md:px-6">
        <div 
          ref={heroRef}
          className={`flex flex-col items-center text-center max-w-5xl mx-auto transition-all duration-1000 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0E7C66]/20 border border-[#0E7C66]/50 text-[#E3F1EC] text-sm font-semibold mb-8 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-[#F7C04A]" />
            <span>La plateforme tout-en-un pour vendre en ligne</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-extrabold tracking-tight leading-[1.05] mb-8">
            Créez. Vendez. Gérez. <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E3F1EC] to-[#0E7C66]">
              Développez votre business.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-slate-300 max-w-3xl mx-auto mb-12 leading-relaxed">
            Créez votre boutique, concevez vos contenus avec l'IA, gérez vos commandes, votre stock, vos finances et développez vos ventes depuis une seule plateforme.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mb-20 justify-center">
            <Button 
              size="lg" 
              className="bg-[#0E7C66] text-white hover:bg-[#0A5F4F] px-8 py-7 text-lg rounded-full font-bold transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(14,124,102,0.5)]"
              onMouseEnter={playHoverSound}
              onClick={() => {
                playClickSound();
                navigate("/auth");
              }}
            >
              Créer mon compte
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="bg-white/5 border-white/20 text-white hover:bg-white/10 px-8 py-7 text-lg rounded-full font-semibold backdrop-blur-sm transition-all hover:scale-105"
              onMouseEnter={playHoverSound}
              onClick={() => {
                playClickSound();
                const el = document.getElementById("solutions");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <ArrowRight className="mr-2 h-5 w-5" />
              Découvrir Ecomfy
            </Button>
          </div>
        </div>

        {/* Dashboard Mockup - 3D Parallax effect avec Micro-cartes */}
        <div 
          className={`relative mx-auto max-w-5xl transition-all duration-1000 delay-300 transform ${isVisible ? "opacity-100" : "translate-y-24 opacity-0"}`}
          style={{
            transform: isVisible 
              ? `translateY(0) rotateX(${mousePos.y}deg) rotateY(${mousePos.x}deg) scale3d(1, 1, 1)` 
              : `translateY(6rem) rotateX(20deg) rotateY(0deg) scale3d(0.9, 0.9, 0.9)`,
            transformStyle: "preserve-3d",
            transition: "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
          }}
        >
          {/* Main Dashboard Image */}
          <div 
            className="rounded-2xl md:rounded-[2rem] border border-white/10 bg-white/5 p-2 md:p-4 shadow-2xl backdrop-blur-md relative"
            style={{ transform: "translateZ(30px)" }}
          >
            <div className="rounded-xl md:rounded-2xl overflow-hidden border border-slate-800 bg-[#0a0f18] relative shadow-[0_0_50px_rgba(0,0,0,0.5)]">
              <img 
                src={heroDesktop} 
                alt="Ecomfy Dashboard" 
                className="w-full h-auto opacity-90"
              />
              {/* Dynamic light reflection based on mouse */}
              <div 
                className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-50"
                style={{
                  background: `radial-gradient(circle at ${50 + mousePos.x}% ${50 - mousePos.y}%, rgba(255,255,255,0.4) 0%, transparent 50%)`
                }}
              ></div>
            </div>
            
            {/* Widget: Nouvelle commande */}
            <div 
              className="absolute -left-12 top-1/4 animate-float bg-white rounded-xl p-4 shadow-xl border border-slate-100 flex items-center gap-4 z-20 hidden lg:flex"
              style={{ transform: "translateZ(60px)" }}
            >
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">À l'instant</p>
                <p className="text-sm font-bold text-slate-900">Nouvelle commande</p>
                <p className="text-xs text-green-600 font-semibold">+ 45 000 FCFA</p>
              </div>
            </div>

            {/* Widget: Visuel généré */}
            <div 
              className="absolute -right-8 top-1/3 animate-float-slow bg-white rounded-xl p-3 shadow-xl border border-slate-100 flex items-center gap-3 z-20 hidden md:flex"
              style={{ transform: "translateZ(80px)" }}
            >
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div className="pr-4">
                <p className="text-sm font-bold text-slate-900">Visuel IA généré</p>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500" /> Prêt pour Instagram
                </p>
              </div>
            </div>

            {/* Widget: Chiffre d'affaires */}
            <div 
              className="absolute -right-16 bottom-1/4 animate-float bg-white rounded-xl p-4 shadow-xl border border-slate-100 flex flex-col gap-2 z-20 hidden lg:flex"
              style={{ transform: "translateZ(50px)" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-orange-600" />
                </div>
                <p className="text-sm font-bold text-slate-900">Chiffre d'affaires</p>
              </div>
              <p className="text-xl font-black text-slate-900">2,450,000 FCFA</p>
              <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
                +18% <span className="text-slate-400 font-normal">cette semaine</span>
              </p>
            </div>
            
          </div>
        </div>
      </div>
    </section>
  );
}
