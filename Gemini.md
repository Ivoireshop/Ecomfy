# Ecomfy - Dossier Technique & Instructions pour IA (Gemini.md)

Ce document sert de dossier de passation, de référence architecturale et d'instructions pour tout modèle d'intelligence artificielle (comme Gemini, Claude, ChatGPT, etc.) intervenant sur ce projet. Il doit être lu par l'IA au début de toute nouvelle session pour comprendre le contexte, les technologies et les règles du projet.

## 1. Description de l'Application

**Ecomfy** (anciennement VisualPro / Juggle Pro) est une plateforme SaaS e-commerce multi-tenant (B2B2C). Elle permet à des marchands de créer facilement leur propre boutique en ligne, de gérer leurs produits, de personnaliser l'apparence de leur vitrine et d'accepter des paiements (notamment via CinetPay et Stripe). 

Le système gère un catalogue global, mais chaque vendeur dispose de son propre environnement (Dashboard) et de sa propre vitrine publique accessible via un sous-domaine ou un nom de domaine personnalisé (`ecomfy.cloud`).

## 2. Fonctionnalités Principales Implémentées

### 🛍️ Côté Vendeur (Dashboard / Back-office)
- **Authentification & Profil** : Inscription, connexion, gestion du profil via Supabase Auth.
- **Gestion de Boutique** : Création de la boutique, personnalisation du thème (couleur principale, style), configuration des informations (WhatsApp, réseaux sociaux).
- **Gestion des Produits** : CRUD de produits, gestion des stocks, variantes, offres en lot (bundles), prix barrés.
- **Domaines Personnalisés** : Gestion des sous-domaines (ex: `maboutique.ecomfy.cloud`) et intégration de domaines personnalisés avec vérification DNS.
- **Assistant IA & Génération** : Intégration de l'IA pour générer des descriptions de produits, optimiser le SEO, ou dialoguer via un assistant virtuel.
- **Facturation & Abonnements** : Historique de facturation, gestion de l'abonnement SaaS du vendeur (intégration de passerelles de paiement).

