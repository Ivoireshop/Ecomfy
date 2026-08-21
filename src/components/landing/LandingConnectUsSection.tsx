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

  // Desktop Mouse Parallax State (Max 8px on globe only)
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check system preference for reduced motion
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

    const moveX = ((clientX - centerX) / (target.width / 2)) * 6; // Max 6px
    const moveY = ((clientY - centerY) / (target.height / 2)) * 6; // Max 6px

    setParallax({ x: moveX, y: moveY });
  };

  const handleMouseLeave = () => {
    setParallax({ x: 0, y: 0 });
  };

  return (
    <section id="connectus" className="relative py-20 md:py-28 overflow-hidden bg-gradient-to-b from-[#F0FDF4] via-emerald-50/30 to-white selection:bg-[#0E7C66] selection:text-white">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[850px] h-[520px] bg-gradient-to-tr from-emerald-300/25 via-teal-300/15 to-cyan-300/25 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute -top-24 left-8 w-96 h-96 bg-emerald-400/10 blur-[110px] rounded-full pointer-events-none" />
      <div className="absolute bottom-8 right-8 w-96 h-96 bg-teal-400/10 blur-[110px] rounded-full pointer-events-none" />

      <div className="container relative mx-auto px-4 max-w-7xl">
        {/* Header Badge & Titles */}
        <div className="text-center space-y-3.5 max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100/90 border border-emerald-300/80 text-emerald-900 text-xs font-bold shadow-2xs">
            <Sparkles className="h-3.5 w-3.5 text-[#0E7C66]" />
            <span>Une plateforme complète pour l'avenir du digital</span>
            <Sparkles className="h-3.5 w-3.5 text-[#0E7C66]" />
          </div>

          <div className="flex items-center justify-center gap-3 pt-1">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-gradient-to-tr from-[#0E7C66] via-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md">
              <Users className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <h2 className="font-space font-extrabold text-3xl sm:text-5xl text-slate-900 tracking-tight">
              Connect<span className="text-[#0E7C66]">Us</span>
            </h2>
          </div>

          <h3 className="font-space font-extrabold text-2xl sm:text-4xl text-slate-900 leading-tight">
            Connectez. Partagez. <span className="text-[#0E7C66] underline decoration-emerald-400 decoration-wavy decoration-2">Vendez.</span>
          </h3>

          <p className="text-sm sm:text-base text-slate-600 font-inter leading-relaxed max-w-2xl mx-auto">
            Le réseau social et l'écosystème business d'Ecomfy pour apprendre, échanger, créer, promouvoir et faire grandir votre activité en ligne.
          </p>
        </div>

        {/* Central Showcase Container with Parallax Event Listener */}
        <div
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="relative my-6 max-w-6xl mx-auto min-h-[580px] sm:min-h-[640px] flex items-center justify-center"
        >
          {/* MULTI-DIRECTIONAL INTERCONTINENTAL DATA FLOW NETWORK (SVG Lines & Traveling Data Packets) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 hidden md:block" viewBox="0 0 1000 600" fill="none">
            {/* Beam 1: Left-to-Right (Afrique -> Europe -> Amérique) */}
            <path
              id="flow-path-1"
              d="M 160 170 Q 320 110 500 300 T 840 170"
              stroke="url(#beam-emerald)"
              strokeWidth="2.5"
              strokeDasharray="6 6"
              className={prefersReducedMotion ? "" : "animate-[dash_14s_linear_infinite]"}
            />

            {/* Beam 2: Right-to-Left (Asie -> Afrique) */}
            <path
              id="flow-path-2"
              d="M 820 450 Q 640 500 500 300 T 180 430"
              stroke="url(#beam-cyan)"
              strokeWidth="2.5"
              strokeDasharray="6 6"
              className={prefersReducedMotion ? "" : "animate-[dash_18s_linear_infinite]"}
            />

            {/* Beam 3: Top-to-Bottom Cross Beam */}
            <path
              id="flow-path-3"
              d="M 500 120 Q 420 280 500 480"
              stroke="url(#beam-teal)"
              strokeWidth="2"
              strokeDasharray="5 5"
            />

            {/* Beam 4: Diagonal Data Arc */}
            <path
              id="flow-path-4"
              d="M 240 260 L 760 340"
              stroke="url(#beam-emerald)"
              strokeWidth="1.8"
              strokeDasharray="4 4"
            />

            {/* TRAVELING DATA PACKETS (ANIMATE MOTION) */}
            {!prefersReducedMotion && (
              <>
                {/* Packet 1: Left -> Right (Green) */}
                <circle r="4.5" fill="#10B981" className="shadow-lg">
                  <animateMotion path="M 160 170 Q 320 110 500 300 T 840 170" dur="3.8s" repeatCount="indefinite" />
                </circle>
                
                {/* Packet 2: Right -> Left (Cyan) */}
                <circle r="4" fill="#06B6D4">
                  <animateMotion path="M 820 450 Q 640 500 500 300 T 180 430" dur="5.2s" repeatCount="indefinite" />
                </circle>

                {/* Packet 3: Top -> Bottom (Teal) */}
                <circle r="3.5" fill="#0E7C66">
                  <animateMotion path="M 500 120 Q 420 280 500 480" dur="4.2s" repeatCount="indefinite" />
                </circle>

                {/* Packet 4: Diagonal Cross Packet */}
                <circle r="3.5" fill="#34D399">
                  <animateMotion path="M 240 260 L 760 340" dur="6.5s" repeatCount="indefinite" />
                </circle>
              </>
            )}

            {/* Gradients */}
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

          {/* REALISTIC 3D ANIMATED ROTATING GLOBE IN THE CENTER (WITH PARALLAX TRANSFORM) */}
          <div
            style={{
              transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0)`,
              transition: "transform 0.15s ease-out",
            }}
            className="relative z-0 flex items-center justify-center my-8"
          >
            {/* Outer Glowing Atmosphere Aura */}
            <div className="absolute h-72 w-72 sm:h-96 sm:w-96 rounded-full bg-emerald-400/25 blur-3xl animate-pulse" />
            <div className={`absolute h-80 w-80 sm:h-[430px] sm:w-[430px] rounded-full border border-emerald-400/35 ${prefersReducedMotion ? "" : "animate-[spin_38s_linear_infinite]"}`} />

            {/* Central Realistic 3D World Sphere */}
            <div className="relative h-64 w-64 sm:h-88 sm:w-88 rounded-full bg-gradient-to-b from-teal-600 via-emerald-700 to-cyan-900 shadow-[0_0_90px_rgba(14,124,102,0.45)] border-4 border-emerald-300/50 overflow-hidden flex items-center justify-center">
              
              {/* Latitude & Longitude Spherical Grid Lines */}
              <div className={`absolute inset-0 opacity-30 bg-[radial-gradient(#fff_1.2px,transparent_1.2px)] [background-size:18px_18px] ${prefersReducedMotion ? "" : "animate-[spin_55s_linear_infinite]"}`} />
              
              {/* World Map Texture Image Overlay (Realistic Continents: Africa, Europe, America, Asia) */}
              <div className={`absolute inset-0 bg-[url('https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?w=900&auto=format&fit=crop&q=80')] bg-cover opacity-75 mix-blend-overlay ${prefersReducedMotion ? "" : "animate-[spin_40s_linear_infinite]"}`} />
              
              {/* Glowing Pulse Core across continents */}
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 via-transparent to-cyan-400/30 animate-pulse" />

              {/* Pulsing Intercontinental Data Nodes on Globe Surface */}
              <div className="absolute top-1/4 left-1/3 h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_10px_#10B981] animate-ping" />
              <div className="absolute top-1/2 right-1/4 h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#06B6D4] animate-ping" style={{ animationDelay: "1.2s" }} />
              <div className="absolute bottom-1/3 left-1/2 h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_10px_#F59E0B] animate-ping" style={{ animationDelay: "2.4s" }} />
            </div>

            {/* 5 FLOATING PERSONNAS & FEATURE NODES ON THE GLOBE (STATIC & CRISP) */}
            
            {/* Personna 1: Koffi (Top Left Node) */}
            <div className="absolute -top-4 left-1/4 z-20">
              <div className="h-12 w-12 rounded-full ring-4 ring-emerald-400/70 shadow-xl overflow-hidden border-2 border-white">
                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80" alt="Koffi" className="h-full w-full object-cover" />
              </div>
            </div>
            
            {/* Feature Icon Node: Vidéos */}
            <div className="absolute top-1/3 -left-7 z-20">
              <div className="h-10 w-10 rounded-full bg-[#0E7C66] text-white flex items-center justify-center shadow-lg border-2 border-white">
                <Video className="h-4 w-4" />
              </div>
            </div>

            {/* Personna 2: Aminata (Bottom Left Node) */}
            <div className="absolute bottom-8 left-14 z-20">
              <div className="h-14 w-14 rounded-full ring-4 ring-teal-400/70 shadow-xl overflow-hidden border-2 border-white">
                <img src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&auto=format&fit=crop&q=80" alt="Aminata" className="h-full w-full object-cover" />
              </div>
            </div>

            {/* Feature Icon Node: Community */}
            <div className="absolute -top-2 right-1/4 z-20">
              <div className="h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg border-2 border-white">
                <Users className="h-4 w-4" />
              </div>
            </div>

            {/* Personna 3: Sékou (Right Middle Node) */}
            <div className="absolute top-1/2 -right-7 z-20">
              <div className="h-12 w-12 rounded-full ring-4 ring-cyan-400/70 shadow-xl overflow-hidden border-2 border-white">
                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80" alt="Sékou" className="h-full w-full object-cover" />
              </div>
            </div>

            {/* Personna 4: Awa (Bottom Right Node) */}
            <div className="absolute bottom-10 right-10 z-20">
              <div className="h-14 w-14 rounded-full ring-4 ring-amber-400/70 shadow-xl overflow-hidden border-2 border-white">
                <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80" alt="Awa" className="h-full w-full object-cover" />
              </div>
            </div>
          </div>

          {/* STATIC & CRISP UI CARDS (EXACT MATCH TO REFERENCE MOCKUP) */}

          {/* 1. TOP LEFT CARD: NATIVE CONNECTUS POST PAGE (Not Facebook) */}
          <div className="relative md:absolute md:top-2 md:left-2 z-20 w-full md:w-72 bg-white rounded-3xl p-4 border border-slate-200/90 shadow-xl space-y-3">
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
          <div className="relative md:absolute md:bottom-2 md:left-2 z-20 w-full md:w-64 bg-white rounded-3xl p-4 border border-slate-200/90 shadow-xl space-y-3 mt-4 md:mt-0">
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
          <div className="relative md:absolute md:top-2 md:right-2 z-20 w-full md:w-72 bg-white rounded-3xl p-4 border border-slate-200/90 shadow-xl space-y-3 mt-4 md:mt-0">
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
          <div className="relative md:absolute md:bottom-2 md:right-2 z-20 w-full md:w-64 bg-white rounded-3xl p-4 border border-slate-200/90 shadow-xl space-y-3 mt-4 md:mt-0">
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

        {/* Floating Glassmorphism Stat Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto my-10">
          <div className="bg-white/90 backdrop-blur-md border border-emerald-200/80 rounded-3xl p-4 flex items-center gap-3.5 shadow-sm text-center md:text-left">
            <div className="h-10 w-10 rounded-2xl bg-emerald-100 text-[#0E7C66] flex items-center justify-center shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">Des millions de connexions</h4>
              <p className="text-xs text-slate-500">Réseau social natif d'entrepreneurs</p>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-md border border-emerald-200/80 rounded-3xl p-4 flex items-center gap-3.5 shadow-sm text-center md:text-left">
            <div className="h-10 w-10 rounded-2xl bg-emerald-100 text-[#0E7C66] flex items-center justify-center shrink-0">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">Une communauté internationale</h4>
              <p className="text-xs text-slate-500">Membres & vendeurs de toute l'Afrique</p>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-md border border-emerald-200/80 rounded-3xl p-4 flex items-center gap-3.5 shadow-sm text-center md:text-left">
            <div className="h-10 w-10 rounded-2xl bg-emerald-100 text-[#0E7C66] flex items-center justify-center shrink-0">
              <BarChart2 className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">Plus d'opportunités</h4>
              <p className="text-xs text-slate-500">Social Commerce & Ventes directes</p>
            </div>
          </div>
        </div>

        {/* Bottom CTA Action Buttons & Sub-pills */}
        <div className="text-center space-y-6 pt-4">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button
              onClick={() => navigate("/connectus")}
              size="lg"
              className="rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-extrabold text-sm px-8 h-12 shadow-md hover:shadow-lg transition-all gap-2 btn-interactive"
            >
              <span>Rejoindre ConnectUs</span>
              <ArrowRight className="h-4 w-4" />
            </Button>

            <Button
              onClick={() => navigate("/connectus")}
              variant="outline"
              size="lg"
              className="rounded-full border-slate-300 hover:border-[#0E7C66] text-slate-800 font-bold text-sm px-7 h-12 gap-2 shadow-xs"
            >
              <Play className="h-4 w-4 fill-slate-800" />
              <span>Découvrir les avantages</span>
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-bold text-slate-600 pt-2">
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
