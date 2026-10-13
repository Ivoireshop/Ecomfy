# Plan : restructuration du frontend en architecture MVC (par domaine)

## Context

Le frontend (~118 000 lignes TS/TSX, ~523 fichiers) n'a aucune séparation des responsabilités :
- `pages/` (74 fichiers) et `components/` (267, dont 64 en vrac à la racine) sont plats ; les vues font elles-mêmes les requêtes : ~588 `.from()` (38 pages + 75 composants), 72 `functions.invoke`, ~30 uploads, 17 fichiers realtime.
- 10 fichiers dépassent 1 000 lignes et mélangent état, accès données, logique métier et JSX : `ProductEditor` (2243), `ProductView` (2031), `ShopView` (1672), `FounderDashboard` (1472), `ShopEditor` (1448, 41 `.from()`, 18 sous-composants inline), `CoursesManager` (949, 32 `useState`).
- Duplications : `formatPrice` redéfini dans ~12 fichiers, 2 systèmes de toast (`use-toast` + `sonner`), upload d'images recopié dans ~24 fichiers, 63 fichiers appellent `supabase.auth.getUser/getSession` directement, 184 `useEffect` de fetch manuels (react-query dans 4 fichiers seulement).
- Pas de test runner, pas de règles de frontière d'import, `strict: false`.

Objectif : une architecture **MVC adaptée à React, organisée par domaine**, appliquée **progressivement** (domaine par domaine, sans changement de comportement), qui sert aussi de **point de bascule** pour la migration Laravel (`docs/MIGRATION-LARAVEL.md`) : seule la couche *service* parle au backend.

Références déjà dans le code : `src/hooks/useSeoIntelligence.ts` + `src/services/{gsc,seoAudit,seoReport}Service.ts` + `pages/SeoIntelligencePage.tsx` (meilleur exemple actuel), et `src/modules/connectus/` (structure déjà en couches, à découper).

## Correspondance MVC → React

| MVC | Rôle | Contenu | Interdit |
|---|---|---|---|
| **Model** (`models/`) | Données et règles pures | Types/entités, schémas zod, mappers DTO→entité, règles métier pures (seuils de commission, coût des crédits IA, calcul de totaux), clés react-query | React, supabase, `fetch` |
| **View** (`views/`) | Affichage | Composants et pages « bêtes » : props in, événements out, Tailwind/shadcn | supabase/api, `useQuery`, toasts métier |
| **Controller** (`controllers/`) | Orchestration | Hooks `useXController` : react-query (queries/mutations), état de formulaire, actions, toasts, navigation, abonnements realtime ; renvoie un view-model | JSX, appel direct à supabase |
| **Service** (`services/`) | Accès données (équivalent Repository) | **Seul** endroit qui appelle supabase/`src/core/api` : CRUD, RPC, edge functions, storage | React, toasts |

Flux : `View → Controller → Service → backend` ; `Model` est utilisé par les trois couches du dessus.

## Arborescence cible

```
src/
  app/                      # amorçage de l'application
    providers/              # QueryClient, Theme, Tooltip, Toaster, AuthProvider
    router/                 # routes.tsx par domaine, layouts, guards (ProtectedRoute, FounderRoute), lazyWithRetry
    shell/                  # AppSidebar, Header, Footer, MobileBottomNav, SupportButton, IdlePrefetcher
  core/                     # infrastructure transverse, sans métier
    api/                    # client HTTP + adaptateur supabase (aujourd'hui) / Laravel (demain), flags par domaine
    auth/                   # AuthProvider + useAuth (remplace useAuthReady et ~70 getUser/getSession)
    i18n/  config/  integrations/supabase/ (jusqu'à extinction)
  shared/                   # réutilisable, sans domaine
    ui/                     # shadcn (components/ui) + EmptyState, StatCard
    models/                 # money.ts (formatMoney FCFA), dates, validators
    services/               # storageService (uploadImage + imageCompress), errorHandler
    hooks/                  # useIsMobile, useScrollReveal, useDebounce…
  features/
    <domaine>/
      models/               # *.types.ts, *.schema.ts, *.rules.ts, *.keys.ts
      controllers/          # use<Xxx>Controller.ts
      views/
        pages/              # <Xxx>Page.tsx : page fine = controller + vues
        components/         # sections et widgets du domaine
      services/             # <xxx>.service.ts
      index.ts              # API publique du domaine (seule porte d'entrée)
```

Domaines (`features/`) : `auth`, `shop` (vitrine publique + éditeur marchand), `catalog` (produits, variantes, thèmes), `orders`, `billing` (abonnement, promo, factures, commission), `ecomfy-pay`, `academy` (cours, élèves, certificats), `showcase` (sites vitrines, blog, réservations), `studio` (génération IA, bibliothèque, crédits), `delivery` (+ driver), `affiliate`, `connectus` (+ community), `governance`, `seo`, `founder` (admin), `landing` (marketing), `notifications`.

