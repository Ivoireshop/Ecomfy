# Optimisation SEO, Chrome & PWA de VisualPro

Objectif : rendre VisualPro visible de manière professionnelle sur Google Search et Chrome (favicon, titres, descriptions, données structurées, PWA installable, sitemap), sans casser l'existant.

## 1. SEO par page (react-helmet-async)

Installer `react-helmet-async`, ajouter `HelmetProvider` dans `src/main.tsx`, puis ajouter sur chaque page publique un `<Helmet>` avec :
- `<title>` unique
- meta description unique
- canonical auto-référent vers `https://visuelpro.cloud{path}`
- Open Graph (og:title, og:description, og:url, og:type, og:image)
- Twitter Card (summary_large_image)
- un seul H1 + structure H2/H3 vérifiée

Pages couvertes :
- `/` (Index) — "VisualPro — Créez vos visuels, vidéos et boutiques avec l'IA"
- `/visuels-publicitaires`
- `/videos-publicitaires`
- `/boutiques-ecommerce`
- `/sites-vitrines`
- `/demo`, `/tutorial`, `/blog`
- `/auth` (connexion/inscription)
- `/api-documentation`, `/feedback`
- Pages légales (priority basse)
- Boutiques publiques `/shop/:slug` (dynamique depuis la base)
- Fiches produit `/shop/:slug/p/:productSlug` (déjà partiellement géré par l'edge `share-product` — on garde + on enrichit le SPA)

Le fallback statique reste dans `index.html` pour les crawlers sans JS (LinkedIn, Slack, Facebook). Les balises canoniques sont retirées de `index.html` quand chaque route possède la sienne.

## 2. Favicon et icônes Chrome / Apple

- Générer un logo carré VisualPro propre (style corporate, gradient violet/cyan déjà en charte).
- Produire : `favicon.ico`, `favicon.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` dans `public/`.
- Mettre à jour `<head>` de `index.html` avec tous les liens icon/apple-touch-icon/mask-icon + `theme-color`.

## 3. PWA installable (manifest seul, pas de service worker app-shell)

Le manifest existe déjà (`public/manifest.webmanifest`). On l'améliore :
- name complet, short_name, description marketing claire
- `start_url: "/"`, `scope: "/"`, `display: "standalone"`
- `theme_color: "#1a1d2e"`, `background_color: "#ffffff"`
- icons 192/512 (any + maskable) avec les nouveaux PNG

On NE crée PAS de service worker app-shell (règle PWA Lovable : manifest-only pour "installable"). Le worker Firebase Messaging déjà présent reste intact.

## 4. Données structurées JSON-LD

Ajouter via Helmet :
- **Sitewide** (dans `index.html`) : `Organization` + `WebSite` avec SearchAction.
- **Page d'accueil** : `SoftwareApplication` (applicationCategory: BusinessApplication, operatingSystem: Web, offers depuis FCFA). Pas d'aggregateRating tant qu'il n'y a pas d'avis réels.
- **Pages feature** (visuels, vidéos, sites, boutiques) : `Service` ou `Product` selon le cas + `BreadcrumbList`.
- **Fiches produit publiques** : `Product` (déjà partiellement injecté par l'edge `share-product`, on aligne le SPA).
- **Blog** : `Article` par post.
- **Pages FAQ existantes** (FeatureLandingPage) : `FAQPage`.
- **Formations** : `Course` quand applicable.

## 5. Sitemap & robots

Sitemap dynamique déjà en place (`supabase/functions/dynamic-sitemap`). On :
- Met à jour `public/sitemap.xml` statique pour qu'il liste les bonnes routes actuelles (ajout `/blog`, `/api-documentation`, retrait routes obsolètes).
- Garde `robots.txt` actuel (déjà bon) — on s'assure que les deux sitemaps (statique + dynamic edge) sont déclarés.

## 6. Titres marketing (resserrés)

Ré-écriture des titres de chaque page selon la liste demandée (courts, < 60 car, format `Sujet — VisualPro`).

## 7. Module "SEO Preview" pour le fondateur

Nouvelle page `/founder/seo-preview` (accessible via FounderRoute) :
- Liste des pages publiques principales avec, pour chacune :
  - aperçu desktop (favicon + url + title + description, façon Google SERP)
  - aperçu mobile (carte compacte)
  - badges : `TITLE OPTIMIZED`, `DESCRIPTION OK`, `FAVICON OK`, `SCHEMA OK`, `INDEXABLE`
- Bouton "Re-soumettre le sitemap à Google" qui appelle l'edge `seo-auto-index` existant.

Lecture seule (pas d'édition de title/description ici — ils sont versionnés dans le code).

## 8. Chiffres de crédibilité éditables

- Nouvelle table `public.platform_stats` : `key text PK`, `value int`, `label text`, `updated_at`.
- Seed des 4 valeurs demandées (979 visuels, 120 boutiques, 350 entrepreneurs, 45 vidéos).
- Lecture publique (anon `SELECT`) ; écriture réservée au rôle `founder` via `has_role`.
- Composant `<CredibilityBar />` sur la page d'accueil qui lit la table avec un fallback (les valeurs seed) pour éviter tout flash vide.
- Édition depuis `FounderDashboard` (mini formulaire 4 champs).

## 9. Performance pages publiques

- `loading="lazy"` + `decoding="async"` sur toutes les images non-hero.
- `fetchpriority="high"` sur le hero d'`/`.
- Vérifier que les pages publiques ne sont pas derrière `ProtectedRoute`.
- Pas de gros refactor perf : on respecte "ne pas casser l'existant".

## 10. Garde-fous

- Aucun changement de logique business.
- Aucun service worker app-shell ajouté.
- Auto-gen Supabase, `client.ts`, `types.ts` jamais touchés.
- Les edge functions existantes (`share-product`, `dynamic-sitemap`, `seo-auto-index`) restent et sont réutilisées.

## Détails techniques

```text
src/
  main.tsx                       + HelmetProvider
  components/seo/
    SEO.tsx                      composant Helmet réutilisable
    JsonLd.tsx                   helper JSON-LD typé
    CredibilityBar.tsx
  pages/
    Index.tsx                    + <SEO> + SoftwareApplication JSON-LD + CredibilityBar
    VisuelsPublicitaires.tsx     + <SEO> + Service + BreadcrumbList
    VideosPublicitaires.tsx      idem
    BoutiquesEcommerce.tsx       idem
    SitesVitrines.tsx            idem
    Auth.tsx                     + <SEO>
    Blog.tsx                     + <SEO> + Article par post
    ApiDocumentation.tsx         + <SEO>
    founder/SeoPreview.tsx       nouveau (route /founder/seo-preview)
  App.tsx                        + route SeoPreview (FounderRoute)
public/
  favicon.ico, favicon.svg, icon-192.png, icon-512.png, apple-touch-icon.png
  manifest.webmanifest           amélioré
  sitemap.xml                    rafraîchi
index.html                       icônes, OG/Twitter par défaut, JSON-LD Organization+WebSite
supabase/migrations/             table platform_stats + RLS + GRANT + seed
```

Pas de nouveau secret, pas de nouvelle dépendance hors `react-helmet-async`.

## Livraison

Implémentation en une passe, en commençant par : dépendance + HelmetProvider + composant SEO, puis migrations, puis pages, puis assets, puis module Founder.
