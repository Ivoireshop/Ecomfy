# Déploiement de `jeanmarc` vers `main` (production), guide complet

**Date :** 25/10/2026 · **Projet prod :** `yfggrceynzcwklbxhgix` · **Dev :** `xfpbpxncserliskrbaim`
**Branche :** `jeanmarc` (contient `origin/main` et `hotfix/abonnement-commission` depuis la fusion `7f61ea9`) · **Base :** `origin/main` = `ae858ff` (PR #3, 19/10/2026).
**Périmètre :** 37 commits, 213 fichiers, **24 migrations**, **24 Edge Functions**, le front, l'outillage (CI, vitest). Tout ce qui est en production aujourd'hui (vagues de sécurité 1 et 2 : C1 à C8, H1 à H11) n'est **pas** redéployé ici.

**Ce guide remplace** `DEPLOIEMENT-COMPLET-2026-10.md` pour ce qui reste à faire, et **chaîne** les guides par fonctionnalité dans un ordre unique. Ces guides gardent les détails, les tests et les retours arrière de chaque sujet : [abonnement](DEPLOIEMENT-ABONNEMENT-2026-10.md), [affiliation](DEPLOIEMENT-AFFILIATION-2026-10.md), [facturation](DEPLOIEMENT-FACTURATION-2026-10.md), [garde de facturation](DEPLOIEMENT-GARDE-FACTURATION-2026-10.md), [boutique restreinte et livraisons](DEPLOIEMENT-BOUTIQUE-RESTREINTE-2026-10.md), [communauté](DEPLOIEMENT-COMMUNAUTE-2026-10.md), [bibliothèque](DEPLOIEMENT-BIBLIOTHEQUE-2026-10.md), [paniers abandonnés](DEPLOIEMENT-PANIERS-ABANDONNES-2026-10.md), [codes promo](DEPLOIEMENT-CODES-PROMO-2026-10.md), [avis](DEPLOIEMENT-AVIS-2026-10.md), [finance](DEPLOIEMENT-FINANCE-2026-10.md), [SEO](DEPLOIEMENT-SEO-2026-10.md), [Ecomfy Pay (ledger)](DEPLOIEMENT-LEDGER-PAY-2026-10.md), [connecteurs](ECOMFY-PAY-CONNECTEURS-2026-10.md), [académie](DEPLOIEMENT-ACADEMIE-2026-10.md), [optimiseur IA](DEPLOIEMENT-OPTIMISEUR-IA-2026-10.md), [CI](DEPLOIEMENT-CI-2026-10.md). **Retour arrière : [`PROCEDURE-ROLLBACK-2026-10.md`](PROCEDURE-ROLLBACK-2026-10.md)**, à lire avant de commencer.

---

## 0. En bref

| Étape | Quoi | Où | Durée |
|---|---|---|---|
| A | Préparer le poste : tests, build, CI GitHub, pull request ouverte (non fusionnée) | poste, GitHub | 30 min |
| B | Garde-fous : désactiver le déploiement automatique des migrations, sauvegarde, capture de la base, tag | Supabase, poste | 15 min |
| C | **Pré-contrôle de la production** (un script en lecture seule) et décisions | éditeur SQL | 20 min |
| D | Secrets et Vault | CLI, éditeur SQL | 10 min |
| E | **Migrations**, une par une, dans l'ordre | éditeur SQL | 1 h 30 |
| F | **Edge Functions**, par groupes | CLI | 30 min |
| G | **Fusion dans `main`** = déploiement du front par Vercel | GitHub, Vercel | 15 min |
| H | Après le front : rattrapage des abonnements, tâche des échéances, planificateur | éditeur SQL | 30 min |
| I | Recette, puis surveillance 48 h | navigateur, journaux | 1 h |

**Ordre de principe : base, puis fonctions, puis front.** Chaque migration est écrite pour que l'**ancien** front (celui de la production aujourd'hui) continue de marcher sur la **nouvelle** base. L'inverse (nouveau front sur ancienne base) casse des écrans : ne jamais fusionner avant d'avoir fini les étapes E et F. Aucune interruption de service n'est prévue, sauf les points signalés « hors heures de pointe ».

## 1. Règles non négociables

1. **Jamais `supabase db push`.** La base réelle diverge des migrations du dépôt. Les migrations s'appliquent **une par une** dans l'éditeur SQL du tableau de bord de la production, en collant le fichier **en entier**.
2. **Désactiver « Deploy to production »** de l'intégration GitHub de Supabase (Project Settings > Integrations > GitHub) **avant de fusionner dans `main`**. `main` contient des migrations qui ne sont **pas** appliquées en production et dont certaines sont dangereuses (`20260902140000_strict_multitenant_privacy`, `20260906000000_corporate_invitations_workflow`, `20260909100000_ecomfy_billing_threshold_system`, `20261003120000_fix_billing_partial_payments_sync`, `20260914190000` et `20260914200000`). Une fusion avec l'intégration active les appliquerait.
3. **Ne jamais `supabase link` vers la production.** Le projet lié du dépôt est dev (`Get-Content supabase\.temp\project-ref` doit afficher `xfpbpxncserliskrbaim`) : `supabase db query --linked` et `supabase migration …` visent **dev**. Pour la production : éditeur SQL du tableau de bord, et `--project-ref yfggrceynzcwklbxhgix` explicite pour les fonctions et les secrets.
4. **Ne pas utiliser** `supabase/deploy-dev/*` en production.
5. **Sous Windows, `--use-api`** pour déployer une Edge Function (sinon le bundling Docker échoue).
6. **Le `main` local est périmé** (48 commits de retard). Toujours comparer à `origin/main`.
7. **Si un contrôle échoue, on s'arrête** : on ne passe pas à l'étape suivante en espérant. Les migrations sont idempotentes, on peut rejouer la même.
8. **Aucun test destructif en production.** Comptes jetables, montants minimaux, nettoyage ensuite.

## 2. Étape A : préparer le poste et GitHub

```powershell
cd C:\dev\Ecomfy
git checkout jeanmarc
git status                                              # propre (les fichiers non suivis de ce guide sont normaux)
git fetch origin
git rev-list --left-right --count origin/main...jeanmarc   # attendu : 0 N (rien à rattraper sur main)
npm ci
npm test                                                # attendu : 98 tests, 9 fichiers (réussi le 25/10/2026)
npm run lint
npm run typecheck                                       # compare à la baseline : aucune erreur NOUVELLE
```

Build avec les variables de **production** (le `.env` du poste pointe sur dev) :

```powershell
$env:VITE_SUPABASE_URL = "https://yfggrceynzcwklbxhgix.supabase.co"
$env:VITE_SUPABASE_PROJECT_ID = "yfggrceynzcwklbxhgix"
$env:VITE_SUPABASE_PUBLISHABLE_KEY = "<clé anon de la production>"
npx vite build                                          # attendu : réussi (1 min 45 le 25/10/2026, 239 entrées PWA)
Remove-Item Env:VITE_SUPABASE_URL, Env:VITE_SUPABASE_PROJECT_ID, Env:VITE_SUPABASE_PUBLISHABLE_KEY
```

1. **Pousser `jeanmarc`** (`git push origin jeanmarc`). Le workflow `.github/workflows/ci.yml` se déclenche sur ce push et **n'a jamais tourné sur GitHub** : ouvrir l'onglet *Actions* et vérifier que les quatre jobs (`lint`, `typecheck`, `test`, `audit`) passent. Un échec ici ne bloque pas la production (la CI ne déploie rien), mais il faut le comprendre avant de fusionner. Après la fusion, la CI ne tourne pas sur `main` (elle est limitée à `jeanmarc` et au lancement manuel) : voir [`DEPLOIEMENT-CI-2026-10.md`](DEPLOIEMENT-CI-2026-10.md) §3.1 pour l'étendre.
2. **Ouvrir la pull request** `jeanmarc` vers `main` sur GitHub. **Ne pas la fusionner** : la fusion est l'étape G.
3. **Vercel.** Variables d'environnement **Production** : `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY` de la production (H11). Ouvrir le dernier journal de build : si l'installation utilise **bun**, elle suit les anciens verrous `bun.lock` / `bun.lockb` et les correctifs de dépendances du lot CI ne s'appliquent pas ; dans ce cas, supprimer ces deux fichiers du dépôt avant la fusion (voir guide CI §2).
4. **Noter le point de retour du front** : Vercel > Deployments > le déploiement « Production » actuel (son commit et son URL). C'est le « Instant Rollback ».

