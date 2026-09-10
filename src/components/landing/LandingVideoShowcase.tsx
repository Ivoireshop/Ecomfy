import React, { useState, useRef, useEffect } from "react";
import { 
  Volume2, 
  VolumeX, 
  Sparkles, 
  ArrowRight, 
  TrendingUp, 
  Zap, 
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useScrollReveal } from "@/hooks/useScrollReveal";

export function LandingVideoShowcase() {
  const navigate = useNavigate();
  const { ref, isVisible } = useScrollReveal({ threshold: 0.15 });
  const [isMuted, setIsMuted] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const vimeoVideoId = "1225512009";

  // URL tuned for Mobile PWA / Safari / Chrome autoplay compatibility
  const embedUrl = `https://player.vimeo.com/video/${vimeoVideoId}?autoplay=1&muted=1&loop=1&autopause=0&playsinline=1&dnt=1&transparent=0&title=0&byline=0&portrait=0&badge=0&controls=0`;

  const triggerVimeoPlay = () => {
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ method: "setVolume", value: isMuted ? "0" : "1" }),
          "*"
        );
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ method: "play" }),
          "*"
        );
      } catch (_) {}
    }
  };

  // Multi-pass play trigger to overcome mobile Safari / Android Webview autoplay restrictions
  useEffect(() => {
    triggerVimeoPlay();
    const t1 = setTimeout(triggerVimeoPlay, 500);
    const t2 = setTimeout(triggerVimeoPlay, 1500);
    const t3 = setTimeout(triggerVimeoPlay, 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isMuted]);

  // Dynamic sound toggle using Vimeo postMessage API (no iframe reload)
  const toggleSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            method: "setVolume",
            value: nextMuted ? "0" : "1"
          }),
          "*"
        );
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            method: "play"
          }),
          "*"
        );
      } catch (err) {
        console.warn("Vimeo postMessage error:", err);
      }
    }
  };

  // Ensure playback starts immediately upon iframe load
  const handleIframeLoad = () => {
    triggerVimeoPlay();
  };

  return (
    <section className="py-16 md:py-24 bg-slate-950 text-white relative overflow-hidden border-y border-slate-800/80">
      {/* Dynamic Background Glowing Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-teal-500/10 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div 
          ref={ref}
          className={`transition-all duration-1000 transform ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
          }`}
        >
          {/* Section Badge & Title */}
          <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm font-semibold mb-4 backdrop-blur-md">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Présentation Vidéo Ecomfy</span>
            </div>
            
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight mb-4">
              Pourquoi utiliser <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500">Ecomfy</span> pour votre Business ?
            </h2>
            
            <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
              Découvrez en moins de 2 minutes ce que vous gagnez en propulsant vos ventes avec notre plateforme e-commerce tout-en-un.
            </p>
          </div>

          {/* Main Video Frame & Player */}
          <div className="max-w-5xl mx-auto mb-16">
            <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 shadow-[0_0_50px_rgba(16,185,129,0.15)] group">
              
              {/* Aspect Ratio 16:9 Container */}
              <div 
                onClick={triggerVimeoPlay}
                onTouchStart={triggerVimeoPlay}
                className="relative w-full aspect-video bg-slate-950 overflow-hidden cursor-pointer"
              >
                
                {/* Embedded Video Player - Autoplay without controls freeze */}
                <iframe
                  ref={iframeRef}
                  src={embedUrl}
                  title="Présentation Ecomfy"
                  className="w-full h-full border-0 rounded-2xl sm:rounded-3xl relative z-10 scale-105 pointer-events-auto"
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  onLoad={handleIframeLoad}
                  // @ts-ignore
                  playsInline
                  // @ts-ignore
                  webkit-playsinline="true"
                />

                {/* Sound Toggle Control Only */}
                <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleSound}
                    className="flex items-center gap-2 bg-slate-950/90 hover:bg-emerald-600/90 text-white backdrop-blur-md px-4 py-2 rounded-full border border-slate-700/80 text-xs sm:text-sm font-semibold transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer pointer-events-auto"
                    title={isMuted ? "Activer le son" : "Couper le son"}
                  >
                    {isMuted ? (
                      <>
                        <VolumeX className="w-4 h-4 text-amber-400" />
                        <span>Activer le son</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 text-emerald-400" />
                        <span>Son activé</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Key Advantages Grid ("Qu'est-ce que tu gagnes ?") */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md hover:border-emerald-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Boutique Prête en 2 Min</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Créez une vitrine ultra-professionnelle optimisée mobile sans savoir coder. Vendez immédiatement par WhatsApp et Mobile Money.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md hover:border-emerald-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">IA Publicitaire Intégrée</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Générez automatiquement des visuels HD, des vidéos animées pour TikTok/Facebook Ads et des fiches produits captivantes.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md hover:border-emerald-500/40 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Ecomfy Livraison & Encaissements</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Gérez l'expédition de vos colis, suivez l'argent collecté à la livraison (COD) et assurez le virement sécurisé vers votre compte.
              </p>
            </div>
          </div>

          {/* CTA Banner */}
          <div className="text-center">
            <Button
              onClick={() => navigate("/auth?mode=signup")}
              size="lg"
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-8 py-6 rounded-full text-base sm:text-lg shadow-[0_0_30px_rgba(16,185,129,0.3)] hover:shadow-[0_0_40px_rgba(16,185,129,0.5)] transition-all hover:scale-105"
            >
              <span>Lancer ma boutique maintenant</span>
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>

        </div>
      </div>
    </section>
  );
}
