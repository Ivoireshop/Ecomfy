# Audit sécurité VisualPro — Lot 1 (15/06/2026)

Premier lot : durcissement **sans changement fonctionnel**. Lots 2 et 3 à valider avant exécution.

## 1. Données publiques réduites

| Vue | Champs retirés | Pourquoi |
| --- | --- | --- |
| `public.shops_public` | `user_id`, `google_analytics_code` | `user_id` = identifiant interne du propriétaire (info leakage). `google_analytics_code` = bloc HTML/JS libre injecté via `innerHTML` côté client — visible publiquement, c'était un vecteur de reconnaissance (savoir qui a quel snippet, fingerprinter le compte). |
| `public.showcase_sites_public` | `user_id` | Identique : on évite que les pages vitrine publiques exposent l'UUID propriétaire. |

Les RPC `get_public_shop_by_slug` et `get_public_shop_by_custom_domain` ont été recréées pour matcher la nouvelle vue. Aucun code client ne lisait `shop.user_id` depuis ces résultats (vérifié par grep).

## 2. Audit RLS — résultat par table

| Table | Lecture anon | Écriture anon | Statut |
| --- | --- | --- | --- |
| `payments` | ❌ aucun | ❌ bloqué (`with_check = false`) | ✅ verrouillé |
| `profiles` | ❌ | ❌ sauf insert de son propre profil | ✅ |
| `subscriptions` | ❌ | ❌ (admins/founders only) | ✅ |
| `shop_secrets` | ❌ propriétaire uniquement | ❌ propriétaire | ✅ |
| `ad_accounts` | ❌ propriétaire | ❌ propriétaire | ✅ |
| `api_keys` | ❌ user_id | ❌ user_id | ✅ |
| `orders` | ❌ (SELECT = owner+collab+delivery) | ✅ INSERT public (checkout) | ✅ |
| `community_messages/topics/replies` | ❌ (authenticated only) | ❌ (auth only, own user_id) | ✅ |
| `product_reviews` | via vue `product_reviews_public` seulement | ✅ INSERT si boutique publique | ✅ |
| `shop_visits` | ❌ owner only | ✅ INSERT pour boutiques publiques (analytics) | ✅ |
| `abandoned_carts` | ❌ owner+collab | ✅ INSERT/UPDATE limité aux boutiques visibles + <24h | ✅ |
| `shops`, `products`, `product_images` | via vues / RPC | ❌ propriétaire | ✅ |

**Conclusion :** aucune fuite RLS sur table sensible. Toutes les écritures anonymes sont contraintes (boutique publique, fenêtre temporelle, ou checkout produit).

## 3. Headers HTTP ajoutés (`public/_headers`)

Servis par l'hébergement Lovable en production. Le meta CSP de `index.html` reste en place comme fallback dev/preview.

| Header | Valeur (résumé) |
| --- | --- |
| `Content-Security-Policy` | `default-src 'self'`, `frame-ancestors` limité à Lovable, listes blanches strictes pour script/connect/img/frame |
| `X-Frame-Options` | `SAMEORIGIN` (anti-clickjacking) |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | caméra/USB/géoloc/etc. coupés sauf paiement/micro |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` (compat OAuth) |

Cache long-terme sur `/assets/*` (Vite hash), `no-cache` sur les service workers, MIME forcé pour `manifest.webmanifest` et `security.txt`.

## 4. `.well-known/security.txt`

Contact + email + tel + canonical, conformément à RFC 9116. Expire en 2027.

## 5. Storage buckets

| Bucket | Public | Note |
| --- | --- | --- |
| `avatars` | ❌ privé | OK |
| `shop-images`, `showcase-images`, `showcase-videos`, `generated-content`, `generated-images` | ✅ public | Intentionnel — assets affichés en boutique. Le linter Supabase signale "Public Bucket Allows Listing" — point ouvert pour Lot 3 (passer en `private` + signed URLs, ou ajouter une policy SELECT scopée par path). |

## 6. Risques résiduels (à traiter en Lot 2 / Lot 3)

1. **`google_analytics_code` reste un champ texte libre** côté table `shops` (injecté via `innerHTML` dans `src/lib/tracking.ts`). Self-XSS du propriétaire uniquement, mais à remplacer par un champ `google_analytics_id` validé (`G-XXXX`). → **Lot 2 point 6**.
2. **CSP `unsafe-inline` / `unsafe-eval`** conservés sur `script-src` — Vite et Tailwind injectent du JS/CSS inline. Migration vers nonce CSP = chantier dédié.
3. **Buckets storage publics listables** — listing permis. À restreindre via policy SELECT par préfixe.
4. **Prix recalculés côté serveur** — non vérifié pour `process-payment` et création de commande. → **Lot 2 point 7**.
5. **Rate-limiting endpoints publics** — partiellement présent (`translate-ui`). → **Lot 3 point 9**.
6. **CAPTCHA / Turnstile** sur formulaires (contact, signup) — pas en place. → **Lot 3**.
7. **Sanitization HTML serveur-side** (descriptions produits, blog, community) — actuellement uniquement DOMPurify côté client à l'affichage. → **Lot 2 point 5**.

## 7. Migrations appliquées

- `20260615165137_…` — reconstruction `shops_public` + `showcase_sites_public` + RPCs (cette session)
- `20260615163246_…` — création initiale `product_reviews_public` + `showcase_sites_public` (session précédente)

## 8. Linter Supabase

- `0010_security_definer_view` ×3 sur les vues `*_public` → **intentionnel et nécessaire** : ces vues doivent bypasser RLS pour exposer des champs whitelistés aux anonymes (sinon la table sous-jacente est inaccessible).
- Autres warnings (`function search_path mutable`, `extension in public`) → pré-existants, hors scope du lot.

---

**Prochaine étape recommandée :** lancer Lot 2 (sanitization serveur + champs tracking validés + recalcul prix serveur). Dis-moi quand tu veux que je l'exécute.