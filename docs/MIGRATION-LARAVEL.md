# Plan de migration progressive : Supabase → Laravel (API) + MySQL/Postgres

## Context

Ecomfy tourne aujourd'hui sur React/Vite (+ Capacitor) branché **directement** sur Supabase : auth, ~390 `.from()`, 41 `.rpc()`, 72 `functions.invoke`, ~81 appels storage, 18 fichiers realtime, ~70 edge functions, 229 migrations SQL (~126 tables, ~146 fonctions `SECURITY DEFINER`, ~505 policies RLS, triggers, pg_cron, pgmq).
`supabase` est importé dans **170 fichiers** et il n'existe aucune couche API (seuls `affiliateService`, `ecomfyPay`, `deliveryService`, `billingSystem`, `useCorporateGovernance`, ConnectUs sont isolés).

Objectif : backend **Laravel en mode API**, frontend React **conservé**, migration **progressive** (aucun big-bang), en production vivante (paiements, wallet, commandes).

Décisions déjà prises avec vous :
- Hébergement : **non décidé** → plan agnostique (hypothèse de travail : un VPS avec Redis, workers, scheduler).
- Moteur de base : **MySQL ou Postgres, à décider plus tard** → la migration backend est **découplée** de la migration de base de données (voir « Principe clé » et Phase 9).

## Principe clé : découpler « backend » et « moteur de base »

1. **Laravel se connecte d'abord à la base Postgres Supabase existante** (connexion `pgsql` dédiée), sans copier de données. Chaque domaine bascule du frontend→Supabase vers frontend→Laravel→même base. Pas de synchronisation ni de double écriture : une seule source de vérité, rollback = remettre le flag.
2. **Laravel valide les JWT Supabase** pendant toute la transition (guard custom, HS256 avec le JWT secret ou JWKS) : l'utilisateur continue de se connecter via Supabase tant que l'auth n'est pas migrée.
3. Les migrations de **moteur** (Postgres→MySQL) deviennent une phase finale indépendante, avec point de décision (Phase 9). Si on reste Postgres, elle disparaît.
4. Comme Laravel utilisera un rôle DB qui contourne la RLS, **toute l'autorisation est réécrite en Policies/Form Requests Laravel** (équivalent des ~505 policies RLS). C'est le travail le plus sensible de chaque domaine.
5. Écrire le code Laravel **agnostique du moteur** : Eloquent/Query Builder, pas de SQL brut Postgres, colonnes `text[]`/`uuid[]`/`jsonb` accédées via des **casts custom** (`PgArrayCast`, `JsonCast`) qu'on remplacera au passage MySQL (JSON).

## Architecture de transition

```
React (flags par domaine)
   ├─ domaine non migré ──► supabase-js ──► Supabase (Auth/PostgREST/Edge/Storage/Realtime)
   └─ domaine migré ──────► src/api (fetch+token) ──► Laravel API ──► même Postgres Supabase (puis MySQL à la Phase 9)
```

Flag par domaine : `VITE_API_DOMAINS="public-shop,affiliate,..."` ou config runtime ; rollback instantané.

## Phase 0 — Préparation et sécurisation (avant de porter quoi que ce soit)

Porter le code « tel quel » reproduirait les failles de `AUDIT-PROJET-2026-10.md`. À traiter côté Supabase d'abord (SQL + edge functions), car les domaines concernés seront réécrits plus tard :
- Script SQL `REVOKE` des RPC wallet/billing exposées (C1, C2, C3), correctif KYC (C4), HMAC sur `ecomfy-pay-webhook` (C5), recalcul des montants côté serveur (C6), `manage-founder-roles` (C7), XSS `tracking.ts` (C8).
- Rotation des secrets, retrait de `.env` du suivi git, deux projets Supabase désormais clarifiés (prod `yfggrceynzcwklbxhgix`, dev `xfpbpxncserliskrbaim`) (H11, corrigé dans le dépôt ; vérifications en environnement réel listées dans `AUDIT-PROJET-2026-10.md`).
- **Rendre le schéma reproductible** : `pg_dump --schema-only` de la prod comme baseline (les 229 migrations ne reproduisent pas la base : `is_founder_or_cofounder()`, `product_variants`, colonnes `profiles` manquantes).
- Inventaire des données prod (volumétrie par table) pour la Phase 9.
- Créer le dossier `backend/` (Laravel) dans le repo, CI (lint, Pest, build).

