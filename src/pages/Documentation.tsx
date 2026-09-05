import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthReady } from "@/hooks/useAuthReady";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Book, Search, Rocket, Layers, Image as ImageIcon, Video, Globe, Store,
  GraduationCap, CreditCard, Bug, ShieldCheck, Code2, Database, Mail,
  Bell, Workflow, Server, KeyRound, ScrollText, Boxes, Wrench, Network,
  Lock, GitBranch, Cpu, FileText, ArrowRight, Copy, Check, ExternalLink,
  Sparkles, Truck, MessageSquare, Zap, Terminal, Share2, Award, Bot, Tag
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Documentation Types & Structure                                    */
/* ------------------------------------------------------------------ */

type DocBlock =
  | { type: "p"; text: string }
  | { type: "h"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "code"; lang?: string; text: string }
  | { type: "callout"; tone?: "info" | "warn" | "danger" | "success"; text: string }
  | { type: "table"; head: string[]; rows: string[][] }
  | { type: "action"; label: string; url: string; external?: boolean };

type DocSection = {
  id: string;
  title: string;
  icon: any;
  category: string;
  summary: string;
  body: DocBlock[];
};

const CATEGORIES = [
  "Démarrage",
  "E-Commerce & Boutique",
  "Studio IA & Création",
  "Réseau Social Connect As",
  "Académie & Cours",
  "Logistique & Livraison",
  "API & Développeurs",
  "Sécurité & Confidentialité",
  "Changelog",
];

