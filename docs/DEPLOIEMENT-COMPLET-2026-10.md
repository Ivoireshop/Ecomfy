# Déploiement complet des correctifs de sécurité (branche `jeanmarc`)

**Périmètre :** tous les correctifs de la branche par rapport à `main` : C1 à C8, H1 à H11, plus les corrections de la session de test du 18/10/2026 (wallet, `shops.name`, `is_founder_or_cofounder`, meta CSP).
**Projets Supabase :** production `yfggrceynzcwklbxhgix` · dev `xfpbpxncserliskrbaim`.
**Documents liés :** `AUDIT-PROJET-2026-10.md` (constats), `DEPLOIEMENT-PROD-2026-10.md` (vague 1, déjà en production), `DEPLOIEMENT-DEV-2026-10.md`, `KYC-REVUE-ET-DEPLOIEMENT-C4.md`, `VERIFICATION-CORRECTIFS-2026-10.md`.

Ce fichier donne **l'ordre unique** des commandes. Il s'applique à la production ; la section 12 dit où en est dev.

---

## 0. Règles à respecter

1. **Jamais `supabase db push`.** La base réelle diverge des migrations du dépôt, et `db push` appliquerait les ~25 migrations en attente, dont certaines contiennent des failles non corrigées (facturation par seuil, `strict_multitenant_privacy`, `corporate_invitations`). Les migrations s'appliquent **une par une** dans l'éditeur SQL du tableau de bord.
2. **Désactiver « Deploy to production »** de l'intégration GitHub de Supabase (Project Settings > Integrations > GitHub) **avant** de fusionner la branche dans `main`. Sinon la fusion applique toutes les migrations en attente.
3. **Ne jamais exécuter `supabase link` vers la production** dans ce dépôt : le projet lié aujourd'hui est dev, et les commandes `supabase db query --linked` et `supabase migration …` visent le projet lié. Pour la production : éditeur SQL du tableau de bord, et `--project-ref` explicite pour les fonctions et les secrets.
4. **Ne pas utiliser** `supabase/deploy-dev/*` en production (copies pour dev, `02` crée un schéma incompatible avec la production).
5. **Snapshot** de la base de production avant toute écriture (Database > Backups > point de restauration).
6. **Sous Windows, `--use-api`** pour déployer une Edge Function (sans lui, le bundling Docker échoue sur le chemin).
7. Chaque fichier SQL se colle **en entier** dans l'éditeur. Les migrations d'Ecomfy Pay (`20260914190000`, `20260914200000`) ne sont pas idempotentes : les entourer de `begin;` … `commit;`.

## 1. Carte des correctifs

| Point | Quoi | Où se déploie | Dépend de |
|---|---|---|---|
| C1 | Portefeuille Ecomfy Pay verrouillé | migrations `20260914190000`, `20260914200000`, fonction `ecomfy-pay-withdraw` | C5, C6, H1 |
| C2 | RPC de facturation et d'activation réservées à `service_role` | **déjà en production** (vague 1) | – |
| C3 | `get_shop_orders_secure` | **déjà en production** | – |
| C4 | KYC : pas d'auto-validation, écran de revue, retraits suspendus | dans les migrations Ecomfy Pay, écran `/founder/kyc-review` (front) | Ecomfy Pay |
| C5 | Webhook `ecomfy-pay-webhook` signé (HMAC) | fonction + secret `GENIUSPAY_WEBHOOK_SECRET` | – |
| C6 | Montants et crédits décidés par le serveur | migration `20261015120000` + `process-payment`, `ecomfy-pay-initiate`, front | – |
| C7 | `manage-founder-roles`, RLS `user_roles` | **déjà en production** | – |
| C8 | `tracking.ts` n'accepte que `G-XXXX` | **déjà en production** (`track-conversion` + front) | – |
| H1 | Pièces KYC en bucket privé, liens signés | migration `20261015140000` + script de migration des fichiers + front | Ecomfy Pay (`merchant_kyc`) |
| H2 | Gouvernance `corporate_*` | hotfix `20261012120000` **en production** ; reste `20261015150000` + front (onboarding) | – |
| H3 | `isAuthorizedCron` sans JWT non vérifié | 8 fonctions cron + secrets (`CRON_SECRET`, Vault) | – |
| H4 | Fonctions d'e-mail authentifiées et échappées | 5 fonctions | – |
| H5 | `verify-delivery-identity` réservé aux admins | fonction + migration `20261016120000` | module livraison |
| H6 | Affiliation : RLS et RPC | migrations `20261005160000` + `20261017120000`, `geniuspay-webhook`, front | – |
| H7 | Pas de double crédit (verrou par référence) | migration `20261015130000` + `geniuspay-webhook`, `verify-payment`, `reconcile-pending-payments` | – |
| H8 | En-têtes de sécurité et CSP | `vercel.json` (déployé avec le front) | – |
| H9 | Authentification et quotas des fonctions IA | 14 fonctions IA + `check_rate_limit` présente | – |
| H10 | Création de commande publique par RPC | migration `20261018120000` + front (en même temps) | C6, `20261015160000` |
| H11 | Projets prod/dev séparés | **déjà en production** | – |
| Divers | `get_or_create_my_wallet`, garde `is_founder_or_cofounder`, `shops.name`, meta CSP | migration `20261018130000` + front | Ecomfy Pay, H6 |

