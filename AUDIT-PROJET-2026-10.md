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

1. Révoquer `EXECUTE` pour `anon`/`PUBLIC` sur toutes les fonctions financières et de facturation (C1, C2, C3). C'est un seul script SQL.
2. Vérifier la signature HMAC dans `ecomfy-pay-webhook` (C5).
3. Recalculer côté serveur les montants et les crédits dans `process-payment` et `ecomfy-pay-initiate` (C6).
4. Corriger `manage-founder-roles` : supprimer `includes("djateulrich")` et valider le rôle demandé (C7).
5. Supprimer l'exécution de scripts libres dans `tracking.ts` (C8).
6. Rendre le KYC réel et déplacer les pièces d'identité vers un bucket privé (C4, H1).
7. Corriger les politiques RLS des 8 tables de gouvernance restées ouvertes (H2).
8. Corriger `isAuthorizedCron`, qui accepte un JWT non vérifié (H3).
9. Appliquer les en-têtes de sécurité sur Vercel (H8). Aujourd'hui seul `vercel.json` est lu, et il ne contient aucun en-tête de sécurité.
10. Corriger le `ReferenceError` de `geniuspay-webhook` qui empêche probablement tout crédit automatique (H7).

> **Réserve importante.** Les constats SQL (droits `EXECUTE`, politiques RLS) viennent des migrations présentes dans le dépôt. L'état réel de la base peut différer, car des migrations semblent manquantes (voir M11). Le script de vérification en annexe B permet de confirmer chaque point en 2 minutes sur la base réelle.

### État des correctifs (mis à jour le 12 octobre 2026)

L'annexe B a été exécutée sur la base de dev (copie de la production), puis les deux requêtes clés sur la production. Résultat : la production est arrêtée à la migration `20260901020000`, les 25 migrations suivantes du dépôt n'y sont pas, et les failles ci-dessous sont **confirmées en base**.

| Constat | État en base | Correctif |
|---|---|---|
| C2, partie `apply_commission_payment` / `apply_shop_subscription` | **Confirmé** : exécutables par `anon` et `PUBLIC` | Hotfix `20261012120000` : validé sur la dev, **à déployer en production** |
| H2, tables `corporate_*` | **Confirmé, et plus large** : les 14 tables sont ouvertes (lecture et écriture) à tout utilisateur connecté, car `strict_multitenant_privacy` n'est pas appliquée | Même hotfix : validé sur la dev, **à déployer en production** |
| C1, C3, C4, `confirm_invoice_payment` | **Non exploitables aujourd'hui** : `wallets`, `ecomfy_payments` et les fonctions de facturation par seuil n'existent pas en base | **Non corrigés.** Les migrations qui les créent contiennent les failles : ne pas les déployer avant correction (annexe C) |
| Autres constats (C5 à C8, H1, H3 à H11, M, F) | Non vérifiés en base | Hors périmètre du hotfix |

Procédure de déploiement, tests de recette et retour arrière : [`docs/SECURITY-HOTFIX-2026-10.md`](docs/SECURITY-HOTFIX-2026-10.md).

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

#### C2. Contournement de la facturation (commissions et abonnements)
- **Où :** `20260909100000_ecomfy_billing_threshold_system.sql:380` (`confirm_invoice_payment`, accordée à `anon`) ; `20261003120000_fix_billing_partial_payments_sync.sql:124` (`apply_commission_payment`, accordée explicitement à `anon`) ; `20260912000000_fix_subscription_plan_aliases_and_zero_commission.sql:53` (`apply_shop_subscription`, aucun `REVOKE`). Le client appelle d'ailleurs `confirm_invoice_payment` directement : `src/lib/billingSystem.ts:221`.
- **Constat :** aucune de ces fonctions ne vérifie qu'un paiement réel a eu lieu ni que l'appelant possède la boutique.
- **Scénario :** n'importe qui efface la dette de commission de n'importe quelle boutique (`commission_balance_due = 0`, statut `STORE_ACTIVE`), ou active un abonnement Pro gratuitement.
- **Correctif :** réserver ces trois fonctions à `service_role` (appelées uniquement depuis les webhooks). Supprimer l'appel client à `confirm_invoice_payment`.

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

