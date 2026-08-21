import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Globe, Sparkles, Users, ShoppingBag, Radio, ArrowRight, Play, Heart, MessageCircle,
  Share2, BarChart2, Megaphone, Layers, TrendingUp, CheckCircle2, Store, Video
} from "lucide-react";

export function LandingConnectUsSection() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");

  return (
    <section id="connectus" className="relative py-24 md:py-32 overflow-hidden bg-gradient-to-b from-[#F0FDF4] via-emerald-50/40 to-white">
      {/* Background Animated Glow Elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-tr from-emerald-300/30 via-teal-300/20 to-cyan-300/30 blur-[120px] rounded-full pointer-events-none animate-pulse" />
      <div className="absolute -top-20 left-10 w-96 h-96 bg-emerald-400/10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-teal-400/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="container relative mx-auto px-4 max-w-7xl">
        {/* Top Header Badge & Titles */}
        <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100/80 border border-emerald-300 text-emerald-800 text-xs font-bold shadow-xs">
            <Sparkles className="h-3.5 w-3.5 text-[#0E7C66] animate-spin" />
            <span>Une plateforme complète pour l'avenir du digital</span>
            <Sparkles className="h-3.5 w-3.5 text-[#0E7C66] animate-spin" />
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-gradient-to-tr from-[#0E7C66] via-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-lg">
              <Globe className="h-6 w-6 sm:h-7 sm:w-7 animate-pulse" />
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

        {/* Central Animated Globe Showcase Container */}
        <div className="relative my-12 max-w-6xl mx-auto min-h-[580px] sm:min-h-[640px] flex items-center justify-center">
          
          {/* SVG Animated Connection Arcs & Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 hidden md:block" viewBox="0 0 1000 600" fill="none">
            {/* Arc Left to Center Globe */}
            <path
              d="M 180 160 Q 320 220 500 300"
              stroke="url(#emerald-gradient-1)"
              strokeWidth="2.5"
              strokeDasharray="6 6"
              className="animate-[dash_20s_linear_infinite]"
            />
            {/* Arc Bottom Left to Globe */}
            <path
              d="M 220 440 Q 360 380 500 300"
              stroke="url(#emerald-gradient-1)"
              strokeWidth="2"
              strokeDasharray="5 5"
            />
            {/* Arc Globe to Top Right */}
            <path
              d="M 500 300 Q 680 180 820 160"
              stroke="url(#emerald-gradient-2)"
              strokeWidth="2.5"
              strokeDasharray="6 6"
            />
            {/* Arc Globe to Bottom Right */}
            <path
              d="M 500 300 Q 640 420 800 460"
              stroke="url(#emerald-gradient-2)"
              strokeWidth="2"
              strokeDasharray="5 5"
            />

            <defs>
              <linearGradient id="emerald-gradient-1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#0E7C66" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="emerald-gradient-2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0E7C66" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.8" />
              </linearGradient>
            </defs>
          </svg>

          {/* 3D ANIMATED ROTATING GLOBE IN THE CENTER */}
          <div className="relative z-0 flex items-center justify-center my-8">
            {/* Outer Glowing Atmosphere Ring */}
            <div className="absolute h-72 w-72 sm:h-96 sm:w-96 rounded-full bg-emerald-400/20 blur-3xl animate-pulse" />
            <div className="absolute h-80 w-80 sm:h-[420px] sm:w-[420px] rounded-full border border-emerald-400/30 animate-[spin_30s_linear_infinite]" />

            {/* Central Globe Element */}
            <div className="relative h-64 w-64 sm:h-84 sm:w-84 rounded-full bg-gradient-to-b from-teal-500 via-emerald-600 to-cyan-800 shadow-[0_0_80px_rgba(14,124,102,0.4)] border-4 border-emerald-300/40 overflow-hidden flex items-center justify-center">
              {/* Globe Texture & Latitude/Longitude Lines Overlay */}
              <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] animate-[spin_60s_linear_infinite]" />
              
              {/* Animated Map SVG Continents View */}
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?w=800&auto=format&fit=crop&q=80')] bg-cover opacity-60 mix-blend-overlay animate-[pulse_4s_ease-in-out_infinite]" />
              
              {/* Globe Core Glowing Icon */}
              <div className="relative z-10 text-center space-y-1">
                <Globe className="h-16 w-16 sm:h-20 sm:w-20 mx-auto text-white/90 animate-[spin_25s_linear_infinite] drop-shadow-md" />
                <p className="text-[10px] font-extrabold text-emerald-100 uppercase tracking-widest bg-emerald-950/60 backdrop-blur-md px-3 py-1 rounded-full border border-emerald-400/30">
                  Global Network
                </p>
              </div>
            </div>

            {/* Orbiting Avatar Nodes around the Globe */}
            <div className="absolute -top-4 left-1/4 animate-bounce">
              <div className="h-12 w-12 rounded-full ring-4 ring-emerald-400/60 shadow-lg overflow-hidden border-2 border-white">
                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80" alt="Koffi" className="h-full w-full object-cover" />
              </div>
            </div>
            
            <div className="absolute top-1/3 -left-8 animate-pulse">
              <div className="h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg border-2 border-white">
                <Video className="h-5 w-5" />
              </div>
            </div>

            <div className="absolute bottom-10 left-16 animate-bounce" style={{ animationDelay: "1s" }}>
              <div className="h-14 w-14 rounded-full ring-4 ring-teal-400/60 shadow-lg overflow-hidden border-2 border-white">
                <img src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&auto=format&fit=crop&q=80" alt="Aminata" className="h-full w-full object-cover" />
              </div>
            </div>

            <div className="absolute -top-2 right-1/4 animate-pulse">
              <div className="h-10 w-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg border-2 border-white">
                <Users className="h-5 w-5" />
              </div>
            </div>

            <div className="absolute top-1/2 -right-8 animate-bounce" style={{ animationDelay: "1.5s" }}>
              <div className="h-12 w-12 rounded-full ring-4 ring-cyan-400/60 shadow-lg overflow-hidden border-2 border-white">
                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80" alt="Sékou" className="h-full w-full object-cover" />
              </div>
            </div>

            <div className="absolute bottom-12 right-12 animate-pulse">
              <div className="h-14 w-14 rounded-full ring-4 ring-amber-400/60 shadow-lg overflow-hidden border-2 border-white">
                <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80" alt="Awa" className="h-full w-full object-cover" />
              </div>
            </div>
          </div>

          {/* FLOATING UI MOCKUP CARDS SURROUNDING THE GLOBE */}

          {/* 1. TOP LEFT FLOATING CARD (Post Preview) */}
          <div className="relative md:absolute md:top-4 md:left-4 z-20 w-full md:w-72 bg-white/95 backdrop-blur-md rounded-3xl p-4 border border-slate-200 shadow-xl space-y-3 transition-transform hover:scale-105">
            <div className="flex items-center gap-2.5">
              <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80" alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-emerald-500" />
              <div>
                <div className="flex items-center gap-1">
                  <h4 className="font-bold text-xs text-slate-900">Amina Traoré</h4>
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#0E7C66] fill-[#0E7C66] text-white" />
                </div>
                <p className="text-[10px] text-slate-500 font-medium">Entrepreneure • Abidjan</p>
              </div>
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

          {/* 2. BOTTOM LEFT FLOATING CARD (Business Manager) */}
          <div className="relative md:absolute md:bottom-6 md:left-6 z-20 w-full md:w-64 bg-white/95 backdrop-blur-md rounded-3xl p-4 border border-slate-200 shadow-xl space-y-3 transition-transform hover:scale-105 mt-4 md:mt-0">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs font-space">
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

          {/* 3. TOP RIGHT FLOATING CARD (Live Commerce Card) */}
          <div className="relative md:absolute md:top-4 md:right-4 z-20 w-full md:w-72 bg-white/95 backdrop-blur-md rounded-3xl p-4 border border-slate-200 shadow-xl space-y-3 transition-transform hover:scale-105 mt-4 md:mt-0">
            <div className="relative rounded-2xl overflow-hidden aspect-video bg-slate-900">
              <img src="https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80" alt="" className="h-full w-full object-cover opacity-80" />
              <div className="absolute top-2 left-2 bg-rose-600 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider animate-pulse">
                <Radio className="h-3 w-3" /> Live
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

          {/* 4. BOTTOM RIGHT FLOATING CARD (Trends Card) */}
          <div className="relative md:absolute md:bottom-6 md:right-6 z-20 w-full md:w-64 bg-white/95 backdrop-blur-md rounded-3xl p-4 border border-slate-200 shadow-xl space-y-3 transition-transform hover:scale-105 mt-4 md:mt-0">
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
          <div className="bg-white/80 backdrop-blur-md border border-emerald-200/80 rounded-3xl p-4 flex items-center gap-3.5 shadow-sm text-center md:text-left">
            <div className="h-10 w-10 rounded-2xl bg-emerald-100 text-[#0E7C66] flex items-center justify-center shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">Des millions de connexions</h4>
              <p className="text-xs text-slate-500">Réseau social natif d'entrepreneurs</p>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md border border-emerald-200/80 rounded-3xl p-4 flex items-center gap-3.5 shadow-sm text-center md:text-left">
            <div className="h-10 w-10 rounded-2xl bg-emerald-100 text-[#0E7C66] flex items-center justify-center shrink-0">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">Une communauté internationale</h4>
              <p className="text-xs text-slate-500">Membres & vendeurs de toute l'Afrique</p>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-md border border-emerald-200/80 rounded-3xl p-4 flex items-center gap-3.5 shadow-sm text-center md:text-left">
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
