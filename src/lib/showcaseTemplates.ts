export interface ShowcaseTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  theme: string;
  icon: string;
  content: {
    heroTitle: string;
    heroSubtitle: string;
    aboutTitle: string;
    aboutDescription: string;
    features: Array<{ title: string; description: string }>;
    ctaTitle: string;
    ctaDescription: string;
    formationTitle?: string;
    formationDescription?: string;
    formationPrice?: string;
  };
}

export const showcaseTemplates: ShowcaseTemplate[] = [
  {
    id: "formation-digital",
    name: "Formation Marketing Digital",
    description: "Template pour formateurs en marketing digital",
    category: "Formation",
    theme: "professional",
    icon: "GraduationCap",
    content: {
      heroTitle: "Maîtrisez le Marketing Digital en Afrique",
      heroSubtitle: "Formations complètes et pratiques pour propulser votre business en ligne. Devenez expert en stratégie digitale, réseaux sociaux et publicité en ligne.",
      aboutTitle: "Une Formation Adaptée au Marché Africain",
      aboutDescription: "Avec plus de 10 ans d'expérience dans le marketing digital en Afrique, je vous accompagne dans la transformation digitale de votre entreprise. Ma formation combine théorie et pratique avec des cas réels du marché africain.\n\nVous apprendrez à créer des stratégies efficaces, gérer vos réseaux sociaux professionnellement, et optimiser votre retour sur investissement publicitaire.",
      features: [
        {
          title: "Stratégie Digitale",
          description: "Créez une stratégie digitale complète adaptée à votre marché et vos objectifs business"
        },
        {
          title: "Réseaux Sociaux",
          description: "Maîtrisez Facebook, Instagram, LinkedIn et TikTok pour développer votre audience"
        },
        {
          title: "Publicité en Ligne",
          description: "Lancez des campagnes publicitaires rentables sur Google et les réseaux sociaux"
        },
        {
          title: "Accompagnement Personnalisé",
          description: "Bénéficiez d'un suivi individuel et de sessions de coaching tout au long de votre formation"
        }
      ],
      ctaTitle: "Prêt à Transformer Votre Business ?",
      ctaDescription: "Rejoignez des centaines d'entrepreneurs qui ont déjà boosté leur activité grâce à nos formations. Inscrivez-vous dès aujourd'hui !",
      formationTitle: "Formation Marketing Digital Complète",
      formationDescription: "Programme de 8 semaines incluant :\n• Stratégie digitale et positionnement\n• Community management professionnel\n• Publicité Facebook et Instagram Ads\n• Google Ads et SEO\n• Analyse de performance et ROI\n• Certificat de fin de formation\n• Accès à vie aux supports de cours\n• Groupe WhatsApp privé pour les questions",
      formationPrice: "75 000 FCFA"
    }
  },
  {
    id: "consultant-business",
    name: "Consultant Business",
    description: "Template pour consultants et coachs d'entreprise",
    category: "Consulting",
    theme: "elegant",
    icon: "Briefcase",
    content: {
      heroTitle: "Accélérez la Croissance de Votre Entreprise",
      heroSubtitle: "Consulting stratégique et accompagnement personnalisé pour les PME africaines ambitieuses. Transformez vos défis en opportunités de croissance.",
      aboutTitle: "Un Partenaire pour Votre Réussite",
      aboutDescription: "Expert en stratégie d'entreprise depuis 15 ans, j'ai accompagné plus de 200 PME africaines dans leur développement. Mon approche combine analyse stratégique rigoureuse et solutions pragmatiques adaptées au contexte local.\n\nEnsemble, nous identifierons vos leviers de croissance, optimiserons vos processus et développerons des stratégies gagnantes pour propulser votre entreprise vers le succès.",
      features: [
        {
          title: "Stratégie d'Entreprise",
          description: "Élaboration de plans stratégiques sur-mesure pour atteindre vos objectifs de croissance"
        },
        {
          title: "Optimisation Opérationnelle",
          description: "Amélioration de vos processus et systèmes pour gagner en efficacité et rentabilité"
        },
        {
          title: "Développement Commercial",
          description: "Stratégies de vente et techniques pour augmenter votre chiffre d'affaires"
        },
        {
          title: "Gestion d'Équipe",
          description: "Leadership et management pour bâtir des équipes performantes et motivées"
        }
      ],
      ctaTitle: "Passons à l'Action Ensemble",
      ctaDescription: "Contactez-moi pour un audit gratuit de 30 minutes et découvrez comment booster la performance de votre entreprise.",
    }
  },
  {
    id: "agence-web",
    name: "Agence Web & Design",
    description: "Template pour agences digitales et web",
    category: "Services",
    theme: "creative",
    icon: "Palette",
    content: {
      heroTitle: "Créons Ensemble Votre Présence Digitale",
      heroSubtitle: "Agence digitale spécialisée en création de sites web, applications mobiles et identité visuelle. Donnez vie à vos projets avec des solutions modernes et performantes.",
      aboutTitle: "Votre Agence Digitale de Confiance",
      aboutDescription: "Notre équipe de designers et développeurs passionnés crée des expériences digitales exceptionnelles depuis 2018. Nous combinons créativité et expertise technique pour livrer des projets qui dépassent vos attentes.\n\nDu concept initial au lancement, nous vous accompagnons à chaque étape avec professionnalisme et transparence. Chaque projet est unique et mérite une attention particulière.",
      features: [
        {
          title: "Sites Web Sur-Mesure",
          description: "Création de sites web modernes, rapides et optimisés pour tous les appareils"
        },
        {
          title: "Applications Mobile",
          description: "Développement d'applications iOS et Android intuitives et performantes"
        },
        {
          title: "Identité Visuelle",
          description: "Design de logos, chartes graphiques et supports de communication percutants"
        },
        {
          title: "Maintenance & Support",
          description: "Assistance continue et mises à jour régulières pour garantir la performance"
        }
      ],
      ctaTitle: "Démarrons Votre Projet",
      ctaDescription: "Parlons de vos besoins et créons ensemble une solution digitale qui fera la différence. Contactez-nous pour un devis gratuit.",
    }
  },
  {
    id: "coach-personnel",
    name: "Coach Personnel",
    description: "Template pour coachs de vie et développement personnel",
    category: "Coaching",
    theme: "vibrant",
    icon: "Heart",
    content: {
      heroTitle: "Révélez Votre Plein Potentiel",
      heroSubtitle: "Coaching personnel et professionnel pour atteindre vos objectifs et vivre une vie épanouie. Ensemble, dépassons vos limites et créons la vie que vous méritez.",
      aboutTitle: "Votre Transformation Commence Ici",
      aboutDescription: "Coach certifié en développement personnel depuis 8 ans, j'ai accompagné des centaines de personnes dans leur transformation personnelle et professionnelle. Ma méthode allie écoute bienveillante, techniques éprouvées et accountability.\n\nQue vous cherchiez à améliorer votre confiance, clarifier vos objectifs, ou transformer votre carrière, je vous guide pas à pas vers la meilleure version de vous-même.",
      features: [
        {
          title: "Clarté & Vision",
          description: "Définissez vos objectifs de vie et créez un plan d'action concret et réalisable"
        },
        {
          title: "Confiance en Soi",
          description: "Développez une confiance solide et surmontez les croyances limitantes"
        },
        {
          title: "Équilibre de Vie",
          description: "Trouvez l'harmonie entre vie professionnelle, personnelle et bien-être"
        },
        {
          title: "Accountability",
          description: "Restez motivé et engagé grâce à un suivi régulier et un soutien constant"
        }
      ],
      ctaTitle: "Prêt pour le Changement ?",
      ctaDescription: "Offrez-vous la chance de vivre pleinement. Réservez votre session découverte gratuite et commencez votre transformation aujourd'hui.",
    }
  },
  {
    id: "photographe",
    name: "Photographe Professionnel",
    description: "Template pour photographes et artistes visuels",
    category: "Art & Créatif",
    theme: "modern",
    icon: "Camera",
    content: {
      heroTitle: "Immortalisez Vos Moments Précieux",
      heroSubtitle: "Photographe professionnel spécialisé en portraits, événements et reportages. Capturer l'émotion, raconter votre histoire à travers des images authentiques et intemporelles.",
      aboutTitle: "La Photographie, Ma Passion",
      aboutDescription: "Photographe professionnel depuis 12 ans, je capture les moments qui comptent avec sensibilité et créativité. Mon style allie spontanéité et direction artistique pour créer des images qui vous ressemblent.\n\nChaque shooting est une collaboration où votre vision rencontre mon expertise technique et artistique. Ensemble, nous créons des souvenirs visuels qui traverseront le temps.",
      features: [
        {
          title: "Portraits Professionnels",
          description: "Photos corporate, CV, réseaux sociaux - mettez votre meilleur profil en avant"
        },
        {
          title: "Événements",
          description: "Mariages, baptêmes, anniversaires - vos célébrations immortalisées avec émotion"
        },
        {
          title: "Reportages",
          description: "Couverture d'événements d'entreprise, conférences et occasions spéciales"
        },
        {
          title: "Retouches Professionnelles",
          description: "Post-production soignée pour sublimer chaque image selon vos préférences"
        }
      ],
      ctaTitle: "Créons Ensemble Vos Souvenirs",
      ctaDescription: "Réservez votre séance photo et laissez-moi capturer vos moments les plus précieux. Disponibilité limitée, contactez-moi dès maintenant.",
    }
  },
  {
    id: "restaurant",
    name: "Restaurant & Traiteur",
    description: "Template pour restaurants, cafés et services traiteur",
    category: "Restauration",
    theme: "elegant",
    icon: "UtensilsCrossed",
    content: {
      heroTitle: "Savourez l'Excellence Culinaire",
      heroSubtitle: "Restaurant gastronomique et service traiteur haut de gamme. Découvrez une cuisine raffinée qui célèbre les saveurs authentiques et les produits locaux de qualité.",
      aboutTitle: "Notre Histoire Gourmande",
      aboutDescription: "Depuis 2015, notre restaurant est une référence de la gastronomie locale. Notre chef et son équipe passionnée créent des plats qui éveillent les sens et racontent une histoire à travers chaque bouchée.\n\nNous privilégions les circuits courts et les producteurs locaux pour vous offrir une cuisine fraîche, savoureuse et responsable. Que ce soit pour un dîner romantique, un événement d'entreprise ou une célébration familiale, nous vous promettons une expérience culinaire mémorable.",
      features: [
        {
          title: "Cuisine Authentique",
          description: "Des recettes traditionnelles revisitées avec créativité et savoir-faire"
        },
        {
          title: "Produits Locaux",
          description: "Ingrédients frais sélectionnés auprès de producteurs locaux de confiance"
        },
        {
          title: "Service Traiteur",
          description: "Prestations sur-mesure pour tous vos événements privés et professionnels"
        },
        {
          title: "Ambiance Chaleureuse",
          description: "Cadre élégant et accueil convivial pour des moments inoubliables"
        }
      ],
      ctaTitle: "Réservez Votre Table",
      ctaDescription: "Offrez-vous une expérience gastronomique exceptionnelle. Contactez-nous pour réserver ou discuter de votre événement.",
    }
  }
];

export const templateCategories = [
  "Tous",
  "Formation",
  "Consulting",
  "Services",
  "Coaching",
  "Art & Créatif",
  "Restauration"
];
