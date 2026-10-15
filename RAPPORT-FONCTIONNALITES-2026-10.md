# Rapport des fonctionnalités Ecomfy : état réel, déployé et non déployé

**Date :** 12 octobre 2026
**Dépôt :** `c:\dev\Ecomfy`, branche `jeanmarc` (HEAD `c625e3d`), 17 commits en avance sur `main` (`20b93b8`, 7 octobre 2026)
**Type d'analyse :** lecture du code (front, 71 Edge Functions, 235 migrations, configuration), graphe d'imports, et **sonde en lecture seule de la base dev** (voir 0.3). Aucun test fonctionnel dans un navigateur, aucune écriture, aucun accès à la production.
**Documents liés :** `AUDIT-PROJET-2026-10.md` (sécurité), `docs/DEPLOIEMENT-DEV-2026-10.md`, `docs/VERIFICATION-CORRECTIFS-2026-10.md`, `docs/KYC-REVUE-ET-DEPLOIEMENT-C4.md`. Ce rapport ne reprend pas le détail des failles : il dit **ce que fait chaque fonctionnalité, où elle vit, et si elle fonctionne réellement**.

---

## 0. Comment lire ce rapport

### 0.1 Légende des états

| Pastille | État | Sens |
|---|---|---|
| ✅ | **Actif** | Code sur `main`, point d'entrée dans l'interface, tables et fonctions nécessaires présentes en base. |
| ⚠️ | **Actif avec réserves** | Fonctionne, mais avec une limite importante (partie simulée, garde-fou désactivé, bug connu, donnée de démonstration). |
| 🚧 | **Code livré, base absente** | Le code est sur `main` mais les tables qu'il interroge n'existent pas en base (dev, donc très probablement production). L'écran s'ouvre et échoue ou reste vide. |
| 🛠️ | **Prêt sur `jeanmarc`, non déployé** | Correctif ou fonctionnalité écrit, testé en local ou sur dev, pas en production. |
| 👻 | **Orphelin** | Code présent mais aucune route ni aucun point d'entrée : personne ne peut l'atteindre. |
| 🎭 | **Factice ou simulé** | L'écran existe mais la donnée ou la vérification est fabriquée. |
| 📝 | **Planifié** | Décrit dans un document, aucun code. |

### 0.2 Ce que « déployé » veut dire ici

Le dépôt ne peut pas dire à lui seul ce qui tourne en production. Trois sources ont été croisées :

1. **Front en production = branche `main`.** Hypothèse : Vercel déploie `main` (`vercel.json`, redirections `visuelpro.cloud` vers `ecomfy.cloud`). Non vérifiable depuis le dépôt. La branche `jeanmarc` (17 commits, tous des correctifs de sécurité ou de la documentation) n'est **pas** dans `main`.
2. **Base de production = migration `20260901020000`.** Mesure faite par l'utilisateur sur la production (audit, « État des correctifs »). **Les 25 migrations suivantes du dépôt n'y sont pas**, plus 5 migrations de correctifs du 12 octobre.
3. **Base dev = copie de la production** + hotfix + scripts `01` et `04`. C'est sur dev que la sonde du 0.3 a été faite. **Dev n'est pas la production** : les conclusions « table absente en production » sont une **inférence** (dev est une copie, et les deux requêtes faites sur la production concordent), pas une mesure.

Conséquence pour la lecture : un module marqué 🚧 est livré dans l'application mais sa base n'a jamais été créée. Ce n'est pas un bug de code, c'est un déploiement jamais fait.

### 0.3 La sonde de la base dev

Pour chacune des **121 tables** que le code référence (`.from("…")`), une requête `GET /rest/v1/<table>?limit=0` a été envoyée au projet dev avec la clé publique `anon` du `.env` (le script refuse de viser autre chose que `xfpbpxncserliskrbaim`). Une table existante répond 200 ou 401 ; une table absente répond 404 `PGRST205`. **36 tables sur 121 sont absentes** (liste en annexe C). Le sondage des fonctions SQL (`.rpc`) a été tenté puis **écarté** : un `GET` sur une fonction à paramètres renvoie 404 même si elle existe, le résultat n'est pas fiable.

### 0.4 Chiffres du projet

| Mesure | Valeur |
|---|---|
| Lignes TS/TSX dans `src/` | ≈ 118 500 |
| Pages | 75 (68 + 3 fondateur + 4 livreur) |
| Routes déclarées (`<Route>`) | 91 |
| Edge Functions | 71 (+ dossier `_shared`) |
| Migrations | 235 fichiers (60 en novembre 2025, 50 en mai, 54 en juin 2026…) |
| Fichiers source atteignables depuis `main.tsx` | 357 sur 464 ; **83 orphelins**, hors composants `ui/` et tests (20 fichiers `ui/` sont aussi inutilisés) |
| Commits sur `main` | 2 726 (2 376 par le robot Lovable, 350 par `PRO M1`) |
| Tests exécutables | 0 : aucun lanceur (`vitest` absent), seuls les tests Node de `supabase/tests/` tournent |

---

## 1. Synthèse : état de chaque fonctionnalité

| # | Fonctionnalité | Accès | État | En une phrase |
|---|---|---|---|---|
| F1 | Comptes, connexion, profil | `/auth`, `/profile` | ⚠️ | Complet ; la page `VerifyEmail` n'a pas de route |
| F2 | Site public, landing, pages légales, docs | `/`, `/documentation`… | ✅ | Complet ; données de démonstration dans « Top vendeurs » |
| F3 | Tableau de bord marchand | `/dashboard` | ✅ | KPI, courbe 7 jours, statuts, top produits |
| F4 | Boutiques : création, thèmes, builder, domaine | `/shop-builder`, `/shop-editor/:id` | ⚠️ | Complet ; cible DNS sur l'ancien domaine VisualPro |
| F5 | Produits : éditeur, assistant, médias, avis | éditeur de boutique | ✅ | Complet ; le moteur de quota IA est désactivé |
| F6 | Boutique publique et commande client | `/shop/:slug` | ⚠️ | Commande OK ; « Mobile Money » n'encaisse rien en ligne |
| F7 | Commandes, clients, paniers, notifications | éditeur de boutique | ✅ | Export Excel, impression, push, temps réel |
| F8 | Collaborateurs de boutique | éditeur de boutique | ✅ | Invitation par e-mail, rôles par permission |
| F9 | Livraison : partenaires (DLK, ancien système) | onglet Livraison | ✅ | Transfert auto à la confirmation |
| F10 | **Ecomfy Livraison (nouveau module)** | `/delivery/*` | 🚧 🎭 | 5 tables absentes ; vérification d'identité simulée ; menu « Bientôt disponible » |
| F11 | Abonnements, crédits IA, codes promo, commissions | `/subscription`, `/pricing` | ⚠️ | Paiement GeniusPay réel ; blocage par seuil probablement inactif en base |
| F12 | **Ecomfy Pay** (portefeuille, retraits, liens) | `/ecomfy-pay`, `/pay/:key` | 🚧 🛠️ | 6 tables sondées absentes (8 dans la migration) ; correctifs prêts sur `jeanmarc` |
| F13 | Studio IA et bibliothèque | `/studio`, `/library` | ⚠️ | Génération réelle ; menu « Bientôt disponible » ; quota quotidien désactivé |
| F14 | Assistants IA de boutique (chat, voix) | éditeur de boutique | ⚠️ | Réel ; endpoints publics sans authentification |
| F15 | Académie (vidéos), cours payants, certificats | `/academy`, `/student/*` | ⚠️ | Académie = liste de vidéos YouTube en dur ; cours sans lien de menu |
| F16 | Sites vitrines (Showcase) | aucune | 👻 | ≈ 37 fichiers et 4 fonctions serveur sans aucune route |
| F17 | Communauté (chat) | `/community` | ✅ | Salon temps réel, mentions, réactions |
| F17b | **ConnectUs** (réseau social) | `/connectus` | 🚧 🎭 | 9 tables absentes ; « Live Commerce » est une carte statique |
| F18 | Marketing : pixels, API de conversion, publicités | paramètres de boutique | ✅ | Meta, TikTok, Snapchat, GA4 ; réconciliation Meta |
| F19 | **SEO Intelligence** | `/seo` | 🚧 🎭 | 3 tables absentes ; la route n'a pas de boutique (boutique de démo) |
| F20 | **Affiliation** / parrainage | `/affiliate`, `/referral` | 🚧 | 8 tables absentes ; ancien parrainage `/referral` actif mais sans lien |
| F21 | Gouvernance d'entreprise, espace associé | `/corporate-governance` | ⚠️ | Actif sur `main` ; `corporate_invitations` absente ; RLS durcie seulement sur dev |
| F22 | Espace fondateur | `/founder-dashboard`… | ⚠️ | Actif ; revue KYC et contrôle de paiement sur `jeanmarc` ; écran KYC sans table |
| F23 | Plateforme : PWA, push, e-mails, i18n, MCP, santé | transversal | ⚠️ | PWA, push, e-mails OK ; **l'API REST publique n'existe pas** |
| F24 | Application mobile native | aucune | 📝 | Capacitor configuré, aucun projet `android/` ni `ios/` |

**Lecture rapide :** 8 fonctionnalités opérationnelles de bout en bout (F2, F3, F5, F7, F8, F9, F17, F18) ; 10 avec réserves (F1, F4, F6, F11, F13, F14, F15, F21, F22, F23) ; **5 modules entiers livrés dans l'application sans leur base** (F10, F12, F17b, F19, F20) ; 1 module orphelin (F16) ; 1 fonction annoncée mais inexistante (l'API REST, dans F23) ; 1 application sans code natif (F24) ; deux plans sans code (migration Laravel, restructuration MVC).

---

## 2. État de déploiement par environnement

### 2.1 Ce qui est dans `main` mais pas dans la base de production

Ces 25 migrations sont dans le dépôt et **pas** en production (production arrêtée à `20260901020000`) :

