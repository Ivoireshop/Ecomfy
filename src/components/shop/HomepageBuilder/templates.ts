import { HomepageConfig, HomepageSection } from "./types";

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  icon_label: string;
  badge?: string;
  config: Partial<HomepageConfig>;
}

export const HOMEPAGE_TEMPLATES: TemplateDefinition[] = [
  {
    id: "classic",
    name: "Boutique Classique",
    description: "Layout équilibré idéal pour tout type de boutique e-commerce.",
    icon_label: "🏬",
    config: {
      enabled: true,
      template_slug: "classic",
      global_styles: {
        button_radius: "rounded-xl",
      },
      sections: [
        {
          id: "hero-1",
          type: "hero",
          enabled: true,
          settings: {
            title: "Bienvenue dans notre boutique",
            subtitle: "Qualité exceptionnelle & Livraison rapide partout",
            description: "Découvrez notre sélection exclusive de produits premium au meilleur prix.",
            badge: "🔥 Offre Limitée",
            bg_type: "gradient",
            bg_gradient: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
            text_color: "#FFFFFF",
            primary_button_text: "Acheter maintenant",
            primary_button_link_type: "products",
            secondary_button_text: "En savoir plus",
            secondary_button_link_type: "custom",
            content_alignment: "center",
            height: "medium",
          },
        },
        {
          id: "features-1",
          type: "features",
          enabled: true,
          settings: {
            title: "Nos Engagements",
            items: [
              { id: "f1", icon_name: "truck", title: "Livraison Rapide", description: "Expédition sous 24h à 48h partout" },
              { id: "f2", icon_name: "shield", title: "Paiement Sécurisé", description: "Paiement à la livraison ou Mobile Money" },
              { id: "f3", icon_name: "phone", title: "Support Client", description: "Assistance WhatsApp 7j/7" },
            ],
          },
        },
        {
          id: "products-1",
          type: "products_grid",
          enabled: true,
          settings: {
            title: "Nos Produits Vedettes",
            subtitle: "Sélectionnés spécialement pour vous",
            selection_rule: "all",
            limit: 8,
            columns_desktop: 4,
            columns_mobile: 2,
            button_text: "Commander",
            button_action: "checkout",
            show_compare_price: true,
            show_stock_badge: true,
          },
        },
        {
          id: "testimonials-1",
          type: "testimonials",
          enabled: true,
          settings: {
            title: "Ce que disent nos clients",
            subtitle: "Avis vérifiés de nos acheteurs",
            items: [
              { id: "t1", author_name: "Awa Kouadio", author_role: "Acheteuse vérifiée", rating: 5, content: "Superbe expérience ! Produit conforme et livraison reçue très rapidement." },
              { id: "t2", author_name: "Koffi Emmanuel", author_role: "Client fidèle", rating: 5, content: "Service client très réactif sur WhatsApp. Je recommande les yeux fermés !" },
            ],
          },
        },
        {
          id: "faq-1",
          type: "faq",
          enabled: true,
          settings: {
            title: "Foire Aux Questions",
            subtitle: "Toutes les réponses à vos interrogations",
            items: [
              { id: "q1", question: "Quels sont les modes de paiement disponibles ?", answer: "Nous acceptons le paiement à la livraison, Mobile Money (Orange, MTN, Wave, Moov) et carte bancaire." },
              { id: "q2", question: "Combien de temps prend la livraison ?", answer: "La livraison prend généralement entre 24h et 48h ouvrables selon votre région." },
            ],
          },
        },
        {
          id: "footer-1",
          type: "footer_custom",
          enabled: true,
          settings: {
            business_description: "Votre destination e-commerce de confiance pour des produits authentiques et de qualité.",
            show_social_links: true,
            show_payment_badges: true,
            copyright_text: "© Tous droits réservés.",
          },
        },
      ],
    },
  },
  {
    id: "fashion",
    name: "Boutique Mode & Lifestyle",
    description: "Design moderne avec bannières visuelles pour marques et vêtements.",
    icon_label: "👗",
    config: {
      enabled: true,
      template_slug: "fashion",
      global_styles: {
        button_radius: "rounded-full",
      },
      sections: [
        {
          id: "hero-fashion",
          type: "hero",
          enabled: true,
          settings: {
            title: "Nouvelle Collection",
            subtitle: "Style & Élégance au Quotidien",
            description: "Exprimez votre personnalité avec notre nouvelle gamme tendance.",
            badge: "✨ NOUVEAUTÉ",
            bg_type: "gradient",
            bg_gradient: "linear-gradient(135deg, #475569 0%, #0F172A 100%)",
            text_color: "#FFFFFF",
            primary_button_text: "Découvrir la collection",
            primary_button_link_type: "products",
            content_alignment: "left",
            height: "full",
          },
        },
        {
          id: "products-fashion",
          type: "products_grid",
          enabled: true,
          settings: {
            title: "Tendance du Moment",
            subtitle: "Les articles les plus demandés",
            selection_rule: "featured",
            limit: 6,
            columns_desktop: 3,
            columns_mobile: 2,
            button_text: "Acheter",
            button_action: "checkout",
            show_compare_price: true,
            show_stock_badge: false,
          },
        },
        {
          id: "banner-cta-fashion",
          type: "banner_cta",
          enabled: true,
          settings: {
            title: "Vente Flash — Jusqu'à -40%",
            description: "Profitez de nos remises exceptionnelles valables cette semaine seulement.",
            badge: "⏳ OFFRE LIMITÉE",
            button_text: "J'en profite maintenant",
            button_action: "checkout",
            show_countdown: true,
            countdown_hours: 24,
          },
        },
        {
          id: "footer-fashion",
          type: "footer_custom",
          enabled: true,
          settings: {
            business_description: "Mode originale & accessoires d'exception.",
            show_social_links: true,
            show_payment_badges: true,
          },
        },
      ],
    },
  },
  {
    id: "single_product",
    name: "Boutique Mono-Produit (Landing)",
    description: "Optimisée à 100% pour la conversion rapide d'un produit phare.",
    icon_label: "🚀",
    badge: "CONVERSION TOP",
    config: {
      enabled: true,
      template_slug: "single_product",
      global_styles: {
        button_radius: "rounded-2xl",
      },
      sections: [
        {
          id: "hero-single",
          type: "hero",
          enabled: true,
          settings: {
            title: "Le Produit Incontournable de l'Année",
            subtitle: "Révolutionnez votre quotidien en un clic",
            description: "Commandez directement et profitez de la livraison offerte dès aujourd'hui.",
            badge: "🔥 MEILLEURE VENTE",
            bg_type: "gradient",
            bg_gradient: "linear-gradient(135deg, #0E7C66 0%, #064E3B 100%)",
            text_color: "#FFFFFF",
            primary_button_text: "Commander maintenant",
            primary_button_link_type: "checkout",
            content_alignment: "center",
            height: "medium",
          },
        },
        {
          id: "products-single",
          type: "products_grid",
          enabled: true,
          settings: {
            title: "Offre Exclusive",
            subtitle: "Sélectionnez votre variante et commandez en 30 secondes",
            selection_rule: "all",
            limit: 4,
            columns_desktop: 2,
            columns_mobile: 1,
            button_text: "Commander directement",
            button_action: "checkout",
            show_compare_price: true,
            show_stock_badge: true,
          },
        },
        {
          id: "features-single",
          type: "features",
          enabled: true,
          settings: {
            title: "Pourquoi nous choisir ?",
            items: [
              { id: "sf1", icon_name: "zap", title: "Efficacité Garantie", description: "Résultats visibles dès les premières utilisations" },
              { id: "sf2", icon_name: "award", title: "Qualité Certifiée", description: "Fabriqué avec des matériaux haut de gamme" },
              { id: "sf3", icon_name: "truck", title: "Paiement à la Livraison", description: "Payez seulement à la réception du colis" },
            ],
          },
        },
        {
          id: "testimonials-single",
          type: "testimonials",
          enabled: true,
          settings: {
            title: "Avis d'Acheteurs Satisfaits",
            items: [
              { id: "st1", author_name: "Fanta D.", author_role: "Client vérifié", rating: 5, content: "Produit fantastique. La livraison a été ponctuelle et l'emballage parfait !" },
            ],
          },
        },
        {
          id: "banner-cta-single",
          type: "banner_cta",
          enabled: true,
          settings: {
            title: "Stock presque épuisé !",
            description: "Ne manquez pas cette opportunité avant la rupture définitive.",
            button_text: "Commander avant la rupture",
            button_action: "checkout",
            show_countdown: true,
            countdown_hours: 12,
          },
        },
      ],
    },
  },
];
