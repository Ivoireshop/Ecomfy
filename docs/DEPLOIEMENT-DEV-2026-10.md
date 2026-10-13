# Déploiement des correctifs de sécurité sur la base dev (octobre 2026)

**Cible :** projet Supabase **dev** `xfpbpxncserliskrbaim` (copie de la production). **Ne pas utiliser ce guide tel quel sur la production** (voir la section 9).
**Points couverts :** C1 (portefeuille), C4 (KYC, dans le même fichier 02), C2 (RPC de facturation et serveur), C3 (`get_shop_orders_secure`), C7 (`manage-founder-roles`), C8 (`tracking.ts`, `track-conversion`). H2 (gouvernance) est déjà appliqué sur dev.
**KYC, écran de revue, production :** `docs/KYC-REVUE-ET-DEPLOIEMENT-C4.md`.
**Contexte :** `docs/VERIFICATION-CORRECTIFS-2026-10.md` (état constaté de dev le 12/10/2026).

## 0. État du déploiement sur dev (12 octobre 2026)

| Étape | Fait | Vérifié par |
|---|---|---|
| A. Edge Functions `founder-record-commission-payment`, `founder-activate-shop`, `manage-founder-roles`, `track-conversion` | Oui (`--use-api` : le bundling Docker échoue sous Windows) | 401 sans JWT ; 403 marchand ; 200 ou réponse métier pour le fondateur ; écritures testées dans l'interface |
| B. Front de la branche `jeanmarc` | Oui (testé en local contre dev) | Navigateur |
| C. `01_c2_c3_security.sql` | Oui | Requête SQL en lecture seule ; script HTTP |
| C bis. `04_user_roles_rls.sql` | Oui | `user_roles` répond 200 ; pages fondateur accessibles |
| D. `02_c1_wallet_dev.sql` (C1 et C4, optionnel) | **Non** (version avec correctif C4 prête, jamais exécutée sur dev) | 6 échecs attendus du script HTTP (fonctions de portefeuille absentes) |
| F. Comptes jetables et tests | Oui | Script HTTP : 42 réussis, 6 échecs (C1) ; interface : boutique créée, GA4 invalide refusé, activation et paiement manuels |

Les données de test créées sur dev (deux comptes, une boutique, un paiement, deux lignes de commission) sont à nettoyer : section 8.3.

---

## 1. Ce qui sera déployé, et pourquoi pas `supabase db push`

Dev est à la version `20260901020000` plus le hotfix `20261012120000`. `supabase db push` appliquerait aussi environ 25 migrations en attente, dont plusieurs qui contiennent des failles non corrigées (voir section 9). On applique donc des **scripts ciblés** :

| Fichier | Contenu | État sur dev avant |
|---|---|---|
| (déjà fait) hotfix `20261012120000` | H2 : politiques `corporate_*` ; `apply_shop_subscription` | appliqué |
| [supabase/deploy-dev/01_c2_c3_security.sql](../supabase/deploy-dev/01_c2_c3_security.sql) | C2 : `130000` + `140000` + `150000` ; C3 : fonction `get_shop_orders_secure` seule | à appliquer |
| [supabase/deploy-dev/04_user_roles_rls.sql](../supabase/deploy-dev/04_user_roles_rls.sql) | C7 côté RLS : corrige la récursion de `user_roles` qui bloque l'espace fondateur (section 5 bis) | à appliquer |
| [supabase/deploy-dev/02_c1_wallet_dev.sql](../supabase/deploy-dev/02_c1_wallet_dev.sql) | C1 : système Ecomfy Pay (`20260914190000` + `200000`), adapté pour dev | **optionnel**, lire la section 5 |
| [supabase/deploy-dev/03_verify_read_only.sql](../supabase/deploy-dev/03_verify_read_only.sql) | vérification en lecture seule (19 contrôles) | à lancer après |
| [supabase/deploy-dev/99_rollback.sql](../supabase/deploy-dev/99_rollback.sql) | retour arrière par sections | en cas de besoin |
| [scripts/verify-dev-security.mjs](../scripts/verify-dev-security.mjs) | tests HTTP avec de vrais JWT (comptes jetables) | à lancer après |

