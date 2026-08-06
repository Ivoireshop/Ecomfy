# Ecomfy Frontend Architecture Specifications

Ce document décrit l'organisation architecturale du frontend de l'application SaaS **Ecomfy**.

---

## 🏗️ Structure des Dossiers Frontend

```text
src/
├── components/          # Composants UI partagés et modules
│   ├── ui/              # Composants de base Design System (Button, StatCard, EmptyState, Input...)
│   ├── seo/             # SEO, Balises meta, Canonical, JSON-LD
│   ├── shop/            # Composants boutiques et facturation
│   └── ...
├── pages/               # Vues et routes principales
│   ├── Auth.tsx         # Connexion & Inscription
│   ├── Dashboard.tsx    # Tableau de bord principal SaaS
│   ├── ShopManager.tsx  # Gestion des boutiques e-commerce
│   ├── ShopEditor.tsx   # Éditeur de thèmes et produits
│   ├── ShopView.tsx     # Boutique publique et fiche produit
│   ├── Generator.tsx    # Studio de création de visuels IA
│   └── ...
├── lib/                 # Utilitaires, helpers, formatters
├── hooks/               # Hooks React personnalisés
└── index.css            # Styles globaux, tokens de design et animations CSS
```

---

## 🔒 Intégrité Backend & API

- **Strictement aucun changement destructif backend**.
- Toutes les opérations de données passent par le client Supabase et les fonctions Edge Deno existantes.
- Le cache `@tanstack/react-query` garantit des rendus instantanés avec une réactualisation transparente en arrière-plan (`staleTime: 60s`, `gcTime: 5min`).
