# Audit complet du projet Ecomfy

**Date :** 6 octobre 2026
**Dépôt :** `c:\dev\Ecomfy` (branche `main`, dernier commit `2509f79`)
**Type d'analyse :** statique (lecture du code, des migrations SQL, des Edge Functions, de la configuration). Aucune exécution, aucun test en base de production.

---

## 0. Résumé exécutif

Ecomfy est une plateforme SaaS e-commerce multi-boutiques pour l'Afrique francophone (Côte d'Ivoire en tête), avec paiement Mobile Money, livraison, IA générative, académie, réseau social et gouvernance d'entreprise. Le périmètre fonctionnel est très large et la plupart des briques existent réellement.

**Le problème principal est la sécurité du backend**, en particulier tout ce qui touche à l'argent. Plusieurs fonctions SQL `SECURITY DEFINER` qui manipulent les portefeuilles, la facturation et la KYC sont appelables sans contrôle de qui appelle. Un webhook de paiement n'est pas signé. Les montants et les crédits achetés sont décidés par le navigateur. Une élévation de privilèges vers le rôle fondateur est possible avec une simple adresse e-mail.

| Gravité | Nombre | Thème dominant |
|---|---|---|
| Critique | 8 | Fraude financière, élévation de privilèges, XSS stocké |
| Élevé | 11 | Fuite de données d'identité, relais d'e-mails, CSP non appliquée, coût IA |
| Moyen | 12 | Durcissement SQL/Edge, dépendances, reproductibilité |
| Faible / dette | ~15 | TypeScript non strict, pas de CI ni de tests exécutables, hygiène du dépôt |

### Les 10 actions à faire en premier

