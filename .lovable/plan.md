## Objectif

Ajouter à VisualPro, sans casser l'existant : (1) témoignages audio sur fiche produit, (2) thèmes professionnels de fiche produit, (3) personnalisation fond/couleurs avec contraste auto, (4) prévisualisation temps réel mobile/desktop.

Tout est additif : les anciennes fiches restent identiques tant que le vendeur ne touche à rien.

## Lot 1 — Backend audio (migration + storage)

Nouvelle table `product_audios` (product_id, shop_id, user_id, audio_url, title, description, customer_name, duration, file_type, file_size, is_active, sort_order, timestamps) avec RLS :
- public SELECT si `is_shop_publicly_visible(shop_id)` et `is_active`
- propriétaire/collaborateur shop : full CRUD
- GRANT anon SELECT + authenticated CRUD + service_role ALL

Nouveau bucket Storage `product-audios` (public read), policies :
- upload/update/delete réservés au owner du shop (path `shop_id/product_id/uuid.ext`)
- read public
- limite côté client 8 Mo, formats MP3/WAV/M4A/AAC/OGG/OPUS/WEBM

## Lot 2 — Backend thèmes

Deux tables :
- `product_themes` (catalogue global) : name, slug, description, preview_image, theme_type, is_premium, price (FCFA), is_active, configuration_json (palette + sections par défaut). SELECT public ; écriture founder/co_founder uniquement.
- `product_theme_settings` (1 ligne par produit) : product_id (unique), theme_slug, background_color, section_bg_color, card_bg_color, text_color, title_color, button_color, button_text_color, border_color, badge_color, background_mode (`solid|gradient|image`), gradient_from/to, background_image_url, visible_sections (text[]), section_order (text[]), custom_css_settings (jsonb). RLS via owner/collab shop du produit.

Seed des 7 thèmes : `classic-premium`, `health-wellness`, `luxury-dark`, `direct-conversion`, `storytelling`, `mobile-first`, `landing-ad`. + thème "default" implicite quand pas de ligne settings.

## Lot 3 — UI éditeur (ProductEditor)

Nouvel onglet **"Apparence"** dans `ProductEditor.tsx` (n'altère pas les onglets existants), contenant :

1. **Témoignages audio** — composant `ProductAudioManager.tsx`
   - Bouton "Ajouter un témoignage audio" → input file accept audio/*
   - Upload immédiat vers `product-audios` (avec toast d'état, taille max 8 Mo, validation MIME)
   - Liste : aperçu `<audio controls preload="none">`, titre, nom client, description, toggle actif, drag-handle sort, supprimer, remplacer
   - Auto-save debounced sur chaque modification
   - Tous les messages d'erreur demandés en français

2. **Thème** — composant `ProductThemePicker.tsx`
   - Galerie de cartes thème avec preview_image + badge gratuit/premium
   - Bouton "Utiliser ce thème" (gratuit appliqué direct ; premium → toast "Bientôt disponible")
   - Bouton "Revenir au design par défaut" (supprime la ligne `product_theme_settings`)

3. **Personnalisation** — composant `ProductAppearancePanel.tsx`
   - Color pickers (input type=color + champ HEX) pour fond, sections, cartes, boutons, textes, titres, bordures, badges
   - Choix mode fond : uni / dégradé (2 couleurs) / image (upload)
   - Fonction `ensureReadableTextColor()` (calcul luminance WCAG) : si contraste < 4.5, force texte clair/foncé et affiche un avertissement "Texte ajusté pour rester lisible"
   - Sections : liste de toggles + drag pour réorganiser `visible_sections` / `section_order`

4. **Prévisualisation temps réel** — réutilise `ProductLivePreview` existant + toggle device mobile/desktop ; bouton "Voir comme client" ouvre `/shop/:slug/p/:productSlug` ; bouton "Annuler" recharge les settings ; bouton "Revenir au design par défaut".

Mobile : onglet "Apparence" accessible depuis bottom-tabs déjà présentes, pickers full-width, sticky save bar.

## Lot 4 — Rendu public (ProductView)

Dans `src/pages/ProductView.tsx` :
- Charger `product_theme_settings` + `product_audios` en parallèle du produit
- Wrapper racine reçoit un `style` calculé depuis settings (CSS variables `--pv-bg`, `--pv-text`, etc.) ; **si aucun settings**, rien ne change (compat ancien rendu)
- Section "Témoignages audio de nos clients" rendue conditionnellement si audios actifs, lazy-mount, `preload="none"`, badge "Témoignage authentique"
- Helper `applyThemePreset(slug)` retourne overrides CSS pour les 7 thèmes du seed
- Respecte `visible_sections` / `section_order` quand présents ; fallback ordre actuel sinon

## Lot 5 — Tests & garde-fous

- Vérifier ouverture d'une fiche existante (sans settings ni audios) → rendu identique
- Upload MP3/M4A/OPUS, refresh, vérifier persistence URL publique
- Changer de thème puis revenir → contenu produit inchangé (queries seulement sur `product_theme_settings`)
- Lighthouse mobile : pas de regression (audios `preload="none"`, images thèmes lazy)
- Linter Supabase post-migration

## Détails techniques

- Pas de breaking change sur `products` ni `product_images`
- Toutes les nouvelles tables ont GRANT explicites dans la même migration
- Trigger `update_updated_at_column` réutilisé
- Bucket public mais writes scoped par RLS sur `storage.objects` (`bucket_id = 'product-audios' AND auth.uid() = owner_user`)
- Aucune logique de paiement de thème activée maintenant ; champ `price` + `is_premium` posés pour la future marketplace
- Admin thèmes : page founder simple `/founder/themes` (réutilise `FounderRoute`)

## Hors scope (à confirmer si tu veux les ajouter)

- Marketplace payante de thèmes (UI achat / déblocage)
- Historique des thèmes utilisés
- Modération admin des audios uploadés

Dis-moi si je lance les 5 lots ou si tu veux ajuster.
