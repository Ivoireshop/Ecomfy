import { Button } from "@/components/ui/button";
import { Sparkles, Image as ImageIcon, Video, Palette, Megaphone, UserSquare } from "lucide-react";

interface EmptyStateProps {
  mode: "image" | "video";
  onSuggestionClick: (prompt: string) => void;
}

export const EmptyState = ({ mode, onSuggestionClick }: EmptyStateProps) => {
  const suggestions = mode === "image" ? [
    { text: "Photo produit premium", icon: <Palette className="w-4 h-4 mr-2" />, prompt: "Photo produit e-commerce premium avec éclairage studio, fond neutre élégant, ultra haute définition" },
    { text: "Publicité Facebook", icon: <Megaphone className="w-4 h-4 mr-2" />, prompt: "Visuel publicitaire accrocheur pour Facebook, style coloré et moderne, adapté pour la conversion" },
    { text: "Portrait professionnel", icon: <UserSquare className="w-4 h-4 mr-2" />, prompt: "Portrait d'affaires professionnel, fond de bureau moderne flou, éclairage naturel, confiance en soi" },
    { text: "Post Instagram", icon: <ImageIcon className="w-4 h-4 mr-2" />, prompt: "Post Instagram lifestyle esthétique, ambiance chaleureuse, couleurs douces, composition créative" }
  ] : [
    { text: "Publicité produit", icon: <Video className="w-4 h-4 mr-2" />, prompt: "Travelling avant lent sur le produit, éclairage dramatique, ambiance luxueuse" },
    { text: "Tutoriel dynamique", icon: <Sparkles className="w-4 h-4 mr-2" />, prompt: "Montage dynamique rapide, présentation énergique, fond coloré" },
    { text: "Atmosphère cinématique", icon: <Video className="w-4 h-4 mr-2" />, prompt: "Plan séquence cinématique, éclairage tamisé, léger mouvement de caméra panoramique" },
  ];

  return (
    <div className="flex flex-col items-center justify-center flex-1 w-full h-full p-8 mt-12 mb-20 animate-in fade-in zoom-in duration-500">
      <div className="w-16 h-16 mb-6 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
        <Sparkles className="w-8 h-8" />
      </div>
      
      <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">
        Que souhaitez-vous créer aujourd'hui ?
      </h2>
      
      <p className="text-muted-foreground text-center max-w-md mb-10 text-sm sm:text-base">
        Créez une {mode === "image" ? "image" : "vidéo"} époustouflante simplement en décrivant votre idée.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
        {suggestions.map((suggestion, index) => (
          <Button
            key={index}
            variant="outline"
            className="h-auto py-4 px-4 justify-start text-left bg-background hover:bg-muted/50 border-border shadow-sm hover:shadow transition-all"
            onClick={() => onSuggestionClick(suggestion.prompt)}
          >
            <div className="flex flex-col gap-1 w-full">
              <span className="flex items-center font-medium text-foreground">
                {suggestion.icon}
                {suggestion.text}
              </span>
              <span className="text-xs text-muted-foreground truncate w-full">
                {suggestion.prompt}
              </span>
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
};
