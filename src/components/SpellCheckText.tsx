import { useState } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

// Dictionnaire de corrections communes en français (enrichi pour le marketing africain)
const commonCorrections: Record<string, string[]> = {
  // Orthographe générale
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
  "metre": ["mettre", "mètre"],
  "offre": ["offre"],
  "ou": ["où"],
  "pret": ["prêt"],
  "probleme": ["problème"],
  "qualite": ["qualité"],
  "rapide": ["rapide"],
  "reussi": ["réussi"],
  "sa": ["ça"],
  "tjs": ["toujours"],
  "tres": ["très"],
  "vraiement": ["vraiment"],
  
  // Termes commerciaux et marketing
  "achetez": ["achetez"],
  "acheter": ["acheter"],
  "commandez": ["commandez"],
  "commander": ["commander"],
  "livraison": ["livraison"],
  "livreson": ["livraison"],
  "promocion": ["promotion"],
  "promotions": ["promotions"],
  "reduction": ["réduction"],
  "redution": ["réduction"],
  "soldes": ["soldes"],
  "destockage": ["déstockage"],
  "destock": ["déstockage"],
  "profitez": ["profitez"],
  "economisez": ["économisez"],
  "economiser": ["économiser"],
  "remise": ["remise"],
  "rabais": ["rabais"],
  "pourcentage": ["pourcentage"],
  "pourcent": ["pourcent", "pour cent"],
  
  // Prix et monnaie (Afrique francophone)
  "franc": ["franc"],
  "francs": ["francs"],
  "cfa": ["CFA"],
  "fcfa": ["FCFA"],
  "frs": ["francs"],
  "xof": ["XOF"],
  "xaf": ["XAF"],
  
  // Appels à l'action marketing
  "contactez": ["contactez"],
  "contacter": ["contacter"],
  "appellez": ["appelez"],
  "appeler": ["appeler"],
  "decouvrez": ["découvrez"],
  "decouvrir": ["découvrir"],
  "essayez": ["essayez"],
  "essayer": ["essayer"],
  "reservez": ["réservez"],
  "reserver": ["réserver"],
  "inscrivez": ["inscrivez"],
  "inscrire": ["inscrire"],
  "telechargez": ["téléchargez"],
  "telecharger": ["télécharger"],
  "cliquez": ["cliquez"],
  "commencez": ["commencez"],
  
  // Termes de qualité et bénéfices
  "authentique": ["authentique"],
  "authantique": ["authentique"],
  "certifie": ["certifié"],
  "certificate": ["certificat"],
  "veritable": ["véritable"],
  "original": ["original"],
  "originale": ["originale"],
  "exclusif": ["exclusif"],
  "exclusive": ["exclusive"],
  "unique": ["unique"],
  "exceptionnel": ["exceptionnel"],
  "exceptionnelle": ["exceptionnelle"],
  "superieur": ["supérieur"],
  "superieure": ["supérieure"],
  "premium": ["premium"],
  "luxe": ["luxe"],
  "luxueux": ["luxueux"],
  "luxueuse": ["luxueuse"],
  
  // Termes de livraison et service
  "disponible": ["disponible"],
  "disponibles": ["disponibles"],
  "dispo": ["disponible"],
  "stock": ["stock"],
  "stocks": ["stocks"],
  "rupture": ["rupture"],
  "epuise": ["épuisé"],
  "epuisee": ["épuisée"],
  "nouveau": ["nouveau"],
  "nouvelle": ["nouvelle"],
  "nouveaute": ["nouveauté"],
  "nouveautes": ["nouveautés"],
  "arrive": ["arrivé"],
  "arrivee": ["arrivée"],
  "expedie": ["expédié"],
  "expedition": ["expédition"],
  "delai": ["délai"],
  "delais": ["délais"],
  
  // Termes de beauté et cosmétiques
  "beaute": ["beauté"],
  "eclat": ["éclat"],
  "eclatant": ["éclatant"],
  "eclatante": ["éclatante"],
  "eclaircissant": ["éclaircissant"],
  "eclaircissante": ["éclaircissante"],
  "hydratant": ["hydratant"],
  "hydratante": ["hydratante"],
  "nourrissant": ["nourrissant"],
  "nourrissante": ["nourrissante"],
  "naturel": ["naturel"],
  "naturelle": ["naturelle"],
  "bio": ["bio"],
  "biologique": ["biologique"],
  
  // Termes de santé et bien-être
  "sante": ["santé"],
  "bien etre": ["bien-être"],
  "bien-etre": ["bien-être"],
  "bienfait": ["bienfait"],
  "bienfaits": ["bienfaits"],
  "benefice": ["bénéfice"],
  "benefices": ["bénéfices"],
  "efficacite": ["efficacité"],
  "resultat": ["résultat"],
  "resultats": ["résultats"],
  "vitamine": ["vitamine"],
  "vitamines": ["vitamines"],
  "proteine": ["protéine"],
  "proteines": ["protéines"],
  "energie": ["énergie"],
  "energisant": ["énergisant"],
  "energisante": ["énergisante"],
  
  // Termes temporels marketing
  "limite": ["limité"],
  "limitee": ["limitée"],
  "temporaire": ["temporaire"],
  "urgent": ["urgent"],
  "urgente": ["urgente"],
  "dernier": ["dernier"],
  "derniere": ["dernière"],
  "derniers": ["derniers"],
  "dernieres": ["dernières"],
  "aujourd'hui": ["aujourd'hui"],
  "aujourd hui": ["aujourd'hui"],
  "maintenant": ["maintenant"],
  "immediatement": ["immédiatement"],
  
  // Termes de satisfaction client
  "satisfait": ["satisfait"],
  "satisfaite": ["satisfaite"],
  "satisfaction": ["satisfaction"],
  "garanti": ["garanti"],
  "garantie": ["garantie"],
  "rembourse": ["remboursé"],
  "remboursee": ["remboursée"],
  "remboursement": ["remboursement"],
  "confiance": ["confiance"],
  "fiable": ["fiable"],
  "securise": ["sécurisé"],
  "securisee": ["sécurisée"],
  
  // Termes de quantité et mesure
  "grammes": ["grammes"],
  "gramme": ["gramme"],
  "kilogrammes": ["kilogrammes"],
  "kilogramme": ["kilogramme"],
  "litres": ["litres"],
  "litre": ["litre"],
  "millilitres": ["millilitres"],
  "millilitre": ["millilitre"],
  "pieces": ["pièces"],
  "piece": ["pièce"],
  "unite": ["unité"],
  "unites": ["unités"],
  "paquet": ["paquet"],
  "paquets": ["paquets"],
  "boite": ["boîte"],
  "boites": ["boîtes"],
  
  // Erreurs courantes de frappe
  "aceuil": ["accueil"],
  "acceuil": ["accueil"],
  "adresse": ["adresse"],
  "adress": ["adresse"],
  "aparaitre": ["apparaître"],
  "apprendre": ["apprendre"],
  "apropos": ["à propos"],
  "a propos": ["à propos"],
  "developper": ["développer"],
  "developement": ["développement"],
  "environment": ["environnement"],
  "professionel": ["professionnel"],
  "professionelle": ["professionnelle"],
};

