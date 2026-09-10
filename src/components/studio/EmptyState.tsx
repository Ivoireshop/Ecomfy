import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, Image as ImageIcon, Video, Palette, Megaphone, UserSquare, ArrowRight, Terminal } from "lucide-react";

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

  const slashShortcuts = [
    { label: "/UGCmodel /FacebookAds", desc: "UGC Pro + Pub FB" },
    { label: "/UGCnaturel /InstagramAds", desc: "UGC Spontané Instagram" },
    { label: "/ProductHero /Luxury", desc: "Produit Vedette Luxe" },
    { label: "/BeforeAfter /Promo", desc: "Avant/Après Promo" },
  ];

  const suggestions = mode === "image" ? [
    {
      title: "UGC Model Commercial /FacebookAds",
      badge: "/UGCmodel",
      icon: <Megaphone className="w-4 h-4 text-emerald-500 shrink-0" />,
      prompt: "Une femme souriante qui présente ce produit de beauté /UGCmodel /FacebookAds /Premium",
      description: "Visuel UGC haut de gamme optimisé pour la conversion Facebook"
    },
    {
      title: "UGC Authentique & Organique /InstagramAds",
      badge: "/UGCnaturel",
      icon: <UserSquare className="w-4 h-4 text-blue-500 shrink-0" />,
      prompt: "Un client satisfait dans sa cuisine présentant le produit /UGCnaturel /InstagramAds /Natural",
      description: "Rendu 100% spontané et crédible façon vidéo smartphone"
    },
    {
      title: "Photo Produit Vedette Luxe",
      badge: "/ProductHero",
      icon: <Palette className="w-4 h-4 text-amber-500 shrink-0" />,
      prompt: "Visuel produit haut de gamme sur piédestal en marbre blanc /ProductHero /Luxury /Premium",
      description: "Mise en scène luxueuse avec reflets et éclairage dramatique"
    },
    {
      title: "Avant / Après & Storytelling",
      badge: "/BeforeAfter",
      icon: <ImageIcon className="w-4 h-4 text-purple-500 shrink-0" />,
      prompt: "Visuel comparatif de transformation de la peau /BeforeAfter /ProblemSolution /FacebookAds",
      description: "Storytelling visuel avant-après percutant pour réseaux"
    }
  ] : [
    {
      title: "Publicité Vidéo Produit /TikTokAds",
      badge: "/TikTokAds",
      icon: <Video className="w-4 h-4 text-purple-500 shrink-0" />,
      prompt: "Travelling avant cinématique sur le produit avec modèle /UGCmodel /TikTokAds /Cinematic",
      description: "Vidéo commerciale dynamique 9:16 pour TikTok & Reels"
    },
    {
      title: "Démonstration Produit UGC /InstagramAds",
      badge: "/UGCcreator",
      icon: <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />,
      prompt: "Montage vidéo dynamique d'un créateur déballant le produit /UGCcreator /InstagramAds",
      description: "Format court engageant avec présentation directe"
    },
    {
      title: "Ambiance Cinématique Luxe",
      badge: "/Cinematic",
      icon: <Video className="w-4 h-4 text-blue-500 shrink-0" />,
      prompt: "Plan séquence cinématique tamisé avec éclairage dramatique /ProductHero /Cinematic /Luxury",
      description: "Rendu cinéma pour raconter l'histoire de la marque"
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full max-w-4xl mx-auto px-4 py-8 md:py-12 animate-in fade-in zoom-in-95 duration-500">
      
      {/* Top AI Badge */}
      <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs mb-6 shadow-2xs">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        <span className="whitespace-nowrap uppercase tracking-wider">Studio IA — Moteur /command de Direction Créative</span>
      </div>

      {/* Main Title */}
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-center text-foreground tracking-tight max-w-2xl mb-4 leading-tight">
        {firstName ? `Bonjour ${firstName}, que` : "Bonjour, que"} souhaitez-vous créer <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0E7C66] via-emerald-500 to-teal-400">aujourd'hui ?</span>
      </h1>
      
      {/* Subtitle */}
      <p className="text-muted-foreground text-center max-w-lg mb-6 text-sm sm:text-base font-medium leading-relaxed">
        Tapez une simple description ou utilisez les raccourcis <span className="font-bold text-[#0E7C66]">/command</span> (ex: <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">/UGCmodel</span>, <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted">/FacebookAds</span>) pour piloter l'IA.
      </p>

      {/* Slash Quick Shortcuts */}
      <div className="w-full flex items-center justify-center gap-2 flex-wrap mb-8">
        <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
          <Terminal className="w-3.5 h-3.5 text-[#0E7C66]" /> Raccourcis rapides :
        </span>
        {slashShortcuts.map((sc) => (
          <button
            key={sc.label}
            type="button"
            onClick={() => onSuggestionClick(sc.label)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card border border-border/80 hover:border-[#0E7C66] hover:bg-[#0E7C66]/10 text-xs font-mono font-bold text-foreground transition-all shadow-2xs hover:scale-105"
          >
            <span className="text-[#0E7C66]">{sc.label}</span>
            <span className="text-[10px] font-sans font-normal text-muted-foreground border-l border-border/60 pl-1.5">{sc.desc}</span>
          </button>
        ))}
      </div>

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
              <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded-md bg-[#0E7C66]/10 text-[#0E7C66] group-hover:bg-[#0E7C66] group-hover:text-white transition-colors">
                {suggestion.badge}
              </span>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2 mt-1 mb-3 font-normal leading-normal font-mono">
              {suggestion.prompt}
            </p>

            <div className="flex items-center text-xs font-bold text-[#0E7C66] mt-auto opacity-80 group-hover:opacity-100 transition-opacity">
              <span>Essayer cette direction</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5 transform group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
