export interface ShowcaseTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  theme: string;
  icon: string;
  previewImage: string;
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
  // FORMATION TEMPLATES
  {
    id: "formation-digital",
    name: "Formation Marketing Digital",
    description: "Template pour formateurs en marketing digital",
    category: "Formation",
    theme: "professional",
    icon: "GraduationCap",
    previewImage: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=400&h=300&fit=crop",
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
    id: "formation-dev-web",
    name: "Formation Développement Web",
    description: "Template pour formateurs en programmation et développement",
    category: "Formation",
    theme: "modern",
    icon: "Code",
    previewImage: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=300&fit=crop",
    content: {
      heroTitle: "Devenez Développeur Web Professionnel",
      heroSubtitle: "Formation complète en développement web moderne. Apprenez à créer des sites et applications web performants, de la conception au déploiement.",
      aboutTitle: "Formez-vous aux Technologies d'Aujourd'hui",
      aboutDescription: "Développeur senior avec 15 ans d'expérience, j'ai formé plus de 500 développeurs qui travaillent aujourd'hui dans des entreprises tech africaines et internationales. Ma pédagogie axée sur la pratique vous garantit des compétences directement applicables.\n\nDu HTML/CSS aux frameworks modernes, en passant par les bases de données et le déploiement, vous maîtriserez toute la chaîne de développement web.",
      features: [
        {
          title: "HTML, CSS & JavaScript",
          description: "Maîtrisez les fondamentaux du web et créez des interfaces interactives"
        },
        {
          title: "React & Node.js",
          description: "Développez des applications web modernes avec les technologies les plus demandées"
        },
        {
          title: "Bases de Données & API",
          description: "Apprenez à gérer les données et créer des API REST performantes"
        },
        {
          title: "Projets Réels",
          description: "Construisez un portfolio professionnel avec 5 projets concrets"
        }
      ],
      ctaTitle: "Lancez Votre Carrière de Développeur",
      ctaDescription: "Plus de 90% de nos diplômés trouvent un emploi dans les 3 mois. Rejoignez la prochaine promotion !",
      formationTitle: "Bootcamp Développeur Web Full-Stack",
      formationDescription: "Programme intensif de 12 semaines :\n• HTML/CSS avancé et responsive design\n• JavaScript moderne (ES6+) et TypeScript\n• React.js et gestion d'état\n• Node.js, Express et bases de données\n• Git, GitHub et travail d'équipe\n• Déploiement et bonnes pratiques\n• Portfolio de 5 projets professionnels\n• Préparation aux entretiens techniques",
      formationPrice: "150 000 FCFA"
    }
  },
  {
    id: "formation-design-ui",
    name: "Formation Design UI/UX",
    description: "Template pour formateurs en design d'interface",
    category: "Formation",
    theme: "creative",
    icon: "Palette",
    previewImage: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=300&fit=crop",
    content: {
      heroTitle: "Créez des Expériences Digitales Exceptionnelles",
      heroSubtitle: "Formation UI/UX Design complète. Apprenez à concevoir des interfaces belles, intuitives et centrées sur l'utilisateur avec les outils professionnels.",
      aboutTitle: "Le Design au Service de l'Expérience",
      aboutDescription: "Designer UI/UX depuis 10 ans, j'ai travaillé sur plus de 200 projets pour des startups et grandes entreprises. Mon approche combine créativité, recherche utilisateur et méthodologie design thinking.\n\nVous apprendrez non seulement à utiliser les outils (Figma, Adobe XD) mais surtout à penser comme un designer et créer des expériences mémorables.",
      features: [
        {
          title: "Recherche Utilisateur",
          description: "Menez des études utilisateurs et créez des personas pertinents"
        },
        {
          title: "Wireframing & Prototypage",
          description: "Concevez et testez vos idées rapidement avec des prototypes interactifs"
        },
        {
          title: "Design Systems",
          description: "Créez des systèmes de design cohérents et évolutifs"
        },
        {
          title: "Figma & Adobe XD",
          description: "Maîtrisez les outils professionnels utilisés en entreprise"
        }
      ],
      ctaTitle: "Devenez Designer UI/UX",
      ctaDescription: "Créez votre portfolio et lancez votre carrière de designer. Les opportunités n'attendent que vous !",
      formationTitle: "Formation Designer UI/UX Professionnel",
      formationDescription: "Programme complet de 10 semaines :\n• Fondamentaux du design et théorie des couleurs\n• Recherche utilisateur et tests d'utilisabilité\n• Wireframing et architecture de l'information\n• Design UI et principes de l'interface\n• Prototypage interactif avec Figma\n• Design systems et composants réutilisables\n• Portfolio de 3 projets professionnels\n• Présentation et argumentation de vos designs",
      formationPrice: "100 000 FCFA"
    }
  },
  {
    id: "formation-data-analyst",
    name: "Formation Data Analyst",
    description: "Template pour formateurs en analyse de données",
    category: "Formation",
    theme: "professional",
    icon: "BarChart",
    previewImage: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&h=300&fit=crop",
    content: {
      heroTitle: "Transformez les Données en Décisions",
      heroSubtitle: "Formation Data Analyst complète. Apprenez à analyser, visualiser et interpréter les données pour guider les décisions stratégiques en entreprise.",
      aboutTitle: "L'Analyse de Données à Votre Portée",
      aboutDescription: "Data Analyst et formateur certifié, j'accompagne les professionnels dans leur transition vers les métiers de la data depuis 8 ans. Ma méthode progressive permet même aux débutants de maîtriser rapidement l'analyse de données.\n\nAvec des cas pratiques tirés d'entreprises africaines, vous développerez les compétences recherchées par les employeurs.",
      features: [
        {
          title: "Excel & SQL Avancés",
          description: "Maîtrisez les outils essentiels pour manipuler et analyser les données"
        },
        {
          title: "Python pour la Data",
          description: "Automatisez vos analyses avec Pandas, NumPy et les librairies data"
        },
        {
          title: "Visualisation de Données",
          description: "Créez des tableaux de bord percutants avec Power BI et Tableau"
        },
        {
          title: "Statistiques & Machine Learning",
          description: "Comprenez les fondamentaux des statistiques et du machine learning"
        }
      ],
      ctaTitle: "Lancez Votre Carrière Data",
      ctaDescription: "Les Data Analysts sont parmi les profils les plus recherchés. Formez-vous maintenant !",
      formationTitle: "Formation Data Analyst Certifiante",
      formationDescription: "Programme professionnel de 14 semaines :\n• Excel avancé et formules complexes\n• SQL et bases de données relationnelles\n• Python pour l'analyse de données (Pandas, NumPy)\n• Statistiques descriptives et inférentielles\n• Visualisation avec Power BI et Tableau\n• Introduction au Machine Learning\n• 4 projets d'analyse de données réelles\n• Certification reconnue par les entreprises",
      formationPrice: "120 000 FCFA"
    }
  },
  
  // CONSULTING TEMPLATES
  {
    id: "consultant-business",
    name: "Consultant Business",
    description: "Template pour consultants et coachs d'entreprise",
    category: "Consulting",
    theme: "elegant",
    icon: "Briefcase",
    previewImage: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=300&fit=crop",
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
    id: "consultant-digital-transform",
    name: "Consultant Transformation Digitale",
    description: "Template pour consultants en digitalisation",
    category: "Consulting",
    theme: "modern",
    icon: "Laptop",
    previewImage: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=400&h=300&fit=crop",
    content: {
      heroTitle: "Digitalisez Votre Entreprise avec Succès",
      heroSubtitle: "Accompagnement expert en transformation digitale. Modernisez vos processus, adoptez les technologies adaptées et propulsez votre entreprise vers le futur.",
      aboutTitle: "Expert en Transformation Digitale",
      aboutDescription: "Spécialiste de la transformation digitale depuis 10 ans, j'aide les entreprises africaines à tirer parti du numérique pour innover et se développer. Mon approche pragmatique garantit des résultats concrets et mesurables.\n\nDe l'audit initial à la mise en œuvre, je vous accompagne dans chaque étape de votre transition digitale avec des solutions adaptées à votre budget et vos objectifs.",
      features: [
        {
          title: "Audit Digital",
          description: "Évaluation complète de votre maturité digitale et identification des opportunités"
        },
        {
          title: "Stratégie Digitale",
          description: "Élaboration d'une feuille de route claire pour votre transformation"
        },
        {
          title: "Mise en Œuvre",
          description: "Accompagnement dans le déploiement des outils et formations des équipes"
        },
        {
          title: "Suivi & Optimisation",
          description: "Mesure des résultats et ajustements continus pour maximiser l'impact"
        }
      ],
      ctaTitle: "Digitalisez Votre Entreprise",
      ctaDescription: "Ne restez pas à la traîne de la révolution digitale. Contactez-moi pour discuter de votre projet.",
    }
  },
  {
    id: "consultant-rh",
    name: "Consultant RH",
    description: "Template pour consultants en ressources humaines",
    category: "Consulting",
    theme: "professional",
    icon: "Users",
    previewImage: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=300&fit=crop",
    content: {
      heroTitle: "Optimisez Votre Capital Humain",
      heroSubtitle: "Consulting RH stratégique pour PME. Recrutement, gestion des talents, formation et développement organisationnel pour des équipes performantes.",
      aboutTitle: "Votre Partenaire RH",
      aboutDescription: "Consultante RH certifiée avec 12 ans d'expérience auprès de PME africaines, j'apporte des solutions concrètes pour attirer, développer et retenir les meilleurs talents. Ma connaissance approfondie du marché local fait la différence.\n\nJe vous aide à construire une fonction RH moderne et efficace, alignée avec vos objectifs business.",
      features: [
        {
          title: "Recrutement Stratégique",
          description: "Processus de recrutement optimisés pour attirer les meilleurs profils"
        },
        {
          title: "Gestion des Talents",
          description: "Évaluation, développement et rétention de vos collaborateurs clés"
        },
        {
          title: "Formation & Coaching",
          description: "Programmes de développement des compétences sur-mesure"
        },
        {
          title: "Culture d'Entreprise",
          description: "Construction d'une culture forte et engageante"
        }
      ],
      ctaTitle: "Développez Vos Talents",
      ctaDescription: "Investissez dans votre capital humain. Discutons de vos besoins RH.",
    }
  },
  
  // SERVICES TEMPLATES
  {
    id: "agence-web",
    name: "Agence Web & Design",
    description: "Template pour agences digitales et web",
    category: "Services",
    theme: "creative",
    icon: "Palette",
    previewImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop",
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
    id: "service-comptable",
    name: "Cabinet Comptable",
    description: "Template pour cabinets comptables et experts-comptables",
    category: "Services",
    theme: "elegant",
    icon: "Calculator",
    previewImage: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&fit=crop",
    content: {
      heroTitle: "Votre Expert Comptable de Confiance",
      heroSubtitle: "Services comptables complets pour TPE et PME. Comptabilité, fiscalité, conseil financier - Libérez-vous des contraintes administratives.",
      aboutTitle: "Excellence Comptable",
      aboutDescription: "Cabinet d'expertise comptable établi depuis 15 ans, nous accompagnons les entrepreneurs dans la gestion comptable et fiscale de leur entreprise. Notre équipe expérimentée garantit conformité et conseil personnalisé.\n\nDe la tenue comptable aux déclarations fiscales, en passant par le conseil en gestion, nous sommes votre partenaire pour une comptabilité sereine.",
      features: [
        {
          title: "Tenue Comptable",
          description: "Gestion complète de votre comptabilité avec outils digitaux modernes"
        },
        {
          title: "Fiscalité",
          description: "Déclarations fiscales et optimisation de votre charge fiscale"
        },
        {
          title: "Conseil Financier",
          description: "Tableaux de bord et analyse financière pour piloter votre activité"
        },
        {
          title: "Accompagnement",
          description: "Support réactif et conseils personnalisés tout au long de l'année"
        }
      ],
      ctaTitle: "Simplifiez Votre Comptabilité",
      ctaDescription: "Concentrez-vous sur votre cœur de métier, nous gérons votre comptabilité. Contactez-nous pour un devis.",
    }
  },
  {
    id: "service-juridique",
    name: "Cabinet d'Avocat",
    description: "Template pour avocats et cabinets juridiques",
    category: "Services",
    theme: "professional",
    icon: "Scale",
    previewImage: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=300&fit=crop",
    content: {
      heroTitle: "Défendez Vos Intérêts avec Excellence",
      heroSubtitle: "Cabinet d'avocats spécialisé en droit des affaires et droit du travail. Conseil juridique, contentieux et accompagnement des entreprises.",
      aboutTitle: "Votre Avocat d'Affaires",
      aboutDescription: "Avocat au barreau depuis 18 ans, je conseille et défends les entreprises dans leurs problématiques juridiques. Mon expertise couvre le droit des sociétés, le droit commercial et le droit du travail.\n\nProximité, réactivité et excellence juridique sont les piliers de mon cabinet. Je vous accompagne dans toutes vos démarches avec professionnalisme.",
      features: [
        {
          title: "Droit des Sociétés",
          description: "Création, restructuration et gouvernance d'entreprise"
        },
        {
          title: "Contrats Commerciaux",
          description: "Rédaction et négociation de tous types de contrats"
        },
        {
          title: "Droit du Travail",
          description: "Conseil et contentieux en relations individuelles et collectives"
        },
        {
          title: "Contentieux",
          description: "Représentation et défense devant toutes les juridictions"
        }
      ],
      ctaTitle: "Protégez Votre Entreprise",
      ctaDescription: "Une question juridique ? Besoin d'un avocat ? Prenez rendez-vous pour une consultation.",
    }
  },
  
  // COACHING TEMPLATES
  {
    id: "coach-personnel",
    name: "Coach Personnel",
    description: "Template pour coachs de vie et développement personnel",
    category: "Coaching",
    theme: "vibrant",
    icon: "Heart",
    previewImage: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=300&fit=crop",
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
    id: "coach-business",
    name: "Coach Business",
    description: "Template pour coachs d'entrepreneurs",
    category: "Coaching",
    theme: "professional",
    icon: "TrendingUp",
    previewImage: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&h=300&fit=crop",
    content: {
      heroTitle: "Propulsez Votre Business",
      heroSubtitle: "Coaching pour entrepreneurs ambitieux. Stratégie, croissance et mindset d'entrepreneur pour bâtir un business florissant.",
      aboutTitle: "Votre Coach Business",
      aboutDescription: "Entrepreneur et coach certifié, j'accompagne les créateurs d'entreprise à concrétiser leur vision et développer leur activité. Mon approche mêle stratégie business et développement personnel.",
      features: [
        {
          title: "Stratégie Business",
          description: "Définissez votre modèle économique et votre plan de croissance"
        },
        {
          title: "Mindset Entrepreneur",
          description: "Développez la mentalité gagnante des entrepreneurs à succès"
        },
        {
          title: "Scaling",
          description: "Passez à l'échelle supérieure et multipliez votre chiffre d'affaires"
        },
        {
          title: "Accountability",
          description: "Restez focus sur vos objectifs avec un suivi régulier"
        }
      ],
      ctaTitle: "Accélérez Votre Croissance",
      ctaDescription: "Prenez rendez-vous pour une session stratégique gratuite.",
    }
  },
  
  // ART & CRÉATIF TEMPLATES
  {
    id: "photographe",
    name: "Photographe Professionnel",
    description: "Template pour photographes et artistes visuels",
    category: "Art & Créatif",
    theme: "modern",
    icon: "Camera",
    previewImage: "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=400&h=300&fit=crop",
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
    id: "graphiste",
    name: "Designer Graphique",
    description: "Template pour graphistes et designers",
    category: "Art & Créatif",
    theme: "creative",
    icon: "Brush",
    previewImage: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400&h=300&fit=crop",
    content: {
      heroTitle: "Donnez Vie à Votre Marque",
      heroSubtitle: "Designer graphique freelance spécialisé en identité visuelle et communication. Créons ensemble une image qui vous ressemble et marque les esprits.",
      aboutTitle: "Design Créatif & Stratégique",
      aboutDescription: "Designer graphique passionné depuis 8 ans, je crée des identités visuelles percutantes pour les marques africaines. Mon travail allie créativité, stratégie et compréhension de votre marché.",
      features: [
        {
          title: "Identité Visuelle",
          description: "Logos, chartes graphiques et supports cohérents"
        },
        {
          title: "Communication Digitale",
          description: "Visuels réseaux sociaux, bannières web et publicités"
        },
        {
          title: "Print",
          description: "Cartes de visite, flyers, brochures et packaging"
        },
        {
          title: "Branding",
          description: "Stratégie de marque complète et positionnement visuel"
        }
      ],
      ctaTitle: "Créons Votre Identité",
      ctaDescription: "Parlons de votre projet créatif. Devis gratuit.",
    }
  },
  
  // RESTAURATION TEMPLATES
  {
    id: "restaurant",
    name: "Restaurant & Traiteur",
    description: "Template pour restaurants, cafés et services traiteur",
    category: "Restauration",
    theme: "elegant",
    icon: "UtensilsCrossed",
    previewImage: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop",
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
  },
  {
    id: "cafe-moderne",
    name: "Café & Pâtisserie",
    description: "Template pour cafés, salons de thé et pâtisseries",
    category: "Restauration",
    theme: "modern",
    icon: "Coffee",
    previewImage: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&h=300&fit=crop",
    content: {
      heroTitle: "Votre Pause Gourmande Préférée",
      heroSubtitle: "Café artisanal et pâtisseries maison. Savourez des moments uniques dans une ambiance chaleureuse et conviviale.",
      aboutTitle: "Passion du Café & Pâtisserie",
      aboutDescription: "Notre café propose des boissons artisanales et des pâtisseries faites maison avec amour. Chaque visite est une expérience sensorielle unique dans un cadre moderne et accueillant.",
      features: [
        {
          title: "Café Artisanal",
          description: "Sélection de cafés d'origine préparés par des baristas passionnés"
        },
        {
          title: "Pâtisseries Maison",
          description: "Créations quotidiennes fraîches et savoureuses"
        },
        {
          title: "Ambiance Cosy",
          description: "Espace confortable parfait pour le travail ou la détente"
        },
        {
          title: "Wifi Gratuit",
          description: "Connexion haut débit pour travailler en toute sérénité"
        }
      ],
      ctaTitle: "Venez Nous Découvrir",
      ctaDescription: "Passez nous voir et laissez-vous tenter par nos spécialités. Commandes à emporter disponibles.",
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
