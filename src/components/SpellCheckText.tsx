import { useState } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

// Dictionnaire de corrections communes en français
const commonCorrections: Record<string, string[]> = {
  "apareil": ["appareil"],
  "apartement": ["appartement"],
  "apel": ["appel"],
  "apeler": ["appeler"],
  "apres": ["après"],
  "aujourdui": ["aujourd'hui"],
  "beaucoup": ["beaucoup"],
  "bcp": ["beaucoup"],
  "bien tot": ["bientôt"],
  "bientot": ["bientôt"],
  "ca": ["ça"],
  "commenca": ["commença"],
  "commencer": ["commencer"],
  "definitif": ["définitif"],
  "deja": ["déjà"],
  "desole": ["désolé"],
  "difficulte": ["difficulté"],
  "efficace": ["efficace"],
  "egalement": ["également"],
  "espere": ["espère"],
  "ete": ["été"],
  "evenement": ["événement"],
  "evidement": ["évidemment"],
  "facile": ["facile"],
  "francais": ["français"],
  "genial": ["génial"],
  "gratuit": ["gratuit"],
  "immediat": ["immédiat"],
  "interresant": ["intéressant"],
  "jusqu'a": ["jusqu'à"],
  "la": ["là"],
  "liberte": ["liberté"],
  "maintenant": ["maintenant"],
  "metre": ["mettre", "mètre"],
  "offre": ["offre"],
  "ou": ["où"],
  "pret": ["prêt"],
  "probleme": ["problème"],
  "qualite": ["qualité"],
  "rapide": ["rapide"],
  "reussi": ["réussi"],
  "sa": ["ça"],
  "sante": ["santé"],
  "tjs": ["toujours"],
  "tres": ["très"],
  "tu": ["tu"],
  "vraiement": ["vraiment"],
};

// Mots à ignorer (noms de marques, termes spécifiques)
const ignoreWords = new Set([
  "fcfa", "xof", "whatsapp", "facebook", "instagram", "tiktok", "youtube"
]);

interface SpellCheckTextProps {
  text: string;
  className?: string;
}

export const SpellCheckText = ({ text, className = "" }: SpellCheckTextProps) => {
  const [suggestions, setSuggestions] = useState<Record<number, string[]>>({});

  const checkWord = (word: string): string[] | null => {
    const normalized = word.toLowerCase().replace(/[.,!?;:()]/g, "");
    
    if (ignoreWords.has(normalized) || normalized.length < 3) {
      return null;
    }

    return commonCorrections[normalized] || null;
  };

  const words = text.split(/(\s+)/);
  
  return (
    <span className={className}>
      {words.map((word, index) => {
        const trimmedWord = word.trim();
        if (!trimmedWord || /^\s+$/.test(word)) {
          return <span key={index}>{word}</span>;
        }

        const wordSuggestions = checkWord(trimmedWord);
        
        if (wordSuggestions) {
          return (
            <HoverCard key={index}>
              <HoverCardTrigger asChild>
                <span className="underline decoration-wavy decoration-red-500 decoration-2 cursor-help">
                  {word}
                </span>
              </HoverCardTrigger>
              <HoverCardContent className="w-auto p-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Suggestions:</p>
                  {wordSuggestions.map((suggestion, i) => (
                    <div
                      key={i}
                      className="text-sm px-2 py-1 rounded hover:bg-accent cursor-pointer"
                      onClick={() => {
                        // L'utilisateur peut copier la suggestion
                        navigator.clipboard.writeText(suggestion);
                      }}
                    >
                      {suggestion}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                    Cliquez pour copier
                  </p>
                </div>
              </HoverCardContent>
            </HoverCard>
          );
        }

        return <span key={index}>{word}</span>;
      })}
    </span>
  );
};
