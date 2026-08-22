import { ArrowRight, Sparkles, ShoppingCart, TrendingUp, PackageCheck, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import heroDesktop from "@/assets/hero-desktop-dashboard.jpg";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useSoundIdentity } from "@/hooks/useSoundIdentity";
import { useEffect, useState, useRef } from "react";

// Hook for mouse parallax effect
function useMouseParallax(intensity: number = 20) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const requestRef = useRef<number>();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Calculate normalized position from -1 to 1 based on center of screen
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      
      requestRef.current = requestAnimationFrame(() => {
        setPosition({ x: x * intensity, y: y * intensity });
      });
    };

    // Only apply parallax if user doesn't prefer reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReducedMotion) {
      window.addEventListener("mousemove", handleMouseMove);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [intensity]);

  return position;
}

const HERO_PHRASES = [
  { text: "Pour tout vendre simplement.", highlight: "vendre" },
  { text: "Fini le bricolage, passez au niveau supérieur.", highlight: "niveau supérieur" },
  { text: "Créez une boutique professionnelle en 3 minutes.", highlight: "boutique" },
  { text: "Une fiche produit optimisée pour la conversion.", highlight: "conversion" },
  { text: "Votre studio créatif propulsé par IA.", highlight: "propulsé par IA" },
  { text: "La finance claire et nette.", highlight: "claire et nette" },
  { text: "Un écosystème ouvert.", highlight: "écosystème" },
  { text: "ConnectUs, connectez-vous au monde.", highlight: "ConnectUs" },
];

function HeroTypewriter() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      setIsPaused(document.visibilityState === 'hidden');
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || isPaused) return;

    const currentPhrase = HERO_PHRASES[phraseIndex].text;
    let timer: NodeJS.Timeout;

    if (!isDeleting) {
      if (charIndex < currentPhrase.length) {
        const speed = 50 + Math.random() * 20; // 50-70ms per char
        timer = setTimeout(() => {
          setCharIndex((prev) => prev + 1);
        }, speed);
      } else {
        // Pause 3s after typing complete phrase
        timer = setTimeout(() => {
          setIsDeleting(true);
        }, 3000);
      }
    } else {
      if (charIndex > 0) {
        timer = setTimeout(() => {
          setCharIndex((prev) => prev - 1);
        }, 30);
      } else {
        // Pause 400ms after erasing phrase before starting next
        timer = setTimeout(() => {
          setIsDeleting(false);
          setPhraseIndex((prev) => (prev + 1) % HERO_PHRASES.length);
        }, 400);
      }
    }

    return () => clearTimeout(timer);
  }, [charIndex, isDeleting, phraseIndex, isPaused, prefersReducedMotion]);

  const currentPhraseObj = HERO_PHRASES[phraseIndex];

  if (prefersReducedMotion) {
    return (
      <div className="min-h-[120px] sm:min-h-[150px] md:min-h-[180px] lg:min-h-[220px] flex items-center justify-center mb-8 w-full max-w-4xl">
        <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[1.08] text-slate-900 drop-shadow-sm text-center">
          Pour tout <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0E7C66] to-[#0A5F4F]">vendre</span> simplement.
        </h1>
      </div>
    );
  }

  const fullText = currentPhraseObj.text;
  const visibleLength = charIndex;
  const visibleText = fullText.slice(0, visibleLength);
  const highlightWord = currentPhraseObj.highlight;
  const highlightStart = fullText.indexOf(highlightWord);
  const highlightEnd = highlightStart + highlightWord.length;

  let before = "";
  let highlighted = "";
  let after = "";

  if (highlightStart !== -1) {
    before = visibleText.slice(0, Math.min(visibleLength, highlightStart));
    if (visibleLength > highlightStart) {
      highlighted = visibleText.slice(highlightStart, Math.min(visibleLength, highlightEnd));
    }
    if (visibleLength > highlightEnd) {
      after = visibleText.slice(highlightEnd);
    }
  } else {
    before = visibleText;
  }

  return (
    <div className="min-h-[120px] sm:min-h-[150px] md:min-h-[180px] lg:min-h-[220px] flex items-center justify-center mb-8 w-full max-w-4xl">
      <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[1.08] text-slate-900 drop-shadow-sm text-center">
        {before}
        {highlighted && (
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0E7C66] to-[#0A5F4F]">
            {highlighted}
          </span>
        )}
        {after}
        <span className="inline-block w-[4px] md:w-[6px] h-[0.75em] bg-[#0E7C66] ml-1.5 align-baseline animate-cursor-blink rounded-full shadow-sm" />
      </h1>
    </div>
  );
}

