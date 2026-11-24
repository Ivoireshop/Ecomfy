# Environnement de test Ecomfy sur VPS (Supabase auto-hébergé)

Date : 24/11/2026 — branche `test/vps-selfhosted` (rien de poussé ni commité).
Cible : front `https://test.ecomfy.cloud` (Apache) + Supabase auto-hébergé `https://supabase.ecomfy.cloud` (Docker derrière Apache).
Production (`yfggrceynzcwklbxhgix`, Vercel) : **non touchée**. Aucun `db push` ni `functions deploy` vers le cloud. `.env` non lu.

---

## 1. Audit auth

### 1.1 Inventaire des appels Supabase Auth (src/)

| Appel | Fichier:ligne | URL de retour |
|---|---|---|
| Client : `flowType: 'pkce'`, `detectSessionInUrl: true`, `storageKey: 'ecomfy-auth-token'` | [client.ts:12-20](../src/integrations/supabase/client.ts#L12-L20) | — |
| `signUp` (+ `full_name`, `phone`, `country`, `referral_code` en métadonnées) | [Auth.tsx:416](../src/pages/Auth.tsx#L416) | `${origin}/auth?type=signup&confirmed=true` ([:407](../src/pages/Auth.tsx#L407)) |
| `resend({type:'signup'})` | [Auth.tsx:213-220](../src/pages/Auth.tsx#L213-L220) | `${origin}/auth?type=signup&confirmed=true` |
| `signInWithPassword` | [Auth.tsx:521](../src/pages/Auth.tsx#L521) | — |
| `signInWithOAuth({provider:'google', prompt:'select_account'})` | [Auth.tsx:574-582](../src/pages/Auth.tsx#L574-L582) | `${origin}/dashboard` |
| `resetPasswordForEmail` | [Auth.tsx:483-484](../src/pages/Auth.tsx#L483-L484), [ResetPassword.tsx:96-98](../src/pages/ResetPassword.tsx#L96-L98) | `${origin}/reset-password` |
| `updateUser({password})` | [ResetPassword.tsx:154](../src/pages/ResetPassword.tsx#L154) | — |
| `updateUser({data})` (profil Google, parrainage) | [profileCompletionService.ts:140](../src/services/profileCompletionService.ts#L140), [affiliateService.ts:462](../src/services/affiliateService.ts#L462) | — |
| `verifyOtp({type:'signup'})` (code à 6 chiffres) | [VerifyEmail.tsx:44](../src/pages/VerifyEmail.tsx#L44) | — |
| `exchangeCodeForSession` (manuel, en plus de `detectSessionInUrl`) | [App.tsx:614-628](../src/App.tsx#L614-L628) | redirige vers `/dashboard` |
| `onAuthStateChange` | [useAuthReady.ts:61](../src/hooks/useAuthReady.ts#L61), [ResetPassword.tsx:42](../src/pages/ResetPassword.tsx#L42) (`PASSWORD_RECOVERY`), + 5 pages (AiQuota, FounderDashboard, PaymentHistory, PromoCodeManager, Subscription) | — |
| `signInWithOtp` | aucun usage | — |
| OAuth 2.1 serveur (bêta `supabase.auth.oauth`) | [OAuthConsent.tsx:14](../src/pages/OAuthConsent.tsx#L14) | route `/oauth/consent`, utilisée seulement par la fonction `mcp` |

Toutes les URL de retour sont construites avec `window.location.origin` : **aucune URL de prod en dur dans le parcours d'auth du front**. Sur `test.ecomfy.cloud`, elles deviennent :

- `https://test.ecomfy.cloud/auth?type=signup&confirmed=true` (confirmation e-mail, renvoi)
- `https://test.ecomfy.cloud/dashboard` (retour Google)
- `https://test.ecomfy.cloud/reset-password` (réinitialisation)

Valeur à mettre dans `ADDITIONAL_REDIRECT_URLS` : `https://test.ecomfy.cloud/**` (le `**` couvre chemins et paramètres). Si une URL n'est pas autorisée, GoTrue **ne renvoie pas d'erreur** : il redirige silencieusement vers `SITE_URL`.

Callback OAuth côté Supabase (à déclarer chez Google) : `https://supabase.ecomfy.cloud/auth/v1/callback`.

`test.ecomfy.cloud` est bien reconnu comme hôte de l'application et non comme domaine de boutique ([leanShopPath.ts:16-18](../src/lib/leanShopPath.ts#L16-L18), commit e58c25b).

### 1.2 Problèmes classés par gravité

#### Bloquant

**B1 — Le build refuse toute URL Supabase qui n'est pas `*.supabase.co`.** [vite.config.ts:15](../vite.config.ts#L15) : `assertBuildEnv` exige `https://<ref>.supabase.co`. `vite build --mode vps` avec `https://supabase.ecomfy.cloud` s'arrête avec « VITE_SUPABASE_URL invalide ». Correctif proposé en §3.2 (non appliqué, à valider).

**B2 — Les liens des e-mails d'auth envoyés par `auth-email-hook` seraient inutilisables.** [auth-email-hook/index.ts:166-168](../supabase/functions/auth-email-hook/index.ts#L166-L168) construit le lien avec `Deno.env.get('SUPABASE_URL')`. Dans le conteneur `functions` du docker-compose auto-hébergé, `SUPABASE_URL` vaut `http://kong:8000` (adresse interne Docker) : le lien reçu serait `http://kong:8000/auth/v1/verify?...`. Même défaut dans [send-email/index.ts:35](../supabase/functions/send-email/index.ts#L35). → En test, utiliser le **SMTP natif de GoTrue** (§2.2). Correctif possible si le hook doit être testé : lire une variable `SUPABASE_PUBLIC_URL` en priorité (modification d'un fichier existant, non faite).

**B3 — CORS des Edge Functions fermé à `test.ecomfy.cloud`.** [_shared/http.ts:33-37](../supabase/functions/_shared/http.ts#L33-L37) et [:140](../supabase/functions/_shared/http.ts#L140) : le niveau « app » n'accepte que `APP_URL`, `ALLOWED_ORIGINS`, `ecomfy.cloud`, `localhost`. Sans `APP_URL=https://test.ecomfy.cloud` dans l'environnement des fonctions, chaque appel `supabase.functions.invoke` du front de test échoue au préflight (403). Configuration seulement, pas de code.

**B4 — `verify_jwt` de `config.toml` n'est pas lu en auto-hébergé.** Le service `functions` (routeur `volumes/functions/main/index.ts`) applique un seul `VERIFY_JWT` global. 47 fonctions sont en `verify_jwt = false` dans [config.toml](../supabase/config.toml) (webhooks, cron avec `x-cron-secret`, lien de désinscription, sitemap, IA publiques) : avec `VERIFY_JWT=true` elles répondent 401 aux appelants sans JWT ; avec `VERIFY_JWT=false`, les 28 autres fonctions qui comptent sur la passerelle perdent ce contrôle. → Adapter `main/index.ts` du VPS (§4.3).

#### Élevé

**E1 — `ADDITIONAL_REDIRECT_URLS` / `SITE_URL` du VPS.** Valeurs par défaut du docker-compose : `SITE_URL=http://localhost:3000`. Sans correction, confirmation, Google et reset renvoient vers localhost (voir §2.1).

**E2 — Google OAuth absent du `.env` par défaut.** Les variables `GOTRUE_EXTERNAL_GOOGLE_*` doivent être ajoutées dans le service `auth` du `docker-compose.yml` (§2.1), et l'URI `https://supabase.ecomfy.cloud/auth/v1/callback` déclarée dans la console Google. Utiliser un client OAuth **de test** (pas celui de la prod) : question en fin de document.

**E3 — Transformations d'image.** [imageUrl.ts:9-24](../src/lib/imageUrl.ts#L9-L24) réécrit les URL de Storage vers `/storage/v1/render/image/...`. En auto-hébergé, cela exige le service `imgproxy` et `ENABLE_IMAGE_TRANSFORMATION=true` dans le service `storage`, sinon les vignettes produits sont cassées.

#### Moyen

**M1 — PKCE : liens à ouvrir dans le même navigateur.** Le `code_verifier` est stocké dans le `localStorage` du navigateur qui a fait la demande. Un lien de réinitialisation ouvert sur un autre appareil échoue (« lien invalide ») ; un lien de confirmation ouvert ailleurs confirme bien l'e-mail côté serveur mais ne connecte pas. Comportement identique en prod ; à respecter pendant les tests.

**M2 — `VerifyEmail.tsx` attend un code à 6 chiffres.** [VerifyEmail.tsx:44](../src/pages/VerifyEmail.tsx#L44) : le modèle par défaut de GoTrue n'envoie qu'un lien, pas `{{ .Token }}`. Cette page ne sera utilisable en test que si le modèle de confirmation inclut le code (variable `GOTRUE_MAILER_TEMPLATES_CONFIRMATION`). Le parcours principal (lien) n'est pas concerné.

**M3 — Le garde-fou `EMAIL_MODE` ne couvre pas les e-mails d'auth en SMTP natif.** `guardEmail` ([email-sender.ts:34](../supabase/functions/_shared/email-sender.ts#L34)) ne s'applique qu'aux mails envoyés par les Edge Functions. Avec le SMTP de GoTrue, les mails d'inscription/reset partent vers l'adresse saisie : ne s'inscrire qu'avec des adresses de test.

#### Faible

- **F1** — [App.tsx:614-628](../src/App.tsx#L614-L628) : échange PKCE manuel redondant avec `detectSessionInUrl`. supabase-js 2.112.1 attend son initialisation (qui a déjà consommé le code), donc l'appel manuel échoue sans effet. Inoffensif, mais fragile.
- **F2** — [auth-email-hook/index.ts:39](../supabase/functions/auth-email-hook/index.ts#L39) et [:166](../supabase/functions/auth-email-hook/index.ts#L166) : `siteUrl` et `redirect_to` par défaut fixés à `https://ecomfy.cloud` (liens « accueil » des mails vers la prod).
- **F3** — [mcp/index.ts:130](../supabase/functions/mcp/index.ts#L130) : émetteur OAuth `https://<ref>.supabase.co/auth/v1` en dur ; la fonction `mcp` et `/oauth/consent` ne fonctionneront pas sur le VPS. Hors périmètre du test.
- **F4** — URL de prod affichées ou utilisées comme repli : [SEO.tsx:14](../src/components/seo/SEO.tsx#L14) (canonical), [shareLinks.ts:22](../src/lib/shareLinks.ts#L22), [ShopSettings.tsx:286](../src/components/shop/ShopSettings.tsx#L286), [brand.ts](../src/config/brand.ts), métadonnées OG de [index.html](../index.html) (l. 169-223), DNS boutiques [DnsConfigurationAssistant.tsx:15-17](../src/components/DnsConfigurationAssistant.tsx#L15-L17). Cosmétique en test ; le `noindex` du fichier Apache évite l'indexation.

### 1.3 Migration `20261005174500_profile_completion_google.sql`

Elle ajoute 4 colonnes à `profiles` et remplace `public.handle_new_user()` (lecture de `raw_user_meta_data` : `full_name`/`name`, `given_name`/`family_name`, `phone`, `avatar_url`/`picture`). Elle ne crée pas de trigger : le trigger `on_auth_user_created AFTER INSERT ON auth.users` vient de `20251108155435`. Aucune dépendance au cloud : seules les colonnes standard de `auth.users` (créées par GoTrue au démarrage) sont utilisées. Le service lié ([profileCompletionService.ts](../src/services/profileCompletionService.ts)) passe par `updateUser` et la table `profiles`.

Triggers sur `auth.users` après rejeu : `on_auth_user_created` (profil, rôle `user`, abonnement inactif), `on_auth_user_created_referral`, `on_user_created_generate_referral` ; `assign_founder_role_on_signup` et `on_auth_user_created_assign_role` sont supprimés par `20261111100000`. Condition : le service `auth` doit avoir démarré (et créé `auth.users`) **avant** l'application des migrations.

### 1.4 Secrets exposés côté navigateur

Aucun. Recherche de `service_role`, `SERVICE_ROLE`, `sb_secret_`, `whsec_`, `sk_live`, JWT `eyJhbGciOi`, `RESEND_API`, `OPENAI_API` dans `src/`, `public/`, `index.html` : seules des mentions documentaires (`ecm_sk_test_…` dans la doc API Ecomfy Pay). Le front ne lit que `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_VAPID_PUBLIC_KEY` (et `DEV`).

À savoir : [20260601094150](../supabase/migrations/20260601094150_3799a36f-9e2b-4e25-a4bb-bcf0ee1a37b6.sql) (l. 72-73) contient l'URL et la clé **anon** (publique) de l'ancien projet `dqlbmtkaamjohgbcjwtw`. Pas un secret, mais le cron qu'elle crée vise cet ancien projet jusqu'à ce que `20261011120000` le remplace.

### 1.5 URL en dur (*.supabase.co, refs de projet, ecomfy.cloud)

| Où | Contenu | Impact en test |
|---|---|---|
| [vite.config.ts:15](../vite.config.ts#L15) | regex `*.supabase.co` | **bloquant** (B1) |
| [vercel.json:39](../vercel.json#L39), [public/_headers:12](../public/_headers#L12) | CSP `*.supabase.co` | non servis par Apache ; remplacés par `deploy/apache-test.htaccess` |
| [client.ts:6](../src/integrations/supabase/client.ts#L6) | repli `https://dummy.supabase.co` | aucun si la variable est définie |
| [mcp/index.ts:130](../supabase/functions/mcp/index.ts#L130) | émetteur `*.supabase.co` | F3 |
| [public/openapi/ecomfy-pay.v1.yaml:20](../public/openapi/ecomfy-pay.v1.yaml#L20) | `https://{project}.supabase.co` | documentation |
| Migrations 20260506110734 (l. 32), 20260601094150 (l. 72), 20260813104500 (l. 8) | URL `dqlbmtkaamjohgbcjwtw` / **`yfggrceynzcwklbxhgix`** dans des triggers/cron | remplacés par `20261011120000` (Vault) ; voir §4.1 |
| [_shared/http.ts:33-34](../supabase/functions/_shared/http.ts#L33-L34), [email-sender.ts:5-8](../supabase/functions/_shared/email-sender.ts#L5-L8) | `ecomfy.cloud`, `noreply@ecomfy.cloud` | B3 ; l'expéditeur doit être un domaine vérifié chez le fournisseur SMTP/Resend de test |
| [capacitor.config.ts](../capacitor.config.ts) | aucune URL | — |

---

## 2. Variables à ajouter côté serveur (VPS)

### 2.1 `.env` du dossier `supabase/docker` du VPS

```dotenv
# URL publiques
SUPABASE_PUBLIC_URL=https://supabase.ecomfy.cloud
API_EXTERNAL_URL=https://supabase.ecomfy.cloud
SITE_URL=https://test.ecomfy.cloud
ADDITIONAL_REDIRECT_URLS=https://test.ecomfy.cloud/**

# Inscription e-mail avec confirmation (comme la prod)
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
DISABLE_SIGNUP=false
ENABLE_ANONYMOUS_USERS=false

# SMTP natif GoTrue (recommandé en test, voir 2.2) — valeurs à fournir
SMTP_ADMIN_EMAIL=<adresse expéditrice, domaine vérifié>
SMTP_HOST=<hôte SMTP>
SMTP_PORT=<465 ou 587>
SMTP_USER=<utilisateur>
SMTP_PASS=<mot de passe / clé, jamais celle de la prod>
SMTP_SENDER_NAME=Ecomfy TEST

# Liens des mails (valeurs par défaut du compose, à garder)
MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
MAILER_URLPATHS_INVITE=/auth/v1/verify
MAILER_URLPATHS_RECOVERY=/auth/v1/verify
MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify

# Google (nouvelles variables, référencées par le docker-compose ci-dessous)
GOOGLE_ENABLED=true
GOOGLE_CLIENT_ID=<client OAuth de test>
GOOGLE_SECRET=<secret du client de test>
```

Dans `docker-compose.yml`, service `auth` → `environment:` (ces lignes n'existent pas par défaut) :

```yaml
      GOTRUE_EXTERNAL_GOOGLE_ENABLED: ${GOOGLE_ENABLED}
      GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOTRUE_EXTERNAL_GOOGLE_SECRET: ${GOOGLE_SECRET}
      GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: ${API_EXTERNAL_URL}/auth/v1/callback
```

Console Google (client de test) : origine JavaScript `https://test.ecomfy.cloud`, URI de redirection `https://supabase.ecomfy.cloud/auth/v1/callback`.

Service `storage` : vérifier `ENABLE_IMAGE_TRANSFORMATION: "true"` et la présence du service `imgproxy` (E3).

Apache (vhost `supabase.ecomfy.cloud`) : le Realtime passe en WebSocket (`wss://supabase.ecomfy.cloud/realtime/v1/websocket`) → `proxy_wstunnel` (ou `ProxyPass ... upgrade=websocket`) requis vers Kong.

Ensuite : `docker compose up -d --force-recreate auth` (et `functions`, `storage` si modifiés).

### 2.2 E-mails d'auth : SMTP natif plutôt que `auth-email-hook`

| | SMTP natif GoTrue | `auth-email-hook` (comme la prod) |
|---|---|---|
| Fonctionne tel quel | oui | **non** : liens en `http://kong:8000` (B2) |
| Configuration | `SMTP_*` ci-dessus | `GOTRUE_HOOK_SEND_EMAIL_ENABLED=true`, `GOTRUE_HOOK_SEND_EMAIL_URI`, `GOTRUE_HOOK_SEND_EMAIL_SECRETS=v1,whsec_…` (service `auth`) + `SEND_EMAIL_HOOK_SECRET` et `RESEND_API_KEY` (service `functions`) + exception `verify_jwt` (B4) |
| Modèles | anglais par défaut (personnalisables par `GOTRUE_MAILER_TEMPLATES_*`) | modèles React d'Ecomfy |
| Garde-fou `EMAIL_MODE` | non (M3) | oui (`guardEmail`) |

Pour le hook, GoTrue n'accepte en `http://` que des hôtes locaux (à vérifier selon la version de l'image `auth`) : l'URI serait alors `https://supabase.ecomfy.cloud/functions/v1/auth-email-hook` (aller-retour par Apache). Il faut aussi que `edge-runtime` lise le `deno.json` de la fonction (JSX). **Recommandation : SMTP natif pour valider l'auth ; tester le hook dans un second temps, après le correctif B2.**

### 2.3 Environnement du service `functions` (docker-compose)

Déjà fournis par le compose : `SUPABASE_URL` (= `http://kong:8000`), `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `VERIFY_JWT`. À ajouter :

```yaml
      APP_URL: https://test.ecomfy.cloud          # CORS (B3) + liens des mails
      ALLOWED_ORIGINS: https://test.ecomfy.cloud
      EMAIL_MODE: redirect                         # jamais "live" en test
      EMAIL_REDIRECT_TO: ${EMAIL_REDIRECT_TO}      # votre adresse
      CRON_SECRET: ${CRON_SECRET}                  # valeur aléatoire propre au VPS
      # puis, groupe par groupe (§4.2) : RESEND_API_KEY de test, clés IA, etc.
```

---

## 3. Fichiers créés ou proposés

### 3.1 Créés

| Fichier | Rôle | Versionné |
|---|---|---|
| `.env.vps.local` | modèle des variables front de test (placeholders, aucune clé) | **non** (`.gitignore` : `*.local`, `.env.*` — vérifié avec `git check-ignore`) |
| [deploy/apache-test.htaccess](../deploy/apache-test.htaccess) | en-têtes de sécurité de `vercel.json`, CSP + `supabase.ecomfy.cloud`, `noindex`, fallback SPA, `no-store` sur `index.html`/`sw.js`, cache long sur `/assets/` | oui (nouveau fichier) |
| ce rapport | — | oui (nouveau fichier) |

`.env.vps.local` redéfinit les quatre variables `VITE_` lues par le front (y compris `VITE_VAPID_PUBLIC_KEY` vide) : rien ne peut venir du `.env` local. `APP_URL` et `EMAIL_MODE` n'y sont qu'en commentaire : ce sont des variables des Edge Functions, sans effet sur le build.

Modules Apache : `a2enmod rewrite headers` (et `proxy proxy_http proxy_wstunnel` pour le vhost Supabase). Le vhost de test doit autoriser le `.htaccess` : `AllowOverride FileInfo Headers Indexes` (ou `All`) sur le DocumentRoot.

### 3.2 Modifications de fichiers existants (validées et appliquées le 24/11, non commitées)

Contrôlé : en mode `vps`, clé absente → refus ; URL `*.supabase.co` → refus ; en mode prod, l'URL du VPS → refus (règle de prod inchangée). Build `vps` complet non encore lancé (ANON_KEY à fournir).

**`package.json`** — ajout d'un script, le build de prod (`build`) inchangé :

```json
"build:vps": "vite build --mode vps --outDir dist-vps",
```

`--outDir dist-vps` : le bundle de test ne remplace jamais `dist/` (utilisé par `cap sync` pour les apps natives).

**`.gitignore`** — une ligne : `dist-vps`.

**`vite.config.ts`** — lever B1 sans assouplir la prod : en mode `vps`, l'URL doit être exactement celle du VPS ; dans les autres modes, la règle `*.supabase.co` reste.

```ts
const VPS_SUPABASE_URL = "https://supabase.ecomfy.cloud";

  const url = env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, "");
  if (url && mode === "vps" && url !== VPS_SUPABASE_URL) {
    problems.push(`En mode vps, VITE_SUPABASE_URL doit valoir ${VPS_SUPABASE_URL} : ${url}`);
  } else if (url && mode !== "vps" && !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)) {
    problems.push(`VITE_SUPABASE_URL invalide : ${env.VITE_SUPABASE_URL}`);
  }
```

Effet de bord voulu : un build `vps` pointé par erreur vers la prod est refusé.

---

## 4. Base de données et Edge Functions : risques

### 4.1 Dépendances des migrations à la plateforme

> **Rejeu du 24/11/2026** (`scripts/replay-migrations.sh`, base vierge jetable `supabase/postgres:17.11.0.003`, en local) : **305/305 migrations passent, 0 échec**, dans l'ordre des noms de fichiers. Limites : `auth`, `storage` et `realtime` y sont simulés par des bouchons, et seul Postgres 17 a été testé.

| Élément | Où | En auto-hébergé |
|---|---|---|
| `pg_cron` | 20260410182641, 20260609211124, 20260610164935 | inclus dans l'image `supabase/postgres` (préchargé) |
| `pg_net` (schéma `extensions`) | idem | inclus |
| `pgmq` (file des e-mails) | 20260410182641 | inclus dans les images récentes (≥ 15.6) |
| `supabase_vault` | 20260410182641 | inclus |
| `unaccent` | 20260511223000 | inclus |
| Rôle `supabase_admin` | 6 migrations (billing, promo) : seulement comparé à `session_user` | sans effet |
| `invoke_edge_function` + Vault `supabase_project_url` / `cron_secret` | [20261011120000](../supabase/migrations/20261011120000_edge_function_url_from_vault.sql) | sans le secret Vault : avertissement et **aucun appel** (comportement sûr) |
| Publication `supabase_realtime` | 12 tables (`orders`, `shops`, `abandoned_carts`, `community_*`, `delivery_*`, `generation_queue`, `generated_videos`, `shop_invoices` + boucle) | publication créée par l'image ; service `realtime` requis |
| `storage.buckets` / `storage.objects` | 13 buckets : publics `avatars`, `shop-assets`, `shop-images`, `generated-content`, `generated-images`, `showcase-images`, `showcase-videos`, `delivery-logos` ; privés `kyc-documents`, `delivery-kyc`, `delivery-proofs`, `delivery-visits`, `digital-products` | tables créées par le service `storage` au démarrage : il doit tourner avant les migrations |
| `auth.users` (triggers) | 20251104003056 … 20261111100000 | table créée par le service `auth` au démarrage |
| Processus `process-email-queue` | 20260410182641 (commentaire l. 272-292) | le cron et la clé Vault ne sont **pas** dans les migrations (outil Lovable) : la file d'e-mails n'aura pas de consommateur, comme en prod |

Tâches `pg_cron` créées par les migrations :

| Tâche | Fréquence | Appelle une Edge Function ? |
|---|---|---|
| `app-health-monitor` | 5 min | oui (`invoke_edge_function`) |
| `ecomfy-pay-api-deliveries` | 1 min | oui |
| `delivery-notification-emails` | 2 min | oui |
| `weekly-finance-summary` | lundi 8 h | oui |
| `expire-stale-pending-payments` | 1 min | non (SQL) |
| `enforce-shop-billing-deadlines`, `enforce-shop-payment-deadlines` | 5 min | non — **peut suspendre des boutiques de test** dont la facturation est en retard |
| `enforce-subscription-expiry` | 30 min | non |
| `expire-stale-studio-generations` | 10 min | non |
| `delivery-document-expiry` | 3 h 30 | non |
| `purge-cron-run-details` | 3 h 17 | non |

Recommandation : **ne pas créer** les secrets Vault au début (les tâches qui appellent des fonctions restent inertes). Quand les fonctions seront en place, depuis le réseau Docker :

```sql
select vault.create_secret('http://kong:8000', 'supabase_project_url');  -- adresse interne, pas l'URL publique
select vault.create_secret('<CRON_SECRET du VPS>', 'cron_secret');
```

### 4.2 Ordre des migrations sur une base vierge et migrations à risque

- `scripts/replay-migrations.sh` rejoue toutes les migrations sur une base vierge `supabase/postgres:17.11.0.003` avec des bouchons (`scripts/replay-stubs.sql`) pour `auth`, `storage`, `realtime`. Résultat du 24/11 : voir l'encadré en tête de §4.1.
- **Version de Postgres** : le docker-compose officiel utilise une image `supabase/postgres` 15.x ; le rejeu n'est validé que sur 17. Version du VPS à me confirmer.
- **Migrations jamais appliquées en prod**, qu'une base vierge appliquera :
  - `20260906000000` : table `corporate_invitations` ouverte à `anon` (`USING true`). À neutraliser ou corriger après application.
  - `20260908170000` : crée `shop-assets`/`avatars` avec dépôt libre ; refermés ensuite par `20261106120000` et `20261106130000` (à vérifier après application : politiques de `storage.objects`).
  - Plus récentes que la prod (plans d'abonnement `20261107100000`, Studio IA `20261103100000`, livraison 20261116–20261121, API Ecomfy Pay `20261114110000`, produits digitaux `20261112120000`…) : la base de test sera **en avance** sur la prod. Ce n'est pas une copie de la prod.
- Fonctions de trigger dont l'URL était en dur (`dqlbmtkaamjohgbcjwtw`, `yfggrceynzcwklbxhgix`) : appliquées puis remplacées par `20261011120000` dans la même passe. Base vide → aucun trigger ne se déclenche entre-temps. Vérifier après coup : `select jobname, command from cron.job;` ne doit contenir aucune URL `supabase.co`.

### 4.3 Commande d'application (préparée, NON exécutée)

**Recommandée : boucle `psql` dans le conteneur `db`, arrêt à la première erreur** (même méthode que le rejeu validé ; aucune possibilité de viser un projet cloud lié par erreur).

```bash
# Sur le VPS, depuis le dossier supabase/docker, après `docker compose up -d` complet
# (auth, storage et realtime doivent avoir créé leurs schémas).
# 1) Copier les migrations : scp -r supabase/migrations <vps>:/tmp/ecomfy-migrations
docker cp /tmp/ecomfy-migrations supabase-db:/tmp/mig
docker exec supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
  "create schema if not exists supabase_migrations;
   create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);"
for f in $(docker exec supabase-db ls /tmp/mig | sort); do
  v="${f%%_*}"
  done_already=$(docker exec supabase-db psql -U postgres -d postgres -tAc \
    "select 1 from supabase_migrations.schema_migrations where version='$v'")
  [ "$done_already" = 1 ] && continue
  echo "== $f"
  docker exec supabase-db psql -U postgres -d postgres -1 -v ON_ERROR_STOP=1 -q -f "/tmp/mig/$f" || { echo "ARRÊT sur $f"; break; }
  docker exec supabase-db psql -U postgres -d postgres -c \
    "insert into supabase_migrations.schema_migrations(version, name) values ('$v', '${f#*_}')"
done
```

Chaque fichier passe dans une transaction (`-1`) : un échec n'en laisse rien. La boucle est relançable (versions déjà inscrites ignorées) et l'historique est au format du CLI.

**Alternative : `supabase db push --db-url`** via tunnel SSH (`ssh -N -L 54322:127.0.0.1:5432 <vps>`). Fonctionne, mais :
- risque principal : une commande lancée sans `--db-url` part vers le projet lié du CLI, qui a déjà été la prod (`supabase/.temp/project-ref`) ;
- dans le docker-compose récent, le port 5432 de l'hôte est servi par **Supavisor** : l'utilisateur devient `postgres.<POOLER_TENANT_ID>`, et le port de la base n'est pas exposé par défaut.
Si cette voie est choisie : `supabase db push --db-url "postgresql://postgres.<tenant>:<mdp>@127.0.0.1:54322/postgres" --dry-run` d'abord.

### 4.4 Edge Functions

75 fonctions. Classement :

**(a) Auth et parcours principal**
`get-vapid-key`, `track-shop-visit`, `share-product`, `dynamic-sitemap`, `digital-download`, `invite-shop-collaborator`, `manage-founder-roles`, `manage-student-access`, `founder-activate-shop`, `founder-record-commission-payment`, `create-student-account`, `generate-certificate`, `cancel-queue-item`, `verify-domain-dns`, `verify-delivery-identity`, `track-conversion`, `handle-email-unsubscribe`, `send-transactional-email` ; `auth-email-hook` seulement si le hook est choisi.
Secrets : `SUPABASE_*` (fournis), `APP_URL`, `ALLOWED_ORIGINS`, `INVITE_ALLOWED_ORIGINS` (invitation), `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (invitation, comptes élèves, KYC), `EMAIL_MODE`/`EMAIL_REDIRECT_TO`, `META_GRAPH_VERSION` (facultatif), `VAPID_PUBLIC_KEY`/`FIREBASE_VAPID_PUBLIC_KEY` ; hook : `SEND_EMAIL_HOOK_SECRET`, `RESEND_API_KEY`.

**(b) Paiements — à ne pas activer sans clés sandbox**
`ecomfy-pay-api`, `ecomfy-pay-initiate`, `ecomfy-pay-settlement`, `ecomfy-pay-webhook`, `ecomfy-pay-withdraw`, `geniuspay-webhook`, `process-payment`, `payment-callback`, `verify-payment`, `reconcile-pending-payments`.
Secrets : `GENIUSPAY_API_KEY`, `GENIUSPAY_API_SECRET`, `GENIUSPAY_WEBHOOK_SECRET`, `GENIUSPAY_BASE_URL`, `ECOMFY_PAY_PROVIDER`, `LYGOS_WEBHOOK_SECRET`, `CRON_SECRET`, `APP_URL`. Les webhooks GeniusPay de test devront viser `https://supabase.ecomfy.cloud/functions/v1/...`.

**(c) IA et services tiers**
`correct-text`, `create-video-from-image`, `extract-brand`, `finance-advisor`, `generate-ad-visual`, `generate-ai-image`, `generate-feature-image`, `generate-product-sheet`, `generate-shop-content`, `generate-showcase-site`, `generate-video`, `generate-voiceover`, `product-ai-optimizer`, `process-queue`, `shop-ai-assistant-chat`, `shop-ai-assistant-tts`, `shop-chatbot`, `showcase-chat`, `translate-product`, `translate-ui`, `gsc-analytics`, `gsc-oauth-flow`, `seo-auto-index`, `meta-ads-oauth`, `sync-ad-spend`, `reconcile-tracking`, `check-ad-token-expiry`, `mcp`.
Secrets : `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `LOVABLE_API_KEY`, `REPLICATE_API_KEY`, `RUNWAY_API_KEY`, `ELEVEN_LABS_API_KEY`, `CLOUDINARY_URL`, `GOOGLE_OAUTH_CLIENT_ID`/`_SECRET`/`_REDIRECT_URI`, `GSC_STATE_SECRET`, `GOOGLE_SEARCH_CONSOLE_API_KEY`, `META_APP_ID`, `META_APP_SECRET`, `META_STATE_SECRET`, `META_OAUTH_REDIRECT_URI`, `META_GRAPH_VERSION`, `CRON_SECRET`, + variables de coût lues dynamiquement par [_shared/ai-cost.ts:16](../supabase/functions/_shared/ai-cost.ts#L16). `LOVABLE_API_KEY` dépend de la passerelle Lovable : à confirmer qu'elle accepte des appels hors cloud Supabase.

**(d) E-mails, push, cron, supervision**
`process-email-queue`, `send-24h-reminder`, `send-booking-notification`, `send-contact-notification`, `send-corporate-invite`, `send-delivery-notification-emails`, `send-domain-ready-notification`, `send-email`, `send-generation-reminder`, `send-promo-notification`, `send-push-notification`, `send-subscription-email`, `send-weekly-finance-summary`, `handle-email-suppression`, `preview-transactional-email`, `app-health-monitor`, `app-remediation`.
Secrets : `RESEND_API_KEY`, `EMAIL_MODE`, `EMAIL_REDIRECT_TO`, `EMAIL_LINK_ORIGINS`, `APP_URL`, `CRON_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `LOVABLE_API_KEY` (suppression, aperçu), `SEND_EMAIL_HOOK_SECRET` (`send-email`).

**Mise en place sur le VPS**

1. Copier `supabase/functions/*` (y compris `_shared/`) dans `supabase/docker/volumes/functions/`, **sans écraser** `volumes/functions/main/`. Les imports relatifs `../_shared/...` fonctionnent si `_shared` est au même niveau. Ne copier d'abord que le groupe (a).
2. Secrets : dans l'`environment:` du service `functions` (ou un `env_file:` dédié, hors dépôt). Pas de `supabase secrets set` en auto-hébergé. Le routeur `main` transmet tout son environnement aux fonctions.
3. `verify_jwt` par fonction (B4) : dans `volumes/functions/main/index.ts`, remplacer le test global par une liste d'exceptions issue de `config.toml` :

   ```ts
   // Fonctions déclarées verify_jwt = false dans supabase/config.toml du dépôt
   const NO_VERIFY_JWT = new Set(["auth-email-hook", "check-ad-token-expiry", /* … liste complète générée depuis config.toml */]);
   // …
   if (VERIFY_JWT && !NO_VERIFY_JWT.has(service_name)) { /* contrôle JWT existant */ }
   ```

   avec `VERIFY_JWT=true` dans le `.env`. La liste se génère avec :
   `grep -B1 'verify_jwt = false' supabase/config.toml | grep -oE 'functions\.[a-z0-9-]+' | cut -d. -f2`.
4. `docker compose restart functions` ; test : `curl -i https://supabase.ecomfy.cloud/functions/v1/get-vapid-key`.
5. Points à vérifier sur la version de `edge-runtime` du VPS : imports `npm:` et prise en compte des `deno.json` par fonction (JSX de `auth-email-hook`, `send-transactional-email`, `process-email-queue`, `preview-transactional-email`, `handle-email-*`).

### 4.5 Récapitulatif des risques

| Risque | Gravité | Parade |
|---|---|---|
| Build bloqué (B1) | bloquant | correctif `vite.config.ts` §3.2 |
| Liens d'auth en `http://kong:8000` (B2) | bloquant si hook | SMTP natif |
| CORS des fonctions (B3) | bloquant | `APP_URL`/`ALLOWED_ORIGINS` |
| `verify_jwt` global (B4) | bloquant / sécurité | liste d'exceptions dans `main/index.ts` |
| `db push` vers le mauvais projet | critique | boucle `psql` dans le conteneur |
| `corporate_invitations` ouverte à `anon` | élevé (instance exposée sur Internet) | corriger après application |
| Clés de prod copiées sur le VPS | critique | n'utiliser que des clés de test ; `EMAIL_MODE=redirect` |
| Crons de facturation qui suspendent des boutiques de test | moyen | attendu ; à savoir pendant les tests |
| Postgres 15 sur le VPS vs rejeu validé sur 17 | moyen | rejouer avec l'image exacte du VPS avant d'appliquer |
| Paiements GeniusPay réels | critique | groupe (b) non déployé sans clés sandbox |

---

## 5. Déploiement du front de test et recette

### 5.1 Build et copie (après validation des modifications §3.2)

```bash
# Poste local
# 1) Renseigner VITE_SUPABASE_PUBLISHABLE_KEY (ANON_KEY du VPS) dans .env.vps.local
npm run build:vps                       # → dist-vps/
cp deploy/apache-test.htaccess dist-vps/.htaccess
grep -l "supabase.ecomfy.cloud" dist-vps/assets/*.js | head -1   # doit trouver un fichier
grep -l "yfggrceynzcwklbxhgix" dist-vps/assets/*.js            # doit ne rien trouver

# 2) Copie vers le VPS (DocumentRoot à confirmer)
rsync -av --delete dist-vps/ <user>@<vps>:/var/www/test.ecomfy.cloud/

# 3) Sur le VPS
sudo a2enmod rewrite headers && sudo apachectl configtest && sudo systemctl reload apache2
curl -sI https://test.ecomfy.cloud/ | grep -iE "content-security|cache-control|x-robots"
curl -sI https://test.ecomfy.cloud/dashboard | head -1        # 200 (fallback SPA)
curl -sI https://test.ecomfy.cloud/assets/inexistant.js | head -1   # 404
```

Après chaque nouveau déploiement, le service worker peut servir l'ancienne version : recharger deux fois ou vider le stockage du site.

### 5.2 Checklist de recette (navigateur, par les menus, onglet privé)

Avant de commencer : Studio → Authentication → Users vide ; console du navigateur ouverte (aucune erreur CSP).

| # | Test | Attendu | Contrôle serveur |
|---|---|---|---|
| 1 | Accueil → « Connexion » → onglet inscription, adresse de test, mot de passe conforme | message « vérifiez votre e-mail » | utilisateur créé non confirmé ; `profiles`, `user_roles` (`user`), `subscriptions` (`inactive`) créés par le trigger |
| 2 | Ouvrir le mail de confirmation **dans le même navigateur** | lien `https://supabase.ecomfy.cloud/auth/v1/verify?...` puis retour `https://test.ecomfy.cloud/auth?type=signup&confirmed=true&code=...` → tableau de bord | `email_confirmed_at` renseigné |
| 3 | Déconnexion depuis le menu du compte | retour accueil ; `ecomfy-auth-token` absent du localStorage | — |
| 4 | Connexion e-mail / mot de passe | tableau de bord | `last_sign_in_at` mis à jour |
| 5 | Connexion e-mail avec un mauvais mot de passe | message d'erreur, pas de session | — |
| 6 | « Continuer avec Google » | écran de choix de compte Google → `https://test.ecomfy.cloud/dashboard` (ou `/complete-profile`) | utilisateur `provider=google`, `profiles.first_name/last_name/avatar_url` remplis, `profile_completed=false` |
| 7 | Compléter le profil Google (téléphone) | accès au tableau de bord | `profile_completed=true` |
| 8 | « Mot de passe oublié » → mail → lien (même navigateur) | page `/reset-password` en mode saisie | — |
| 9 | Saisir un nouveau mot de passe, déconnexion, reconnexion avec le nouveau | succès ; l'ancien refusé | — |
| 10 | Lien de reset ouvert dans un autre navigateur | échec propre (M1), pas de page blanche | — |
| 11 | Renvoi du mail de confirmation (compte non confirmé) | nouveau mail | limite de débit GoTrue |
| 12 | Une page qui appelle une Edge Function du groupe (a) | pas d'erreur CORS ni 401 | journaux `docker compose logs functions` |
| 13 | Une page avec données temps réel (commandes) | WebSocket `wss://supabase.ecomfy.cloud/realtime/v1/...` ouvert (onglet Réseau) | — |
| 14 | Nouvel onglet après fermeture : session conservée | toujours connecté (rafraîchissement du jeton) | — |

---

## Résumé

1. Le parcours d'auth du front n'a pas d'URL en dur : il marchera sur `test.ecomfy.cloud` avec `SITE_URL` et `ADDITIONAL_REDIRECT_URLS=https://test.ecomfy.cloud/**`.
2. Bloquant n° 1 : `vite.config.ts` refuse une URL Supabase hors `*.supabase.co` ; correctif limité au mode `vps` proposé, non appliqué.
3. Bloquant n° 2 : `auth-email-hook` produit des liens `http://kong:8000` en auto-hébergé → SMTP natif de GoTrue en test.
4. Bloquant n° 3 : CORS des fonctions → `APP_URL=https://test.ecomfy.cloud` dans le service `functions`.
5. Bloquant n° 4 : `verify_jwt` par fonction à reproduire dans `main/index.ts`.
6. Aucun secret exposé côté navigateur.
7. Migrations : extensions toutes disponibles en auto-hébergé ; appliquer après le démarrage complet de la pile, par boucle `psql` dans le conteneur.
8. La base de test sera en avance sur la prod et contient `corporate_invitations` ouverte à `anon` : à corriger.
9. Ne pas créer les secrets Vault au début : les crons qui appellent des fonctions restent inertes.
10. Paiements (groupe b) : ne pas déployer sans clés sandbox GeniusPay.

## Questions pour vous

1. Validez-vous les trois modifications de §3.2 (`package.json` : `build:vps` ; `.gitignore` : `dist-vps` ; `vite.config.ts` : règle du mode `vps`) ?
2. Version de l'image `supabase/postgres` du VPS (`docker inspect supabase-db --format '{{.Config.Image}}'`) et de `supabase/edge-runtime` ?
3. Fournisseur SMTP de test (hôte, port, utilisateur) et adresse expéditrice ? Un compte/clé Resend distinct de la prod existe-t-il ?
4. Client OAuth Google : créer un client de test dédié, ou ajouter l'URI du VPS au client existant ?
5. Chemin du DocumentRoot de `test.ecomfy.cloud` et utilisateur SSH pour le `rsync` ?
6. La pile Supabase du VPS est-elle déjà démarrée (auth, storage, realtime, functions, imgproxy) et la base est-elle vierge ?
7. `EMAIL_REDIRECT_TO` : quelle adresse recevra les mails des Edge Functions ?
8. Voulez-vous tester le hook `auth-email-hook` (mails Ecomfy en français) ? Il faut alors corriger B2 dans le code (lecture de `SUPABASE_PUBLIC_URL`).
