import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Trophy, 
  Gift, 
  X, 
  ChevronUp, 
  Video, 
  ArrowRight,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface DashboardVideoBannerProps {
  firstName?: string;
}

export function DashboardVideoBanner({ firstName = "Cher Vendeur" }: DashboardVideoBannerProps) {
  const navigate = useNavigate();
  const STORAGE_KEY = "ecomfy_dashboard_video_dismissed_v1";

  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const vimeoVideoId = "1225512009";

  // Fixed background embed URL that NEVER changes, preventing iframe reloads or poster freezes
  const embedUrl = `https://player.vimeo.com/video/${vimeoVideoId}?background=1&autoplay=1&muted=1&loop=1&autopause=0&playsinline=1&dnt=1&transparent=0&title=0&byline=0&portrait=0&badge=0`;

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (dismissed === "true") {
        setIsMinimized(true);
      }
    } catch (e) {
      console.warn("Could not read localStorage for video banner:", e);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
  };

  const handleToggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

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

  const handleIframeLoad = () => {
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ method: "setVolume", value: "0" }),
          "*"
        );
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ method: "play" }),
          "*"
        );
      } catch (_) {}
    }
  };

  if (isDismissed) {
    return (
      <div className="mb-6 flex justify-end">
        <button
          onClick={() => {
            setIsDismissed(false);
            setIsMinimized(false);
          }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/20 text-xs font-semibold transition-all shadow-xs"
        >
          <Video className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
          <span>Revoir la vidéo explicative (Bonus & Trophées)</span>
        </button>
      </div>
    );
  }

  if (isMinimized) {
    return (
      <div className="mb-6 bg-slate-900 border border-emerald-500/30 text-white rounded-2xl p-4 flex items-center justify-between shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Vidéo de Découverte Ecomfy</span>
              <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                Trophée & Bonus
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Découvrez comment booster vos ventes et recevoir nos récompenses mensuelles.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleToggleMinimize}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-full px-4"
          >
            <Play className="w-3.5 h-3.5 mr-1 fill-slate-950" /> Regarder
          </Button>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-800"
            title="Masquer la vidéo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 rounded-2xl md:rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 border border-emerald-500/30 shadow-[0_10px_40px_rgba(14,124,102,0.2)] p-5 md:p-7 text-white relative overflow-hidden transition-all">
      {/* Background Decorative Glows */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/10 blur-[90px] rounded-full pointer-events-none" />

      {/* Top Banner Control Bar */}
      <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-3 relative z-10">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Vidéo Officielle Ecomfy</span>
          </div>
          <span className="hidden sm:inline-block text-xs text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2.5 py-0.5 rounded-full font-medium">
            🏆 Bonus Vendeurs & Trophée du Mois
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleToggleMinimize}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors text-xs font-medium flex items-center gap-1"
            title="Réduire le lecteur"
          >
            <ChevronUp className="w-4 h-4" />
            <span className="hidden sm:inline">Réduire</span>
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-colors"
            title="Ne plus afficher"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
        
        {/* Left Column: Text & Advantages */}
        <div className="lg:col-span-7 space-y-4">
          <div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-snug">
              Bienvenue sur votre Espace, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">{firstName}</span> ! 🚀
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mt-2">
              Regardez cette vidéo de présentation pour découvrir comment maximiser votre chiffre d'affaires, débloquer des bonus exclusifs et faire partie des **Meilleurs Vendeurs du Mois** pour remporter nos trophées officiels !
            </p>
          </div>

          {/* Quick Perks Badge List */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs pt-1">
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-slate-200 font-semibold text-[11px]">Trophée Meilleur Vendeur</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2">
              <Gift className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-slate-200 font-semibold text-[11px]">Bonus & Cadeaux</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-400 shrink-0" />
              <span className="text-slate-200 font-semibold text-[11px]">Boost des Ventes IA</span>
            </div>
          </div>

          {/* Sound & Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={toggleSound}
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-emerald-600 text-white border border-slate-700 hover:border-emerald-500 text-xs font-semibold px-4 py-2 rounded-full transition-all shadow-sm cursor-pointer"
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

            <Button
              size="sm"
              onClick={() => navigate("/studio")}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-full px-5 py-2"
            >
              <span>Créer des produits avec l'IA</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>

        {/* Right Column: Vimeo Video Player with background=1 Autoplay */}
        <div className="lg:col-span-5">
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-emerald-500/40 shadow-2xl aspect-video group">
            <iframe
              ref={iframeRef}
              src={embedUrl}
              title="Présentation Ecomfy Vendeurs"
              className="w-full h-full border-0 rounded-2xl relative z-10 scale-105 pointer-events-none"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              onLoad={handleIframeLoad}
              // @ts-ignore
              playsInline
              // @ts-ignore
              webkit-playsinline="true"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
