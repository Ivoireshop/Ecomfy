## Objectif

Rendre VisualPro entièrement utilisable sur téléphone (création boutique, produits, images, commandes, paiement, IA, aperçu, partage) tout en préservant intégralement la version ordinateur. Aucune fonctionnalité supprimée — uniquement des adaptations responsive et de navigation.

## Approche

Travail purement frontend/CSS/layout, par lots indépendants. Chaque modification utilise les breakpoints Tailwind (`sm`, `md`, `lg`) pour ne toucher au desktop que via les classes `md:` et au-dessus.

## Lot 1 — Navigation mobile (priorité haute)

Problème actuel : la `ShopSidebar` (240px sombre) reste affichée sur mobile et coupe l'écran ; le `StartChecklist` est invisible sur téléphone.

- `src/components/shop/ShopSidebar.tsx` : masquer par défaut sur mobile (`hidden md:flex`), ouverture via Sheet (drawer gauche) déclenché par un bouton hamburger.
- Ajouter dans `src/pages/ShopEditor.tsx` une **TopBar mobile** : hamburger (ouvre la sidebar en Sheet), titre boutique, bouton « Sauvegarder », bouton « Aperçu » (icônes).
- Ajouter une **BottomNav boutique** mobile (`ShopMobileBottomNav.tsx`) : Tableau de bord, Produits, Commandes, Boutique, Plus (Sheet avec le reste : finances, IA, thème, paramètres…). Badges commandes non lues.
- Préserver la `MobileBottomNav` globale uniquement hors de `/shop-editor/*` (la nouvelle bottom-nav boutique la remplace dans l'éditeur).

## Lot 2 — Tableau de bord & checklist mobile

- `src/components/dashboard/StartChecklist.tsx` : grille empilée en mobile, items pleine largeur, bouton CTA tactile (`h-11`), padding réduit, plus de scroll horizontal.
- `src/pages/Dashboard.tsx` : titre `text-2xl` en mobile, services hub en 1 colonne sur xs / 2 sur sm.
- Vérifier que la checklist apparaît bien au-dessus du fold sur téléphone.

## Lot 3 — Liste produits & fiche produit mobile

- `src/components/shop/ProductsTable.tsx` : sur mobile (`md:hidden`), remplacer la table par des **cartes produit** (image carrée 80px, nom, prix, badge statut horizontal, menu actions ⋯ : modifier, voir, dupliquer, supprimer, publier/dépublier). Garder la table en `hidden md:table`.
- Barre d'outils mobile sticky : recherche pleine largeur + filtres dans Sheet + bouton « Créer un produit » flottant (FAB) en bas-droite.
- `src/components/shop/ProductEditor.tsx` : sections en **accordéon** sur mobile (Informations / Images / Description / Livraison / Aperçu / Publication). Champs `h-11`, espacements `space-y-4`. Footer sticky mobile avec « Sauvegarder » + « Publier ».
- `ProductWizard` déjà adapté ; vérifier hauteurs tactiles.

## Lot 4 — Ajout d'images mobile

- Bouton d'upload visible en haut de la section Images, taille tactile, libellé « Ajouter une image ». `accept="image/*"` + `capture="environment"` pour proposer l'appareil photo natif.
- Grille images responsive 2 colonnes mobile / 4 desktop, drag-handle remplacé par boutons ↑ ↓ tactiles sur mobile.
- Compression auto déjà en place (`imageCompress.ts`) ; ajouter message clair en cas d'échec.

## Lot 5 — Commandes mobile

- `src/components/shop/OrdersList.tsx` : vue cartes sur mobile (client, produit, montant, date, statut, actions Voir/Appeler/WhatsApp). Pas de table à scroll horizontal.
- Respect du verrouillage (masquage infos sensibles déjà en place via `LockedOrdersScreen`).

## Lot 6 — Paiement / verrouillage / aperçu / IA mobile

- `LockedOrdersScreen` + `BillingBanner` : padding mobile, bouton « Payer maintenant » pleine largeur sticky.
- `ProductAIOptimizer` & `ShopAIAssistant` : boutons IA en grille 2 col mobile, réponses dans une carte scrollable, boutons « Copier / Insérer » tactiles.
- Aperçu boutique : boutons « Voir comme client », « Copier le lien », « Partager WhatsApp/Facebook » regroupés dans une barre sticky bas en mobile.

## Lot 7 — Ergonomie globale

- Audit CSS : retirer `min-w-[...]` excessifs, ajouter `overflow-x-hidden` sur le shell, vérifier que tous les boutons critiques ont `min-h-11`.
- Modales (`Dialog`, `Sheet`) : `max-h-[90vh] overflow-y-auto`, bouton fermer visible.
- Toasts standardisés : « Produit enregistré », « Image ajoutée », « Sauvegarde en cours… », « Toutes les modifications sont enregistrées ».

## Tests

Playwright headless en viewport 375×812 (iPhone), 414×896, 768×1024, 1280×800 : login → dashboard → checklist → créer produit → upload image → sauver → voir commandes → ouvrir menu boutique → paiement. Screenshots à chaque étape pour vérifier qu'aucun bouton n'est coupé.

## Hors scope

- Pas de changement de logique métier, RLS, edge functions, paiements, IA backend.
- Pas de refonte desktop : toutes les classes responsive ciblent uniquement `< md`.

## Détails techniques

- Breakpoints : `sm` 640, `md` 768, `lg` 1024.
- Nouveau composant `src/components/shop/ShopMobileBottomNav.tsx`.
- Conversion sidebar boutique : wrapper conditionnel `useIsMobile()` → `Sheet side="left"`.
- FAB : `fixed bottom-20 right-4 z-40 md:hidden` (au-dessus de la bottom-nav `h-14`).
- Sticky footer mobile éditeur produit : `sticky bottom-0 bg-background/95 backdrop-blur p-3 border-t md:hidden`.

## Livraison

Lots 1→7 livrés séquentiellement dans une seule passe, avec capture Playwright finale en 375px pour validation visuelle.
