import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  GraduationCap, 
  PlayCircle, 
  CheckCircle2, 
  Search, 
  Sparkles, 
  Store, 
  Tv, 
  MessageSquare, 
  ChevronRight, 
  ExternalLink,
  Clock,
  BookOpen,
  Award,
  Layers,
  ArrowRight,
  ThumbsUp,
  X
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface TutorialVideo {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  youtubeUrl: string;
  duration: string;
  category: "ecomfy" | "facebook" | "sales";
  categoryLabel: string;
  level: "Débutant" | "Intermédiaire" | "Avancé" | "Tous niveaux";
  featured?: boolean;
  tags: string[];
  keyPoints?: string[];
  actionLink?: {
    label: string;
    url: string;
  };
}

const ACADEMY_VIDEOS: TutorialVideo[] = [
  {
    id: "vid-ecomfy-config-main",
    title: "Création et Paramétrage complet de votre boutique Ecomfy",
    description: "Tutoriel officiel pas à pas : apprenez à créer votre boutique en ligne, ajouter vos produits, configurer les paiements Mobile Money (Orange Money, MTN, Moov, Wave) & Cash à la livraison, et lancer vos ventes.",
    youtubeId: "XOfjv1oX7Dc",
    youtubeUrl: "https://youtu.be/XOfjv1oX7Dc",
    duration: "15 min",
    category: "ecomfy",
    categoryLabel: "Prise en main Ecomfy",
    level: "Débutant",
    featured: true,
    tags: ["Prise en main", "Boutique Ecomfy", "Configuration", "Mobile Money"],
    keyPoints: [
      "Choix du nom de boutique & sous-domaine personnalisé",
      "Ajout de produits avec photos HD, prix en FCFA & descriptions",
      "Configuration des modes de paiement (Mobile Money & Cash)",
      "Paramétrage du numéro WhatsApp pour recevoir les commandes"
    ],
    actionLink: {
      label: "Créer/Paramétrer ma boutique",
      url: "/shop-manager"
    }
  },
  {
    id: "vid-ecomfy-checkout-setup",
    title: "Comment PARAMÉTRER le CHECKOUT de sa boutique E-commerce ? | Guide complet",
    description: "Tutoriel complet pas à pas : découvrez comment configurer le tunnel de commande (Checkout Single-Page) de votre boutique Ecomfy, personnaliser le formulaire client et maximiser vos ventes.",
    youtubeId: "vQxOtzYwS68",
    youtubeUrl: "https://youtu.be/vQxOtzYwS68",
    duration: "12 min",
    category: "ecomfy",
    categoryLabel: "Prise en main Ecomfy",
    level: "Tous niveaux",
    tags: ["Checkout", "Tunnel de commande", "Configuration", "Paiements", "Conversion"],
    keyPoints: [
      "Paramétrage du Checkout Single-Page ultra-rapide",
      "Personnalisation des champs du formulaire de commande client",
      "Activation des modes de paiement Cash à la livraison & Mobile Money",
      "Réduction des abandons de panier et optimisation du taux de conversion"
    ],
    actionLink: {
      label: "Paramétrer mon Checkout",
      url: "/shop-manager"
    }
  },
  {
    id: "vid-ecomfy-products",
    title: "Optimiser vos fiches produits pour doubler vos conversions",
    description: "Découvrez comment rendre vos produits irrésistibles grâce aux comptes à rebours d'urgence, à la jauge de stock animée et aux offres par lots (bundles).",
    youtubeId: "XOfjv1oX7Dc",
    youtubeUrl: "https://youtu.be/XOfjv1oX7Dc",
    duration: "10 min",
    category: "ecomfy",
    categoryLabel: "Prise en main Ecomfy",
    level: "Intermédiaire",
    tags: ["Conversion", "Fiches Produits", "Bundles"],
    keyPoints: [
      "Activer le compte à rebours d'urgence",
      "Ajouter des offres groupées (1 acheté = le 2ème à -50%)",
      "Rédiger des avis clients persuasifs"
    ],
    actionLink: {
      label: "Gérer mes produits",
      url: "/shop-manager"
    }
  },
  {
    id: "vid-ecomfy-branding",
    title: "Personnaliser le thème et l'identité visuelle de votre vitrine",
    description: "Apprenez à adapter la couleur principale, le logo et l'ambiance visuelle de votre boutique pour refléter une marque ultra-professionnelle.",
    youtubeId: "XOfjv1oX7Dc",
    youtubeUrl: "https://youtu.be/XOfjv1oX7Dc",
    duration: "8 min",
    category: "ecomfy",
    categoryLabel: "Prise en main Ecomfy",
    level: "Débutant",
    tags: ["Branding", "Design", "Couleurs"],
    keyPoints: [
      "Sélection de la couleur primaire dynamique",
      "Import du logo et de la favicon",
      "Aperçu mobile et ordinateur en direct"
    ]
  },
  {
    id: "vid-fb-business-setup",
    title: "Créer et configurer un compte Facebook Business Manager",
    description: "Guide stratégique pour créer proprement votre Business Manager Facebook, lier votre page professionnelle et sécuriser vos actifs publicitaires.",
    youtubeId: "XOfjv1oX7Dc",
    youtubeUrl: "https://youtu.be/XOfjv1oX7Dc",
    duration: "12 min",
    category: "facebook",
    categoryLabel: "Publicités Facebook",
    level: "Débutant",
    tags: ["FB Ads", "Business Manager", "Configuration"],
    keyPoints: [
      "Création de la page Facebook pro et du compte publicitaire",
      "Configuration de la devise FCFA et des cartes de paiement",
      "Sécurisation à double facteur pour éviter le blocage"
    ]
  },
  {
    id: "vid-fb-first-campaign",
    title: "Lancer votre première campagne publicitaire rentable",
    description: "Comment structurer une campagne de vente directe ou de redirection WhatsApp rentable avec ciblage géographique précis en Afrique.",
    youtubeId: "XOfjv1oX7Dc",
    youtubeUrl: "https://youtu.be/XOfjv1oX7Dc",
    duration: "18 min",
    category: "facebook",
    categoryLabel: "Publicités Facebook",
    level: "Avancé",
    tags: ["FB Ads", "Ciblage", "ROI", "Budget"],
    keyPoints: [
      "Définition du budget quotidien adapté",
      "Ciblage par ville, centres d'intérêt et tranche d'âge",
      "Configuration des objectifs de conversion et messages"
    ],
    actionLink: {
      label: "Générer des visuels avec le Studio IA",
      url: "/studio"
    }
  },
  {
    id: "vid-fb-creatives-ai",
    title: "Générer des visuels & vidéos publicitaires percutants avec le Studio IA",
    description: "Créez des contenus visuels HD de niveau agence en 1 clic grâce à l'IA d'Ecomfy pour captiver l'attention dans le fil d'actualité Facebook.",
    youtubeId: "XOfjv1oX7Dc",
    youtubeUrl: "https://youtu.be/XOfjv1oX7Dc",
    duration: "9 min",
    category: "facebook",
    categoryLabel: "Publicités Facebook",
    level: "Tous niveaux",
    tags: ["Studio IA", "Créatives", "Visuels HD"],
    keyPoints: [
      "Création d'images produits sur fond studio",
      "Génération de voix-off et vidéos publicitaires",
      "Formats adaptés pour Reels & Stories Facebook/Instagram"
    ],
    actionLink: {
      label: "Ouvrir le Studio IA",
      url: "/studio"
    }
  },
  {
    id: "vid-sales-whatsapp",
    title: "Convertir vos prospects Facebook en acheteurs sur WhatsApp",
    description: "Mettez en place un système d'accueil et de closing ultra efficace pour clore les ventes WhatsApp rapidement dès le premier message.",
    youtubeId: "XOfjv1oX7Dc",
    youtubeUrl: "https://youtu.be/XOfjv1oX7Dc",
    duration: "11 min",
    category: "sales",
    categoryLabel: "Ventes & WhatsApp",
    level: "Intermédiaire",
    tags: ["WhatsApp", "Closing", "Scripts Vente"],
    keyPoints: [
      "Configuration des réponses automatiques WhatsApp Business",
      "Script de qualification rapide du client",
      "Lien direct vers le bon de commande Ecomfy"
    ]
  },
  {
    id: "vid-sales-retention",
    title: "Techniques de relance client et livraison pour tripler vos revenus",
    description: "Comment gérer le suivi des livraisons avec vos livreurs et relancer les paniers abandonnés ou anciens clients avec de nouvelles offres.",
    youtubeId: "XOfjv1oX7Dc",
    youtubeUrl: "https://youtu.be/XOfjv1oX7Dc",
    duration: "14 min",
    category: "sales",
    categoryLabel: "Ventes & WhatsApp",
    level: "Tous niveaux",
    tags: ["Livraison", "Fidélisation", "Relances"],
    keyPoints: [
      "Attribution des commandes aux livreurs",
      "Relance automatique des commandes en attente",
      "Stratégies de ré-achat auprès de la base client"
    ],
    actionLink: {
      label: "Gérer mes livraisons",
      url: "/delivery-dashboard"
    }
  }
];

