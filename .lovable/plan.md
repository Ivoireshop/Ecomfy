# Système de thèmes professionnels — Vraies structures de fiche produit

## Objectif
Transformer le système actuel (qui ne change que couleurs/fond) en un vrai moteur de **layouts** : chaque thème réorganise les sections de la fiche produit publique, sans toucher au contenu ni casser l'existant.

## Principe directeur — Non destructif
- Aucune fiche existante n'est modifiée tant que le vendeur n'a pas explicitement choisi un thème.
- Si `theme_slug = null` ou `theme_slug = "classic"` → l'affichage actuel de `ProductView.tsx` reste **strictement inchangé**.
- Le contenu produit reste dans la table `products` (rien n'est dupliqué). Le thème ne stocke que la présentation.
- Si un thème plante au runtime → fallback automatique vers le rendu classique (ErrorBoundary).

## Lot 1 — Moteur de thèmes (architecture)

Créer `src/lib/productThemes/` :
- `types.ts` — types `ThemeLayout`, `ThemeSection` (`hero | gallery | benefits | problem | solution | usage | testimonials | audios | faq | guarantee | urgency | cta | related`), `ThemeRegistry`.
- `registry.ts` — registry central qui mappe `slug → { meta, layout, sections[], renderer }`.
- `dataAdapter.ts` — `mapProductToThemeData(product, audios, reviews)` qui transforme les données existantes en blocs réutilisables (titre, prix, ancien_prix, images, description courte/longue, bénéfices extraits, témoignages, audios, FAQ).
- `ThemeRenderer.tsx` — composant unique qui prend `{ slug, data, settings }` et orchestre le rendu, avec ErrorBoundary + Suspense + lazy import du thème choisi (un seul thème chargé par fiche → perf).

## Lot 2 — 7 vrais layouts (composants distincts)

Chaque thème = un dossier `src/lib/productThemes/themes/<slug>/` avec son propre `index.tsx`, ses sections et son CSS scopé (Tailwind + variables) :

1. **classic-premium** — image gauche / infos droite, structure sobre.
2. **landing-ad** — hero promesse + CTA → problème → solution → bénéfices → preuves → témoignages → urgence → FAQ → CTA final (vraie page de vente).
3. **health-wellness** — promesse douce, bienfaits, mode d'emploi, témoignages audio mis en avant, précautions, FAQ.
4. **luxury-dark** — hero plein écran, typo minimaliste, espaces larges, fond sombre, CTA raffiné.
5. **storytelling** — situation → problème → découverte → transformation → avant/après → CTA.
6. **mobile-first** — sticky CTA en bas, accordéons partout, sections courtes, bouton WhatsApp flottant.
7. **promo-offer** — badge promo géant, prix barré, compte à rebours, stock limité, rappel CTA en bas.

Chaque thème est **chargé en lazy** (`React.lazy`) — un visiteur ne télécharge que le thème de la fiche qu'il consulte.

## Lot 3 — Intégration dans `ProductView.tsx`

```tsx
const settings = await fetchProductThemeSettings(productId);
if (!settings?.theme_slug || settings.theme_slug === 'classic') {
  return <ClassicProductView ... />; // code actuel, intact
}
return (
  <ErrorBoundary fallback={<ClassicProductView ... />}>
    <ThemeRenderer slug={settings.theme_slug} data={...} settings={settings} />
  </ErrorBoundary>
);
```
Aucune modification du rendu actuel : on **emballe**, on ne remplace pas.

## Lot 4 — UX éditeur

Étendre `ProductThemePicker.tsx` :
- Galerie avec vraies vignettes (mini-wireframes SVG montrant la structure, pas juste des pastilles de couleur).
- Bouton **Prévisualiser** → ouvre `/shop/:slug/p/:productSlug?preview_theme=<slug>` dans un nouvel onglet (rendu réel, lecture seule).
- Bouton **Appliquer** avec confirmation : *« Ce thème va modifier la présentation visuelle… vos textes, images, audios et informations ne seront pas supprimés. »*
- Bouton **Revenir au design classique** (réinitialise `theme_slug = null`).
- Personnalisation limitée : couleurs principales / CTA / sections visibles (déjà géré dans `ProductAppearancePanel`).

Nouveau dialog `NewProductChoiceDialog.tsx` (cas 2) : quand un vendeur clique « Ajouter un produit », il choisit entre **Fiche classique** ou **Démarrer depuis un thème** (le wizard pré-remplit alors les champs spécifiques au thème).

## Lot 5 — Base de données

Réutiliser les tables existantes `product_themes` + `product_theme_settings`. Ajouter via migration :
- Colonne `product_theme_settings.preview_only` (bool) — pour la prévisualisation sans application.
- Seed des 7 thèmes dans `product_themes` avec `layout_config` (JSON décrivant l'ordre/visibilité des sections par défaut).

Aucun changement destructif sur les tables existantes.

## Lot 6 — Performance

- Lazy-load par thème (un seul bundle thème chargé par fiche publique).
- Images : `loading="lazy"` partout sauf hero (`fetchpriority="high"`).
- Audios : `preload="none"` (déjà fait).
- Pas de framer-motion sur le rendu public (animations CSS only).
- Pas de fetch supplémentaire : `product_theme_settings` est récupéré dans la même requête initiale de `ProductView`.

## Lot 7 — Tests manuels (Playwright)

Vérifier : fiche sans thème inchangée, application de `landing-ad`, changement vers `luxury-dark`, retour classique, mobile 390px, données conservées en DB.

---

## Détails techniques

- **Aucun changement** à `ProductView.tsx` dans le chemin sans thème (sécurité totale pour les fiches déjà publiées).
- **ErrorBoundary** obligatoire autour de `ThemeRenderer` → fallback classique en cas de bug.
- **Slugs publics inchangés** : `/shop/:slug/p/:productSlug` reste l'URL canonique.
- **Bucket storage** : `shop-images` (déjà utilisé pour audios), pas de nouveau bucket.
- **Premium** : flag `is_premium` respecté côté UI (toast « bientôt disponible »), aucun paiement bloquant.
- **Admin** : pas d'UI admin dédiée dans ce lot ; les thèmes sont seedés via migration, modifiables plus tard côté DB.

## Hors scope (pour itérations futures)
- UI admin de gestion des thèmes (CRUD visuel).
- Paiement réel des thèmes premium.
- Statistiques d'usage par thème.
- Wizards de création guidée détaillés par thème (un wizard générique simple est fourni ; les wizards spécialisés peuvent venir ensuite).