// Mots à ignorer (noms de marques, termes spécifiques, abréviations courantes)
const ignoreWords = new Set([
  // Monnaies et codes
  "fcfa", "xof", "xaf", "cfa", "usd", "eur",
  // Réseaux sociaux et plateformes
  "whatsapp", "facebook", "instagram", "tiktok", "youtube", "twitter", "linkedin",
  "snap", "snapchat", "telegram", "messenger",
  // Termes marketing courants en anglais
  "promo", "deal", "deals", "flash", "sale", "sales", "shop", "online",
  // Abréviations courantes
  "tel", "tél", "gsm", "sms", "app", "web", "mail", "email", "dm",
  // Termes africains spécifiques
  "afro", "african", "africa", "black", "naija", "ivoire", "senegal",
  // Marques communes (à adapter selon le contexte)
  "samsung", "apple", "nike", "adidas", "gucci", "chanel", "dior"
]);

interface SpellCheckTextProps {
  text: string;
  className?: string;
  onWordReplace?: (originalWord: string, newWord: string) => void;
}

export const SpellCheckText = ({ text, className = "", onWordReplace }: SpellCheckTextProps) => {
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
                        if (onWordReplace) {
                          onWordReplace(trimmedWord, suggestion);
                        } else {
                          navigator.clipboard.writeText(suggestion);
                        }
                      }}
                    >
                      {suggestion}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                    {onWordReplace ? "Cliquez pour remplacer" : "Cliquez pour copier"}
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
