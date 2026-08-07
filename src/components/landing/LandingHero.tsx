import { useState, useEffect, useRef } from "react";
import { ArrowRight, PlayCircle, Sparkles } from "lucide-react";
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
    // Calcule la position de la souris par rapport au centre de l'écran (-1 à 1)
    const x = (e.clientX / innerWidth - 0.5) * 2;
    const y = (e.clientY / innerHeight - 0.5) * 2;
    // Rotation max de 15 degrés
    setMousePos({ x: x * 15, y: -y * 15 });
  };

  const handleMouseLeave = () => {
    // Retour doux à la position initiale
    setMousePos({ x: 0, y: 0 });
  };

  return (
    <section 
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full overflow-hidden bg-[#0F1B2C] text-white pt-24 md:pt-32 pb-20 md:pb-32 [perspective:2000px]"
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/90 text-xs font-semibold mb-8 backdrop-blur-sm animate-bounce">
            <Sparkles className="w-3.5 h-3.5 text-[#F7C04A]" />
            <span>L'avenir du e-commerce en Afrique</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl lg:text-[5rem] font-extrabold tracking-tight leading-[1.05] mb-6">
            Votre business en ligne, <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E3F1EC] to-[#0E7C66]">propulsé par l'IA.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mb-10 leading-relaxed">
            Créez des visuels percutants, des vidéos engageantes et lancez votre boutique e-commerce en quelques minutes. Une seule plateforme pour tout gérer.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mb-16">
            <Button 
              size="lg" 
              className="bg-white text-[#0F1B2C] hover:bg-gray-100 px-8 py-7 text-lg rounded-full font-bold transition-all hover:scale-110 hover:shadow-[0_0_40px_rgba(14,124,102,0.4)]"
              onMouseEnter={playHoverSound}
              onClick={() => {
                playClickSound();
                navigate("/auth");
              }}
            >
              Démarrer gratuitement
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="bg-white/5 border-white/20 text-white hover:bg-white/10 px-8 py-7 text-lg rounded-full font-semibold backdrop-blur-sm transition-all hover:scale-105"
              onMouseEnter={playHoverSound}
              onClick={() => {
                playClickSound();
                const el = document.getElementById("demo-video");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <PlayCircle className="mr-2 h-5 w-5" />
              Voir comment ça marche
            </Button>
          </div>
        </div>

        {/* Dashboard Mockup - 3D Parallax effect */}
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
          <div 
            className="rounded-2xl md:rounded-[2rem] border border-white/10 bg-white/5 p-2 md:p-4 shadow-2xl backdrop-blur-md"
            style={{ transform: "translateZ(30px)" }} // Fait ressortir le cadre en 3D
          >
            <div className="rounded-xl md:rounded-2xl overflow-hidden border border-white/10 bg-[#0a0f18] relative">
              <img 
                src={heroDesktop} 
                alt="Ecomfy Dashboard" 
                className="w-full h-auto opacity-90 hover:opacity-100 transition-opacity duration-500"
              />
              {/* Dynamic light reflection based on mouse */}
              <div 
                className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-50"
                style={{
                  background: `radial-gradient(circle at ${50 + mousePos.x}% ${50 - mousePos.y}%, rgba(255,255,255,0.4) 0%, transparent 50%)`
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