## 2. Variables (PowerShell, depuis `C:\dev\Ecomfy`)

```powershell
$P = "yfggrceynzcwklbxhgix"          # PRODUCTION. Pour dev : "xfpbpxncserliskrbaim"
npx supabase@latest login
```

## 3. Phase 0 : pré-vérifications (lecture seule, éditeur SQL de la production)

Ne rien écrire tant que ces résultats ne sont pas relevés. Tout est idempotent ou protégé, mais l'ordre dépend de ce qui existe déjà.

```sql
-- 3.1 Ce qui existe déjà. Attendu en production après la vague 1 : voir la colonne « attendu ».
select
  to_regclass('public.merchant_kyc')            as merchant_kyc,        -- attendu NULL (Ecomfy Pay absent)
  to_regclass('public.wallets')                 as wallets,             -- attendu NULL
  to_regclass('public.ecomfy_payment_links')    as ecomfy_payment_links,-- attendu NULL
  to_regclass('public.affiliates')              as affiliates,          -- NULL = H6 à déployer avec la base 20261005160000
  to_regclass('public.delivery_companies')      as delivery_companies,  -- NULL = ignorer la migration H5
  to_regclass('public.rate_limit_hits')         as rate_limit_hits,     -- doit exister (H9)
  to_regclass('public.order_bundles')           as order_bundles;

-- 3.2 H9 : la RPC check_rate_limit doit exister, sinon toutes les fonctions IA refusent les appels.
select proname, pg_get_function_identity_arguments(oid) from pg_proc
where pronamespace = 'public'::regnamespace and proname in ('check_rate_limit','is_founder_or_cofounder','get_shop_orders_secure');

-- 3.3 La vague 1 est bien en place (attendu : 2 helpers, 2 politiques permissives, droits service_role seul)
select (select count(*) from pg_proc where proname in ('is_corporate_founder','is_corporate_reader')) as helpers_attendu_2,
       (select count(*) from pg_policies where schemaname='public' and tablename like 'corporate_%'
          and (qual='true' or with_check='true')) as permissives_attendu_2;

-- 3.4 is_founder_or_cofounder : qui l'utilise ? (la migration 20261018130000 la restreint à l'appelant lui-même)
select 'policy' k, schemaname||'.'||tablename||' / '||policyname n from pg_policies
 where coalesce(qual,'') ilike '%is_founder_or_cofounder%' or coalesce(with_check,'') ilike '%is_founder_or_cofounder%'
union all
select 'function', p.proname from pg_proc p where p.prosrc ilike '%is_founder_or_cofounder%' and p.proname <> 'is_founder_or_cofounder';
-- Chaque usage doit passer auth.uid(). Si une fonction ou une politique l'appelle avec un autre identifiant,
-- ne pas appliquer la section 2 de 20261018130000 sans l'adapter.

-- 3.5 Données piégées par C8 (attendu : 0 ligne). Si une ligne ressort, réinitialiser les sessions concernées.
select id, slug, user_id, left(google_analytics_code, 120) as extrait
from public.shops
where google_analytics_code ~* '(<script|<img|<svg|<iframe|onerror|onload|javascript:|fetch\(|localStorage|document\.cookie)'
   or (google_analytics_code is not null and google_analytics_code !~ '^\s*G-[A-Za-z0-9]{4,20}\s*$'
       and google_analytics_code ~ '[<>]');
```

Vérifier aussi, tableau de bord > Edge Functions > Secrets, la présence de : `SUPABASE_SERVICE_ROLE_KEY` (automatique), `APP_URL`, `RESEND_API_KEY`, `LOVABLE_API_KEY`, `GENIUSPAY_API_KEY`, `GENIUSPAY_API_SECRET`, `CRON_SECRET`.

## 4. Phase 1 : secrets et Vault

