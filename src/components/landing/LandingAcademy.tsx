import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  GraduationCap, 
  PlayCircle, 
  CheckCircle2, 
  Sparkles, 
  Store, 
  Tv, 
  MessageSquare, 
  ArrowRight,
  ShieldCheck,
  Zap,
  Bot,
  Video,
  X,
  HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function LandingAcademy() {
  const navigate = useNavigate();
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });
  const [isVideoOpen, setIsVideoOpen] = useState(false);

  const pillars = [
    {
      icon: MessageSquare,
      color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      badge: "Stratégie #1",
      title: "Publicités Facebook ➔ Redirection WhatsApp",
      description: "Apprenez à paramétrer des campagnes ciblées sur Facebook & Instagram qui envoient vos prospects directement dans votre discussion WhatsApp pour clore vos ventes en quelques minutes.",
      tags: ["Facebook Ads", "Closing WhatsApp", "Ventes Directes"]
    },
    {
      icon: Tv,
      color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      badge: "Stratégie #2",
      title: "Publicités Facebook ➔ Vitrine E-commerce",
      description: "Découvrez comment drainer un flux continu de clients qualifiés vers vos fiches produits Ecomfy optimisées avec compte à rebours, jauge de stock et bon de commande instantané.",
      tags: ["Trafic Qualifié", "Fiches Produit Pro", "Conversion Max"]
    },
    {
      icon: Store,
      color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      badge: "Prise en main",
      title: "Configuration Boutique & Paiements Locaux",
      description: "Tutoriels pas-à-pas pour paramétrer votre nom de marque, ajouter vos produits en FCFA et encaisser facilement via Wave, Orange Money, MTN, Moov ou Cash à la livraison.",
      tags: ["Paiement Mobile Money", "Cash à la livraison", "Configuration 5 min"]
    },
    {
      icon: Sparkles,
      color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      badge: "Exclusivité Ecomfy",
      title: "Créatives Publicitaires avec le Studio IA",
      description: "Ne payez plus des milliers de francs en graphistes : générez en 1 clic des visuels HD et des vidéos avec voix-off professionnelle captivantes pour vos annonces Facebook.",
      tags: ["Studio IA", "Visuels HD", "Vidéos Voix-off"]
    }
  ];

  const whyEcomfyVsOthers = [
    {
      title: "Paiements Mobile Money Intégrés Natifs",
      desc: "Contrairement à d'autres plateformes étrangères (ex: Shopify) qui nécessitent des passerelles de paiement bancaires complexes, Ecomfy intègre directement Wave, Orange Money, MTN et Moov.",
      icon: Zap
    },
    {
      title: "Formations & Accompagnement 100% Inclus",
      desc: "Vous n'êtes jamais laissé à vous-même avec un site vide. Notre Académie vous enseigne gratuitement les techniques marketing concrètes adaptées au marché africain.",
      icon: GraduationCap
    },
    {
      title: "Studio IA de Génération Visuelle",
      desc: "Générez vos images et vidéos de produits directement dans la plateforme sans compétence en design ni matériel coûteux.",
      icon: Bot
    },
    {
      title: "Zéro Frais Cachés sur vos Ventes",
      desc: "Conservez l'intégralité de vos revenus et profitez d'une infrastructure rapide, fiable et optimisée pour les réseaux mobiles africains.",
      icon: ShieldCheck
    }
  ];

  return (
    <section id="academy" className="py-24 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-white relative overflow-hidden">
      {/* Background Lighting Elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#0E7C66]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-4 relative z-10">
        <div
          ref={ref}
          className={`max-w-6xl mx-auto space-y-16 transition-all duration-1000 transform ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-12 opacity-0"
          }`}
        >
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-300 text-xs font-semibold uppercase tracking-wider">
              <GraduationCap className="w-4 h-4 text-emerald-400" />
              Académie Ecomfy • Formations & Tutoriels 100% Offerts
            </div>

            <h2 className="text-3xl sm:text-5xl font-space font-bold tracking-tight text-white leading-tight">
              Ne créez pas juste une boutique. <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200">
                Apprenez à VENDRE véritablement !
              </span>
            </h2>

            <p className="text-base sm:text-lg text-slate-300 font-inter leading-relaxed">
              La plupart des plateformes vous laissent seul avec un site web vide. Chez <strong>Ecomfy</strong>, nous vous formons pas-à-pas avec des tutoriels vidéos pratiques pour passer de zéro à vos premières ventes.
            </p>
          </div>

          {/* Featured Video Highlight Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-sm relative overflow-hidden group">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              {/* Left Video Thumbnail */}
              <div className="lg:col-span-7 relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-xl group/thumb">
                <img
                  src="https://img.youtube.com/vi/XOfjv1oX7Dc/hqdefault.jpg"
                  alt="Tutoriel Création Boutique Ecomfy"
                  className="w-full aspect-video object-cover opacity-90 group-hover/thumb:opacity-100 transition-transform duration-500 group-hover/thumb:scale-105"
                />
                
                {/* Play Button Overlay */}
                <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] group-hover/thumb:bg-slate-950/20 transition-all flex items-center justify-center">
                  <button
                    onClick={() => setIsVideoOpen(true)}
                    className="w-20 h-20 rounded-full bg-[#0E7C66] text-white flex items-center justify-center shadow-2xl transform transition-all duration-300 group-hover/thumb:scale-110 hover:bg-emerald-500 focus:outline-none"
                  >
                    <PlayCircle className="w-12 h-12 fill-white text-[#0E7C66] ml-1" />
                  </button>
                </div>

                <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <Video className="w-3.5 h-3.5 text-emerald-400" />
                  Tutoriel Officiel Ecomfy • 15 min
                </div>
              </div>

              {/* Right Details */}
              <div className="lg:col-span-5 space-y-5">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-3 py-1 text-xs">
                  🎓 Leçon #1 : Débutant à Pro
                </Badge>

                <h3 className="text-xl sm:text-2xl font-space font-bold text-white leading-snug">
                  Création et Paramétrage complet de votre boutique Ecomfy
                </h3>

                <p className="text-sm text-slate-300 leading-relaxed font-inter">
                  Découvrez en vidéo comment créer votre boutique, ajouter vos articles avec prix en FCFA, configurer les paiements Mobile Money et lier votre WhatsApp.
                </p>

                <div className="space-y-2.5 pt-1">
                  <p className="text-xs font-semibold uppercase text-emerald-400 tracking-wider">Au programme dans l'Académie :</p>
                  <ul className="space-y-2 text-xs text-slate-200 font-inter">
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Paramétrage de la boutique en 5 minutes</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Lancement de publicités Facebook Ads rentables</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Redirection directe vers WhatsApp ou Bon de commande</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <Button
                    onClick={() => setIsVideoOpen(true)}
                    className="bg-[#0E7C66] hover:bg-emerald-600 text-white font-medium rounded-xl px-6 text-xs shadow-lg shadow-emerald-900/30"
                  >
                    <PlayCircle className="w-4 h-4 mr-2" />
                    Regarder le tutoriel (15 min)
                  </Button>
                </div>
              </div>

            </div>
          </div>

          {/* 4 Pillars Grid */}
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-2xl sm:text-3xl font-space font-bold text-white">
                Les thématiques couvertes par l'Académie
              </h3>
              <p className="text-sm text-slate-400 max-w-xl mx-auto">
                Des cours complets pensés pour les réalités du marché e-commerce en Afrique.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pillars.map((pillar, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-6 sm:p-8 space-y-4 transition-all duration-300 hover:shadow-xl hover:shadow-emerald-950/20 group"
                >
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${pillar.color}`}>
                      <pillar.icon className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold text-slate-400 bg-slate-800/80 px-3 py-1 rounded-full">
                      {pillar.badge}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-lg font-space font-bold text-white group-hover:text-emerald-400 transition-colors">
                      {pillar.title}
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {pillar.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {pillar.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="bg-slate-800/90 text-slate-300 text-[11px] font-medium px-2.5 py-1 rounded-lg"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Why Ecomfy vs Other Platforms Section */}
          <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-emerald-950/40 border border-emerald-500/30 rounded-3xl p-6 sm:p-10 space-y-8">
            <div className="text-center max-w-2xl mx-auto space-y-3">
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 px-3 py-1 text-xs">
                ⚖️ Pourquoi choisir Ecomfy ?
              </Badge>
              <h3 className="text-2xl sm:text-3xl font-space font-bold text-white">
                Pourquoi utiliser Ecomfy au lieu des autres plateformes ?
              </h3>
              <p className="text-sm text-slate-300">
                La plupart des générateurs de sites ne sont pas pensés pour l'Afrique. Voici ce qui fait la différence Ecomfy :
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {whyEcomfyVsOthers.map((item, idx) => (
                <div key={idx} className="flex items-start gap-4 bg-slate-900/90 p-5 rounded-2xl border border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-[#0E7C66]/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">{item.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Call To Action */}
          <div className="text-center bg-gradient-to-r from-[#0E7C66] to-teal-800 rounded-3xl p-8 sm:p-12 shadow-2xl space-y-6">
            <div className="max-w-2xl mx-auto space-y-3">
              <h3 className="text-2xl sm:text-4xl font-space font-bold text-white">
                Prêt à créer votre boutique et accéder aux formations ?
              </h3>
              <p className="text-sm sm:text-base text-emerald-100">
                Créez votre compte marchand en 1 minute et accédez gratuitement à toutes nos leçons vidéos et nos outils IA.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Button
                onClick={() => navigate("/auth")}
                className="bg-white text-[#0E7C66] hover:bg-slate-100 font-bold rounded-2xl text-sm px-8 py-6 shadow-xl hover:scale-105 transition-all"
              >
                Créer ma Boutique & Accéder aux Formations
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>

        </div>
      </div>

      {/* Video Modal Player */}
      <Dialog open={isVideoOpen} onOpenChange={setIsVideoOpen}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden rounded-3xl bg-slate-950 text-white border-slate-800">
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-emerald-400" />
              <DialogTitle className="text-sm sm:text-base font-space font-bold text-white">
                Académie Ecomfy • Tutoriel Officiel
              </DialogTitle>
            </div>
            <button
              onClick={() => setIsVideoOpen(false)}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="relative aspect-video w-full bg-black">
            <iframe
              src="https://www.youtube-nocookie.com/embed/XOfjv1oX7Dc?autoplay=1&rel=0"
              title="Tutoriel Ecomfy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>

          <div className="p-6 bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-300 max-w-md">
              Inscrivez-vous gratuitement pour débloquer l'accès à tous les autres tutoriels vidéo et commencer à vendre.
            </p>
            <Button
              onClick={() => {
                setIsVideoOpen(false);
                navigate("/auth");
              }}
              className="bg-[#0E7C66] hover:bg-emerald-600 text-white font-medium text-xs rounded-xl px-6"
            >
              Créer mon compte Ecomfy
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