export default function Academy() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeVideo, setActiveVideo] = useState<TutorialVideo | null>(null);
  const [completedVideoIds, setCompletedVideoIds] = useState<string[]>([]);

  // Charge les vidéos terminées sauvegardées
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ecomfy_academy_completed_videos");
      if (saved) {
        setCompletedVideoIds(JSON.parse(saved));
      }
    } catch (err) {
      console.error("Erreur de chargement de la progression vidéo", err);
    }
  }, []);

  const toggleVideoCompleted = (id: string) => {
    const next = completedVideoIds.includes(id)
      ? completedVideoIds.filter((vId) => vId !== id)
      : [...completedVideoIds, id];
    setCompletedVideoIds(next);
    try {
      localStorage.setItem("ecomfy_academy_completed_videos", JSON.stringify(next));
    } catch (err) {
      console.error("Erreur de sauvegarde de la progression", err);
    }
  };

  const filteredVideos = ACADEMY_VIDEOS.filter((video) => {
    const matchesCategory = selectedCategory === "all" || video.category === selectedCategory;
    const matchesSearch =
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const featuredVideo = ACADEMY_VIDEOS.find((v) => v.featured) || ACADEMY_VIDEOS[0];
  const progressPercent = Math.round((completedVideoIds.length / ACADEMY_VIDEOS.length) * 100);

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 pb-20 pt-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0E7C66] via-emerald-700 to-teal-900 text-white p-6 sm:p-10 shadow-xl">
          <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
            <GraduationCap className="w-96 h-96" />
          </div>
          
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-emerald-100 text-xs font-semibold tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                Académie Ecomfy • Formations & Tutoriels
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 text-xs font-bold">
                👑 Pass Premium Académie : 35 000 FCFA / mois (ou 28 500 FCFA / mois en annuel)
              </div>
            </div>
            
            <h1 className="text-2xl sm:text-4xl font-space font-bold tracking-tight text-white leading-tight">
              Maîtrisez Ecomfy & Développez vos Ventes en Ligne 🚀
            </h1>
            
            <p className="text-sm sm:text-base text-emerald-50 leading-relaxed font-inter">
              Apprenez pas à pas à paramétrer votre boutique, ajouter vos produits, configurer les paiements Mobile Money et lancer des publicités Facebook ultra-rentables.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Button
                onClick={() => navigate("/student")}
                className="rounded-full bg-white text-[#0E7C66] hover:bg-emerald-50 font-bold text-xs gap-2 px-5 py-2.5 shadow-xl"
              >
                <GraduationCap className="w-4 h-4 text-[#0E7C66]" />
                <span>Mon Espace Étudiant LMS (Formations VIP & Achetées)</span>
              </Button>
            </div>

            {/* Progression & Stats Quick Bar */}
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 flex items-center gap-3 border border-white/10">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-emerald-100 font-medium">Tutoriels disponibles</p>
                  <p className="text-lg font-bold text-white">{ACADEMY_VIDEOS.length} Vidéos Pro</p>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 flex items-center gap-3 border border-white/10">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div className="w-full pr-2">
                  <div className="flex justify-between items-center text-xs text-emerald-100 font-medium mb-1">
                    <span>Votre Progression</span>
                    <span className="font-bold text-white">{progressPercent}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-2 bg-white/20" />
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 flex items-center gap-3 border border-white/10">
                <div className="w-10 h-10 rounded-xl bg-yellow-400/20 text-yellow-300 flex items-center justify-center shrink-0">
                  <ThumbsUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-emerald-100 font-medium">Pratique & Concret</p>
                  <p className="text-sm font-semibold text-white">Cas réels E-commerce Afrique</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Featured Video Highlight Card */}
        {featuredVideo && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 dark:border-slate-800 transition-all hover:shadow-md">
            <div className="flex items-center justify-between gap-2 mb-4">
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1 rounded-full text-xs">
                ⭐ Tutoriel Officiel Recommandé
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                <Clock className="w-3.5 h-3.5" />
                {featuredVideo.duration}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Video Thumbnail / Cover */}
              <div className="lg:col-span-6 relative group rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md">
                <img
                  src={`https://img.youtube.com/vi/${featuredVideo.youtubeId}/hqdefault.jpg`}
                  alt={featuredVideo.title}
                  className="w-full aspect-video object-cover transition-transform duration-300 group-hover:scale-105 opacity-90 group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] group-hover:bg-slate-950/20 transition-all flex items-center justify-center">
                  <button
                    onClick={() => setActiveVideo(featuredVideo)}
                    className="w-16 h-16 rounded-full bg-[#0E7C66] text-white flex items-center justify-center shadow-2xl transition-all duration-300 transform group-hover:scale-110 hover:bg-emerald-600 focus:outline-none"
                  >
                    <PlayCircle className="w-10 h-10 fill-white text-[#0E7C66] ml-0.5" />
                  </button>
                </div>
                <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm text-white px-3 py-1 rounded-lg text-xs font-semibold">
                  Cliquez pour regarder ➔
                </div>
              </div>

              {/* Right Details */}
              <div className="lg:col-span-6 space-y-4">
                <div className="space-y-2">
                  <h2 className="text-xl sm:text-2xl font-space font-bold text-foreground leading-snug">
                    {featuredVideo.title}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {featuredVideo.description}
                  </p>
                </div>

                {featuredVideo.keyPoints && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Ce que vous allez apprendre :</p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-foreground">
                      {featuredVideo.keyPoints.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-3 flex flex-wrap items-center gap-3">
                  <Button
                    onClick={() => setActiveVideo(featuredVideo)}
                    className="bg-[#0E7C66] hover:bg-emerald-700 text-white font-medium rounded-xl px-6 shadow-sm"
                  >
                    <PlayCircle className="w-4 h-4 mr-2" />
                    Regarder la Vidéo (15 min)
                  </Button>

                  {featuredVideo.actionLink && (
                    <Button
                      variant="outline"
                      onClick={() => navigate(featuredVideo.actionLink!.url)}
                      className="rounded-xl font-medium border-emerald-600/30 text-[#0E7C66] hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    >
                      {featuredVideo.actionLink.label}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter & Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          {/* Categories Tab Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedCategory("all")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === "all"
                  ? "bg-[#0E7C66] text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-foreground"
              }`}
            >
              Toutes les Vidéos ({ACADEMY_VIDEOS.length})
            </button>

            <button
              onClick={() => setSelectedCategory("ecomfy")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedCategory === "ecomfy"
                  ? "bg-[#0E7C66] text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              Boutique Ecomfy
            </button>

            <button
              onClick={() => setSelectedCategory("facebook")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedCategory === "facebook"
                  ? "bg-[#0E7C66] text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              Publicités Facebook
            </button>

            <button
              onClick={() => setSelectedCategory("sales")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedCategory === "sales"
                  ? "bg-[#0E7C66] text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Ventes & WhatsApp
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Rechercher un tutoriel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl text-xs"
            />
          </div>
        </div>

        {/* Video Cards Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-space font-bold text-foreground flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#0E7C66]" />
              {selectedCategory === "all" && "Tous nos tutoriels vidéo"}
              {selectedCategory === "ecomfy" && "Module 1 : Prise en main & Config Boutique Ecomfy"}
              {selectedCategory === "facebook" && "Module 2 : Formations Publicités Facebook (FB Ads)"}
              {selectedCategory === "sales" && "Module 3 : Stratégies de Ventes & WhatsApp"}
            </h3>
            <span className="text-xs text-muted-foreground font-medium">
              {filteredVideos.length} tutoriel(s) affiché(s)
            </span>
          </div>

          {filteredVideos.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-dashed border-slate-300 dark:border-slate-800">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h4 className="text-base font-bold text-foreground">Aucun tutoriel trouvé</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Essayez de modifier vos critères de recherche ou sélectionnez une autre catégorie.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedCategory("all");
                  setSearchQuery("");
                }}
                className="mt-4 rounded-xl text-xs"
              >
                Réinitialiser les filtres
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVideos.map((video) => {
                const isCompleted = completedVideoIds.includes(video.id);

                return (
                  <Card
                    key={video.id}
                    className={`group rounded-2xl overflow-hidden border transition-all duration-200 hover:shadow-lg flex flex-col justify-between ${
                      isCompleted
                        ? "border-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/10"
                        : "border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <div>
                      {/* Card Thumbnail Header */}
                      <div className="relative aspect-video bg-slate-950 overflow-hidden cursor-pointer" onClick={() => setActiveVideo(video)}>
                        <img
                          src={`https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`}
                          alt={video.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 opacity-90 group-hover:opacity-100"
                        />
                        
                        {/* Play Icon Hover Overlay */}
                        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] group-hover:bg-slate-950/20 transition-all flex items-center justify-center">
                          <div className="w-12 h-12 rounded-full bg-[#0E7C66] text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                            <PlayCircle className="w-7 h-7 ml-0.5" />
                          </div>
                        </div>

                        {/* Top Badges */}
                        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                          <Badge className="bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold border-none">
                            {video.categoryLabel}
                          </Badge>

                          {isCompleted && (
                            <Badge className="bg-emerald-600 text-white text-[10px] font-semibold flex items-center gap-1 border-none shadow-sm">
                              <CheckCircle2 className="w-3 h-3" />
                              Vu
                            </Badge>
                          )}
                        </div>

                        {/* Duration Badge Bottom */}
                        <div className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded font-mono font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {video.duration}
                        </div>
                      </div>

                      {/* Card Content Body */}
                      <CardHeader className="p-4 pb-2 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground font-medium">
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{video.level}</span>
                          <span>YouTube HD</span>
                        </div>

                        <CardTitle className="text-base font-space font-bold line-clamp-2 text-foreground group-hover:text-[#0E7C66] transition-colors leading-snug">
                          {video.title}
                        </CardTitle>

                        <CardDescription className="text-xs line-clamp-3 text-muted-foreground leading-relaxed pt-1">
                          {video.description}
                        </CardDescription>
                      </CardHeader>

                      {/* Tags */}
                      <div className="px-4 py-2 flex flex-wrap gap-1.5">
                        {video.tags.map((tag, tIdx) => (
                          <span
                            key={tIdx}
                            className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-medium px-2 py-0.5 rounded-md"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="p-4 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-2 mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleVideoCompleted(video.id)}
                        className={`text-xs h-8 px-2.5 rounded-lg ${
                          isCompleted
                            ? "text-emerald-600 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        {isCompleted ? "Marqué comme vu" : "Marquer comme vu"}
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => setActiveVideo(video)}
                        className="bg-[#0E7C66] hover:bg-emerald-700 text-white text-xs h-8 px-3.5 rounded-xl shadow-sm"
                      >
                        Voir
                        <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Help Banner */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-lg font-space font-bold text-white">Une question sur le paramétrage de votre boutique ?</h4>
            <p className="text-xs text-slate-300 max-w-xl">
              Notre équipe reste disponible pour vous aider à finaliser la création de votre catalogue ou la configuration de vos paiements Mobile Money.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              onClick={() => navigate("/shop-manager")}
              className="bg-[#0E7C66] hover:bg-emerald-600 text-white font-medium rounded-xl text-xs px-5 shadow-sm"
            >
              <Store className="w-4 h-4 mr-2" />
              Configurer ma Boutique
            </Button>
          </div>
        </div>

      </div>

      {/* Video Modal / Player Dialog */}
      <Dialog open={!!activeVideo} onOpenChange={(open) => !open && setActiveVideo(null)}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden rounded-3xl bg-slate-950 text-white border-slate-800">
          {activeVideo && (
            <div className="flex flex-col max-h-[90vh] overflow-y-auto scrollbar-thin">
              {/* Header */}
              <div className="p-4 sm:p-6 pb-3 bg-slate-900 border-b border-slate-800 flex items-start justify-between gap-4 sticky top-0 z-20">
                <div>
                  <Badge className="bg-emerald-600 text-white text-[10px] font-semibold mb-1">
                    {activeVideo.categoryLabel}
                  </Badge>
                  <DialogTitle className="text-lg sm:text-xl font-space font-bold text-white leading-snug">
                    {activeVideo.title}
                  </DialogTitle>
                </div>
                <button
                  onClick={() => setActiveVideo(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* YouTube Responsive Video Iframe */}
              <div className="relative aspect-video w-full bg-black">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${activeVideo.youtubeId}?autoplay=1&rel=0`}
                  title={activeVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              </div>

              {/* Video Details & Action Footer */}
              <div className="p-6 bg-slate-900 space-y-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Aperçu du Tutoriel</h4>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {activeVideo.description}
                  </p>
                </div>

                {activeVideo.keyPoints && (
                  <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-2">
                    <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5" />
                      Points clés de la leçon
                    </h5>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300 pt-1">
                      {activeVideo.keyPoints.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800">
                  <Button
                    variant="outline"
                    onClick={() => toggleVideoCompleted(activeVideo.id)}
                    className={`rounded-xl text-xs ${
                      completedVideoIds.includes(activeVideo.id)
                        ? "border-emerald-500 text-emerald-400 bg-emerald-950/40"
                        : "border-slate-700 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {completedVideoIds.includes(activeVideo.id)
                      ? "Leçon terminée ✓"
                      : "Marquer cette leçon comme terminée"}
                  </Button>

                  <div className="flex items-center gap-3">
                    {activeVideo.actionLink && (
                      <Button
                        onClick={() => {
                          const url = activeVideo.actionLink!.url;
                          setActiveVideo(null);
                          navigate(url);
                        }}
                        className="bg-[#0E7C66] hover:bg-emerald-600 text-white text-xs rounded-xl font-medium px-5 shadow-sm"
                      >
                        {activeVideo.actionLink.label}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}

                    <a
                      href={activeVideo.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      Ouvrir sur YouTube
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
