# Plan de migration progressive : Supabase → Laravel (API) + MySQL/Postgres

> **Version** : 12/11/2026, branche `jeanmarc` (`c35aeec`). Chiffres recomptés dans le code et les migrations.
> **Statut** : plan validé dans ses principes ; aucune phase commencée (`backend/`, `src/core/`, `src/features/` n'existent pas).
> **Plan lié** : `docs/FRONTEND-MVC.md` (restructuration du front, qui sert de couture à cette migration).

## Sommaire

1. [Contexte et inventaire](#1-contexte-et-inventaire)
2. [Décisions et principes](#2-décisions-et-principes)
3. [Évolutions depuis la première version](#3-évolutions-depuis-la-première-version)
4. [Architecture cible](#4-architecture-cible)
5. [Catalogue des domaines](#5-catalogue-des-domaines)
6. [Phases](#6-phases)
7. [Processus de migration d'un domaine](#7-processus-de-migration-dun-domaine)
8. [Vérification](#8-vérification)
9. [Référentiel des fichiers](#9-référentiel-des-fichiers)
10. [Points ouverts](#10-points-ouverts)

---

## 1. Contexte et inventaire

### 1.1 Situation

Ecomfy tourne sur React/Vite (+ Capacitor, PWA), branché **directement** sur Supabase : Auth, PostgREST, Edge Functions, Storage, Realtime, pg_cron, pgmq. Il n'existe **aucune couche API** : les vues appellent `supabase` elles-mêmes.

**Objectif** : backend **Laravel en mode API**, frontend React **conservé**, migration **progressive** (aucun big-bang) en production vivante (paiements, wallet, commandes, livraison, produits digitaux).

### 1.2 Inventaire chiffré (12/11/2026)

| Catégorie | Élément | Octobre | 12/11 |
|---|---|---|---|
| Front | Code TS/TSX | ~118 000 l., 523 fichiers | **~128 000 l., 528 fichiers** |
| Front | Fichiers qui importent `supabase` | 170 | **184** |
| Front | `.from()` (tables + storage) | ~390 | **594** |
| Front | `.rpc()` | 41 | **52** |
| Front | `functions.invoke` | 72 | **76** (+ 6 fichiers en `fetch` brut vers `/functions/v1/`) |
| Front | Appels `.storage` | ~81 | **79** |
| Front | Fichiers realtime | 18 | **19** |
| Front | `auth.getUser/getSession` dispersés | ~70 | **97** (+ 6 `onAuthStateChange` locaux) |
| Front | `as any` | — | **332** |
| Front | Fichiers avec react-query | 4 | **10** |
| Serveur | Edge Functions | ~70 | **71** (+ 29 modules `_shared`) |
| Base | Migrations SQL | 229 | **285** |
| Base | Tables (`CREATE TABLE` distincts) | ~126 | **~164** |
| Base | Fonctions SQL | ~146 `SECURITY DEFINER` | **~235**, ~330 occurrences `SECURITY DEFINER` |
| Base | `CREATE POLICY` | ~505 | **~620** (redéfinitions comprises) |
| Base | Triggers | — | **~135** |
| Base | Tables publiées en realtime | — | **10** |
| Base | Buckets storage | — | **12** (au moins 4 privés) |
| Base | Tâches pg_cron | — | **~11** (4 seulement dans les migrations) + pgmq (e-mails) |
| Qualité | Tests | aucun | **24 fichiers vitest**, tests SQL `supabase/tests/`, CI `ci.yml` |

Les nombres de tables, fonctions et policies sont tirés des migrations, redéfinitions comprises : le décompte exact se fera sur le baseline prod (Phase 0).

### 1.3 Accès aux données déjà isolés (points de bascule les moins chers)

| Emplacement | Fichiers |
|---|---|
| `src/services/` | `affiliateService`, `financialMetricsService` |
| `src/lib/` | `ecomfyPay`, `deliveryService`, `deliveryRpc`, `driverMissions`, `billingSystem`, `founderBilling`, `shopFinance`, `shopSubscription`, `subscriptionPlans`, `digitalProducts`, `dashboardKpis`, `founderMetrics`, `governanceMetrics`, `communityChat`, `studio/*` |
| `src/modules/connectus/` | `services/connectus.service.ts` (1 098 lignes) |
| `src/hooks/` | `useCorporateGovernance`, `useSeoIntelligence` (+ services SEO), `useWebPush`, `useFCM`, `useNativePush` |

### 1.4 Fichiers les plus couplés (à découper en priorité)

`ProductEditor.tsx` (2 405 l.), `ProductView.tsx` (2 190), `ShopView.tsx` (1 988), `Generator.tsx` (1 933), `ShopEditor.tsx` (1 897), `FounderDashboard.tsx` (1 510), `ShopThemeSettings.tsx` (1 369), `SeoIntelligencePage.tsx` (1 360), `CorporateGovernance.tsx` (1 225), `ShopSettings.tsx` (1 095), puis `Community.tsx`, `Studio.tsx`, `CoursesManager`, `CourseModulesManager`, `EnrollmentsManager`, `BlogManager`, `TrashManager`.

---

## 2. Décisions et principes

### 2.1 Décisions prises

| # | Sujet | Décision |
|---|---|---|
| D1 | Backend | Laravel 12 (PHP 8.3), mode API uniquement |
| D2 | Frontend | React conservé, restructuré selon `docs/FRONTEND-MVC.md` |
| D3 | Méthode | Migration progressive par domaine, bascule par flag, rollback instantané |
| D4 | Organisation du code | **Couche Services obligatoire** côté back (§4.3) et côté front (`features/*/services`) |
| D5 | Hébergement | Non décidé → plan agnostique (hypothèse : VPS + Redis + workers + scheduler) |
| D6 | Moteur de base | Postgres ou MySQL, décidé en Phase 9 seulement |
| D7 | Dépôt | `backend/` dans ce dépôt (proposé, à confirmer) |

### 2.2 Principes

| # | Principe | Conséquence |
|---|---|---|
| P1 | **Découpler backend et moteur de base** : Laravel se connecte d'abord à la base Postgres Supabase existante | Pas de copie, pas de double écriture ; une seule source de vérité ; rollback = remettre le flag |
| P2 | **Laravel valide les JWT Supabase** pendant toute la transition | L'utilisateur se connecte toujours via Supabase jusqu'à la Phase 8 |
| P3 | **Laravel contourne la RLS** (rôle DB dédié) | Toute l'autorisation est réécrite en Policies + FormRequests : ~620 policies et les gardes par trigger. Matrice de départ : test RLS des flux d'argent (234 cas) |
| P4 | **Code agnostique du moteur** | Eloquent / Query Builder, pas de SQL Postgres brut hors services ; `text[]`/`uuid[]`/`jsonb` via casts (`PgArrayCast`, `JsonCast`) |
| P5 | **Logique SQL existante** (`confirm_ecomfy_payment`, `start/finish_studio_generation`, gardes livraison, facturation par seuil) | Phases 3–6 : appel autorisé **depuis un service uniquement**. Avant Phase 9 (si MySQL) : réécriture PHP obligatoire |
| P6 | **Triggers SQL conservés** tant que la base est partagée | Suppression seulement quand Laravel écrit seul ET que l'équivalent est testé (sinon double effet) |
| P7 | **Prod alignée sur le dépôt** avant de porter un domaine | Porter un domaine dont la prod diffère du code = porter un comportement inconnu |
| P8 | **Jamais `supabase db push`** en prod | Historique de migrations non fiable ; toute suppression d'objet SQL passe par une migration écrite et appliquée à la main |

---

## 3. Évolutions depuis la première version

| Domaine | Ajouts depuis octobre | Effet sur le plan |
|---|---|---|
| Ecomfy Pay | Ledger, `confirm_ecomfy_payment` (paiement → commande → crédit, une transaction, idempotent), `replay_incomplete_ecomfy_payments`, `payment_events`, références non devinables, connecteurs opérateurs, aiguillage `geniuspay-webhook` | Logique transactionnelle en SQL à porter en `EcomfyPaymentService` / `LedgerService` |
| Facturation | `subscription_plans` paramétrables, verrou de paiement de commission, factures, cron `enforce-shop-billing-deadlines`, garde des colonnes de facturation de `shops`, realtime `shop_invoices` | Gardes par trigger → FormRequests + `$guarded` ; trigger conservé tant que le front écrit `shops` |
| Livraison | Module complet : `delivery_companies`, KYC/KYB, permis recto/verso, localisation, missions chauffeur, encaissements, preuves, audit, notifications, cron `delivery-document-expiry`, buckets privés | Domaine moyen (identité + argent liquide) : fin de Phase 5 |
| Produits digitaux | Bucket privé `digital-products`, `digital-download`, e-mail `digital-order-ready` | Phase 6 (dépend du paiement de commande) |
| Studio IA | `ai_generation_log`, `start/finish_studio_generation`, remboursement, tentatives bornées, coûts et quotas en `_shared`, cron `expire-stale-studio-generations` | Règles à figer en tests avant la Phase 4 |
| Tracking | `tracking_purchase_log` (event_id canonique), statut de livraison des événements CAPI | Phase 4 ; idempotence par `event_id` |
| RBAC | `shop_collaborators.roles` en `text[]`, plus d'e-mail en dur (M7), `invite-shop-collaborator` | Guard simplifié : `user_roles` + `shop_collaborators` |
| ConnectUs | Schéma social (9 tables), durcissement, bucket `connectus-media` | Phase 5 ; realtime en Phase 8 |
| Gouvernance | Documents corporate réels | `corporate_invitations` absente : ne pas la modéliser |
| HTTP (M3) | `serveCors`, vrais codes HTTP, `readFunctionError` côté front | Fixe le contrat d'erreur de l'API (§4.5) |
| Exploitation | Purge de l'historique pg_cron, procédure de rollback, miroir prod→dev, CI | Réutilisés pour les répétitions de bascule |
| Incident 12/11 | Base saturée en mémoire (instance probablement Micro), `realtime.list_changes` à 10–15 s, pg_cron en timeout | Argument pour dimensionner la base, sortir le planifié de Postgres (Scheduler) et le realtime (Reverb) |
| MCP | Fonction `mcp` générée par `@lovable.dev/mcp-js` depuis `src/lib/mcp` | Décision à prendre : abandon ou endpoint Laravel |

---

## 4. Architecture cible

### 4.1 Vue de transition

```
React
  features/<domaine>/views ─► controllers ─► services/<x>.service.ts
                                                  │
                         src/core/api (flag par domaine)
                     ┌────────────┴─────────────┐
           domaine non migré                domaine migré
                     │                           │
             supabase-js                 HTTP Bearer /api/v1
                     │                           │
   Supabase (Auth, PostgREST, Edge,      Laravel API
   Storage, Realtime)                          │
                     └──────────► même Postgres Supabase ◄──┘   (puis moteur choisi en Phase 9)
```

Flag par domaine : `VITE_API_DOMAINS="public-shop,affiliate,..."` ou configuration runtime.

### 4.2 Arborescence du backend (modules par domaine)

Les domaines back portent **les mêmes noms** que les `features/` du front (§5).

```
backend/
  app/
    Domains/
      <Domaine>/                      ex. Orders, Billing, EcomfyPay, Delivery, Studio…
        Http/
          Controllers/                controllers minces, un par ressource
          Requests/                   FormRequests (validation)
          Resources/                  API Resources (format de sortie)
        Policies/                     autorisation (équivalent RLS)
        Services/                     logique métier — SEUL point d'écriture
        Data/                         DTO d'entrée/sortie des services (readonly)
        Models/                       modèles Eloquent du domaine
        Events/  Listeners/           événements métier et réactions
        Observers/                    remplacement des triggers SQL
        Jobs/                         traitements asynchrones
        Console/                      commandes planifiées du domaine
        Exceptions/                   exceptions métier typées
        Enums/                        statuts (commande, paiement, livraison…)
        routes.php                    routes du domaine, préfixe /api/v1/<domaine>
    Support/                          transverse, sans métier
      Auth/                           SupabaseGuard, AuthContext, middlewares role: et shop.access:
      Casts/                          PgArrayCast, JsonCast
      Contracts/                      interfaces des fournisseurs (PaymentGateway, AiImageProvider…)
      Integrations/                   implémentations : GeniusPay, OpenAI, OpenRouter, Replicate,
                                      ElevenLabs, Resend, Meta Graph, Google Search Console, FCM/VAPID
      Http/                           CORS, rate-limit, signature des webhooks, rendu des erreurs
      Storage/                        URL publiques et signées
  routes/api.php                      charge les routes.php de chaque domaine
  tests/
    Unit/<Domaine>/                   tests des services (fournisseurs simulés)
    Feature/<Domaine>/                tests HTTP : validation, autorisation, cross-tenant
    Equivalence/<Domaine>/            comparaison au comportement Supabase actuel
```

### 4.3 Couches et règles

| Couche | Rôle | Autorisé | Interdit |
|---|---|---|---|
| **Route / Middleware** | Authentifier, limiter, filtrer | Guard Supabase puis Sanctum, `role:`, `shop.access:`, CORS, rate-limit, signature webhook | Logique métier |
| **Controller** | Traduire HTTP ↔ service | `authorize()`, FormRequest, appel d'**un** service, retour d'une Resource | Eloquent, calcul, transaction, appel externe |
| **FormRequest** | Valider l'entrée | Règles de validation, construction du DTO | Accès base hors règles `exists`/`unique` |
| **Policy** | Autoriser | Rôle, propriétaire, collaborateur, fondateur | Écriture |
| **Service** | Règles métier | Transactions (`DB::transaction`, `lockForUpdate` pour argent et crédits), écriture en base, appels fournisseurs via `Contracts`, émission d'événements, appel d'une fonction SQL existante (P5) | HTTP (`Request`, `Response`), écriture dans les tables d'un autre domaine |
| **Model** | Données | Relations, casts, scopes | Logique métier, appels externes |
| **Job / Listener / Observer / Console / Webhook** | Déclencheurs | Appeler un service | Logique propre (sinon double implémentation) |
| **Resource** | Format de sortie | Mise en forme, masquage des champs | Requêtes supplémentaires non chargées |

Règles complémentaires :
- Un service revérifie les **invariants critiques** même si la Policy est passée : montant recalculé côté serveur, solde suffisant, propriétaire de la boutique.
- Entre domaines : appel d'une **méthode publique** du service de l'autre domaine ou **événement** ; jamais d'écriture directe dans ses tables.
- Webhook et rejeu planifié d'un même paiement passent par **la même méthode** de service : c'est ce qui garantit l'idempotence.
- Fournisseurs externes derrière une interface, avec une implémentation simulée pour les tests.

### 4.4 Conventions

| Sujet | Convention |
|---|---|
| Routes | `/api/v1/<domaine>/<ressource>`, REST ; actions métier en `POST /…/{id}/<verbe>` (ex. `/orders/{id}/cancel`) ; routes publiques sous `/api/v1/public/…` |
| Services | `<Ressource>Service`, méthodes au verbe métier (`confirmPayment`, `startGeneration`), DTO en entrée, modèle ou DTO en sortie |
| DTO | Classes `readonly` dans `Data/` ; aucun tableau associatif entre couches |
| Exceptions | Une exception métier par cas (`InsufficientCredits`, `ShopLocked`), rendue en HTTP par le gestionnaire global |
| Idempotence | En-tête `Idempotency-Key` sur les écritures de paiement ; `UNIQUE(provider, event_id)` pour les webhooks |
| Montants | Entiers en XOF (pas de flottant) ; calculés uniquement côté serveur |
| Dates | UTC en base et en API (ISO 8601) |
| Documentation | OpenAPI généré (Scramble ou Scribe) → types TS générés pour le front |
| Qualité | Pint, Larastan niveau max atteignable, Pest ; tout en CI |

### 4.5 Contrat d'erreur de l'API

Aligné sur le contrat déjà en place côté front (`src/lib/functionError.ts`, audit M3) :

```json
{ "error": "Message lisible par l'utilisateur", "code": "INSUFFICIENT_CREDITS", "details": { } }
```

| HTTP | Usage |
|---|---|
| 400 / 422 | Entrée invalide (422 pour la validation, avec `details` par champ) |
| 401 | Session absente ou expirée |
| 403 | Interdit (Policy) |
| 404 | Introuvable (y compris ressource d'une autre boutique : ne pas révéler son existence) |
| 409 | Déjà fait / en cours (idempotence, verrou) |
| 429 | Limite de débit |
| 5xx | Message générique, jamais le texte technique |

### 4.6 Côté front

| Élément | Rôle |
|---|---|
| `src/core/api/httpClient` | Bearer = JWT courant, gestion 401/refresh, erreurs typées au contrat §4.5 |
| `src/core/api/flags` | Domaines basculés vers Laravel |
| `src/core/auth` | Source unique de session (à partir de `useAuthReady`) |
| `src/features/<domaine>/services` | Seule couche qui appelle `core/api` ou `supabase` ; c'est le fichier modifié lors d'une bascule |
| Types | Générés depuis l'OpenAPI, remplacent progressivement `src/integrations/supabase/types.ts` et les `as any` |

---

## 5. Catalogue des domaines

Référence unique : chaque domaine a le même nom côté front (`features/`) et côté back (`Domains/`).

| Domaine | Services Laravel | Remplacent (Supabase) | Tables / buckets / realtime principaux | Phase |
|---|---|---|---|---|
| **Support** (transverse) | `AuthContextService`, `RateLimitService`, `StorageService`, `MailService`, `PushNotificationService` | `has_role`, `can_manage_shop`, `_shared/{rate-limit,email-sender,http}`, `send-push-notification`, `get-vapid-key` | `user_roles`, `rate_limit_hits` | 2 |
| **PublicShop** | `PublicShopService`, `PublicProductService`, `TopSellersService`, `ShopVisitService`, `SitemapService` | `get_public_shop_by_*`, `get_public_product_page`, `get_top_sellers`, `get_shop_social_proof_orders`, `track-shop-visit`, `dynamic-sitemap`, `share-product` | lecture seule | 3 |
| **Platform** | `FeedbackService`, `ApiKeyService`, `PlatformStatsService`, `DashboardKpiService` | accès directs, `dashboardKpis`, `platform_stats` | `feedback`, `api_keys` | 3 |
| **Affiliate** | `AffiliateService`, `ReferralService` | `affiliateService.ts`, `process_referral_signup` | tables d'affiliation | 3 |
| **Notifications** | `EmailQueueService`, `TransactionalEmailService`, `EmailSuppressionService` | `send-*`, `send-transactional-email`, `preview-transactional-email`, `process-email-queue` (pgmq), `handle-email-*` | `email_send_log`, file pgmq | 4 |
| **Studio** | `AiCreditService`, `AiQuotaService`, `GenerationService`, `GenerationQueueService`, `AiTextService` | `consume_ai_*`, `start/finish_studio_generation`, `generate-*`, `product-ai-optimizer`, `translate-*`, `correct-text`, `extract-brand`, `process-queue`, `cancel-queue-item`, `_shared/{ai-*,credits-gate,pricing}` | `ai_generation_log`, `generation_queue`*, `generated_videos`*, `generated-content`, `generated-images` | 4 |
| **Assistants** | `ShopAssistantService`, `ShowcaseChatService`, `FinanceAdvisorService` | `shop-ai-assistant-chat`/`-tts`, `shop-chatbot`, `showcase-chat`, `finance-advisor` | — | 4 |
| **Marketing** | `ConversionTrackingService`, `AdSpendService`, `AdTokenService` | `track-conversion`, `reconcile-tracking`, `sync-ad-spend`, `check-ad-token-expiry`, `_shared/{purchase-capi,tracking-event-id}` | `tracking_purchase_log` | 4 |
| **Seo** | `GscService`, `SeoIndexService`, `SeoAuditService`, `DomainDnsService` | `gsc-oauth-flow`, `gsc-analytics`, `seo-auto-index`, `verify-domain-dns`, `send-domain-ready-notification`, `useSeoIntelligence` | tables SEO, jetons GSC | 4 / 5 |
| **Monitoring** | `HealthMonitorService`, `RemediationService` | `app-health-monitor`, `app-remediation` | — | 4 |
| **Governance** | `GovernanceService`, `CorporateDocumentService` | `useCorporateGovernance`, `governanceMetrics`, `send-corporate-invite` | `corporate_*` | 5 |
| **Bookings** | `BookingService`, `ContactService` | `send-booking-notification`, `send-contact-notification`, `send-24h-reminder` | réservations, contacts | 5 |
| **Academy** | `CourseService`, `EnrollmentService`, `StudentAccessService`, `CertificateService` | `create-student-account`, `manage-student-access`, `generate-certificate`, `verify_certificate_by_number` | cours, modules, inscriptions | 5 |
| **Showcase** | `ShowcaseService`, `BlogService`, `GalleryService` | `generate-showcase-site`, composants showcase/blog | `showcase-images`, `showcase-videos` | 5 |
| **ConnectUs** | `ConnectUsService`, `CommunityChatService` | `connectus.service.ts`, `communityChat.ts` | 9 tables sociales, `connectus-media`, `community_messages`*, `community_message_reactions`* | 5 |
| **Delivery** | `DeliveryCompanyService`, `DeliveryKycService`, `DriverMissionService`, `DeliveryCashService`, `DeliveryProofService`, `DeliveryNotificationService` | `deliveryService.ts`, `deliveryRpc.ts`, `verify-delivery-identity`, gardes SQL, cron `delivery-document-expiry` | `delivery_*`, `delivery-kyc`, `delivery-proofs`, `delivery_events`*, `delivery_notifications`* | 5 (fin) |
| **Catalog** | `ShopService`, `ProductService`, `VariantService`, `ThemeService`, `ReviewService`, `CollaboratorService` | accès directs de `ShopEditor`/`ProductEditor`, `invite-shop-collaborator`, `generate-product-sheet`, `generate-shop-content` | `shops`*, `products`, `product_variants`, `shop_collaborators`, `shop-images`, `shop-assets` | 6 |
| **Orders** | `OrderService`, `AbandonedCartService`, `ShopPromoCodeService`, `LoyalCustomerService` | `generate_order_number`, `recompute_order_totals`, `enforce_order_item_price`, `upsert_abandoned_cart`, triggers de commande | `orders`*, `order_items`, `abandoned_carts`* | 6 |
| **Billing** | `SubscriptionService`, `SubscriptionPlanService`, `ShopActivationService`, `CommissionBillingService`, `InvoiceService`, `PromoCodeService` | `apply_shop_*`, `enforce_shop_billing_deadlines`, `validate_promo_code`, `founder-activate-shop`, `founder-record-commission-payment`, crons d'expiration | `subscription_plans`, `shop_invoices`*, `commission_payments` | 6 |
| **Payments** | `PaymentService`, `WebhookRouter`, `PaymentReconciliationService` (+ `GeniusPayGateway`, connecteurs opérateurs dans `Support/Integrations`) | `process-payment`, `verify-payment`, `payment-callback`, `geniuspay-webhook`, `reconcile-pending-payments`, `expire_stale_pending_payments` | `payments`, `webhook_events` | 6 |
| **Digital** | `DigitalDeliveryService` | `digital-download`, `_shared/digital-delivery` | `digital-products` | 6 |
| **EcomfyPay** | `EcomfyPaymentService` (`confirm` + `replay`), `WalletService`, `LedgerService`, `WithdrawalService`, `KycService` | `confirm_ecomfy_payment`, `replay_incomplete_ecomfy_payments`, `ecomfy-pay-initiate`/`-webhook`/`-settlement`/`-withdraw` | `ecomfy_payments`, `wallets`, `wallet_ledger`, `payment_events`, `merchant_kyc`, `kyc-documents` | 7 |
| **Founder** | `FounderRoleService`, `FounderMetricsService`, `FinanceSummaryService` | `manage-founder-roles`, `founderMetrics`, `send-weekly-finance-summary` | `user_roles` | 5–6 |
| **Auth** | `AuthService`, `RegistrationService` (listener `handle_new_user`), `OAuthService` | Supabase Auth, `auth-email-hook`, `handle_new_user` | `auth.users` → `users`, `profiles` | 8 |

`*` = table publiée en realtime (10 au total), à reprendre par Reverb en Phase 8.

---

## 6. Phases

Chaque phase suit la même fiche : **Objectif · Prérequis · Périmètre · Livrables · Critères de sortie**.

| Phase | Titre | Risque | Dépend de |
|---|---|---|---|
| 0 | Stabiliser la prod, schéma reproductible | — | — |
| 1 | Couture front (= `FRONTEND-MVC`) | Faible | 0 |
| 2 | Socle Laravel | Faible | 0 |
| 3 | Domaines pilotes | Faible | 1 (domaines concernés), 2 |
| 4 | Edge Functions → services/Jobs | Moyen | 2 |
| 5 | Domaines à faible couplage | Moyen | 1, 2 |
| 6 | Cœur e-commerce, facturation, digital | Élevé | 4 (Notifications, Studio), 5 (Delivery) |
| 7 | Ecomfy Pay | Très élevé | 6 |
| 8 | Auth et realtime | Élevé | 3–7 |
| 9 | Décision moteur de base | Variable | 8 |
| 10 | Extinction de Supabase | Moyen | 9 |

### Phase 0 — Stabiliser la prod et rendre le schéma reproductible

- **Objectif** : partir d'une prod connue et identique au dépôt.
- **Prérequis** : aucun.
- **Périmètre**
  1. Déployer en prod les lots « dev seulement » (liste : `docs/DEPLOIEMENT-RESTE-A-FAIRE-2026-11.md` : plans d'abonnement, RBAC/M7, gouvernance, livraison verso/localisation, produits digitaux, M3 CORS, Studio IA…).
  2. Fermer les vérifications ouvertes de l'audit : C5 (paiement signé), C6 (`scripts/verify-c6-prod.mjs`), C7 (comptes fondateurs), C8 (vitrine avec pixels), première revue KYC.
  3. Résorber les paiements `PENDING` et la file d'e-mails en attente.
  4. Prendre le **baseline** : `pg_dump --schema-only` de la prod après alignement.
  5. Inventorier les tâches pg_cron réelles, la file pgmq, la volumétrie par table, la taille de l'instance (suite à l'incident du 12/11).
  6. Créer `backend/` et l'ajouter à `ci.yml`.
- **Livrables** : baseline SQL versionné, inventaire cron/volumétrie, squelette `backend/` en CI.
- **Critères de sortie** : `jeanmarc` = prod pour toutes les migrations et fonctions ; baseline rejouable sur une base vide.

### Phase 1 — Couture côté frontend

- **Objectif** : changer le backend d'un domaine en ne touchant qu'un fichier service.
- **Prérequis** : Phase 0 pour le domaine concerné.
- **Périmètre**
  1. `src/core/api` (client HTTP, flags, adaptateur Supabase, erreurs au contrat §4.5).
  2. `src/core/auth` : remplacer les 97 `getUser/getSession` et les 6 `onAuthStateChange` locaux (`AiQuota`, `FounderDashboard`, `PaymentHistory`, `PromoCodeManager`, `ResetPassword`, `Subscription`).
  3. Déplacer les accès isolés (§1.3) en `features/<domaine>/services`.
  4. Extraire les accès des fichiers couplés (§1.4), domaine par domaine, **dans l'ordre des phases 3 à 7**.
  5. Faire passer les `fetch` bruts (`ShopAIAssistant`, `ShowcaseAIChat`, `seoAutoIndex`, `shareLinks`, `FounderTroubleshooting`, `Unsubscribe`) et `resilientFetch` par le client.
  6. react-query dans tous les controllers.
- **Livrables** : `src/core/*`, `src/features/<domaine>/services` par domaine extrait, règles ESLint de frontière d'import.
- **Critères de sortie (par domaine)** : aucune vue du domaine n'importe `supabase` ; comportement identique (tests vitest + recette).

### Phase 2 — Socle Laravel

- **Objectif** : un backend prêt à recevoir des domaines.
- **Prérequis** : Phase 0.
- **Périmètre**
  1. Laravel 12, PHP 8.3, Docker Compose, Pest, Pint, Larastan, arborescence §4.2.
  2. Connexion `pgsql` à la base Supabase : rôle dédié, SSL, **pool limité** (60 connexions max en prod).
  3. `Support/Auth` : `SupabaseGuard` (JWT HS256 ou JWKS), `AuthContext` (rôles `user_roles`, collaborateurs `text[]`), middlewares `role:` et `shop.access:`.
  4. `Support/Http` : CORS (`ALLOWED_ORIGINS`), rate-limit **fermé en cas d'échec** (M5), signature des webhooks, rendu des erreurs §4.5.
  5. `Support/Integrations` derrière `Support/Contracts` : GeniusPay + opérateurs, OpenAI, OpenRouter, Replicate, ElevenLabs, Resend, Meta Graph, GSC, FCM/VAPID.
  6. `Support/Storage` : buckets Supabase via S3 ; URL signées obligatoires pour les buckets privés.
  7. Redis + Horizon, Scheduler, Sentry, OpenAPI → génération des types TS.
- **Correspondance des modules `_shared`**

  | `_shared` | Laravel |
  |---|---|
  | `http.ts` (`serveCors`) | Middleware CORS + gestionnaire d'erreurs |
  | `rate-limit.ts` | `RateLimitService` / `RateLimiter` |
  | `webhookSignature.ts` | Middleware de signature |
  | `cron-auth.ts` | Supprimé (Scheduler) |
  | `founderAuth.ts`, `founder-recipients.ts` | Policy + `AuthContextService` |
  | `email-sender.ts`, `email-templates`, `transactional-email-templates`, `email-safety.ts` | Mailables + `MailService` |
  | `openai-*`, `openrouter-*`, `prompt-engine.ts`, `chat-sanitize.ts` | `Support/Integrations` + services Studio/Assistants |
  | `ai-cost.ts`, `ai-quota.ts`, `ai-retry.ts`, `ai-generation-log.ts`, `credits-gate.ts`, `pricing.ts` | `AiCreditService`, `AiQuotaService`, `GenerationService` |
  | `geniuspayConfig.ts`, `operators/` | `GeniusPayGateway` + un connecteur par opérateur |
  | `purchase-capi.ts`, `tracking-event-id.ts` | `ConversionTrackingService` |
  | `digital-delivery.ts` | `DigitalDeliveryService` |
  | `gsc.ts` | `GscService` |

- **Livrables** : endpoint `/api/v1/health` authentifié par JWT Supabase, en CI et en staging.
- **Critères de sortie** : un JWT Supabase réel est accepté ; un JWT invalide renvoie 401 au format §4.5 ; Larastan et Pest verts.

### Phase 3 — Domaines pilotes

- **Objectif** : prouver la chaîne complète (service, policy, OpenAPI, flag, canary).
- **Prérequis** : Phases 1 et 2 pour ces domaines.
- **Périmètre** : `PublicShop` (mode **shadow** : réponses Laravel et Supabase comparées sur trafic réel, cache Redis), `Platform`, `Affiliate` (premier domaine complet en écriture).
- **Livrables** : 3 domaines servis par Laravel derrière flag.
- **Critères de sortie** : 2 semaines à 100 % sans écart shadow ni hausse de 5xx/latence.

### Phase 4 — Edge Functions → services et Jobs

- **Objectif** : remplacer les 71 fonctions serveur sans toucher aux tables.
- **Prérequis** : Phase 2 ; règles de crédits IA (`mem/visualpro/*`, `_shared/pricing.ts`) figées en tests ; prix vidéo confirmé (3 crédits supposés).
- **Périmètre (par lot)**

  | Lot | Domaines (§5) | Points d'attention |
  |---|---|---|
  | 4.1 | Notifications | Vider la file pgmq avant bascule ; un seul envoyeur actif à la fois |
  | 4.2 | Studio, Assistants | Transaction + `lockForUpdate` sur les crédits ; remboursement en cas d'échec ; quota effectif (H9) |
  | 4.3 | Marketing, Seo | Idempotence `event_id` ; jetons GSC côté serveur (M2) |
  | 4.4 | Academy (fonctions), Monitoring | — |
  | 4.5 | Tâches planifiées → Scheduler | `app-health-monitor`, `send-24h-reminder`, `send-generation-reminder`, `send-weekly-finance-summary`, `expire_stale_pending_payments`, `expire-stale-studio-generations`, `delivery-document-expiry` ; désactiver la tâche pg_cron **au même moment** |

- **Livrables** : endpoints Laravel remplaçant chaque `functions.invoke` du lot ; Jobs Horizon.
- **Critères de sortie** : plus aucun appel front vers la fonction ; tâche pg_cron correspondante désactivée ; fonction Supabase supprimée après observation.

### Phase 5 — Domaines à faible couplage

- **Objectif** : migrer les domaines métier qui ne touchent pas à l'argent des commandes.
- **Prérequis** : Phase 1 pour chaque domaine.
- **Ordre** : Governance → Seo (écrans) → Bookings → Academy → Showcase → ConnectUs (realtime en Phase 8) → Founder (rôles) → **Delivery** (en dernier : pièces d'identité, argent liquide, dépend de `orders_auto_transfer_delivery`).
- **Critères de sortie** : par domaine, définition de terminé §7.

### Phase 6 — Cœur e-commerce, facturation, produits digitaux

- **Objectif** : migrer commandes, catalogue, abonnements et paiements de commande.
- **Prérequis** : Notifications et Studio (Phase 4), Delivery (Phase 5).
- **Ordre** : Catalog → Orders → Billing → Payments → Digital.
- **Triggers à reprendre en Observers/Jobs (P6)** : `trigger_sync_shop_stats`, `trg_order_billing_threshold_check`, `trg_tag_order_received_during_lock`, `trg_notify_new_order_push`, `orders_auto_transfer_delivery`, `enforce_lock_*`, garde des colonnes de facturation de `shops`, garde de vérification des prestataires de livraison, sanitation HTML, `grant_access_on_payment_validation`.
- **Points d'attention** : montants calculés côté serveur (C6) ; commandes anonymes (H10) avec validation et limite (5 commandes/h observées) ; montant minimal opérateur (200 XOF) ; boutique restreinte (masquage serveur) ; `digital-download` → URL signée après vérification de la commande payée.
- **Critères de sortie** : réconciliation `orders`/`payments`/`commission_payments`/`shop_invoices` identique avant et après ; triggers SQL supprimés seulement après équivalence testée.

### Phase 7 — Ecomfy Pay

- **Objectif** : migrer wallet, ledger, KYC et retraits sans perte ni double crédit.
- **Prérequis** : Phase 6 ; aucun paiement `PENDING` non expliqué.
- **Périmètre** : `EcomfyPaymentService` (port à l'identique de `confirm_ecomfy_payment` et `replay_incomplete_ecomfy_payments` : paiement → commande → crédit wallet → écriture ledger, en une transaction), webhooks signés (HMAC + rappel API GeniusPay), `UNIQUE(provider, event_id)`, KYC en revue manuelle, retraits derrière `withdrawals_enabled`.
- **Déroulé de bascule** : répétition sur la dev (miroir prod→dev) → fenêtre courte → wallets gelés → bascule → réconciliation ledger → dégel.
- **Références** : `docs/ECOMFY-PAY-LEDGER-SCHEMA-2026-10.md`, `docs/RUNBOOK-ECOMFY-PAY-WEBHOOK-2026-10.md`, `docs/PROCEDURE-ROLLBACK-2026-10.md`.
- **Critères de sortie** : somme du ledger = somme des wallets, avant et après ; aucun webhook rejoué en double.

### Phase 8 — Auth et realtime

- **Objectif** : se passer de Supabase Auth et de Supabase Realtime.
- **Prérequis** : Phases 3 à 7 terminées pour les domaines concernés.
- **Auth**
  1. Sanctum ; import `auth.users` → `users` (bcrypt `$2a$` vérifiable par `password_verify`, pas de reset forcé).
  2. Google OAuth (Socialite) web et Capacitor.
  3. Reset / vérification e-mail (gabarits d'`auth-email-hook`).
  4. `handle_new_user` → `RegistrationService` (profil, rôle `user`, code affilié, `process_referral_signup`).
  5. Front : `Auth.tsx`, `AuthCallbackHandler` (`App.tsx`), `ResetPassword`, `VerifyEmail`, `OAuthConsent`, `ProtectedRoute`, `FounderRoute` ; session hors `localStorage` si possible (M8).
  6. Double acceptation JWT Supabase + token Sanctum pendant la transition.
- **Realtime** : Reverb + Echo, événements émis par les services/Observers (pas par la base), pour les 10 tables marquées `*` au §5 (19 fichiers front). Domaine par domaine.
- **Critères de sortie** : plus aucun appel `supabase.auth` ni `channel()` côté front.

### Phase 9 — Décision : moteur de base

- **Objectif** : choisir où vit la base à long terme.
- **Prérequis** : tous les domaines passent par Laravel ; inventaire des fonctions SQL encore appelées (P5).

| Critère | Rester Postgres (recommandé par défaut) | Passer à MySQL |
|---|---|---|
| Effort | Faible : héberger Postgres (Supabase DB nu ou autre), bien dimensionné | Élevé : ETL + réécriture des fonctions SQL encore utiles et des triggers restants |
| Types | `jsonb`, `text[]` (dont `shop_collaborators.roles`), `uuid[]` natifs | `uuid`→`CHAR(36)`/`BINARY(16)`, `jsonb`/`text[]`/`uuid[]`→`JSON` (index GIN perdu), enums, index partiels, `numeric`→`DECIMAL`, vues |
| Données | Aucune migration | `pgloader` ou commande Artisan, comptes + checksums par table |

- **Si MySQL** : `schema:dump` à partir du baseline, remplacement des casts, imports à blanc répétés, fenêtre de maintenance, bascule de `DB_CONNECTION`, Supabase en lecture seule pendant la période de rollback.

### Phase 10 — Extinction de Supabase

- **Périmètre**
  1. Storage : copie des 12 buckets (règles d'accès des privés conservées), réécriture des URL en base.
  2. Suppression : `supabase-js`, `src/integrations/supabase/*`, `supabase/functions` (décision sur `mcp`).
  3. Nettoyage racine : `check_db.js`, `scratch*`, `test-*`, `*.patch`, `patch_*.mjs`, `src/App.tsx.orig`.
  4. Adapter `scripts/mirror-prod-to-dev.ps1`, la procédure de rollback, `README.md` et la documentation.
  5. Domaines codés en dur (`ecomfy.cloud`, `visuelpro.cloud`…) en configuration.
- **Critères de sortie** : projet Supabase arrêtable sans impact.

---

## 7. Processus de migration d'un domaine

### 7.1 Étapes

| # | Étape | Sortie attendue |
|---|---|---|
| 1 | Vérifier que la prod est alignée sur le dépôt pour ce domaine | Aucun lot « dev seulement » |
| 2 | Inventaire : tables, RPC, fonctions, triggers, policies, buckets, realtime, crons | Fiche domaine |
| 3 | Tests de **caractérisation** du comportement actuel (réutiliser `supabase/tests/` et vitest) | Tests verts sur Supabase |
| 4 | Extraction front en `features/<domaine>/services` (Phase 1) | Aucune vue n'importe `supabase` |
| 5 | Module Laravel : Models, Services, Policies, FormRequests, Resources, routes | Code en CI |
| 6 | Tests Pest : unitaires (services), feature (HTTP, matrice rôle × action, cross-tenant, collaborateurs multi-rôles), équivalence | Tests verts |
| 7 | OpenAPI + types TS générés, service front branché sur `core/api` | Build front vert |
| 8 | Bascule : dev → compte interne → canary (%) → 100 % | Métriques stables à chaque palier |
| 9 | Observation 1–2 semaines | Aucun écart, aucune hausse d'erreurs |
| 10 | Retrait des anciennes policies/RPC/fonctions par migration écrite (jamais `db push`) | Domaine terminé |

### 7.2 Définition de « terminé »

- [ ] Prod alignée sur le dépôt pour le domaine.
- [ ] Toute écriture passe par un service Laravel ; aucun controller n'écrit en base.
- [ ] Chaque policy RLS **et** chaque garde par trigger du domaine a son équivalent Laravel testé.
- [ ] Tests de caractérisation et d'équivalence verts.
- [ ] Endpoints documentés dans l'OpenAPI ; types TS générés utilisés par le service front.
- [ ] Bascule à 100 % et observée 1–2 semaines.
- [ ] Anciens objets Supabase retirés par migration.

### 7.3 Rollback

| Situation | Action |
|---|---|
| Erreur applicative après bascule | Retirer le domaine du flag (instantané, même base) |
| Données écrites par Laravel incorrectes | Correctif + script de réparation ; procédure `docs/PROCEDURE-ROLLBACK-2026-10.md` si nécessaire |
| Trigger SQL supprimé trop tôt | Le recréer depuis le baseline ; jamais avant l'équivalence testée (P6) |

---

## 8. Vérification

| Niveau | Contrôles |
|---|---|
| Domaine | Pest vert ; comparaison shadow Supabase vs Laravel pour les lectures ; Playwright de bout en bout (commande → paiement → livraison ; achat digital → e-mail → téléchargement ; génération IA → débit → remboursement en cas d'échec) |
| Finance | Réconciliation `wallet_ledger`, `wallets`, `ecomfy_payments`, `payments`, `commission_payments`, `payment_events`, `shop_invoices` avant et après chaque bascule |
| Sécurité | Matrice rôle × action ; cross-tenant refusé (404) ; webhooks non signés rejetés ; montants falsifiés rejetés |
| Auth | E-mail, Google (web et Capacitor), reset, vérification, route fondateur, collaborateur |
| Globale | Front : `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`. Back : `php artisan test`, Larastan, Pint. Exploitation : Sentry, latence/5xx par domaine, mémoire et connexions de la base pendant les canaris |

---

## 9. Référentiel des fichiers

| Catégorie | Fichiers |
|---|---|
| Front — entrée et auth | `src/integrations/supabase/client.ts`, `src/hooks/useAuthReady.ts`, `src/App.tsx`, `src/ShopApp.tsx`, `src/pages/Auth.tsx`, `src/components/{ProtectedRoute,FounderRoute}.tsx` |
| Front — accès données | `src/services/*`, `src/lib/*` (§1.3), `src/modules/connectus/*`, `src/lib/functionError.ts`, `src/lib/resilientFetch.ts`, `src/lib/mcp` |
| Backend actuel | `supabase/migrations/` (285), `supabase/functions/` (71) et `_shared/` (29), `supabase/tests/`, `supabase/config.toml` |
| Nouveau | `backend/`, `src/core/api`, `src/core/auth`, `src/features/*/services` |
| Plans et procédures | `docs/FRONTEND-MVC.md`, `docs/DEPLOIEMENT-RESTE-A-FAIRE-2026-11.md`, `docs/PROCEDURE-ROLLBACK-2026-10.md`, `docs/RUNBOOK-ECOMFY-PAY-WEBHOOK-2026-10.md` |
| Références métier | `AUDIT-PROJET-2026-10.md`, `docs/RAPPORT-EXPLOITATION-C1-C8-2026-10.md`, `docs/ECOMFY-PAY-LEDGER-SCHEMA-2026-10.md`, `docs/RAPPORT-PANNE-2026-11-12.md`, `mem/visualpro/*`, `mem/ecommerce/delivery-partners.md` |

---

## 10. Points ouverts

| # | Question | À trancher avant |
|---|---|---|
| O1 | Hébergement (Reverb, workers, coût, taille de la base) | Phase 2 en production |
| O2 | Monorepo (`backend/` ici, proposé) ou dépôt séparé | Phase 0 (création de `backend/`) |
| O3 | Pour chaque fonction SQL métier : appel transitoire depuis un service ou réécriture immédiate | Début de chaque domaine concerné |
| O4 | Sort de la fonction `mcp` (Lovable) | Phase 4 |
| O5 | Prix d'une vidéo (3 crédits supposés) | Phase 4, lot 4.2 |
| O6 | Statut public/privé de `connectus-media` | Phase 2 (Storage) |
| O7 | Postgres ou MySQL | Phase 9 |