### 🛒 Côté Client (Vitrine Publique / Front-office)
- **Shop View (Vitrine du vendeur)** : Page d'accueil de la boutique, affichage des catégories, recherche, pagination des produits. UI premium, responsive et très conversion-oriented.
- **Product View (Fiche Produit Ultra-Pro)** : Fiche produit optimisée pour la conversion. Comprend : 
  - Compte à rebours dynamique (effet d'urgence).
  - Barre de stock avec jauge animée.
  - Offres en lots (bundles) interactives.
  - Badges de réassurance et section d'avis clients intégrée et stylisée.
  - Ajout au panier et bouton d'achat direct (Single Page Checkout) ou via WhatsApp.
- **Panier & Checkout** : Panier dynamique, tunnel de commande optimisé, paiement intégré (Stripe, CinetPay).

## 3. Technologies Utilisées (Stack Technique)

- **Frontend Core** : React 18, TypeScript, Vite.
- **Styling & UI** : Tailwind CSS (v3), Shadcn UI (basé sur Radix UI), Lucide React (icônes).
- **Backend & Database** : Supabase (PostgreSQL, Auth, Storage, Edge Functions).
- **State Management & Data Fetching** : React Query (`@tanstack/react-query`).
- **Routing** : React Router DOM (`react-router-dom`).
- **Mobile** : Capacitor (iOS/Android wrappers).
- **Autres outils** : `react-hook-form` + `zod` pour les formulaires, `i18next` pour l'internationalisation, `recharts` pour les graphiques.

## 4. Structure des Fichiers

La structure suit une architecture React/Vite standard :

```text
src/
├── components/       # Composants réutilisables (Shadcn UI, composants partagés)
│   ├── shop/         # Composants spécifiques à la vitrine (ProductReviews, ShopAIAssistant, etc.)
│   └── ui/           # Composants de base Shadcn (Button, Input, Dialog, etc.)
├── config/           # Fichiers de configuration
├── hooks/            # Custom hooks React (ex: use-toast)
├── i18n/             # Fichiers de traduction
├── integrations/     # Configurations externes (Supabase client)
├── lib/              # Fonctions utilitaires, helpers, logique métier (utils.ts)
├── pages/            # Vues principales / Routes (ShopView, ProductView, Dashboard, etc.)
├── App.tsx           # Composant racine, définition des routes
├── index.css         # Styles globaux (Tailwind directives)
└── main.tsx          # Point d'entrée de l'application
```

## 5. Décisions de Design & UX

- **Ultra-Professionnalisme** : Le design public (fiches produits, vitrines) doit toujours paraître "Premium". Utilisation de coins arrondis (`rounded-xl`, `rounded-2xl`), d'ombres douces (`shadow-sm`, `shadow-lg`), et de micro-interactions (`hover:scale-105`, transitions).
- **Thématisation Dynamique** : Les vitrines s'adaptent à la `primaryColor` définie par le vendeur. L'IA doit utiliser le style `style={{ backgroundColor: primaryColor }}` ou `borderColor` dynamiquement plutôt que des classes de couleur Tailwind codées en dur pour ces éléments.
- **Mobile-First** : L'interface publique est optimisée pour le mobile avant tout (gros boutons d'action en bas de l'écran, menus sticky, navigation tactile fluide).
- **Performance** : Les composants lourds (Avis, Assistant IA) sont chargés en Lazy Loading (`React.lazy`) dans `ProductView.tsx` pour ne pas bloquer le rendu LCP.

---

## 6. Instructions pour les Modèles IA (System Prompting / Guidelines)

Si vous êtes une IA amenée à coder sur ce projet, vous DEVEZ respecter les règles suivantes :

### A. Règle d'or de l'interaction
1. **Évitez la destruction de code** : Lors de la modification de gros fichiers (ex: `ProductView.tsx`), utilisez des outils de remplacement de texte ciblés (comme `multi_replace_file_content`) plutôt que de réécrire tout le fichier, pour éviter de perdre de la logique métier.
2. **Priorisez les outils spécifiques** : Utilisez `view_file` pour lire et `grep_search` pour chercher. N'utilisez **JAMAIS** de commandes bash `cat` ou `grep` via un terminal si des outils API natifs sont disponibles.

### B. Conventions de Code
1. **Imports** : Utilisez l'alias `@/` pour importer depuis le dossier `src` (ex: `import { Button } from "@/components/ui/button";`).
2. **TypeScript** : Typage strict obligatoire. N'utilisez `any` que si c'est strictement nécessaire pour contourner un blocage critique temporaire.
3. **Tailwind CSS** : Utilisez les classes utilitaires de Tailwind. Ne créez pas de nouveaux fichiers CSS à moins d'une absolue nécessité. Pour fusionner des classes dynamiques, utilisez l'utilitaire `cn` (`import { cn } from "@/lib/utils"`).
4. **Shadcn UI** : Réutilisez toujours les composants existants de Shadcn dans `src/components/ui/` avant de créer vos propres éléments d'interface.

### C. Base de données & Backend (Supabase)
1. **Accès DB** : Les requêtes front-end doivent passer par le client Supabase (`@/integrations/supabase/client`).
2. **RLS (Row Level Security)** : N'oubliez pas que Supabase utilise RLS. Testez ou anticipez toujours les problèmes de permissions si des requêtes retournent `[]` ou null.
3. **Schéma** : Ne modifiez pas le schéma directement depuis le front-end. Les modifications de schéma nécessitent des migrations SQL ou des ajustements via le dashboard Supabase.

### D. Workflow
Avant de commencer une tâche complexe :
1. Lisez ce fichier `Gemini.md` pour vous remettre dans le bain.
2. Cherchez les fichiers pertinents avec `grep_search`.
3. Planifiez vos modifications si la tâche est lourde, ou exécutez directement si c'est une retouche de design/UI mineure.

*Fin du document de passation.*
