import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Globe, Sparkles, Users, ShoppingBag, Radio, ArrowRight, Play, Heart, MessageCircle,
  Share2, BarChart2, Megaphone, Layers, TrendingUp, CheckCircle2, Store, Video
} from "lucide-react";

export function LandingConnectUsSection() {
  const navigate = useNavigate();

  // Desktop Mouse Parallax State (Max 8px on central sphere)
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [mobileTab, setMobileTab] = useState<'feed' | 'live' | 'ads' | 'trends'>('feed');

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || window.innerWidth < 768) return;
    const { clientX, clientY } = e;
    const target = e.currentTarget.getBoundingClientRect();
    const centerX = target.left + target.width / 2;
    const centerY = target.top + target.height / 2;

    const moveX = ((clientX - centerX) / (target.width / 2)) * 6;
    const moveY = ((clientY - centerY) / (target.height / 2)) * 6;

    setParallax({ x: moveX, y: moveY });
  };

  const handleMouseLeave = () => {
    setParallax({ x: 0, y: 0 });
  };

  return (
    <section id="connectus" className="relative py-12 sm:py-20 md:py-28 overflow-hidden bg-gradient-to-b from-[#EDFDF6] via-emerald-50/40 to-white selection:bg-[#0E7C66] selection:text-white">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[320px] sm:w-[600px] md:w-[850px] h-[300px] sm:h-[450px] md:h-[520px] bg-gradient-to-tr from-emerald-300/25 via-teal-300/15 to-cyan-300/25 blur-[90px] sm:blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute -top-24 -left-12 w-64 sm:w-96 h-64 sm:h-96 bg-emerald-400/10 blur-[90px] sm:blur-[110px] rounded-full pointer-events-none" />
      <div className="absolute bottom-8 -right-12 w-64 sm:w-96 h-64 sm:h-96 bg-teal-400/10 blur-[90px] sm:blur-[110px] rounded-full pointer-events-none" />

      <div className="container relative mx-auto px-4 max-w-7xl">
        {/* Header Badge & Titles */}
        <div className="text-center space-y-3 sm:space-y-3.5 max-w-3xl mx-auto mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-emerald-100/90 border border-emerald-300/80 text-emerald-900 text-[11px] sm:text-xs font-bold shadow-2xs max-w-full">
            <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#0E7C66] shrink-0" />
            <span className="truncate">Une plateforme complète pour l'avenir du digital</span>
            <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#0E7C66] shrink-0" />
          </div>

          <div className="flex items-center justify-center gap-2.5 sm:gap-3 pt-1">
            <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-[#0E7C66] via-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shrink-0">
              <Users className="h-5 w-5 sm:h-7 sm:w-7" />
            </div>
            <h2 className="font-space font-extrabold text-2xl xs:text-3xl sm:text-5xl text-slate-900 tracking-tight">
              Connect<span className="text-[#0E7C66]">Us</span>
            </h2>
          </div>

          <h3 className="font-space font-extrabold text-xl xs:text-2xl sm:text-4xl text-slate-900 leading-tight px-2">
            Connectez. Partagez. <span className="text-[#0E7C66] underline decoration-emerald-400 decoration-wavy decoration-2">Vendez.</span>
          </h3>

          <p className="text-xs xs:text-sm sm:text-base text-slate-600 font-inter leading-relaxed max-w-2xl mx-auto px-2">
            Le réseau social et l'écosystème business d'Ecomfy pour apprendre, échanger, créer, promouvoir et faire grandir votre activité en ligne.
          </p>
        </div>

        {/* ========================================================================= */}
        {/* DESKTOP SHOWCASE CONTAINER (MD & UP ONLY) */}
        {/* ========================================================================= */}
        <div
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="hidden md:flex relative my-6 max-w-6xl mx-auto min-h-[640px] items-center justify-center"
        >
          {/* SVG CONTINENTAL CONNECTIONS BEAMS & TRAVELING DATA PACKETS */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 1000 600" fill="none">
            <path
              id="flow-path-1"
              d="M 140 180 Q 320 100 500 300 T 860 180"
              stroke="url(#beam-emerald)"
              strokeWidth="2.5"
              strokeDasharray="6 6"
              className={prefersReducedMotion ? "" : "animate-[dash_14s_linear_infinite]"}
            />
            <path
              id="flow-path-2"
              d="M 840 440 Q 640 500 500 300 T 160 420"
              stroke="url(#beam-cyan)"
              strokeWidth="2.5"
              strokeDasharray="6 6"
              className={prefersReducedMotion ? "" : "animate-[dash_18s_linear_infinite]"}
            />
            <path
              id="flow-path-3"
              d="M 500 110 Q 420 280 500 490"
              stroke="url(#beam-teal)"
              strokeWidth="2"
              strokeDasharray="5 5"
            />
            <path
              id="flow-path-4"
              d="M 220 260 L 780 340"
              stroke="url(#beam-emerald)"
              strokeWidth="1.8"
              strokeDasharray="4 4"
            />

            {!prefersReducedMotion && (
              <>
                <circle r="4.5" fill="#10B981">
                  <animateMotion path="M 140 180 Q 320 100 500 300 T 860 180" dur="3.8s" repeatCount="indefinite" />
                </circle>
                <circle r="4" fill="#06B6D4">
                  <animateMotion path="M 840 440 Q 640 500 500 300 T 160 420" dur="5.2s" repeatCount="indefinite" />
                </circle>
                <circle r="3.5" fill="#0E7C66">
                  <animateMotion path="M 500 110 Q 420 280 500 490" dur="4.2s" repeatCount="indefinite" />
                </circle>
                <circle r="3.5" fill="#34D399">
                  <animateMotion path="M 220 260 L 780 340" dur="6.5s" repeatCount="indefinite" />
                </circle>
              </>
            )}

            <defs>
              <linearGradient id="beam-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#0E7C66" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#34D399" stopOpacity="0.85" />
              </linearGradient>

              <linearGradient id="beam-cyan" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#0E7C66" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.85" />
              </linearGradient>

              <linearGradient id="beam-teal" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0E7C66" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.8" />
              </linearGradient>
            </defs>
          </svg>

          {/* CENTRAL ANIMATED DARK GREEN NETWORK GLOBE */}
          <div
            style={{
              transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0)`,
              transition: "transform 0.15s ease-out",
            }}
            className="relative z-0 flex items-center justify-center my-6"
          >
            {/* Outer Glowing Atmosphere Rings */}
            <div className="absolute h-[450px] w-[450px] rounded-full bg-emerald-400/20 blur-3xl animate-pulse" />
            <div className={`absolute h-[480px] w-[480px] rounded-full border border-emerald-400/30 ${prefersReducedMotion ? "" : "animate-[spin_45s_linear_infinite]"}`} />

            {/* Central Dark Emerald Network Container */}
            <div className="relative h-[410px] w-[410px] rounded-full bg-gradient-to-b from-[#06382C] via-[#084738] to-[#03231B] shadow-[0_0_100px_rgba(14,124,102,0.5)] border-4 border-emerald-400/40 overflow-hidden flex items-center justify-center">
              
              {/* Matrix Dot Grid Overlay */}
              <div className={`absolute inset-0 opacity-40 bg-[radial-gradient(#34D399_1.2px,transparent_1.2px)] [background-size:20px_20px] ${prefersReducedMotion ? "" : "animate-[spin_60s_linear_infinite]"}`} />

              {/* Real World Map Image (Realistic Earth Spherical Center) */}
              <div className={`relative h-64 w-64 rounded-full bg-[url('https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?w=900&auto=format&fit=crop&q=80')] bg-cover shadow-2xl border-2 border-emerald-300/40 ${prefersReducedMotion ? "" : "animate-[spin_38s_linear_infinite]"}`}>
                {/* Atmosphere Overlay */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500/30 via-transparent to-cyan-400/40 mix-blend-overlay" />
              </div>

              {/* Pulsing Intercontinental Connection Nodes on Sphere */}
              <div className="absolute top-1/4 left-1/3 h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_10px_#10B981] animate-ping" />
              <div className="absolute top-1/2 right-1/4 h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#06B6D4] animate-ping" style={{ animationDelay: "1.2s" }} />
              <div className="absolute bottom-1/3 left-1/2 h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_10px_#F59E0B] animate-ping" style={{ animationDelay: "2.4s" }} />
            </div>

            {/* 6 FLOATING PERSONAS & FEATURE BADGES */}
            
            {/* Persona 1: Top Center Avatar */}
            <div className="absolute -top-3 left-[32%] z-20">
              <div className="h-16 w-16 rounded-full ring-4 ring-emerald-400/80 shadow-2xl overflow-hidden border-2 border-white">
                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80" alt="" className="h-full w-full object-cover" />
              </div>
            </div>

            {/* Feature Badge 1: Top Right Community Icon */}
            <div className="absolute top-2 right-[32%] z-20">
              <div className="h-11 w-11 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg border-2 border-white">
                <Users className="h-5 w-5" />
              </div>
            </div>

            {/* Feature Badge 2: Mid-Left Video Camera Badge */}
            <div className="absolute top-[42%] -left-8 z-20">
              <div className="h-12 w-12 rounded-full bg-[#0E7C66] text-white flex items-center justify-center shadow-xl border-2 border-white">
                <Video className="h-6 w-6" />
              </div>
            </div>

            {/* Persona 2: Bottom-Left Woman Avatar */}
            <div className="absolute bottom-4 left-14 z-20">
              <div className="h-20 w-20 rounded-full ring-4 ring-teal-400/80 shadow-2xl overflow-hidden border-2 border-white">
                <img src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80" alt="" className="h-full w-full object-cover" />
              </div>
            </div>

            {/* Persona 3: Bottom-Right Smiling Woman Avatar */}
            <div className="absolute bottom-6 right-24 z-20">
              <div className="h-20 w-20 rounded-full ring-4 ring-amber-400/90 shadow-2xl overflow-hidden border-2 border-white">
                <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80" alt="" className="h-full w-full object-cover" />
              </div>
            </div>

            {/* Persona 4: Far Right Smiling Man Avatar */}
            <div className="absolute top-[40%] -right-8 z-20">
              <div className="h-18 w-18 rounded-full ring-4 ring-cyan-400/80 shadow-2xl overflow-hidden border-2 border-white">
                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80" alt="" className="h-full w-full object-cover" />
              </div>
            </div>
          </div>

          {/* STATIC & CRISP UI CARDS ON DESKTOP */}

          {/* 1. TOP LEFT CARD: NATIVE CONNECTUS POST PAGE */}
          <div className="absolute top-2 left-2 z-20 w-72 bg-white rounded-3xl p-4 border border-slate-200/90 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80" alt="" className="h-9 w-9 rounded-xl object-cover ring-2 ring-[#0E7C66]" />
                <div>
                  <div className="flex items-center gap-1">
                    <h4 className="font-bold text-xs text-slate-900">Amina Traoré</h4>
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#0E7C66] fill-[#0E7C66] text-white" />
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">Entrepreneure • Abidjan</p>
                </div>
              </div>
              <Badge className="bg-emerald-50 text-[#0E7C66] border-emerald-200 text-[9px] font-bold">ConnectUs</Badge>
            </div>

            <p className="text-xs text-slate-700 leading-snug font-inter">
              Découvrez ma nouvelle collection de sacs tendance !
            </p>

            <div className="grid grid-cols-2 gap-1.5 rounded-2xl overflow-hidden">
              <img src="https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&auto=format&fit=crop&q=80" alt="" className="h-20 w-full object-cover" />
              <img src="https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&auto=format&fit=crop&q=80" alt="" className="h-20 w-full object-cover" />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold pt-1 border-t border-slate-100">
              <span className="flex items-center gap-1 text-emerald-700">
                <Heart className="h-3.5 w-3.5 fill-emerald-600" /> 1,2 K
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5" /> 245
              </span>
              <span className="flex items-center gap-1">
                <Share2 className="h-3.5 w-3.5" /> Partager
              </span>
            </div>
          </div>

          {/* 2. BOTTOM LEFT CARD: BUSINESS MANAGER */}
          <div className="absolute bottom-2 left-2 z-20 w-64 bg-white rounded-3xl p-4 border border-slate-200/90 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-[#0E7C66] font-bold text-xs font-space">
              <BarChart2 className="h-4 w-4 text-[#0E7C66]" />
              <span>Business Manager</span>
            </div>

            <div className="space-y-2 text-xs font-medium text-slate-700">
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-50">
                <Users className="h-3.5 w-3.5 text-blue-500" />
                <span>Audience</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-50">
                <Megaphone className="h-3.5 w-3.5 text-amber-500" />
                <span>Campagnes publicitaires</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-50">
                <BarChart2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Statistiques</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-50">
                <Layers className="h-3.5 w-3.5 text-indigo-500" />
                <span>Gestion des pages</span>
              </div>
            </div>
          </div>

          {/* 3. TOP RIGHT CARD: LIVE COMMERCE */}
          <div className="absolute top-2 right-2 z-20 w-72 bg-white rounded-3xl p-4 border border-slate-200/90 shadow-xl space-y-3">
            <div className="relative rounded-2xl overflow-hidden aspect-video bg-slate-900">
              <img src="https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80" alt="" className="h-full w-full object-cover opacity-80" />
              <div className="absolute top-2 left-2 bg-rose-600 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
                <Radio className="h-3 w-3 animate-pulse" /> Live
              </div>
              <div className="absolute top-2 right-2 bg-slate-950/70 text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-xs">
                <span>👁️ 1 245</span>
              </div>
            </div>

            <div>
              <p className="font-bold text-xs text-slate-900 leading-snug">
                Découverte de nos nouveaux produits naturels
              </p>
            </div>

            <Button size="sm" className="w-full rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs gap-1.5 shadow-sm">
              <ShoppingBag className="h-3.5 w-3.5" /> Acheter maintenant
            </Button>
          </div>

          {/* 4. BOTTOM RIGHT CARD: TENDANCES */}
          <div className="absolute bottom-2 right-2 z-20 w-64 bg-white rounded-3xl p-4 border border-slate-200/90 shadow-xl space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs font-space">
              <TrendingUp className="h-4 w-4 text-amber-500" />
              <span>Tendances</span>
            </div>

            <div className="space-y-2 text-xs font-semibold">
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-emerald-50 text-emerald-800">
                <Store className="h-3.5 w-3.5" />
                <span>E-commerce</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-purple-50 text-purple-800">
                <Megaphone className="h-3.5 w-3.5" />
                <span>Marketing digital</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-blue-50 text-blue-800">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Intelligence artificielle</span>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-amber-50 text-amber-800">
                <Users className="h-3.5 w-3.5" />
                <span>Entrepreneuriat</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MOBILE SHOWCASE & RESPONSIVE GRID (SUB-MD ONLY: PHONES & TABLETS) */}
        {/* ========================================================================= */}
        <div className="block md:hidden space-y-6 my-6">
          
          {/* Mobile Central Globe Network Display with Tight Orbit Wrapper */}
          <div className="relative py-2 flex flex-col items-center justify-center">
            
            {/* Globe Orbit Box (Fixed 280px to 320px wrapper for tight avatar alignment) */}
            <div className="relative w-[280px] h-[280px] xs:w-[320px] xs:h-[320px] mx-auto flex items-center justify-center">
              
              {/* Outer Glow Ring */}
              <div className="absolute h-52 w-52 xs:h-60 xs:w-60 rounded-full bg-emerald-400/20 blur-2xl animate-pulse" />

              {/* Central Globe Container */}
              <div className="relative h-44 w-44 xs:h-52 xs:w-52 rounded-full bg-gradient-to-b from-[#06382C] via-[#084738] to-[#03231B] shadow-[0_0_50px_rgba(14,124,102,0.45)] border-4 border-emerald-400/40 overflow-hidden flex items-center justify-center">
                {/* Dot Grid */}
                <div className={`absolute inset-0 opacity-40 bg-[radial-gradient(#34D399_1.2px,transparent_1.2px)] [background-size:16px_16px] ${prefersReducedMotion ? "" : "animate-[spin_50s_linear_infinite]"}`} />
                
                {/* Rotating Earth Spherical Image */}
                <div className={`relative h-28 w-28 xs:h-34 xs:w-34 rounded-full bg-[url('https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?w=900&auto=format&fit=crop&q=80')] bg-cover shadow-xl border border-emerald-300/40 ${prefersReducedMotion ? "" : "animate-[spin_32s_linear_infinite]"}`}>
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-500/30 via-transparent to-cyan-400/40 mix-blend-overlay" />
                </div>

                {/* Pulsing Intercontinental Connection Nodes */}
                <div className="absolute top-1/4 left-1/3 h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_8px_#10B981] animate-ping" />
                <div className="absolute top-1/2 right-1/4 h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_8px_#06B6D4] animate-ping" style={{ animationDelay: "1.2s" }} />
                <div className="absolute bottom-1/3 left-1/2 h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_#F59E0B] animate-ping" style={{ animationDelay: "2.4s" }} />
              </div>

              {/* 5 FLOATING ORBITING AVATARS & BADGES (POSITIONED RELATIVE TO 320PX BOX) */}

              {/* Avatar 1: Top Left */}
              <div className="absolute top-1 left-2 z-10">
                <div className="h-10 w-10 xs:h-12 xs:w-12 rounded-full ring-2 ring-emerald-400/90 shadow-lg overflow-hidden border border-white">
                  <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80" alt="" className="h-full w-full object-cover" />
                </div>
              </div>

              {/* Badge 1: Top Right Users */}
              <div className="absolute top-2 right-2 z-10">
                <div className="h-9 w-9 xs:h-10 xs:w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md border border-white">
                  <Users className="h-4.5 w-4.5" />
                </div>
              </div>

              {/* Badge 2: Mid-Left Live Video */}
              <div className="absolute top-1/2 -translate-y-1/2 -left-1 z-10">
                <div className="h-9 w-9 xs:h-10 xs:w-10 rounded-full bg-[#0E7C66] text-white flex items-center justify-center shadow-md border border-white">
                  <Video className="h-4.5 w-4.5" />
                </div>
              </div>

              {/* Avatar 2: Bottom Left */}
              <div className="absolute bottom-2 left-2 z-10">
                <div className="h-10 w-10 xs:h-12 xs:w-12 rounded-full ring-2 ring-teal-400/90 shadow-lg overflow-hidden border border-white">
                  <img src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80" alt="" className="h-full w-full object-cover" />
                </div>
              </div>

              {/* Avatar 3: Bottom Right */}
              <div className="absolute bottom-2 right-2 z-10">
                <div className="h-10 w-10 xs:h-12 xs:w-12 rounded-full ring-2 ring-amber-400/90 shadow-lg overflow-hidden border border-white">
                  <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80" alt="" className="h-full w-full object-cover" />
                </div>
              </div>

              {/* Avatar 4: Mid-Right */}
              <div className="absolute top-1/2 -translate-y-1/2 -right-1 z-10">
                <div className="h-9 w-9 xs:h-10 xs:w-10 rounded-full ring-2 ring-cyan-400/90 shadow-lg overflow-hidden border border-white">
                  <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80" alt="" className="h-full w-full object-cover" />
                </div>
              </div>
            </div>

            {/* Mobile Active Network Pill */}
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-[10px] xs:text-xs font-bold shadow-md">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span>🔥 +10 000 Entrepreneurs connectés en direct</span>
            </div>
          </div>

          {/* Interactive Mobile Feature Tab Selector */}
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-full overflow-x-auto no-scrollbar max-w-full">
              <button
                type="button"
                onClick={() => setMobileTab('feed')}
                className={`flex-1 min-w-[75px] py-1.5 px-2.5 rounded-full text-[11px] font-bold transition-all text-center shrink-0 ${
                  mobileTab === 'feed'
                    ? 'bg-[#0E7C66] text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                📱 Fil Social
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('live')}
                className={`flex-1 min-w-[75px] py-1.5 px-2.5 rounded-full text-[11px] font-bold transition-all text-center shrink-0 ${
                  mobileTab === 'live'
                    ? 'bg-[#0E7C66] text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                🎥 Live
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('ads')}
                className={`flex-1 min-w-[75px] py-1.5 px-2.5 rounded-full text-[11px] font-bold transition-all text-center shrink-0 ${
                  mobileTab === 'ads'
                    ? 'bg-[#0E7C66] text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                📊 Ads & Manager
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('trends')}
                className={`flex-1 min-w-[75px] py-1.5 px-2.5 rounded-full text-[11px] font-bold transition-all text-center shrink-0 ${
                  mobileTab === 'trends'
                    ? 'bg-[#0E7C66] text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                🔥 Tendances
              </button>
            </div>

            {/* Focused Active Mobile Tab Card View */}
            <div className="transition-all duration-300">
              {mobileTab === 'feed' && (
                <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-emerald-100/90 shadow-md space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80" alt="" className="h-9 w-9 rounded-xl object-cover ring-2 ring-[#0E7C66]" />
                      <div>
                        <div className="flex items-center gap-1">
                          <h4 className="font-bold text-xs text-slate-900">Amina Traoré</h4>
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#0E7C66] fill-[#0E7C66] text-white" />
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium">Entrepreneure • Abidjan</p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-50 text-[#0E7C66] border-emerald-200 text-[10px] font-bold px-2 py-0.5">Fil ConnectUs</Badge>
                  </div>

                  <p className="text-xs text-slate-700 leading-snug font-inter">
                    Découvrez ma nouvelle collection de sacs tendance disponibles sur ma boutique Ecomfy !
                  </p>

                  <div className="grid grid-cols-2 gap-1.5 rounded-xl overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&auto=format&fit=crop&q=80" alt="" className="h-24 w-full object-cover" />
                    <img src="https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=400&auto=format&fit=crop&q=80" alt="" className="h-24 w-full object-cover" />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold pt-1 border-t border-slate-100">
                    <span className="flex items-center gap-1 text-emerald-700">
                      <Heart className="h-4 w-4 fill-emerald-600 text-emerald-600" /> 1 240
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-4 w-4" /> 245
                    </span>
                    <span className="flex items-center gap-1">
                      <Share2 className="h-4 w-4" /> Partager
                    </span>
                  </div>
                </div>
              )}

              {mobileTab === 'live' && (
                <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-emerald-100/90 shadow-md space-y-3">
                  <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-900">
                    <img src="https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80" alt="" className="h-full w-full object-cover opacity-80" />
                    <div className="absolute top-2 left-2 bg-rose-600 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
                      <Radio className="h-3 w-3 animate-pulse" /> Live Shopping
                    </div>
                    <div className="absolute top-2 right-2 bg-slate-950/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-xs">
                      <span>👁️ 1 245 spectateurs</span>
                    </div>
                  </div>

                  <div>
                    <p className="font-bold text-xs text-slate-900 leading-snug">
                      Vente en Direct : Découverte des nouveautés cosmétiques & mode
                    </p>
                  </div>

                  <Button size="sm" onClick={() => navigate("/connectus")} className="w-full rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs gap-1.5 h-9">
                    <ShoppingBag className="h-4 w-4" /> Rejoindre le Live Commerce
                  </Button>
                </div>
              )}

              {mobileTab === 'ads' && (
                <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-emerald-100/90 shadow-md space-y-3">
                  <div className="flex items-center gap-2 text-[#0E7C66] font-bold text-xs font-space">
                    <BarChart2 className="h-4 w-4 text-[#0E7C66]" />
                    <span>Ecomfy Business Manager & Ads</span>
                  </div>

                  <p className="text-xs text-slate-600">
                    Propulsez vos produits avec des campagnes publicitaires ciblées et suivez vos ventes en temps réel.
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-700">
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <Users className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="text-xs font-bold">Ciblage d'Audience</span>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <Megaphone className="h-4 w-4 text-amber-500 shrink-0" />
                      <span className="text-xs font-bold">Publicités Spons.</span>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <BarChart2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="text-xs font-bold">Analytique Ventes</span>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <Layers className="h-4 w-4 text-indigo-500 shrink-0" />
                      <span className="text-xs font-bold">Pages de Ventes</span>
                    </div>
                  </div>
                </div>
              )}

              {mobileTab === 'trends' && (
                <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 border border-emerald-100/90 shadow-md space-y-3">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs font-space">
                    <TrendingUp className="h-4 w-4 text-amber-500" />
                    <span>Tendances & Thématiques Populaires</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-100">
                      <Store className="h-4 w-4 shrink-0" />
                      <span className="text-xs">#E-commerce</span>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-purple-50 text-purple-800 border border-purple-100">
                      <Megaphone className="h-4 w-4 shrink-0" />
                      <span className="text-xs">#SocialAds</span>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 text-blue-800 border border-blue-100">
                      <Sparkles className="h-4 w-4 shrink-0" />
                      <span className="text-xs">#IABusiness</span>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-100">
                      <Users className="h-4 w-4 shrink-0" />
                      <span className="text-xs">#Communaute</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick 2x2 Feature Summary Cards Grid for full overview */}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setMobileTab('feed')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  mobileTab === 'feed'
                    ? 'bg-emerald-50/90 border-[#0E7C66] ring-1 ring-[#0E7C66]'
                    : 'bg-white border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                  <Users className="h-3.5 w-3.5 text-[#0E7C66]" />
                  <span className="truncate">Fil ConnectUs</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">Partagez vos offres</p>
              </button>

              <button
                type="button"
                onClick={() => setMobileTab('live')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  mobileTab === 'live'
                    ? 'bg-emerald-50/90 border-[#0E7C66] ring-1 ring-[#0E7C66]'
                    : 'bg-white border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                  <Radio className="h-3.5 w-3.5 text-rose-500" />
                  <span className="truncate">Live Commerce</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">Ventes en direct</p>
              </button>

              <button
                type="button"
                onClick={() => setMobileTab('ads')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  mobileTab === 'ads'
                    ? 'bg-emerald-50/90 border-[#0E7C66] ring-1 ring-[#0E7C66]'
                    : 'bg-white border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                  <BarChart2 className="h-3.5 w-3.5 text-[#0E7C66]" />
                  <span className="truncate">Business Ads</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">Publicités & Stats</p>
              </button>

              <button
                type="button"
                onClick={() => setMobileTab('trends')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  mobileTab === 'trends'
                    ? 'bg-emerald-50/90 border-[#0E7C66] ring-1 ring-[#0E7C66]'
                    : 'bg-white border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                  <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                  <span className="truncate">Tendances</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">Sujets chauds</p>
              </button>
            </div>
          </div>

        </div>

        {/* Floating Glassmorphism Stat Cards Row (Fluid 1-col on phone, 3-col on desktop) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-4xl mx-auto my-6 sm:my-10">
          <div className="bg-white/90 backdrop-blur-md border border-emerald-200/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 flex items-center gap-3 shadow-xs">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-emerald-100 text-[#0E7C66] flex items-center justify-center shrink-0">
              <Users className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">Des millions de connexions</h4>
              <p className="text-[10px] sm:text-xs text-slate-500">Réseau social natif d'entrepreneurs</p>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-md border border-emerald-200/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 flex items-center gap-3 shadow-xs">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-emerald-100 text-[#0E7C66] flex items-center justify-center shrink-0">
              <Globe className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">Une communauté internationale</h4>
              <p className="text-[10px] sm:text-xs text-slate-500">Membres & vendeurs de toute l'Afrique</p>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-md border border-emerald-200/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 flex items-center gap-3 shadow-xs">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl bg-emerald-100 text-[#0E7C66] flex items-center justify-center shrink-0">
              <BarChart2 className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-xs sm:text-sm text-slate-900">Plus d'opportunités</h4>
              <p className="text-[10px] sm:text-xs text-slate-500">Social Commerce & Ventes directes</p>
            </div>
          </div>
        </div>

        {/* Bottom CTA Action Buttons & Sub-pills */}
        <div className="text-center space-y-4 sm:space-y-6 pt-2 sm:pt-4">
          <div className="flex flex-col xs:flex-row items-center justify-center gap-3 sm:gap-4 max-w-md mx-auto xs:max-w-none">
            <Button
              onClick={() => navigate("/connectus")}
              size="lg"
              className="w-full xs:w-auto rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-extrabold text-xs sm:text-sm px-7 sm:px-8 h-11 sm:h-12 shadow-md hover:shadow-lg transition-all gap-2 btn-interactive"
            >
              <span>Rejoindre ConnectUs</span>
              <ArrowRight className="h-4 w-4" />
            </Button>

            <Button
              onClick={() => navigate("/connectus")}
              variant="outline"
              size="lg"
              className="w-full xs:w-auto rounded-full border-slate-300 hover:border-[#0E7C66] text-slate-800 font-bold text-xs sm:text-sm px-6 sm:px-7 h-11 sm:h-12 gap-2 shadow-xs"
            >
              <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-slate-800" />
              <span>Découvrir les avantages</span>
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[11px] sm:text-xs font-bold text-slate-600 pt-1">
            <span>Apprenez</span>
            <span className="text-emerald-500">•</span>
            <span>Échangez</span>
            <span className="text-emerald-500">•</span>
            <span>Créez</span>
            <span className="text-emerald-500">•</span>
            <span>Vendez</span>
            <span className="text-emerald-500">•</span>
            <span>Grandissez</span>
          </div>
        </div>
      </div>
    </section>
  );
}