1. Révoquer `EXECUTE` pour `anon`/`PUBLIC` sur toutes les fonctions financières et de facturation (C1, C2, C3). *(Fait pour C1, C2 et C3 dans les migrations, voir l'état des correctifs ; reste le groupe B de l'annexe F.3. Ce n'est plus « un seul script » : un `REVOKE ... FROM PUBLIC` seul ne suffit pas, il faut nommer `anon` et `authenticated`.)*
2. Vérifier la signature HMAC dans `ecomfy-pay-webhook` (C5). *(Fait dans le code, voir C5.)*
3. Recalculer côté serveur les montants et les crédits dans `process-payment` et `ecomfy-pay-initiate` (C6).
4. Corriger `manage-founder-roles` : supprimer `includes("djateulrich")` et valider le rôle demandé (C7).
5. Supprimer l'exécution de scripts libres dans `tracking.ts` (C8). *(Fait, voir C8.)*
6. Rendre le KYC réel et déplacer les pièces d'identité vers un bucket privé (C4, H1). *(C4 fait : revue manuelle et retraits suspendus, voir C4 et `docs/KYC-REVUE-ET-DEPLOIEMENT-C4.md` ; H1, bucket privé, reste à faire avant tout vrai dossier.)*
7. Corriger les politiques RLS des 8 tables de gouvernance restées ouvertes (H2).
8. Corriger `isAuthorizedCron`, qui accepte un JWT non vérifié (H3).
9. Appliquer les en-têtes de sécurité sur Vercel (H8). Aujourd'hui seul `vercel.json` est lu, et il ne contient aucun en-tête de sécurité.
10. Corriger le `ReferenceError` de `geniuspay-webhook` qui empêche probablement tout crédit automatique (H7).

> **Réserve importante.** Les constats SQL (droits `EXECUTE`, politiques RLS) viennent des migrations présentes dans le dépôt. L'état réel de la base peut différer, car des migrations semblent manquantes (voir M11). Le script de vérification en annexe B permet de confirmer chaque point en 2 minutes sur la base réelle.

### État des correctifs (mis à jour le 12 octobre 2026)

L'annexe B a été exécutée sur la base de dev (copie de la production), puis les deux requêtes clés sur la production. Résultat : la production est arrêtée à la migration `20260901020000`, les 25 migrations suivantes du dépôt n'y sont pas, et les failles ci-dessous sont **confirmées en base**.

| Constat | État en base | Correctif |
|---|---|---|
| C2, partie `apply_commission_payment` / `apply_shop_subscription` | **Confirmé** : exécutables par `anon` et `PUBLIC` | Hotfix `20261012120000` : validé sur la dev, **à déployer en production**. Puis migration `20261012130000` : trois fonctions réservées à `service_role` (SQL validé en local, annexe F ; Edge Function non testée de bout en bout) |
| C2, `confirm_invoice_payment` | **Non exploitable aujourd'hui** : la fonction n'existe pas en base | Réservée à `service_role` par la migration `20261012130000` ; appel client supprimé (code mort) |
| C2 (suite), `apply_shop_activation` / `prepare_shop_activation_payment` | **Probablement exécutables par `anon` et `authenticated`** : leurs migrations font `REVOKE ... FROM PUBLIC` seulement, ce qui ne retire pas ces rôles sur Supabase (reproduit en local). Exploitabilité limitée par la preuve de paiement exigée. À confirmer par l'annexe B | Migration `20261012140000` : réservées à `service_role`. L'activation manuelle d'un fondateur (qui échouait en silence) passe par l'Edge Function `founder-activate-shop`. SQL validé en local (annexe F) ; Edge Function non testée de bout en bout |
| Autres fonctions `SECURITY DEFINER` (analyse de toutes les migrations, annexe F.3) | **68 fonctions encore appelables par `anon` ou `authenticated`** d'après l'analyse statique, dont 31 qui écrivent. Files d'e-mails lisibles par n'importe qui. À confirmer sur la dev (annexe B sans filtre) | Groupe A (16 fonctions serveur) : migration `20261012150000`, validée en local. Groupe B (7 fonctions appelées par le navigateur : KYC, affiliation, facturation par seuil, parrainage) : **non corrigé**. Groupe E (11 fonctions avec garde interne) : à relire |
| H2, tables `corporate_*` | **Confirmé, et plus large** : les 14 tables sont ouvertes (lecture et écriture) à tout utilisateur connecté, car `strict_multitenant_privacy` n'est pas appliquée | Même hotfix : validé sur la dev, **à déployer en production** |
| C1 (et `save_merchant_payout_config`, oubliée par l'audit initial) | **Non exploitable aujourd'hui** : `wallets` n'existe pas en base | **Corrigé dans la migration d'origine** `20260914190000` (`REVOKE` + `GRANT service_role`, retrait via `auth.uid()`, `ecomfy-pay-withdraw` appelle la RPC avec le JWT du marchand). SQL validé sur une base locale jetable (13 tests, annexe D) ; Edge Function non testée de bout en bout |
| C3 | **Non exploitable aujourd'hui** : les fonctions de facturation par seuil n'existent pas en base | **Corrigé dans la migration d'origine** `20260909100000` (contrôle propriétaire / collaborateur actif / fondateur via `auth.uid()`, `REVOKE` pour `anon` et `PUBLIC`). SQL validé sur une base locale jetable (19 tests, annexe E) |
| C4 (KYC factice) | **Non exploitable aujourd'hui** : `merchant_kyc` et `wallets` n'existent pas en base | **Corrigé dans les migrations d'origine** `20260914190000` et `20260914200000` (voir C4 : plus d'auto-validation, revue manuelle, retraits suspendus par défaut). 18 tests sur base jetable, écran testé dans le navigateur. Reste H1 (bucket public). Le guide de déploiement et la procédure de production sont dans `docs/KYC-REVUE-ET-DEPLOIEMENT-C4.md` |
| C7, `manage-founder-roles` | **Non vérifié en base** (Edge Function, aucun effet SQL) | **Corrigé dans le code** : décision sur `user_roles` uniquement (plus d'e-mail), liste blanche des rôles, nommer/révoquer réservé au rôle `founder`, révocation d'un rôle précis. 14 tests Node (annexe F) ; non déployé, non testé contre Supabase. **Reste ouvert :** la politique RLS `user_roles_manage_policy` (voir annexe F) |
| C8, XSS stocké via `google_analytics_code` | **Non vérifié en base** (le champ n'a pas d'écran de saisie mais reste modifiable par l'API par le propriétaire de la boutique : voir la requête de détection ci-dessous). Côté code : exploitable, y compris les scripts en ligne | **Corrigé** : plus aucun code marchand exécuté, identifiants validés partout (navigateur, éditeur, `track-conversion`). 6 tests Node, contre-épreuve sur l'ancien code. Pas déployé |
| C5, `ecomfy-pay-webhook` | Non vérifié en base | **Corrigé dans le code** : signature HMAC + rappel API GeniusPay. 7 tests Node ; non déployé, non testé contre GeniusPay (voir C5) |
| Autres constats (C6, H1, H3 à H11, M, F) | Non vérifiés en base | Hors périmètre du hotfix |

Procédure de déploiement, tests de recette et retour arrière : [`docs/SECURITY-HOTFIX-2026-10.md`](docs/SECURITY-HOTFIX-2026-10.md).

**Production (12 octobre 2026, vague 1) :** les Edge Functions `founder-record-commission-payment`, `founder-activate-shop`, `manage-founder-roles` et `track-conversion`, le hotfix `20261012120000`, `01_c2_c3_security.sql` (`130000`, `140000`, `150000`, `get_shop_orders_secure`), `20261012160000` et la migration H11 `20261011120000` sont appliqués et vérifiés (C2, C3, C7 côté RLS et fonction, H2, H11). **Le front a été déployé le 13/10/2026** ; l'écran de revue KYC y affiche une erreur de table absente (`merchant_kyc`), attendue tant que la vague 2 n'est pas déployée. Le health-monitor a répondu 401 jusqu'au 14/10/2026 (`CRON_SECRET` à définir par un Owner ou Administrator), puis 200 une fois le secret défini côté Edge Functions et Vault. Détail, tests restants et liste des points à traiter : [`docs/DEPLOIEMENT-PROD-2026-10.md`](docs/DEPLOIEMENT-PROD-2026-10.md). Ecomfy Pay (C1, C4, C5) n'est pas déployé : C6 et H1 le bloquent (le conflit `payment_links` est résolu dans le dépôt depuis le 15/10/2026).

---

## 1. Périmètre et méthode

- **Parcouru :** structure complète du dépôt (939 fichiers suivis), `package.json`, config Vite/Vercel/Capacitor/Supabase, les 229 migrations (≈ 14 500 lignes SQL), les ≈ 75 Edge Functions (lecture complète des fonctions de paiement, de rôles, d'e-mails, d'identité et d'IA publiques), les routes, les gardes d'accès, les composants avec injection HTML, les services d'affiliation, les scripts à la racine.
- **Outils :** recherche par motifs (XSS, secrets, `any`, `ts-ignore`), `npm audit` sur le lockfile.
- **Non couvert :** accessibilité visuelle et responsive en pratique, performance mesurée, contenu réel de la base de production, secrets configurés côté Supabase/Vercel, dépôt Lovable.
- **Niveaux de confiance :** « Confirmé » = lu directement dans le code. « À vérifier en base » = dépend de l'état réel de la base de production.

---

## 2. Présentation technique

### 2.1 Stack

| Couche | Technologie |
|---|---|
| Front | React 18, TypeScript, Vite 5, Tailwind 3, shadcn/ui (Radix), React Router 6, React Query 5 |
| Backend | Supabase : PostgreSQL + RLS, Auth (PKCE), Storage, ≈ 75 Edge Functions (Deno) |
| Mobile | Capacitor 8 (Android/iOS) + PWA (service worker `injectManifest`) |
| Paiement | GeniusPay (Mobile Money Wave, Orange, MTN, Moov, carte). Un ancien connecteur Lygos subsiste. |
| IA | OpenAI, OpenRouter, Replicate, Lovable AI Gateway (Gemini), ElevenLabs |
| E-mail | Resend + file d'attente transactionnelle |
| Notifications | Web Push (VAPID), Firebase FCM, notifications locales Capacitor |
| Hébergement | Vercel (`vercel.json`) ; héritage Lovable (`_headers`, MCP, README) |
| i18n | i18next (fr, en, es, pt, ar) + traduction automatique du DOM |

### 2.2 Chiffres

- ≈ 118 000 lignes de TS/TSX dans `src/`, 74 pages, ≈ 75 Edge Functions, 229 migrations, 2 724 commits.
- Plus gros fichiers : `ProductEditor.tsx` (2 243 lignes), `ProductView.tsx` (2 031), `Generator.tsx` (1 932), `ShopView.tsx` (1 672), `FounderDashboard.tsx` (1 472), `ShopEditor.tsx` (1 448), `connectus.service.ts` (1 437).
- Qualité statique : `strict: false`, **842** occurrences de `any`, **67** `@ts-ignore`/`@ts-nocheck`, 30 `console.log`, ≈ 100 `select("*")`.

---

## 3. Fonctionnalités

### 3.1 Boutiques e-commerce multi-tenant
- Création et édition de boutique (`ShopBuilder`, `ShopEditor`, `ShopManager`) : identité, couleurs, WhatsApp, réseaux sociaux, langues, objectif mensuel.
- **8 thèmes de boutique** (Classic, Fashion, Beauty, Luxury, Tech, Landing, Mobile-first, Dynamic) et **7 thèmes de fiche produit**.
- **Constructeur de page d'accueil** par sections (hero, produits, catégories, FAQ, témoignages audio, vidéos shorts, formulaire de contact, bannière, footer, etc.) et éditeur glisser-déposer (`dnd-kit`).
- Domaine personnalisé avec assistant DNS et vérification (`verify-domain-dns`), détection du domaine côté `App.tsx`.
- Preuve sociale, compteur de visiteurs en direct, globe 3D du trafic, paniers abandonnés, avis avec modération, barre d'avis défilante.
- Boutique installable (PWA), partage avec métadonnées Open Graph (`share-product`), sitemap dynamique.

### 3.2 Produits et stock
- Éditeur et assistant de création de produit, variantes, offres en lot (bundles), prix barrés, audio produit, vidéos courtes, générateur de GIF.
- Optimisation IA du produit (`product-ai-optimizer`), fiche produit IA (`generate-product-sheet`), traduction (`translate-product`).
- Gestion de stock et traçabilité des mouvements (migration `stock_traceability_system`).

### 3.3 Commandes et livraison
- Liste des commandes, notifications temps réel (son, voix, push), commandes planifiées.
- **Module Livraison** : partenaires (DLK Services préconfiguré) et livreurs, zones et tarifs (Abidjan), répartition manuelle ou automatique, suivi de caisse, application livreur (scan QR, signature, photo du colis), KYC livreur avec comparaison faciale.

### 3.4 Paiements et facturation
- **Abonnements boutique :** Démarrage (gratuit, commission de 50 FCFA par commande), Pro (12 000 FCFA/mois, commission nulle, domaine propre), Premium Académie (35 000 FCFA/mois).
- **Seuil de commission :** blocage progressif d'une boutique (échéance, restriction, verrouillage, suspension finale) avec masquage des données clients.
- **Ecomfy Pay :** liens de paiement (`/pay/:linkKey`), portefeuille marchand (solde en attente puis disponible après 72 h), retraits, KYC marchand, grand livre.
- Packs de crédits IA (20/30/40 crédits), codes promo, historique de paiements, réconciliation des paiements en attente.

### 3.5 Intelligence artificielle
- **Studio** unifié : images, vidéos, visuels publicitaires, voix off, file d'attente, historique de variantes.
- Extraction de marque, correcteur de texte, assistant de boutique (chat et synthèse vocale), chatbot de vitrine, conseiller financier, générateur de site vitrine.
- Système de crédits : essai gratuit par fonctionnalité, déduction de crédits, exemption des fondateurs.

### 3.6 Sites vitrines, Académie, Communauté
- Sites vitrines (blog, galerie, services, formations, réservations, contact).
- **Académie** : cours, modules, inscriptions, certificats vérifiables (`/verify-certificate`), comptes étudiants.
- **ConnectUs** : réseau social/communauté (messages, sujets, réactions, notifications).

### 3.7 Marketing, SEO, suivi
- Pixels Facebook, TikTok, Snapchat, GA4, API de conversion côté serveur (`track-conversion`), comptes publicitaires, synchronisation des dépenses, alertes d'expiration de jeton.
- **SEO Intelligence** : Google Search Console, audit, PageSpeed, auto-indexation, rapports.

### 3.8 Affiliation
- Programme d'ambassadeurs/affiliés : code personnel, 20 % de commission par défaut, périodes trimestrielles, paiements manuels par le fondateur, journal d'audit.

### 3.9 Gouvernance et pilotage
- **Gouvernance d'entreprise :** table de capitalisation, actionnaires, vesting, documents et acceptations, propositions, invitations, journal d'audit.
- **Tableau de bord fondateur :** métriques financières, audit de revenus, contrôle des paiements de boutiques, dépannage, rôles de fondateurs, moniteur de santé et actions de remédiation.

### 3.10 Plateforme
- API publique documentée, clés d'API, serveur MCP (outils de lecture boutiques/produits/commandes).
- Notifications push web et natives, e-mails transactionnels avec désinscription et liste de suppression.
- Application mobile Capacitor.

---

## 4. Constats de sécurité

### CRITIQUE

#### C1. Fonctions de portefeuille appelables par n'importe qui
- **Où :** `supabase/migrations/20260914190000_ecomfy_pay_system.sql:224` (`credit_merchant_wallet_pending`), `:288` (`process_wallet_settlements`), `:334` (`request_wallet_withdrawal_atomic`).
- **Constat (confirmé dans les migrations) :** ces fonctions sont `SECURITY DEFINER`, reçoivent `p_merchant_id` en paramètre, ne vérifient pas `auth.uid()` et n'ont aucun `REVOKE ... FROM PUBLIC`. Dans Supabase, `anon` et `authenticated` obtiennent `EXECUTE` par défaut.
- **Scénario :** un visiteur anonyme appelle `rpc('credit_merchant_wallet_pending', {p_merchant_id: <son id>, p_net_amount: 5000000, ...})`, puis `request_wallet_withdrawal_atomic` pour demander un retrait. Il peut aussi vider le solde disponible d'un autre marchand vers une demande de retrait qu'il contrôle.
- **Correctif :** `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role;`. Pour le retrait, ne pas passer `p_merchant_id` : utiliser `auth.uid()` dans la fonction.
- **Statut (12 octobre 2026) : corrigé dans la migration d'origine, validé en local, pas déployé.**
  - `20260914190000_ecomfy_pay_system.sql` : `REVOKE` à `PUBLIC`/`anon`/`authenticated` puis `GRANT` à `service_role` sur `get_or_create_merchant_wallet` (non citée à l'origine : elle créait des portefeuilles et divulguait les soldes), `credit_merchant_wallet_pending` et `process_wallet_settlements`.
  - `request_wallet_withdrawal_atomic` n'a plus de paramètre `p_merchant_id` : elle utilise `auth.uid()`, refuse un appelant non connecté et rejette les montants nuls ou négatifs (un montant négatif aurait crédité le portefeuille). Accordée à `authenticated` et `service_role`, retirée à `anon`. Les quatre fonctions ont `SET search_path = public`.
  - `ecomfy-pay-withdraw` appelle la RPC avec un client lié au JWT du marchand (`SUPABASE_ANON_KEY` + en-tête `Authorization`). Avec la clé `service_role`, `auth.uid()` serait nul et tous les retraits seraient refusés.
  - **Fonction oubliée par l'audit initial : `save_merchant_payout_config`** (`20260914200000_ecomfy_pay_enhanced.sql`). Elle prenait `p_merchant_id` du client sans contrôle : n'importe quel utilisateur, `anon` compris, pouvait réécrire le numéro de retrait par défaut d'un autre marchand (pré-rempli dans le formulaire de retrait). Corrigée de la même façon : `auth.uid()`, plus de paramètre `p_merchant_id`, `search_path` fixé, `REVOKE` de `PUBLIC`/`anon`, `GRANT` à `authenticated` et `service_role`. `src/lib/ecomfyPay.ts` n'envoie plus `p_merchant_id`. Tests : annexe F.3.
  - Résultats des tests : annexe D.

#### C2. Contournement de la facturation (commissions et abonnements)
- **Où :** `20260909100000_ecomfy_billing_threshold_system.sql:380` (`confirm_invoice_payment`, accordée à `anon`) ; `20261003120000_fix_billing_partial_payments_sync.sql:124` (`apply_commission_payment`, accordée explicitement à `anon`) ; `20260912000000_fix_subscription_plan_aliases_and_zero_commission.sql:53` (`apply_shop_subscription`, aucun `REVOKE`). Le client appelle d'ailleurs `confirm_invoice_payment` directement : `src/lib/billingSystem.ts:221`.
- **Constat :** aucune de ces fonctions ne vérifie qu'un paiement réel a eu lieu ni que l'appelant possède la boutique.
- **Scénario :** n'importe qui efface la dette de commission de n'importe quelle boutique (`commission_balance_due = 0`, statut `STORE_ACTIVE`), ou active un abonnement Pro gratuitement.
- **Correctif :** réserver ces trois fonctions à `service_role` (appelées uniquement depuis les webhooks). Supprimer l'appel client à `confirm_invoice_payment`.
- **Statut (12 octobre 2026) : corrigé. SQL et Edge Functions `founder-*` appliqués en production le 12/10/2026 et vérifiés (droits `service_role` seul) ; le front des écrans fondateur est déployé (13/10/2026) ; tests applicatifs à confirmer (`docs/DEPLOIEMENT-PROD-2026-10.md`).**
  - Migration `20261012130000_c2_reserve_billing_rpc_to_service_role.sql` : `REVOKE` à `PUBLIC`/`anon`/`authenticated`, `GRANT` à `service_role` sur `apply_commission_payment`, `apply_shop_subscription` et `confirm_invoice_payment`. Idempotente ; la partie `confirm_invoice_payment` est protégée par `to_regprocedure` car la fonction n'existe pas en production.
  - Les quatre écrans fondateur qui appelaient `apply_commission_payment` depuis le navigateur (`BillingPaymentModal`, `PayCommissionDialog`, `ShopPaymentControl`, `FounderDashboard`) passent par la nouvelle Edge Function `founder-record-commission-payment` (helper `src/lib/founderBilling.ts`). Elle vérifie le JWT et le rôle `founder` / `co_founder`, valide les entrées, fixe `p_created_by` depuis la session, puis appelle la RPC avec `service_role`.
  - `confirmBillingPayment` (seul appelant client de `confirm_invoice_payment`) et `handleConfirmPayment` du hook `useBillingSystem` sont supprimés : aucun composant ne les utilisait.
  - La garde interne de `apply_commission_payment` (hotfix `20261012120000`) est conservée en défense en profondeur.
  - **Complément `apply_shop_activation` / `prepare_shop_activation_payment`** (migration `20261012140000`). Les migrations d'origine (`20260516133834`, `20260516161922`) font seulement `REVOKE ... FROM PUBLIC` : sur Supabase, `anon` et `authenticated` gardent `EXECUTE` (privilèges par défaut du schéma `public`, reproduit en local, annexe F). Elles sont maintenant réservées à `service_role`. Exploitabilité limitée : la fonction exige un paiement `completed` correspondant, et `payments` refuse l'insertion aux utilisateurs (politique `WITH CHECK (false)`).
  - **Défaut fonctionnel corrigé au passage :** l'activation manuelle de `FounderDashboard` passait une référence `MANUAL-...` sans paiement `completed` associé. La fonction répondait `success:false` et le client, qui ne testait que `error`, affichait « Paiement validé ». Elle passe par la nouvelle Edge Function `founder-activate-shop` : contrôle du rôle fondateur, propriétaire lu en base, enregistrement d'un paiement `completed` marqué `manual` (avec `recorded_by`), puis appel de la RPC ; si la RPC échoue, le paiement est repassé à `failed`.
  - Les deux Edge Functions fondateur partagent `supabase/functions/_shared/founderAuth.ts` (JWT + rôle).

#### C3. Fuite des données clients de toutes les boutiques
- **Où :** `20260909100000_ecomfy_billing_threshold_system.sql:207` et `:305`.
- **Constat :** `get_shop_orders_secure(_shop_id)` est `SECURITY DEFINER`, accordée à `anon`, et ne vérifie pas que l'appelant est propriétaire ou collaborateur. Elle renvoie nom, téléphone, e-mail et adresse des clients. Le masquage ne dépend que du statut de paiement de la boutique.
- **Scénario :** avec l'UUID d'une boutique (visible dans les vues publiques), un anonyme télécharge tous les clients et commandes.
- **Correctif :** ajouter `can_manage_shop(_shop_id)` en tête de fonction, retirer `anon`.

#### C4. KYC marchand factice : tout le monde est « VERIFIED »
- **Où :** `20260914200000_ecomfy_pay_enhanced.sql:60-115` (`evaluate_merchant_kyc_security`).
- **Constat :** la fonction n'analyse rien. Dès que l'URL du document fait plus de 10 caractères, elle écrit `verification_status = 'VERIFIED'` avec un score de visage codé en dur à 95. Elle est `SECURITY DEFINER`, avec `p_merchant_id` libre, sans `REVOKE`.
- **Impact :** la seule barrière avant un retrait (`request_wallet_withdrawal_atomic`) est contournée. En outre, côté base, la politique « Users update own KYC » n'a pas de restriction de colonnes : un marchand peut aussi mettre son propre statut à `VERIFIED` directement.
- **Correctif :** retirer l'auto-validation, ne laisser que `service_role` ou un fondateur écrire `verification_status`, brancher un vrai prestataire KYC ou une validation manuelle.
- **Statut (12 octobre 2026) : corrigé dans les migrations d'origine, testé en local, pas déployé.**
  - `20260914200000_ecomfy_pay_enhanced.sql` : `evaluate_merchant_kyc_security` est supprimée (toutes signatures). Remplacée par `review_merchant_kyc(p_user_id, p_decision, p_reason)` : `service_role` ou fondateur / co-fondateur (`is_corporate_founder()`), jamais sur son propre dossier, motif obligatoire pour un rejet, `REVOKE` pour `PUBLIC` et `anon`.
  - Trigger `merchant_kyc_guard_review_columns` : pour `anon` / `authenticated`, les colonnes de décision (`verification_status`, `verified_at`, `verified_by`, `rejection_reason`, `face_match_*`, `doc_type_validated`, `ocr_extracted_name`, `verification_notes`) sont ignorées à l'écriture ; un nouveau dossier est toujours `PENDING` ; changer une pièce ou l'identité d'un dossier déjà décidé le repasse en `PENDING`.
  - `20260914190000_ecomfy_pay_system.sql` : politique d'insertion limitée à `PENDING`, `WITH CHECK` sur la mise à jour. **Retraits suspendus par défaut** : `request_wallet_withdrawal_atomic` lit `ecomfy_pay_settings.withdrawals_enabled` (`false` à la création, table fermée à `anon` / `authenticated`). À passer à `true` côté serveur seulement quand un processus de revue existe.
  - Interface : `ecomfyPay.ts` et `KycVerificationTab.tsx` n'appellent plus l'ancienne RPC et n'envoient plus de statut ; le message annonce un examen manuel.
  - Lecture : politique « Founders view all KYC » (fondateurs et co-fondateurs), nécessaire à l'écran de revue. `is_corporate_founder()` est redéfinie dans `20260914190000` (même corps que le hotfix) pour qu'un rejeu des migrations dans l'ordre des horodatages ne casse pas.
  - Écran : `/founder/kyc-review` (`src/pages/founder/KycReview.tsx`), entrée « Revue KYC » dans le menu Administration.
  - Tests : `supabase/tests/c4_kyc_review.sql`, 18 cas sur base jetable (migrations d'origine et script `deploy-dev/02`) ; écran testé dans Chrome contre un faux serveur Supabase (liste, fiche, rejet sans motif, rejet avec motif, validation). **Non testé :** déploiement sur une vraie base Supabase, écran contre une vraie base, « Pièces redemandées », mobile.
  - **Reste :** pièces d'identité encore dans un bucket public (H1) ; prestataire KYC non choisi ; pas d'historique des décisions. Procédure de déploiement, dont la production et ses prérequis (C5, C6 ; conflit `payment_links` résolu par `ecomfy_payment_links`) : `docs/KYC-REVUE-ET-DEPLOIEMENT-C4.md`.

#### C5. Webhook Ecomfy Pay sans vérification de signature
- **Où :** `supabase/functions/ecomfy-pay-webhook/index.ts` (fichier entier, `verify_jwt` non défini donc la fonction est exposée à tous).
- **Constat :** contrairement à `geniuspay-webhook` (qui vérifie un HMAC-SHA256 avec fenêtre anti-rejeu de 5 minutes), ce webhook accepte n'importe quel JSON. Il marque le paiement `SUCCEEDED`, passe la commande en `PAID` et crédite le portefeuille.
- **Scénario :** `POST {event:"payment.success", data:{metadata:{internal_reference:"ECM-PAY-XXXX"}}}` : fausse confirmation de paiement. La référence est devinable (voir M4) ou récupérable car renvoyée par `ecomfy-pay-initiate`.
- **Correctif :** reprendre `computeSignature` + `timingSafeEqual` de `geniuspay-webhook`. En complément, rappeler l'API GeniusPay pour confirmer le statut avant de créditer.

- **Statut (12 octobre 2026) : corrigé dans le code, testé en local, pas déployé.**
  - `supabase/functions/_shared/webhookSignature.ts` (nouveau) : HMAC-SHA256 de `timestamp.corps brut` avec `GENIUSPAY_WEBHOOK_SECRET` (en-têtes `X-Webhook-Signature` / `X-Webhook-Timestamp`, fenêtre de 5 minutes, comparaison à temps constant), même schéma que `geniuspay-webhook`.
  - `ecomfy-pay-webhook` : signature vérifiée avant tout accès à la base (401 si absente ou invalide, 500 si le secret manque). Avant de traiter un succès, la fonction interroge `GET /payments/{ref}` chez GeniusPay et ne crédite que si le statut est `completed`, `paid` ou `success` (503 si l'appel échoue, avant l'insertion d'idempotence, pour que la nouvelle tentative ne soit pas ignorée). 7 tests Node : `supabase/tests/webhook-signature.test.ts`.
  - **À vérifier avant déploiement :** que `GENIUSPAY_WEBHOOK_SECRET` est défini ; que GeniusPay appelle bien cette URL pour les paiements Ecomfy Pay ; qu'un paiement de test sur dev est confirmé par `GET /payments/{ref}` (sinon tous les succès partent en 503). Format de signature supposé identique à `geniuspay-webhook`, non vérifié sur un envoi réel.
  - **Reste ouvert :** M6 (échec du crédit acquitté). Le montant renvoyé par GeniusPay est désormais comparé à `payment.amount` (C6).

#### C6. Montants et crédits décidés par le navigateur
- **Où :** `supabase/functions/process-payment/index.ts:113,216,436-520` ; `supabase/functions/ecomfy-pay-initiate/index.ts:23-36,60-73`.
- **Constat :**
  - `process-payment` prend `amount` et `credits_pack {size, price}` du corps de la requête. Aucun tarif serveur n'est consulté, alors que l'audit de juin 2026 listait déjà ce point comme « non vérifié » (Lot 2, point 7). Le webhook crédite `credits_size` lu dans les métadonnées, et ne compare le montant qu'à celui saisi par le même client.
  - `ecomfy-pay-initiate` accepte `amount` et `order_id` sans les rapprocher de `orders.total` ni du prix du lien de paiement.
- **Scénario :** acheter 10 000 crédits IA pour 1 FCFA ; ou payer 1 FCFA et marquer une commande de 100 000 FCFA comme `PAID` (via le webhook, qui fait confiance à `payment.order_id`).
- **Correctif :** une table de tarifs serveur (plans, packs), recalcul du montant à partir de `plan`/`pack_id`/`order_id`, rejet si le montant ne correspond pas.
- **Statut (15 octobre 2026) : version minimale corrigée dans le code, non déployée, non testée contre GeniusPay ni Supabase.**
  - `supabase/functions/_shared/pricing.ts` (nouveau) : tarifs en constantes (pas de table, donc pas de migration). `process-payment` refuse tout montant différent du tarif : packs de crédits, activation (1 300), plans (mensuel/annuel), commission (partielle autorisée, jamais au-delà de `shops.commission_balance_due`, boutique du demandeur). Les crédits crédités par le webhook viennent donc d'un pack validé.
  - `ecomfy-pay-initiate` : exige `order_id` ou `payment_link_id` ; le montant doit être `orders.total` (même boutique, commande non payée) ou le montant du lien (actif, même boutique, minimum si montant libre). Le montant débité est celui lu en base.
  - Barème des crédits tranché : celui d'`AICreditsBadge` (20 = 2 000, 30 = 2 500, 40 = 3 000) ; `Subscription.tsx` aligné (30 et 40 étaient à 3 000 et 4 000). Packs 10 et 50 (1 000 et 5 000) conservés tels quels : à confirmer.
  - 14 tests Node : `supabase/tests/pricing.test.ts`, dont un qui compare les prix de l'interface à ceux du serveur.
  - **Commandes et webhook (15 octobre 2026, suite) :** les triggers `enforce_order_item_price` et `recompute_order_totals` (migration `20260615165600`) recalculent déjà `orders.total` aux prix de `products` ; ils ignorent les offres en lot (`bundle_offers`) et ne sont **pas vérifiés en base**. `ecomfy-pay-initiate` ne s'y fie pas : il recalcule le total depuis `order_items` et `products` (voir plus bas) et exige que le montant du client y corresponde à 1 FCFA près ; le montant débité est celui du serveur. `ecomfy-pay-webhook` compare le montant et la devise renvoyés par `GET /payments/{ref}` à `ecomfy_payments.amount` avant tout crédit ou marquage `PAID` (503 si GeniusPay ne renvoie pas de montant). `process-payment` n'écrit plus dans les métadonnées qu'un `shop_id` vérifié pour `shop_subscription` (`targetShopId`). 51 tests Node au total dans `supabase/tests/`.
  - **Anomalies du parcours de paiement corrigées (même date) :** `ecomfy-pay-initiate` répondait `success: true` sans lien quand GeniusPay échouait, et `ProductView.tsx` affichait alors « commande confirmée » sans paiement : la fonction renvoie maintenant 502 (paiement `FAILED`) et l'écran affiche l'erreur et garde le panier. Les refus 4xx de C6 arrivaient comme « non-2xx » sans message : `ecomfyPay.ts` lit le corps de l'erreur. `Subscription.tsx` n'affichait pas le message d'un refus de `process-payment`. Total affiché à la confirmation (0 pour une commande sans panier) et référence interne (`Math.random`) corrigés.
  - **À vérifier avant déploiement :** que `GET /payments/{ref}` renvoie bien `amount` et `currency` (sinon tous les succès partent en 503) ; que les triggers de `20260615165600` sont présents en production (requête sur `pg_trigger`) ; ordre : migration `20261015120000`, puis fonctions, puis front (les fonctions lisent `bundle_index`).
  - **Offres en lot et insertion publique (15 octobre 2026, fin) :** migration `20261015120000_c6_order_bundles_and_public_insert_guard.sql` (idempotente, à appliquer AVANT les fonctions et le front). `order_items.bundle_index` désigne l'offre de `products.bundle_offers` ; `enforce_order_item_price` applique alors `prix du lot × quantité / quantité du lot` et refuse une quantité inférieure à celle du lot, donc `orders.total` tient enfin compte des lots. Le trigger `trg_guard_public_order_insert` ramène, pour un visiteur (anon ou connecté non propriétaire), `payment_status` à `pending`, `order_status` à `new` (ou `pending`), `commission_amount` à 0 et les champs de livraison à NULL : un visiteur pouvait insérer une commande `PAID`/`delivered`. 10 cas dans `supabase/tests/c6_order_pricing.sql`, exécutés sur l'image Postgres Supabase jetable (aucun échec ; migration rejouée sans erreur). `ecomfy-pay-initiate` remplace le plancher par le total exact recalculé (`orderExpectedTotal`, même règle que le trigger, vérifiée par un test croisé avec le calcul du front `src/lib/bundlePricing.ts`) ; si GeniusPay ne fournit pas de lien, la commande en ligne est annulée.
  - **Décisions et limites :** le paiement de commission reste réservé au propriétaire de la boutique (aucun rôle collaborateur ne couvre les paiements). Une commande insérée par un visiteur garde le `total` qu'il a envoyé tant qu'aucun article n'est inséré (nécessaire à la notification push, qui part à l'insertion) : une commande sans article peut afficher un total fantaisiste chez le marchand, mais elle n'est jamais payable en ligne. Les commandes restent insérées par le navigateur (pas de RPC unique).

#### C7. Élévation de privilèges vers « fondateur »
- **Où :** `supabase/functions/manage-founder-roles/index.ts:35` (`callerEmail.includes("djateulrich")`) et `:41-45` ; même motif côté interface : `FounderDashboard.tsx:349,376`, `FounderTroubleshooting.tsx:90,118`.
- **Constat :** tout utilisateur dont l'e-mail **contient** « djateulrich » (par exemple `djateulrich@outlook.com` ou `x.djateulrich@gmail.com`) est traité comme fondateur principal. De plus, les rôles `shareholder` et `admin` suffisent à passer le contrôle. L'action `add` écrit ensuite n'importe quel `role` dans `user_roles` avec la clé `service_role`, sans liste blanche.
- **Scénario :** création d'un compte avec une adresse contenant « djateulrich », appel de `add` avec son propre e-mail et le rôle `founder` : accès complet au tableau de bord fondateur, aux données financières et à la gouvernance.
- **Correctif :** supprimer toute décision basée sur l'e-mail ; ne se fier qu'à `user_roles` (rôles `founder`/`co_founder` uniquement) ; liste blanche des rôles attribuables ; seul le fondateur principal (identifié par UUID) peut en nommer d'autres. `revoke` doit supprimer un rôle précis, pas tous les rôles de l'utilisateur.

#### C8. XSS stocké via le champ « code Google Analytics »
- **Où :** `src/lib/tracking.ts:176-197`.
- **Constat :** si le champ ne contient pas d'identifiant `G-XXXX`, le code HTML du propriétaire de boutique est injecté et ses balises `<script>` sont recréées. Le filtre ne s'applique qu'aux scripts **avec** `src` : `srcUrl && !regex.test(srcUrl)`. Les scripts **inline** s'exécutent donc sans aucun contrôle. De plus, la regex n'est pas ancrée : `https://evil.tld/?https://googletagmanager.com` ou `https://googletagmanager.com.evil.tld` passent.
- **Impact :** un marchand malveillant exécute du JavaScript sur `ecomfy.cloud/shop/<slug>`, donc sur la même origine que l'application. Le jeton de session est dans `localStorage` (`ecomfy-auth-token`, voir M8) : prise de contrôle du compte de tout visiteur connecté, y compris un fondateur.
- **Correctif :** supprimer le chemin « code libre ». N'accepter qu'un identifiant validé par regex (`^G-[A-Z0-9]{4,}$`), comme le recommandait déjà l'audit de juin (Lot 2, point 6).
- **Statut (12 octobre 2026) : corrigé. `track-conversion` et le front (`tracking.ts`, `ShopSettings.tsx`) déployés en production (front signalé le 13/10/2026). Requête de détection non lancée en production.**
  - `src/lib/trackingIds.ts` (nouveau) : validateurs stricts et ancrés. GA4 `^G-[A-Z0-9]{4,20}$`, Meta `^\d{5,20}$`, TikTok `^[A-Z0-9]{8,32}$` (insensible à la casse), Snapchat `^[A-Za-z0-9-]{8,64}$`. `extractGa4Id` extrait l'identifiant d'un snippet collé et jette tout le reste.
  - `src/lib/tracking.ts` : le chemin « code libre » est **supprimé** (plus de `template`, `innerHTML`, copie d'attributs ni de contenu de script). `google_analytics_code` ne sert plus qu'à en extraire un `G-XXXX`. Chaque chargeur (`loadFacebook`, `loadTikTok`, `loadSnapchat`, `loadGA4`) valide son identifiant avant toute insertion de script, et `trackEvent` filtre aussi les identifiants. Les identifiants `UA-` (Universal Analytics, arrêté en 2023) ne sont plus acceptés.
  - `ShopSettings.tsx` : la saisie d'un pixel est refusée avec un message si le format est invalide.
  - `track-conversion` (défense en profondeur) : les identifiants de pixel et le GA4 sont filtrés avant d'être insérés dans les URLs `graph.facebook.com`, `tr.snapchat.com` et `google-analytics.com`, qui reçoivent le jeton du marchand ; le secret GA4 est encodé.
  - Limite : la base peut toujours contenir des valeurs invalides : aucune contrainte `CHECK` n'est ajoutée sur ces colonnes, pour ne pas bloquer l'enregistrement des boutiques dont les données existantes sont déjà hors format. Ces valeurs sont ignorées par le navigateur et par `track-conversion`.
  - Tests : `supabase/tests/tracking-ids.test.ts` (6 tests : formats, charges utiles XSS dont les deux contournements de regex cités ci-dessus, garde de non-régression sur le source). Exécution : `node --experimental-strip-types --test supabase/tests/tracking-ids.test.ts`. Contre-épreuve : l'ancien `tracking.ts` contient `innerHTML`, `template`, `.text =` et la copie d'attributs que le test interdit, et l'ancien filtre acceptait `https://evil.tld/?https://googletagmanager.com` et `https://googletagmanager.com.evil.tld/x.js`.
  - **À faire après déploiement :** détecter les boutiques déjà piégées (le correctif neutralise l'exécution, mais l'attaque a pu avoir lieu avant) et réinitialiser les jetons de session si un abus est trouvé :

```sql
select id, slug, user_id, left(google_analytics_code, 120) as extrait
from shops
where google_analytics_code ~* '(<script|<img|<svg|<iframe|onerror|onload|javascript:|fetch\(|localStorage|document\.cookie)'
   or (google_analytics_code is not null and google_analytics_code !~ '^\s*G-[A-Za-z0-9]{4,20}\s*$'
       and google_analytics_code ~ '[<>]');
```
  - Reste lié : M8 (jeton de session dans `localStorage`) aggrave l'impact de toute XSS ; le correctif C8 supprime la principale, pas la classe de risque.
  - **Points à connaître :**
    - **Universal Analytics :** les identifiants `UA-XXXXXXX-X` ne sont plus acceptés (service arrêté en 2023). Un marchand qui n'a que cet identifiant n'aura plus de suivi Google tant qu'il n'a pas saisi un identifiant GA4.
    - **Snippet complet collé :** si le champ contient un snippet gtag complet, seul le premier `G-XXXX` est utilisé ; les autres balises, scripts ou événements personnalisés sont ignorés. Un marchand qui s'appuyait sur du code personnalisé (Google Tag Manager `GTM-XXXX`, balises de conversion `AW-`) perd cette fonction : les ajouter comme champs dédiés avec validation si le besoin existe.
    - **Données existantes :** les colonnes ne portent aucune contrainte `CHECK` ; une valeur hors format reste en base mais est ignorée par le navigateur et par `track-conversion`. Les marchands concernés ne voient pas d'erreur : leurs pixels cessent simplement de fonctionner.
    - **Boutiques déjà piégées :** le correctif neutralise l'exécution mais pas une attaque antérieure ; lancer la requête de détection ci-dessus après déploiement, et réinitialiser les sessions concernées si un abus est trouvé.
    - **Couverture des tests :** formats, charges utiles et garde sur le source, exécutés sous Node. Aucun test dans un navigateur réel ni dans un DOM : le comportement de `initShopPixels` n'est pas exécuté de bout en bout. Le dépôt n'a pas de lanceur de tests (`vitest` absent) ; les tests suivent la convention `node --test` de `supabase/tests/`.
    - **Écran de saisie :** `google_analytics_code` n'a pas de champ dans `ShopSettings.tsx` ; il n'est modifiable que par l'API, ce qui limite la population exposée mais pas le risque (tout propriétaire de boutique peut écrire cette colonne).

### ÉLEVÉ

#### H1. Pièces d'identité dans un bucket public
- **Où :** `src/components/ecomfy-pay/KycVerificationTab.tsx:114-117,154-157` ; les 18 appels `storage.from(...)` du client utilisent tous `shop-images` (public, listable selon l'audit de juin).
- **Impact :** CNI, passeports et selfies des marchands et livreurs sont servis par URL publique `getPublicUrl`. C'est une fuite de données personnelles sensibles et une exposition légale.
- **Correctif :** bucket privé `kyc-documents`, politiques RLS par `auth.uid()`, URL signées à durée courte, suppression des fichiers existants du bucket public.
- **État (15/10/2026) :** corrigé dans le code (migration `20261015140000`, `src/lib/kycStorage.ts`, script `scripts/migrate-kyc-to-private-bucket.mjs`, test `supabase/tests/h1_kyc_private_bucket.sql` : 26 cas sur 26 en base jetable) ; non déployé.

#### H2. Huit tables de gouvernance en lecture/écriture libre pour tout utilisateur connecté
- **Où :** `20260901000000_corporate_governance_system.sql:278-307`. La migration `20260902140000_strict_multitenant_privacy.sql` ne supprime et ne remplace les politiques que de **6** tables.
- **Tables restées ouvertes (`USING (true)`) :** `corporate_vesting_milestones`, `corporate_document_versions`, `corporate_document_acceptances`, `corporate_proposal_approvals`, `corporate_cap_table_snapshots`, `corporate_intellectual_property`, `corporate_offboarding_cases`, `corporate_audit_logs`.
- **Impact :** n'importe quel inscrit lit et modifie la table de capitalisation, la propriété intellectuelle, les cas de départ, et peut **effacer ou falsifier le journal d'audit**.
- **Correctif :** supprimer ces politiques, appliquer `is_authorized_corporate_member()` en lecture et un rôle fondateur en écriture.
- **État (15/10/2026) :** les 14 tables `corporate_*` sont fermées en production depuis le hotfix `20261012120000` (lecture `founder`, `co_founder`, `shareholder`, `admin` ; écriture `founder`, `co_founder`). Reste le résidu des deux politiques d'insertion libres (`corporate_audit_logs`, `corporate_document_acceptances`) : corrigé dans le code par `20261015150000_h2_corporate_audit_append_only.sql` (ajout seul, au nom de l'appelant) et `src/pages/CorporateOnboardingPage.tsx`, test `supabase/tests/h2_corporate_8_tables.sql` (121 cas sur 121 en base jetable) ; non déployé.

#### H3. `isAuthorizedCron` accepte un JWT dont la signature n'est pas vérifiée
- **Où :** `supabase/functions/_shared/cron-auth.ts:9-24`.
- **Constat :** la fonction décode la charge utile d'un jeton et accepte tout jeton dont `role === "service_role"`, sans contrôler la signature. Ses consommateurs sont `process-queue`, `reconcile-pending-payments`, `send-24h-reminder`, `send-weekly-finance-summary`, `check-ad-token-expiry`, `app-health-monitor`, `seo-auto-index`, tous en `verify_jwt = false`.
- **Impact :** n'importe qui forge un jeton et déclenche des envois d'e-mails, des réconciliations de paiement et des tâches d'administration.
- **Correctif :** supprimer la branche « payload `role` », ne garder que la comparaison exacte avec la clé de service ou le secret `CRON_SECRET` (comparaison à temps constant).
- **Statut (15/10/2026) : corrigé dans le code, non déployé, non testé (pas de Deno disponible).** La branche « payload `role` » est supprimée, les comparaisons sont à temps constant. Même défaut corrigé dans `seo-auto-index` (`isAuthenticatedUser` vérifie désormais le jeton via `auth.getUser`). Prérequis au déploiement : le secret Vault `email_queue_service_role_key` doit contenir exactement la clé de service actuelle, sinon `process-queue` répondra 401.

#### H4. Relais d'e-mails ouverts et injection HTML
- **Où :** `send-subscription-email/index.ts` (aucune authentification, destinataire et contenu libres, `${full_name}` non échappé) ; `send-domain-ready-notification/index.ts` (idem avec `ownerEmail`, `customDomain`) ; `send-corporate-invite/index.ts:18` (authentifié mais destinataire, rôle et `originUrl` libres) ; `verify-delivery-identity/index.ts` (`userName` non échappé).
- **Impact :** envoi de courriels de phishing depuis `support@ecomfy.cloud` (domaine légitime, bonne réputation SPF/DKIM), avec liens contrôlés par l'attaquant. Risque de classement en spam du domaine.
- **Correctif :** authentifier l'appelant, déduire le destinataire et le contenu depuis la base (comme le font correctement `send-contact-notification` et `send-booking-notification`), échapper toutes les variables, valider `originUrl` contre une liste blanche.
- **Statut (16/10/2026) : corrigé dans le code, non déployé, non testé sur Deno (absent de la machine ; helpers purs vérifiés sous Node).**
  - Nouveau `_shared/email-safety.ts` : `escapeHtml`, `isValidEmail`, `isValidHostname`, `pickAllowedOrigin`.
  - `send-subscription-email` : réservée à la clé de service (`isAuthorizedCron`) ; les deux appelants (`geniuspay-webhook`, `payment-callback`) utilisent déjà un client service_role. Champs validés, nom échappé. Le bouton pointe vers `APP_URL/studio` (l'ancien lien `…lovableproject.com/generator` était une URL fabriquée à partir de `SUPABASE_URL`).
  - `send-domain-ready-notification` : réservée à la clé de service ; seul `showcaseId` est lu dans le corps, domaine, nom et destinataire sont relus dans `showcase_sites` et `profiles` (et le domaine doit être `active` avec SSL `active`). `verify-domain-dns` envoie désormais la clé de service au lieu de la clé anon.
  - `send-corporate-invite` : `requireFounder` (JWT + rôle `founder`/`co_founder`), e-mail et jeton (`^[A-Za-z0-9_-]{8,128}$`) validés, plus de `demo-token`, rôle hors liste ramené à « Associé », `originUrl` limité à `APP_URL`, `https://ecomfy.cloud` et au secret optionnel `EMAIL_LINK_ORIGINS` (sinon repli sur `APP_URL`), tout est échappé.
  - `verify-delivery-identity` : `userName`, `rejectionReason`, `faceMatchScore` échappés ou bornés ; autorisation et destinataire traités avec H5 ci-dessous.
  - Limite connue : `send-corporate-invite` n'a pas de lecture en base du destinataire, car `corporate_invitations` est ouverte en écriture à `public` (annexe F) ; le verrou est le contrôle de rôle.
  - Prérequis au déploiement : redéployer `send-subscription-email`, `send-domain-ready-notification`, `verify-domain-dns`, `send-corporate-invite`, `verify-delivery-identity`. Si la gouvernance est utilisée depuis un autre domaine que `ecomfy.cloud`, renseigner `EMAIL_LINK_ORIGINS`.

#### H5. `verify-delivery-identity` : tout utilisateur connecté peut s'auto-approuver
- **Où :** `supabase/functions/verify-delivery-identity/index.ts:40-69`.
- **Constat :** la fonction n'exige que `verify_jwt` (comportement par défaut). Elle écrit `verification_status` et `trust_badge_active` avec la clé de service, à partir de `companyId`, `driverId` et `verificationStatus` fournis par l'appelant.
- **Correctif :** réserver à un fondateur/admin (vérification de rôle dans la fonction), ou transformer en simple fonction d'envoi appelée après une décision prise côté serveur.
- **Statut (16/10/2026) : corrigé dans le code, non déployé, non testé sur Deno.**
  - `verify-delivery-identity` : JWT vérifié puis rôle `admin`, `founder` ou `co_founder` dans `user_roles` (401/403 sinon). `verificationStatus` limité à `approved`/`rejected`, `companyId` ou `driverId` obligatoire (un chauffeur remonte à sa structure). Le destinataire n'est plus lu dans le corps : c'est l'e-mail du compte propriétaire de la structure (`auth.admin.getUserById`), le nom vient de `manager_name`. `verified_by` est renseigné à l'approbation, une erreur de base renvoie 500 au lieu d'être ignorée.
  - **Faille voisine corrigée :** la politique « Owners can update own delivery company » n'a aucune restriction de colonnes et la politique d'INSERT accepte tout utilisateur connecté, donc un propriétaire pouvait écrire `verification_status = 'approved'` directement et contourner la fonction. Migration `20261016120000_h5_delivery_verification_guard.sql` : trigger `BEFORE INSERT OR UPDATE` qui, pour un non-admin, force une nouvelle demande en `pending_verification` sans badge, et n'autorise à l'UPDATE que la transition vers `pending_verification` (jamais depuis `approved`) ; badge, `verified_*`, `rejection_reason`, `admin_notes` sont immuables. La clé de service et le SQL direct ne sont pas bridés.
  - Client : `DeliveryOnboardingWizard` n'auto-approuve plus (les contrôles biométriques restent simulés côté navigateur, le dossier part toujours en attente) ; `DeliveryResubmissionPage` utilise `deliveryService.resubmitForVerification` ; `DeliveryAdminPage` n'envoie plus d'adresse fabriquée.
  - **Effet produit :** l'approbation automatique à l'inscription disparaît, toute validation passe par `/delivery-admin`.
  - Prérequis au déploiement : appliquer la migration, redéployer `verify-delivery-identity`, vérifier qu'au moins un compte admin/fondateur existe dans `user_roles`.
  - Reste ouvert : la route `/delivery-admin` n'a qu'un `ProtectedRoute` (sans contrôle de rôle côté interface, la protection effective est celle de la fonction et du trigger) ; la politique « Admins full access » s'appuie sur `profiles.role` (absent des types générés) et `email LIKE '%foundation%'`, à revoir ; le propriétaire peut encore modifier `rating_score`, `successful_deliveries_count`, `user_id`.

#### H6. Système d'affiliation (travail récent) : failles de politique RLS et de RPC
- **Où :** `20261005160000_ecomfy_affiliate_system.sql:148,172,220-270`.
- **Constats :**
  - La politique `INSERT` sur `affiliates` ne vérifie que `auth.uid() = user_id` : l'utilisateur peut insérer sa propre ligne avec `commission_rate = 99.99` (la colonne est `NUMERIC(5,2)`) et le statut de son choix.
  - `affiliate_referrals` : « Authenticated users can insert referral » avec `WITH CHECK (auth.uid() IS NOT NULL)`. Un utilisateur peut rattacher n'importe quel autre utilisateur à son code et toucher la commission sur ses futurs paiements.
  - `record_affiliate_referral(p_referred_user_id, ...)`, `get_or_create_affiliate(p_user_id)` et `process_affiliate_commission_for_payment(p_payment_id)` sont `SECURITY DEFINER` sans contrôle de l'appelant et sans `REVOKE`.
  - La commission de 20 % est calculée sur tous les paiements `completed` (crédits, activation boutique, commissions de plateforme), pas seulement les abonnements comme l'indique le libellé. Les paiements remboursés ne sont pas annulés.
- **Correctif :** `INSERT` sur `affiliates` uniquement via RPC avec taux imposé ; `referred_user_id = auth.uid()` en `WITH CHECK` ; `REVOKE` sur les RPC ; limiter aux types de paiement éligibles ; ajouter la gestion des remboursements.

#### H7. `geniuspay-webhook` : référence à une variable hors portée (probable bug bloquant) et traitement sans contrôle de l'événement
- **Où :** `supabase/functions/geniuspay-webhook/index.ts:202` (déclaration de `const isConfirmedPayment` dans un bloc `try`) et `:257` (utilisation en dehors de ce bloc).
- **Constat :** à l'exécution, l'accès à `isConfirmedPayment` hors de son bloc lève une `ReferenceError`. Elle est attrapée par le `catch` global, qui répond HTTP 200 « success: false ». Tout ce qui suit (activation de boutique, crédits, abonnements, commissions) ne s'exécute donc pas pour les paiements arrivant par ce webhook. Cela est cohérent avec la présence de `verify-payment` et `reconcile-pending-payments` comme « filets de sécurité ». **À confirmer sur les journaux de production.**
- **Deuxième problème :** une fois ce bug corrigé, les blocs d'attribution (lignes 270 et suivantes) s'exécutent quel que soit l'événement. Un `payment.failed` portant `credits_size` dans ses métadonnées créditerait l'utilisateur.
- **Correctif :** sortir `isConfirmedPayment` du bloc `try`, et ne déclencher les attributions que si l'événement est un succès avéré **et** que la comparaison avec le paiement local a réussi.

#### H8. En-têtes de sécurité et CSP non appliqués en production sur Vercel
- **Où :** `public/_headers` (format Netlify/Lovable) ; `vercel.json` (ne définit que le cache) ; `index.html:13` (CSP en `<meta>`).
- **Constat :** le projet se déploie sur Vercel (`vercel.json`, redirections `visuelpro.cloud`, `*.vercel.app`). Vercel ignore `_headers`. Les en-têtes HSTS, X-Frame-Options, Permissions-Policy, COOP et la CSP stricte décrits dans l'audit de juin ne sont donc **pas servis**. Reste la CSP en `<meta>`, qui est très permissive (`script-src ... https:`, `connect-src https: wss:`), et dont `frame-ancestors` est ignoré (non pris en charge dans une balise meta).
- **Correctif :** déplacer les en-têtes dans `vercel.json` (`headers`). Resserrer la CSP : retirer `unsafe-eval`, remplacer `https:` par des listes blanches, viser des nonces ou hachages.

#### H9. Fonctions IA sans quota effectif et sans authentification
- **Où :** `supabase/functions/_shared/ai-quota.ts` (la fonction `enforceAiQuota` renvoie toujours `allowed: true`, depuis le commit « bypass ai quota » `de9fb1e`) ; `correct-text/index.ts` (aucune authentification, `verify_jwt = false`, appelle OpenAI) ; `translate-ui/index.ts` (pas d'authentification, limiteur en mémoire par instance) ; `shop-ai-assistant-chat/index.ts` et `shop-chatbot/index.ts` (publics).
- **Impact :** consommation illimitée des clés OpenAI/Lovable/ElevenLabs par des tiers : coût direct. Les limites par IP (`check_rate_limit`) échouent en mode « fail-open » en cas d'erreur d'infrastructure.
- **Correctif :** exiger un utilisateur authentifié sur `correct-text`, réactiver ou remplacer `enforceAiQuota`, passer par la table `rate_limit_hits` côté serveur, plafonner la taille des entrées.

#### H10. Création libre de commandes : inflation de commissions et verrouillage de boutiques concurrentes
- **Où :** `20260608083344_...sql:14` (politique `INSERT` pour `anon`, uniquement conditionnée à la visibilité de la boutique) ; trigger `sync_shop_order_stats` (`20260701091528_...sql`) ; checkout côté client : `ProductView.tsx:681`, `ShopView.tsx:555,701`.
- **Constat :** n'importe qui peut insérer des commandes avec les montants, statuts et `payment_status` de son choix. Chaque insertion ajoute la commission à `commission_balance_due` ; au-delà de 12 000 FCFA, la boutique entre dans le cycle de blocage (restriction, verrouillage, suspension).
- **Scénario :** un concurrent crée quelques centaines de fausses commandes et fait bloquer la boutique de sa cible (déni de service métier). Les totaux sont aussi calculés dans le navigateur.
- **Correctif :** passer par une RPC ou une Edge Function de création de commande qui recalcule les prix côté serveur, limite le débit par IP, force les statuts initiaux, et valide le paiement avant de facturer une commission.

#### H11. `.env` versionné et deux projets Supabase mélangés
- **Où :** `.env` est suivi par Git malgré `.gitignore` (présent dans l'historique, notamment les commits `513f0cb`, `de9fb1e`, `3771de8`). `supabase/config.toml` : `project_id = "dqlbmtkaamjohgbcjwtw"` ; `.env` et `supabase/.temp/project-ref` : `yfggrceynzcwklbxhgix`. Des migrations codent en dur la clé `anon` et l'URL de l'**ancien** projet (`20260506110734_...sql:33`, `20260601094150_...sql:73`) et du nouveau (`20260813104500_...sql:9`).
- **Constat :** le fichier ne contient que des clés publiques (clé `anon`, clé VAPID publique) donc pas de fuite de secret serveur. Mais l'habitude est dangereuse, et les déclencheurs `pg_net` pointent potentiellement vers le mauvais projet.
- **Correctif :** `git rm --cached .env`, ajouter `.env.example`, aligner `config.toml`, remplacer les valeurs codées en dur dans les migrations par un paramètre de base ou un secret Vault.
- **Statut (2026-10-12) : corrigé dans le dépôt ; migration et secret Vault appliqués en production, push de commande vérifié ; health-monitor en 401 jusqu'au 14/10/2026, puis 200 (voir `docs/DEPLOIEMENT-PROD-2026-10.md` section 5).**
  - Rôles retenus : prod = `yfggrceynzcwklbxhgix`, dev = `xfpbpxncserliskrbaim`. `dqlbmtkaamjohgbcjwtw` (ancienne prod) et `izyxawbadxttpukpntmh` (ancien dev) sont abandonnés.
  - Fait : `.env` et `supabase/.temp/` retirés du suivi Git (`.gitignore` mis à jour), `.env.example` ajouté, `supabase/config.toml` sans ref de projet (`project_id = "ecomfy"`), `functions/mcp` déduit le ref de `SUPABASE_URL`, build Vite qui échoue si `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` manquent (au lieu du repli silencieux sur `dummy.supabase.co`), migration `20261011120000_edge_function_url_from_vault.sql` (trigger `notify_new_order_push` et cron `app-health-monitor` passent par `invoke_edge_function()`, qui lit le secret Vault `supabase_project_url`).
  - Volontairement laissé : les anciennes migrations (`20260506110734`, `20260601094150`, `20260813104500`) gardent leurs URL et clés `anon` publiques, car elles sont déjà appliquées. `.env` reste dans l'historique Git (clés publiques uniquement, pas de purge nécessaire).
  - **Non vérifié, à confirmer avant de clore H11 :**
    1. Variables d'environnement Vercel : `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_VAPID_PUBLIC_KEY` en Production (valeurs `yfgg…`) et en Preview (valeurs `xfpb…`). Sans elles, le prochain déploiement échoue (c'est le but du contrôle de build).
    2. Secret Vault `supabase_project_url` à créer dans chaque projet **avant** d'appliquer la migration (`select vault.create_secret('https://<ref>.supabase.co', 'supabase_project_url');`). Sans lui, les push de nouvelle commande et le health-monitor sont ignorés avec un `WARNING`.
    3. La migration n'a jamais été exécutée sur une base (relecture uniquement). À appliquer d'abord sur le dev, puis à vérifier : création de commande (appel de `send-push-notification`), présence du job `app-health-monitor`, disponibilité de `vault` et `pg_net` sur chaque projet.
    4. État réel du cron en prod : `select command from cron.job where jobname = 'app-health-monitor';`. S'il visait `dqlb…`, le monitoring de la prod ne tournait pas ; après la migration il redémarre et peut créer des entrées dans `app_incidents`.
    5. Secrets des Edge Functions (VAPID, etc.) présents dans chaque projet utilisé.
    6. Le contrôle de build ne vérifie pas que l'URL pointe vers le bon projet : une URL de dev en Production passerait.

### MOYEN

| ID | Constat | Emplacement | Correctif |
|---|---|---|---|
| M1 | Fonctions `SECURITY DEFINER` sans `SET search_path` (portefeuille, affiliation, gouvernance `is_authorized_corporate_member`). Risque de détournement de schéma et signalé par le linter Supabase. | `20260914190000_...sql`, `20261005160000_...sql`, `20260902140000_...sql:8` | Ajouter `SET search_path = public` partout |
| M2 | `gsc-oauth-flow` : sans authentification, sans paramètre `state` (CSRF OAuth), renvoie `accessToken` et `refreshToken` Google au navigateur. | `supabase/functions/gsc-oauth-flow/index.ts` | Exiger un utilisateur, ajouter `state`, stocker le jeton de rafraîchissement côté serveur |
| M3 | CORS `Access-Control-Allow-Origin: *` sur quasiment toutes les fonctions ; erreurs auth renvoyées avec HTTP 200 ; messages d'erreur internes (`error.message`) exposés. | toutes les fonctions | Origines autorisées explicites, bons codes HTTP, messages génériques |
| M4 | Références de paiement générées avec `Math.random().toString(36)` (8 caractères) : prévisibles et collisions possibles (échec 500 sur contrainte `UNIQUE`). Les commandes `ORD`/`BILL` utilisent aussi `random()`. | `ecomfy-pay-initiate/index.ts:67`, SQL `random()` | `crypto.randomUUID()` ou `gen_random_uuid()` |
| M5 | Limitation de débit « fail-open » (si l'infrastructure échoue, la requête passe) ou en mémoire par instance. | `shop-ai-assistant-tts`, `translate-ui` | Échec fermé ou limite en base, plus Cloudflare Turnstile sur les formulaires publics |
| M6 | Webhook Ecomfy Pay : si le crédit du portefeuille échoue, le paiement reste `SUCCEEDED` et le webhook est acquitté (jamais rejoué : argent perdu côté marchand). `ecomfy-pay-settlement` est exécutable sans authentification. Dans `geniuspay-webhook`, l'échec d'insertion d'idempotence (hors doublon) n'est pas bloquant. | `ecomfy-pay-webhook/index.ts`, `ecomfy-pay-settlement/index.ts`, `geniuspay-webhook/index.ts` | Transaction unique SQL, rejouabilité, `isAuthorizedCron` corrigé sur `settlement` |
| M7 | E-mails de fondateurs codés en dur dans le SQL (politiques RLS), les Edge Functions et l'interface : `djateulrich@gmail.com`, `regnis13@gmail.com`. Facteur de dépendance humaine, impossibilité de transférer les droits sans déploiement. Les gardes `ProtectedRoute`/`FounderRoute` sont purement visuelles (la vraie barrière doit être la RLS). `ProtectedRoute` ignore `requireActiveSubscription`. | `FounderRoute.tsx:21`, `AppSidebar.tsx:200`, migrations, `app-health-monitor/index.ts:11` | Un seul rôle `founder` en base, pas d'e-mail dans le code |
| M8 | Session Supabase stockée dans `localStorage` : toute XSS (voir C8) vole le jeton. Le client Supabase retombe silencieusement sur `https://dummy.supabase.co` si les variables manquent. | `src/integrations/supabase/client.ts` | Échec explicite si variables absentes ; réduire les surfaces XSS |
| M9 | `auth.admin.listUsers()` sans pagination (50 utilisateurs par défaut) pour retrouver un utilisateur par e-mail : l'attribution d'un rôle échoue au-delà. | `manage-founder-roles/index.ts:79,134` | `getUserByEmail`/requête sur `profiles` |
| M10 | **Dépendances** : `npm audit` = 29 vulnérabilités (2 critiques, 16 élevées, 10 moyennes, 1 faible). Critiques : `@capacitor/android` et `@capacitor/ios` 8.5.0. Élevées directes : `vite` ≤ 6.4.2 (serveur de dev), `tailwindcss` (via `braces`/`micromatch`), `firebase` (via `@firebase/firestore`, `@grpc/grpc-js`). `xlsx` est tiré d'un tarball CDN SheetJS (hors registre npm, pas de suivi des alertes). | `package.json` | `npm audit fix`, passer Capacitor ≥ 8.5.1, évaluer `xlsx` via npm, supprimer `firebase` complet si seul FCM est utilisé |
| M11 | **Migrations non reproductibles** : `is_founder_or_cofounder()` est utilisée par la migration d'affiliation mais définie nulle part dans `supabase/migrations/` ; la table `profiles` a des politiques créées dans des migrations absentes. La base réelle contient donc des objets non versionnés. | `20261005160000_...sql:146` | `supabase db dump`/`db pull` pour réconcilier, puis contrôle en CI |
| M12 | Buckets publics listables (déjà reconnu en juin) : `shop-images`, `showcase-*`, `generated-*`. | audit juin, Lot 3 | Politiques `SELECT` par préfixe ou URL signées |

### FAIBLE

- `send-push-notification` : appelable sans authentification avec un `order_id` quelconque (limité : il notifie les vrais propriétaires, mais peut les spammer). Ajouter un secret de webhook de base de données.
- `test-openai-image` est déployée comme fonction de production (génère des appels OpenAI payants). À retirer.
- Reste de l'ancien connecteur Lygos : `payment-callback/index.ts` (redirection vers `visuelpro.cloud`, secret `LYGOS_WEBHOOK_SECRET`). Code mort ou à documenter.
- Mélange de versions de `@supabase/supabase-js` dans les fonctions (2.38.4, 2.39.3, 2.39.8, 2.45.0, 2.45.4, `@2`), imports `esm.sh` et `deno.land/std@0.168.0` (ancien).
- `process-payment` renvoie HTTP 200 pour les erreurs d'authentification et de validation.
- Clé Firebase (`src/lib/firebase.ts:5`) : publique par conception, mais penser à la restreindre par domaine dans la console Google.

---

## 5. Constats sur la qualité du code

### 5.1 Typage et robustesse
- `tsconfig.app.json` : `strict: false`, `noImplicitAny: false`, `noUnusedLocals: false`. Le build (`vite build`) ne vérifie pas les types. **842 `any`**, **67 `@ts-ignore`/`@ts-nocheck`** (notamment des fonctions entières comme `process-payment`, `verify-payment`).
- `src/integrations/supabase/types.ts` est périmé : il ne contient ni `ecomfy_payments` ni `affiliates`, d'où les `as any` partout (par exemple `supabase.rpc("confirm_invoice_payment" as any, ...)`). Les erreurs de colonnes ne sont donc pas détectées à la compilation.
- ESLint : règle `no-unused-vars` désactivée ; 13 `eslint-disable`.

### 5.2 Tests et intégration continue
- **Aucun exécuteur de test** : `vitest` n'est pas dans `package.json` et il n'existe pas de script `test`. Les trois fichiers de test (`src/lib/studio/__tests__/commandEngine.test.ts`, `src/test/affiliateSystemTest.test.ts`, `src/test/profileCompletionTest.test.ts`) ne peuvent pas être lancés tels quels.
- Aucune CI (pas de `.github/`), aucun hook de pré-commit. Aucun test sur les flux critiques : paiement, webhooks, RLS, retrait.
- Pas de test de non-régression des politiques RLS, alors que 229 migrations les modifient.

### 5.3 Structure et maintenabilité
- Fichiers monolithiques (≥ 1 000 lignes) : `ProductEditor`, `ProductView`, `Generator`, `ShopView`, `FounderDashboard`, `ShopEditor`, `connectus.service`, `ShopThemeSettings`, `ShopSettings`, `SectionControls`, `SeoIntelligencePage`. Difficiles à tester et à relire.
- Code dupliqué entre `src/lib/notificationFormat.ts` et `send-push-notification` (« keep both in sync » en commentaire), et entre les modèles d'e-mails HTML en ligne.
- `App.tsx` : routes redondantes (`/generator` et `/accept-shop-invite` déclarées deux fois), liste `PUBLIC_PAGES` à entretenir à la main, plus un fichier `App.tsx.orig`.
- Deux bibliothèques de `<head>` (`react-helmet` dans 7 fichiers, `react-helmet-async` dans 3), deux plugins React pour Vite (`plugin-react` et `plugin-react-swc`), `@rollup/wasm-node` + paquet natif Darwin en optionnel.
- Internationalisation : seulement ≈ 108 clés par langue pour une application de 74 pages. L'essentiel du texte est en français codé en dur, complété par une traduction automatique du DOM (`autoTranslateDOM`, appel à `translate-ui`). Fragile et coûteux.
- Nommage : **130 occurrences** de « VisualPro/VisuelPro/Juggle » dans 41 fichiers (`appId: cloud.visuelpro.app`, contact `contact@visualpro.com` dans le Web Push, en-tête SQL, textes d'e-mails), alors que la marque est désormais Ecomfy.

### 5.4 Défauts fonctionnels repérés
- `ecomfy-pay-initiate` : sans clés GeniusPay, la fonction répond `success: true` avec `checkout_url: null` (mode « démo » en production, le client croit à un paiement lancé). `error_url` pointe vers `/shop/${shop_id}` alors que la route attend un `slug`.
- `process-payment` : pour `shop_subscription`, si la boutique n'appartient pas à l'utilisateur, `targetShopId` devient silencieusement `undefined` et le paiement continue.
- Affiliation : la période de secours est `'2026-Q4'` codée en dur ; la validation de la commission dépend d'un appel client « direct DB fallback » dans `affiliateService.recordReferral` qui contourne la RPC.
- `revoke` (gestion des fondateurs) supprime **tous** les rôles de l'utilisateur, y compris le rôle `user` de base.
- Les politiques anonymes `INSERT` sur `shop_visits` et `abandoned_carts` ne sont pas limitées en débit (pollution de statistiques).

### 5.5 Hygiène du dépôt
- À la racine : `scratch.js/.cjs/.ts`, `scratch2.js`, `test-*.js/.ts/.cjs/.mjs`, `check_db.js`, `query_videos.mjs`, `patch_*.mjs`, `fix_*.patch`, `extract-bag.py`, `trim-favicon.py`. Ces scripts lisent `.env` et interrogent la base. Les supprimer ou les déplacer dans `scripts/`.
- Suivis par Git alors qu'ils ne devraient pas l'être : `.env`, `dev-dist/`, `supabase/.temp/` (10 fichiers), `src/App.tsx.orig`.
- **Trois lockfiles** (`package-lock.json`, `bun.lock`, `bun.lockb`) : risque de versions divergentes entre environnements.
- Documentation obsolète ou contradictoire : `README.md` (texte Lovable générique), `Gemini.md` (affirme que le paiement passe par CinetPay et Stripe alors que le code utilise GeniusPay), `SECURITY-AUDIT-2026-06.md` (plusieurs points listés comme « corrigés » ne le sont pas en production, voir H8).
- `.vercelignore` et nombreux documents `.md` de design sans lien avec le code actuel.

---

## 6. Points positifs

- Webhook `geniuspay-webhook` : signature HMAC, comparaison à temps constant, fenêtre anti-rejeu, idempotence par table d'événements, contrôles de cohérence montant/devise/utilisateur.
- `process-payment` : JWT vérifié, `user_id` comparé à l'utilisateur authentifié, validation Zod, limitation de débit par utilisateur, vérification de propriété de boutique pour l'activation.
- Colonnes sensibles de `profiles` protégées (`REVOKE UPDATE` puis `GRANT UPDATE` sur 5 colonnes), `subscriptions` en écriture réservée au serveur.
- `apply_shop_activation` exige un paiement `completed` correspondant avant d'activer (la réservation à `service_role` était incomplète, voir C2).
- DOMPurify sur les descriptions de produit, avis et contenus de cours, avec listes de balises autorisées. `share-product` et les e-mails de contact/réservation échappent correctement leurs variables et prennent le destinataire en base.
- Séparation des vues publiques (`shops_public`, `showcase_sites_public`, `product_reviews_public`) pour ne pas exposer `user_id` ni le code d'analytics.
- Gestion d'erreurs côté client avec **masquage des secrets** (`src/lib/error-handler.ts`) et identifiants de corrélation.
- Retraits : verrouillage de ligne (`FOR UPDATE`), contraintes `CHECK` sur les soldes, grand livre immuable : l'architecture comptable est saine, c'est le contrôle d'accès autour qui manque.
- PKCE activé, chargement paresseux des pages avec reprise (`lazyWithRetry`), PWA, `security.txt`.

---

## 7. Plan d'action recommandé

### Immédiat (24 à 48 h)
1. **Script SQL de durcissement** *(partiellement fait : `apply_commission_payment`, `apply_shop_subscription` et `confirm_invoice_payment`, voir le hotfix `20261012120000` puis la migration `20261012130000` ; `credit_merchant_wallet_pending`, `process_wallet_settlements`, `request_wallet_withdrawal_atomic`, `get_or_create_merchant_wallet` et `save_merchant_payout_config`, voir C1 et l'annexe D ; `apply_shop_activation`, `prepare_shop_activation_payment` et 16 fonctions serveur, voir les migrations `20261012140000` et `20261012150000` et l'annexe F ; reste à faire : le groupe B de l'annexe F.3)* : `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` sur `credit_merchant_wallet_pending`, `process_wallet_settlements`, `request_wallet_withdrawal_atomic`, `confirm_invoice_payment`, `apply_commission_payment`, `apply_shop_subscription`, `evaluate_merchant_kyc_security`, `record_affiliate_referral`, `get_or_create_affiliate`, `process_affiliate_commission_for_payment`, `check_and_trigger_billing_threshold`. Restreindre `get_shop_orders_secure` aux propriétaires/collaborateurs. Ajouter un `REVOKE` par défaut pour les prochaines fonctions (`ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`).
2. **`ecomfy-pay-webhook`** : signature + rappel API fournisseur.
3. **`manage-founder-roles`** : supprimer la logique basée sur l'e-mail et valider les rôles.
4. **`tracking.ts`** : n'accepter que `G-XXXX`.
5. **Gouvernance** : corriger les 8 tables ouvertes. *(Fait pour les 14 tables `corporate_*` par le hotfix `20261012120000`, à déployer en production ; restent `corporate_invitations` et `strict_multitenant_privacy`.)*
6. **Audit des données déjà exposées** : consulter les journaux Supabase pour détecter des appels anonymes à `get_shop_orders_secure`, `confirm_invoice_payment`, `apply_commission_payment`, des écritures suspectes dans `user_roles`, des wallets créditées sans paiement.

### Court terme (1 à 2 semaines)
7. Recalcul serveur des prix dans `process-payment` et `ecomfy-pay-initiate`, création de commande par RPC.
8. Corriger `geniuspay-webhook` (portée de `isConfirmedPayment`, contrôle d'événement).
9. Corriger `isAuthorizedCron`.
10. Bucket privé pour la KYC, migration des fichiers, vraie vérification d'identité.
11. En-têtes de sécurité dans `vercel.json`, CSP resserrée.
12. Authentifier et escaper les fonctions d'e-mail (H4), `verify-delivery-identity` (H5, corrigé dans le code).
13. Réactiver des quotas IA et authentifier `correct-text`.
14. Retirer `.env` de Git, aligner les identifiants de projet Supabase.

### Moyen terme (1 à 2 mois)
15. Réconcilier les migrations avec la base réelle (`supabase db pull`), ajouter `SET search_path` partout.
16. Mettre en place **vitest**, une CI (lint + typecheck + tests + `npm audit`), et des tests SQL de RLS (pgTAP) pour les flux d'argent.
17. Activer `strict` progressivement (par dossier), régénérer `types.ts`, résorber les `any`.
18. Découper les fichiers de plus de 1 000 lignes.
19. Mettre à jour les dépendances (Capacitor, Vite, Tailwind, Firebase) ; nettoyer les doublons (`react-helmet`, plugin React, lockfiles).
20. Nettoyage du dépôt et de la documentation, harmonisation de la marque, terminer la migration i18n (clés plutôt que texte codé).

---

## Annexe A. Matrice des Edge Functions exposées sans JWT

`verify_jwt = false` dans `supabase/config.toml` ou absence de contrôle dans le code. Colonne « Auth interne » : la fonction vérifie-t-elle elle-même l'appelant ?

| Fonction | Auth interne | Observation |
|---|---|---|
| `ecomfy-pay-webhook` | Signature HMAC (`GENIUSPAY_WEBHOOK_SECRET`) | C5 corrigé dans le code, non déployé |
| `ecomfy-pay-initiate` | Non | Public par nature (checkout), mais montants libres (C6) |
| `ecomfy-pay-settlement` | Non | Déclenchable par tous (M6) |
| `geniuspay-webhook` | Signature HMAC | Bug de portée (H7) |
| `payment-callback` | Signature HMAC (Lygos) | Héritage, `GET` sans effet de base : correct |
| `process-payment`, `verify-payment` | JWT utilisateur | Montants client (C6) |
| `send-subscription-email`, `send-domain-ready-notification` | Clé de service (`isAuthorizedCron`) | H4 corrigé dans le code, non déployé |
| `send-corporate-invite` | JWT + rôle fondateur (`requireFounder`) | H4 corrigé dans le code, non déployé |
| `verify-delivery-identity` | JWT + rôle `admin`/`founder`/`co_founder` | H5 corrigé dans le code, non déployé |
| `send-push-notification` | Non | Faible |
| `correct-text` | **Non** | H9 |
| `translate-ui`, `shop-ai-assistant-chat`, `shop-ai-assistant-tts`, `shop-chatbot`, `showcase-chat` | Non (limites IP) | H9 / M5 |
| `gsc-oauth-flow` | Non | M2 |
| `track-conversion`, `track-shop-visit`, `share-product`, `dynamic-sitemap`, `get-vapid-key` | Non | Public par nature ; vérifier la limitation de débit |
| `process-queue`, `reconcile-pending-payments`, `send-24h-reminder`, `send-weekly-finance-summary`, `check-ad-token-expiry`, `app-health-monitor`, `seo-auto-index` | `isAuthorizedCron` | Contournable (H3) |
| `manage-founder-roles`, `app-remediation` | JWT + rôle | `manage-founder-roles` contournable (C7) ; `app-remediation` correct (rôles `founder`/`co_founder` en base) |
| `generate-*`, `extract-brand`, `create-video-from-image`, `translate-product` | JWT + `getUser` | OK, mais quota IA désactivé (H9) |
| `mcp` | JWT utilisateur + RLS | OK (client avec le jeton de l'utilisateur) |

## Annexe B. Requêtes de vérification sur la base réelle

À exécuter dans l'éditeur SQL Supabase pour confirmer les constats C1 à C4, H2, H6.

```sql
-- Fonctions du schéma public exécutables par anon ou PUBLIC
select routine_name, grantee
from information_schema.routine_privileges
where routine_schema = 'public'
  and grantee in ('anon', 'PUBLIC', 'authenticated')
  and routine_name in (
    'credit_merchant_wallet_pending','process_wallet_settlements',
    'request_wallet_withdrawal_atomic','confirm_invoice_payment',
    'apply_commission_payment','apply_shop_subscription',
    'evaluate_merchant_kyc_security','get_shop_orders_secure',
    'record_affiliate_referral','get_or_create_affiliate',
    'process_affiliate_commission_for_payment',
    'apply_shop_activation','prepare_shop_activation_payment'
  )
order by routine_name, grantee;

-- Politiques permissives restantes
select schemaname, tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and (qual = 'true' or with_check = 'true')
  and tablename like 'corporate_%';

-- La fonction is_founder_or_cofounder existe-t-elle ?
select proname from pg_proc where proname = 'is_founder_or_cofounder';

-- Rôles privilégiés attribués : à comparer à la liste attendue
select ur.role, p.email, ur.created_at
from user_roles ur join profiles p on p.id = ur.user_id
where ur.role in ('founder','co_founder','admin','shareholder')
order by ur.created_at desc;

-- Portefeuilles créditées sans paiement réussi correspondant
select w.merchant_id, w.total_received,
       coalesce((select sum(net_merchant_amount) from ecomfy_payments p
                 where p.merchant_id = w.merchant_id and p.status = 'SUCCEEDED'), 0) as paiements_reussis
from wallets w
where w.total_received > coalesce((select sum(net_merchant_amount) from ecomfy_payments p
                                   where p.merchant_id = w.merchant_id and p.status = 'SUCCEEDED'), 0);
```

### Résultats observés le 12 octobre 2026

| Requête | Dev (copie de la production) | Production |
|---|---|---|
| 1. Droits `EXECUTE` | `apply_commission_payment` et `apply_shop_subscription` ouvertes à `PUBLIC`, `anon`, `authenticated` ; les autres fonctions de la liste n'existent pas | `apply_commission_payment` et `apply_shop_subscription` ouvertes à `PUBLIC` et `anon` |
| 2. Politiques permissives | 28 politiques `USING (true)` sur les 14 tables `corporate_*` (lecture et écriture, rôle `authenticated`) | non exécutée |
| 3. `is_founder_or_cofounder` | absente | non exécutée |
| 4. Rôles privilégiés | 1 `founder`, 1 `co_founder` | non exécutée |
| 5. Portefeuilles sans paiement | impossible : la table `wallets` n'existe pas | non exécutée |
| `max(version)` de `schema_migrations` | `20260901020000` | `20260901020000` |

Après le hotfix, sur la dev : plus de droit `anon`/`PUBLIC` sur les deux fonctions, et 2 politiques permissives restantes (insertion seule dans `corporate_audit_logs` et `corporate_document_acceptances`, voulu pour l'onboarding).

## Annexe C. Modèle de correctif pour les fonctions financières

```sql
-- Exemple pour une fonction réservée au serveur
REVOKE ALL ON FUNCTION public.credit_merchant_wallet_pending(uuid, uuid, numeric, numeric, text, int, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_merchant_wallet_pending(uuid, uuid, numeric, numeric, text, int, text)
  TO service_role;

-- Et pour qu'aucune fonction future ne soit ouverte par défaut
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Retrait : utiliser l'identité de la session, pas un paramètre
-- dans request_wallet_withdrawal_atomic : v_merchant := auth.uid(); (et supprimer p_merchant_id)
-- (appliqué dans 20260914190000_ecomfy_pay_system.sql, voir l'annexe D)
```

```ts
// Vérification de signature à reprendre dans ecomfy-pay-webhook (même schéma que geniuspay-webhook)
const rawBody = await req.text();
const ts = req.headers.get("x-webhook-timestamp") ?? "";
const sig = req.headers.get("x-webhook-signature") ?? "";
if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return ack({ success: false });
const expected = await computeSignature(Deno.env.get("GENIUSPAY_WEBHOOK_SECRET")!, `${ts}.${rawBody}`);
if (!timingSafeEqual(expected, sig)) return ack({ success: false });
```

## Annexe D. Tests du correctif C1 (portefeuille Ecomfy Pay)

**Date :** 12 octobre 2026. **Environnement :** base Postgres locale jetable (image `public.ecr.aws/supabase/postgres:17.6.1.155`, rôles `anon`, `authenticated`, `service_role` réels), détruite après les tests. La base de dev partagée n'a pas été utilisée. Les tables `shops`, `products` et `orders` sont remplacées par des tables minimales (seules leurs clés servent).

**Méthode :** la migration `20260914190000_ecomfy_pay_system.sql` corrigée est appliquée en entier, puis chaque appel est fait sous `SET LOCAL ROLE`, avec l'identité posée par `request.jwt.claim.sub` (c'est ce que lit `auth.uid()` dans cette image). Marchand A : KYC `VERIFIED`, 10 000 disponibles. Marchand B : sans KYC, 7 000 disponibles.

Droits d'exécution constatés après la migration :

| Fonction | Rôles autorisés |
|---|---|
| `get_or_create_merchant_wallet(uuid)` | `service_role` |
| `credit_merchant_wallet_pending(...)` | `service_role` |
| `process_wallet_settlements()` | `service_role` |
| `request_wallet_withdrawal_atomic(numeric, text, text, text, text, text)` | `authenticated`, `service_role` |

| # | Test | Attendu | Observé |
|---|---|---|---|
| 1 | `anon` : `credit_merchant_wallet_pending` | refusé | `permission denied` |
| 2 | `authenticated` : `credit_merchant_wallet_pending` | refusé | `permission denied` |
| 3 | `authenticated` : `process_wallet_settlements` | refusé | `permission denied` |
| 4 | `authenticated` : `get_or_create_merchant_wallet` | refusé | `permission denied` |
| 5 | `anon` : retrait | refusé | `permission denied` |
| 6 | `authenticated` sans identité : retrait | refusé | `forbidden` |
| 7 | A retire 4 000 | succès | succès, reste 6 000 |
| 8 | A retire -500 | refusé | « Montant de retrait invalide » |
| 9 | A retire 999 999 | refusé | « Solde disponible insuffisant » |
| 10 | B (sans KYC) retire 1 000 | refusé | « KYC doit être vérifié » |
| 11 | `service_role` : crédit d'un paiement | succès | succès, 900 en attente |
| 12 | `service_role` : retrait (pas de `auth.uid()`) | refusé | `forbidden` |
| 13 | `service_role` : `process_wallet_settlements` | s'exécute | succès, 0 règlement échu |

État final conforme : A à 6 000 disponibles (4 000 retirés, une seule demande `REQUESTED` à son nom) ; B inchangé (7 000 disponibles, 900 en attente). Un marchand ne peut ni créditer, ni retirer sur le portefeuille d'un autre.

**Non couvert par ces tests :**
- l'Edge Function `ecomfy-pay-withdraw` (non compilée, non exécutée) : à tester avec un vrai JWT de marchand, `SUPABASE_ANON_KEY` étant injectée par Supabase ;
- le chemin complet webhook → `credit_merchant_wallet_pending` ;
- le déploiement sur la base de dev réelle.

**Reste ouvert, lié à C1 :**
- un marchand authentifié peut appeler `request_wallet_withdrawal_atomic` directement, sans passer par l'Edge Function : la demande reste `REQUESTED` et ne touche que son solde, mais l'envoi du paiement n'est pas déclenché. La vraie barrière est le KYC, rendu non contournable par le correctif C4 (statut écrit uniquement par revue manuelle) et doublé d'un interrupteur global, retraits suspendus par défaut ;
- `ecomfy-pay-settlement` n'authentifie pas son appelant : n'importe qui peut déclencher `process_wallet_settlements` (sans gain direct, mais à protéger par un secret ou un cron interne).

## Annexe E. Tests du correctif C3 (`get_shop_orders_secure`)

**Date :** 12 octobre 2026. **Environnement :** base Postgres locale jetable (même image que l'annexe D, rôles réels), détruite après les tests. Script rejouable : [`supabase/tests/c3_get_shop_orders_secure.sql`](supabase/tests/c3_get_shop_orders_secure.sql). La fonction testée est extraite telle quelle de la migration `20260909100000` ; les tables (`shops`, `shop_collaborators`, `user_roles`, `orders`) et les helpers (`has_role`, `is_shop_owner`, `is_shop_collaborator`) sont des copies minimales des définitions réelles.

**Jeu de données :** boutique A (active, 2 commandes), boutique B (active, 1 commande), boutique R (`STORE_RESTRICTED`, 1 commande). Acteurs : propriétaires de A, B et R, collaborateur actif et collaborateur invité (`pending`) de A, `founder`, `co_founder`, tiers sans lien.

| # | Cas | Attendu | Observé |
|---|---|---|---|
| 1, 14 | `anon` (boutique A, boutique R) | refusé | `permission denied` |
| 2 | `authenticated` sans identité | refusé | `forbidden` |
| 3, 13 | tiers sur A, sur R | refusé | `forbidden` |
| 4, 6 | propriétaire de B lit A, propriétaire de A lit B | refusé | `forbidden` |
| 5 | propriétaire de A lit A | 2 lignes en clair | 2 lignes, noms en clair, `is_restricted = false` |
| 7 | collaborateur actif lit A | 2 lignes en clair | idem |
| 8 | collaborateur invité (`pending`) lit A | refusé | `forbidden` |
| 9 | collaborateur de A lit B | refusé | `forbidden` |
| 10, 11 | `founder` lit A, `co_founder` lit B | autorisé | lignes en clair |
| 12 | propriétaire de la boutique restreinte | lignes masquées | 1 ligne, `is_restricted = true`, aucun nom en clair |
| 15 | `service_role` (pas de `auth.uid()`) | refusé | `forbidden` |
| 16, 17 | boutique inexistante, UUID `NULL` | refusé | `forbidden` |
| 18, 19 | droit `EXECUTE` | `anon` non, `authenticated` oui | conforme |

**Résultat : 19 réussis, 0 échec.**

**Contre-épreuve :** le même script rejoué sur l'ancienne fonction (version de `HEAD` avant correctif) donne 6 réussis et 13 échecs : `anon`, un tiers ou un autre marchand lisent les commandes de A, y compris les noms en clair. Les tests détectent donc bien la faille.

**Non couvert :** application de la chaîne complète des migrations (seule la fonction et ses dépendances directes sont simulées) ; déploiement sur la base de dev. Comme la migration `20260909100000` crée aussi `confirm_invoice_payment` (C2, à réserver à `service_role` par `20261012130000`), elle ne doit toujours pas être déployée avant la correction de ce dernier.

## Annexe F. Tests de la réservation à `service_role` (C2)

**Date :** 12 octobre 2026. **Environnement :** base Postgres locale jetable (même image que l'annexe D), détruite après les tests. Les trois fonctions sont remplacées par des fonctions de même signature qui renvoient `{"success": true}` : le test porte sur les droits d'exécution, pas sur la logique métier, inchangée. Droits initiaux : `anon`, `authenticated` et `service_role` (cas de la production).

| Test | Attendu | Observé |
|---|---|---|
| Droits avant migration | tous les rôles | `anon`, `authenticated`, `service_role` sur les trois fonctions |
| Droits après migration | `service_role` seul | `service_role` seul sur les trois fonctions |
| Migration exécutée deux fois | idempotente | OK |
| Migration sans `confirm_invoice_payment` (cas production) | pas d'erreur | OK |
| `anon` : `apply_commission_payment` | refusé | `permission denied` |
| `authenticated` : `apply_commission_payment` | refusé | `permission denied` |
| `authenticated` : `apply_shop_subscription` | refusé | `permission denied` |
| `anon` : `confirm_invoice_payment` | refusé | `permission denied` |
| `service_role` : les trois | succès | succès |

**Non couvert :**
- l'Edge Function `founder-record-commission-payment` (non exécutée, `deno` absent du poste) : à tester avec un JWT de fondateur (succès), un JWT de marchand (attendu : 403) et sans JWT (attendu : 401) ;
- les quatre écrans fondateur dans l'application ;
- `tsc` : aucune erreur sur les fichiers modifiés ; le reste du projet a des erreurs de typage préexistantes.

### F.2 Réservation de `apply_shop_activation` et `prepare_shop_activation_payment`

Même environnement que ci-dessus. Les deux fonctions sont recréées avec leur signature réelle, puis passées par exactement les instructions des migrations d'origine (`REVOKE ALL ... FROM PUBLIC; GRANT EXECUTE ... TO service_role`).

| Test | Attendu | Observé |
|---|---|---|
| Droits après les migrations d'origine | `service_role` seul, si le `REVOKE` suffisait | `anon`, `authenticated`, `service_role` : **le `REVOKE ... FROM PUBLIC` ne retire pas `anon` ni `authenticated`** |
| Droits après la migration `20261012140000` | `service_role` seul | `service_role` seul sur les deux fonctions |
| Migration exécutée deux fois | idempotente | OK |
| Migration sans les fonctions | pas d'erreur | OK |
| `anon` : `apply_shop_activation` | refusé | `permission denied` |
| `authenticated` : `apply_shop_activation` | refusé | `permission denied` |
| `authenticated` : `prepare_shop_activation_payment` | refusé | `permission denied` |
| `service_role` : les deux | succès | succès |

**Non couvert :** l'Edge Function `founder-activate-shop` (non exécutée, `deno` absent) : à tester avec un JWT de fondateur (activation effective, ligne `payments` `manual` créée), un JWT de marchand (403), sans JWT (401), et sur une boutique déjà activée (`already_activated`). Les appelants existants (`process-payment`, `verify-payment`, `payment-callback`, `geniuspay-webhook`, `reconcile-pending-payments`) utilisent `service_role` et ne changent pas.

**À vérifier sur toute autre fonction `SECURITY DEFINER` :** la même erreur (`REVOKE ... FROM PUBLIC` seul) est probablement répandue. Lister les fonctions de `public` exécutables par `anon` ou `authenticated` (requête 1 de l'annexe B, sans filtre sur les noms) et traiter les écarts.

### F.3 Analyse systématique des fonctions `SECURITY DEFINER` (toutes les migrations)

**Méthode :** script d'analyse statique de `supabase/migrations/*.sql` qui rejoue dans l'ordre les `CREATE FUNCTION`, `REVOKE` et `GRANT` avec le modèle Supabase (une fonction de `public` démarre exécutable par `PUBLIC`, `anon`, `authenticated`, `service_role`), puis croise avec les appelants (navigateur, Edge Functions, SQL). Résultat à confirmer sur la base de dev avec la requête 1 de l'annexe B sans filtre sur les noms : l'analyse est heuristique (détection de garde par motifs, `GRANT` hors migrations ignorés).

**Résultat :** 115 fonctions, 108 `SECURITY DEFINER` dont 30 fonctions de trigger (non appelables en RPC). **68 fonctions restent appelables par `anon` ou `authenticated`**, dont 31 écrivent des données.

| Groupe | Fonctions | Traitement |
|---|---|---|
| A. Serveur uniquement : aucun appelant navigateur, Edge Functions en `service_role` ou cron | `read_email_batch`, `enqueue_email`, `delete_email`, `move_to_dlq` (lecture et suppression des e-mails en attente par n'importe qui), `cleanup_expired_trash`, `cleanup_old_generated_media`, `cleanup_old_image_cache`, `expire_stale_pending_payments`, `expire_subscriptions`, `enforce_shop_payment_state`, `check_rate_limit`, `record_app_incident`, `increment_promo_usage`, `get_next_queue_item`, `count_processing_generations`, `get_or_create_affiliate` | **Corrigé** : migration `20261012150000` (toutes les surcharges, idempotente) |
| B. Appelées par le navigateur, sans garde interne : à corriger avec l'écran concerné | `record_affiliate_referral`, `process_affiliate_commission_for_payment` (aussi appelée par `verify-payment`), `check_and_trigger_billing_threshold`, `enforce_shop_billing_deadlines`, `enforce_shop_payment_state_for`, `process_referral_signup` | **Non corrigé.** Migrations affiliation, Ecomfy Pay et facturation par seuil non déployées : à traiter avant leur déploiement, comme C1 (identité par `auth.uid()` ou passage par une Edge Function) |
| C. Publiques par conception (storefront, communauté, certificats) | `get_public_shop_by_slug`, `get_public_shop_by_custom_domain`, `get_public_product_page`, `get_shop_social_proof_orders`, `get_top_sellers`, `get_community_profiles`, `search_community_profiles`, `verify_certificate_by_number`, `validate_promo_code`, `generate_order_number`, `upsert_abandoned_cart`, `mark_abandoned_cart_converted`, `get_invite_email_by_token` | À conserver ; vérifier la limitation de débit et les données renvoyées (`get_invite_email_by_token` renvoie un e-mail pour un jeton) |
| D. Aides de RLS (évaluées avec les droits de l'appelant, `EXECUTE` requis) | `has_role`, `is_shop_owner`, `is_shop_collaborator`, `has_shop_role`, `is_shop_publicly_visible`, `is_shop_subscription_active`, `is_founder_or_master`, `can_manage_shop`, `is_shop_owner_or_collaborator`, `is_authorized_corporate_member`, `is_corporate_*` | À conserver. Effet de bord connu : elles permettent de tester l'appartenance d'un identifiant arbitraire à une boutique ou un rôle (fuite d'information mineure) |
| E. Avec garde interne, à relire | `accept_shop_invitation`, `consume_ai_credit`, `founder_grant_extra_deadline`, `founder_reset_shop_payment`, `get_my_subscription_status`, `increment_shop_gif_count`, `mark_affiliate_payout_paid`, `push_order_to_delivery_provider`, `record_stock_movement`, `get_ai_quota`, `get_locked_orders_summary` | La garde est détectée par motif, pas vérifiée. À relire une par une (en priorité `mark_affiliate_payout_paid`, `record_stock_movement`, `consume_ai_credit`) |
| F. Autres : générateurs sans état sensible | `generate_api_key`, `generate_certificate_number`, `generate_referral_code`, `generate_domain_verification_code`, `generate_shop_domain_verification_code` | Sans conséquence ; `generate_certificate_number` est appelée avec le JWT de l'utilisateur dans `generate-certificate` (ne pas la réserver à `service_role` sans changer cette Edge Function) |

**Tests du groupe A** (base locale jetable, fonctions de même signature créées avec `REVOKE ... FROM PUBLIC` seul, comme dans les migrations d'origine) :

| Test | Attendu | Observé |
|---|---|---|
| Droits avant migration | `anon`, `authenticated`, `service_role` | confirmé sur l'échantillon |
| Droits après migration | `service_role` seul | `service_role` seul ; 0 fonction du lot encore exposée |
| Migration exécutée deux fois | idempotente | OK |
| `anon` : `read_email_batch` | refusé | `permission denied` |
| `authenticated` : `enqueue_email`, `check_rate_limit`, `get_or_create_affiliate` | refusé | `permission denied` |
| `service_role` : `read_email_batch` | succès | succès |
| `anon` : `validate_promo_code` (hors lot) | reste public | succès |

**Tests de `save_merchant_payout_config`** :

| Test | Attendu | Observé |
|---|---|---|
| Marchand A modifie son numéro | succès, B inchangé | A = `0799999999`, B = `0700000002` |
| Appel à l'ancienne signature avec `p_merchant_id` = B | impossible | `function ... does not exist` |
| `anon` | refusé | `permission denied` |
| `authenticated` sans identité | refusé | `forbidden` |

**Vérifications avant déploiement de `20261012150000` :** les Edge Functions appelantes utilisent bien `SUPABASE_SERVICE_ROLE_KEY` (`process-payment`, `send-booking-notification`, `send-contact-notification`, `geniuspay-webhook`, `payment-callback`, `app-health-monitor`, `process-queue`, `process-email-queue`, `send-transactional-email`), vérifié dans le code. Les tâches `pg_cron` s'exécutent avec le rôle `postgres`, non concerné. Si une tâche planifiée appelle ces fonctions par l'API REST avec la clé `anon`, elle échouera : surveiller les erreurs `42501` après déploiement.

## Annexe F. Correctif C7 (`manage-founder-roles`) et tests

**Date :** 12 octobre 2026. **Code :** `supabase/functions/manage-founder-roles/handler.ts` (logique) et `index.ts` (serveur Deno, 10 lignes). **Tests :** [`supabase/tests/manage-founder-roles.test.ts`](supabase/tests/manage-founder-roles.test.ts), client Supabase simulé en mémoire, lancés avec `node --experimental-strip-types --test supabase/tests/manage-founder-roles.test.ts`.

**Règles appliquées**

| Action | Qui | Détail |
|---|---|---|
| Toute action | rôle `founder` ou `co_founder` dans `user_roles` | plus aucune décision sur l'e-mail ; `shareholder` et `admin` ne passent plus |
| `list` | `founder`, `co_founder` | liste `founder`, `co_founder`, `shareholder`, `admin` ; `is_main_founder` = rôle `founder` ; plus d'entrée synthétique « main-founder-id » |
| `add` | `founder` uniquement | rôle dans la liste blanche `co_founder`, `shareholder`, `admin` ; `founder` n'est jamais attribuable ; e-mail cherché sur toutes les pages de `listUsers` (auparavant seule la première page de 50 comptes) |
| `revoke` | `founder` uniquement | supprime le couple (utilisateur, rôle) demandé, rôle de la liste blanche, identifiant au format UUID ; le rôle `founder` n'est pas révocable |

Autres changements : message d'erreur 500 générique (le message interne n'est plus renvoyé), corps JSON invalide → 400. Interface (`FounderManager.tsx`) : l'appel `revoke` envoie le rôle, le formulaire d'invitation et le bouton de révocation n'apparaissent que si le serveur répond `isMainFounder`, plus d'e-mail ni de nom en dur, plus de faux « fondateur principal » affiché en cas d'erreur de chargement.

**Résultat des tests : 14 réussis, 0 échec.** Cas couverts : jeton absent ; e-mail contenant « djateulrich » sans rôle (refusé en `list`, `add` y compris avec le rôle `founder`, `revoke`) ; utilisateur sans rôle, `shareholder`, `admin` refusés ; fondateur reconnu par son rôle même avec un autre e-mail ; `co_founder` peut lister mais ni nommer ni révoquer ; liste blanche (`founder`, `user`, `delivery`, vide, non-chaîne, « co_founder » avec espace refusés) ; e-mail insensible à la casse ; e-mail inconnu ; révocation d'un seul rôle ; `founder` irrévocable ; UUID mal formé ; corps invalide ; CORS. Pas de contre-épreuve sur l'ancien code (il lançait le serveur à l'import).

**Non couvert / reste ouvert**
- **Politique RLS `user_roles_manage_policy`** (`20260831190000_manage_founder_roles.sql`) : elle autorise tout `co_founder` à écrire n'importe quel rôle dans `user_roles` directement via l'API PostgREST, sans passer par la fonction. Un co-fondateur peut donc s'attribuer `founder` : la restriction ci-dessus n'est contournée que tant que cette politique existe. À restreindre au seul `founder` (ou à retirer l'écriture directe pour `authenticated`) ; non vérifié en base. La politique est aussi auto-référente (risque de récursion RLS).
- **Dépendance au rôle `founder` en base** : le fondateur principal doit avoir une ligne `founder` dans `user_roles` (posée par les migrations `20260831190000` et `20260831200000`). À vérifier avant déploiement, sinon il perd l'accès à la fonction (l'ancien code le laissait passer sur son e-mail).
- **Même motif ailleurs, non traité ici** : `FounderDashboard.tsx:344,371`, `FounderTroubleshooting.tsx:90,118`, `FounderRoute.tsx:21`, `AppSidebar.tsx:200`, `AssociateSpace.tsx:49`, `CorporateGovernance.tsx:384,387,536` (contrôle d'accès côté interface, contournable par un compte dont l'e-mail contient « djateulrich »), `app-health-monitor/index.ts:11` (liste d'e-mails en dur) et les migrations qui comparent `auth.jwt() ->> 'email'` (`20260902140000`).
- Déploiement de la fonction et test avec un vrai JWT. *(Fait sur dev le 12/10/2026 : voir l'annexe G. Fonction et RLS `20261012160000` appliquées en production le 12/10/2026 (401 sans JWT, `INSERT`/`UPDATE`/`DELETE` retirés à `authenticated` et `anon`) ; front déployé ; les tests avec un vrai JWT restent à confirmer. La politique `Admins can manage all roles` subsiste : elle laisse un `admin` lire toute la table. La politique RLS `user_roles_manage_policy` est corrigée sur dev par `20261012160000_fix_user_roles_rls_recursion.sql`.)*

## Annexe G. Vérification sur la base dev après déploiement (12 octobre 2026)

Rapport complet : [`docs/VERIFICATION-CORRECTIFS-2026-10.md`](docs/VERIFICATION-CORRECTIFS-2026-10.md). Procédure de déploiement : [`docs/DEPLOIEMENT-DEV-2026-10.md`](docs/DEPLOIEMENT-DEV-2026-10.md). Scripts : `supabase/deploy-dev/`. Tests : `scripts/verify-dev-security.mjs`, `supabase/tests/verification_c1_c2_c3_h2.sql`.

| Constat | État sur dev |
|---|---|
| C1 portefeuille | Corrigé dans le code ; **non déployé sur dev** ; validé en local |
| C2 RPC de facturation, d'activation et serveur | **Appliqué et vérifié** : `service_role` seul, lot de 16 fonctions : 0 exposition ; paiement et activation manuels testés dans l'interface |
| C3 `get_shop_orders_secure` | **Appliqué et vérifié** (aucun écran ne l'appelle) |
| C7 `manage-founder-roles` et RLS `user_roles` | **Appliqué et vérifié** ; nomination et révocation par le fondateur principal non testées |
| C8 identifiants de suivi | **Vérifié** dans l'interface et par tests Node |
| H2 gouvernance `corporate_*` | **Appliqué et vérifié** |
| H11 projets Supabase | Vérifié dans le navigateur |

Script HTTP avec de vrais JWT (comptes jetables) : 42 réussis, 6 échecs (les fonctions de portefeuille de C1, absentes de dev).

**Constats nouveaux de cette vérification**
1. **`user_roles` : récursion de politique (HTTP 500)** sur dev. La politique `user_roles_manage_policy` (migration `20260831190000`) interrogeait `user_roles` dans sa condition : toute lecture ou écriture par un utilisateur connecté échouait, et les pages fondateur affichaient « Accès restreint » pour un compte sans contournement par e-mail. Elle autorisait aussi un `co_founder` à écrire n'importe quel rôle, et une politique `USING (true)` rendait la table lisible par tous. Corrigé par `20261012160000_fix_user_roles_rls_recursion.sql`. **À reporter sur la production** (très probablement concernée).
2. **Exposition d'origine sur dev, et probablement en production** : `anon` exécutait `apply_shop_activation`, `prepare_shop_activation_payment`, `check_rate_limit` et 15 fonctions serveur (files d'e-mails comprises). Corrigé sur dev par `130000`, `140000`, `150000`.
3. **Conflit de noms `payment_links`** : une table `payment_links` (liens de paiement de cours, `course_id`, `payment_url`) existe déjà ; la migration Ecomfy Pay `20260914190000` en veut une autre du même nom (`shop_id`, `link_key`). Telle quelle, elle échoue sur dev et en production. **Résolu dans le dépôt (15/10/2026)** : la table Ecomfy Pay s'appelle `ecomfy_payment_links` dans les migrations `20260914190000` et `20260914200000`, dans `deploy-dev/02`, dans `ecomfy-pay-initiate` et dans le front (`ecomfyPay.ts`, `EcomfyPayCheckout.tsx`). Non déployé.
4. **`get_shop_orders_secure` n'est appelée par aucun fichier de `src/`** : C3 protège l'API directe, pas un écran.
5. **Facturation par seuil non déployée sur dev** (`shop_invoices`, `enforce_shop_billing_deadlines`, `confirm_invoice_payment` absents) : les écrans correspondants reçoivent des 404.
6. **Données** : des logos de boutiques de dev pointent vers le stockage de la production (URLs copiées avec les données).

**Reste ouvert, non couvert** : C5 (corrigé dans le code, non déployé) et C6 (`ecomfy-pay-initiate`), groupe B de l'annexe F.3, `corporate_invitations`, e-mails en dur côté interface, nettoyage des `google_analytics_code` déjà stockés, journaux Supabase non exportés, annexe B non lancée sur la production.

## Annexe H. Déploiement en production, vague 1 (12 octobre 2026)

Procédure, résultats, incident ouvert et liste des points restants : [`docs/DEPLOIEMENT-PROD-2026-10.md`](docs/DEPLOIEMENT-PROD-2026-10.md).

| Constat | État en production |
|---|---|
| C2 RPC de facturation, d'activation et lot de 16 fonctions serveur | **Appliqué et vérifié** (`service_role` seul, 0 fonction du lot exposée) |
| C3 `get_shop_orders_secure` | **Appliqué** (`authenticated` + `service_role`, contrôle du propriétaire interne) |
| C7 `manage-founder-roles` + RLS `user_roles` | **Appliqué** ; 401 sans JWT ; écriture directe retirée ; nomination et révocation non testées |
| C8 | `track-conversion` et front déployés ; requête de détection non lancée |
| H2 `corporate_*` | **Appliqué et vérifié** (2 politiques d'insertion ouvertes ; resserrées par `20261015150000`, non déployée) |
| H11 | Migration et secret Vault appliqués ; push de commande OK ; health-monitor : 200 depuis le 14/10/2026 |
| C1, C4, C5 (Ecomfy Pay) | **Non déployés** ; bloqués par C6 et H1 (conflit `payment_links` résolu dans le dépôt le 15/10/2026) |
| Front | **Déployé** (13/10/2026). Variables `VITE_*` à définir aussi pour Preview si les previews doivent builder. Tests applicatifs à confirmer. |

**Constats nouveaux**
1. Les migrations passées dans l'éditeur SQL ne sont pas enregistrées dans `schema_migrations` : si « Deploy to production » est actif dans l'intégration GitHub de Supabase, la fusion de la PR appliquera automatiquement toutes les migrations en attente (Ecomfy Pay, affiliation, facturation par seuil), hors du runbook. À vérifier et, si l'option est active, à désactiver avant de fusionner (aucun document ne confirme que c'est fait).
2. La branche de preview Supabase échoue sur `ad_templates.created_by` (migration `20251107132948`) : migrations non reproductibles (M11). Correctif existant dans la branche locale `fix/migrations-fresh-database` (`7eb936e`), non intégré. Son seul volet `payment_links` en `ecomfy_payment_links` est repris directement dans `jeanmarc` (SQL, Edge Function et front adaptés, 15/10/2026) sans fusion de la branche.
3. `invoke_edge_function` (H11) n'authentifiait pas `app-health-monitor`, qui exige `x-cron-secret` ou la clé de service (`isAuthorizedCron`). Corrigé dans le dépôt (secret Vault `cron_secret`). **Résolu en production le 14/10/2026** : `CRON_SECRET` défini par un administrateur, secret Vault créé avec la même valeur, le health-monitor répond 200. À surveiller : une exécution sans code HTTP.