## 3. Étape B : garde-fous

1. **Désactiver « Deploy to production »** (règle 2) et le noter ici : ☐ fait le ________ à ____ h.
2. **Sauvegarde** : Database > Backups > point de restauration (vérifier si le PITR est actif ; sinon la granularité est la sauvegarde quotidienne). Voir [`PROCEDURE-ROLLBACK-2026-10.md`](PROCEDURE-ROLLBACK-2026-10.md) §2.1 pour l'export du schéma en plus.
3. **Capture de la logique de la base** : coller [`supabase/maintenance/capture_logic_before_deploy.sql`](../supabase/maintenance/capture_logic_before_deploy.sql) dans l'éditeur SQL de la **production**, exporter en CSV **hors du dépôt** (`capture-prod-AAAAMMJJ-HHMM.csv`). Lecture seule. C'est le seul état d'avant fiable : presque toutes les migrations sont des `CREATE OR REPLACE FUNCTION` sans « down ».
4. **Tag local** : `git tag pre-deploy-20261025` (sur le commit qui sera déployé) et noter la version affichée de chaque fonction qui sera touchée (Edge Functions > version).
5. **Désigner qui décide d'annuler** et le seuil (par exemple : plus de 2 paiements en échec sur 10 minutes, ou une boutique verrouillée à tort).

## 4. Étape C : pré-contrôle de la production

Coller [`supabase/maintenance/precontrole_deploiement_jeanmarc.sql`](../supabase/maintenance/precontrole_deploiement_jeanmarc.sql) dans l'éditeur SQL de la **production**. **Lecture seule**, trois résultats :

