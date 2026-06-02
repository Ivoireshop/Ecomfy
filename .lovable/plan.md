# Réordonnancement des sections de la fiche produit

## Objectif
Permettre au vendeur de déplacer librement (drag & drop) les blocs d'une fiche produit : image, titre/prix, description courte, description longue, compte à rebours, barre d'urgence stock, options/variantes, quantité, bouton commander, etc.

## Sections déplaçables
1. **Galerie image** (`gallery`)
2. **Titre + prix** (`title_price`)
3. **Compte à rebours** (`countdown`)
4. **Barre d'urgence stock** (`stock_urgency`)
5. **Description courte** (`short_description`)
6. **Variantes / options** (`variants`)
7. **Quantité** (`quantity`)
8. **Bouton commander** (`order_button`)
9. **Description longue** (`long_description`)
10. **Preuve sociale / avis** (`social_proof`) si activée

## Données
Ajout d'un champ `section_order: string[]` dans `products.theme_config` (jsonb existant) ou dans une nouvelle colonne `section_order jsonb` sur la table `products`.
- Valeur par défaut = ordre actuel.
- Stocké par produit (override) avec fallback sur l'ordre boutique (`shops.theme_config.product_section_order`) pour appliquer à toutes les fiches.

## UI éditeur
Dans **ProductEditor** (onglet "Mise en page") :
- Liste verticale des sections avec poignée de glisser-déposer (`@dnd-kit/sortable` déjà disponible côté shop).
- Bouton "Réinitialiser l'ordre par défaut".
- Toggle "Appliquer à tous mes produits" → écrit dans `shops.theme_config.product_section_order`.
- Aperçu live dans la prévisualisation.

Dans **ShopEditor → Thème** : même contrôle pour définir l'ordre par défaut de la boutique.

## Rendu (ProductView.tsx)
- Refactor : extraire chaque bloc en composant/fonction `renderSection(key)`.
- Construire la liste finale : `product.section_order ?? shop.theme_config.product_section_order ?? DEFAULT_ORDER`.
- Boucler et rendre dans l'ordre, sur desktop (colonne droite + image à gauche) et mobile (colonne unique).
- Les sections désactivées (countdown_enabled=false, etc.) sont ignorées.

## Détails techniques
- Migration SQL : `ALTER TABLE products ADD COLUMN section_order jsonb;` + GRANTs.
- Hook `useProductSectionOrder(product, shop)` qui retourne l'ordre effectif et filtre les sections désactivées.
- Le layout desktop a deux colonnes : on permet de réordonner uniquement la colonne droite (infos) ; la galerie reste à gauche. **Option** : ajouter un mode "1 colonne" pour permettre image dans le flux.
- Mobile : tout est en une colonne → ordre intégral respecté.

## Hors périmètre
- Drag & drop direct sur la fiche publique (l'édition se fait dans l'éditeur).
- Sections personnalisées créées par l'utilisateur (uniquement les blocs existants).