| Migration | Date | Crée ou modifie | Fonctionnalité qui en dépend |
|---|---|---|---|
| `20260902120000` | 2 sept. | 6 tables `shop_seo_*` | F19 SEO Intelligence |
| `20260902140000` | 2 sept. | Politiques `strict_multitenant_privacy` (6 tables) | F21 gouvernance |
| `20260906000000` | 6 sept. | `corporate_invitations` | F21 invitations d'associés |
| `20260906010000` | 6 sept. | `delivery_companies`, `delivery_hubs`, `delivery_drivers`, `delivery_dispatches`, `delivery_cash_transfers`, `delivery_company_reviews` | F10 Ecomfy Livraison |
| `20260907140000` | 7 sept. | RLS livraison | F10 |
| `20260908170000` | 8 sept. | Buckets `avatars`, `shop-assets` | F1, F4 |
| `20260909100000` | 9 sept. | `shop_invoices`, `get_shop_orders_secure`, `check_and_trigger_billing_threshold`, `enforce_shop_billing_deadlines`, `confirm_invoice_payment` | F11 blocage par seuil |
| `20260910131500` | 10 sept. | Colonne `bundle_title` sur `products` | F5 offres en lot |
| `20260911101000` | 11 sept. | Enum des rôles de collaborateur | F8 |
| `20260911120000`, `20260912000000` | 11-12 sept. | Commission nulle pour boutiques abonnées, alias de plans | F11 |
| `20260912150000` | 12 sept. | 9 tables `connectus_*` | F17b ConnectUs |
| `20260914190000`, `20260914200000` | 14 sept. | 8 tables Ecomfy Pay (`wallets`, `ecomfy_payments`, `merchant_kyc`, `settlements`, `wallet_ledger`, `withdrawal_requests`, `payment_events`, `ecomfy_pay_settings`) | F12 |
| `20260916…`, `20260918…`, `20260919…` | 16-19 sept. | Correctifs de permissions de collaborateurs | F8 |
| `20260916132500` | 16 sept. | Agrégat des meilleurs vendeurs par vendeur | F2 « Top vendeurs » |
| `20260918120000` | 18 sept. | `orders.scheduled_delivery_date` | F7 livraison planifiée |
| `20260929120000` | 29 sept. | `stock_movements`, `inventory_units` | Stock : **plus aucun code ne les utilise** (fonction retirée le 3 oct.) |
| `20261003120000` | 3 oct. | Paiements partiels de commission | F11 |
| `20261005160000` | 5 oct. | 8 tables `affiliate_*` | F20 |
| `20261005174500` | 5 oct. | Complétion de profil Google | F1 |
| `20261011120000` | 11 oct. | `invoke_edge_function()` via Vault | Push de commande, moniteur de santé |

> **Conséquence directe.** Le front de `main` contient des écrans qui appellent ces objets. En production, ces appels reçoivent « table introuvable » ou une erreur de fonction. Le code d'inscription (`Auth.tsx`) appelle par exemple le service d'affiliation à chaque connexion ; l'erreur est avalée par un `try/catch`, ce qui explique que l'application ne plante pas.

### 2.2 Ce qui est sur `jeanmarc` seulement (non déployé en production)

17 commits, du 11 au 12 octobre 2026 :

| Commit | Contenu |
|---|---|
| `1726c5d` | Documents : audit, plans Laravel et MVC |
| `5305984`, `2b3a044` | Séparation des deux projets Supabase (prod/dev), URL lue depuis `VITE_SUPABASE_URL` |
| `967f9c9` | Hotfix : RPC de facturation, tables `corporate_*` |
| `f885be8` | **C1** : verrouillage des fonctions de portefeuille |
| `39092e7` | **C3** : contrôle de propriété sur `get_shop_orders_secure` |
| `24d3750` | **C2** : RPC de facturation réservées à `service_role` ; Edge Functions `founder-activate-shop` et `founder-record-commission-payment` |
| `e334499`, `ba069d7` | **C7** : `manage-founder-roles` sans décision par e-mail ; correction de la récursion RLS de `user_roles` |
| `1c809d0` | **C8** : plus aucun code marchand exécuté dans `tracking.ts` |
| `aebd53e`, `fb78f3f` | Scripts de déploiement dev, tests, rapport de vérification |
| `d84eda1` | `backups/` ignoré par Git |
| `133b1fc`, `0d9fb91`, `5059bd3` | **C4** : fin de l'auto-validation KYC ; **écran de revue KYC** `/founder/kyc-review` ; guide |
| `c625e3d` | **C5** : signature HMAC et confirmation GeniusPay sur `ecomfy-pay-webhook` |

État de déploiement de ces correctifs : **dev** a reçu le hotfix, les scripts `01` (C2, C3) et `04` (`user_roles`), les Edge Functions `founder-*`, `manage-founder-roles`, `track-conversion` et le front. **La production n'a rien reçu.** Le fichier `02` (Ecomfy Pay, C1 et C4) n'est pas sur dev non plus.

### 2.3 Ce qui n'existe pas en base mais que le code appelle

Quatre tables sont référencées par le code mais **ne sont créées par aucune migration** : `product_bundles`, `product_variants`, `cart_items`, `billing_history`. Les trois premières sont appelées dans un `Promise.allSettled` lors de la suppression d'un produit (`ShopEditor.tsx:800`), donc sans conséquence visible. `billing_history` est lue par `financialMetricsService.ts` et `FounderTroubleshooting.tsx` : l'historique de facturation du tableau de bord fondateur reste vide.

---

## 3. Détail de chaque fonctionnalité

### F1. Comptes, authentification, profil · ⚠️

**Accès :** `/auth`, `/reset-password`, `/oauth/consent`, `/complete-profile`, `/profile`.

**Ce que ça fait**
- **Inscription par e-mail et mot de passe** (`Auth.tsx`, 971 lignes) : nom, e-mail, téléphone, pays, code de parrainage facultatif. Contrôles : e-mail « réel » (`validateRealEmail`), robustesse du mot de passe, **unicité du numéro de téléphone** (un numéro = un compte, vérifié dans `profiles`).
- **Connexion** par e-mail et mot de passe, **connexion Google** (`signInWithOAuth`, `handleSocialLogin`), renvoi de l'e-mail de confirmation, réinitialisation du mot de passe (`ResetPassword.tsx`).
- **Complétion de profil** : `ProtectedRoute` renvoie vers `/complete-profile` tout profil sans téléphone ni nom (cas typique d'une inscription Google). Les comptes antérieurs au 5 octobre 2026 17 h 30 UTC, ou ayant déjà une boutique, sont exemptés (`profileCompletionService.ts`).
- **Profil** (`Profile.tsx`) : avatar (formats et poids contrôlés), identité, téléphone.
- **Écran de consentement OAuth** (`OAuthConsent.tsx`) : Ecomfy sert de fournisseur d'autorisation (API `supabase.auth.oauth` en bêta), utilisé par le serveur MCP.
- **Rôles applicatifs** (enum `app_role`) : `user`, `admin`, `founder`, `co_founder`, `delivery`, `shareholder`. Détail en F22.
- **E-mails d'authentification** envoyés par la fonction `auth-email-hook` (modèles : inscription, lien magique, récupération, changement d'e-mail, invitation, ré-authentification) via Resend et la file `process-email-queue`.
- **Lien vers l'affiliation** : à chaque connexion, `affiliateService.checkAndRecordPendingReferral` enregistre un parrainage en attente (code gardé dans `localStorage` sous `ecomfy_affiliate_ref`), et la RPC `process_referral_signup` traite l'ancien parrainage.

**Réserves**
- `VerifyEmail.tsx` (210 lignes) est importée paresseusement dans `App.tsx` mais **aucune route ne la sert**. Le parcours de vérification passe par le lien envoyé par e-mail.
- Le drapeau fondateur est contrôlé **aussi par un e-mail en dur** (`djateulrich@gmail.com`) dans `AppSidebar.tsx:200` et `FounderRoute.tsx` (constat M7 de l'audit ; la décision serveur, elle, est corrigée sur `jeanmarc`).
- Les buckets `avatars` et `shop-assets` sont créés par une migration non déployée en production (`20260908170000`).

---

### F2. Site public, landing, pages légales, documentation · ✅

**Accès :** `/` (ou la boutique si le domaine est un domaine personnalisé), `/boutiques-ecommerce`, `/visuels-publicitaires`, `/videos-publicitaires`, `/demo`, `/tutorial`, `/documentation`, `/docs`, `/privacy-policy`, `/terms-of-service`, `/cookies-policy`, `/legal-notice`, `/health`, `/healthz`.

**Ce que ça fait**
- **Landing** (`Index.tsx`) composée de **20 sections** : héro, bandeau de confiance, positionnement, démonstration vidéo, **Top vendeurs**, trois « piliers » (Créer, Vendre, IA), section ConnectUs, piliers Gérer et Finance, personas, mode d'emploi, Académie, écosystème, statistiques, témoignages, tarifs, FAQ, appel à l'action final.
- **Pages marketing** par métier (`BoutiquesEcommerce`, `VisuelsPublicitaires`, `VideosPublicitaires`) construites sur `FeatureLandingPage`, avec images générées par `generate-feature-image` et mises en cache.
- **Documentation** (`Documentation.tsx`, 812 lignes), tutoriel, démo, mentions légales, politiques.
- **Page de santé** `/health` consommée par le moniteur.
- **Robots, plan du site, `security.txt`, `llms.txt`** dans `public/`, plus `dynamic-sitemap` (XML des boutiques et produits publiés).
- **Détection de domaine personnalisé** : si le nom d'hôte n'est pas `ecomfy.cloud`, `localhost` ou un domaine d'hébergeur, la route `/` affiche la boutique (`App.tsx:130`).

**Réserves**
- `LandingTopSellers.tsx` appelle la RPC `get_top_sellers` (définie en juin 2026, donc en base) et contient un **avatar encodé en dur** (image base64) comme repli. La migration du 16 septembre qui agrège les ventes par vendeur n'est pas en production ; l'effet exact sur le classement affiché n'a pas été vérifié.
- 6 composants de landing sont orphelins (`LandingAiSection`, `LandingGallery`, `LandingMediaSection`, `LandingProofSection`, `LandingScrollStory`, `LandingShopSection`) plus `LandingMediaSections`.
- Nombreuses mentions de l'ancienne marque (VisualPro, Juggle) : 130 occurrences dans 41 fichiers.

---

### F3. Tableau de bord marchand · ✅

**Accès :** `/dashboard` (protégé).

- Quatre KPI : chiffre d'affaires du jour, commandes du jour, panier moyen, total de commandes.
- Courbe « Évolution du chiffre d'affaires (7 jours) » (Recharts).
- Répartition des commandes par statut : Nouveau, Confirmé, En traitement, Expédié, Livré, Annulé.
- « Top produits (30 derniers jours) ».
- Prend en compte les boutiques **possédées** et celles où l'utilisateur est **collaborateur** (`shop_collaborators`).
- Barre latérale (bureau) et barre de navigation basse (mobile). Les entrées « ConnectUs », « Ecomfy Pay », « Studio IA » et « Ecomfy Livraison » sont **grisées « Bientôt disponible »** (voir 4.3).
- L'entrée mobile **« Statistiques » pointe sur `/statistics`, route qui n'existe pas** (page 404).
- `StartChecklist.tsx` (liste de démarrage) est orphelin.

---

### F4. Boutiques : création, thèmes, page d'accueil, domaine, paramètres · ⚠️

**Accès :** `/shop-manager` (liste), `/shop-builder` (création), `/shop-editor/:id` (administration), `/shop-preview/:id`, `/shop/:slug`.

**Création** (`ShopBuilder.tsx`, 425 lignes) : identité, couleurs, WhatsApp, réseaux sociaux, langues, objectif mensuel. Suppression d'une boutique avec effacement en cascade côté client (produits, images, lignes de commande, commandes).

**Administration** (`ShopEditor.tsx`, 1 448 lignes). Barre latérale : Tableau de bord, Produits, Commandes, Paniers abandonnés, Clients fidèles, Avis, Codes promo, Statistiques, Finances, Facturation, Page d'accueil, Thème, Thèmes, Assistant IA, Optimiseur IA, Collaborateurs, Paramètres.

**Thèmes**
- **8 thèmes de boutique** (`lib/shopThemes/themes`) : Classic, Fashion, Beauty, Luxury, Tech, Landing, Mobile-first, Dynamic. Catalogue en base (`shop_themes_catalog`, `shop_installed_themes`).
- **7 thèmes de fiche produit** (`lib/productThemes/themes`) : classic-premium, health-wellness, landing-ad, luxury-dark, mobile-first, promo-offer, storytelling.
- Panneau d'apparence produit, aperçu mobile, couleurs et choix « Logo + Nom », « Logo uniquement », « Nom uniquement ».

**Constructeur de page d'accueil** (`HomepageBuilder/`) : **15 sections** (héro, grille de produits, produits vedettes, catégories, caractéristiques, texte + image, vidéo, vidéos courtes, bannière d'appel à l'action, témoignages, **témoignages audio**, FAQ, formulaire de contact, pied de page, achat d'un produit unique), modèles (`templates.ts`), contrôles par section, éditeur glisser-déposer (`dnd-kit`).

