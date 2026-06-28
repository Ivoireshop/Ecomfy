## Système de Thèmes de Boutique (Jarbo/VisualPro)

Ajouter un vrai module de gestion de thèmes pour la **boutique e-commerce complète** (ShopView), distinct du système actuel de thèmes par fiche produit. Inspiré de YouCan : Thème actuel → Mes thèmes installés → Galerie. Non destructif : si aucun thème actif → ShopView classique inchangée.

---

### 1. Base de données (1 migration)

**`shop_themes`** (catalogue global, lecture publique)
- `id`, `slug` (unique), `name`, `description`, `category` (classic/fashion/beauty/tech/luxury/mobile/landing), `preview_desktop_url`, `preview_mobile_url`, `is_free`, `is_premium`, `price`, `is_new`, `version`, `default_config` (jsonb), `is_active_catalog` (admin toggle)
- GRANT SELECT to anon/authenticated ; INSERT/UPDATE service_role seulement
- Seed avec 7 thèmes : Classic, Fashion, Beauty, Tech, Luxury, Mobile First, Landing Conversion

**`shop_installed_themes`** (par boutique)
- `id`, `shop_id`, `theme_id`, `customized_settings` (jsonb), `installed_at`
- UNIQUE (shop_id, theme_id)
- RLS : owner du shop via has_shop_access

**`shops.active_shop_theme_id`** (colonne nullable ajoutée à `shops`)
- NULL = thème classique actuel (comportement actuel préservé)
- Sinon = id du thème actif

Aucune table existante n'est modifiée destructivement. Le système actuel `product_themes` (fiche produit) reste indépendant et intact.

---

### 2. Frontend — Page d'admin Thèmes

**Nouveau composant** `src/components/shop/ShopThemesManager.tsx` ajouté comme onglet "Thèmes" dans `ShopEditor.tsx` (à côté de "Apparence" existant).

Sections (inspirées image YouCan) :
1. **Thème actuel** — carte large avec preview desktop+mobile, badge "Activé", bouton Personnaliser / Changer
2. **Mes thèmes installés** — grille ou message vide "Aucun thème installé"
3. **Tous les thèmes disponibles** — grille de cartes (preview, nom, badges Nouveau/Gratuit/Premium, boutons Prévisualiser + Installer)

**Modale Prévisualisation** `ShopThemePreviewDialog.tsx` :
- Toggle Desktop/Mobile (iframe responsive vers `/shop/:slug?preview_theme=<slug>`)
- Boutons : Installer ce thème / Fermer

**Modale Personnalisation** `ShopThemeCustomizer.tsx` :
- Couleurs primaire/secondaire/bouton, typographie, ordre/visibilité sections, texte CTA, hero
- Sauvegarde dans `shop_installed_themes.customized_settings`

---

### 3. Frontend — Rendu public (ShopView)

**Nouvelle architecture** `src/lib/shopThemes/` :
- `types.ts` — `ShopThemeData`, `ShopThemeProps`, `ShopThemeSlug`
- `dataAdapter.ts` — transforme shop + products → `ShopThemeData`
- `registry.ts` — map slug → composant lazy
- `ShopThemeRenderer.tsx` — wrapper avec Suspense + ErrorBoundary (fallback = ShopView classique)
- `themes/` — 7 implémentations :
  - `classic-shop.tsx` (reproduit le rendu actuel, sécurité)
  - `fashion-shop.tsx`, `beauty-shop.tsx`, `tech-shop.tsx`
  - `luxury-shop.tsx`, `mobile-first-shop.tsx`, `landing-shop.tsx`
- `ShopThemeShared.tsx` — blocs réutilisables (Header, Footer, ProductCard, Hero, CTA, WhatsAppBtn)

**Intégration dans `ShopView.tsx`** :
```tsx
// tout en haut du return, avant le rendu classique
if (shop.active_shop_theme_id && !searchParams.get("classic")) {
  return <ShopThemeRenderer shop={shop} products={products} themeId={...} />;
}
// sinon : rendu actuel inchangé
```

Le paramètre `?classic=1` force le rendu classique (fallback de sécurité + utilisé par les CTAs de checkout pour ne jamais casser le tunnel de commande existant).

---

### 4. Garanties de non-régression

- Aucune table existante modifiée à part `shops.active_shop_theme_id` (nullable, défaut NULL)
- Boutiques existantes : `active_shop_theme_id = NULL` → comportement actuel 100% identique
- Fiches produits : système `product_themes` actuel inchangé, indépendant
- ErrorBoundary autour de chaque thème → si crash → ShopView classique
- Lazy loading : un seul thème chargé sur la boutique publique
- Lien checkout/order toujours via `?classic=1`

---

### 5. Performance

- Preview images = CDN Lovable Assets (générées une fois)
- Themes lazy-loaded (un seul code-split chargé côté public)
- Cache shop déjà en place (`shopCache.ts`) réutilisé
- Aucun chargement de catalogue de thèmes sur la boutique publique (uniquement dans l'admin)

---

### 6. Mobile

ShopThemesManager : grille `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, boutons tactiles `min-h-[44px]`. Prévisualisation modale plein écran sur mobile avec toggle device.

---

### Plus tard (préparé mais non livré)
- Marketplace premium (champ `price` + `is_premium` déjà présent)
- Interface admin fondateur (route séparée `/founder/themes`)
- Upload custom themes

---

### Livré ce sprint
1 migration + 1 onglet Thèmes dans ShopEditor + 7 thèmes publics + renderer non destructif + preview + install + activate + customize basique.
