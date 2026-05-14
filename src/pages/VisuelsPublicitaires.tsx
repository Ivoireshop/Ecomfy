import { FeatureLandingPage } from "@/components/FeatureLandingPage";
import { Zap, Target, Globe2 } from "lucide-react";

export default function VisuelsPublicitaires() {
  return (
    <FeatureLandingPage
      title="Création de visuels publicitaires par IA"
      metaTitle="Créer des visuels publicitaires IA en Afrique | VisualPro"
      metaDescription="Générez des visuels publicitaires professionnels pour Facebook, Instagram, TikTok et WhatsApp en moins d'une minute, adaptés au marché africain. Essai gratuit."
      canonical="https://visuelpro.cloud/visuels-publicitaires"
      hero={{
        eyebrow: "Visuels publicitaires IA",
        heading: "Créez des visuels publicitaires professionnels en moins d'une minute",
        subheading:
          "VisualPro génère vos publicités Facebook, Instagram, TikTok et WhatsApp avec une intelligence artificielle entraînée pour le marché africain. Aucune compétence en design requise.",
        ctaPrimary: { label: "Créer un visuel gratuitement", to: "/auth" },
        ctaSecondary: { label: "Voir une démo", to: "/demo" },
      }}
      benefits={[
        { icon: Zap, title: "Ultra rapide", description: "Un visuel prêt à publier en moins de 60 secondes, optimisé pour chaque réseau social." },
        { icon: Target, title: "Conçu pour l'Afrique", description: "Mannequins, contextes et messages adaptés aux audiences africaines francophones." },
        { icon: Globe2, title: "Tous les formats", description: "Facebook, Instagram, TikTok, WhatsApp et bannières — tout est généré en une seule action." },
      ]}
      steps={[
        { title: "Décrivez votre produit", description: "Ajoutez un nom, des bénéfices et un prix. Importez une image si vous le souhaitez." },
        { title: "L'IA génère le visuel", description: "Mannequin, mise en page, accroche et appel à l'action générés automatiquement." },
        { title: "Téléchargez et publiez", description: "Récupérez votre visuel haute définition prêt à publier sur tous vos réseaux." },
      ]}
      faq={[
        { question: "Combien coûte la création d'un visuel ?", answer: "VisualPro propose un essai gratuit avec plusieurs générations offertes. Ensuite, des packs de jetons en FCFA et un abonnement Business à 65 000 FCFA/mois sont disponibles." },
        { question: "Les visuels sont-ils utilisables commercialement ?", answer: "Oui, tous les visuels générés sont libres de droits pour vos campagnes publicitaires et vos publications professionnelles." },
        { question: "Puis-je modifier le texte après génération ?", answer: "Oui, l'éditeur intégré vous permet d'ajuster le texte, les couleurs et les éléments visuels avant téléchargement." },
      ]}
    />
  );
}
