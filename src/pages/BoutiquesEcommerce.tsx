import { FeatureLandingPage } from "@/components/FeatureLandingPage";
import { ShoppingBag, CreditCard, Truck } from "lucide-react";

export default function BoutiquesEcommerce() {
  return (
    <FeatureLandingPage
      title="Création de boutiques e-commerce par IA"
      metaTitle="Créer une boutique e-commerce en Afrique par IA | VisualPro"
      metaDescription="Lancez votre boutique en ligne en Côte d'Ivoire et en Afrique avec Mobile Money, paiement à la livraison et tunnel de commande optimisé. Activation à 2$."
      canonical="https://visuelpro.cloud/boutiques-ecommerce"
      hero={{
        eyebrow: "Boutiques e-commerce IA",
        heading: "Votre boutique e-commerce africaine, prête à vendre",
        subheading:
          "VisualPro crée votre boutique avec catalogue produits, paiement Mobile Money, paiement à la livraison sur Abidjan, et tunnel de commande optimisé pour la conversion.",
        ctaPrimary: { label: "Créer ma boutique", to: "/auth" },
        ctaSecondary: { label: "Voir une démo", to: "/demo" },
      }}
      benefits={[
        { icon: CreditCard, title: "Mobile Money intégré", description: "Acceptez Wave, Orange Money, MTN MoMo et Moov Money via GeniusPay sans configuration." },
        { icon: Truck, title: "Paiement à la livraison", description: "Activé automatiquement pour les commandes dans les communes d'Abidjan." },
        { icon: ShoppingBag, title: "Tunnel de commande pro", description: "Checkout en 3 étapes, preuves sociales, urgence et notifications de commande en temps réel." },
      ]}
      steps={[
        { title: "Activez votre boutique", description: "Frais d'activation unique de 2$ pour ouvrir votre boutique e-commerce." },
        { title: "Ajoutez vos produits", description: "Importez vos produits avec photos, descriptions, variantes et stock." },
        { title: "Partagez et vendez", description: "Diffusez votre boutique sur WhatsApp, Facebook et Instagram. Recevez les commandes en temps réel." },
      ]}
      faq={[
        { question: "Combien coûte une boutique ?", answer: "Activation unique de 2$ puis 0,025$ de commission par transaction. Aucun abonnement mensuel obligatoire." },
        { question: "Quels modes de paiement sont disponibles ?", answer: "Mobile Money (Wave, Orange, MTN, Moov) via GeniusPay, et paiement à la livraison pour les zones d'Abidjan." },
        { question: "Puis-je suivre mes ventes ?", answer: "Oui, un tableau de bord en temps réel affiche vos commandes, votre chiffre d'affaires et vos statistiques par produit." },
      ]}
    />
  );
}