**Paramètres** (`ShopSettings.tsx`), onglets : Général, Paiement, Livraison, Check-out, Langues, Notifications, **Pixels et suivi**, **Nom de domaine**, Zone de danger. Options de paiement : Mobile Money (Wave, Orange, MTN, Moov), paiement à la livraison, carte, et **paiement anticipé obligatoire hors de la capitale** (`force_mobile_money_interior`).

**Domaine personnalisé** : `DnsConfigurationAssistant`, `DomainRegistrarSuggestions`, Edge Function `verify-domain-dns` (CNAME `www`, A racine, TXT), e-mail `send-domain-ready-notification`.

**Autres** : compteur de visiteurs en direct, **globe 3D du trafic** (`react-globe.gl`), preuve sociale (notifications d'achats récents), barre d'avis défilante, boutique installable en PWA, partage avec métadonnées Open Graph (`share-product`), traduction de la vitrine (`translate-product`, `translate-ui`, 5 langues : fr, en, es, pt, ar).

**Réserves**
- **La cible DNS de `verify-domain-dns` est `sites.visualpro.cloud`** (constante `VISUALPRO_CONFIG.CNAME_TARGET`), l'ancienne marque, alors que `vercel.json` redirige `visuelpro.cloud` vers `ecomfy.cloud`. À vérifier sur un domaine réel : le réglage DNS demandé au marchand pointe peut-être vers un hôte qui n'est plus celui de la production.
- La confidentialité multi-boutiques (`strict_multitenant_privacy`, migration `20260902140000`) **n'est pas appliquée en production**.
- Le champ `google_analytics_code` n'a plus d'écran de saisie libre ; voir F18.

---

### F5. Produits : éditeur, assistant, médias, avis · ✅

**Accès :** dans l'éditeur de boutique ; vue publique `/shop/:slug/p/:productSlug`.

- **Éditeur de produit** (`ProductEditor.tsx`, 2 243 lignes, le plus gros fichier du projet) et **assistant de création** (`ProductWizard.tsx`).
- Prix, prix barré, catégories, **variantes** (sélecteur `SmartVariantSelector`, stockées dans le produit puis copiées dans `order_items.selected_variants`), **offres en lot** (colonne `bundle_title`, migration non déployée), images multiples avec image principale.
- **Audio produit** (`ProductAudioManager`, table `product_audios`), **vidéos courtes** (`ProductShortVideosManager`, affichage public), **générateur de GIF** (`modern-gif`).
- **IA produit :**
  - `generate-product-sheet` (fiche complète : bénéfices, puces) : **1,5 crédit**.
  - `product-ai-optimizer` (analyse sur 30 jours, table `product_ai_analyses`) : **1,5 crédit**.
  - `generate-ai-image` (visuel produit) : 1 crédit.
  - `translate-product` (traduction, table `product_translations`).
- **Avis** (`ProductReviews`, `ReviewsModeration`, vue publique `product_reviews_public`) avec modération.
- **Fiche produit publique** (`ProductView.tsx`, 2 031 lignes) : galerie, variantes, bandeau d'achat, vidéos courtes, avis, bouton WhatsApp, bouton de commande.
- Contenu HTML des descriptions nettoyé par **DOMPurify**.
- Corbeille (`trashHelper`, mais `TrashManager.tsx` est orphelin).

**Réserves**
- Le quota IA quotidien **est désactivé** : `enforceAiQuota` renvoie toujours « autorisé » (commit « bypass ai quota »). La note de conception `mem/visualpro/ai-daily-quota.md` annonce 2 requêtes par jour par utilisateur : **la documentation contredit le code**. Seule la déduction de crédits (`consume_ai_credit`) reste active.
- La suppression de produit est faite côté navigateur, table par table.

---

### F6. Boutique publique et commande du client · ⚠️

**Accès :** `/shop/:slug`, `/shop/:slug/product`, `/order-confirmed`.

- Panier, **formulaire de commande** (nom, téléphone normalisé par pays avec `PhoneInput`, e-mail, adresse, ville, détection du pays), contrôle de la ville (zones d'Abidjan dans `abidjanZones.ts`).
- **Deux modes de paiement** proposés : « À la livraison » et « Mobile Money ».
- **Paniers abandonnés** : un identifiant de session est suivi et la RPC `upsert_abandoned_cart` enregistre le panier ; `mark_abandoned_cart_converted` le clôt à la commande.
- Création de la commande par insertion directe dans `orders` et `order_items`, puis page `/order-confirmed` (message personnalisé de la boutique, conseiller de livraison, WhatsApp).
- Suivi publicitaire : événement `Purchase` pour le paiement à la livraison, `InitiateCheckout` pour Mobile Money (F18).
- Verrou de boutique : `StoreRestrictedLockScreen`, `LockedOrdersScreen`, `ShopPaymentGate` (si la boutique est suspendue pour impayé, F11).

**Réserve majeure :** choisir « Mobile Money » **n'encaisse rien en ligne**. Dans `ShopView.tsx` (lignes 540-625), la commande est insérée avec `payment_method = "mobile_money"` puis le client est renvoyé vers la page de confirmation. **Aucun appel à `process-payment` ni à `ecomfy-pay-initiate`** n'est fait. Le règlement est convenu entre le marchand et son client (WhatsApp, numéro). Ecomfy Pay (F12) n'est pas branché sur cette étape de commande ; il fonctionne par **liens de paiement** distincts (`/pay/:linkKey`).

Le prix, le total et la commission sont calculés **dans le navigateur** puis insérés (constat H10 de l'audit).

---

### F7. Commandes, clients, paniers abandonnés, notifications · ✅

**Accès :** onglets Commandes, Paniers abandonnés, Clients fidèles de l'éditeur de boutique.

- **Liste des commandes** (`OrdersList.tsx`) : filtres, changement de statut, détail client, **export Excel** (`xlsx`), **impression** A4 paysage, statut de livraison affiché (en attente d'assignation, assigné, récupéré, en route, livré, retourné, échec).
- **Livraison planifiée** : modale `ScheduleDeliveryModal`, colonne `scheduled_delivery_date` (migration `20260918120000`, non déployée en production). `getOrderScheduleInfo` relit la date dans les notes de commande (motif `[LIVRAISON PRÉVUE: AAAA-MM-JJ]`) quand la colonne est absente ; synchronisation en temps réel entre appareils.
- **Envoi à un livreur** : `PushToDeliveryModal` (système partenaires, F9).
- **Paniers abandonnés** (`AbandonedCartsList`), **clients fidèles** (`LoyalCustomersList`), **classement des meilleurs vendeurs** (`TopSellersLeaderboard`, orphelin).
- **Notifications de nouvelle commande :** son d'identité (`useSoundIdentity`, fichiers dans `public/sounds`), voix, notification Web Push et locale Capacitor (`useOrderNotifications`), format configurable par boutique (`notificationFormat.ts`, dupliqué dans `send-push-notification`). Déclencheur SQL `notify_new_order_push` (dépend de la migration Vault `20261011120000`, non déployée en production).
- **Statistiques de boutique** (`ShopStatistics`), **finances** (`ShopFinances`), **aperçu** (`ShopOverview`), **résumé hebdomadaire par e-mail** (`send-weekly-finance-summary`), **rappel à 24 h** (`send-24h-reminder`).

---

### F8. Collaborateurs de boutique · ✅

- Invitation par e-mail (`invite-shop-collaborator`, expéditeur Resend avec repli), acceptation par jeton (`/accept-shop-invite`, `AcceptShopInvite.tsx`).
- Permissions : `view_orders`, `manage_catalog`, `view_stats`, `manage_customers`, `full_admin`.
- Les collaborateurs voient les boutiques partagées dans le tableau de bord et la liste.
- Plusieurs migrations de correctif (16-19 septembre) corrigent l'enum et le type `text[]` ; **elles ne sont pas en production** : un nouveau type de rôle (`manage_catalog`, etc.) peut y être refusé.

---

### F9. Livraison : partenaires (ancien système, DLK Services) · ✅

Tables en base : `delivery_providers`, `shop_delivery_connections`, `order_deliveries`, `delivery_company_members`, colonnes `orders.delivery_provider_id`.

- Onglet **Livraison** des paramètres de boutique (`ShopDeliveryPartners`) : recherche, badge « Recommandé » (DLK Services préconfiguré), connecter ou déconnecter, bascule d'**auto-transfert**.
- Déclencheur SQL `auto_transfer_order_to_delivery` : à la confirmation d'une commande, elle est assignée au premier livreur connecté actif.
- Pages livreur `/delivery-signup` (fiche) et `/delivery-dashboard` (KPI, commandes transférées avec coordonnées du client, changement de statut, appel et WhatsApp).
- Tables de zones et de tarifs déjà en production (`delivery_zones`, `delivery_fees`, liste des quartiers d'Abidjan dans `abidjanZones.ts`) ; l'écran qui les administre n'a pas été identifié.
- RLS : un livreur ne voit que les commandes qui lui sont transférées.
- **Attention :** ce descriptif vient de la note de conception `mem/ecommerce/delivery-partners.md`. `/delivery-signup` (`DeliverySignup.tsx`, table `delivery_providers`) est bien celui de l'ancien système, mais `DeliveryDashboard.tsx` (route `/delivery-dashboard`) a aujourd'hui deux onglets (« dispatch » et « team ») qui s'appuient sur le **nouveau** module (F10), dont les tables sont absentes : le tableau de bord livreur décrit dans la note n'existe plus sous cette route.

---

### F10. Ecomfy Livraison (nouveau module) · 🚧 🎭

**Accès :** `/delivery/register`, `/delivery/status`, `/delivery/resubmit`, `/delivery/partner-dashboard`, `/delivery/driver` (application livreur : accueil, scanner, mission), `/delivery-admin` (fondateur), `/delivery-dashboard`.

**Ce que le code prévoit**
- **Inscription d'une société de livraison** (`deliveryService.registerDeliveryCompany`) : société, pays, ville, adresse, gérant (nom, téléphone, WhatsApp, photo, pièce d'identité), photo d'entrepôt, numéro fiscal et registre de commerce, villes couvertes, **dépôts** (hubs) et **livreurs** (photo, pièce d'identité, permis, type de véhicule).
- **Assistant d'intégration** (`DeliveryOnboardingWizard`) et étape de **vérification d'identité** (`DeliveryIdentityVerificationStep`) : reconnaissance de document, catégorie de permis (A moto, B véhicule léger), comparaison faciale avec selfie.
- **Revue par le fondateur** (`/delivery-admin`, 579 lignes) : statuts En attente, En cours de revue, Action requise, Approuvé, Rejeté ; motif obligatoire ; badge de confiance.
- **Expéditions** (`createDispatch`) : statuts `assigned`, `pending_collection`, `in_transit`, `delivered`…, photo du colis, **caisse** (`submitDepositProof`, `confirmSellerDeposit`, `raiseCashDispute` : preuve de dépôt, confirmation du vendeur, litige).
- **Application livreur** : scan de QR (`html5-qrcode`), signature du client (`SignaturePad`), photos.
- Fonction `verify-delivery-identity` : e-mail de décision et mise à jour du badge de confiance.

**Pourquoi c'est 🚧 :** `delivery_companies`, `delivery_hubs`, `delivery_drivers`, `delivery_dispatches`, `delivery_cash_transfers` répondent 404 sur dev. Toute inscription, toute revue et toute expédition échouent. Le menu affiche « Ecomfy Livraison : Bientôt disponible » pour les marchands ; le menu fondateur affiche « Fondation Livraison ».

**Pourquoi c'est aussi 🎭 :** la vérification d'identité est **simulée**.
- `identityVerificationEngine.ts:127` : `const mockMrzFound = true; // In production this invokes Client OCR…` ; le pays est toujours déclaré concordant (`countryMatches = true`), score fixe 95.
- `verifyDriverLicenseCategory` : `detectedCategories = ['A','B']` en dur, donc tout permis non rejeté sur son nom de fichier est « valide » (score 98).
- `DeliveryIdentityVerificationStep.tsx:167-201` fabrique des fichiers factices (`mockDocFile`, `mockLicenseFile`) pour lancer les contrôles.
- La seule logique réelle : rejet d'un fichier dont les proportions ou le nom ressemblent à une facture.
- `kycAbstractionService.ts` définit l'interface d'un prestataire externe (Smile Identity, Veriff, Persona, Onfido) : **aucun prestataire n'est branché**.

Tant que ce n'est pas remplacé, une approbation « automatique » ne prouve rien ; la décision réelle reste celle du fondateur.

---

### F11. Abonnements, crédits IA, codes promo, commissions · ⚠️

**Accès :** `/subscription` (achat de packs, abonnement), `/pricing` (tableau de bord des tarifs), `/payment-history`, `/promo-codes` (fondateur), `/ai-quota`, onglet Facturation de la boutique.

**Offres** (`LandingPricing`, `PricingDashboard`, `Subscription`)
- **Démarrage** : gratuit, 2 vidéos et 5 images IA offertes, **commission de 50 FCFA par commande**.
- **Ecomfy Pro** : 12 000 FCFA par mois (9 900 en annuel), **commission nulle**, domaine personnalisé, 10 vidéos et 20 images IA par mois.
- **Premium Académie** : 35 000 FCFA par mois (28 500 en annuel), 20 vidéos et 40 images IA par mois, accès à la communauté. Le verrou d'accès aux masterclasses est désactivé (`ENABLE_ACADEMY_PREMIUM_LOCK = false`).
- `config/pricingPlans.ts` décrit ces trois plans mais **n'est importé par personne** (👻) : les prix sont recopiés dans plusieurs écrans.
- **Packs de crédits IA** : 2 000 FCFA = 20 crédits, 2 500 = 30, 3 000 = 40.

**Paiement** (Edge Function `process-payment`, 673 lignes, JWT et validation Zod, 10 tentatives par minute et par utilisateur) pour cinq types : abonnement, crédits, activation de boutique, paiement de commission, abonnement de boutique. Fournisseur **GeniusPay** (`geniuspay.ci`) : Wave, Orange Money, MTN MoMo, Moov Money, carte Visa/MC. Retour de statut par `geniuspay-webhook` (HMAC, fenêtre anti-rejeu de 5 minutes, idempotence), filet de sécurité `verify-payment` (appelé depuis la page de succès) et `reconcile-pending-payments` (tâche planifiée). L'ancien connecteur **Lygos** subsiste (`payment-callback`).

**Crédits IA** (`consume_ai_credit`) : fondateur exempté ; abonnement actif = illimité ; sinon un essai gratuit par fonction (`free_optimizer_used`, `free_voice_used`, `free_product_sheet_used`) ; sinon déduction de `profiles.purchased_credits`. Réponse `credits_required` interceptée côté client (`creditsDialog.ts`, `AICreditsBadge`).

**Codes promo** (`PromoCodeManager`, 836 lignes) : pourcentage, montant fixe, livraison gratuite, utilisateur précis ; préréglages « Boutique » et « Fondateur » ; e-mail `send-promo-notification`.

**Commissions et blocage par seuil** (`billingSystem.ts`) : seuil de **240 commandes** (soit 12 000 FCFA à 50 FCFA), échéance de grâce de **3 jours**, états `PAYMENT_DUE`, `GRACE_PERIOD`, `PAYMENT_OVERDUE`, `STORE_RESTRICTED`, `locked`, `final_suspension`. Masquage des données clients et écran de verrouillage. Paiement par le marchand (GeniusPay) ou **enregistrement manuel par un fondateur** (Wave/Orange directs, virement, espèces).

**Réserves**
- Le moteur de seuil repose sur `shop_invoices`, `check_and_trigger_billing_threshold` et `enforce_shop_billing_deadlines`, **créés par la migration `20260909100000` qui n'est pas en production** (`shop_invoices` : 404 sur dev). Le blocage automatique à 240 commandes n'est donc **probablement pas actif** ; le solde de commission (`commission_balance_due`) et le paiement manuel, eux, existent.
- `geniuspay-webhook` contient une `ReferenceError` probable (H7) : les crédits automatiques par ce chemin sont sans doute assurés par `verify-payment` et `reconcile-pending-payments`.
- Le montant et la taille du pack sont décidés par le navigateur (C6, non corrigé).
- `BillingPaymentModal.tsx` et `SubscriptionCard.tsx` sont orphelins ; `useBillingSystem.ts` reste utilisé.
- `ENABLE_ACADEMY_PREMIUM_LOCK = false` : « Premium Académie » ne verrouille encore rien.

---

### F12. Ecomfy Pay · 🚧 🛠️

**Accès :** `/ecomfy-pay` (marchand, 7 onglets : Vue d'ensemble, Portefeuille, Paiements, Liens de paiement, KYC, Méthodes, Paramètres) ; `/pay/:linkKey` (page de paiement client, publique) ; menu « Bientôt disponible ».

**Ce que le code prévoit**
- **Liens de paiement** par boutique (`createPaymentLink`), **page de paiement** client (`EcomfyPayCheckout.tsx`, 413 lignes).
- **Initiation** (`ecomfy-pay-initiate`) : frais Ecomfy de 2,5 %, référence interne `ECM-PAY-XXXXXXXX`, appel GeniusPay ; **webhook** (`ecomfy-pay-webhook`) : marque le paiement réussi, passe la commande à `PAID`, crédite le portefeuille.
- **Portefeuille marchand** : solde en attente, puis **disponible après 72 h** (`ecomfy-pay-settlement` appelle `process_wallet_settlements`), grand livre immuable (`wallet_ledger`), contraintes `CHECK` sur les soldes.
- **Retraits** (`ecomfy-pay-withdraw`) atomiques et verrouillés, vers GeniusPay Payout ; configuration de retrait par défaut (`save_merchant_payout_config`).
- **KYC marchand** (`KycVerificationTab`) : pièce d'identité et selfie, statuts `PENDING`, `UNDER_REVIEW`, `VERIFIED`, `REJECTED`, `RESUBMISSION_REQUIRED`.

**Pourquoi 🚧 :** les 6 tables que le code interroge sont absentes sur dev (`ecomfy_payments`, `payment_events`, `merchant_kyc`, `wallets`, `wallet_ledger`, `withdrawal_requests`) ; la migration en crée 8 au total (avec `settlements` et `ecomfy_pay_settings`). Le fichier `02_c1_wallet_dev.sql` qui les créerait **n'a jamais été exécuté sur dev**, et ne doit pas l'être en production. La table `payment_links` existe déjà pour les **cours** (autre structure) ; le conflit de noms est résolu dans le dépôt depuis le 15/10/2026 (`ecomfy_payment_links`, commit `211f761`), non déployé.

**Pourquoi 🛠️ :** `jeanmarc` apporte, pour ce module, la fin de l'auto-validation KYC (`evaluate_merchant_kyc_security` supprimée, remplacée par `review_merchant_kyc`), le gel des retraits par défaut (`ecomfy_pay_settings.withdrawals_enabled = false`), l'écran de revue `/founder/kyc-review`, le verrouillage des fonctions de portefeuille, la vérification HMAC du webhook et le rappel API GeniusPay. 18 tests SQL sur base jetable pour le KYC, 13 pour le portefeuille, 7 tests Node pour le webhook. **Non testé :** déploiement sur une vraie base Supabase, paiement de bout en bout avec GeniusPay.

**Reste ouvert avant toute ouverture aux marchands :** montants décidés par le client (C6) dans `ecomfy-pay-initiate`, pièces d'identité dans un bucket public (H1), prestataire KYC non choisi, échec de crédit acquitté sans rejeu (M6), `ecomfy-pay-settlement` appelable sans authentification, référence de paiement prévisible (M4), `getWallet()` appelle encore une fonction réservée à `service_role`.

---

### F13. Studio IA et bibliothèque · ⚠️

**Accès :** `/studio`, `/library`, `/ai-quota`. L'entrée de menu est « Studio IA : Bientôt disponible », mais la route fonctionne (liens depuis l'Académie et le tableau de bord).

- **Studio** (`Studio.tsx`, 239 lignes) : mode **image** (texte vers image, ou édition d'une image source jointe) et mode **vidéo** (description, images de référence, plateforme déduite du format : TikTok 9:16, YouTube 16:9, Instagram sinon) ; réglages de format, de style (« professionnel » par défaut) et de durée (10 s) ; ajout de médias ; bouton **« animer cette image »** qui bascule en mode vidéo avec l'image ; téléchargement du résultat. L'avancement d'une vidéo est suivi en temps réel sur `generated_videos`. **L'interface de file d'attente** (`GenerationQueue`, tables `generation_queue`, fonctions `process-queue` et `cancel-queue-item`) **est orpheline** : le Studio n'y passe pas.
- **Commandes `/…`** (`lib/studio/commandRegistry.ts`) : **26 commandes** de direction créative avec alias, priorité, incompatibilités et paramètres : `/UGCmodel`, `/UGCnaturel`, `/UGCcreator`, `/UGCtestimonial`, `/Ads`, `/FacebookAds`, `/InstagramAds`, `/TikTokAds`, `/WhatsAppAds`, `/Product`, `/ProductHero`, `/Catalogue`, `/Ecommerce`, `/Premium`, `/Cinematic`, `/Luxury`, `/Natural`, `/Minimal`, `/Studio`, `/Lifestyle`, `/Storytelling`, `/Testimonial`, `/BeforeAfter`, `/Promo`, `/Offer`, `/ProblemSolution`. Autocomplétion à la barre oblique. `commandResolver.ts` (résolution des conflits) est orphelin et son test ne peut pas être exécuté.
- **Moteurs :** images `generate-ai-image` (OpenAI, avec édition par `/v1/images/edits`), `generate-feature-image` (DALL-E 3 puis OpenRouter puis repli), `generate-ad-visual` ; vidéos `generate-video` (Runway, OpenAI, Replicate), `create-video-from-image` (Cloudinary) ; voix off `generate-voiceover` (ElevenLabs, voix à accent africain) ; marque `extract-brand` (avec protection SSRF) ; correcteur `correct-text`.
- **Bibliothèque** (`Library.tsx`) : onglets Images et Vidéos, formats d'image, suppression.
- **Quota :** page `/ai-quota` (table `ai_daily_usage`, RPC `get_ai_quota`).

**Réserves**
- `Generator.tsx` (1 932 lignes), `VideoCreator.tsx` et une quinzaine de composants de l'ancien générateur (`AIImageGenerator`, `AdvancedImageGenerator`, `VideoGenerator`, `VariationGenerator`, `ImageEditor`, `GenerationQueue`, `AdTemplateSelector`…) sont **orphelins** : `/generator` redirige vers `/studio`.
- Le message d'erreur d'`Studio.tsx` annonce « 3 générations gratuites » alors que la configuration de plans annonce 5 images et 2 vidéos.
- Quota quotidien désactivé (F5).
- `test-openai-image` est déployable comme fonction de production (appels payants).

---

### F14. Assistants IA de boutique · ⚠️

- **Assistant de boutique** (`ShopAIAssistant`, `ShopAssistantSettings`) : chat de vitrine avec connaissance du catalogue (`shop-ai-assistant-chat`, passerelle Lovable AI/Gemini) et **synthèse vocale** (`shop-ai-assistant-tts`, ElevenLabs, voix « Charlotte » par défaut, **2 crédits par message facturés au propriétaire**).
- `shop-chatbot` (vitrine), `showcase-chat` (sites vitrines), `finance-advisor` (conseiller financier), `generate-shop-content`.
- Limitation par IP (20 messages par minute) ; le TTS est à 30 requêtes par minute par IP avec **échec ouvert** si l'infrastructure de limitation tombe.
- **Réserve :** ces fonctions sont publiques (`verify_jwt = false`) ; seul le crédit du propriétaire borne la dépense.

---

### F15. Académie, cours payants, certificats · ⚠️

**Académie** (`/academy`, 782 lignes) : catalogue de **vidéos YouTube en dur** (`ACADEMY_VIDEOS`) en 3 catégories (Ecomfy, Facebook, Ventes), niveaux (Débutant à Avancé), points clés, liens d'action vers l'application (« Créer ma boutique », « Gérer mes produits », « Ouvrir le Studio IA »…), suivi de progression. Exemples : « Création et paramétrage complet de votre boutique Ecomfy » (15 min), « Créer et configurer un compte Facebook Business Manager », « Lancer votre première campagne publicitaire rentable ».

**Cours payants et étudiants** (tables `courses`, `course_modules`, `module_contents`, `enrollments`, `student_access`, `student_progress`, `course_certificates`, toutes présentes) :
- Gestion des cours (`CoursesManager.tsx`, 949 lignes, onglets Modules, Étudiants, Paramètres), création de compte étudiant (`create-student-account`, sans réinitialiser un mot de passe existant) et gestion d'accès (`manage-student-access`).
- Inscription (`/enroll/:courseId`, `EnrollmentCheckout`) via `payment_links` (liens de paiement de **cours**).
- Parcours étudiant (`/student`, `/student-dashboard`, `/student/course/:courseId`), progression, **certificats** générés (`generate-certificate`, HTML échappé, QR) et **vérifiables publiquement** (`/verify-certificate/:number`, RPC `verify_certificate_by_number`).

**Réserves**
- `/courses-manager`, `/referral`, `/ai-quota`, `/feedback`, `/associate-space`, `/founder/shop-payment-control` et `/founder/seo-preview` n'ont **aucun lien dans l'interface** (accessibles par adresse directe seulement).
- Les cours étaient vendus depuis les sites vitrines (F16), qui sont orphelins : la création de cours reste possible par `/courses-manager`, mais plus aucun site public ne les présente.
- `CoursePreviewViewer`, `ModulesTabContent`, `FormationsEditor` sont orphelins.

---

### F16. Sites vitrines (Showcase) · 👻

**Aucune route.** `App.tsx` ne déclare aucune page de site vitrine. Sont livrés mais inatteignables : 12 composants `components/showcase/*` (Accueil, À propos, Biographie, Blog, Contact, Cours, Détail de cours, Formations, Galerie, Services, Pied de page), `ShowcasePreview`, `ShowcaseDashboardCard`, `ShowcaseAIChat`, `ShowcaseVersionHistory`, `BlogManager`, `GalleryManager`, `VideoGalleryManager`, `VideoUploader`, `BiographyEditor`, `TestimonialsEditor`, `FeaturesEditor`, `SEOEditor`, `BookingCalendar`, `BookingForm`, `BookingsViewer`, `ContactForm`, `ContactSubmissionsViewer`, `AnalyticsViewer`, `DevicePreview`, soit **≈ 37 fichiers**.

Côté serveur, restent déployables : `generate-showcase-site` (génération IA d'un site), `showcase-chat`, `send-booking-notification`, `send-contact-notification` (anti-spam à 5 messages par 10 minutes), et les tables `showcase_*` (présentes). La page `Blog.tsx` est aussi orpheline.

Seul vestige actif : le tableau de bord fondateur lit `showcase_sites` pour ses compteurs. Le manifeste PWA continue à annoncer « sites vitrines et formations ».

**Décision à prendre :** rebrancher (route publique `/site/:slug` et entrée de menu) ou retirer le code et les fonctions.

---

### F17. Communauté (chat de marchands) · ✅

**Accès :** `/community` (protégé), 706 lignes.

- Salon de discussion (`#Général`) en **temps réel**, mentions par `@` (RPC `search_community_profiles`, `get_community_profiles`), **réactions emoji**, suppression de ses messages, sélecteur d'emojis.
- Pastille de messages non lus (`useCommunityUnread`), notifications (`useCommunityNotifications`).
- Tables présentes en base : `community_topics`, `community_replies`, `community_likes`, `community_messages`, `community_message_reactions`.

### F17b. ConnectUs (réseau social) · 🚧 🎭

**Accès :** `/connectus`, `/connectus/*` ; menu « Bientôt disponible ». Module isolé dans `src/modules/connectus/` (composants, hook, service de 1 437 lignes, types).

**Ce que le code prévoit :** profils, fil d'actualité, publications (images, **aperçu de liens** via `linkScraper`), **stories** (barre et lecteur), likes, commentaires, abonnements, **messagerie privée**, centre de notifications, invitation d'un utilisateur, intégration à l'onboarding (modale), recherche de membres en temps réel. Un script de peuplement existe (`npm run seed:connectus`).

**Pourquoi 🚧 :** les 9 tables `connectus_*` (profils, publications, likes, commentaires, abonnements, stories, notifications, conversations, messages) sont absentes sur dev. Tout chargement de fil échoue.

**Pourquoi 🎭 :** l'onglet **« Live Commerce »** est une carte statique (icône et texte), pas un direct vidéo. L'encart **« Marchands recommandés »** affiche deux comptes **fictifs en dur** (« Koffi Mensah / Koffi Fashion », « Aminata Diallo / Aminata Bio Care », images Unsplash). La section est aussi mise en avant sur la landing (`LandingConnectUsSection`).

---

### F18. Marketing : pixels, API de conversion, comptes publicitaires · ✅

- **Pixels navigateur** (`lib/tracking.ts`) : Facebook/Meta, TikTok, Snapchat, GA4, avec identifiants **validés strictement** (`lib/trackingIds.ts`). Sur `jeanmarc`, le chemin « code libre » (XSS stocké, C8) est supprimé ; **sur `main`, il existe encore**.
- **API de conversion côté serveur** (`track-conversion`) vers Meta, TikTok, Snapchat et GA4, avec le même `event_id` que le pixel pour la déduplication ; 60 requêtes par minute par IP. Optimisé pour le paiement à la livraison (commit du 24 septembre).
- **Réconciliation Meta** (`reconcile-tracking`, `TrackingReconciliation`) : compare les commandes Ecomfy de la période (hors annulées, hors paiement échoué) aux événements Meta.
- **Comptes publicitaires** (`AdAccountsManager`, tables `ad_accounts`, `ad_spend_daily`), **synchronisation des dépenses** Meta (`sync-ad-spend`), alerte d'**expiration de jeton** (`check-ad-token-expiry`, e-mail `ad-token-expiring`).
- **Suivi des visites** (`track-shop-visit`) : pays (`cf-ipcountry`), appareil, navigateur, source (UTM d'abord), table `shop_visits`.

---

### F19. SEO Intelligence · 🚧 🎭

**Accès :** `/seo`, `/seo/*` (entrée « SEO Intelligence 🔍 » du menu, **active**) ; `/founder/seo-preview` (fondateur).

**Écrans (`SeoIntelligencePage.tsx`, 1 007 lignes)** : Vue d'ensemble, Audit SEO, SEO Technique, Google Search Console, Performance, Mots-clés, Pages, Opportunités, Indexation et inspection, Historique et rapports, Paramètres.

**Ce que le code fait**
- **Audit technique** (`seoAuditService`) : score pondéré (technique 25, performance 20, contenu 20, indexabilité 15, métadonnées 10, mobile 10), problèmes classés critique, important, optimisation, avec recommandations.
- **PageSpeed Insights** réel (appel direct à l'API Google, mobile et bureau, LCP, FCP, CLS, TTFB).
- **Google Search Console** (OAuth `gsc-oauth-flow`, métriques `gsc-analytics`, cache des requêtes, détection d'« opportunités »).
- **Auto-indexation** (`seo-auto-index` : soumet le plan du site à Google et prévient les moteurs lors d'une mise à jour de boutique ou de produit).
- Rapports (`seoReportService`), prévisualisation de données structurées.

**Pourquoi 🚧 :** `shop_seo_connections`, `shop_seo_audits` et `shop_seo_queries_cache` sont absentes de dev (migration `20260902120000` non déployée). Les audits ne peuvent pas être enregistrés, la connexion Search Console ne peut pas être mémorisée.

**Pourquoi 🎭 :** `App.tsx` rend `<SeoIntelligencePage />` **sans propriété `shop`**. La page se rabat alors sur une **boutique de démonstration codée en dur** (`id: "demo-shop"`, « Boutique Démo », `maboutique.ecomfy.cloud`). Aucune sélection de la boutique réelle de l'utilisateur n'est branchée sur la route (lecture du code, non confirmé dans un navigateur). Les indicateurs de base de l'audit (performance 85, mobile 95, `robots.txt` « présent ») sont des valeurs de départ fixes.

`GlobalAdminSeoDashboard.tsx` et `CredibilityBar.tsx` sont orphelins.

---

### F20. Affiliation et parrainage · 🚧

**Accès :** `/affiliate` (entrée de menu **active**, protégée, 644 lignes) ; fondateur : onglet « Affiliés » du tableau de bord (`FounderAffiliateAdmin`). Ancien parrainage : `/referral` (sans lien).

**Ce que le code fait** (migration `20261005160000`, commits du 5 octobre)
- **Code personnel** généré à partir du **vrai nom** de l'utilisateur avec suffixe alphanumérique contre les homonymes ; lien de parrainage mémorisé dans `localStorage` (`ecomfy_affiliate_ref`).
- **Commission par défaut de 20 %** sur les paiements `completed` des filleuls ; périodes **trimestrielles** ; seuil minimum de paiement configurable ; statuts de commission (dont `PAYABLE` et `REVERSED`).
- **Méthodes de paiement** : Wave, Orange Money, MTN Money, Moov Money, virement bancaire.
- Onglets : Vue d'ensemble, Filleuls, Commissions, Historique.
- Côté fondateur : vue d'ensemble, liste des affiliés, **paiement manuel** (`markPayoutPaid`), journal d'audit.

**Pourquoi 🚧 :** les 8 tables `affiliate_*` sont absentes de dev ; la page ne peut rien afficher. Chaque connexion déclenche un appel d'enregistrement qui échoue silencieusement.

**Réserves de sécurité non corrigées (H6, groupe B)** : un utilisateur peut s'attribuer un taux de commission arbitraire et rattacher d'autres comptes à son code ; les RPC d'affiliation n'ont pas de contrôle de l'appelant ; la commission s'applique à tous les types de paiement et les remboursements ne sont pas annulés. **À corriger avant le déploiement de la migration.** Deux tests existent (`src/test/affiliateSystemTest.test.ts`, `profileCompletionTest.test.ts`) mais ne sont pas exécutables.

L'**ancien système de parrainage** (`Referral.tsx`, table `referrals`, RPC `process_referral_signup`) reste dans le code et dans l'inscription ; il n'a aucun lien depuis l'interface.

---

### F21. Gouvernance d'entreprise et espace associé · ⚠️

**Accès :** `/corporate-governance` (fondateur), `/governance/onboarding`, `/governance/invitation/:token`, `/governance/documents/:documentId`, `/associate-space`.

**Ce que ça fait**
- **Table de capitalisation** (`corporate_shareholders`, `corporate_share_allocations`, instantanés `corporate_cap_table_snapshots`), **vesting** (plans et jalons), propriété intellectuelle, cas de départ.
- **Documents de gouvernance** (11 documents de départ dans `data/initialGovernanceDocs.ts`, dont la « Charte de gouvernance Ecomfy »), versions, **acceptations** (`corporate_document_acceptances`), avertissement juridique intégré.
- **Propositions** avec approbations, **journal d'audit** (`corporate_audit_logs`).
- **Invitations d'associés** par e-mail (`send-corporate-invite`) avec jeton, rôles : cofondateur, actionnaire, investisseur, administrateur.
- **Parcours d'intégration en 6 étapes** : Invitation, Identité (« MFA » : l'écran marque l'étape « e-mail vérifié »), Documents, Lecture, Approbation, Activation ; puis **Espace associé** (7e étape).
- Onglets de `CorporateGovernance` : cap table, vesting, documents, invitations, audit.

**Réserves**
- **Aucune authentification multifacteur réelle** : l'étape « Identité MFA » s'appuie sur un e-mail vérifié (`AssociateSpace.tsx:151`).
- `corporate_invitations` est **absente de dev** ; les invitations échouent tant que `20260906000000` n'est pas déployée.
- Les 14 tables `corporate_*` sont **ouvertes en lecture et écriture à tout utilisateur connecté en production** (H2, confirmé) ; le hotfix `20261012120000` est validé sur dev mais **non déployé en production**.
- `send-corporate-invite` accepte un destinataire, un rôle et une URL libres (H4).

---

### F22. Espace fondateur · ⚠️

**Accès :** menu « Administration » (rôles `founder`, `co_founder`, `shareholder`, `admin`).

| Écran | Route | Contenu | État |
|---|---|---|---|
| Tableau de bord | `/founder-dashboard` (1 467 lignes) | Plages 7/30/90 jours ; revenus, paiements par méthode, inscriptions ; onglets Utilisateurs, Boutiques, Paiements, Codes promo, Affiliés, Retours, Gouvernance ; **audit des revenus** ; saisie d'un identifiant de boutique pour **activation manuelle** et **paiement manuel** (Wave/Orange/MTN/Moov directs, virement, espèces) | ✅ |
| Dépannage | `/founder-troubleshooting` | Diagnostic de boutique, activation, état de la base ; `app-remediation` (marque comme échoués les paiements bloqués depuis plus d'une heure ; aucune écriture d'argent) | ✅ |
| Gestion des fondateurs | composant `FounderManager` | Nommer et révoquer des rôles via `manage-founder-roles` ; e-mail d'invitation | 🛠️ |
| Revue KYC | `/founder/kyc-review` | Liste des dossiers (À examiner, Validés, Rejetés, À re-soumettre, Tous), fiche, validation, rejet avec motif obligatoire | 🛠️ (table `merchant_kyc` absente de dev) |
| Contrôle des paiements de boutique | `/founder/shop-payment-control` | Statut de paiement des boutiques (Active, Paiement en attente, Verrouillée, Fermeture définitive), **réactivation** (`founder_reset_shop_payment`), **délai supplémentaire** de N jours (`founder_grant_extra_deadline`) | ⚠️ sans lien de menu ; dépend du moteur de seuil de F11 |
| Aperçu SEO | `/founder/seo-preview` | Prévisualisation | 👻 sans lien |
| Fondation Livraison | `/delivery-admin` | Revue des sociétés de livraison | 🚧 |
| Codes promo | `/promo-codes` | Voir F11 | ✅ |
| Console API | `/api-documentation` | Voir F23 | 🎭 |
| Moniteur de santé | `app-health-monitor` | Toutes les 5 minutes, incidents persistés (`app_incidents`), e-mail à la première occurrence ; actions `app-remediation` | ⚠️ tâche planifiée à vérifier |

**Réserves**
- Avant les correctifs de `jeanmarc`, **n'importe quel e-mail contenant « djateulrich » est traité en fondateur principal** (C7). Corrigé dans le code, déployé sur dev uniquement.
- Les gardes `ProtectedRoute` et `FounderRoute` sont visuelles ; la vraie barrière est la RLS. `ProtectedRoute` ignore `requireActiveSubscription`.
- Sur dev, `user_roles` renvoyait HTTP 500 (récursion de politique) : l'espace fondateur affichait « Accès restreint » pour les comptes sans contournement par e-mail. Corrigé par `04_user_roles_rls.sql` (dev). **À reporter en production** (la politique fautive y est très probablement aussi).

---

### F23. Plateforme transversale · ⚠️

| Brique | État | Détail |
|---|---|---|
| **PWA** | ✅ | `manifest.webmanifest`, service worker `injectManifest` (`src/sw.js`), bandeau d'installation (`InstallPwaBanner`), mise à jour (`registerPwaUpdate.ts`), rechargement automatique après chunk obsolète (`lazyWithRetry`), préchargement au repos (`IdlePrefetcher`). Le cache HTML est désactivé dans `vercel.json`. |
| **Notifications push web** | ✅ | VAPID (`get-vapid-key`), abonnements (`push_subscriptions`, présente), envoi `send-push-notification`. |
| **FCM / natives** | 👻 | `useFCM.ts` et `firebase.ts` orphelins ; `useNativePush` ne sert que dans une application Capacitor qui n'existe pas (F24). |
| **E-mails transactionnels** | ✅ | Resend et passerelle Lovable ; file `process-email-queue` (pgmq), journal `email_send_log`, liste de suppression (`handle-email-suppression`), désinscription en un clic RFC 8058 (`handle-email-unsubscribe`, page `/unsubscribe`), aperçu des modèles. 6 modèles transactionnels (jeton publicitaire expirant, alerte d'incident, paiement de commission, résumé financier hebdomadaire, activation de boutique, invitation de collaborateur) et 6 modèles d'authentification. |
| **Internationalisation** | ⚠️ | i18next (fr, en, es, pt, ar) mais **108 clés par langue seulement** : l'essentiel du texte est en français en dur, complété par une traduction automatique du DOM (`autoTranslateDOM` → `translate-ui`). |
| **Serveur MCP** | ✅ | Fonction `mcp` : trois outils de lecture, `list_my_shops`, `list_shop_products`, `list_shop_orders`, avec le jeton de l'utilisateur (RLS appliquée). La page `/oauth/consent` permet d'autoriser un client OAuth (probablement ce client MCP ; le lien n'a pas été tracé). Fichier généré par Lovable. |
| **API REST publique** | 🎭 | **N'existe pas.** `ApiDocumentation.tsx` (742 lignes) documente `https://ecomfy.cloud/api/v1/products` et `/orders`, gère des **clés d'API** (table `api_keys`) mais : (1) aucune Edge Function ni route ne sert `/api/v1`, `vercel.json` renvoie tout vers `index.html` ; (2) **aucune fonction ne lit `api_keys`** ; (3) le bouton « Tester » `/orders` renvoie une commande **inventée** (`ord_2026_0824`, « Jean Marc ») et `/shops` lit la base du navigateur ; (4) le test de webhook envoie seulement un exemple depuis le navigateur. |
| **Moniteur de santé** | ⚠️ | `app-health-monitor` toutes les 5 minutes. La planification pointait vers un ancien projet avant `20261011120000` : à vérifier (`select command from cron.job`). |
| **Sécurité (en-têtes)** | ⚠️ | `public/_headers` (format Netlify) est **ignoré par Vercel** ; `vercel.json` ne définit que le cache (H8). |
| **Gestion d'erreurs** | ✅ | `ErrorBoundary`, page 404 soignée, `error-handler.ts` avec masquage des secrets et identifiants de corrélation. |
| **Accessibilité / design** | — | `ACCESSIBILITY.md`, `DESIGN_SYSTEM.md`, `UI_COMPONENTS.md`, `RESPONSIVE_GUIDELINES.md` existent ; pas mesuré ici. |

---

### F24. Application mobile native · 📝

`capacitor.config.ts` (appId `cloud.visuelpro.app`, notifications push et locales, son `visualpro_cash.wav`), dépendances Capacitor 8, scripts `native:android` / `native:ios`, `NATIVE-SETUP.md` et `scripts/setup-native.sh`. **Les dossiers `android/` et `ios/` n'existent pas dans le dépôt** : aucune application native n'est générée ni suivie. Le guide cite encore l'ancien dépôt `visualpro-african-ai-creations`. Deux vulnérabilités critiques `npm audit` concernent Capacitor Android/iOS 8.5.0 (M10).

---

## 4. Code présent mais non branché, ou annoncé mais non réel

### 4.1 Pages et composants orphelins (graphe d'imports depuis `main.tsx`)

83 fichiers sur 464 (hors `components/ui`) ne sont atteints par aucun import :

| Famille | Fichiers |
|---|---|
| Pages | `Blog`, `Generator`, `VideoCreator` ; `VerifyEmail` est importée sans route |
| Sites vitrines | 12 composants `showcase/*`, `ShowcasePreview`, `ShowcaseDashboardCard`, `ShowcaseAIChat`, `ShowcaseVersionHistory`, `BlogManager`, `GalleryManager`, `VideoGalleryManager`, `VideoUploader`, `BiographyEditor`, `TestimonialsEditor`, `FeaturesEditor(WithImages)`, `FormationsEditor`, `SEOEditor`, `BookingCalendar/Form/sViewer`, `ContactForm`, `ContactSubmissionsViewer`, `AnalyticsViewer`, `DevicePreview`, `CoursePreviewViewer`, `ModulesTabContent`, `CoursesManager` (composant), `PaymentLinksManager` |
| Ancien générateur IA | `AIImageGenerator`, `AdvancedImageGenerator`, `VideoGenerator`, `VariationGenerator`, `ImageEditor`, `GenerationQueue`, `AdTemplateSelector`, `TemplatePreviewDialog`, `BrandExtractor`, `TextCorrector`, `SpellCheckText`, `MultiImageUploader` |
| Landing | 6 sections `Landing*` + `LandingMediaSections` |
| Livraison | `CustomerParcelPhotoModal`, `DeliveryActivationGuard`, `DispatchOrderModal` |
| Facturation | `BillingPaymentModal`, `SubscriptionCard` |
| SEO | `GlobalAdminSeoDashboard`, `CredibilityBar` |
| Divers | `StartChecklist`, `TopSellersLeaderboard`, `TrashManager`, `UserAvatar`, `BackButton`, `ApiErrorState`, `SimpleWorkflow`, `useFCM`, `firebase.ts`, `useScrollAnimation`, `shareLinks`, `textOverlay`, `trashHelper`, `commandResolver`, `config/brand.ts`, `config/pricingPlans.ts` |

À la racine du dépôt traînent aussi des scripts de travail qui lisent `.env` (`scratch*.js/.ts/.cjs`, `test-*.js/.ts/.cjs/.mjs`, `check_db.js`, `query_videos.mjs`, `patch_*.mjs`, `fix_*.patch`, `extract-bag.py`, `trim-favicon.py`) et `src/App.tsx.orig`.

### 4.2 Annoncé, mais factice ou inexistant

| Annonce | Réalité |
|---|---|
| API REST publique `/api/v1` avec clés d'API | Inexistante ; clés stockées mais jamais lues ; réponses de test fabriquées |
| Live Commerce ConnectUs | Carte statique |
| « Marchands recommandés » de ConnectUs | Deux comptes fictifs |
| Vérification d'identité automatique des livreurs (OCR, permis, visage) | Résultats codés en dur |
| SEO Intelligence pour la boutique de l'utilisateur | Boutique de démonstration |
| Authentification multifacteur de l'espace associé | Étape qui coche « e-mail vérifié » |
| Quota IA de 2 requêtes par jour | Désactivé dans le code |
| Mobile Money en ligne dans la boutique | Aucun encaissement ; commande enregistrée seulement |
| Stock traçable (`stock_movements`, `inventory_units`) | Retiré du code le 3 octobre ; tables jamais créées en production |
| Paiement Stripe et CinetPay (`Gemini.md`) | Le code n'utilise que GeniusPay (et un reliquat Lygos) |

### 4.3 Modules marqués « Bientôt disponible » dans la navigation

Barre latérale (`AppSidebar.tsx:185-190`) et barre mobile (`MobileBottomNav.tsx:34-39`) : **ConnectUs**, **Ecomfy Pay**, **Studio IA**, **Ecomfy Livraison**. Un clic affiche seulement un message. Les routes restent ouvertes par adresse directe ou par des liens internes (l'Académie renvoie vers `/studio`). C'est un **garde-fou de produit**, pas de sécurité : `/ecomfy-pay` est protégée seulement par la connexion.

Un seul de ces quatre modules (Studio IA) a sa base ; Ecomfy Pay, Ecomfy Livraison et ConnectUs ne l'ont pas. Le message « Bientôt disponible » est donc **exact** pour F10, F12 et F17b, et **trompeur** pour le Studio IA, qui fonctionne.

---

## 5. Plans documentés, sans code

| Document | Contenu | État |
|---|---|---|
| `docs/MIGRATION-LARAVEL.md` | Migration progressive de Supabase vers une API Laravel (Laravel d'abord connecté à la base Postgres existante, JWT Supabase validés, 9 phases, moteur de base décidé plus tard) | 📝 aucun code |
| `docs/FRONTEND-MVC.md` | Restructuration du front par domaine (modèles, vues, contrôleurs, services), SEO et ConnectUs comme références | 📝 aucun code |
| `docs/corporate-governance/README.md` | Documentation de la gouvernance | Existe |
| `FRONTEND_ARCHITECTURE.md`, `FRONTEND_CHANGELOG.md` | Architecture et journal du front | Existent, non revus ici |
| `SECURITY-AUDIT-2026-06.md` | Audit de juin : plusieurs points « corrigés » ne le sont pas en production (en-têtes, H8) | Partiellement obsolète |
| `Gemini.md`, `README.md` | `README` = texte Lovable générique ; `Gemini.md` décrit CinetPay et Stripe | Obsolètes |

---

## 6. Ce qui bloque l'ouverture de chaque module

| Module | Pour l'ouvrir aux marchands | Ordre conseillé |
|---|---|---|
| **Correctifs de sécurité (jeanmarc)** | Fusionner dans `main` ; appliquer en production le hotfix `20261012120000` puis `130000`, `140000`, `150000`, `160000` (après snapshot et déploiement préalable des Edge Functions `founder-*`) ; ne **pas** utiliser `supabase db push` | 1 |
| **F11 blocage par seuil** | Déployer `20260909100000` (C3 corrigé dans la migration d'origine sur `jeanmarc`) puis `20261012130000`, qui réserve `confirm_invoice_payment` à `service_role` ; corriger auparavant `check_and_trigger_billing_threshold` et `enforce_shop_billing_deadlines` (groupe B de l'audit, encore appelables par `anon`) ; vérifier `shops.commission_balance_due` | 2 |
| **F21 gouvernance** | `20260906000000` (`corporate_invitations`) après correction de sa politique (H2 restant) | 2 |
| **F19 SEO** | `20260902120000` + brancher la boutique réelle sur la route `/seo` | 3 |
| **F10 Ecomfy Livraison** | `20260906010000` + `20260907140000` ; remplacer la vérification simulée par un prestataire ou la décision manuelle uniquement ; corriger H5 (`verify-delivery-identity` sans contrôle de rôle) | 3 |
| **F17b ConnectUs** | `20260912150000` ; retirer les comptes fictifs ; masquer ou implémenter le « Live » | 3 |
| **F20 Affiliation** | Corriger H6 et le groupe B **avant** `20261005160000` | 4 |
| **F12 Ecomfy Pay** | Déployer le renommage `ecomfy_payment_links` (fait dans le dépôt), appliquer C6 (montants serveur), H1 (bucket KYC privé), choisir le prestataire KYC, tester GeniusPay en bac à sable, **puis** passer `withdrawals_enabled` à `true` | 5 (le plus risqué : de l'argent réel) |
| **F16 Sites vitrines** | Décider : rebrancher ou supprimer | À décider |
| **F23 API REST** | Décider : la construire (Edge Function `api` validant `api_keys`) ou retirer la page et la promesse | À décider |

---

## 7. Ce qui n'a pas pu être vérifié

- **Le contenu réel de la production** : aucun accès. Les conclusions « absent en production » viennent de la copie dev et des deux requêtes faites par l'utilisateur sur la production.
- **Ce que Vercel sert vraiment** : on suppose `main`. Variables d'environnement Vercel, domaines personnalisés réels, jobs `pg_cron` réels : non inspectés.
- **Les fonctions SQL** : la sonde de fonctions n'est pas fiable (voir 0.3). Les affirmations sur la présence de fonctions viennent des migrations et des documents d'audit, pas d'une mesure.
- **Aucun écran n'a été ouvert dans un navigateur** pour ce rapport : les affirmations « page vide », « boutique de démonstration », « 404 sur `/statistics` » sont des **lectures de code**.
- **Les Edge Functions déployées** : la liste de ce qui est déployé en production est inconnue ; seule la liste du déploiement sur dev est documentée.
- Les secrets (GeniusPay, OpenAI, ElevenLabs, Resend, VAPID) : présence non vérifiée.
- Tests : aucun test exécuté pour ce rapport.

---

## Annexe A. Edge Functions (71), par domaine

| Domaine | Fonctions |
|---|---|
| Paiement et facturation | `process-payment`, `verify-payment`, `geniuspay-webhook`, `payment-callback` (Lygos), `reconcile-pending-payments`, `founder-activate-shop`, `founder-record-commission-payment` |
| Ecomfy Pay | `ecomfy-pay-initiate`, `ecomfy-pay-webhook`, `ecomfy-pay-settlement`, `ecomfy-pay-withdraw` |
| IA image, vidéo, voix | `generate-ai-image`, `generate-feature-image`, `generate-ad-visual`, `generate-video`, `create-video-from-image`, `generate-voiceover`, `extract-brand`, `correct-text`, `test-openai-image` |
| IA produit et boutique | `generate-product-sheet`, `product-ai-optimizer`, `translate-product`, `translate-ui`, `generate-shop-content`, `generate-showcase-site`, `finance-advisor`, `shop-ai-assistant-chat`, `shop-ai-assistant-tts`, `shop-chatbot`, `showcase-chat` |
| File de génération | `process-queue`, `cancel-queue-item` |
| E-mail | `send-email`, `send-transactional-email`, `process-email-queue`, `auth-email-hook`, `preview-transactional-email`, `handle-email-suppression`, `handle-email-unsubscribe`, `send-subscription-email`, `send-domain-ready-notification`, `send-corporate-invite`, `send-booking-notification`, `send-contact-notification`, `send-promo-notification`, `send-generation-reminder`, `send-24h-reminder`, `send-weekly-finance-summary` |
| Push | `send-push-notification`, `get-vapid-key` |
| Boutique | `invite-shop-collaborator`, `verify-domain-dns`, `share-product`, `dynamic-sitemap`, `track-shop-visit` |
| Marketing | `track-conversion`, `reconcile-tracking`, `sync-ad-spend`, `check-ad-token-expiry` |
| SEO | `gsc-oauth-flow`, `gsc-analytics`, `seo-auto-index` |
| Académie | `create-student-account`, `manage-student-access`, `generate-certificate` |
| Livraison | `verify-delivery-identity` |
| Fondateur et exploitation | `manage-founder-roles`, `app-health-monitor`, `app-remediation` |
| Plateforme | `mcp` |

Partagé (`_shared/`) : `ai-quota` (désactivé), `credits-gate`, `cron-auth` (accepte un JWT non vérifié, H3), `founderAuth`, `geniuspayConfig`, `openai-config`, `openai-key`, `openrouter-chat`, `openrouter-image`, `prompt-engine`, `webhookSignature`, modèles d'e-mail.

## Annexe B. Services externes

GeniusPay (paiement), OpenAI (images, texte), OpenRouter, Replicate, Runway, ElevenLabs (voix), Lovable AI Gateway/Gemini (chats, traductions, extraction de marque, sites vitrines), Cloudinary (vidéo), Resend (e-mails), Google Search Console et PageSpeed Insights, Meta, TikTok, Snapchat et GA4 (conversions), Web Push (VAPID), Firebase (client orphelin), Vercel (hébergement), Supabase (base, authentification, stockage, temps réel, Vault, `pg_cron`, `pgmq`, `pg_net`), Unsplash (images de démonstration).

## Annexe C. Résultat de la sonde de la base dev (12 octobre 2026)

**36 tables référencées par le code et absentes de dev :**

| Module | Tables absentes |
|---|---|
| Ecomfy Pay | `ecomfy_payments`, `payment_events`, `merchant_kyc`, `wallets`, `wallet_ledger`, `withdrawal_requests` |
| ConnectUs | `connectus_profiles`, `connectus_posts`, `connectus_post_likes`, `connectus_comments`, `connectus_follows`, `connectus_stories`, `connectus_notifications`, `connectus_conversations`, `connectus_messages` |
| Affiliation | `affiliates`, `affiliate_payout_methods`, `affiliate_referrals`, `affiliate_payout_periods`, `affiliate_payouts`, `affiliate_commissions`, `affiliate_settings` |
| Ecomfy Livraison | `delivery_companies`, `delivery_hubs`, `delivery_drivers`, `delivery_dispatches`, `delivery_cash_transfers` |
| SEO Intelligence | `shop_seo_connections`, `shop_seo_audits`, `shop_seo_queries_cache` |
| Gouvernance | `corporate_invitations` |
| Facturation par seuil | `shop_invoices` |
| Sans migration d'origine | `product_bundles`, `product_variants`, `cart_items`, `billing_history` |

**Tables présentes (extraits utiles) :** `order_deliveries`, `delivery_providers`, `shop_delivery_connections`, `delivery_company_members`, `platform_stats`, `push_subscriptions`, les cinq tables `community_*`, `courses` et ses dépendances, `showcase_*`, `corporate_*` (14, sauf `corporate_invitations`), `commission_payments`, `user_roles`.

Tables non référencées par le code et donc non sondées : `shop_seo_settings`, `shop_seo_pages_cache`, `shop_seo_history`, `delivery_company_reviews`, `stock_movements`, `inventory_units`, `warehouses`, `inventory_levels`, `delivery_zones`, `delivery_fees`, `delivery_vehicles`, `delivery_payments`, `shop_payment_events`.

## Annexe D. Écarts entre la documentation et le code

| Document | Affirmation | Réalité |
|---|---|---|
| `mem/visualpro/ai-daily-quota.md` | 2 requêtes IA par jour et par utilisateur | `enforceAiQuota` renvoie toujours « autorisé » |
| `mem/ecommerce/delivery-partners.md` | Pages livreur `/delivery-signup` et `/delivery-dashboard` du système DLK | `/delivery-dashboard` utilise désormais le nouveau module (tables absentes) |
| `AUDIT-PROJET-2026-10.md` §3 | 74 pages, « la plupart des briques existent réellement » | Vrai pour le code, faux pour la base : 5 modules sans tables, 1 module orphelin |
| `AUDIT-PROJET-2026-10.md` §3.6 | « Sites vitrines (blog, galerie, services, formations, réservations, contact) » | Aucune route ne les atteint |
| `AUDIT-PROJET-2026-10.md` §3.10 | « API publique documentée, clés d'API » | Page de documentation et stockage de clés seulement |
| `Gemini.md` | Paiement par CinetPay et Stripe | GeniusPay |
| `NATIVE-SETUP.md` | Dépôt `visualpro-african-ai-creations`, VisualPro | Marque et dépôt actuels : Ecomfy, `Ivoireshop/Ecomfy` |
| `config/pricingPlans.ts` | Source des tarifs | Importé par aucun fichier |
