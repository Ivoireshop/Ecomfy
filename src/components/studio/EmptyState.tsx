import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, Image as ImageIcon, Video, Palette, Megaphone, UserSquare, ArrowRight } from "lucide-react";

interface EmptyStateProps {
  mode: "image" | "video";
  onSuggestionClick: (prompt: string) => void;
}

export const EmptyState = ({ mode, onSuggestionClick }: EmptyStateProps) => {
  const [firstName, setFirstName] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    const fetchUserFirstName = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        let name = user.user_metadata?.full_name || user.user_metadata?.name || "";
        
        if (!name) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .maybeSingle();
          if (profile?.full_name) {
            name = profile.full_name;
          }
        }

        if (name && isMounted) {
          const first = name.trim().split(" ")[0];
          if (first) {
            setFirstName(first);
          }
        }
      } catch (err) {
        console.error("Error fetching user name:", err);
      }
    };

    fetchUserFirstName();
    return () => { isMounted = false; };
  }, []);

  const suggestions = mode === "image" ? [
    {
      title: "Photo Produit Premium",
      badge: "E-Commerce",
      icon: <Palette className="w-4 h-4 text-emerald-500 shrink-0" />,
      prompt: "Photo produit e-commerce premium avec éclairage studio photo, flacon de sérum cosmétique posé sur une pierre de marbre avec des gouttes d'eau fraîches, fond neutre élégant, ultra haute définition 8k",
      description: "Mise en scène studio pro avec ombres et reflets"
    },
    {
      title: "Publicité Facebook / TikTok",
      badge: "Social Ad",
      icon: <Megaphone className="w-4 h-4 text-blue-500 shrink-0" />,
      prompt: "Visuel publicitaire accrocheur pour Facebook et TikTok, modèle africain souriant présentant un produit de beauté, couleurs vivantes et modernes, typographie nette et lisible, haute conversion",
      description: "Visuel accrocheur optimisé pour le taux de clic"
    },
    {
      title: "Portrait Professionnel",
      badge: "Branding",
      icon: <UserSquare className="w-4 h-4 text-purple-500 shrink-0" />,
      prompt: "Portrait d'affaires professionnel, entrepreneur élégant en tenue moderne, arrière-plan de bureau lumineux avec flou artistique bokeh, éclairage naturel, confiance et sérénité",
      description: "Photo d'entrepreneur ou modèle de marque"
    },
    {
      title: "Post Instagram Lifestyle",
      badge: "Contenu",
      icon: <ImageIcon className="w-4 h-4 text-amber-500 shrink-0" />,
      prompt: "Post Instagram lifestyle esthétique, ambiance chaleureuse et lumineuse, composition créative avec accessoires modernes, palette de couleurs harmonieuse",
      description: "Composition esthétique pour fil d'actualité"
    }
  ] : [
    {
      title: "Publicité Vidéo Produit",
      badge: "Commercial",
      icon: <Video className="w-4 h-4 text-purple-500 shrink-0" />,
      prompt: "Travelling avant cinématique sur un produit e-commerce, éclairage studio dramatique, mouvement fluide de caméra, ambiance haute couture",
      description: "Vidéo commerciale dynamique 9:16"
    },
    {
      title: "Présentation Dynamique",
      badge: "Tutoriel",
      icon: <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />,
      prompt: "Montage vidéo dynamique, déballage et démonstration de produit en action, fond coloré moderne, mouvement énergique",
      description: "Format court engageant pour réseaux"
    },
    {
      title: "Ambiance Cinématique",
      badge: "Brand Story",
      icon: <Video className="w-4 h-4 text-blue-500 shrink-0" />,
      prompt: "Plan séquence cinématique, éclairage tamisé chaleureux, léger mouvement panoramique avec profondeur de champ",
      description: "Rendu cinéma pour raconter votre marque"
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full max-w-4xl mx-auto px-4 py-8 md:py-12 animate-in fade-in zoom-in-95 duration-500">
      
      {/* Top AI Badge avec point clignotant */}
      <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs mb-6 shadow-2xs">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        <span className="whitespace-nowrap uppercase tracking-wider">Studio IA Créatif &amp; Publicitaire</span>
      </div>

      {/* Main Title avec Prénom Utilisateur */}
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-center text-foreground tracking-tight max-w-2xl mb-4 leading-tight">
        {firstName ? `Bonjour ${firstName}, que` : "Bonjour, que"} souhaitez-vous créer <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0E7C66] via-emerald-500 to-teal-400">aujourd'hui ?</span>
      </h1>
      
      {/* Subtitle */}
      <p className="text-muted-foreground text-center max-w-lg mb-10 text-sm sm:text-base font-medium leading-relaxed">
        {mode === "image" 
          ? "Générez des images et des visuels publicitaires de qualité avec la meilleure intelligence artificielle africaine Ecomfy Gen Plus."
          : "Créez des vidéos publicitaires haute définition pour TikTok, Instagram et Facebook en quelques secondes avec Ecomfy Gen Plus."}
      </p>

      {/* Grid of Templates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        {suggestions.map((suggestion, index) => (
          <div
            key={index}
            onClick={() => onSuggestionClick(suggestion.prompt)}
            className="group relative flex flex-col p-5 rounded-2xl bg-card border border-border/60 hover:border-[#0E7C66]/50 shadow-xs hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-muted/60 group-hover:bg-emerald-500/10 transition-colors">
                  {suggestion.icon}
                </div>
                <h3 className="font-extrabold text-sm text-foreground group-hover:text-[#0E7C66] transition-colors whitespace-nowrap">
                  {suggestion.title}
                </h3>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-muted text-muted-foreground group-hover:bg-emerald-500/10 group-hover:text-[#0E7C66] transition-colors">
                {suggestion.badge}
              </span>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2 mt-1 mb-3 font-normal leading-normal">
              {suggestion.prompt}
            </p>

            <div className="flex items-center text-xs font-bold text-[#0E7C66] mt-auto opacity-80 group-hover:opacity-100 transition-opacity">
              <span>Utiliser cette idée</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