## Règles de dépendance (appliquées par ESLint)

- `views` n'importent ni `services`, ni `supabase`, ni `core/api`.
- `controllers` n'importent pas `views`.
- `services` n'importent ni React ni `views`/`controllers`.
- `models` n'importent rien d'autre que `shared/models`.
- Un domaine n'importe un autre domaine **que via son `index.ts`**.
- `supabase` n'est importé que par `core/api` et les `features/*/services` (170 fichiers → ~40 fichiers de service).
- Outil : `no-restricted-imports` / `eslint-plugin-boundaries` dans `eslint.config.js`, d'abord en `warn`, puis `error` à la fin.

## Recette par fichier/écran (appliquée à chaque vague)

1. **Service** : déplacer les appels `supabase.*` tels quels dans `features/<d>/services/*.ts` (déplacement pur, mêmes requêtes).
2. **Model** : extraire types, schémas, formatage et règles pures.
3. **Controller** : un hook `use<X>Controller` en react-query (remplace `useEffect`+`useState`+`loading`), regroupant actions et toasts.
4. **Views** : découper en sous-composants de moins de ~300 lignes, sans accès données.
5. **Page** : composition fine (< 150 lignes) : `const vm = useXController(); return <XView {...vm} />`.
6. Ancien chemin conservé comme **re-export** (`export * from`) le temps de la transition pour garder des PR petites ; supprimé en fin de vague. Déplacements via `git mv` pour préserver l'historique.
7. Vérifier à chaque PR : build, lint, smoke du parcours, **aucun changement de comportement**.

## Phases

### Phase 0 — Filet de sécurité et nettoyage
- Ajouter **vitest + Testing Library** (+ scripts `test`) ; convertir `src/test/*` et `lib/studio/__tests__/commandEngine.test.ts` en vrais tests ; smoke tests Playwright (déjà disponibles) sur les parcours clés (auth, boutique publique, commande, dashboard).
- Supprimer le code mort **après vérification par `knip` + build** : `src/App.tsx.orig`, `src/App.css`, `pages/Generator.tsx` (1 932) et `pages/VideoCreator.tsx` (non routés, redirigés vers `/studio`), `config/pricingPlans.ts`, doublon `components/ui/use-toast.ts`, et le cluster `Showcase*`/éditeurs apparemment orphelin (~55 composants sans importeur) — à confirmer avant de toucher.
- Ranger ou supprimer les scripts jetables à la racine (`scratch*`, `test-*.{js,ts,cjs,mjs}`, `*.patch`, `patch_*.mjs`, `fetch-videos*`, `query_videos.mjs`, `check_db.js`) : à valider avec vous avant suppression.
- Ajouter les règles ESLint de frontière en mode `warn`.

