/**
 * Configuration des formules d'abonnement et de tarification Ecomfy.
 */

/**
 * Flag de contrôle d'accès Premium pour l'Académie.
 * - false (défaut actuel) : L'Académie et les formations restent ouvertes/freemium pour tous.
 * - true : L'accès à l'Académie exige le Pass Premium Académie & Pro (35 000 FCFA initial, 5 000 FCFA / 3 mois).
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
  renewalPrice?: number;
  renewalPriceLabel?: string;
  renewalPeriodMonths?: number;
  aiVideoQuotaMonthly: number;
  aiImageQuotaMonthly: number;
  popular?: boolean;
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

export const PREMIUM_ACADEMY_PLAN: PricingPlan = {
  id: "premium_academy_pro",
  name: "Premium Académie & Pro",
  badge: "OFFRE MEMBRE PRO",
  initialPrice: 35000,
  initialPriceLabel: "35 000 FCFA",
  renewalPrice: 5000,
  renewalPriceLabel: "5 000 FCFA",
  renewalPeriodMonths: 3,
  aiVideoQuotaMonthly: 20,
  aiImageQuotaMonthly: 40,
  popular: true,
  description: "L'écosystème complet : Masterclasses Académie, 20 vidéos + 40 images IA/mois, et Zéro commission.",
  features: [
    "Accès illimité à toutes les Formations & Masterclasses Académie Ecomfy",
    "Jusqu'à 20 vidéos publicitaires animées IA par mois",
    "Jusqu'à 40 images HD studio IA par mois",
    "Accès VIP à la Communauté des Marchands Ecomfy",
    "Boutique illimitée + Nom de domaine personnalisé (.com, .net, .shop)",
    "Zéro commission sur vos ventes (0 FCFA)",
    "Accompagnement & Support prioritaire WhatsApp 24/7",
    "Renouvellement avantageux à seulement 5 000 FCFA tous les 3 mois"
  ]
};
