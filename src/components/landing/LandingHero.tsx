import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import heroDesktop from "@/assets/hero-desktop-dashboard.jpg";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { useSoundIdentity } from "@/hooks/useSoundIdentity";

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

  return (
    <section className="relative w-full overflow-hidden bg-[#0a0f18] text-white pt-32 pb-24 md:pt-40 md:pb-32">
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#0E7C66] rounded-full mix-blend-screen filter blur-[150px] opacity-15"></div>
      </div>

      <div className="container relative z-10 mx-auto px-4 md:px-6 mb-20">
        <div 
          ref={heroRef}
          className={`flex flex-col items-center text-center max-w-4xl mx-auto transition-all duration-1000 transform ${isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"}`}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-slate-300 text-sm font-semibold mb-8 backdrop-blur-md hover:bg-white/10 transition-colors cursor-default">
            <Sparkles className="w-4 h-4 text-[#F7C04A]" />
            <span>Le système d'exploitation du e-commerce moderne</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[1.05] mb-8 text-white">
            Tout pour <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0E7C66] to-[#4ADE80]">vendre.</span><br />
            Simplement.
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            Ecomfy réunit la création de boutique, la génération de visuels IA, la gestion des stocks et les paiements en une seule plateforme premium.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center w-full sm:w-auto">
            <Button 
              size="lg" 
              className="bg-[#0E7C66] text-white hover:bg-[#0A5F4F] px-8 py-7 text-lg rounded-full font-bold transition-all hover:scale-105 shadow-[0_0_40px_rgba(14,124,102,0.4)]"
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
              className="bg-white/5 border-white/20 text-white hover:bg-white/10 px-8 py-7 text-lg rounded-full font-semibold backdrop-blur-sm transition-all hover:scale-105"
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
      <div className={`relative w-full max-w-[100vw] overflow-hidden flex flex-col gap-6 transition-all duration-1000 delay-300 transform ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-24"}`}>
        
        {/* Overlay Gradients for smooth edges */}
        <div className="absolute inset-y-0 left-0 w-16 md:w-40 bg-gradient-to-r from-[#0a0f18] to-transparent z-20 pointer-events-none"></div>
        <div className="absolute inset-y-0 right-0 w-16 md:w-40 bg-gradient-to-l from-[#0a0f18] to-transparent z-20 pointer-events-none"></div>

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
    </section>
  );
}