1. **Prérequis** par migration (`ok = true` partout où la migration doit s'appliquer) ;
2. **Déjà appliqué ?** : empreinte de chaque migration (utile si une partie est passée à la main) ;
3. **Environnement** : `pg_cron`, Vault et ses trois secrets, comptes sans profil, boutiques qui seront verrouillées par la tâche des échéances, abonnements déjà échus.

**L'éditeur n'affiche que le résultat de la dernière requête** : exécuter les sections 1, 2 et 3 **séparément** (sélectionner le texte d'une section, puis « Run selected »).

Le script a été exécuté sans erreur sur dev ; **ses résultats en production ne sont pas connus** : les documents se contredisent sur l'état d'Ecomfy Pay et de l'affiliation en production (`RAPPORT-EXPLOITATION-C1-C8` parle d'une « vague 2 déployée » le 19/10 ; `DEPLOIEMENT-LEDGER-PAY` affirme le 22/10 que les tables du portefeuille n'existent pas). **C'est ce script qui tranche.**

### 4.1 Décisions selon le résultat

| Constat | Décision |
|---|---|
| **Ecomfy Pay absent** (`wallets`, `wallet_ledger`, `ecomfy_payments`, `settlements`, `withdrawal_requests` : `ok = false`) — cas attendu d'après les guides | **Sauter le bloc M17** (ledger, références, confirmation transactionnelle) et le **groupe de fonctions F5**. Le front fonctionne quand même (l'écran affiche l'absence de table, comme aujourd'hui). La vague 2 d'Ecomfy Pay est un projet distinct : [`DEPLOIEMENT-COMPLET-2026-10.md`](DEPLOIEMENT-COMPLET-2026-10.md) §9, [`KYC-REVUE-ET-DEPLOIEMENT-C4.md`](KYC-REVUE-ET-DEPLOIEMENT-C4.md), puis [`DEPLOIEMENT-LEDGER-PAY-2026-10.md`](DEPLOIEMENT-LEDGER-PAY-2026-10.md). **Ne pas ouvrir les retraits ici.** |
| **Ecomfy Pay présent** | Faire M17 et F5, puis H3. Lire d'abord le prérequis de `DEPLOIEMENT-LEDGER-PAY-2026-10.md` §10.1. |
| `affiliates` absente ou `get_or_create_my_affiliate` absente | L'affiliation (H6) n'est pas en place : **cas B** de M2 (trois migrations dans une transaction). Sinon cas A (la seule `20261020120000`). |
| Comptes sans profil ≠ 0 | **S'arrêter pour M2** et traiter ce point d'abord (les nouveaux inscrits n'auraient pas de profil). |
| Tables de livraison ou vue `delivery_providers_public` absentes | **Sauter M11** (boutique restreinte côté serveur et livraison). Une partie de la protection de la boutique restreinte reste alors non déployée : à noter dans les points ouverts. |
| `shop_invoices` absente (cas attendu) | Facturation par seuil non déployée : **ne jamais appliquer `20261023150000`**, et traiter `20261022150000` comme dit en M17. |
| `promo_codes` : remises hors bornes ou doublons de casse | Corriger les données **avant** M9, sinon sa contrainte échoue. |
| Secrets Vault < 3 | Section 5 avant M15 (finance) et avant toute tâche qui appelle une fonction. |
| `pg_cron` absent | Les tâches planifiées de M1, M15 et H2 sont à créer à la main (Integrations > Cron). |
| Tables `shop_seo_*` déjà présentes | M14 : n'appliquer que `20261021120000` (autonome). Sinon les deux fichiers. |
| Une migration est déjà « appliquée » (section 2 du script) | Inutile de la rejouer, sauf si le guide du sujet demande une vérification. |

### 4.2 Résultats relevés en production le 25/10/2026 et décisions

| Constat (script de pré-contrôle) | Décision |
|---|---|
| **Ecomfy Pay présent** : `wallets`, `wallet_ledger`, `ecomfy_payments`, `settlements`, `withdrawal_requests`, `request_wallet_withdrawal_atomic` et `credit_merchant_wallet_pending` existent ; le ledger (`20261022140000`) et la confirmation (`20261023100000`) ne sont **pas** appliqués | **M17 et F5 s'appliquent.** Avant : relever l'état d'Ecomfy Pay avec `precontrole_complement_jeanmarc.sql` (lignes dans chaque table, paiements par statut, retraits ouverts ou non, dossiers KYC, paiements encaissés sans règlement) |
| `shop_invoices` absente | Facturation par seuil non déployée : **pas de `20261023150000`** ; `20261022150000` : **seulement la partie 3** (retrait), commande PowerShell du guide ledger §9.1 |
| `shop_seo_*` absentes | **M14 : les deux fichiers**, `20260902120000` puis `20261021120000` |
| Codes promo : une des 12 fonctions manque (la requête complémentaire dit laquelle ; très probablement `is_shop_owner_or_collaborator`, que la migration codes promo utilise dans ses politiques et que seule `20261021120000` crée) | **M14 passe avant M9.** Sans cela M9 échoue à la création des politiques |
| `affiliates`, `get_or_create_my_affiliate`, `mark_affiliate_payout_paid` présents, `20261020120000` non appliquée | **M2 cas A** (la seule `20261020120000`) |
| Tables de livraison et vue `delivery_providers_public` présentes | **M11 s'applique** |
| `is_subscribed` absente, `subscriptions.plan` absente, prérequis M1 présents, H7 en place | **M1 s'applique** (cas décrit par le guide abonnement) |
| Comptes sans profil : 0 · `pg_cron` et Vault présents | M2 et les tâches planifiées sont possibles |
| Secrets Vault : `cron_secret` et `supabase_project_url` présents, **`email_queue_service_role_key` absent** | M15 (finance) n'a besoin que des deux premiers : **rien à créer**. Mais l'absence du troisième, et celle d'un job `process-email-queue` parmi les tâches `pg_cron` (seulement `app-health-monitor` et `expire-stale-pending-payments`), signifie que **la file d'e-mails (`enqueue_email`, utilisée par `send-transactional-email`) n'a pas de travailleur en production**. À vérifier avant de compter sur le résumé hebdomadaire et les e-mails transactionnels (§10, test 19 ; §14). Le guide ne crée pas ce travailleur |
| **1 boutique en retard de paiement : `cd3c5d2b-…` « CACAO+ », `payment_pending`, 16 300 FCFA dus, échéance dépassée le 24/10** | C'est **la boutique du paiement d'abonnement du 11/09** que le rattrapage H1 doit régulariser (mois complet, solde effacé) : **faire H1 avant H2**, la boutique sera alors soldée et ne sera pas verrouillée. Si H1 n'est pas fait, H2 la verrouille dans les 5 minutes |
| **Ecomfy Pay présent mais vide** : aucun portefeuille, registre, règlement, retrait, dossier KYC ni lien de paiement ; 9 `ecomfy_payments` tous `PENDING` ; `withdrawals_enabled = false` ; 0 encaissé sans règlement, 0 commande `PAID` | M17 s'applique **sans risque pour de l'argent en mouvement**. Regarder une fois les 9 paiements `PENDING` (date, montant, `order_id`) : un webhook tardif pourrait encore en confirmer avec le nouveau code |
| Tâches `pg_cron` : seulement `app-health-monitor` et `expire-stale-pending-payments` | **Personne n'appelle `ecomfy-pay-settlement`** : H3 consiste à créer sa planification (Vault `cron_secret` et `supabase_project_url` sont présents, donc `invoke_edge_function` suffit) |
| Abonnements déjà échus : 0 | Rien à ignorer |

**Ordre d'exécution retenu pour l'étape E :** M1, M2, M3, M4, M5, M6, M7, M8, **M14**, M9, M10, M11, M12, M13, M15, M16, M17. (Les numéros restent ceux de la section 6.)

> **La CLI était liée à la production, pas à dev.** `supabase/.temp/project-ref` valait `yfggrceynzcwklbxhgix` (modifié à 14 h 29) : après une commande `supabase link` vers la production, `supabase db query --linked` vise la production. Deux requêtes de **lecture seule** ont donc été jouées sur la production par erreur le 25/10/2026 (aucune écriture) ; le constat « la fonction, les tables SEO et les politiques de codes promo sont absentes » décrit la production, pas dev. **Avant toute commande `--linked`, relire `Get-Content supabase\.temp\project-ref`. Pour revenir sur dev : `npx supabase@latest link --project-ref xfpbpxncserliskrbaim`** (laisser vide le mot de passe de la base si demandé).

Relever aussi, pour mémoire (section 3 du script) : le nombre de boutiques en retard de paiement (elles seront verrouillées au premier passage de la tâche H2) et le nombre d'abonnements déjà échus (ignorés par conception).

## 5. Étape D : secrets et Vault

```powershell
$P = "yfggrceynzcwklbxhgix"
npx supabase@latest login
npx supabase@latest secrets list --project-ref $P        # les valeurs sont hachées
```

| Secret | Utilisé par | Statut |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` | toutes | automatiques |
| `APP_URL`, `RESEND_API_KEY`, `LOVABLE_API_KEY`, `CRON_SECRET`, `EMAIL_MODE=live` | e-mails, tâches planifiées | déjà définis (déploiements précédents) : **vérifier** |
| `GENIUSPAY_API_KEY`, `GENIUSPAY_API_SECRET`, `GENIUSPAY_WEBHOOK_SECRET` | `process-payment`, `geniuspay-webhook`, `verify-payment`, `ecomfy-pay-*` | **doivent exister** : sans eux le webhook répond 500/503 et GeniusPay réessaie |
| `OPENROUTER_API_KEY` | `product-ai-optimizer`, `finance-advisor`, `generate-*` | vérifier qu'il existe **et** que le compte OpenRouter a du solde |
| `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | `gsc-oauth-flow`, `gsc-analytics` | **nouveaux**, nécessaires seulement pour connecter Google Search Console (voir M14) |
| `GOOGLE_OAUTH_REDIRECT_URI` | idem | optionnel, défaut `https://ecomfy.cloud/seo` |
| `GSC_STATE_SECRET` | idem | optionnel (sinon dérivé du secret client) |
| `ECOMFY_PAY_PROVIDER` | `ecomfy-pay-*` | optionnel, défaut GeniusPay |

Vault (éditeur SQL) : les tâches planifiées appellent les fonctions avec `public.invoke_edge_function`, qui lit ces secrets :

```sql
select name, created_at from vault.secrets where name in ('supabase_project_url','cron_secret','email_queue_service_role_key');
-- attendu : 3 lignes. 'cron_secret' doit être IDENTIQUE au secret de fonction CRON_SECRET, sinon les tâches reçoivent 401.
-- Pour corriger : select vault.update_secret((select id from vault.secrets where name='cron_secret'), '<VALEUR EXACTE>');
```

## 6. Étape E : migrations

**Une par une**, éditeur SQL de la production. **Ordre d'exécution : M1 à M8, puis M14, puis M9 à M13, M15, M16, M17** (M14 avant M9, voir 4.2) ; les blocs ci-dessous sont numérotés par sujet, pas par ordre d'exécution. Toutes sont **idempotentes** : en cas d'erreur, corriger la cause et relancer le même fichier. Après chacune, jouer ses vérifications avant de passer à la suivante. `Applicabilité` renvoie à la section 4.1.

> Les noms de fichier sont dans `supabase/migrations/`. Deux fichiers portent la même version `20261023100000` (`ecomfy_pay_confirm_transaction` et `product_seo_fields`) : sans conséquence tant qu'on n'utilise pas `db push` ni `migration repair` (section 13).

### M1. Abonnement payé non appliqué et fin d'abonnement — `20261019120000_fix_subscription_activation_and_expiry.sql`

À appliquer **avant** M3. Guide : [`DEPLOIEMENT-ABONNEMENT-2026-10.md`](DEPLOIEMENT-ABONNEMENT-2026-10.md).

- **Corrige :** `apply_shop_subscription` refusait `pro_monthly`, puis plantait sur `shops.is_subscribed` (colonne absente en production) depuis le 15/10. Le paiement était encaissé et rien n'était activé. Ajoute la règle unique `subscription_active_until > now()`, un délai de grâce de 3 jours, la fermeture d'une boutique non renouvelée et la tâche `enforce-subscription-expiry` (toutes les 30 minutes).
- **La version de `jeanmarc` est la corrigée** (elle n'écrit plus la colonne `subscriptions.plan`, inexistante). Contrôle avant de coller : `Select-String -Path supabase\migrations\20261019120000_fix_subscription_activation_and_expiry.sql -Pattern "[ ,]plan = v_normalized_plan"` ne doit **rien** renvoyer (les écritures `subscription_plan = …` sur `shops` sont normales et ne correspondent pas au motif).
- **Effet immédiat :** à partir de cette migration, les anciennes fonctions de paiement appliquent enfin les abonnements. Les boutiques à abonnement déjà échu avant l'application ne sont **jamais** fermées rétroactivement.

```sql
select count(*) as is_subscribed_existe from information_schema.columns
 where table_schema='public' and table_name='shops' and column_name='is_subscribed';                     -- 1
select prosrc like '%subscription_grace_interval%' as sync_a_jour from pg_proc
 where proname='sync_shop_order_stats' and pronamespace='public'::regnamespace;                          -- true
select (select pg_get_functiondef(oid) from pg_proc where proname='apply_shop_subscription' and pronamespace='public'::regnamespace) !~ '\mplan = v_normalized_plan' as ne_touche_pas_subscriptions_plan; -- true
select jobname, schedule, active from cron.job where jobname='enforce-subscription-expiry';              -- 1 ligne, */30 * * * *
select array_to_string(proacl, ',') from pg_proc where proname='apply_shop_subscription';                -- service_role seul
```

### M2. Affiliation — `20261020120000_affiliate_payout_and_legacy_referral_hardening.sql`

Guide : [`DEPLOIEMENT-AFFILIATION-2026-10.md`](DEPLOIEMENT-AFFILIATION-2026-10.md) §4.

- **Cas A (H6 déjà en place) :** coller la seule `20261020120000`, entre `begin;` et `commit;`.
- **Cas B (H6 absente) :** produire un fichier unique des trois migrations et le coller entre `begin;` et `commit;` (jamais la première seule : elle crée des politiques d'insertion ouvertes) :

```powershell
Get-Content supabase\migrations\20261005160000_ecomfy_affiliate_system.sql,
            supabase\migrations\20261017120000_h6_affiliate_rls_rpc_hardening.sql,
            supabase\migrations\20261020120000_affiliate_payout_and_legacy_referral_hardening.sql |
  Set-Content -Encoding utf8 $env:TEMP\affiliate_prod.sql
```
- **Corrige :** le versement manuel doit égaler la somme exacte des commissions visées (verrouillées pendant l'opération) ; l'ancien parrainage n'accepte que l'appelant comme filleul.
- **Cas B uniquement :** enchaîner avec le front (étape G) sans délai : l'ancien front appelle l'insertion directe du profil d'affilié.

```sql
select p.proname, has_function_privilege('anon',p.oid,'execute') anon, has_function_privilege('authenticated',p.oid,'execute') auth, has_function_privilege('service_role',p.oid,'execute') svc
from pg_proc p where pronamespace='public'::regnamespace
  and proname in ('record_affiliate_referral','process_affiliate_commission_for_payment','reverse_affiliate_commission_for_payment','get_or_create_affiliate','get_or_create_my_affiliate','mark_affiliate_payout_paid','process_referral_signup') order by 1;
-- process_affiliate_commission_for_payment, reverse_affiliate_commission_for_payment, get_or_create_affiliate : service_role seul ;
-- record_affiliate_referral, get_or_create_my_affiliate, mark_affiliate_payout_paid, process_referral_signup : authenticated + service_role, jamais anon
select tablename, policyname, cmd from pg_policies where tablename in ('affiliates','affiliate_referrals') order by 1,2;   -- aucune politique INSERT
```

### M3. Règlement de commission : paiement complet obligatoire en verrouillage — `20261023120000_billing_commission_payment_lock_and_invoices.sql`

Guide : [`DEPLOIEMENT-FACTURATION-2026-10.md`](DEPLOIEMENT-FACTURATION-2026-10.md). **Après M1.**

- **Corrige :** un paiement partiel (50 % du seuil ou plus) déverrouillait une boutique verrouillée ; désormais seul le règlement intégral lève la restriction (l'argent reçu est toujours enregistré). Reprend le corps de H7 (verrou par référence, droits `service_role`).
- **Ne jamais rejouer ensuite** `20261003120000` ni `20261015130000` : elles réécriraient l'ancienne version.

```sql
select pg_get_functiondef('public.apply_commission_payment(uuid,numeric,text,uuid,text,text)'::regprocedure) like '%pg_advisory_xact_lock%' as h7_conserve;   -- true
select array_to_string(proacl, ',') from pg_proc where proname='apply_commission_payment';                                                                 -- service_role seul
```

### M4. Temps réel du statut de paiement — `20261023130000_billing_realtime_publication.sql`

Ajoute `shops` à la publication `supabase_realtime` (le marchand voit sa boutique se déverrouiller sans recharger). Vérification : `select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename='shops';` → 1 ligne.

### M5. Avis produits — `20261023160000_product_reviews_hardening.sql`

Guide : [`DEPLOIEMENT-AVIS-2026-10.md`](DEPLOIEMENT-AVIS-2026-10.md). **Irréversible sur les données : supprime les avis orphelins** (produit ou boutique disparus). Lire d'abord :

```sql
select count(*) filter (where product_id is not null and not exists (select 1 from products p where p.id = r.product_id)) orphelins_produit,
       count(*) filter (where not exists (select 1 from shops s where s.id = r.shop_id)) orphelins_boutique,
       count(*) filter (where status not in ('pending','approved','rejected')) statuts_inattendus,
       count(*) filter (where status = 'approved' and created_at > now() - interval '30 days') approuves_30j
  from product_reviews r;
```

- **Corrige :** un visiteur pouvait s'auto-approuver un avis ; la suppression d'un produit était silencieusement annulée par la base (déclencheur `BEFORE DELETE` qui renvoyait `NEW`) : **sans cette migration, « Supprimer » un produit ne fonctionne pas**, et c'est elle qui fait partir les avis avec le produit.
- Vérification : `select proacl from pg_proc where proname='get_product_review_stats';` (exécutable par `anon`) ; trigger `trg_product_reviews_guard` présent.

### M6. Champs SEO des produits — `20261023100000_product_seo_fields.sql`

Ajoute `products.seo_title` et `products.seo_description`. Sans elle, seuls ces deux champs ne s'enregistrent pas (erreur claire). Vérification : les deux colonnes existent.

### M7. Preuve sociale réelle — `20261024100000_social_proof_real_orders.sql`

Remplace `get_shop_social_proof_orders` (même signature) : fenêtre de 7 jours, commandes annulées ou retournées exclues. **Effet visible :** les boutiques qui avaient activé la preuve sociale et ont peu de commandes récentes n'affichent plus de notification (voulu : plus de fausses ventes). Prévenir les marchands concernés si besoin.

### M8. Meilleurs vendeurs — `20261020130000_top_sellers_skip_inline_avatars.sql`

`get_top_sellers` ne renvoie plus les avatars stockés en base64 (jusqu'à 3 Mo, téléchargés à chaque affichage de l'accueil). Signature inchangée ; le front retombe sur le logo de la boutique puis les initiales. Appliquée sur dev seulement jusqu'ici.

### M9. Codes promo de boutique — `20261022130000_shop_promo_codes.sql`

Guide : [`DEPLOIEMENT-CODES-PROMO-2026-10.md`](DEPLOIEMENT-CODES-PROMO-2026-10.md). **À appliquer après M14** : ses politiques appellent `is_shop_owner_or_collaborator`, créée par `20261021120000` (voir 4.2). **Hors heures de pointe** : elle remplace `create_public_order` (nouvelle signature avec `p_promo_code` facultatif, ancienne supprimée : l'ancien front reste compatible car le paramètre est facultatif), pose des contraintes sur `orders` et prend brièvement un verrou. Prérequis : 12 fonctions (section 1 du script de pré-contrôle) et `promo_codes` propre (remises entre 1 et 100, pas de doublon de casse).

```sql
select pg_get_function_identity_arguments(oid) from pg_proc where proname='create_public_order' and pronamespace='public'::regnamespace;   -- 1 ligne, se termine par p_promo_code text
select proname, proacl::text from pg_proc where proname in ('evaluate_shop_promo','recompute_order_totals_for','increment_promo_usage') and pronamespace='public'::regnamespace;  -- service_role seul
select policyname, permissive from pg_policies where tablename='promo_codes';
```

Test sans compte (clé anon de production) : un appel à `create_public_order` sans code promo doit toujours créer une commande ; vérifier sur une boutique de test avec la recette (section 10).

### M10. Paniers abandonnés — `20261022120000_abandoned_carts_fixes.sql`

Guide : [`DEPLOIEMENT-PANIERS-ABANDONNES-2026-10.md`](DEPLOIEMENT-PANIERS-ABANDONNES-2026-10.md). Ajoute `customer_country`, `discard_abandoned_cart`, le déclencheur `trg_orders_mark_abandoned_carts_converted` (verrou bref sur `orders` : hors heures de pointe), la publication temps réel. Vérifications : colonne, 3 fonctions, déclencheur, `relreplident = 'f'`. Test fonctionnel : `upsert_abandoned_cart` avec la clé anon (voir §2.3 du guide) renvoie un UUID ; supprimer ensuite la ligne de vérification.

### M11. Boutique restreinte côté serveur et livraisons — trois fichiers, dans cet ordre

*Applicabilité : tables de livraison présentes (section 4.1).* Guide : [`DEPLOIEMENT-BOUTIQUE-RESTREINTE-2026-10.md`](DEPLOIEMENT-BOUTIQUE-RESTREINTE-2026-10.md) §8.

1. `20261021150000_restricted_shop_orders_server_masking.sql`
2. `20261022100000_delivery_rls_recursion_and_push_guard.sql`
3. `20261022110000_delivery_driver_contacts.sql`

- **Corrige :** une boutique restreinte (impayée) lisait encore ses clients en direct ; la récursion de politique RLS (« infinite recursion detected in policy », console d'une boutique) ; l'envoi d'une commande déjà expédiée à un livreur ; les noms et numéros des livreurs.
- **À prévenir :** les boutiques « restreintes mais non suspendues » ne liront plus leurs clients (voulu). Requête de repérage dans le guide §8.1.
- Pendant le remplacement des politiques, une courte fenêtre sans politique de lecture est possible : hors heures de pointe.

```sql
select policyname, qual like '%is_shop_restricted%' as utilise_fonction from pg_policies where schemaname='public' and tablename='orders' and cmd='SELECT' order by 1;   -- propriétaire et collaborateurs : true
select proname, proacl::text from pg_proc where proname in ('is_shop_restricted','shop_owner_can_see_delivery_member','get_delivery_driver_contacts','push_order_to_delivery_provider','get_shop_orders_secure') and pronamespace='public'::regnamespace;   -- ni « anon » ni « =X/ »
```
Contrôle externe : `POST /rest/v1/rpc/get_delivery_driver_contacts` avec la clé anon doit renvoyer 401 / `42501`.

### M12. Communauté — `20261021130000_community_chat_hardening.sql`

Guide : [`DEPLOIEMENT-COMMUNAUTE-2026-10.md`](DEPLOIEMENT-COMMUNAUTE-2026-10.md). **Coller entre `BEGIN;` et `COMMIT;`.** L'ajout de la colonne `kind` **réécrit `community_messages` et la verrouille en écriture** pendant l'opération (instantané pour 86 lignes sur dev ; vérifier `pg_size_pretty(pg_total_relation_size('public.community_messages'))` et attendre une heure creuse au-delà de 500 Mo). Aucune ligne n'est modifiée ni supprimée.

- **Corrige :** le salon était lisible par `anon` (`msg_select_public`) et écrivable par tout compte ; les blobs ConnectUs s'affichaient comme du JSON.
- **Entre la migration et le front,** l'ancien salon fonctionne mais peut afficher les blobs ConnectUs et « Membre » à la place des noms de fondateur.

```sql
select policyname, cmd, roles from pg_policies where tablename='community_messages' order by 1;   -- msg_delete_own_or_founder, msg_insert_own, msg_select_all_auth, msg_update_founder
select grantee, privilege_type from information_schema.role_table_grants where table_name like 'community_%' and grantee='anon';   -- aucune ligne
```
Contrôle externe sans compte : `GET /rest/v1/community_messages?select=id&limit=1` avec la clé anon → 401 / `42501`.

### M13. Bibliothèque : édition d'image — `20261021140000_library_generated_images_update_policy.sql`

Guide : [`DEPLOIEMENT-BIBLIOTHEQUE-2026-10.md`](DEPLOIEMENT-BIBLIOTHEQUE-2026-10.md). Ajoute la politique `Users can update their own images` (`UPDATE`, `auth.uid() = user_id` en lecture et en écriture). **Vérifier aussi les politiques de stockage `generated-content`** (guide §3.1 et §3.3) : l'éditeur envoie l'image avec `upsert: true` et exige quatre politiques sur `storage.objects`, absentes de dev ; si elles manquent en production, l'éditeur y échouera de la même façon, et il faut les créer (§3.3 du guide).

### M14. SEO Intelligence — `20260902120000_ecomfy_seo_intelligence.sql` (corrigée) puis `20261021120000_seo_intelligence_protect_tokens.sql`

Guide : [`DEPLOIEMENT-SEO-2026-10.md`](DEPLOIEMENT-SEO-2026-10.md). Si les tables `shop_seo_*` sont absentes : les deux fichiers dans cet ordre. Si elles existent : la seule `20261021120000` (autonome). **Ne jamais appliquer `20260902140000_strict_multitenant_privacy.sql`** (politiques sur `profiles.role` / `is_admin`, colonnes inexistantes, adresse e-mail codée en dur).

- **Corrige :** un script injecté (XSS) pouvait lire les jetons Google OAuth d'un marchand par l'API REST ; les jetons deviennent illisibles depuis le navigateur.
- La **connexion à Google Search Console** n'est utilisable qu'avec les secrets `GOOGLE_OAUTH_*` (section 5), l'API Search Console activée dans Google Cloud et `https://ecomfy.cloud/seo` ajoutée aux URI de redirection autorisées. Sans eux, le bouton « Connecter » échoue proprement ; le reste du module (audit, éditeur de balises, correctifs) fonctionne. **Le vrai aller-retour OAuth avec Google n'a jamais été testé.**

```sql
select has_column_privilege('authenticated','public.shop_seo_connections','google_refresh_token','SELECT') as jeton_lisible,
       has_column_privilege('authenticated','public.shop_seo_connections','gsc_connected','SELECT') as statut_lisible;   -- false, true
```

### M15. Résumé hebdomadaire de finance — `20261023110000_finance_weekly_summary_cron.sql`

Guide : [`DEPLOIEMENT-FINANCE-2026-10.md`](DEPLOIEMENT-FINANCE-2026-10.md) §3. Planifie `send-weekly-finance-summary` le lundi à 8 h (UTC) via `invoke_edge_function` (migration `20261011120000`, déjà en production) et Vault. **Sans les secrets Vault `supabase_project_url` et `cron_secret`, le job est planifié mais ses appels sont ignorés ou refusés en 401.** Vérification : `select jobname, schedule from cron.job where jobname='weekly-finance-summary';`. Avant de la laisser tourner : les fonctions F3 doivent être déployées (sinon le premier lundi envoie l'ancien gabarit).

### M16. Garde des colonnes de facturation de `shops` — `20261025100000_shops_billing_columns_guard.sql`

Guide : [`DEPLOIEMENT-GARDE-FACTURATION-2026-10.md`](DEPLOIEMENT-GARDE-FACTURATION-2026-10.md). Un marchand pouvait réécrire sa dette de commission, son taux, son statut de verrouillage, son abonnement ou l'activation de sa boutique par l'API REST (et créer une boutique déjà « abonnée »). Le déclencheur `trg_guard_shop_billing_columns` refuse ces écritures (`42501 shop_billing_columns_protected`) aux rôles `authenticated` et `anon` ; fonctions serveur, `service_role` et fondateurs restent autorisés.

- **Contre-épreuve recommandée avant** (dans une transaction annulée, avec une boutique jetable) : `UPDATE shops SET commission_balance_due = 0` sous le rôle `authenticated` doit réussir avant la migration et échouer en `42501` après. **Ne pas rejouer `supabase/tests/rls_money_flows.sql` en production** (il suppose des tables absentes) ; ne jouer que le bloc « shops » après relecture.
- Après : `select tgname from pg_trigger where tgrelid='public.shops'::regclass and tgname='trg_guard_shop_billing_columns';` → 1 ligne ; **modifier le nom d'une boutique avec un compte marchand doit continuer à marcher** (éditeur de boutique, réglages, sélecteur de domaine).
- **Entretien :** toute nouvelle colonne de facturation ajoutée à `shops` doit être ajoutée à `v_defaults` dans la fonction du garde.

### M17. Ecomfy Pay : ledger, références, confirmation transactionnelle — *conditionnel*

*Applicabilité : Ecomfy Pay présent (section 4.1), vague 2 déjà passée.* Guide : [`DEPLOIEMENT-LEDGER-PAY-2026-10.md`](DEPLOIEMENT-LEDGER-PAY-2026-10.md). Dans l'ordre :

1. `20261022140000_ecomfy_pay_ledger_schema.sql` (étend `wallets`, `wallet_ledger`, `withdrawal_requests`, `settlements` ; l'ancien front et les anciennes fonctions restent compatibles) ;
2. `20261022150000_references_non_devinables.sql` (audit M4) : sans `shop_invoices`, **n'appliquer que la partie « 3. Demande de retrait »** (à partir du commentaire `-- 3.` ; commande PowerShell dans le guide §9.1) ; avec le système de facturation, le fichier entier ;
3. `20261023100000_ecomfy_pay_confirm_transaction.sql` (audit M6 : paiement, commande et crédit en une transaction rejouable).

Pour M17-3, repérer **avant** qui appelle `ecomfy-pay-settlement` (voir H3) et prendre les mesures du guide §10.1. **Ne pas lancer** `supabase/tests/ecomfy_pay_confirm.sql` en production.

### Ne pas appliquer

- `20261023150000_billing_threshold_system_fixes.sql` : corrige la facturation par seuil (`shop_invoices`), non déployée. Sans objet tant qu'elle ne l'est pas ; ordre prévu le jour venu : `20260909100000`, puis `20261022150000` si besoin, puis `20261023150000` (voir facturation §4).
- Les migrations listées à la règle 2.

### Contrôle global après l'étape E

Relancer le script de pré-contrôle : la section 2 doit montrer `true` pour toutes les migrations appliquées. Compléter par une lecture des journaux Postgres : aucune erreur `42501` ou `permission denied` inattendue.

## 7. Étape F : Edge Functions

**Après les migrations correspondantes.** Les 24 fonctions sont celles dont le code, ou un fichier `_shared` importé, a changé depuis `origin/main`. Chaque déploiement prend une dizaine de secondes ; relancer seulement celles qui échouent.

```powershell
$P = "yfggrceynzcwklbxhgix"
git rev-parse HEAD        # doit être le commit qui sera fusionné
function Deploy($names) {
  foreach ($f in $names) {
    Write-Host "### $f"
    npx supabase@latest functions deploy $f --project-ref $P --use-api
    if ($LASTEXITCODE -ne 0) { Write-Host "ECHEC : $f" -ForegroundColor Red }
  }
}
```

| Groupe | Fonctions | À déployer après | Notes |
|---|---|---|---|
| **F1** indépendantes | `generate-certificate`, `manage-student-access`, `generate-ai-image`, `generate-video`, `product-ai-optimizer`, `dynamic-sitemap`, `seo-auto-index` | rien | `generate-certificate` est **bloquante** pour l'académie (sans elle aucun certificat) ; `generate-ai-image` n'enregistre plus en base une image absente du stockage ; `generate-video` passe en `failed` si le téléchargement final échoue ; `product-ai-optimizer` : statistiques réelles, débit après réponse, `max_tokens` |
| **F2** paiements | `process-payment`, `geniuspay-webhook`, `verify-payment`, `reconcile-pending-payments` | M1, M2 (affiliation), M3 | Le résultat de `apply_shop_subscription` est contrôlé : en cas d'échec le webhook répond 500 (GeniusPay réessaie) et `verify-payment` répond `subscription_not_applied` ; l'abonnement est appliqué avant la réservation du paiement (idempotent par référence) ; la commission d'affiliation est attribuée dans tous les cas, y compris « déjà appliqué » ; un règlement partiel est refusé sur une boutique verrouillée, avec exception pour le solde final inférieur au minimum |
| **F3** finance | `send-weekly-finance-summary`, `sync-ad-spend`, `finance-advisor`, `send-transactional-email` | M15 | `send-transactional-email` embarque le gabarit `finance-weekly-summary` (champ `warning`, libellés) : sans son redéploiement le courriel garde l'ancien gabarit |
| **F4** SEO | `gsc-oauth-flow`, `gsc-analytics` | M14, secrets Google (section 5) | OAuth côté serveur, `state` signé, jetons jamais renvoyés au navigateur |
| **F5** Ecomfy Pay *(conditionnel)* | `ecomfy-pay-webhook`, `ecomfy-pay-settlement`, `ecomfy-pay-initiate`, `ecomfy-pay-withdraw` | M17, secrets GeniusPay | Dans cet ordre, **webhook après la migration M17-3** (le nouveau webhook répond 500 tant que `confirm_ecomfy_payment` n'existe pas). `ecomfy-pay-settlement` exige désormais la clé de service ou `x-cron-secret` : voir H3 |
| **F6** facultatives | `generate-product-sheet`, `generate-shop-content`, `generate-feature-image` | rien | Seule différence : l'en-tête OpenRouter devient « Ecomfy » au lieu de « VisuelPro ». Aucun effet fonctionnel ; peut attendre |

```powershell
Deploy "generate-certificate","manage-student-access","generate-ai-image","generate-video","product-ai-optimizer","dynamic-sitemap","seo-auto-index"   # F1
Deploy "process-payment","geniuspay-webhook","verify-payment","reconcile-pending-payments"                                                                # F2
Deploy "send-weekly-finance-summary","sync-ad-spend","finance-advisor","send-transactional-email"                                                          # F3
Deploy "gsc-oauth-flow","gsc-analytics"                                                                                                                      # F4
# F5 (si Ecomfy Pay est en production) : Deploy "ecomfy-pay-webhook","ecomfy-pay-settlement","ecomfy-pay-initiate","ecomfy-pay-withdraw"
# F6 (facultatif) : Deploy "generate-product-sheet","generate-shop-content","generate-feature-image"
```

Contrôle sans JWT (attendu : 401 pour chacune ; remplacer l'URL et la clé par celles de la **production**, le `.env` du poste pointe sur dev) :

```powershell
$U = "https://yfggrceynzcwklbxhgix.supabase.co"; $K = "<clé anon de la production>"
foreach ($f in "process-payment","ecomfy-pay-withdraw","ecomfy-pay-settlement","ecomfy-pay-webhook","gsc-oauth-flow","generate-certificate","manage-student-access") {
  try { Invoke-WebRequest -Method Post -Uri "$U/functions/v1/$f" -Headers @{ apikey = $K } -ContentType "application/json" -Body "{}" -UseBasicParsing | Out-Null; "$f -> 200" }
  catch { "$f -> $($_.Exception.Response.StatusCode.value__)" }
}
```

Une fonction absente du déploiement répond 404 ; un 200 sur `ecomfy-pay-settlement` ou `ecomfy-pay-withdraw` sans autorisation est anormal : **annuler** (redéployer la version précédente).

## 8. Étape G : fusion dans `main` et front

1. **Dernière vérification :** « Deploy to production » de l'intégration GitHub de Supabase est **désactivé** (étape B), les étapes E et F sont terminées et leurs contrôles sont bons, la sauvegarde est prise.
2. Fusionner la pull request (la fusion est possible en avance rapide : `origin/main` est un ancêtre de `jeanmarc`). Vercel construit et déploie le front de `main`.
3. Suivre le déploiement jusqu'à « Ready ». Si le build échoue, **ne rien annuler côté base** : l'ancien front reste en ligne (le déploiement échoué ne remplace pas l'actuel).
4. Ouvrir la console du navigateur sur : l'accueil, la connexion, l'éditeur de boutique, une vitrine avec pixels, une fiche produit, la commande, `/seo`, `/library`, `/community`. **Aucune ligne « Refused to … Content Security Policy »** ne doit apparaître (CSP de `vercel.json`, déjà en production depuis H8). Une violation sur un service non listé se corrige en ajoutant son domaine à `connect-src` / `form-action`.
5. Le front inclut notamment : réglages de boutique et statistiques corrigés, éditeur de produit sans perte de saisie, thèmes et apparence, optimiseur IA, bibliothèque et Studio, communauté, espace étudiant, suivi des livraisons, preuve sociale, bandeau et écran d'abonnement, paiement complet obligatoire en verrouillage.

> **Bug d'exécution connu, non corrigé :** `src/components/AIImageGenerator.tsx` utilise `cn` sans l'importer (erreur au rendu de ce composant) ; `TemplatePreviewDialog.tsx` importe un fichier inexistant et `GovernanceDocumentPage.tsx` importe `Link`, `useNavigate` et `useParams` de `react` au lieu de `react-router-dom`. Ils figurent dans la baseline de types, donc la CI ne les signale pas ([`DEPLOIEMENT-CI-2026-10.md`](DEPLOIEMENT-CI-2026-10.md) §4.2). À corriger dans un prochain lot ; ne pas s'étonner si ces écrans plantent.

## 9. Étape H : après le front

### H1. Rattrapage des abonnements payés mais jamais appliqués

Fichier : [`supabase/maintenance/abonnements_non_appliques.sql`](../supabase/maintenance/abonnements_non_appliques.sql), **après M1**.

1. **Bloc 1** (lecture seule) : tous les paiements d'abonnement `completed` sans trace d'application, sans limite de date, et ceux restés `pending` depuis plus d'une heure (à rapprocher du tableau de bord GeniusPay). Au 22/10, deux cas.
2. **Bloc 2** (lecture seule) : aperçu du rattrapage. **Le filtre est codé en dur sur deux utilisateurs** (`a4822b15-…`, paiement du 22/10 ; `ae93f995-…`, paiement du 11/09). Si le bloc 1 en liste d'autres, ajouter leurs identifiants au filtre du bloc 2 **et** du bloc 3.
3. **Bloc 3** : rattrapage. Décisions actuelles du fondateur : **un mois complet à partir d'aujourd'hui**, **solde de commission effacé** (conservé dans `shop_payment_events`). Idempotent. Pour une autre règle : abonnement §5.

```sql
select id, business_name, subscription_plan, subscription_active_until, commission_balance_due, shop_payment_status, is_suspended
  from shops where user_id in ('a4822b15-6559-4a84-bbd3-bcc8876064d5','ae93f995-1f46-497b-b75a-29c858e62b57');   -- abonnées, soldées, ouvertes
select id, business_name, commission_balance_due from shops where subscription_active_until > now() and commission_balance_due > 0;   -- 0 ligne
```

### H2. Tâche des échéances de paiement — `20261023140000_billing_enforce_deadlines_cron.sql`

**Effet unique au premier passage (dans les 5 minutes) : toute boutique déjà en retard est verrouillée ou fermée.** La lister d'abord (c'est aussi la dernière ligne du script de pré-contrôle) :

```sql
select id, business_name, shop_payment_status, commission_balance_due, first_deadline_at, second_deadline_at
  from shops
 where commission_balance_due > 0
   and ((shop_payment_status = 'payment_pending' and first_deadline_at < now())
     or (shop_payment_status = 'locked' and second_deadline_at < now()
         and not (coalesce(extra_deadline_active, false) and extra_deadline_ends_at > now())));
```

Prévenir ces marchands ou régulariser d'abord ; **appliquer la migration seulement après**. Retour : `select cron.unschedule('enforce-shop-payment-deadlines');`. Les fermetures pour abonnement non renouvelé (`locked` sans `second_deadline_at`) ne sont jamais concernées. Vérification : `select jobname, schedule, active from cron.job where jobname in ('enforce-shop-payment-deadlines','enforce-subscription-expiry');` → 2 lignes (`*/5` et `*/30`).

### H3. Planificateur d'`ecomfy-pay-settlement` *(si Ecomfy Pay est en production)*

La fonction exige maintenant `Authorization: Bearer <clé de service>` ou `x-cron-secret` = `CRON_SECRET`. **Aucune planification n'existe dans les migrations.** Repérer qui l'appelle (pg_cron, `invoke_edge_function`, planificateur externe) et lui faire envoyer l'en-tête ; s'il n'y en a pas, en créer un (toutes les 5 à 15 minutes). Sans lui, ni le rejeu ni la libération des règlements à 72 h ne tournent. Vérifier : sans autorisation → 401 ; avec la clé de service → 200 avec le champ `replay`.

## 10. Étape I : recette en production

Comptes jetables uniquement (Authentication > Users > Add user, *Auto Confirm User*), montants minimaux, nettoyage ensuite. La colonne « Source » renvoie au guide détaillé.

| # | Parcours | Attendu | Source |
|---|---|---|---|
| 1 | Visiteur anonyme : commande en paiement à la livraison sur une boutique de test | Page de confirmation, commande `new`, numéro `VP-…` généré par le serveur | codes promo §2.5 |
| 2 | Même commande avec un code promo valide, puis invalide, puis minimum non atteint | Remise et nouveau total ; « Code promo invalide » ; « Commande minimum de … FCFA » ; code à 1 utilisation | codes promo §2.5 |
| 3 | Panier abandonné : produit + téléphone valide ; vider ; commander | Ligne « En cours » ; elle disparaît ; elle est convertie à la commande | paniers §2.5 |
| 4 | Avis envoyé depuis une vraie fiche produit | « En attente » dans Avis clients ; non visible avant modération | avis §3 |
| 5 | Supprimer un produit de test déjà commandé | Suppression effective (M5) | produits §1 |
| 6 | Éditeur de produit : variantes, lot, réordonner les images, SEO (méta titre/description) | Enregistrés et relus après rechargement | produits §6 |
| 7 | Abonnement : petit paiement réel sur une boutique de test | `subscription_active_until` posé, solde effacé, boutique `active`, ligne `commission_payments` « Abonnement … » ; une seule activation même si webhook, retour client et réconciliation confirment | abonnement §3.6 |
| 8 | Commande reçue par une boutique abonnée | `commission_balance_due` inchangé | abonnement §3.6 |
| 9 | Boutique verrouillée avec un solde : paiement partiel, puis complet | Partiel refusé (« le règlement doit couvrir la totalité du solde ») ; complet : déverrouillage **sans recharger** | facturation §3.4 |
| 10 | Marchand : réécrire `commission_balance_due`, `shop_payment_status`, `subscription_active_until` de sa boutique par l'API | `42501 shop_billing_columns_protected` ; renommer sa boutique reste possible | garde §3 |
| 11 | Fondateur : activation manuelle d'une boutique, paiement manuel de commission | Activée ; un seul paiement `cash_direct` / `completed` | garde §2 |
| 12 | Affiliation : parrain `/affiliate`, filleul par `/auth?ref=…`, premier abonnement payé | Filleul visible ; commission de 20 % chez le parrain ; versement manuel : montant faux refusé, exact accepté, rejeu refusé | affiliation §4.5 |
| 13 | Boutique restreinte (propriétaire) : console, `orders` et `get_shop_orders_secure` | `orders` → 0 ligne ; RPC → lignes masquées sans `notes` | restreinte §8.5 |
| 14 | Suivi livraison d'une commande : statut, prestataire, nom et téléphone du livreur ; expédier | « Commande poussée avec succès » ; pas de bouton sur « En route » / « Livré » ; console sans « infinite recursion » | restreinte §8.5 |
| 15 | Communauté : membre, puis fondateur ; accès anonyme à l'API | Messages lisibles, pas de JSON ConnectUs ; fondateur nommé ; anonyme → 401 | communauté §3.5 |
| 16 | Bibliothèque : « Éditer le texte » d'une image | Enregistrée (sinon politiques de stockage, M13) | bibliothèque §3.7 |
| 17 | Académie : délivrer un certificat à un compte jetable | Certificat généré, lien de vérification sur `APP_URL` | académie §5 |
| 18 | `/seo` : audit, éditeur de balises ; connexion Google (si les secrets sont posés) | Audit enregistré et relu ; jetons illisibles par l'API ; OAuth : **premier essai réel** | SEO §4 |
| 19 | Finance : « Alertes & Rapports » > activer > icône d'envoi ; « Exporter » dans Excel français | Courriel reçu (dépenses incluant la publicité) ; second clic dans les 5 minutes : message d'attente ; colonnes correctes | finance §3.6 |
| 20 | Optimiseur IA sur un produit qui a des commandes | « Commandes » > 0 ; analyse dans l'historique après rechargement ; source « Ecomfy » chez OpenRouter | optimiseur §3 |
| 21 | Preuve sociale d'une boutique avec commandes récentes | Notifications des 7 derniers jours seulement, aucune commande annulée | paramètres §2 |
| 22 | *(Ecomfy Pay, si présent)* paiement d'un lien `/pay/<clé>` | Redirection opérateur ; ligne `ecomfy_payments` `PENDING` avec référence `ECM-PAY-` + 12 hexadécimaux ; webhook confirme, commande `paid`, écriture `PAYMENT_PENDING` au ledger ; montant différent → 400 | ledger §9.2, §10 |
| 23 | Console du navigateur sur les pages principales | Aucune violation CSP | §8.4 |

Le test **22** est le seul test de bout en bout du webhook GeniusPay signé : **il n'a jamais été joué** (pas de clés sur dev). Les e-mails sur une vraie clé Resend, la fermeture après le délai de grâce, la concurrence de H7 et le paiement GeniusPay réel d'abonnement sont dans le même cas.

## 11. Surveillance (24 à 48 h)

- **Journaux Postgres** : `42501`, `permission denied`, `infinite recursion`, `column ... does not exist`. Une tâche planifiée qui appelle une RPC désormais fermée avec la clé `anon` échoue en 42501.
- **Journaux Edge Functions** : `geniuspay-webhook`, `verify-payment`, `reconcile-pending-payments` (`subscription_not_applied`, réponses 500 répétées, avertissements `Affiliate commission`) ; aucun double crédit (`commission_payments` et `payments` à la même référence).
- **Tâches** : `select * from cron.job_run_details where jobid in (select jobid from cron.job where jobname in ('enforce-subscription-expiry','enforce-shop-payment-deadlines','weekly-finance-summary')) order by start_time desc limit 20;` : passages réguliers sans erreur. Premier lundi à 8 h : le résumé hebdomadaire part sans action.
- **Boutiques** : nombre de boutiques verrouillées par la tâche des échéances (comparer à la liste de H2) ; première boutique dont l'abonnement échoit : événement `subscription_expired`, bandeau 3 jours, puis `locked`.
- **Commandes** : taux de succès de `create_public_order` ; refus « Trop de commandes » légitimes ?
- **Santé** : `app_incidents`, réponse 200 du health-monitor.
- **Support** : « mon abonnement a expiré », « ma boutique est verrouillée », « je ne vois plus mes clients » (boutique restreinte).

## 12. Retour arrière

Voir [`PROCEDURE-ROLLBACK-2026-10.md`](PROCEDURE-ROLLBACK-2026-10.md) (symptôme > action, §3 ; blocs SQL, §6 ; index par migration, §6.3). Principe : **front, puis fonctions, puis tâches, puis SQL.**

- **Front :** Vercel > Deployments > le déploiement noté à l'étape A.4 > « Instant Rollback » (une minute). Compatible avec la nouvelle base.
- **Fonctions :** redéployer depuis le commit noté (`git checkout pre-deploy-20261025 -- supabase/functions/<nom>`, puis la commande de l'étape F, puis revenir à `HEAD`).
- **Tâches :** `select cron.unschedule('enforce-subscription-expiry'); select cron.unschedule('enforce-shop-payment-deadlines'); select cron.unschedule('weekly-finance-summary');`.
- **Base :** rejouer l'objet depuis la capture CSV de l'étape B. **Un retour arrière de correctif de sécurité rouvre la faille** : il ne sert qu'à débloquer un flux, temporairement. Corriger en avant est presque toujours préférable.
- **Ce qui ne revient pas** : les avis orphelins supprimés (M5) ; les paiements et abonnements écrits depuis le déploiement ; le solde de commission effacé par un abonnement (récupérable depuis `shop_payment_events`, abonnement §5) ; les boutiques verrouillées par la tâche des échéances (à rouvrir à la main : `update shops set shop_payment_status='active', is_suspended=false, locked_at=null where id='<id>';`).

## 13. Après le déploiement

1. **Types TypeScript** : `src/integrations/supabase/types.ts` est périmé. Après la production : `npx supabase@latest gen types typescript --project-id yfggrceynzcwklbxhgix > src/integrations/supabase/types.ts`, à relire avant de commiter (cela résorbe plusieurs dizaines d'erreurs de la baseline de types).
2. **Historique des migrations (facultatif)** : les migrations passées dans l'éditeur n'apparaissent pas dans `schema_migrations`. Pour les déclarer : `supabase migration repair --status applied <version>` **sur le projet concerné** (la commande agit sur le projet lié, dev aujourd'hui). **Les deux fichiers de version `20261023100000` entrent en collision** : renommer l'un (par exemple `product_seo_fields` en `20261023105000`) avant tout `repair` ou futur `db push`, en gardant le même contenu.
3. **CI** : étendre le déclencheur à `main` et aux pull requests, puis rendre les contrôles obligatoires ([`DEPLOIEMENT-CI-2026-10.md`](DEPLOIEMENT-CI-2026-10.md) §3.1). Vulnérabilités de production restantes (13, 0 critique) : §4.1 du même guide.
4. **Branche** `hotfix/abonnement-commission` : entièrement contenue dans `jeanmarc` ; la supprimer localement une fois la fusion en production confirmée. **Ne jamais la déployer à part** : sa migration écrit une colonne inexistante.
5. **Mettre à jour** `AUDIT-PROJET-2026-10.md` et `RAPPORT-EXPLOITATION-C1-C8-2026-10.md` avec l'état réel de la production relevé à l'étape C.

## 14. Ce qui reste ouvert (non traité par ce déploiement)

- **Ecomfy Pay (vague 2)** si le pré-contrôle montre qu'il est absent : prérequis C5/C6, revue KYC, retraits suspendus (`withdrawals_enabled = false`), secret `GENIUSPAY_WEBHOOK_SECRET`. Noms d'événements de payout GeniusPay **supposés**, non vérifiés (ledger §4).
- **Facturation par seuil** (`shop_invoices`) : non déployée ; groupe B de l'annexe F.3 de l'audit (`check_and_trigger_billing_threshold`, `enforce_shop_billing_deadlines`, `enforce_shop_payment_state_for`, `process_referral_signup`) à corriger avant.
- **`corporate_invitations`** et `strict_multitenant_privacy` : ouvertes ou non corrigées, à ne pas déployer.
- **`consume_ai_credit`** : un utilisateur sans ligne `profiles` bénéficie d'un essai gratuit illimité des fonctions à essai (0 compte sans profil en production d'après le propriétaire, 23/10 ; le script de pré-contrôle le revérifie).
- **E-mails codés en dur** côté interface (`FounderRoute.tsx`, `AppSidebar.tsx`, `AssociateSpace.tsx`, `CorporateGovernance.tsx`, `FounderDashboard.tsx`, `FounderTroubleshooting.tsx`, `app-health-monitor/index.ts`).
- **Réconciliation Meta** (`TrackingReconciliation.tsx`) : jamais affichée ; à décider.
- **`generate-product-sheet`** demande encore à l'IA d'inventer des témoignages (le front ne les utilise plus).
- **Commission de commande (H10)** facturée à la création : décision ouverte.
- **Produits** : le parcours d'édition n'a pas été testé dans un navigateur sur une session marchand.

## 15. Ce qui a été validé, et où

| Sujet | Dev (base) | Navigateur sur dev | En production |
|---|---|---|---|
| Abonnement (M1) | appliquée | oui, déverrouillage en direct, bandeaux | non ; paiement GeniusPay réel non testé |
| Facturation (M3, M4, H2) | appliquées | oui | non |
| Garde `shops` (M16) | appliquée, 234 cas RLS, 0 échec | oui (refus `42501`, éditeur et assistant OK) | non |
| Affiliation (M2) | appliquée | oui ; Google OAuth non testé | non |
| Boutique restreinte / livraison (M11) | appliquées | oui | non |
| Communauté (M12), bibliothèque (M13) | appliquées | oui | non |
| Paniers (M10), codes promo (M9) | appliquées | oui | non |
| Avis (M5), preuve sociale (M7) | appliquées | oui | non |
| Finance (M15) | appliquée | oui ; envoi réel de courriel non testé (pas de clé Resend sur dev) | non |
| SEO (M14) | appliquées | oui, sans OAuth Google (pas d'identifiants) | non |
| Ecomfy Pay (M17, F5) | appliquées | oui, sans GeniusPay réel | **absent ou inconnu** |
| Produits (M6) | appliquée | **non** (aucune session marchand) | non |
| Académie, optimiseur IA, statistiques, apparence | – | oui | non |
| CI, vitest | – | tests locaux (98) ; **workflow jamais exécuté sur GitHub** | – |

## 16. Liste de contrôle

**A. Poste et GitHub**
- [ ] `jeanmarc` à jour, `0 N` contre `origin/main`
- [ ] `npm test` (98), `npm run lint`, `npm run typecheck`, `vite build` avec les variables de production
- [ ] `jeanmarc` poussée, CI GitHub lue (4 jobs)
- [ ] Pull request ouverte, **non fusionnée**
- [ ] Variables Vercel Production correctes ; installateur Vercel vérifié (bun)
- [ ] Point de retour du front noté

**B. Garde-fous**
- [ ] « Deploy to production » de l'intégration GitHub de Supabase **désactivé**
- [ ] Sauvegarde prise
- [ ] Capture `capture_logic_before_deploy.sql` exportée hors du dépôt
- [ ] Tag `pre-deploy-20261025` ; versions des fonctions notées
- [ ] Décideur et seuil d'annulation désignés

**C. Pré-contrôle**
- [ ] Script `precontrole_deploiement_jeanmarc.sql` exécuté, résultats conservés
- [ ] Décisions de la section 4.1 prises (Ecomfy Pay, affiliation, livraison, SEO)

**D. Secrets**
- [ ] `GENIUSPAY_*`, `OPENROUTER_API_KEY`, `CRON_SECRET` présents ; Vault : 3 secrets, `cron_secret` identique
- [ ] `GOOGLE_OAUTH_*` posés (si Search Console voulue)

**E. Migrations** (cocher chacune après ses vérifications)
- [ ] M1 · [ ] M2 · [ ] M3 · [ ] M4 · [ ] M5 · [ ] M6 · [ ] M7 · [ ] M8 · [ ] M9 · [ ] M10
- [ ] M11 (ou sautée : ________) · [ ] M12 · [ ] M13 · [ ] M14 · [ ] M15 · [ ] M16
- [ ] M17 (ou sautée : Ecomfy Pay absent)
- [ ] Pré-contrôle rejoué : toutes les empreintes à `true`

**F. Fonctions**
- [ ] F1 · [ ] F2 · [ ] F3 · [ ] F4 · [ ] F5 (ou sautée) · [ ] F6 (facultatif)
- [ ] Contrôle sans JWT : 401 partout

**G. Front**
- [ ] Pull request fusionnée · [ ] Vercel « Ready » · [ ] console sans violation CSP

**H. Après le front**
- [ ] H1 rattrapage des abonnements (blocs 1, 2, 3 et contrôle)
- [ ] H2 boutiques en retard listées et prévenues, puis `20261023140000` appliquée
- [ ] H3 planificateur de `ecomfy-pay-settlement` (si applicable)

**I. Recette et surveillance**
- [ ] Recette de la section 10 · [ ] surveillance 48 h · [ ] états de la production mis à jour dans l'audit