#### C5. Webhook Ecomfy Pay sans vérification de signature
- **Où :** `supabase/functions/ecomfy-pay-webhook/index.ts` (fichier entier, `verify_jwt` non défini donc la fonction est exposée à tous).
- **Constat :** contrairement à `geniuspay-webhook` (qui vérifie un HMAC-SHA256 avec fenêtre anti-rejeu de 5 minutes), ce webhook accepte n'importe quel JSON. Il marque le paiement `SUCCEEDED`, passe la commande en `PAID` et crédite le portefeuille.
- **Scénario :** `POST {event:"payment.success", data:{metadata:{internal_reference:"ECM-PAY-XXXX"}}}` : fausse confirmation de paiement. La référence est devinable (voir M4) ou récupérable car renvoyée par `ecomfy-pay-initiate`.
- **Correctif :** reprendre `computeSignature` + `timingSafeEqual` de `geniuspay-webhook`. En complément, rappeler l'API GeniusPay pour confirmer le statut avant de créditer.

#### C6. Montants et crédits décidés par le navigateur
- **Où :** `supabase/functions/process-payment/index.ts:113,216,436-520` ; `supabase/functions/ecomfy-pay-initiate/index.ts:23-36,60-73`.
- **Constat :**
  - `process-payment` prend `amount` et `credits_pack {size, price}` du corps de la requête. Aucun tarif serveur n'est consulté, alors que l'audit de juin 2026 listait déjà ce point comme « non vérifié » (Lot 2, point 7). Le webhook crédite `credits_size` lu dans les métadonnées, et ne compare le montant qu'à celui saisi par le même client.
  - `ecomfy-pay-initiate` accepte `amount` et `order_id` sans les rapprocher de `orders.total` ni du prix du lien de paiement.
- **Scénario :** acheter 10 000 crédits IA pour 1 FCFA ; ou payer 1 FCFA et marquer une commande de 100 000 FCFA comme `PAID` (via le webhook, qui fait confiance à `payment.order_id`).
- **Correctif :** une table de tarifs serveur (plans, packs), recalcul du montant à partir de `plan`/`pack_id`/`order_id`, rejet si le montant ne correspond pas.

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

### ÉLEVÉ

