# Accueil boutique : correctifs et améliorations (09/11/2026)

**Nature :** front seul. Aucune migration, aucune Edge Function. Testé dans le navigateur sur la **dev** (`xfpbpxncserliskrbaim`), bureau et mobile.

## Ce qui change pour les visiteurs

- Tous les produits sont atteignables : section « Plus de produits » (sans doublon avec les vedettes), jusqu'à 8 vedettes au lieu de 4.
- Recherche sans accents (nom, catégorie, accroche), suggestions en direct, recherche visible sur mobile dans l'en-tête.
- Tri (pertinence, promotions, prix, nouveautés), compteurs de catégories, états vides distincts (boutique sans produit / aucun résultat).
- Panier conservé entre les visites (`localStorage`, clé `vp_cart_<shop_id>` : identifiants et quantités seulement, jamais de prix).
- Badge « Plus que N » (stock de 1 à 5).
- Accueil personnalisé (HomepageBuilder) : le panier, la fenêtre produit et le bouton flottant existent enfin ; les catégories filtrent la grille.

## Changement visible pour les marchands (à connaître avant de déployer)

Ces textes étaient écrits en dur et faux pour la plupart des boutiques. Ils sont **masqués par défaut** :

| Avant | Maintenant |
|---|---|
| Bandeau « Livraison gratuite partout » | Réglage **Thème > Bannière > Bandeau d'annonce** (désactivé par défaut) |
| Badge « Boutique officielle » du hero | Réglage **Thème > Accueil > Badge du hero** (vide par défaut) |
| « Support 7j/7 », « 100 % authentiques », « Expédition partout » | Barre d'engagements limitée aux faits vrais (interrupteur `trust_bar_enabled`) |

Nouvelles clés de `theme_config` (aucune liste blanche côté serveur) : `top_banner_enabled`, `top_banner_text`, `top_banner_bg`, `top_banner_text_color`, `hero_badge_text`, `trust_bar_enabled`.

## Vérifications faites

- `vitest` : 245 tests (dont 23 nouveaux dans `src/lib/shopCatalog.test.ts`).
- `npm run typecheck` : aucune nouvelle erreur ; lint propre sur les fichiers touchés.
- Navigateur (dev) : recherche, suggestions, panier + rechargement, fenêtre du panier mobile, accueil personnalisé (`infection-urinaire`), couleurs calculées au repos et au survol de 8 boutons.

## Non couvert

- Accueil par thème pro (`ShopThemeRenderer`) : non modifié, non testé.
- Aucune commande passée pendant les tests.
- Textes de l'interface toujours en français, hors traduction automatique.

## Déploiement

Fusion de la branche puis déploiement du front (Vercel). Rien d'autre. Retour arrière : revenir au commit précédent.
