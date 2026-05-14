import { FeatureLandingPage } from "@/components/FeatureLandingPage";
import { Film, Sparkles, Play } from "lucide-react";

export default function VideosPublicitaires() {
  return (
    <FeatureLandingPage
      title="Création de vidéos publicitaires par IA"
      metaTitle="Créer des vidéos publicitaires IA en Afrique | VisualPro"
      metaDescription="Transformez vos produits en vidéos publicitaires animées en quelques minutes grâce à l'intelligence artificielle. Idéal pour Facebook, Instagram Reels et TikTok."
      canonical="https://visuelpro.cloud/videos-publicitaires"
      hero={{
        eyebrow: "Vidéos publicitaires IA",
        heading: "Vidéos publicitaires automatiques pour vos campagnes",
        subheading:
          "Générez des vidéos publicitaires animées à partir d'une simple image ou description. Format vertical pour Reels, TikTok et Shorts, ou horizontal pour YouTube et Facebook.",
        ctaPrimary: { label: "Créer une vidéo gratuitement", to: "/auth" },
        ctaSecondary: { label: "Voir des exemples", to: "/demo" },
      }}
      benefits={[
        { icon: Film, title: "Animation automatique", description: "L'IA anime vos images avec mouvements de caméra, transitions et effets professionnels." },
        { icon: Sparkles, title: "Voix off incluse", description: "Ajoutez une voix off française naturelle générée par IA pour renforcer votre message." },
        { icon: Play, title: "Tous les formats", description: "9:16 pour Reels et TikTok, 16:9 pour YouTube, 1:1 pour Instagram — un seul clic." },
      ]}
      steps={[
        { title: "Importez une image ou décrivez votre produit", description: "L'IA part de votre visuel ou crée tout depuis votre description." },
        { title: "Choisissez le format et la durée", description: "Sélectionnez 5, 10 ou 15 secondes selon votre objectif marketing." },
        { title: "Téléchargez votre vidéo MP4", description: "La vidéo finale est prête à publier sur tous vos réseaux sociaux." },
      ]}
      faq={[
        { question: "Combien de temps prend une génération ?", answer: "Une vidéo publicitaire est générée en 60 à 90 secondes en moyenne. Vous suivez la progression en temps réel." },
        { question: "Puis-je ajouter ma musique ?", answer: "Oui, vous pouvez importer votre piste audio ou utiliser la bibliothèque musicale intégrée." },
        { question: "Quelle qualité vidéo ?", answer: "Les vidéos sont exportées en HD, optimisées pour les algorithmes des réseaux sociaux." },
      ]}
    />
  );
}
