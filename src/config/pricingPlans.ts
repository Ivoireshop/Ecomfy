/**
 * Configuration des 3 formules d'abonnement et de tarification Ecomfy.
 */

/**
 * Flag de contrôle d'accès Premium pour l'Académie.
 * - false (défaut actuel) : L'Académie et les formations restent ouvertes/freemium pour tous.
 * - true : L'accès aux masterclasses exige la formule Premium Académie (35 000 FCFA initial, 5 000 FCFA / 3 mois).
 *
 * Basculez cette valeur à `true` lorsque le client donne son accord final !
 */
export const ENABLE_ACADEMY_PREMIUM_LOCK = false;

export interface PricingPlan {
  id: string;
  name: string;
  badge?: string;
  initialPrice: number;
  initialPriceLabel: string;
  monthlyPriceEquivalent?: string;
  renewalPrice?: number;
  renewalPriceLabel?: string;
  renewalPeriodMonths?: number;
  aiVideoQuotaMonthly: number;
  aiImageQuotaMonthly: number;
  popular?: boolean;
  highlighted?: boolean;
  description: string;
  features: string[];
}

export const FREE_PLAN: PricingPlan = {
  id: "starter_free",
  name: "Démarrage",
  initialPrice: 0,
  initialPriceLabel: "0 FCFA",
  aiVideoQuotaMonthly: 2,
  aiImageQuotaMonthly: 5,
  description: "Pour créer votre première boutique et tester la plateforme sans risque.",
  features: [
    "Boutique e-commerce mobile complète",
    "Paiements Mobile Money & Cash à la livraison",
    "Catalogue produits & commandes illimités",
    "Accès d'initiation à l'Académie Ecomfy",
    "2 vidéos IA & 5 images IA offertes",
    "Commission réduite de 50 FCFA / commande"
  ]
};

export const PRO_PLAN: PricingPlan = {
  id: "pro_monthly",
  name: "Ecomfy Pro",
  badge: "POPULAIRE",
  initialPrice: 12000,
  initialPriceLabel: "12 000 FCFA",
  monthlyPriceEquivalent: "12 000 FCFA / mois (ou 9 900 FCFA en annuel)",
  aiVideoQuotaMonthly: 10,
  aiImageQuotaMonthly: 20,
  popular: true,
  description: "Pour les e-commerçants actifs voulant zéro commission et un domaine propre.",
  features: [
    "Zéro commission sur vos ventes (0 FCFA)",
    "Boutique illimitée + Domaine personnalisé (.com, .net)",
    "Visuels IA & Textes SEO optimisés",
    "10 vidéos animées IA par mois",
    "Tableau de bord financier avancé",
    "Support prioritaire WhatsApp 24/7"
  ]
};

export const PREMIUM_ACADEMY_PLAN: PricingPlan = {
  id: "premium_academy_pro",
  name: "Premium Académie & VIP",
  badge: "OFFRE COMPLÈTE MEMBRE",
  initialPrice: 35000,
  initialPriceLabel: "35 000 FCFA",
  renewalPrice: 5000,
  renewalPriceLabel: "5 000 FCFA",
  renewalPeriodMonths: 3,
  aiVideoQuotaMonthly: 20,
  aiImageQuotaMonthly: 40,
  highlighted: true,
  description: "L'écosystème ultime : Formations vidéo Masterclasses, 20 vidéos + 40 images IA/mois & Communauté.",
  features: [
    "🎓 Formations & Masterclasses vidéo Académie Ecomfy",
    "🎬 Jusqu'à 20 vidéos publicitaires animées IA / mois",
    "🖼️ Jusqu'à 40 images HD studio IA / mois",
    "👥 Accès VIP à la Communauté des Marchands Ecomfy",
    "🛒 Zéro commission sur vos ventes (0 FCFA)",
    "🌐 Boutique illimitée + Nom de domaine personnalisé",
    "🔄 Renouvellement avantageux à seulement 5 000 FCFA tous les 3 mois",
    "💬 Support prioritaire VIP WhatsApp 24/7"
  ]
};

export const ALL_PRICING_PLANS = [FREE_PLAN, PRO_PLAN, PREMIUM_ACADEMY_PLAN];