const SECTIONS: DocSection[] = [
  /* -------------------- 1. DÉMARRAGE -------------------- */
  {
    id: "introduction",
    title: "Introduction à Ecomfy",
    icon: Rocket,
    category: "Démarrage",
    summary: "Présentation générale de la plateforme SaaS Ecomfy, de son écosystème et de ses piliers techniques.",
    body: [
      { type: "p", text: "Ecomfy est la plateforme SaaS tout-en-un de référence conçue pour les marchands, créateurs et entreprises. Elle combine la création de boutiques e-commerce haute conversion, la génération de visuels/vidéos par IA, un réseau social d'interaction (Connect As), une académie de formation et une API développeur complète." },
      { type: "h", text: "Les Piliers de l'Écosystème Ecomfy" },
      { type: "ul", items: [
        "Vitrine & Boutique E-commerce : Tunnel de commande Single-Page ultra-rapide, gestion des stocks, variantes, bundles et sous-domaine personnalisé .ecomfy.cloud.",
        "Paiements Locaux & Internationaux : Intégration native Wave, Orange Money, MTN, Moov, CinetPay, Stripe et Cash à la livraison.",
        "Studio IA de Création Visuelle : Génération de bannières HD, miniatures YouTube, posts sociaux et vidéos publicitaires avec voix-off professionnelle.",
        "Réseau Social Connect As : Fil d'actualité en temps réel, interactions instantanées (likes/commentaires optimistes) et invitations WhatsApp.",
        "Académie Ecomfy : Formations vidéo pas-à-pas, cours de vente et délivrance de certificats PDF certifiés avec QR Code.",
        "Logistique & Livraison : Attribution des colis, application scanner QR Code pour livreurs et gestion des frais par zones.",
      ]},
      { type: "callout", tone: "success", text: "Ecomfy est conçu Mobile-First pour garantir une vitesse de chargement instantanée (< 2 secondes) même sur réseau mobile." },
      { type: "action", label: "Créer ma Boutique Ecomfy", url: "/shop-manager" }
    ],
  },
  {
    id: "architecture",
    title: "Architecture & Structure du Code",
    icon: Layers,
    category: "Démarrage",
    summary: "Organisation modulaire du projet, arborescence des dossiers et stack technologique.",
    body: [
      { type: "h", text: "Stack Technique Principale" },
      { type: "ul", items: [
        "Frontend : React 18, Vite, TypeScript, Tailwind CSS v3, Shadcn UI & Lucide Icons.",
        "State & Cache : React Query (@tanstack/react-query) pour l'invalidation asynchrone et les mises à jour UI optimistes.",
        "Backend & DB : Supabase (PostgreSQL 15), Supabase Auth, Storage & Edge Functions Deno.",
        "Internationalisation : i18next (support multi-langues FR, EN, ES, PT, AR).",
        "Mobile : Wrapper Capacitor (Android & iOS).",
      ]},
      { type: "h", text: "Arborescence du Projet" },
      { type: "code", lang: "bash", text:
`src/
├── components/          Composants UI réutilisables (Shadcn + composants métiers)
│   ├── shop/            ProductView, ProductReviews, ShopAIAssistant, SinglePageCheckout
│   ├── ui/              Composants de base Shadcn (Button, Dialog, Input, Select...)
│   └── landing/         LandingPages & composant LandingAcademy
├── hooks/               Custom Hooks React (useAuthReady, useOrderNotifications, etc.)
├── integrations/        Client Supabase auto-généré (@/integrations/supabase/client)
├── modules/
│   └── connectus/       Réseau Social Connect As (PostCard, ConnectUsHeader, InviteModal)
├── pages/               Routes principales (ShopView, ProductView, ShopManager, Studio)
├── App.tsx              Routage principal de l'application
└── index.css            Directives Tailwind CSS et design system global

supabase/
├── functions/           Edge Functions Deno (process-payment, share-product, send-email)
└── migrations/          Scripts SQL de versionnement de la base de données PostgreSQL`
      },
      { type: "callout", tone: "info", text: "L'alias de chemin `@/` pointe directement vers le dossier `src/` pour simplifier tous les imports." }
    ],
  },

  /* -------------------- 2. BOUTIQUES E-COMMERCE -------------------- */
  {
    id: "shop-creation",
    title: "Création & Configuration de Boutique",
    icon: Store,
    category: "E-Commerce & Boutique",
    summary: "Guide complet pour configurer votre vitrine marchande, sous-domaine et identité de marque.",
    body: [
      { type: "p", text: "Chaque vendeur sur Ecomfy bénéficie de sa propre boutique en ligne accessible via un sous-domaine dédié (`maboutique.ecomfy.cloud`) ou un nom de domaine personnalisé." },
      { type: "h", text: "Étapes de Configuration" },
      { type: "ul", items: [
        "Nom de Marque & Slug : Choisissez le nom commercial et le slug d'URL de votre boutique.",
        "Thématisation Dynamique : Sélectionnez la couleur primaire de votre marque. L'interface de votre vitrine s'adapte automatiquement avec vos couleurs.",
        "Logo & Favicon : Importez des images HD avec compression automatique côté client.",
        "Coordonnées WhatsApp : Renseignez votre numéro avec indicatif pays pour la réception directe des commandes.",
      ]},
      { type: "code", lang: "typescript", text:
`// Exemple de mise à jour du profil de boutique via Supabase client
const { data, error } = await supabase
  .from("shops")
  .update({
    business_name: "Ma Boutique Fashion",
    primary_color: "#0E7C66",
    whatsapp_number: "+2250700000000",
    is_published: true
  })
  .eq("user_id", user.id);`
      },
      { type: "action", label: "Accéder au Gestionnaire de Boutique", url: "/shop-manager" }
    ],
  },
  {
    id: "single-page-checkout",
    title: "Checkout Single-Page & Modes de Paiement",
    icon: CreditCard,
    category: "E-Commerce & Boutique",
    summary: "Tunnel de commande optimisé pour la conversion et intégration des passerelles Mobile Money.",
    body: [
      { type: "p", text: "Le Checkout Ecomfy est conçu sur une seule page (Single Page Checkout) sans friction, réduisant l'abandon de panier de plus de 40% par rapport aux tunnels multi-étapes classiques." },
      { type: "h", text: "Passerelles de Paiement Intégrées" },
      { type: "table", head: ["Mode de Paiement", "Marchés Couverts", "Type de Règlement"], rows: [
        ["Wave Mobile Money", "Côte d'Ivoire, Sénégal", "Instantané / Direct QR"],
        ["Orange Money", "Afrique de l'Ouest & Centrale", "Code USSD / OTP"],
        ["MTN Mobile Money", "Côte d'Ivoire, Ghana, Bénin", "Notification Push SMS"],
        ["Moov Money", "Côte d'Ivoire, Togo, Bénin", "Règlement Mobile"],
        ["Cash à la Livraison", "Toutes Villes (Abidjan, etc.)", "Paiement à la remise de colis"],
        ["Stripe / CinetPay", "International & Cartes Visa/MC", "Carte bancaire sécurisée"],
      ]},
      { type: "callout", tone: "warn", text: "Pour le paiement Cash à la livraison, le numéro WhatsApp du livreur ou du marchand est directement inclus dans la confirmation de commande." }
    ],
  },
  {
    id: "conversion-boosters",
    title: "Boosters de Conversion (Urgence & Bundles)",
    icon: Zap,
    category: "E-Commerce & Boutique",
    summary: "Fonctionnalités avancées pour inciter à l'achat immédiat : compte à rebours, jauge de stock et offres groupées.",
    body: [
      { type: "p", text: "Chaque fiche produit Ecomfy inclut des déclencheurs psychologiques de conversion prouvés." },
      { type: "h", text: "Les 3 Outils de Conversion Ecomfy" },
      { type: "ul", items: [
        "Compte à Rebours Dynamique : Affiche une minuterie personnalisée (ex: 'Offre spéciale expire dans 14 min 30 s').",
        "Jauge de Stock Animée : Barre visuelle indiquant un stock restant limité (ex: 'Plus que 3 articles disponibles en stock !').",
        "Offres par Lots (Bundles) : Propose des réductions incitatives (1 acheté = 10 000 FCFA, 2 achetés = 16 000 FCFA).",
        "Badges de Réassurance : Livraisons rapides, garantie satisfait ou remboursé et avis clients certifiés.",
      ]}
    ],
  },

  {
    id: "smart-variants",
    title: "Sélecteur Intelligent de Variantes & Tailles",
    icon: Tag,
    category: "E-Commerce & Boutique",
    summary: "Guide de configuration des déclinaisons de tailles (S à 3XL) et des couleurs sous forme de puces horizontales cliquables.",
    body: [
      { type: "p", text: "Ecomfy intègre un moteur d'analyse automatique des variantes pour éviter les fiches produits trop longues et permettre une sélection ultra-rapide en 1 seul clic." },
      { type: "h", text: "Saisie et Formats des Variantes" },
      { type: "ul", items: [
        "Saisie Simple sur une Ligne (Tailles) : Saisissez 'S, M, L, XL, 2XL, 3XL' ou 'M-XL-XXL-XXXL'. Ecomfy génère automatiquement des puces horizontales individuelles cliquables.",
        "Saisie Multi-Niveaux (Couleurs + Tailles) : Saisissez 'Blanc (S, M, L, XL)' et 'Noir (S, M, L, XL, 2XL)'. Ecomfy crée une rangée de sélection de couleur et une rangée dynamique de tailles disponibles pour la couleur choisie.",
        "Puces Cliquables Interactives : Chaque puce affiche une coche visuelle ✓ et passe à la couleur principale de votre marque au clic.",
      ]},
      { type: "callout", tone: "success", text: "La variante choisie est automatiquement transmise dans le récapitulatif de commande et sur WhatsApp (ex: 'Blanc — Taille: XL')." }
    ],
  },
  {
    id: "custom-domains-seo",
    title: "Domaines Personnalisés & SEO Intelligence",
    icon: Globe,
    category: "E-Commerce & Boutique",
    summary: "Configuration DNS CNAME (ex: maboutique.com) et analyse du référencement Google avec Ecomfy SEO Intelligence.",
    body: [
      { type: "p", text: "Raccordez votre propre nom de domaine personnalisé pour renforcer la crédibilité de votre marque et suivez votre visibilité Google." },
      { type: "h", text: "Configuration CNAME Domaine" },
      { type: "code", lang: "dns", text:
`TYPE : CNAME
HÔTE / NOM : @ (ou www)
VALEUR / CIBLE : cname.ecomfy.cloud
TTL : Auto / 3600`
      },
      { type: "h", text: "Module Ecomfy SEO Intelligence" },
      { type: "ul", items: [
        "Santé SEO & Score Google : Évaluation de la balise Title, de la Meta Description et du temps de chargement LCP.",
        "Indexation & OpenGraph : Aperçu en direct du partage sur WhatsApp, Facebook et X (Twitter).",
        "Statistiques Réelles : Aucune donnée fictive. Analyse basée sur vos métriques réelles d'impression et de clic.",
      ]},
      { type: "action", label: "Consulter mon SEO Intelligence", url: "/seo" }
    ],
  },
  {
    id: "payment-location-rules",
    title: "Règles de Paiement (Abidjan vs Intérieur)",
    icon: ShieldCheck,
    category: "E-Commerce & Boutique",
    summary: "Gestion du paiement à la livraison sur Abidjan et du Mobile Money obligatoire pour l'expédition à l'intérieur du pays.",
    body: [
      { type: "p", text: "Ecomfy adapte dynamiquement les méthodes de paiement selon la ville renseignée par l'acheteur." },
      { type: "ul", items: [
        "Zone Abidjan : Possibilité de choisir entre le Paiement à la livraison (Cash on Delivery) et Mobile Money.",
        "Hors Abidjan (Intérieur du Pays) : Le paiement par Mobile Money (Wave, Orange, MTN, Moov) devient automatiquement obligatoire avant expédition du colis.",
      ]},
      { type: "callout", tone: "warn", text: "Ce système sécurise vos frais d'expédition et annule le risque de colis refusé à l'arrivée." }
    ],
  },

  /* -------------------- 3. STUDIO IA -------------------- */
  {
    id: "ai-visual-generator",
    title: "Studio IA : Générateur de Visuels HD",
    icon: ImageIcon,
    category: "Studio IA & Création",
    summary: "Créez des visuels publicitaires professionnels en quelques secondes sans compétence en design.",
    body: [
      { type: "p", text: "Le Studio IA Ecomfy intègre des modèles de génération d'images de dernière génération pour produire des bannières e-commerce, miniatures YouTube et visuels réseaux sociaux." },
      { type: "h", text: "Formats Ratios Supportés" },
      { type: "ul", items: [
        "1:1 (Carré) : Posts Instagram, Facebook & images produits.",
        "9:16 (Vertical) : Stories Instagram, TikTok & Reels.",
        "16:9 (Horizontal) : Bannières web, miniatures YouTube & Facebook Ads.",
      ]},
      { type: "code", lang: "json", text:
`// Exemple de requête au Studio IA Ecomfy
{
  "prompt": "Un flacon de parfum de luxe posé sur de la soie dorée avec éclairage studio cinématographique HD",
  "aspect_ratio": "1:1",
  "style": "photorealistic",
  "quality": "ultra-hd"
}`
      },
      { type: "action", label: "Ouvrir le Studio IA", url: "/generator" }
    ],
  },
  {
    id: "ai-video-studio",
    title: "Studio IA : Générateur de Vidéos Publicitaires",
    icon: Video,
    category: "Studio IA & Création",
    summary: "Générez des vidéos courtes captivantes avec voix-off IA pour vos publicités Facebook et TikTok.",
    body: [
      { type: "p", text: "Transformez une simple description de produit en une vidéo animée avec voix-off professionnelle captivante." },
      { type: "h", text: "Fonctionnalités Vidéo IA" },
      { type: "ul", items: [
        "Génération de Script Marketing : Rédaction automatique du pitch vendeur selon la méthode AIDA (Attention, Intérêt, Désir, Action).",
        "Voix-off IA Naturelle : Choix des voix masculines ou féminines dynamiques en français.",
        "Animation Visuelle : Mouvements de caméra fluides et intégration du logo de la boutique.",
      ]}
    ],
  },
  {
    id: "ai-product-optimizer",
    title: "Optimiseur de Fiches Produits par IA",
    icon: Sparkles,
    category: "Studio IA & Création",
    summary: "Rédaction automatique de titres vendeurs, descriptions persuasives et mots-clés SEO.",
    body: [
      { type: "p", text: "L'optimiseur IA analyse votre produit et génère automatiquement un argumentaire de vente adapté au marché cible." },
      { type: "callout", tone: "info", text: "Accessible directement dans le Formulaire d'Édition Produit via le bouton 'Optimiser avec l'IA'." }
    ],
  },

  /* -------------------- 4. RÉSEAU SOCIAL CONNECT AS -------------------- */
  {
    id: "connect-as-feed",
    title: "Fil d'Actualité & Publications Sociale",
    icon: Share2,
    category: "Réseau Social Connect As",
    summary: "Plateforme sociale intégrée pour interagir avec la communauté des marchands et clients.",
    body: [
      { type: "p", text: "Connect As est le réseau social officiel d'Ecomfy. Il permet aux vendeurs et membres de partager leurs actualités, visuels et vidéos de démonstration." },
      { type: "h", text: "Fonctionnalités Sociales" },
      { type: "ul", items: [
        "Publications Multi-Médias : Support des images HD et des vidéos avec lecteur optimisé (poster, preload, fallback).",
        "Mises à Jour Optimistes (Optimistic UI) : Les likes et commentaires s'affichent instantanément côté client sans clignotement ni rechargement de page.",
        "Recherche de Membres en Temps Réel : Recherche rapide par nom d'utilisateur.",
        "Invitation WhatsApp Directe : Envoi d'invitations personnalisées aux contacts non encore inscrits.",
      ]},
      { type: "action", label: "Accéder au Fil Connect As", url: "/connect-us" }
    ],
  },

  /* -------------------- 5. ACADÉMIE & COURS -------------------- */
  {
    id: "academy-overview",
    title: "Académie Ecomfy & Cours Vidéo",
    icon: GraduationCap,
    category: "Académie & Cours",
    summary: "Formations pratiques gratuites pour maîtriser la publicité Facebook, le closing WhatsApp et la vente en ligne.",
    body: [
      { type: "p", text: "L'Académie Ecomfy forme les marchands avec des tutoriels vidéos concrets adaptés au marché africain." },
      { type: "h", text: "Programme des Formations" },
      { type: "ul", items: [
        "Tutoriel #1 : Création et Paramétrage complet de votre boutique Ecomfy.",
        "Tutoriel #2 : Comment PARAMÉTRER le CHECKOUT de sa boutique E-commerce ? (Guide complet).",
        "Tutoriel #3 : Publicités Facebook & Redirection Directe vers WhatsApp.",
        "Tutoriel #4 : Stratégies de Closing Vente & Gestion des Objections Clients.",
      ]},
      { type: "action", label: "Consulter l'Académie Ecomfy", url: "/academy" }
    ],
  },
  {
    id: "certificates-qr",
    title: "Certificats PDF Certifiés avec QR Code",
    icon: Award,
    category: "Académie & Cours",
    summary: "Délivrance de certificats de réussite vérifiables en ligne par QR Code unique.",
    body: [
      { type: "p", text: "Après avoir complété un parcours de formation, l'apprenant reçoit un certificat officiel téléchargeable en PDF." },
      { type: "callout", tone: "success", text: "Chaque certificat contient un QR Code de vérification renvoyant vers l'URL `/verify-certificate/:id`." }
    ],
  },

  /* -------------------- 6. LOGISTIQUE & LIVRAISON -------------------- */
  {
    id: "logistics-drivers",
    title: "Gestion des Livreurs & Missions",
    icon: Truck,
    category: "Logistique & Livraison",
    summary: "Attribution des colis, suivi des livraisons et application scanner QR Code.",
    body: [
      { type: "p", text: "Ecomfy intègre une solution complète de gestion logistique pour les marchands et les livreurs partenaires." },
      { type: "h", text: "Fonctionnalités Livreur" },
      { type: "ul", items: [
        "Tableau de bord Livreur (`/driver/home`) : Consultation des courses attribuées.",
        "Scanner QR Code (`DriverScanner`) : Validation instantanée de la prise en charge du colis.",
        "Zones Tarifaires : Tarification personnalisée par commune (ex: Cocody, Yopougon, Marcory, etc.).",
      ]}
    ],
  },

  /* -------------------- 7. API & DÉVELOPPEURS -------------------- */
  {
    id: "api-keys-auth",
    title: "Authentification & Clés d'API (v1)",
    icon: KeyRound,
    category: "API & Développeurs",
    summary: "Génération de clés d'accès API pour connecter vos outils externes (N8N, Zapier, Make).",
    body: [
      { type: "p", text: "Les clés d'API Ecomfy commencent par le préfixe `vp_...` et permettent d'automatiser vos flux de travail." },
      { type: "code", lang: "bash", text:
`# Exemple de requête API authentifiée avec Bearer Token
curl -X GET https://ecomfy.cloud/api/v1/products \\
  -H "Authorization: Bearer vp_live_987654321qwertyuiop" \\
  -H "Content-Type: application/json"`
      },
      { type: "action", label: "Consulter la Documentation API", url: "/api-documentation" }
    ],
  },
  {
    id: "webhooks-integration",
    title: "Webhooks Temps Réel & Automatisations",
    icon: Workflow,
    category: "API & Développeurs",
    summary: "Recevez des notifications HTTP instantanées lors de nouvelles commandes ou réinitialisations.",
    body: [
      { type: "p", text: "Configurez des Webhooks pour déclencher des actions automatiques dans votre CRM ou système d'expédition." },
      { type: "table", head: ["Événement Webhook", "Description", "Payload"], rows: [
        ["order.created", "Déclenché lors d'une nouvelle commande client", "Détails client, articles, montant, mode de paiement"],
        ["order.paid", "Déclenché dès confirmation du règlement Mobile Money", "ID transaction, montant, référence passerelle"],
        ["cart.abandoned", "Déclenché lors d'un abandon de panier", "Numéro téléphone client, panier relançable"],
      ]}
    ],
  },

  /* -------------------- 8. SÉCURITÉ & CONFIDENTIALITÉ -------------------- */
  {
    id: "security-privacy-doc",
    title: "Sécurité & Protection des Données",
    icon: ShieldCheck,
    category: "Sécurité & Confidentialité",
    summary: "Normes de sécurité, chiffrement SSL, isolation des données Supabase RLS et protection des transactions.",
    body: [
      { type: "p", text: "Ecomfy applique les standards industriels les plus stricts en matière de sécurité et de confidentialité pour protéger les informations des marchands, les transactions financières et la vie privée des acheteurs." },
      { type: "h", text: "Mesures de Sécurité & Garanties Ecomfy" },
      { type: "ul", items: [
        "Chiffrement SSL / TLS 256 bits : Toutes les communications entre le navigateur et la plateforme sont chiffrées de bout en bout.",
        "Isolation Supabase RLS (Row Level Security) : Vos données de boutique, catalogues, ventes et fiches clients sont strictement isolées et accessibles uniquement par votre compte.",
        "Paiements Ultra-Sécurisés : Aucune donnée bancaire ni code secret n'est conservé sur nos serveurs. Les règlements s'effectuent directement via les API officielles agréées (Wave, Orange, MTN, Moov, Stripe, CinetPay).",
        "Sauvegardes Automatiques Quotidiennes : Sauvegardes continues et réplication haute disponibilité de la base de données PostgreSQL.",
      ]},
      { type: "callout", tone: "success", text: "Pour toute question relative à la conformité ou la protection de vos données marchands, notre support technique est disponible 24h/24." }
    ],
  },

  /* -------------------- 9. CHANGELOG -------------------- */
  {
    id: "changelog",
    title: "Changelog & Historique des Versions",
    icon: GitBranch,
    category: "Changelog",
    summary: "Historique des mises à jour majeures de la plateforme Ecomfy.",
    body: [
      { type: "table", head: ["Date", "Version", "Module", "Changements"], rows: [
        ["2026-08-24", "v3.2.0", "Sécurité & Infrastructure", "Mise à jour des règles d'isolation RLS Supabase et optimisation des requêtes de vente."],
        ["2026-08-24", "v3.1.0", "Branding & SEO", "Nouvelle bannière officielle Open Graph 1200x630 Ecomfy et métadonnées sociales."],
        ["2026-08-24", "v3.0.0", "Académie", "Ajout du tutoriel YouTube officiel sur le paramétrage du Checkout Single-Page."],
        ["2026-08-23", "v2.9.0", "Connect As", "Nettoyage des comptes démo fictifs, RLS Supabase et lecteur vidéo HD."],
        ["2026-08-20", "v2.8.0", "Checkout", "Optimisation du temps de chargement initial du fil et du tunnel à < 2 secondes."],
      ]}
    ],
  }
];