export function LandingHero() {
  const navigate = useNavigate();
  const { ref: heroRef, isVisible } = useScrollReveal({ threshold: 0.1 });
  const { playHoverSound, playClickSound } = useSoundIdentity();
  
  const mediaRow1 = [
    { type: "image", url: "https://images.unsplash.com/photo-1571781564998-333e617d59fc?auto=format&fit=crop&q=80&w=800" },
    { type: "video", url: "https://assets.mixkit.co/videos/preview/mixkit-woman-speaking-in-front-of-the-camera-42998-large.mp4", poster: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80&w=400" },
    { type: "image", url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800" },
    { type: "image", url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800" },
    { type: "video", url: "https://cdn.coverr.co/videos/coverr-a-woman-talking-on-her-phone-while-looking-at-her-laptop-2815/1080p.mp4", poster: "https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&q=80&w=400" },
  ];

  const mediaRow2 = [
    { type: "image", url: heroDesktop },
    { type: "image", url: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&q=80&w=800" },
    { type: "video", url: "https://assets.mixkit.co/videos/preview/mixkit-packing-a-box-with-a-purchase-40019-large.mp4", poster: "https://images.unsplash.com/photo-1580828361830-674332d73be1?auto=format&fit=crop&q=80&w=400" },
    { type: "image", url: "https://images.unsplash.com/photo-1616423640778-28d1b53229bd?auto=format&fit=crop&q=80&w=800" },
    { type: "image", url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=800" },
  ];

  const MediaCard = ({ item }: { item: any }) => (
    <div className="w-[300px] h-[200px] md:w-[400px] md:h-[280px] rounded-2xl overflow-hidden shrink-0 border border-white/10 shadow-2xl relative group bg-slate-900">
      {item.type === "video" ? (
        <video 
          autoPlay 
          muted 
          loop 
          playsInline 
          poster={item.poster}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        >
          <source src={item.url} type="video/mp4" />
        </video>
      ) : (
        <img 
          src={item.url} 
          alt="Ecomfy Showcase" 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    </div>
  );

  // Create different parallax layers with varying intensities for depth
  const parallaxBg = useMouseParallax(15);
  const parallaxFar = useMouseParallax(30);
  const parallaxMid = useMouseParallax(50);
  const parallaxNear = useMouseParallax(80);

  return (
    <section className="relative w-full overflow-hidden bg-slate-50 text-slate-900 min-h-[100vh] md:min-h-[90vh] flex flex-col justify-center pt-32 pb-24 md:pt-40 md:pb-32">
      
      {/* --- BACKGROUND LAYER: Animated Halos & Gradients --- */}
      <div 
        className="absolute inset-0 overflow-hidden pointer-events-none z-0"
        style={{ transform: `translate3d(${parallaxBg.x}px, ${parallaxBg.y}px, 0)` }}
      >
        {/* Soft floating gradients */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#0E7C66] rounded-full mix-blend-multiply filter blur-[120px] opacity-[0.08] animate-float-slow"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-[#F7C04A] rounded-full mix-blend-multiply filter blur-[140px] opacity-[0.06] animate-float-slower"></div>
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] bg-[#0A5F4F] rounded-full mix-blend-multiply filter blur-[100px] opacity-[0.07] animate-float"></div>
      </div>

      {/* --- FLOATING E-COMMERCE ELEMENTS LAYER --- */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 hidden md:block">
        
        {/* Far layer (deepest, smallest, slowest) */}
        <div style={{ transform: `translate3d(${parallaxFar.x}px, ${parallaxFar.y}px, 0)`, transition: 'transform 0.2s ease-out' }}>
          {/* Sparkles Icon */}
          <div className="absolute top-[25%] left-[10%] w-12 h-12 bg-white/50 backdrop-blur-md border border-white/40 rounded-full shadow-lg flex items-center justify-center animate-pulse-slow">
            <Sparkles className="w-5 h-5 text-[#F7C04A]" />
          </div>
          {/* Mini Data Point */}
          <div className="absolute top-[65%] left-[8%] p-3 bg-white/60 backdrop-blur-md border border-white/50 rounded-xl shadow-lg flex items-center gap-3 opacity-80 rotate-3 animate-float-slow">
            <div className="w-8 h-8 rounded-full bg-[#0E7C66]/10 flex items-center justify-center">
              <PackageCheck className="w-4 h-4 text-[#0E7C66]" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="h-1.5 w-12 bg-slate-200 rounded-full"></div>
              <div className="h-1.5 w-8 bg-slate-200 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Mid layer */}
        <div style={{ transform: `translate3d(${parallaxMid.x}px, ${parallaxMid.y}px, 0)`, transition: 'transform 0.15s ease-out' }}>
          {/* Sale Notification */}
          <div className="absolute top-[35%] right-[5%] p-4 bg-white/70 backdrop-blur-lg border border-white/60 rounded-2xl shadow-xl flex items-center gap-3 -rotate-6 animate-float">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">Paiement reçu</p>
              <p className="text-sm font-bold text-[#0E7C66]">+ 45 000 FCFA</p>
            </div>
          </div>
          {/* Order Badge */}
          <div className="absolute top-[45%] left-[5%] p-3 bg-white/70 backdrop-blur-lg border border-white/60 rounded-xl shadow-xl flex items-center gap-2 rotate-2 animate-float-slower delay-700">
             <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></div>
             <span className="text-xs font-medium text-slate-700">Nouvelle commande en cours...</span>
          </div>
        </div>

        {/* Near layer (largest, fastest parallax) */}
        <div style={{ transform: `translate3d(${parallaxNear.x}px, ${parallaxNear.y}px, 0)`, transition: 'transform 0.1s ease-out' }}>
          {/* Chart Widget */}
          <div className="absolute top-[15%] right-[8%] p-5 bg-white/80 backdrop-blur-xl border border-white shadow-2xl rounded-2xl flex flex-col gap-3 rotate-3 animate-float delay-500 opacity-90">
            <div className="flex items-center justify-between gap-6">
              <span className="text-xs font-medium text-slate-500">Ventes du jour</span>
              <span className="text-xs font-bold text-emerald-500 flex items-center"><TrendingUp className="w-3 h-3 mr-1"/> +24%</span>
            </div>
            <div className="flex items-end gap-1.5 h-12">
              <div className="w-4 bg-slate-100 rounded-sm h-[30%]"></div>
              <div className="w-4 bg-slate-100 rounded-sm h-[50%]"></div>
              <div className="w-4 bg-[#F7C04A]/60 rounded-sm h-[80%]"></div>
              <div className="w-4 bg-[#0E7C66] rounded-sm h-[100%] shadow-sm"></div>
            </div>
          </div>
          
          {/* Cart Icon Highlight */}
          <div className="absolute top-[60%] right-[12%] w-16 h-16 bg-white/90 backdrop-blur-xl border border-white shadow-2xl rounded-2xl flex items-center justify-center -rotate-12 animate-float-slow delay-300">
            <ShoppingCart className="w-7 h-7 text-slate-800" />
            <div className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
              <span className="text-[9px] font-bold text-white">3</span>
            </div>
          </div>
        </div>

      </div>

      {/* --- FOREGROUND CONTENT (Hero Text & CTA) --- */}
      <div className="container relative z-10 mx-auto px-4 md:px-6">
        <div 
          ref={heroRef}
          className={`flex flex-col items-center text-center max-w-4xl mx-auto transition-all duration-1000 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm text-slate-600 text-sm font-semibold mb-8 hover:bg-slate-50 transition-colors cursor-default">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
            </div>
            <span>La plateforme tout-en-un pour vendre en ligne</span>
          </div>

          {/* Headline avec effet Machine à Écrire (Typewriter) */}
          <HeroTypewriter />

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-12 leading-relaxed font-medium">
            Créez votre boutique, concevez vos contenus avec l'IA, gérez vos commandes, votre stock, vos finances et développez vos ventes depuis une seule plateforme.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto relative z-20 pointer-events-auto">
            <Button 
              size="lg" 
              className="bg-[#0E7C66] text-white hover:bg-[#0A5F4F] px-8 py-7 text-lg rounded-full font-bold transition-all hover:scale-105 shadow-[0_0_40px_rgba(14,124,102,0.3)]"
              onMouseEnter={playHoverSound}
              onClick={() => {
                playClickSound();
                navigate("/auth");
              }}
            >
              Commencer gratuitement
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="bg-white/80 backdrop-blur-md border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 px-8 py-7 text-lg rounded-full font-semibold transition-all hover:scale-105 shadow-sm"
              onMouseEnter={playHoverSound}
              onClick={() => {
                playClickSound();
                const el = document.getElementById("solutions");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <ArrowRight className="mr-2 h-5 w-5" />
              Explorer Ecomfy
            </Button>
          </div>
        </div>
      </div>
      {/* Marquee Gallery */}
      <div className={`relative w-full max-w-[100vw] overflow-hidden flex flex-col gap-6 transition-all duration-1000 delay-300 transform ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-24"} mt-20`}>
        
        {/* Overlay Gradients for smooth edges */}
        <div className="absolute inset-y-0 left-0 w-16 md:w-40 bg-gradient-to-r from-slate-50 to-transparent z-20 pointer-events-none"></div>
        <div className="absolute inset-y-0 right-0 w-16 md:w-40 bg-gradient-to-l from-slate-50 to-transparent z-20 pointer-events-none"></div>

        {/* Row 1 - Left to Right (Default scroll) */}
        <div className="flex w-max animate-scroll hover:[animation-play-state:paused]">
          <div className="flex gap-4 md:gap-6 px-2 md:px-3">
            {[...mediaRow1, ...mediaRow1, ...mediaRow1].map((item, idx) => (
              <MediaCard key={`r1-${idx}`} item={item} />
            ))}
          </div>
        </div>

        {/* Row 2 - Right to Left (Reverse scroll) */}
        <div className="flex w-max animate-scroll hover:[animation-play-state:paused]" style={{ animationDirection: "reverse" }}>
          <div className="flex gap-4 md:gap-6 px-2 md:px-3">
            {[...mediaRow2, ...mediaRow2, ...mediaRow2].map((item, idx) => (
              <MediaCard key={`r2-${idx}`} item={item} />
            ))}
          </div>
        </div>

      </div>
      
      {/* Inline styles for custom subtle floating animations */}
      <style>{`
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.15; }
        }
        .animate-cursor-blink {
          animation: cursor-blink 1s ease-in-out infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(2deg); }
        }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-25px); }
        }
        @keyframes float-slower {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(20px); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .animate-float {
            animation: float 6s ease-in-out infinite;
          }
          .animate-float-slow {
            animation: float-slow 12s ease-in-out infinite;
          }
          .animate-float-slower {
            animation: float-slower 18s ease-in-out infinite;
          }
          .animate-pulse-slow {
            animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }
        }
      `}</style>
    </section>
  );
}

