---
name: Product appearance & audio testimonials
description: Additive system on product pages — audio testimonials, theme presets, color/background personalization with auto-contrast
type: feature
---

Tables: `product_audios`, `product_themes` (catalog, 7 seeded slugs), `product_theme_settings` (per product, optional).

Audios stored in existing public bucket `shop-images` under `{user_id}/product-audios/{shop_id}/{product_id}/...`. Accepted: MP3, WAV, M4A, AAC, OGG, OPUS, WEBM. Max 8 Mo. Player uses `preload="none"`.

UI lives in `src/components/shop/ProductAppearancePanel.tsx` (used inside `ProductEditor` via a `<details>` section, only when editing an existing product). Three tabs: Thèmes, Couleurs & Fond, Audios. Live preview with mobile/desktop toggle.

Public rendering in `src/pages/ProductView.tsx`:
- Root wrapper applies inline style from `buildProductPageStyle(themeSettings)` only if settings exist (fallback = legacy white bg, zero regression for existing products).
- Audio testimonials section rendered above "Related products" only if active audios exist.

Premium themes flagged via `is_premium` + `price` in `product_themes`; UI shows a toast "Bientôt disponible" — no payment flow wired yet.

Auto-contrast: `ensureReadableTextColor` in `src/lib/productAppearance.ts` enforces WCAG 4.5 ratio when background is changed.