/* ------------------------------------------------------------------ */
/* Block Component Render                                             */
/* ------------------------------------------------------------------ */

const Block = ({ b }: { b: DocBlock }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copié !", description: "Code copié dans le presse-papier." });
    setTimeout(() => setCopied(false), 2000);
  };

  if (b.type === "p") {
    return <p className="text-slate-300 leading-relaxed text-sm md:text-base font-inter">{b.text}</p>;
  }
  if (b.type === "h") {
    return <h3 className="text-lg md:text-xl font-space font-bold text-white mt-6 mb-2 flex items-center gap-2 border-b border-slate-800 pb-2">{b.text}</h3>;
  }
  if (b.type === "ul") {
    return (
      <ul className="space-y-2.5 my-3">
        {b.items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
            <span className="h-2 w-2 rounded-full bg-[#0E7C66] mt-2 shrink-0" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (b.type === "code") {
    return (
      <div className="relative my-4 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-xl group">
        <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-slate-800 text-xs text-slate-400 font-mono">
          <span>{b.lang || "code"}</span>
          <button
            onClick={() => handleCopy(b.text)}
            className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "Copié" : "Copier"}</span>
          </button>
        </div>
        <pre className="p-4 overflow-x-auto text-xs font-mono text-emerald-300 leading-relaxed">
          <code>{b.text}</code>
        </pre>
      </div>
    );
  }
  if (b.type === "callout") {
    const tones = {
      info: "border-blue-500/30 bg-blue-500/10 text-blue-300",
      warn: "border-amber-500/30 bg-amber-500/10 text-amber-300",
      danger: "border-rose-500/30 bg-rose-500/10 text-rose-300",
      success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    };
    return (
      <div className={`p-4 rounded-2xl border ${tones[b.tone || "info"]} my-4 text-xs md:text-sm flex items-start gap-3`}>
        <Zap className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="leading-relaxed">{b.text}</div>
      </div>
    );
  }
  if (b.type === "table") {
    return (
      <div className="my-4 overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 shadow-xl">
        <table className="w-full text-left text-xs md:text-sm">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-800 text-slate-300 font-bold">
              {b.head.map((h, i) => (
                <th key={i} className="px-4 py-3 font-space">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {b.rows.map((r, i) => (
              <tr key={i} className="hover:bg-slate-900/50 transition-colors">
                {r.map((c, j) => (
                  <td key={j} className="px-4 py-3 text-slate-300">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (b.type === "action") {
    return (
      <div className="mt-6 pt-2">
        <Button
          onClick={() => navigate(b.url)}
          className="rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs gap-2 px-5 py-2.5 shadow-lg"
        >
          <span>{b.label}</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }
  return null;
};

/* ------------------------------------------------------------------ */
/* Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function Documentation() {
  const navigate = useNavigate();
  const { user, isReady } = useAuthReady();
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.filter((s) =>
      s.title.toLowerCase().includes(q) ||
      s.summary.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    );
  }, [query]);

  const current = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 font-inter selection:bg-[#0E7C66] selection:text-white">
      
      {/* Top Bar Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center shrink-0">
              <Book className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-space font-extrabold text-base md:text-xl text-white truncate">Documentation Ecomfy</h1>
                <Badge className="bg-[#0E7C66]/20 text-emerald-400 border border-[#0E7C66]/40 text-[10px] font-bold px-2 py-0.5 rounded-full">v3.2 Official</Badge>
              </div>
              <p className="text-xs text-slate-400 hidden md:block">Guide complet des fonctionnalités, API, Studio IA, Boutiques et Sécurité.</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-44 sm:w-64 md:w-80">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher une section, API..."
                className="pl-9 h-10 bg-slate-900 border-slate-800 text-xs rounded-full text-white placeholder:text-slate-500 focus:border-[#0E7C66]"
              />
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/api-documentation")}
              className="hidden sm:inline-flex rounded-full border-slate-700 bg-slate-800 text-xs font-bold gap-1.5 text-slate-200"
            >
              <Code2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>API Dev</span>
            </Button>
          </div>

        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-8">
        
        {/* Left Navigation Sidebar */}
        <aside className="lg:sticky lg:top-[89px] lg:self-start">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-4 shadow-xl backdrop-blur-xl">
            <ScrollArea className="lg:h-[calc(100vh-130px)] pr-2">
              <nav className="space-y-6">
                {CATEGORIES.map((cat) => {
                  const items = filtered.filter((s) => s.category === cat);
                  if (!items.length) return null;
                  return (
                    <div key={cat} className="space-y-1.5">
                      <div className="text-[10px] font-space font-bold uppercase tracking-wider text-slate-400 px-3 py-1 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#0E7C66]" />
                        <span>{cat}</span>
                      </div>
                      <div className="space-y-1">
                        {items.map((s) => {
                          const Icon = s.icon;
                          const isActive = s.id === active;
                          return (
                            <button
                              key={s.id}
                              onClick={() => setActive(s.id)}
                              className={`w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all font-medium ${
                                isActive
                                  ? "bg-[#0E7C66] text-white font-bold shadow-lg shadow-[#0E7C66]/20"
                                  : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                              }`}
                            >
                              <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                              <span className="truncate">{s.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {!filtered.length && (
                  <p className="text-xs text-slate-500 text-center py-6">Aucune section trouvée.</p>
                )}
              </nav>
            </ScrollArea>
          </Card>
        </aside>

        {/* Right Main Content Viewer */}
        <main className="min-w-0">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 md:p-10 shadow-2xl backdrop-blur-xl">
            
            {/* Header Title Section */}
            <div className="flex items-start gap-4 pb-6 border-b border-slate-800">
              <div className="h-14 w-14 rounded-2xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 text-emerald-400 flex items-center justify-center shrink-0 shadow-xl">
                <current.icon className="h-7 w-7" />
              </div>
              <div className="space-y-1 min-w-0">
                <Badge className="bg-[#0E7C66]/20 text-emerald-400 border border-[#0E7C66]/40 text-[10px] font-bold">
                  {current.category}
                </Badge>
                <h2 className="text-2xl md:text-3xl font-space font-extrabold text-white tracking-tight">
                  {current.title}
                </h2>
                <p className="text-xs md:text-sm text-slate-400 leading-relaxed">
                  {current.summary}
                </p>
              </div>
            </div>

            {/* Section Body Blocks */}
            <div className="space-y-4 pt-6">
              {current.body.map((b, i) => (
                <Block key={i} b={b} />
              ))}
            </div>

            {/* Pagination Prev / Next Buttons */}
            <div className="mt-12 pt-6 border-t border-slate-800 flex items-center justify-between gap-4">
              {(() => {
                const idx = SECTIONS.findIndex((s) => s.id === current.id);
                const prev = SECTIONS[idx - 1];
                const next = SECTIONS[idx + 1];
                return (
                  <>
                    {prev ? (
                      <Button
                        variant="outline"
                        onClick={() => setActive(prev.id)}
                        className="rounded-2xl border-slate-800 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs font-bold flex flex-col items-start h-auto py-3 px-4"
                      >
                        <span className="text-[10px] text-slate-500">Section Précédente</span>
                        <span className="text-xs text-white">{prev.title}</span>
                      </Button>
                    ) : <span />}

                    {next ? (
                      <Button
                        onClick={() => setActive(next.id)}
                        className="rounded-2xl bg-[#0E7C66] hover:bg-[#0A6352] text-white text-xs font-bold flex flex-col items-end h-auto py-3 px-4 ml-auto shadow-lg"
                      >
                        <span className="text-[10px] text-emerald-200">Section Suivante</span>
                        <span className="text-xs text-white flex items-center gap-1.5">
                          {next.title} <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </Button>
                    ) : <span />}
                  </>
                );
              })()}
            </div>

          </Card>
        </main>

      </div>
    </div>
  );
}