#### H1. Pièces d'identité dans un bucket public
- **Où :** `src/components/ecomfy-pay/KycVerificationTab.tsx:114-117,154-157` ; les 18 appels `storage.from(...)` du client utilisent tous `shop-images` (public, listable selon l'audit de juin).
- **Impact :** CNI, passeports et selfies des marchands et livreurs sont servis par URL publique `getPublicUrl`. C'est une fuite de données personnelles sensibles et une exposition légale.
- **Correctif :** bucket privé `kyc-documents`, politiques RLS par `auth.uid()`, URL signées à durée courte, suppression des fichiers existants du bucket public.

#### H2. Huit tables de gouvernance en lecture/écriture libre pour tout utilisateur connecté
- **Où :** `20260901000000_corporate_governance_system.sql:278-307`. La migration `20260902140000_strict_multitenant_privacy.sql` ne supprime et ne remplace les politiques que de **6** tables.
- **Tables restées ouvertes (`USING (true)`) :** `corporate_vesting_milestones`, `corporate_document_versions`, `corporate_document_acceptances`, `corporate_proposal_approvals`, `corporate_cap_table_snapshots`, `corporate_intellectual_property`, `corporate_offboarding_cases`, `corporate_audit_logs`.
- **Impact :** n'importe quel inscrit lit et modifie la table de capitalisation, la propriété intellectuelle, les cas de départ, et peut **effacer ou falsifier le journal d'audit**.
- **Correctif :** supprimer ces politiques, appliquer `is_authorized_corporate_member()` en lecture et un rôle fondateur en écriture.

#### H3. `isAuthorizedCron` accepte un JWT dont la signature n'est pas vérifiée
- **Où :** `supabase/functions/_shared/cron-auth.ts:9-24`.
- **Constat :** la fonction décode la charge utile d'un jeton et accepte tout jeton dont `role === "service_role"`, sans contrôler la signature. Ses consommateurs sont `process-queue`, `reconcile-pending-payments`, `send-24h-reminder`, `send-weekly-finance-summary`, `check-ad-token-expiry`, `app-health-monitor`, `seo-auto-index`, tous en `verify_jwt = false`.
- **Impact :** n'importe qui forge un jeton et déclenche des envois d'e-mails, des réconciliations de paiement et des tâches d'administration.
- **Correctif :** supprimer la branche « payload `role` », ne garder que la comparaison exacte avec la clé de service ou le secret `CRON_SECRET` (comparaison à temps constant).

#### H4. Relais d'e-mails ouverts et injection HTML
- **Où :** `send-subscription-email/index.ts` (aucune authentification, destinataire et contenu libres, `${full_name}` non échappé) ; `send-domain-ready-notification/index.ts` (idem avec `ownerEmail`, `customDomain`) ; `send-corporate-invite/index.ts:18` (authentifié mais destinataire, rôle et `originUrl` libres) ; `verify-delivery-identity/index.ts` (`userName` non échappé).
- **Impact :** envoi de courriels de phishing depuis `support@ecomfy.cloud` (domaine légitime, bonne réputation SPF/DKIM), avec liens contrôlés par l'attaquant. Risque de classement en spam du domaine.
- **Correctif :** authentifier l'appelant, déduire le destinataire et le contenu depuis la base (comme le font correctement `send-contact-notification` et `send-booking-notification`), échapper toutes les variables, valider `originUrl` contre une liste blanche.

#### H5. `verify-delivery-identity` : tout utilisateur connecté peut s'auto-approuver
- **Où :** `supabase/functions/verify-delivery-identity/index.ts:40-69`.
- **Constat :** la fonction n'exige que `verify_jwt` (comportement par défaut). Elle écrit `verification_status` et `trust_badge_active` avec la clé de service, à partir de `companyId`, `driverId` et `verificationStatus` fournis par l'appelant.
- **Correctif :** réserver à un fondateur/admin (vérification de rôle dans la fonction), ou transformer en simple fonction d'envoi appelée après une décision prise côté serveur.

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
- **Statut (2026-10-12) : corrigé dans le dépôt, validation en environnement réel en attente.**
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
- `apply_shop_activation` et `prepare_shop_activation_payment` correctement réservées (`REVOKE ALL ... FROM PUBLIC`).
- DOMPurify sur les descriptions de produit, avis et contenus de cours, avec listes de balises autorisées. `share-product` et les e-mails de contact/réservation échappent correctement leurs variables et prennent le destinataire en base.
- Séparation des vues publiques (`shops_public`, `showcase_sites_public`, `product_reviews_public`) pour ne pas exposer `user_id` ni le code d'analytics.
- Gestion d'erreurs côté client avec **masquage des secrets** (`src/lib/error-handler.ts`) et identifiants de corrélation.
- Retraits : verrouillage de ligne (`FOR UPDATE`), contraintes `CHECK` sur les soldes, grand livre immuable : l'architecture comptable est saine, c'est le contrôle d'accès autour qui manque.
- PKCE activé, chargement paresseux des pages avec reprise (`lazyWithRetry`), PWA, `security.txt`.

---

## 7. Plan d'action recommandé

### Immédiat (24 à 48 h)
1. **Script SQL de durcissement** *(partiellement fait : `apply_commission_payment` et `apply_shop_subscription`, voir le hotfix `20261012120000`)* : `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` sur `credit_merchant_wallet_pending`, `process_wallet_settlements`, `request_wallet_withdrawal_atomic`, `confirm_invoice_payment`, `apply_commission_payment`, `apply_shop_subscription`, `evaluate_merchant_kyc_security`, `record_affiliate_referral`, `get_or_create_affiliate`, `process_affiliate_commission_for_payment`, `check_and_trigger_billing_threshold`. Restreindre `get_shop_orders_secure` aux propriétaires/collaborateurs. Ajouter un `REVOKE` par défaut pour les prochaines fonctions (`ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`).
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
12. Authentifier et escaper les fonctions d'e-mail (H4), `verify-delivery-identity`.
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
| `ecomfy-pay-webhook` | **Non** (aucune signature) | C5 |
| `ecomfy-pay-initiate` | Non | Public par nature (checkout), mais montants libres (C6) |
| `ecomfy-pay-settlement` | Non | Déclenchable par tous (M6) |
| `geniuspay-webhook` | Signature HMAC | Bug de portée (H7) |
| `payment-callback` | Signature HMAC (Lygos) | Héritage, `GET` sans effet de base : correct |
| `process-payment`, `verify-payment` | JWT utilisateur | Montants client (C6) |
| `send-subscription-email`, `send-domain-ready-notification` | **Non** | H4 |
| `send-corporate-invite` | JWT par défaut, aucun contrôle de rôle | H4 |
| `verify-delivery-identity` | JWT par défaut, aucun contrôle de rôle | H5 |
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
    'process_affiliate_commission_for_payment'
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
