## Audit & renforcement sécurité VisualPro

Demande très large (11 axes). Je propose de la découper en **3 lots** livrables incrémentalement pour pouvoir valider chaque étape, plutôt que tout faire en un seul commit massif (risque de casse sur les boutiques publiques en pleine campagne pub).

---

### Lot 1 — Quick wins headers + RLS audit (sans risque)

1. **Audit RLS complet** via `psql` sur : `orders`, `profiles`, `abandoned_carts`, `community_messages`, `community_topics`, `community_replies`, `product_reviews`, `shop_visits`, `subscriptions`, `payments`, `shop_secrets`, `ad_accounts`, `api_keys`, storage buckets. Rapport écrit + migration corrective uniquement pour les fuites confirmées (anon SELECT/INSERT/UPDATE/DELETE non justifiés).
2. **Headers HTTP réels** via `vite.config.ts` (dev) + un fichier `public/_headers` (Netlify-style, supporté par l'hébergeur Lovable) :
   - `Content-Security-Policy` stricte (script-src self + lovable + GA/Meta/TikTok, connect-src self + supabase + AI gateway + cloudinary, img-src self https: data: blob:, frame-ancestors 'self' lovable.app/dev).
   - `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` resserrée, `X-Frame-Options: SAMEORIGIN` (sauf preview Lovable).
   - Retire les meta CSP redondantes de `index.html`.
3. **`public/.well-known/security.txt`** avec contact founder.
4. **Restreindre RPC publiques** : auditer `get_public_shop_by_slug`, `get_public_product_page`, vues `shops_public` / `product_reviews_public` / `showcase_sites_public` — s'assurer qu'elles n'exposent pas `user_id`, emails, secrets de tracking, configuration interne. Recréer les vues avec colonnes whitelistées si besoin.

### Lot 2 — Sanitization & validation serveur (changements code)

5. **Sanitization HTML serveur-side** : trigger Postgres `BEFORE INSERT/UPDATE` sur `products.description`, `shops.description`, `shop_announcements`, `community_messages.content`, `blog_posts.content` qui supprime `<script>`, `<iframe>` non-whitelist, `on*=` handlers, `javascript:` URLs via regex stricte. Côté client, vérifier que tous les `dangerouslySetInnerHTML` passent par DOMPurify (déjà en place selon mémoire).
6. **Champs tracking sécurisés** : remplacer `shops.google_analytics_code` (texte libre) par `shops.google_analytics_id`, `meta_pixel_id`, `tiktok_pixel_id` (formats validés `G-XXXX`, `\d{15,16}`, `C[A-Z0-9]+`). Migration + UI ShopThemeSettings/Tracking. Côté front, injecter via composants React typés, jamais via `innerHTML`.
7. **Validation prix serveur** : revoir l'edge function de création de commande pour **recalculer** `unit_price`, `total`, frais de livraison à partir de `products`/`shops` en base, ignorer toute valeur prix venant du client.
8. **Validation Zod** sur edge functions publiques : `process-payment`, contact, reviews, abandoned_carts, shop-ai-assistant-chat/tts. Téléphone, email, pays, ville, quantité, total.

### Lot 3 — Anti-abuse, storage, tests

9. **Rate limiting in-memory** (déjà partiel sur `translate-ui`) étendu à : reviews, abandoned_carts, contact, shop-ai-chat, shop-ai-tts, process-payment. Par IP, 30-60 req/min.
10. **Audit storage buckets** : lister tous les buckets, vérifier public/privé, policies RLS storage, types MIME et taille max sur uploads sensibles (documents identité, factures). Rendre privés ceux qui n'ont aucune raison d'être publics.
11. **Checklist tests sécurité** : script `tests/security/anon-access.test.ts` (Deno/vitest) qui essaie depuis anon : lire orders d'une autre boutique, modifier shop d'un autre user, insérer `<script>` dans review, créer commande avec total=1, lire payments. Rapport pass/fail.

---

### Livrable final

Rapport markdown `SECURITY-AUDIT-2026-06.md` listant :
- Failles trouvées + corrections appliquées (avec ID migration)
- RLS vérifiées table par table (✓ / corrigée / à surveiller)
- Headers ajoutés (avant/après)
- Endpoints protégés (rate-limit, Zod, recalcul prix)
- Tests automatisés ajoutés + résultats
- Risques résiduels (ex: `unsafe-inline` conservé pour Tailwind/Vite, ce qui est inévitable)

---

### Question avant de lancer

Veux-tu :
- **A.** Que j'enchaîne les 3 lots d'un coup (gros volume de changements, ~10-15 fichiers + 3-4 migrations, risque non-nul de casser une boutique pendant la pub) ?
- **B.** Que je commence par **Lot 1 uniquement** (audit + headers + RPC, zéro impact fonctionnel) et qu'on valide avant Lots 2 et 3 ?
- **C.** Cibler seulement certains points parmi les 11 (lesquels prioritaires) ?

Je recommande **B** vu que tu lances du trafic publicitaire — on sécurise sans rien casser, puis on durcit progressivement.