```powershell
# 4.1 Lister l'existant (les valeurs sont hachées dans la sortie)
npx supabase@latest secrets list --project-ref $P

# 4.2 C5 : secret de signature du webhook GeniusPay (valeur donnée par GeniusPay, à coller telle quelle)
npx supabase@latest secrets set GENIUSPAY_WEBHOOK_SECRET=<valeur_geniuspay> --project-ref $P

# 4.3 Garde-fou d'e-mails : en production, live. Sur dev : redirect + EMAIL_REDIRECT_TO=<votre adresse>.
npx supabase@latest secrets set EMAIL_MODE=live APP_URL=https://ecomfy.cloud --project-ref $P

# 4.4 H4 (optionnel) : origines supplémentaires autorisées pour le lien d'invitation de send-corporate-invite
#     (en plus d'APP_URL et du domaine public), séparées par des virgules
npx supabase@latest secrets set EMAIL_LINK_ORIGINS=https://ecomfy.cloud --project-ref $P
```

`CRON_SECRET` existe déjà en production (H3 : « réutiliser la valeur, ne pas l'écraser »). Vérifier qu'elle est identique au secret Vault `cron_secret` (éditeur SQL) :

```sql
select name, created_at from vault.secrets where name in ('supabase_project_url','cron_secret','email_queue_service_role_key');
-- attendu : 3 lignes. Si 'cron_secret' diffère de CRON_SECRET (les tâches planifiées recevraient 401) :
-- select vault.update_secret((select id from vault.secrets where name='cron_secret'), '<VALEUR EXACTE>');
```

## 5. Phase 2 : base, bloc A (rétrocompatible avec le front et les fonctions actuels)

Éditeur SQL de production, **un fichier à la fois, en entier, dans cet ordre**. Les trois sont idempotents.

| # | Fichier | Corrige | Remarque |
|---|---|---|---|
| A1 | `supabase/migrations/20261015120000_c6_order_bundles_and_public_insert_guard.sql` | C6 | Doit passer **avant** `process-payment`, `ecomfy-pay-initiate` et le front. Ajoute `bundle_index`, `scheduled_delivery_date`, `internal_delivery_note` si absentes. |
| A2 | `supabase/migrations/20261015160000_fix_order_items_public_insert_policy.sql` | C6 (suite) | Après A1. |
| A3 | `supabase/migrations/20261015130000_h7_serialize_billing_rpc_per_reference.sql` | H7 | Ajoute un verrou par référence ; le corps des fonctions est inchangé, les droits `service_role` sont conservés. |

Vérification après A1 à A3 :

```sql
select
  exists(select 1 from information_schema.columns where table_name='order_items' and column_name='bundle_index') as bundle_index,
  exists(select 1 from pg_proc where proname='is_fresh_public_order')                                           as is_fresh,
  (select pg_get_functiondef(oid) like '%pg_advisory_xact_lock%' from pg_proc where proname='apply_commission_payment' and pronamespace='public'::regnamespace) as h7_commission,
  (select pg_get_functiondef(oid) like '%pg_advisory_xact_lock%' from pg_proc where proname='apply_shop_subscription' and pronamespace='public'::regnamespace) as h7_subscription;
-- attendu : 4 × true
```

## 6. Phase 3 : Edge Functions, lot 1 (47 fonctions)

Aucune ne dépend d'une migration non encore appliquée. Elles regroupent H3, H4, H5, H9, C6 (`process-payment`), C7, C8 et celles qui importent un fichier `_shared` modifié.

```powershell
$lot1 = @(
  "app-health-monitor","app-remediation","auth-email-hook","check-ad-token-expiry","correct-text",
  "create-student-account","create-video-from-image","extract-brand","finance-advisor","founder-activate-shop",
  "founder-record-commission-payment","generate-ad-visual","generate-ai-image","generate-feature-image",
  "generate-product-sheet","generate-shop-content","generate-showcase-site","generate-video","generate-voiceover",
  "invite-shop-collaborator","manage-founder-roles","mcp","preview-transactional-email","process-payment",
  "process-queue","product-ai-optimizer","reconcile-pending-payments","send-24h-reminder",
  "send-booking-notification","send-contact-notification","send-corporate-invite",
  "send-domain-ready-notification","send-email","send-generation-reminder","send-promo-notification",
  "send-subscription-email","send-transactional-email","send-weekly-finance-summary","seo-auto-index",
  "shop-ai-assistant-chat","shop-chatbot","showcase-chat","track-conversion","translate-product","translate-ui",
  "verify-delivery-identity","verify-domain-dns"
)
foreach ($f in $lot1) {
  Write-Host "### $f"
  npx supabase@latest functions deploy $f --project-ref $P --use-api
  if ($LASTEXITCODE -ne 0) { Write-Host "ECHEC : $f" -ForegroundColor Red }
}
```

Un déploiement prend une dizaine de secondes (mesuré sur dev) : compter 10 à 15 minutes pour le lot. Relancer seulement les fonctions en échec. `manage-founder-roles` importe `./handler.ts` : si `--use-api` échoue sur elle, la redéployer avec Docker Desktop lancé, depuis un chemin sans espace ou depuis WSL.

Contrôle sans JWT (attendu : 401 pour chacune, sauf `showcase-chat`, `translate-ui`, `correct-text` qui répondent par un refus applicatif) :

```powershell
$env:U = (Select-String -Path .env -Pattern '^VITE_SUPABASE_URL=').Line.Split('"')[1]
$env:K = (Select-String -Path .env -Pattern '^VITE_SUPABASE_PUBLISHABLE_KEY=').Line.Split('"')[1]   # ATTENTION : .env pointe sur dev
foreach ($f in "founder-record-commission-payment","founder-activate-shop","manage-founder-roles","send-corporate-invite","verify-delivery-identity","shop-chatbot","generate-ai-image") {
  try { Invoke-WebRequest -Method Post -Uri "$env:U/functions/v1/$f" -Headers @{ apikey = $env:K } -ContentType "application/json" -Body "{}" -UseBasicParsing | Out-Null; "$f -> 200" }
  catch { "$f -> $($_.Exception.Response.StatusCode.value__)" }
}
```

> Le `.env` du poste pointe sur **dev**. Pour tester la production, remplacer `$env:U` et `$env:K` par l'URL et la clé `anon` de la production.

## 7. Phase 4 : base, bloc B (nécessite le nouveau front : à enchaîner avec la phase 5)

Ces migrations ferment des écritures que l'**ancien** front utilise encore (insertion directe de commandes, profil d'affiliation, onboarding corporate). Les appliquer juste avant de promouvoir le front (section 8).