**Validation préalable (base locale jetable qui imite dev) :** migrations jusqu'à `20260901020000` plus le hotfix (même nombre de politiques `corporate_*` que dev : 30, `payment_links` présente, ni `wallets` ni `get_shop_orders_secure`), puis `01` et `02` exécutés avec `--single-transaction -v ON_ERROR_STOP=1` : aucune erreur ; `01` rejoué une seconde fois : aucune erreur (idempotent) ; `03` : 19 contrôles tous vrais ; les 46 tests de comportement de `supabase/tests/verification_c1_c2_c3_h2.sql` donnent le résultat attendu.

## 2. Pré-requis

1. **Snapshot ou sauvegarde** de dev (même si c'est une copie).
2. Vérifier que le hotfix est en place (dans l'éditeur SQL de dev) :
   ```sql
   select (select count(*) from pg_proc where proname in ('is_corporate_founder','is_corporate_reader')) as helpers_attendu_2,
          (select count(*) from pg_policies where schemaname='public' and tablename like 'corporate_%'
              and (qual='true' or with_check='true')) as permissives_attendu_2;
   ```
3. Outils sur votre poste : Node 20+, et pour les Edge Functions la CLI Supabase (`npx supabase@latest ...`, connexion par `npx supabase@latest login`). `psql` n'est requis que si vous n'utilisez pas l'éditeur SQL du tableau de bord.

## 3. Étape A : Edge Functions (avant les migrations)

Les migrations `130000` et `140000` retirent aux fondateurs l'appel direct des RPC : leurs écrans de paiement manuel et d'activation manuelle passent par deux nouvelles Edge Functions. **Les déployer d'abord.**

**Sous Windows, utiliser `--use-api`** : sans lui, la CLI compile les fonctions dans Docker et échoue avec `invalid volume specification: 'C:\dev\Ecomfy\supabase\functions:/dev/Ecomfy/supabase/functions:ro'` (Docker refuse le montage du chemin Windows). Avec `--use-api`, la compilation se fait côté Supabase, Docker n'est pas utilisé.

PowerShell, depuis `C:\dev\Ecomfy` :

```powershell
npx supabase@latest login
$P = "xfpbpxncserliskrbaim"
npx supabase@latest functions deploy founder-record-commission-payment --project-ref $P --use-api
npx supabase@latest functions deploy founder-activate-shop             --project-ref $P --use-api
npx supabase@latest functions deploy manage-founder-roles              --project-ref $P --use-api   # C7
npx supabase@latest functions deploy track-conversion                  --project-ref $P --use-api   # C8 (filtrage des identifiants)
npx supabase@latest functions deploy ecomfy-pay-withdraw               --project-ref $P --use-api   # C1, seulement si étape D faite
```

Si `--use-api` échoue sur `manage-founder-roles` (il importe `./handler.ts` et `_shared`), le redéployer avec Docker Desktop lancé et un dépôt cloné à un chemin sans espace, ou depuis WSL. Dans l'éditeur du tableau de bord (Edge Functions > Deploy a new function), les fonctions qui importent `../_shared/founderAuth.ts` (`founder-record-commission-payment`, `founder-activate-shop`) ne peuvent pas être collées telles quelles : préférer la CLI.

Vérification (sans JWT, attendu 401 pour chacune), PowerShell :

```powershell
$env:U = (Select-String -Path .env -Pattern '^VITE_SUPABASE_URL=').Line.Split('"')[1]
$env:K = (Select-String -Path .env -Pattern '^VITE_SUPABASE_PUBLISHABLE_KEY=').Line.Split('"')[1]
foreach ($f in "founder-record-commission-payment","founder-activate-shop","manage-founder-roles") {
  try { Invoke-WebRequest -Method Post -Uri "$env:U/functions/v1/$f" -Headers @{ apikey = $env:K } -ContentType "application/json" -Body "{}" -UseBasicParsing | Out-Null; "$f -> 200" }
  catch { "$f -> $($_.Exception.Response.StatusCode.value__)" }
}
```

## 4. Étape B : application (front)

Les correctifs front (C8 `tracking.ts` et `ShopSettings`, C7 `FounderManager`, C2 écrans fondateur `ShopPaymentControl`, `FounderDashboard`, `BillingPaymentModal`, `PayCommissionDialog`) sont sur la branche `jeanmarc`. Les déployer sur l'environnement qui utilise la base dev (ou lancer en local avec le `.env` actuel, qui pointe sur dev) **avant** l'étape C, sinon les écrans fondateur appellent encore la RPC directement et échouent.

```bash
npm run build      # vérifie que le build passe (VITE_SUPABASE_URL et la clé doivent être définies)
```

## 5. Étape C : SQL C2 et C3 (fichier 01)

### Option 1 : éditeur SQL du tableau de bord (recommandé)

1. Ouvrir <https://supabase.com/dashboard/project/xfpbpxncserliskrbaim/sql/new> (projet « ecomfy dev »).
2. Coller **tout** le contenu de `supabase/deploy-dev/01_c2_c3_security.sql`, puis Run. Un script collé en entier s'exécute dans une seule transaction : en cas d'erreur, rien n'est appliqué.

### Option 2 : `psql` (chaîne de connexion : tableau de bord, bouton Connect)

```bash
psql "postgresql://postgres.xfpbpxncserliskrbaim:<MOT_DE_PASSE>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres" \
  --single-transaction -v ON_ERROR_STOP=1 -f supabase/deploy-dev/01_c2_c3_security.sql
```

Le fichier est idempotent : il peut être rejoué.

## 5 bis. Étape C bis : SQL `user_roles` (fichier 04, nécessaire pour tester l'espace fondateur)

**Constat dans le navigateur (dev, 12/10/2026, compte fondateur jetable) :** `GET /rest/v1/user_roles?...` renvoie HTTP 500 (récursion de politique, 42P17), donc `/corporate-governance` et `/founder/*` affichent « Accès restreint » pour tout compte qui n'a pas le contournement par e-mail codé en dur. La cause est la politique `user_roles_manage_policy`, qui interroge `user_roles` dans sa propre condition (migration `20260831190000`, antérieure aux correctifs).

Fichier : [supabase/deploy-dev/04_user_roles_rls.sql](../supabase/deploy-dev/04_user_roles_rls.sql) (identique à la migration `20261012160000_fix_user_roles_rls_recursion.sql`). Il supprime les deux politiques fautives, ajoute une lecture complète pour les `founder` et `co_founder` (via `is_corporate_founder()`, `SECURITY DEFINER`, sans récursion), et retire l'écriture directe pour `anon` et `authenticated`. Chacun continue de lire ses propres rôles. Les rôles se gèrent par l'Edge Function `manage-founder-roles` (clé `service_role`). Le code client ne lit que ses propres lignes de `user_roles` et n'y écrit jamais (vérifié par recherche dans `src/`).

Même procédure que l'étape C. Idempotent. **Prérequis :** le hotfix (fonction `is_corporate_founder`).

Validé sur une base locale qui imite dev (migrations jusqu'au 01/09 + hotfix + fichier 01) : 15 tests avec les vrais rôles. Lecture de ses propres rôles OK pour marchand, co-fondateur et actionnaire ; un marchand ou un actionnaire ne voit que ses lignes ; le co-fondateur voit toute la table ; INSERT et DELETE par un co-fondateur, un marchand ou `anon` : `permission denied` (42501) ; `service_role` écrit ; `has_role` fonctionne ; la gouvernance reste lisible pour fondateur et actionnaire et fermée à un marchand sans rôle.

## 6. Étape D (optionnelle) : SQL C1, portefeuille Ecomfy Pay (fichier 02)

**À lire avant de lancer :**

1. Le système Ecomfy Pay n'existe pas sur dev (ni `wallets`, `merchant_kyc`, `withdrawal_requests`…). Pour tester C1 sur dev, il faut le déployer : ce fichier le fait.
2. **Conflit de noms trouvé :** `public.payment_links` existe déjà sur dev (migration `20251120131345`, liens de paiement de **cours** : `course_id`, `provider`, `payment_url`). La migration Ecomfy Pay veut une autre table du même nom (`shop_id`, `link_key`) : son `CREATE TABLE IF NOT EXISTS` est ignoré et ses index et politiques sur `shop_id` échoueraient, ce qui annulerait tout. Le fichier 02 retire ces quatre instructions et la colonne `is_sandbox` sur `payment_links`. Conséquence : **les liens de paiement Ecomfy Pay ne fonctionnent pas** sur dev avec ce fichier. Le portefeuille, le KYC, les retraits et les fonctions C1 fonctionnent. Cela devra être résolu (renommer la table Ecomfy Pay, par exemple `ecomfy_payment_links`) avant toute mise en production.
3. **C4 (KYC) est corrigé dans ce fichier** : l'ancienne `evaluate_merchant_kyc_security` n'est plus créée, le statut KYC n'est écrit que par `review_merchant_kyc` (fondateur ou `service_role`), et **les retraits sont suspendus par défaut** (`ecomfy_pay_settings.withdrawals_enabled = false`). Pour tester un retrait sur dev : passer l'interrupteur à `true`, faire valider un compte jetable depuis `/founder/kyc-review`, puis le remettre à `false` (voir `docs/KYC-REVUE-ET-DEPLOIEMENT-C4.md`). **Non corrigées et introduites par ce déploiement :** les Edge Functions `ecomfy-pay-webhook` (C5, sans signature) et `ecomfy-pay-initiate` (C6, montants libres) ne sont pas à déployer sur dev tant qu'elles ne sont pas corrigées.
4. Non idempotent (`CREATE POLICY`) : à exécuter une seule fois. En cas d'échec, tout est annulé.

Même procédure que l'étape C, avec `supabase/deploy-dev/02_c1_wallet_dev.sql`. Ensuite, déployer `ecomfy-pay-withdraw` (section 3).

## 7. Étape E : vérification en lecture seule

Coller `supabase/deploy-dev/03_verify_read_only.sql` dans l'éditeur SQL. Attendu : **`ok = true` sur les 19 lignes** si le fichier 02 a été exécuté. Sans lui, seules les 8 lignes C2, C3 et H2 doivent être vraies, et les 11 lignes « C1 » (droits et RLS du portefeuille) seront `false` : c'est normal.

## 8. Étape F : tests avec des comptes jetables

### 8.1 Créer les comptes

Dans le tableau de bord : Authentication > Users > **Add user** > « Create new user », en cochant **Auto Confirm User** :

| Compte | Exemple d'e-mail | Rôle |
|---|---|---|
| marchand jetable | `marchand-test@example.test` | aucun |
| fondateur jetable | `fondateur-test@example.test` | `co_founder` (voir SQL ci-dessous) |

Choisir des mots de passe longs et propres à ces comptes. Ne pas utiliser l'e-mail ni le mot de passe d'un compte réel. Donner le rôle au fondateur jetable (éditeur SQL, rôle `postgres`) :

```sql
insert into public.user_roles (user_id, role)
select id, 'co_founder' from auth.users where email = 'fondateur-test@example.test';
```

### 8.2 Lancer les tests HTTP

```bash
set -a; . ./.env; set +a
SUPABASE_URL="$VITE_SUPABASE_URL" SUPABASE_ANON_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY" \
MERCHANT_EMAIL='marchand-test@example.test' MERCHANT_PASSWORD='...' \
FOUNDER_EMAIL='fondateur-test@example.test'  FOUNDER_PASSWORD='...' \
node scripts/verify-dev-security.mjs
```

Le script refuse de viser la production, n'utilise qu'un UUID de boutique inexistant, n'affiche jamais les mots de passe, et sort avec le code 1 s'il y a un échec. **Ligne de base avant déploiement** (anonyme seulement, lancée le 12/10/2026) : 8 réussis, 8 échecs, tous attendus (`apply_shop_activation` et `prepare_shop_activation_payment` ouvertes à `anon`, `get_shop_orders_secure` et fonctions de portefeuille absentes, Edge Functions `founder-*` absentes). Après les étapes A à D : tout doit être PASS, sauf les lignes C1 si l'étape D n'a pas été faite.

Le test « marchand : INSERT user_roles refusé » passe avant et après le fichier 04, mais pour une raison différente : avant, par une erreur de récursion (500) ; après, par un refus de droits (42501).

### 8.3 Nettoyer

```sql
delete from public.user_roles where user_id in (select id from auth.users where email in ('marchand-test@example.test','fondateur-test@example.test'));
delete from auth.users where email in ('marchand-test@example.test','fondateur-test@example.test');
```

(ou Authentication > Users > supprimer les deux comptes).

Si vous avez aussi créé la boutique de test (`c1083a4b-046f-4cd5-b4ed-9a369ab055b5`) et lancé l'activation et le paiement manuels, supprimer ses données **avant** les comptes (à exécuter dans l'éditeur SQL de dev ; relire chaque ligne avant de lancer, ces suppressions sont définitives) :

```sql
delete from public.commission_payments where shop_id = 'c1083a4b-046f-4cd5-b4ed-9a369ab055b5';
delete from public.payments            where metadata->>'shop_id' = 'c1083a4b-046f-4cd5-b4ed-9a369ab055b5';
delete from public.shops               where id = 'c1083a4b-046f-4cd5-b4ed-9a369ab055b5';
```

Si une de ces suppressions échoue sur une contrainte de clé étrangère, la boutique a des lignes dépendantes (créées par un trigger) : les supprimer ou supprimer le compte marchand de test (les clés en cascade nettoient le reste).

## 9. Ce qu'il ne faut pas faire, et limites

- **Ne pas déployer `20260909100000` en entier** : il contient `confirm_invoice_payment` (C2). Seule `get_shop_orders_secure` est reprise ici. Conséquence sur dev : `confirm_invoice_payment` reste absente, et les écrans de facturation par seuil qui en dépendent ne fonctionnent pas.
- **Ne pas utiliser `supabase db push`.**
- **Production :** ne pas y appliquer le fichier 02 (conflit `payment_links`, C5, C6 ouverts). C4 y est corrigé mais ne suffit pas à rendre ce fichier déployable en production ; procédure : `docs/KYC-REVUE-ET-DEPLOIEMENT-C4.md` section 5. Pour `01`, suivre `docs/SECURITY-HOTFIX-2026-10.md` : Edge Functions d'abord, front, puis migrations, après snapshot ; tâches planifiées appelant ces RPC avec la clé `anon` à vérifier (elles échoueront en 42501 après `150000`).
- **Non corrigé par ces scripts :** `corporate_invitations`, le groupe B de l'annexe F.3 de l'audit (`record_affiliate_referral`, `process_affiliate_commission_for_payment`, `check_and_trigger_billing_threshold`…), les e-mails en dur côté interface, les données déjà piégées dans `google_analytics_code` (C8).
- `getWallet()` (`src/lib/ecomfyPay.ts`) appelle encore `get_or_create_merchant_wallet` depuis le navigateur : refusé après l'étape D (voir le rapport de vérification, section 6, point 2).

## 10. Retour arrière

`supabase/deploy-dev/99_rollback.sql` : sections indépendantes, à décommenter selon le besoin. Chacune rétablit les failles ; le plus sûr reste la restauration du snapshot de l'étape 2.