### Phase 1 — Fondations `core/` et `shared/` (gains rapides, déduplication)
- `core/auth/AuthProvider` + `useAuth()` (context au-dessus de la logique de `src/hooks/useAuthReady.ts`) ; remplacer progressivement les ~63 `getUser/getSession` et les 7 `onAuthStateChange` locaux (`AiQuota`, `FounderDashboard`, `FounderTroubleshooting`, `PaymentHistory`, `PromoCodeManager`, `Subscription`…).
- `shared/models/money.ts` : un seul `formatMoney(amount, currency)` remplaçant les ~12 `formatPrice` locaux (`ProductView` l.539, `ShopView` l.782, `ProductLivePreview`, `ProductsTable`, `EcomfyPay*`, `PaymentHistory`, `ShopManager`, `AffiliateSpace`, `FounderAffiliateAdmin`, + `lib/productThemes|shopThemes/dataAdapter.ts`).
- `shared/services/storageService.ts` : `uploadImage()` unique (réutilise `lib/imageCompress.ts`, `lib/imageUrl.ts`, et la logique de `modules/connectus/utils/fileUploader.ts`) pour les ~24 fichiers d'upload.
- **Un seul système de toast** (sonner) via `shared/` ; `lib/error-handler.ts` généralisé (aujourd'hui 3 usages).
- `core/api` : client + adaptateur supabase (partagé avec la Phase 1 du plan Laravel).
- `app/` : éclater `src/App.tsx` (663 lignes) en `providers/`, `router/` (routes par domaine, **layout routes** à la place des `<ProtectedRoute>` inline et du `PUBLIC_PAGES` par pathname), `shell/` ; extraire `AuthCallbackHandler`, `isCustomShopHost`, `IdlePrefetcher`, `AppWithSidebar`.
- Alias : `@/app`, `@/core`, `@/shared`, `@/features` (dans `tsconfig*.json` et `vite.config.ts`).

### Phase 2 — Domaines pilotes pour figer le gabarit
1. **seo** : déjà proche de la cible → devient le gabarit documenté (`features/seo/…`).
2. **connectus** : découper `connectus.service.ts` (1 437 lignes) en plusieurs services (posts, stories, messages, profils, notifications), retirer l'import supabase direct dans `useConnectUs`, supprimer l'accès direct de `ConnectUsPage` au service, passer en react-query ; fusionner `pages/Community.tsx` (706, realtime + requêtes directes) dans le domaine.
3. **affiliate** : découper `affiliateService.ts` (866) et `AffiliateSpace`/`FounderAffiliateAdmin`.

### Phase 3 — Vagues par domaine (du moins couplé au plus risqué)
1. `delivery` (+ driver) — déjà react-query et `deliveryService`.
2. `governance` — `useCorporateGovernance` (440) + `CorporateGovernance` (935) qui requête encore en direct.
3. `billing` (Subscription, PricingDashboard, PromoCodeManager, PaymentHistory, `billingSystem`, `subscriptionStatus`).
4. `ecomfy-pay` (`lib/ecomfyPay.ts` → service, pages `EcomfyPay*`).
5. `academy` + `showcase` (`CoursesManager` 949, `CourseModulesManager`, `EnrollmentsManager`, `BlogManager`, bookings, `TrashManager`).
6. `studio` (génération IA, bibliothèque, `AICreditsBadge`, `GenerationQueue`) — réalimente `core/api` pour les edge functions.
7. `founder` (`FounderDashboard` 1 472 lignes, 16 requêtes directes → plusieurs services/contrôleurs par widget).
8. **`shop` / `catalog` / `orders` en dernier** (le plus gros et le plus risqué) : `ShopEditor` (1 448) en sections + contrôleurs, `ProductEditor` (2 243), `ProductView` (2 031), `ShopView` (1 672), `ShopSettings`, `ShopThemeSettings` (1 363, quasi pure vue : découpe par sections), `HomepageBuilder`. Les moteurs de thèmes `lib/productThemes` et `lib/shopThemes` (vues sous `lib/`) deviennent `features/catalog/views/themes` et `features/shop/views/themes`.
9. `landing` + `auth` (`Auth.tsx` 932 : contrôleur + vues connexion/inscription/reset ; pages statiques `Documentation`, `Academy` déplacées sans refonte).

### Phase 4 — Verrouillage
- Règles de frontière passées en `error`, suppression des re-exports et anciens dossiers (`src/components` racine, `src/pages`, `src/lib` métier, `src/services` à plat, `src/hooks` métier).
- Mise à jour de `FRONTEND_ARCHITECTURE.md` (actuellement obsolète), `UI_COMPONENTS.md`, ajout d'un guide « comment ajouter un domaine/écran » basé sur `features/seo`.
- Option ultérieure : activer progressivement `strict`/`noImplicitAny` par dossier (~860 `any` aujourd'hui) — hors périmètre de cette restructuration.

## Cohérence avec le plan Laravel

Cette restructuration **est** la Phase 1 de `docs/MIGRATION-LARAVEL.md` (couche `src/api`, services extraits, source d'auth unique). Chaque domaine, une fois passé en MVC, ne se branche sur Laravel qu'en changeant son fichier `services/*.ts` (flag par domaine dans `core/api`). Ordre recommandé : **MVC d'un domaine → bascule Laravel de ce domaine**, domaine par domaine.

## Objectifs mesurables (définition de « terminé »)

- Aucun fichier de vue/page > ~400 lignes ; pages < 150 lignes.
- Zéro import de `supabase` dans `views/` et `controllers/` ; imports supabase confinés à `core/api` + `features/*/services`.
- Un seul `formatMoney`, un seul `uploadImage`, un seul système de toast, un seul accès à l'auth.
- Fetch de données via react-query dans les contrôleurs (plus de `useEffect` de chargement manuel).
- Tests : vitest vert + smoke Playwright par domaine migré.

## Vérification

- Chaque PR : `npm run build`, `npm run lint` (règles de frontière), `npm run test`, smoke Playwright du parcours concerné (ex. shop : charger une boutique publique → ajouter au panier → passer commande ; auth : email + Google + reset).
- Comparer la taille du bundle avant/après (vite build) pour détecter les régressions de lazy-loading.
- Contrôles automatisés de frontière : `grep`/ESLint pour vérifier qu'aucun `supabase` n'est importé hors services.
- Revue visuelle (captures Playwright avant/après) sur les écrans découpés : `ShopEditor`, `ProductEditor`, `ProductView`, `ShopView`.

## Points à valider avec vous

- Suppression du code mort et des scripts racine (liste en Phase 0) : à confirmer avant suppression.
- Organisation **par domaine avec MVC à l'intérieur** (recommandé) plutôt que trois gros dossiers globaux `models/ views/ controllers/` (qui ne passent pas à l'échelle ici : 15+ domaines, 500+ fichiers).
