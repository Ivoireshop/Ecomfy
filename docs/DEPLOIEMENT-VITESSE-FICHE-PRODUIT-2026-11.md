# Vitesse de la fiche produit sur mobile — 09/11/2026

Front seul : aucune migration, aucune Edge Function. Suite de `c4e8661` (fiche allégée pour les publicités).

## Protocole de mesure (reproductible)

- Build de production servi en local avec compression Brotli et les mêmes en-têtes de cache que `vercel.json`.
- Chrome émulé : écran 390 × 844, réseau « 4G lente » (1,6 Mbit/s, 150 ms), processeur ralenti ×4, cache désactivé.
- Données : vraies fiches de la dev (copie de la prod du 04/11), API Supabase réelle.
- Chaque mesure est faite 2 fois ; l'écart d'une passe à l'autre est d'environ ±0,3 s : seuls les écarts répétés comptent.
- Outils : Playwright + CDP (PerformanceObserver pour LCP/CLS/tâches longues, trace du fil principal). Lighthouse n'est pas installé.

## Résultat (fiche « mouus », image d'origine de 410 Ko)

| | Avant | Après |
|---|---|---|
| LCP (image principale affichée) | 5,9 – 6,0 s | **5,3 s** |
| Temps de blocage total (TBT) | 3,2 – 3,5 s | **2,3 s** |
| Données reçues avant l'affichage | 398 Ko | **260 Ko** |
| Pixels publicitaires reçus avant l'affichage | 116 Ko | **4 Ko** |
| Début du téléchargement du code de la fiche | 850 ms | **270 ms** |
| Écran à 0,9 s | entièrement blanc | squelette de la fiche |
| Image principale (3 fiches) | 105 / 158 / 128 Ko | **73 / 119 / 91 Ko** |

Même tendance sur les deux autres fiches mesurées (LCP −0,6 à −0,8 s sur « toto-chilachi » ; « infections-vaginales » plus bruitée : −0,2 à −0,8 s).

## Ce qui a changé

1. **Image principale à qualité 75** (au lieu de 85) : −25 à −30 % d'octets, WebP, pas de différence visible. `HERO_IMAGE_QUALITY` dans `imageUrl.ts`, répétée dans `index.html` (préchargement) et dans les thèmes ; un test vérifie que `index.html` et le code restent identiques (sinon l'image serait téléchargée deux fois).
2. **Images de la description en `loading="lazy"`** (`sanitizeProductHtml.ts`) : une description peut en contenir 12 à 40 ; elles partaient toutes au chargement et se disputaient la bande passante avec l'image principale. Un `loading="eager"` explicite du marchand est respecté.
3. **Nettoyage HTML de la description mémorisé** (`useMemo`) : il se refaisait à chaque rendu.
4. **Pixels / analytique après le premier affichage** (`lib/afterFirstPaint.ts`) : Meta (111 Ko, ~0,3 s de processeur), TikTok, Snapchat, Google et `track-shop-visit` partent juste après la première peinture (minuteur de secours à 2,5 s si l'onglet est en arrière-plan). Mêmes événements, même contenu, même identifiant.
5. **Code de la fiche préchargé dès le `<head>`** (`vite.config.ts`, plugin `ecomfy-preload-product-chunks`) : liste calculée au build (34 fichiers), active seulement sur `/shop/:slug/p/:produit` et `/shop/:slug/product`. Les autres pages ne téléchargent rien en plus.
6. **Squelette immédiat** : CSS pur dans `index.html` (visible avant React) puis composant `ProductSkeleton` (même forme) pendant le chargement du code et de la fiche.
7. **Vidéos** : `preload="metadata"` (ou `"none"` avec vignette) au lieu de `"auto"` ; **audios** : `preload="none"`.
8. **Favicon** : 154 px / 29,9 Ko → 64 px / 1,7 Ko (il se téléchargeait en même temps que l'image principale).

## À savoir avant de déployer

- **FCP = LCP restent égaux** dans la mesure : le squelette est fait de fonds unis, que la métrique ne compte pas comme « contenu ». Il est bien visible (capture à 0,9 s) mais ne change pas le score FCP de Lighthouse.
- **Un événement Meta/TikTok peut partir 50 à 300 ms plus tard**, jusqu'à 2,5 s si l'onglet est en arrière-plan. Un visiteur qui quitte avant le premier affichage n'est plus compté (il ne voyait de toute façon pas la page). À surveiller dans le Gestionnaire d'événements Meta les premiers jours : le nombre de `ViewContent` ne doit pas baisser de façon notable.
- Les vidéos **sans vignette** chargent leurs métadonnées pour montrer une première image (≈ 58 Ko sur la fiche mesurée, contre 86 Ko avant). Ajouter une vignette aux vidéos ferait tomber ce chiffre à zéro.
- Les images de la description des boutiques tierces (ex. `/stores/...`) ne sont pas redimensionnables par Supabase : elles gardent leur poids d'origine, mais ne se chargent plus qu'à l'approche de l'écran.

## Piste restante (non faite)

Il reste ~2,3 s de blocage du processeur entre la fin des téléchargements (≈ 3 s) et l'affichage (≈ 5,3 s) : rendu React de toute la page (≈ 1 s de JavaScript) + mise en page. Hypothèse « polices Google » testée et **écartée** (même résultat sans polices). Leviers possibles, à mesurer avant de les faire : afficher d'abord l'en-tête de fiche et monter le reste (description, formulaire, avis) après la première peinture ; `content-visibility: auto` sur la description (attention au défilement vers le formulaire de commande).

## Vérifications faites

- `vitest` : 285 tests passent (dont le nouveau test de synchronisation `index.html` ↔ code).
- `npm run typecheck` : aucune nouvelle erreur. `eslint` sur les fichiers modifiés : 0 erreur.
- Navigateur (build de production, sans limitation) : fiche « mouus » et fiche à vidéos — image principale à 800 px / qualité 75, 0 erreur console, toutes les images de description chargées au défilement, formulaire de commande présent.

## Non testé

- Appareil réel, Safari iOS (comportement de `preload` vidéo, `content-visibility`).
- Domaine personnalisé d'une boutique (le préchargement du code ne couvre que les URL `/shop/...`).
- Production : mesures faites contre la dev (copie de la prod du 04/11).
- Fiches « thème » (`LazyThemeRenderer`) : qualité alignée dans `ThemeShared.tsx`, mais pas mesurées.
