import { FeatureLandingPage } from "@/components/FeatureLandingPage";
import { Layout, Globe2, Smartphone } from "lucide-react";

export default function SitesVitrines() {
  return (
    <FeatureLandingPage
      title="Création de sites vitrines par IA"
      metaTitle="Créer un site vitrine professionnel par IA | VisualPro"
      metaDescription="Lancez votre site vitrine professionnel en quelques minutes avec un nom de domaine personnalisé. Idéal pour artisans, consultants et PME africaines."
      canonical="https://visuelpro.cloud/sites-vitrines"
      hero={{
        eyebrow: "Sites vitrines IA",
        heading: "Votre site vitrine professionnel en quelques minutes",
        subheading:
          "Présentez votre entreprise, vos services et vos réalisations sur un site moderne et 100% mobile. Sous-domaine gratuit sur visuelpro.cloud ou domaine personnalisé.",
        ctaPrimary: { label: "Créer mon site vitrine", to: "/auth" },
        ctaSecondary: { label: "Voir des exemples", to: "/demo" },
      }}
      benefits={[
        { icon: Layout, title: "Templates modernes", description: "Designs corporate prêts à l'emploi, personnalisables en couleurs et typographies." },
        { icon: Smartphone, title: "100% mobile-first", description: "Affichage parfait sur smartphone, tablette et ordinateur. Navigation intuitive." },
        { icon: Globe2, title: "Domaine personnalisé", description: "Connectez votre propre domaine ou utilisez un sous-domaine gratuit visuelpro.cloud." },
      ]}
      steps={[
        { title: "Choisissez un sous-domaine", description: "Réservez votre nom sur visuelpro.cloud (ex: monentreprise.visuelpro.cloud)." },
        { title: "Personnalisez les sections", description: "Ajoutez votre logo, vos services, votre blog, vos tarifs et vos témoignages." },
        { title: "Publiez en un clic", description: "Votre site est en ligne immédiatement, indexable par Google." },
      ]}
      faq={[
        { question: "Le site est-il optimisé pour Google ?", answer: "Oui, chaque site vitrine est généré avec les balises SEO essentielles : titre, description, canonical et structure sémantique." },
        { question: "Puis-je vendre directement depuis un site vitrine ?", answer: "Le site vitrine sert à présenter votre activité. Pour vendre en ligne, créez une boutique e-commerce avec VisualPro." },
        { question: "Combien coûte un domaine personnalisé ?", answer: "Le sous-domaine sur visuelpro.cloud est inclus gratuitement. Pour un domaine personnalisé (ex: monentreprise.com), il suffit de pointer le DNS vers nos serveurs." },
      ]}
    />
  );
}