## Phase 1 — Couture côté frontend (aucune bascule, risque faible)

Objectif : pouvoir changer le backend d'un domaine en touchant un seul fichier.
- Créer `src/api/` : client HTTP (token Bearer = JWT courant, gestion 401/refresh, erreurs typées), `VITE_API_URL`, flags par domaine.
- **Une seule source d'auth** : faire de `src/hooks/useAuthReady.ts` l'unique accès à la session ; remplacer les ~70 `supabase.auth.getUser()/getSession()` dispersés et les 6 pages qui gardent leur propre `onAuthStateChange` (`AiQuota`, `FounderDashboard`, `FounderTroubleshooting`, `PaymentHistory`, `PromoCodeManager`, `Subscription`).
- Pour chaque domaine, **extraire les appels `supabase.*` des composants vers un service/hook** (comme `affiliateService.ts`) avant de basculer. Les plus couplés à extraire : `ShopEditor.tsx` (~33 `.from`), `FounderDashboard.tsx`, `Community.tsx`, `Generator.tsx`/`Studio.tsx`, `ShopView.tsx`, `ProductView.tsx`, composants academy/showcase (`CoursesManager`, `CourseModulesManager`, `EnrollmentsManager`, `BlogManager`, `TrashManager`).
- Introduire react-query dans ces services (aujourd'hui 4 fichiers seulement) pour uniformiser cache/erreurs.
- Les `fetch` bruts vers `/functions/v1/` (`shop-ai-assistant-chat`, `showcase-chat`, `handle-email-unsubscribe`, `dynamic-sitemap`, `share-product`) passent par le même client.

## Phase 2 — Socle Laravel

- Laravel 12 (PHP 8.3), mode API, Pest, Pint/Larastan, Docker Compose pour le dev.
- Connexion `pgsql` vers la base Supabase (rôle dédié, SSL), pas de migrations Laravel sur les tables existantes à ce stade (les modèles lisent le schéma existant).
- **Guard `supabase`** : vérifie le JWT, résout `sub`→utilisateur, charge les rôles depuis `user_roles` (`has_role`, `is_founder_or_master`). Middleware `role:` et `shop.access:` (équivalents de `has_shop_role`/`can_manage_shop`).
- Conventions : API Resources, Form Requests, Policies, `/api/v1`, OpenAPI généré (Scramble ou Scribe) → **génération des types TS** qui remplacent progressivement `src/integrations/supabase/types.ts` (5 613 lignes, `as any` ~23 endroits).
- Briques transverses : Redis + Horizon (queues), Scheduler (remplace pg_cron/pgmq), client HTTP pour GeniusPay/OpenAI/OpenRouter/Replicate/Runway/ElevenLabs/Cloudinary/Resend/Lovable AI, rate-limiting (`rate_limit_hits`), CORS restreint, Sentry/logs.
- Stockage : abstraction `Storage` Laravel ; buckets Supabase conservés au départ (URLs publiques inchangées), via API S3-compatible de Supabase Storage.

## Phase 3 — Domaines pilotes (preuve du pipeline, faible risque)

1. Lectures publiques : `get_public_shop_by_slug`, `get_public_shop_by_custom_domain`, `get_public_product_page`, `get_top_sellers`, `get_shop_social_proof_orders`, `verify_certificate_by_number`, `dynamic-sitemap`, `share-product`, `track-shop-visit`. Mode « shadow » : comparer la réponse Laravel et Supabase sur du trafic réel avant la bascule.
2. `feedback`, `api_keys` (ApiDocumentation), `platform_stats`.
3. **Affiliation** (`affiliateService.ts` déjà isolé, ~30 `.from`) : bon premier domaine complet, corrige H6 au passage.

## Phase 4 — Edge functions → contrôleurs/Jobs (bloc le moins ambigu, déjà côté serveur)

Les 72 `functions.invoke` pointent vers des fonctions déjà serveur : on les remplace par des endpoints Laravel, sans toucher aux tables.
- **Email** : `send-*` Resend, auth hooks, `process-email-queue` (pgmq→queue Laravel), suppression/désabonnement. Corrige H4.
- **Notifications** : `send-push-notification`, `get-vapid-key` (Web Push VAPID, FCM). Les hooks `useWebPush`/`useFCM`/`useNativePush` sont déjà isolés.
- **IA et crédits** : `consume_ai_credit` / `consume_ai_quota` → `AiCreditService` (transaction + `lockForUpdate`), puis `generate-*`, `product-ai-optimizer`, `translate-*`, chatbots, `process-queue`/`cancel-queue-item` → Jobs. Règles de `mem/visualpro/*` (packs 20/30/40 crédits, 1/1,5/2 crédits, essai gratuit, quota 2/jour) à figer en tests avant le portage. Réactiver le quota (H9).
- **SEO/Marketing** : `gsc-oauth-flow` (corrige M2), `gsc-analytics`, `seo-auto-index`, `track-conversion`, `sync-ad-spend`, `reconcile-tracking`, `verify-domain-dns`.
- **Cron/monitoring** : `app-health-monitor`, `app-remediation`, `send-24h-reminder`, `send-weekly-finance-summary`, `check-ad-token-expiry`, `cleanup_old_generated_media`, `expire_stale_pending_payments` → Scheduler Laravel.

## Phase 5 — Domaines isolés ou à faible couplage

Ordre : **Delivery** (`deliveryService.ts`, `components/delivery/*`, react-query déjà présent) → **Corporate governance** (`useCorporateGovernance`, corrige H2) → **SEO** (`useSeoIntelligence`) → **ConnectUs/Community** (module structuré ; le realtime attend la Phase 8) → **Academy/Showcase/Blog/Bookings** (couplage direct fort, d'où l'extraction Phase 1).

## Phase 6 — Cœur e-commerce et facturation (risque élevé)

- Boutiques/produits/variantes/thèmes (`ShopEditor`, `components/shop/*`), commandes (`generate_order_number`, `recompute_order_totals`, `enforce_order_item_price`, `upsert_abandoned_cart`).
- **Triggers → Observers/Jobs/Services** : `trigger_sync_shop_stats`, `trg_order_billing_threshold_check` (240 commandes / 12 000 FCFA), `trg_tag_order_received_during_lock`, `trg_notify_new_order_push`, `orders_auto_transfer_delivery`, verrous `enforce_lock_*`, sanitation HTML, `grant_access_on_payment_validation`. Tant que la base reste partagée, **les triggers SQL existants continuent de tourner** : ne les supprimer qu'après que Laravel a repris l'écriture ET que la logique équivalente est testée, sinon double effet.
- Abonnements/facturation : `apply_shop_subscription`, `apply_shop_activation`, `enforce_shop_billing_deadlines`, `validate_promo_code`, `process-payment`, `verify-payment`, `geniuspay-webhook` (corriger H7), `reconcile-pending-payments`. Montants calculés côté serveur uniquement (C6).
- Commandes anonymes (H10) : endpoint public avec validation et rate-limit.

## Phase 7 — Ecomfy Pay (wallet/KYC) — en dernier parmi les domaines métier

Argent réel : tests d'équivalence stricts, transactions DB + `lockForUpdate`, idempotence (`payment_events UNIQUE(provider,event_id)`), webhooks signés, retries des crédits wallet (M6), KYC sans score codé en dur, documents KYC dans un bucket privé (H1). Fenêtre de bascule courte, wallets gelés pendant l'opération, réconciliation ledger avant/après.

## Phase 8 — Auth et realtime

- **Auth** : Laravel Sanctum (tokens) ; import de `auth.users` → `users` (les mots de passe bcrypt `$2a$` de Supabase sont vérifiables par `password_verify`, pas de reset forcé) ; Google OAuth via Socialite (PKCE géré côté API) ; reset/verify email ; `handle_new_user` → listener (création profil, rôle `user`, code affilié, `process_referral_signup`). Réécrire `Auth.tsx`, `AuthCallbackHandler` (`App.tsx`), `ResetPassword`, `VerifyEmail`, `OAuthConsent`, `ProtectedRoute`, `FounderRoute`. Sessions existantes : double acceptation du JWT Supabase et du token Sanctum pendant une période de transition.
- **Realtime** : tant que la base est Supabase Postgres, `postgres_changes` continue de fonctionner même si Laravel écrit. À la sortie de Supabase, remplacer par **Laravel Reverb + Echo** : 18 fichiers (orders, `shop_invoices`, `community_messages` + presence, `generation_queue`, `generated_videos`, profiles crédits…). Peut être fait domaine par domaine avec le domaine concerné.

## Phase 9 — Point de décision : moteur de base

À prendre quand tous les domaines passent par Laravel. Critères : coût/hébergement choisi, compétences, volumétrie, dépendance aux types Postgres.

| | Rester Postgres (recommandation par défaut) | Passer à MySQL |
|---|---|---|
| Effort | Faible : héberger Postgres (Supabase DB nu ou autre) | Élevé : ETL + réécriture |
| Points d'attention | Aucun, `jsonb`, `text[]`, `uuid[]` natifs | `uuid`→`CHAR(36)`/`BINARY(16)`, `jsonb`/`text[]`/`uuid[]`→`JSON` (index GIN perdu), enums, index partiels, `numeric`→`DECIMAL`, vues, plus de `pg_cron`/`pgmq` (déjà remplacés par Scheduler/queues) |
| Données | Aucune migration | `pgloader` ou commande Artisan d'ETL, comparaison counts + checksums par table |

Si MySQL : migrations Laravel (`schema:dump` à partir du baseline Phase 0), remplacement des casts `PgArrayCast`, import à blanc répété (répétition générale), puis courte fenêtre de maintenance, bascule de `DB_CONNECTION`, conservation de Supabase en lecture seule pendant le temps du rollback.

## Phase 10 — Extinction de Supabase

Migration du storage (copie des buckets + réécriture des URLs en base), suppression de `supabase-js`, `src/integrations/supabase/*`, `supabase/functions`, nettoyage des scripts à la racine (`check_db.js`, `scratch*`, `test-*`), mise à jour de `README.md` et docs. Les domaines codés en dur (`ecomfy.cloud`, `visuelpro.cloud`…) passent en config.

## Règles de conduite de chaque vague

Définition de « terminé » pour un domaine :
1. Tests de caractérisation écrits **avant** (comportement Supabase actuel) puis tests d'équivalence Pest sur Laravel.
2. Policies Laravel couvrant chaque policy RLS du domaine (matrice rôle × action testée, y compris cross-tenant).
3. Endpoints documentés OpenAPI, types TS générés.
4. Bascule par flag : staging → compte interne → canary (% d'utilisateurs) → 100 %, avec rollback par flag.
5. Observation 1–2 semaines avant suppression des anciennes policies/RPC/edge functions du domaine.

## Fichiers et éléments critiques

- Frontend : `src/integrations/supabase/client.ts`, `src/hooks/useAuthReady.ts`, `src/App.tsx` (routes + `AuthCallbackHandler`), `src/pages/Auth.tsx`, `src/components/ProtectedRoute.tsx`, `src/services/*`, `src/lib/{ecomfyPay,deliveryService,billingSystem}.ts`, `src/modules/connectus/*`.
- Backend actuel : `supabase/migrations/` (229 fichiers), `supabase/functions/` (~70), `supabase/functions/_shared/*` (crédits, quota, cron-auth), `supabase/config.toml`.
- Nouveau : `backend/` (Laravel), `src/api/`.
- Références : `AUDIT-PROJET-2026-10.md`, `mem/visualpro/ai-credit-system.md`, `mem/visualpro/ai-daily-quota.md`, `mem/ecommerce/delivery-partners.md`.

## Vérification

- Par domaine : suite Pest verte, comparaison automatisée des réponses Supabase vs Laravel (mode shadow pour les lectures), scénario Playwright de bout en bout sur le parcours concerné (ex. commande → paiement → livraison).
- Finance : réconciliation `wallet_ledger`/`payments`/`commission_payments` avant et après chaque bascule.
- Auth : connexion email, Google, reset, vérification email, route founder protégée, accès cross-tenant refusé.
- Globale : `npm run build` + `npm run lint` côté frontend, `php artisan test` + Larastan côté backend, suivi d'erreurs (Sentry) et métriques latence/5xx par domaine pendant les canaris.

## Points restant ouverts

- Choix de l'hébergement (impacte Reverb, workers, coût) — à trancher avant la Phase 2 en production, pas avant en dev.
- Choix Postgres/MySQL — Phase 9.
- Monorepo (`backend/` dans ce dépôt, proposé) vs dépôt séparé.
