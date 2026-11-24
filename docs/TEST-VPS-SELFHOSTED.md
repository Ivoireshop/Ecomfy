# Environnement de test Ecomfy sur VPS (Supabase auto-hébergé)

État au 24/11/2026. Branche `test/vps-selfhosted`.

- Front : `https://test.ecomfy.cloud` (Apache).
- Supabase auto-hébergé : `https://supabase.ecomfy.cloud` (Docker derrière Apache, Let's Encrypt). Studio est protégé par une authentification basique.
- La production (projet Supabase Cloud `yfggrceynzcwklbxhgix`, front Vercel `https://ecomfy.cloud`) n'est **jamais** touchée. Pas de `supabase db push` ni de `supabase functions deploy` vers le cloud.

Ce document décrit l'environnement tel qu'il fonctionne, les opérations courantes et les limites connues. Le plan de passage de la prod sur un Supabase auto-hébergé est dans [BASCULE-PROD-VPS.md](BASCULE-PROD-VPS.md).

---

## 1. Vue d'ensemble

| Élément | État au 24/11 | Vérifié |
|---|---|---|
| Front `test.ecomfy.cloud` | build `npm run build:vps`, en-têtes et CSP de [deploy/apache-test.htaccess](../deploy/apache-test.htaccess), `noindex` | en-têtes, fallback SPA, 404 des assets absents |
| Base | copie de la prod du 24/11, plus 14 migrations plus récentes, données des marchands neutralisées (§5) | requêtes de contrôle |
| Storage | 668 fichiers copiés de la prod, transformation d'image active (imgproxy) | 11 fichiers publics en 200, redimensionnement, bucket privé refusé |
| Auth (GoTrue v2.198.0) | e-mail avec confirmation, téléphone coupé, e-mails captés par Mailpit | inscription, confirmation, réinitialisation et reconnexion testées dans Chrome |
| Edge Functions (edge-runtime v1.79.2) | 74 fonctions, contrôle JWT par fonction, CORS limité à `test.ecomfy.cloud` | fonction publique 200, fonction protégée 401, en-tête CORS |
| Vault et tâches cron | `supabase_project_url` et `cron_secret` posés | `app-health-monitor` et le cron des e-mails de livraison répondent 200 |
| Clés tierces (Resend, GeniusPay, IA, Meta, Google OAuth) | **aucune** (volontaire) | — |

Conséquence de l'absence de clés tierces : sur le VPS, les e-mails applicatifs, les paiements, la génération IA et la connexion Google échouent. On les ajoute une par une, avec des clés **de test**, quand on veut tester ces parcours (§7.3).

### Architecture sur le VPS

| Chemin ou conteneur | Rôle |
|---|---|
| `/opt/supabase` | pile Supabase Docker : `docker-compose.yml` d'origine, `.env`, `docker-compose.override.yml`, `functions.env` |
| `/opt/supabase/volumes/functions` | code des Edge Functions (copie de `supabase/functions` du dépôt) et routeur `main/` modifié (§6.2) |
| `/var/www/test.ecomfy.cloud` | clone du dépôt (branche `test/vps-selfhosted`) : build du front, scripts de `deploy/` |
| `supabase-envoy` (service `api-gw`) | passerelle API, en **Envoy** et non Kong ; adresse interne `http://api-gw:8000`, écoute sur `127.0.0.1:8000` |
| `supabase-db` | Postgres `supabase/postgres:17.6.1.136` |
| `supabase-auth`, `supabase-edge-functions`, `supabase-storage`, `realtime`, `supavisor`, `imgproxy`, `studio`, `meta`, `rest` | services Supabase |
| `supabase-mailpit` | serveur SMTP piège : garde tous les e-mails d'auth, n'envoie rien |

Les ports Postgres de Supavisor (5432, 6543) et l'interface Mailpit (8025) n'écoutent que sur `127.0.0.1`. On y accède par tunnel SSH.

---

## 2. Règles de sécurité de cet environnement

La base est une copie de la prod : elle contient les vrais comptes (81 utilisateurs au 24/11), les commandes, les adresses et les téléphones des clients.

1. **Aucune clé de prod sur le VPS.** Les clés tierces sont toujours des clés de test ou de sandbox.
2. **Aucun e-mail réel.** Les e-mails d'auth partent vers Mailpit ; les Edge Functions sont en `EMAIL_MODE=redirect`, et il n'y a pas de `RESEND_API_KEY`. Sans clé Resend, aucune fonction ne peut envoyer d'e-mail, même une qui contournerait le garde-fou.
3. **Aucun appel aux comptes des marchands.** Jetons publicitaires, pixels, jetons d'appareils et webhooks de l'API Ecomfy Pay sont neutralisés après chaque miroir (§5.3).
4. **Fichier de travail du miroir à supprimer** après les contrôles : `%TEMP%\mirror-vps-<date>` contient le dump de la prod.
5. Le front de test est en `noindex`. Le dossier `dist-vps/` n'est pas versionné.

---

## 3. Front de test

### 3.1 Build

Le front est construit sur le VPS, depuis le clone :

```bash
cd /var/www/test.ecomfy.cloud
git pull origin test/vps-selfhosted
npm ci
npm run build:vps         # → dist-vps/
cp deploy/apache-test.htaccess dist-vps/.htaccess
```

`npm run build:vps` lit `.env.vps.local` (non versionné) : `VITE_SUPABASE_URL=https://supabase.ecomfy.cloud`, `VITE_SUPABASE_PUBLISHABLE_KEY` = `ANON_KEY` du VPS. En mode `vps`, [vite.config.ts](../vite.config.ts) refuse toute autre URL : un bundle de test ne peut pas viser la prod. Les autres modes gardent la règle `*.supabase.co`.

Après un déploiement, le service worker peut servir l'ancienne version : recharger deux fois ou vider le stockage du site.

### 3.2 Apache

- Modules : `rewrite`, `headers` (et `proxy`, `proxy_http`, `proxy_wstunnel` pour le vhost Supabase).
- Le vhost `test.ecomfy.cloud-le-ssl.conf` a `AllowOverride All` : le `.htaccess` est lu.
- Contrôle :
  ```bash
  curl -sI https://test.ecomfy.cloud/ | grep -iE "content-security|cache-control|x-robots"
  curl -sI https://test.ecomfy.cloud/dashboard | head -1          # 200 (fallback SPA)
  curl -sI https://test.ecomfy.cloud/assets/inexistant.js | head -1  # 404
  ```

---

## 4. Supabase auto-hébergé

### 4.1 Fichiers de configuration

Le `docker-compose.yml` d'origine n'est pas modifié. Les ajouts passent par :

- **`.env`** : `COMPOSE_FILE=docker-compose.yml:docker-compose.override.yml`. Sans cette ligne, l'override est ignoré (« no such service: mailpit »).
- **`docker-compose.override.yml`** : service `mailpit`, et `env_file: ./functions.env` pour le service `functions`.
- **`functions.env`** (droits 600, hors dépôt) : variables des Edge Functions (§6.3).

Des sauvegardes horodatées existent à côté de chaque fichier modifié (`.env.bak-*`, `docker-compose.override.yml.bak`, `main/index.ts.orig-*`).

### 4.2 Variables du `.env` modifiées

| Variable | Valeur | Pourquoi |
|---|---|---|
| `SITE_URL` | `https://test.ecomfy.cloud` | redirection par défaut de GoTrue |
| `ADDITIONAL_REDIRECT_URLS` | `https://test.ecomfy.cloud/**` | sans elle, GoTrue renvoie **sans erreur** vers `SITE_URL` |
| `API_EXTERNAL_URL` | `https://supabase.ecomfy.cloud` | base des liens des e-mails d'auth |
| `SUPABASE_PUBLIC_URL` | `https://supabase.ecomfy.cloud` | valait `http://localhost:8000` |
| `ENABLE_EMAIL_SIGNUP` / `ENABLE_EMAIL_AUTOCONFIRM` | `true` / `false` | comme la prod |
| `ENABLE_PHONE_SIGNUP` / `ENABLE_PHONE_AUTOCONFIRM` | `false` / `false` | l'inscription par téléphone était ouverte et confirmée d'office |
| `ENABLE_ANONYMOUS_USERS` | `false` | — |
| `SMTP_HOST` / `SMTP_PORT` | `mailpit` / `1025` | SMTP piège |
| `SMTP_USER` / `SMTP_PASS` | **vides** | avec un identifiant, GoTrue (Go) refuse d'envoyer sur une connexion non chiffrée : « unencrypted connection » |
| `SMTP_ADMIN_EMAIL` / `SMTP_SENDER_NAME` | `noreply@test.ecomfy.cloud` / `Ecomfy TEST` | — |
| `FUNCTIONS_VERIFY_JWT` | `true` | contrôle JWT actif, avec les exceptions de §6.2 |

Les secrets par défaut du compose (JWT, mots de passe, clés) ont été vérifiés : tous sont personnalisés.

### 4.3 Redémarrages : piège d'Envoy

- Après un changement du `.env` qui concerne un service : `docker compose up -d <service>`. Le conteneur est recréé.
- **Après toute recréation du conteneur `functions`, redémarrer Envoy** : `docker restart supabase-envoy`. Sinon Envoy garde l'ancienne adresse du conteneur et répond « no healthy upstream » (503). Un simple `docker compose restart functions` garde l'adresse et ne pose pas ce problème.

### 4.4 Mailpit

Interface, depuis le poste local : `ssh -N -L 8025:127.0.0.1:8025 root@<vps>`, puis `http://localhost:8025`. Les e-mails sont ceux de GoTrue, en anglais.

---

## 5. Base de données

### 5.1 Miroir prod → VPS

Script : [scripts/mirror-prod-to-vps.ps1](../scripts/mirror-prod-to-vps.ps1), lancé depuis le poste Windows. La prod n'est lue qu'en lecture seule, et la base du VPS est **écrasée**.

Prérequis :
- `supabase` CLI connecté, `psql` et `node` dans le PATH, Docker Desktop démarré.
- **Tunnel SSH direct vers le conteneur de la base**, car Supavisor refuse l'utilisateur `postgres` :
  ```powershell
  # IP du conteneur : docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' supabase-db
  ssh -N -L 54322:<IP du conteneur supabase-db>:5432 root@<vps>
  ```
- `$env:VPS_DB_URL = "postgresql://postgres:<POSTGRES_PASSWORD encodé>@127.0.0.1:54322/postgres"`, saisi avec `Read-Host -AsSecureString`.
- `$env:VPS_SERVICE_ROLE_KEY` = `SERVICE_ROLE_KEY` du VPS (étape Storage).

```powershell
.\scripts\mirror-prod-to-vps.ps1                        # vérifications seulement
.\scripts\mirror-prod-to-vps.ps1 -Go -SkipVpsBackup     # exécute, après la phrase de confirmation MIROIR-VPS
.\scripts\mirror-prod-to-vps.ps1 -Go -SkipDb -SkipVpsBackup   # Storage seul
```

`-SkipVpsBackup` est obligatoire : le `pg_dump` du CLI tourne dans Docker et ne voit pas le tunnel Windows. Pour garder une sauvegarde, la faire sur le VPS (`docker exec supabase-db pg_dump …`).

Ce que fait le script :
- **Dumps de la prod :** schéma, données `public` et `storage` (sans `pgmq` ni les tables Storage interdites au rôle `postgres`), données `auth` et historique des migrations.
- **Restauration :** sans déclencheurs.
- **Nettoyage (§5.3).**
- **Comparaison des comptes de lignes** table par table.
- **Copie Storage forcée** (`FORCE_COPY=1`) : les lignes `storage.objects` arrivent avec la base, sans les fichiers.

Il ne restaure ni tâches cron ni secrets Vault : les contrôles affichent 0.

Résultat du 24/11 :
- **Comparaison :** 210 tables, 1 écart, `abandoned_carts`, corrigé à la main. L'écart venait de l'ancien dump `pgmq`, corrigé depuis.
- **Comptes :** 81 utilisateurs.
- **Storage :** 668 fichiers.

### 5.2 Migrations plus récentes que la prod

Script : [deploy/apply-migrations-vps.sh](../deploy/apply-migrations-vps.sh), lancé **sur le VPS**, depuis le clone. Il travaille par `docker exec` dans `supabase-db`, sans connexion à aucun projet cloud.

**Piège : l'historique de migrations de la prod est incomplet.** Il n'inscrit que 243 des 305 migrations du dépôt. 39 migrations sont pourtant présentes dans le schéma de la prod, passées sans être inscrites. Les rejouer échoue, ou réinstalle d'anciennes règles d'accès : c'est arrivé le 24/11 avec `20260902120000`, qui a remis 6 règles « Shop owners can… » sur les tables `shop_seo_*`, supprimées depuis. La liste vérifiée est dans [deploy/vps-migrations-deja-en-prod.txt](../deploy/vps-migrations-deja-en-prod.txt).

Après chaque miroir :
```bash
cd /var/www/test.ecomfy.cloud && git pull origin test/vps-selfhosted
bash deploy/apply-migrations-vps.sh --mark-applied deploy/vps-migrations-deja-en-prod.txt   # inscrit sans exécuter
bash deploy/apply-migrations-vps.sh             # liste ; au 24/11 : 14 à appliquer, 8 écartées
bash deploy/apply-migrations-vps.sh --apply     # une transaction par fichier, arrêt à la première erreur
```

Migrations écartées par défaut (`SKIP_VERSIONS`) :
- **`20260906000000`** : `corporate_invitations` ouverte à `anon`.
- **`20260908170000`** : buckets avec dépôt libre.
- **6 migrations de facturation par seuil :** `20260909100000`, `20260911120000`, `20260912000000`, `20261022150000`, `20261023140000`, `20261023150000`. Ce système est absent de la prod, et `20260909100000` remettrait une ancienne version de `get_shop_orders_secure`, ce qui ferait reculer le masquage des commandes des boutiques restreintes.

Le même enchaînement a été testé sur une base jetable dans l'état de la prod : 39 migrations inscrites, 14 appliquées, et rien à appliquer à la relance.

Au 24/11, la base du VPS = la prod + `20261103100000` (Studio IA) + `20261118100000` à `20261121120000` (Livraison réseau). Contrôle fait : historique de 296 versions et 54 fichiers, aucun objet des migrations écartées, seules les règles « Tenant isolation » sur `shop_seo_*`.

### 5.3 Neutralisation des données des marchands

Faite par le nettoyage du miroir, et une fois à la main le 24/11. Le contrôle « jetons/pixels marchands restants » doit valoir 0.

| Donnée | Traitement | Risque évité |
|---|---|---|
| `shop_secrets` : jetons Meta, TikTok, Snapchat, conversion Google Ads | mis à `null` | `track-conversion` (publique, appelée par le front) enverrait des événements aux vrais pixels |
| `shops.facebook_pixels`, `tiktok_pixels`, `snapchat_pixels` | vidés | le navigateur chargerait les vrais pixels |
| `ad_accounts.access_token`, `meta_ads_connections.access_token` | effacés / neutralisés, comptes désactivés | synchronisation des dépenses sur les vrais comptes |
| `shop_seo_connections` : jetons Google | `null` | appels Search Console |
| `device_tokens` | supprimés | notifications push vers les vrais téléphones |
| `ecomfy_api_webhook_endpoints` | désactivés | webhooks vers les serveurs des marchands |
| `auth.sessions`, `refresh_tokens`, `flow_state`, `one_time_tokens` | supprimés | sessions inutilisables ici de toute façon (autre secret JWT) |
| files `pgmq` | vidées | e-mails de la prod en attente |

Pour tester le suivi des conversions, mettre un pixel et un jeton Meta **de test** dans une seule boutique de test.

### 5.4 Contrôle rapide de la base

```bash
docker exec -i supabase-db sh -c 'PGPASSWORD="${PGPASSWORD:-$POSTGRES_PASSWORD}" psql -h localhost -U postgres -d postgres' <<'SQL'
select 'historique', count(*) from supabase_migrations.schema_migrations
union all select 'auth.users', count(*) from auth.users
union all select 'storage.objects', count(*) from storage.objects
union all select 'vault.secrets', count(*) from vault.secrets
union all select 'cron.job', count(*) from cron.job;
SQL
```

---

## 6. Edge Functions

### 6.1 Déploiement et mise à jour

```bash
cd /var/www/test.ecomfy.cloud && git pull origin test/vps-selfhosted
cp -a supabase/functions/. /opt/supabase/volumes/functions/
```

Le routeur relit le disque à chaque requête : aucun redémarrage n'est nécessaire pour du code. Le dépôt n'a ni dossier `main` ni dossier `hello`, donc la copie n'écrase pas le routeur. Une fonction supprimée du dépôt reste sur le VPS jusqu'à suppression manuelle.

### 6.2 Contrôle JWT par fonction

Le service `functions` n'applique qu'un `VERIFY_JWT` global et ignore `verify_jwt` de [supabase/config.toml](../supabase/config.toml). `/opt/supabase/volumes/functions/main/index.ts` a été modifié par un script perl. Le script refuse de toucher le fichier si les deux lignes visées ne sont pas exactement celles attendues. Il fait deux choses :
- il ajoute `NO_VERIFY_JWT`, la liste des **47** fonctions en `verify_jwt = false` (webhooks, crons avec `x-cron-secret`, sitemap, désinscription, IA publiques…) ;
- il saute le contrôle JWT pour ces fonctions seulement.

Les autres exigent un JWT valide.

- Liste à régénérer si `config.toml` change : `grep -B1 'verify_jwt = false' supabase/config.toml | grep -oE 'functions\.[a-z0-9-]+' | cut -d. -f2`.
- **Une mise à jour de la pile Supabase Docker peut écraser `main/index.ts`** : il faudra réappliquer la modification. L'original est sauvegardé en `index.ts.orig-*`.
- Tests :
  ```bash
  U=https://supabase.ecomfy.cloud/functions/v1
  curl -s -o /dev/null -w "%{http_code}\n" $U/get-vapid-key                    # 200 (publique)
  curl -s -o /dev/null -w "%{http_code}\n" -X POST $U/invite-shop-collaborator  # 401 (protégée)
  ```

### 6.3 Variables (`/opt/supabase/functions.env`)

```dotenv
APP_URL=https://test.ecomfy.cloud
ALLOWED_ORIGINS=https://test.ecomfy.cloud
INVITE_ALLOWED_ORIGINS=https://test.ecomfy.cloud
EMAIL_LINK_ORIGINS=https://test.ecomfy.cloud
EMAIL_MODE=redirect
EMAIL_REDIRECT_TO=<adresse de l'équipe>
CRON_SECRET=<valeur aléatoire propre au VPS>
```

Le compose fournit déjà `SUPABASE_URL=http://api-gw:8000` (adresse interne), `SUPABASE_PUBLIC_URL`, les clés et `SUPABASE_DB_URL`. Après modification de `functions.env` : `docker compose up -d functions && docker restart supabase-envoy` (§4.3).

### 6.4 Vault et tâches cron

```sql
select vault.create_secret('http://api-gw:8000', 'supabase_project_url');   -- adresse interne, sans aller-retour par Internet
select vault.create_secret('<CRON_SECRET de functions.env>', 'cron_secret');
```

`invoke_edge_function` lit ces deux secrets. Sans eux, il avertit et n'appelle rien. Fonctions appelées par la base : `app-health-monitor`, `ecomfy-pay-api` (webhooks, désactivés), `send-delivery-notification-emails`, `send-weekly-finance-summary`.

Le premier appel d'une fonction peut dépasser le délai de 5 s de `pg_net` : le runtime télécharge et compile alors ses dépendances. Les appels suivants sont rapides : 117 ms pour `app-health-monitor`.

Les tâches cron présentes au 24/11 sont `expire-stale-studio-generations` (SQL) et `delivery-notification-emails`. Celles de la prod ne sont pas copiées par le miroir.

---

## 7. Limites connues et suite

### 7.1 Ne fonctionne pas sur le VPS, par construction

| Point | Cause | Piste |
|---|---|---|
| E-mails applicatifs, paiements, IA | pas de clés tierces (§2) | clés de test, une par une (§7.3) |
| Connexion Google | pas de client OAuth | client OAuth **de test** : URI `https://supabase.ecomfy.cloud/auth/v1/callback`, origine `https://test.ecomfy.cloud`, variables `GOTRUE_EXTERNAL_GOOGLE_*` dans le service `auth` (override) |
| E-mails d'auth en français (hook `auth-email-hook`) | le lien est construit avec `SUPABASE_URL` (`http://api-gw:8000`) dans [auth-email-hook/index.ts](../supabase/functions/auth-email-hook/index.ts) et [send-email/index.ts](../supabase/functions/send-email/index.ts) | lire `SUPABASE_PUBLIC_URL` en priorité (correctif de code) |
| 6 fonctions d'e-mail en JSX (`auth-email-hook`, `send-transactional-email`, `process-email-queue`, `preview-transactional-email`, `handle-email-*`) | le routeur charge un `deno.jsonc` commun et ignore le `deno.json` propre à chaque fonction | adapter `importMapPath` dans `main/index.ts` |
| Page « code à 6 chiffres » ([VerifyEmail.tsx](../src/pages/VerifyEmail.tsx)) | le modèle GoTrue par défaut n'envoie qu'un lien | `GOTRUE_MAILER_TEMPLATES_CONFIRMATION` ; la confirmation par lien fonctionne |
| Fonction `mcp` et `/oauth/consent` | émetteur `*.supabase.co` en dur dans [mcp/index.ts](../supabase/functions/mcp/index.ts) | hors périmètre |
| Images des boutiques | les URL publiques enregistrées en base pointent vers le Storage de la **prod** (hôte `yfggrceynzcwklbxhgix.supabase.co`) | sans risque, en lecture ; voir le plan de bascule |

### 7.2 Points d'attention pendant les tests

- **PKCE :** les liens de confirmation et de réinitialisation doivent être ouverts dans le navigateur qui a fait la demande.
- **Adresses refusées :** l'application refuse les adresses jetables comme `example.com`. Mailpit capte tout, donc n'importe quelle adresse sur un domaine réel convient.
- **Facturation :** les crons de facturation peuvent suspendre des boutiques de test.
- **Accès :** les vrais comptes de la prod existent sur le VPS avec leur vrai mot de passe. Ne s'y connecter qu'avec l'accord du titulaire, et préférer des comptes de test.

### 7.3 Ajouter un service tiers en test

1. Ajouter la clé **de test** dans `functions.env`.
2. `docker compose up -d functions && docker restart supabase-envoy`.
3. Pour Resend : vérifier d'abord `EMAIL_MODE=redirect` et `EMAIL_REDIRECT_TO`. Contrôler que les fonctions qui appellent Resend passent toutes par `guardEmail` ([_shared/email-sender.ts](../supabase/functions/_shared/email-sender.ts)) : 13 fonctions appellent Resend directement.
4. Pour GeniusPay : clés sandbox uniquement ; webhooks vers `https://supabase.ecomfy.cloud/functions/v1/...`.

### 7.4 Recette restante

| # | Parcours | État |
|---|---|---|
| 1 | Inscription, confirmation, profil, déconnexion, mot de passe oublié, reconnexion | fait le 24/11 |
| 2 | Connexion Google | en attente du client de test |
| 3 | Boutique publique, fiche produit, commande | à faire |
| 4 | Tableau de bord marchand, appel d'une Edge Function protégée | à faire |
| 5 | Temps réel (WebSocket `wss://supabase.ecomfy.cloud/realtime/v1/...`) | à faire |
| 6 | Session conservée après fermeture de l'onglet | à faire |

---

## Annexe : audit auth du front (24/11)

Toutes les URL de retour sont construites avec `window.location.origin` : **aucune URL de prod en dur dans le parcours d'auth**.

| Appel | Fichier | URL de retour |
|---|---|---|
| Client : `flowType: 'pkce'`, `detectSessionInUrl: true`, `storageKey: 'ecomfy-auth-token'` | [client.ts](../src/integrations/supabase/client.ts) | — |
| `signUp` | [Auth.tsx](../src/pages/Auth.tsx) | `${origin}/auth?type=signup&confirmed=true` |
| `signInWithOAuth` (Google) | [Auth.tsx](../src/pages/Auth.tsx) | `${origin}/dashboard` |
| `resetPasswordForEmail` | [Auth.tsx](../src/pages/Auth.tsx), [ResetPassword.tsx](../src/pages/ResetPassword.tsx) | `${origin}/reset-password` |
| `exchangeCodeForSession` (manuel, redondant avec `detectSessionInUrl`, inoffensif) | [App.tsx](../src/App.tsx) | `/dashboard` |
| `verifyOtp` (code à 6 chiffres) | [VerifyEmail.tsx](../src/pages/VerifyEmail.tsx) | — |

Aucun secret exposé côté navigateur : le front ne lit que `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` et `VITE_VAPID_PUBLIC_KEY`. `test.ecomfy.cloud` est reconnu comme hôte de l'application et non comme domaine de boutique ([leanShopPath.ts](../src/lib/leanShopPath.ts), commit e58c25b).