| # | Fichier | Corrige | Prérequis |
|---|---|---|---|
| B1 | `supabase/migrations/20261015150000_h2_corporate_audit_append_only.sql` | H2 : journal d'audit en ajout seul | hotfix `20261012120000` |
| B2 | **`20261005160000_ecomfy_affiliate_system.sql` + `20261017120000_h6_affiliate_rls_rpc_hardening.sql` collés dans une seule transaction** | H6 | `profiles`, `payments` ; **ne jamais appliquer la première seule** (elle crée des politiques d'insertion ouvertes) |
| B3 | `supabase/migrations/20261018120000_h10_create_public_order_rpc.sql` | H10 | A1 et A2 |
| B4 | `supabase/migrations/20261016120000_h5_delivery_verification_guard.sql` | H5 | **seulement si** `delivery_companies` existe (section 3.1) ; sinon ignorer |

Pour B2, depuis PowerShell, produire le fichier unique à coller :

```powershell
Get-Content supabase\migrations\20261005160000_ecomfy_affiliate_system.sql, supabase\migrations\20261017120000_h6_affiliate_rls_rpc_hardening.sql |
  Set-Content -Encoding utf8 $env:TEMP\affiliate_h6.sql
# puis coller le contenu de $env:TEMP\affiliate_h6.sql dans l'éditeur SQL, entouré de begin; ... commit;
```

Vérification après B1 à B4 :

```sql
-- H10 : INSERT direct fermé, RPC ouverte (attendu : false, false, true)
select has_table_privilege('anon','public.orders','insert')               as anon_insert_orders,
       has_table_privilege('authenticated','public.order_items','insert') as auth_insert_items,
       has_function_privilege('anon', 'public.create_public_order(uuid,text,text,jsonb,text,text,text,text,text,text)', 'execute') as rpc_ok;

-- H6 : aucune politique d'écriture directe sur affiliates / affiliate_referrals (attendu : seulement SELECT ou UPDATE fondateur)
select tablename, policyname, cmd from pg_policies where tablename in ('affiliates','affiliate_referrals') order by 1,2;

-- H6 : RPC serveur fermées au navigateur (attendu : process_affiliate_commission_for_payment et get_or_create_affiliate = service_role seul)
select p.proname, has_function_privilege('anon',p.oid,'execute') anon, has_function_privilege('authenticated',p.oid,'execute') auth, has_function_privilege('service_role',p.oid,'execute') svc
from pg_proc p where pronamespace='public'::regnamespace
  and proname in ('record_affiliate_referral','process_affiliate_commission_for_payment','get_or_create_affiliate','get_or_create_my_affiliate','mark_affiliate_payout_paid','reverse_affiliate_commission_for_payment')
order by 1;

-- H2 : journal et acceptations sans UPDATE ni DELETE (attendu : SELECT et INSERT seulement)
select tablename, policyname, cmd from pg_policies where tablename in ('corporate_audit_logs','corporate_document_acceptances') order by 1,2;
```

## 8. Phase 5 : edge functions, lot 2, puis front

### 8.1 Lot 2 (après B2 : `geniuspay-webhook` appelle `reverse_affiliate_commission_for_payment`, `verify-payment` appelle `process_affiliate_commission_for_payment`)

```powershell
foreach ($f in "geniuspay-webhook","verify-payment") {
  Write-Host "### $f"
  npx supabase@latest functions deploy $f --project-ref $P --use-api
}
```

### 8.2 Front (Vercel) : déployer le build **sans le promouvoir**, appliquer la base, puis promouvoir

Cette séquence réduit à quelques secondes la fenêtre où l'ancien front ne peut plus créer de commande (H10) ni de profil d'affiliation (H6).

```powershell
git checkout jeanmarc
git pull
npm ci
npm run build                      # contrôle local : doit passer, avec VITE_SUPABASE_URL et la clé de PRODUCTION définies
```

1. Fusionner `jeanmarc` dans `main` (après avoir vérifié la règle 2 de la section 0), ou pousser la branche pour obtenir un déploiement Vercel de prévisualisation. Dans Vercel, les variables d'environnement **Production** doivent contenir `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY` de la production (H11).
2. Attendre que le déploiement soit **prêt** (Ready) sans le basculer en production (désactiver la promotion automatique, ou déployer avec `vercel deploy --prod --skip-domain`).
3. Appliquer la section 7 (B1 à B4) si ce n'est pas déjà fait.
4. Promouvoir le déploiement : tableau de bord Vercel > Deployments > Promote to Production, ou `vercel promote <url-du-deploiement>`.

`vercel.json` (H8) est servi avec le front : en-têtes `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, `Cross-Origin-Opener-Policy` et `Content-Security-Policy`. `'unsafe-inline'` reste dans `script-src`.

Après promotion, ouvrir la console du navigateur sur : l'accueil, la connexion, l'éditeur de boutique, une vitrine avec pixels, une fiche produit et la commande. Aucune ligne « Refused to … Content Security Policy » ne doit apparaître. Une violation sur un service non listé (Cloudinary d'upload, redirection de paiement, OAuth Google) se corrige en ajoutant son domaine à `connect-src` / `form-action` de `vercel.json`.

## 9. Phase 6 : Ecomfy Pay (C1, C4, C5, H1), « vague 2 »

**À ne lancer que si ces conditions sont réunies** (sinon passer directement à la section 10) :

- [ ] `GENIUSPAY_WEBHOOK_SECRET` défini (section 4.2) et l'URL appelée par GeniusPay pour Ecomfy Pay est `https://<ref>.supabase.co/functions/v1/ecomfy-pay-webhook` ;
- [ ] C6 en place (sections 5 et 6) ;
- [ ] `select to_regclass('public.merchant_kyc'), to_regclass('public.wallets'), to_regclass('public.withdrawal_requests'), to_regclass('public.ecomfy_payment_links');` renvoie quatre `NULL` (si l'une existe, **ne rien lancer** : il y a des données, un autre chemin est à écrire) ;
- [ ] au moins un compte `founder` ou `co_founder` dans `user_roles` pour la revue KYC ;
- [ ] snapshot pris.

### 9.1 Edge Functions Ecomfy Pay (avant la base)

```powershell
foreach ($f in "ecomfy-pay-webhook","ecomfy-pay-initiate","ecomfy-pay-withdraw") {
  Write-Host "### $f"
  npx supabase@latest functions deploy $f --project-ref $P --use-api
}
```

### 9.2 Base (éditeur SQL, une fois chacun, dans cet ordre, chacun entre `begin;` et `commit;`)

1. `supabase/migrations/20260914190000_ecomfy_pay_system.sql`
2. `supabase/migrations/20260914200000_ecomfy_pay_enhanced.sql`
3. `supabase/migrations/20261015140000_h1_kyc_private_bucket.sql` (H1, idempotent ; **avant** que des marchands déposent des pièces)
4. `supabase/migrations/20261018130000_wallet_self_rpc_and_role_helper_guard.sql` (après 1 et 2 pour `wallets`, après B2 pour `is_founder_or_cofounder` ; relire la section 3.4)

En cas d'erreur : `rollback;`, rien n'est appliqué, corriger puis rejouer. Le fichier `20261018130000` ne doit jamais passer **avant** `20260914190000` (il référence `public.wallets`).

### 9.3 Fichiers KYC déjà déposés dans l'ancien bucket public (H1)

Simulation d'abord, puis exécution. La clé `service_role` se passe en variable d'environnement de la session, jamais dans un fichier.

```powershell
$env:SUPABASE_URL = "https://yfggrceynzcwklbxhgix.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = Read-Host "service_role (production)"
node scripts/migrate-kyc-to-private-bucket.mjs                  # simulation : rien n'est écrit
node scripts/migrate-kyc-to-private-bucket.mjs --apply          # déplace les pièces vers kyc-documents
# optionnel, après contrôle : supprime les fichiers non référencés de shop-images/kyc/
# node scripts/migrate-kyc-to-private-bucket.mjs --apply --purge-orphans
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
```

### 9.4 Vérifications Ecomfy Pay (lecture seule)

```sql
select count(*) from pg_proc where proname = 'evaluate_merchant_kyc_security';                 -- attendu 0
select count(*) from pg_trigger where tgname = 'merchant_kyc_guard_review_columns' and not tgisinternal;  -- attendu 1
select value from public.ecomfy_pay_settings where key = 'withdrawals_enabled';                  -- attendu false
select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'kyc-documents'; -- attendu false, 5242880, {image/jpeg,image/png,image/webp}
select policyname, cmd from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'kyc_documents_%' order by 1; -- attendu 3 lignes
select count(*) from public.merchant_kyc where verification_status = 'VERIFIED';                 -- attendu 0
select p.proname, has_function_privilege('anon',p.oid,'execute') anon, has_function_privilege('authenticated',p.oid,'execute') auth
from pg_proc p where pronamespace='public'::regnamespace
  and proname in ('get_or_create_merchant_wallet','credit_merchant_wallet_pending','process_wallet_settlements','request_wallet_withdrawal_atomic','get_or_create_my_wallet','review_merchant_kyc');
-- attendu : les trois premières fermées à anon ET authenticated ; request_wallet_withdrawal_atomic, get_or_create_my_wallet et review_merchant_kyc ouvertes à authenticated seulement
```

### 9.5 Mise en service (retraits suspendus)

1. **Laisser `withdrawals_enabled = false`.**
2. Un fondateur ouvre `/founder/kyc-review` et vérifie que la liste se charge.
3. Un compte jetable dépose un dossier depuis `/ecomfy-pay?tab=kyc` ; il reste « Examen en cours ». Le fondateur le valide ; côté marchand, « Compte vérifié ».
4. Après la première revue réelle seulement, ouvrir les retraits (éditeur SQL, rôle `postgres`) :
   ```sql
   update public.ecomfy_pay_settings set value = 'true'::jsonb, updated_at = now() where key = 'withdrawals_enabled';
   ```
5. Un paiement de test GeniusPay doit être confirmé par le webhook sans erreur `forbidden` et créditer le portefeuille.

## 10. Phase 7 : tests de recette (production, comptes jetables)

Comptes jetables uniquement (Authentication > Users > Add user, **Auto Confirm User**). Pour le fondateur jetable :

```sql
insert into public.user_roles (user_id, role) select id, 'co_founder' from auth.users where email = '<email_fondateur_jetable>';
```

| Parcours | Attendu |
|---|---|
| Visiteur anonyme : commande en paiement à la livraison sur une boutique de test | Page de confirmation ; commande `new`, paiement `pending`, numéro `VP-…` généré par le serveur |
| `POST /rest/v1/orders` direct (anon ou connecté) | 401/403, `permission denied` |
| Appel `create_public_order` avec `unit_price` falsifié, quantité 0 ou 1000, produit d'une autre boutique, statut `delivered` | Prix serveur ; erreurs « Quantité invalide », « Article invalide », « Produit indisponible » ; statut ramené à `new` |
| 6 commandes rapprochées pour le même téléphone | La 6e : « Trop de commandes » |
| Pixels : GA4 `G-ABCD1234"></script>` puis `G-TEST12345` | Refusé puis accepté ; la vitrine ne charge que `gtag/js?id=G-TEST12345`, aucun script en ligne |
| `process-payment` avec abonnement à 1 FCFA, pack de crédits à 1 FCFA, activation à 1 FCFA, `user_id` d'un autre compte | « Montant du plan incorrect », « Pack de crédits inconnu », « Montant d'activation incorrect », refus |
| Fondateur : paiement manuel de commission et activation manuelle (`/founder-dashboard`) | `commission_payments` avec `created_by` ; solde réduit |
| Marchand : `founder-record-commission-payment`, `founder-activate-shop`, `manage-founder-roles`, `send-corporate-invite`, `verify-delivery-identity` | 403 |
| Marchand : `UPDATE affiliates SET commission_rate`, `INSERT affiliates`, RPC `process_affiliate_commission_for_payment` | 0 ligne / refus RLS / 42501 |
| `/affiliate` en marchand | Profil créé par `get_or_create_my_affiliate`, taux 20 % |
| Fondateur : `UPDATE` et `DELETE` sur `corporate_audit_logs` | 0 ligne touchée |
| Marchand : `UPDATE merchant_kyc SET verification_status='VERIFIED'` | Statut inchangé (`PENDING`) |
| `/founder/kyc-review` : fiche d'un dossier | Images chargées par `storage/v1/object/sign/kyc-documents/...?token=…` (200), pas par une URL publique |
| `shop-chatbot` : 26 messages en une minute | Les 20 premiers passent, les suivants : « Trop de messages » |
| Fonctions IA sans connexion (`correct-text`, `generate-ai-image`, `generate-ad-visual`) | `not_authenticated` |
| `/ecomfy-pay` en marchand | Aucune erreur 403, 400 ou 404 dans la console ; portefeuille créé à la première visite |
| `is_founder_or_cofounder` appelée par `anon` avec l'UUID d'un fondateur | `null` / refus (plus d'oracle) |

Sur **dev uniquement**, `scripts/verify-dev-security.mjs` automatise une partie de ces contrôles (il refuse de viser la production) :

```bash
set -a; . ./.env; set +a
SUPABASE_URL="$VITE_SUPABASE_URL" SUPABASE_ANON_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY" \
MERCHANT_EMAIL='<marchand_jetable>' MERCHANT_PASSWORD='...' \
FOUNDER_EMAIL='<fondateur_jetable>'  FOUNDER_PASSWORD='...' \
node scripts/verify-dev-security.mjs
```

Tests Node de la branche (sans accès réseau) :

```powershell
node --experimental-strip-types --test supabase/tests/*.test.ts       # attendu : 61 réussis
```

## 11. Surveillance après déploiement (24 à 48 h)

- Journaux Postgres et Edge Functions : `42501`, `forbidden`, `permission denied`. Une tâche planifiée qui appellerait une RPC désormais fermée avec la clé `anon` échoue en 42501.
- Journaux de `geniuspay-webhook`, `verify-payment`, `reconcile-pending-payments` : aucun double crédit (`commission_payments` et `payments` avec la même référence).
- `app_incidents` et réponse 200 du health-monitor.
- `withdrawal_requests` à `REQUESTED` (aucun envoi automatique de fonds n'est déclenché par la RPC seule).
- Commandes : taux de succès de `create_public_order` (refus « Trop de commandes » légitimes ?).
- Export des journaux de l'API sur la période antérieure (rétention limitée) : appels `anon` à `rpc/apply_commission_payment`, `apply_shop_subscription`, `apply_shop_activation`, `prepare_shop_activation_payment`, `check_rate_limit`, `enqueue_email`, `read_email_batch`.

## 12. État de dev au 18/10/2026

Dev est le seul projet touché pendant la session de test.

| Élément | État sur dev |
|---|---|
| C2, C3, C7, C8, H2 (hotfix), H11 | en place (déploiement du 12/10) |
| C6 (`20261015120000`), H7 (`…130000`), H2 résiduel (`…150000`), `…160000` | **déjà appliqués**, mais non enregistrés dans `schema_migrations` |
| Ecomfy Pay (C1, C4), H1 | tables et bucket privé en place ; `ecomfy_payment_links` créée le 18/10 (le fichier `02` avait été appliqué avant le renommage) |
| H10 (`20261018120000`) | **appliquée le 18/10** |
| H6 (`20261005160000` + `20261017120000`) | **appliquées le 18/10**, dans une seule transaction |
| `20261018130000` (wallet, `is_founder_or_cofounder`) | **appliquée le 18/10** |
| H5 base (`20261016120000`) | **non applicable** : `delivery_companies` absente |
| Edge Functions | 14 redéployées le 18/10 : `verify-delivery-identity`, `send-corporate-invite`, `send-domain-ready-notification`, `send-subscription-email`, `verify-domain-dns`, `geniuspay-webhook`, `correct-text`, `generate-ad-visual`, `generate-ai-image`, `shop-ai-assistant-chat`, `shop-chatbot`, `showcase-chat`, `translate-ui`, `ecomfy-pay-initiate`. **Les autres fonctions du lot 1 et du lot 2 ne sont pas alignées** : rejouer les boucles des sections 6 et 8.1 avec `$P = "xfpbpxncserliskrbaim"` |
| Secrets absents sur dev | `RESEND_API_KEY` (`send-subscription-email` et `send-domain-ready-notification` plantent au démarrage), `GENIUSPAY_*`, `CRON_SECRET`, `LOVABLE_API_KEY` : paiement en ligne réel, e-mails et réponses IA non testables |
| Données de test présentes | boutique `test-securite-dev` (produit, 8 commandes), profil d'affiliation et wallet de `marchand-test@example.test`, un lien de paiement, un paiement de commission de 300 FCFA, deux comptes jetables |

Nettoyage de dev (relire chaque ligne avant de lancer, les suppressions sont définitives) :

```sql
delete from public.ecomfy_payment_links where shop_id = 'c1083a4b-046f-4cd5-b4ed-9a369ab055b5';
delete from public.commission_payments  where shop_id = 'c1083a4b-046f-4cd5-b4ed-9a369ab055b5';
delete from public.payments             where metadata->>'shop_id' = 'c1083a4b-046f-4cd5-b4ed-9a369ab055b5';
delete from public.shops                where id = 'c1083a4b-046f-4cd5-b4ed-9a369ab055b5';   -- supprime aussi produit et commandes (cascade)
delete from public.user_roles where user_id in (select id from auth.users where email in ('marchand-test@example.test','fondateur-test@example.test'));
delete from auth.users where email in ('marchand-test@example.test','fondateur-test@example.test');
```

## 13. Enregistrer les migrations appliquées à la main (optionnel)

Les migrations passées dans l'éditeur SQL n'apparaissent pas dans `schema_migrations`. Si l'intégration GitHub de Supabase doit un jour être réactivée, les déclarer appliquées **sur le projet concerné** (cette commande agit sur le projet lié, aujourd'hui dev ; ne la lancer sur la production qu'après un `supabase link` volontaire, puis relier dev) :

```powershell
npx supabase@latest migration repair --status applied 20261011120000 20261012120000 20261012130000 20261012140000 20261012150000 20261012160000 20261015120000 20261015130000 20261015150000 20261015160000 20261017120000 20261018120000 20261018130000
```

Ajouter `20260914190000 20260914200000 20261015140000` après la vague 2, et `20261016120000` si H5 a été appliquée.

## 14. Retour arrière

- **Préféré :** restaurer le snapshot pris à la section 0, règle 5.
- **Ciblé** (remet les failles en place, uniquement pour débloquer un flux) : `docs/SECURITY-HOTFIX-2026-10.md` section 7 et `supabase/deploy-dev/99_rollback.sql`.
- **H10 :** pour rouvrir l'insertion directe en urgence (ancien front) : `GRANT INSERT ON public.orders, public.order_items TO anon, authenticated;` puis recréer les politiques d'insertion supprimées par `20261018120000`. À éviter : cela rouvre la faille.
- **Front :** Vercel > Deployments > redéployer la version précédente (« Instant Rollback »). Une migration déjà appliquée (H6, H10) casserait alors l'ancien front pour les commandes et l'affiliation : combiner avec le retour arrière SQL ci-dessus.

## 15. Ce qui reste ouvert après ce déploiement

- **Commission de commande (H10) :** facturée à la création (décision ouverte, voir l'audit).
- **Groupe B de l'annexe F.3 :** `check_and_trigger_billing_threshold`, `enforce_shop_billing_deadlines`, `enforce_shop_payment_state_for`, `process_referral_signup` ; groupe E à relire (`consume_ai_credit`, `record_stock_movement`). **À corriger avant de déployer la facturation par seuil (`20260909100000`, `20261003120000`).**
- **`corporate_invitations`** (`20260906000000`) et `strict_multitenant_privacy` (`20260902140000`) : ouvertes ou non corrigées, **ne pas déployer**.
- **E-mails en dur côté interface** (`FounderRoute.tsx`, `AppSidebar.tsx`, `AssociateSpace.tsx`, `CorporateGovernance.tsx`, `FounderDashboard.tsx`, `FounderTroubleshooting.tsx`, `app-health-monitor/index.ts`).
- **Types TypeScript** (`src/integrations/supabase/types.ts`) périmés : à régénérer après la vague 2 (`npx supabase@latest gen types typescript --project-id $P > src/integrations/supabase/types.ts`, à relire avant de commiter).
- **Non testés en conditions réelles :** webhook GeniusPay signé, concurrence de H7, e-mails (H4) sur une vraie clé Resend, réponses IA (H9), interface livraison (H5), nomination et révocation de fondateur (C7), `verify-payment` avec l'affiliation.
- **M11 :** migrations non reproductibles sur base vierge.
