# Hotfix sécurité d'octobre 2026 : déploiement et tests

**Migration :** `supabase/migrations/20261012120000_hotfix_security_billing_rpc_and_corporate_rls.sql`
**Constats traités :** C2 (en partie : `apply_commission_payment`, `apply_shop_subscription` ; complété par la migration `20261012130000`, voir 5.4) et H2 (tables `corporate_*`), voir `AUDIT-PROJET-2026-10.md`.
**État :** appliqué et validé sur la base de dev. **Appliqué en production le 12 octobre 2026**, avec les compléments `130000`, `140000`, `150000` et `160000` : voir [`DEPLOIEMENT-PROD-2026-10.md`](DEPLOIEMENT-PROD-2026-10.md) (vérifications, front en attente, points restants).
**Suite (12/10/2026) :** les compléments C2 (`20261012130000`, `140000`, `150000`), le correctif C3 et le correctif RLS de `user_roles` (`20261012160000`) ont été déployés et vérifiés sur dev avec des scripts ciblés : voir [`DEPLOIEMENT-DEV-2026-10.md`](DEPLOIEMENT-DEV-2026-10.md) et [`VERIFICATION-CORRECTIFS-2026-10.md`](VERIFICATION-CORRECTIFS-2026-10.md). Avant de déployer en production, lire en particulier la section 9 du guide de déploiement et reporter `20261012160000` (la politique `user_roles_manage_policy` fautive est très probablement aussi en production).

---

## 1. Pourquoi

Les requêtes de l'annexe B de l'audit, exécutées sur la base de dev (copie de la production), puis sur la production pour confirmer, donnent le même résultat :

- version de migration maximale : `20260901020000`. Les 25 migrations suivantes du dépôt n'y sont pas ;
- `apply_commission_payment` et `apply_shop_subscription` sont exécutables par `PUBLIC` et `anon` : n'importe qui, sans compte, peut effacer une dette de commission ou activer un abonnement ;
- les 14 tables `corporate_*` ont des politiques `USING (true)` en lecture et en écriture pour tout utilisateur connecté (cap table, actionnaires, documents, journal d'audit) ;
- `wallets`, `ecomfy_payments` et `affiliates` n'existent pas : les failles du portefeuille (C1, C3, C4) ne sont pas exploitables aujourd'hui, mais le seront dès que ces migrations seront déployées telles quelles.

## 2. Ce que fait la migration

| Objet | Avant | Après |
|---|---|---|
| `apply_commission_payment` | exécutable par `PUBLIC`, `anon`, `authenticated`, sans contrôle | `anon`/`PUBLIC` retirés. Le corps de la fonction refuse (`42501 forbidden`) tout appelant qui n'est ni `service_role`, ni connexion directe (`postgres`, `supabase_admin`), ni utilisateur `founder` / `co_founder` de `user_roles`. |
| `apply_shop_subscription` | exécutable par `PUBLIC`, `anon`, `authenticated` | réservée à `service_role` |
| 14 tables `corporate_*` | lecture et écriture ouvertes à tout utilisateur connecté | lecture : `founder`, `co_founder`, `shareholder`, `admin` ; écriture complète : `founder`, `co_founder` ; insertion seule pour tout utilisateur connecté sur `corporate_audit_logs` et `corporate_document_acceptances` (onboarding) |
| Fonctions d'aide | n/a | `is_corporate_founder()`, `is_corporate_reader()` (`SECURITY DEFINER`, `search_path = public`, sans `anon`) |

La migration `20261003120000_fix_billing_partial_payments_sync.sql` (pas encore appliquée en production) a été modifiée pour ne pas rouvrir la faille : même garde dans `apply_commission_payment`, et plus de `GRANT … anon`.

Appelants légitimes préservés :
- edge functions `geniuspay-webhook`, `verify-payment`, `reconcile-pending-payments` (clé `service_role`) ;
- écrans fondateur `ShopPaymentControl`, `FounderDashboard`, `BillingPaymentModal`, `PayCommissionDialog` (JWT d'un fondateur / cofondateur).

## 3. Avant de déployer en production

1. **Sauvegarde ou snapshot** de la base de production.
2. Vérifier que votre compte `founder` existe dans `user_roles` :
   ```sql
   select ur.role, u.email from user_roles ur join auth.users u on u.id = ur.user_id
   where ur.role::text in ('founder','co_founder','shareholder','admin');
   ```
3. Vérifier que chaque actionnaire qui doit consulter la gouvernance a une ligne `shareholder` (ou `admin`) dans `user_roles`. L'ancienne règle les autorisait par e-mail dans `corporate_shareholders`, pas la nouvelle.
4. Vérifier si des invités accèdent à la gouvernance sans compte connecté (flux d'invitation par jeton) : ce cas n'est pas couvert.

## 4. Déploiement

Dans l'éditeur SQL de production, exécuter le contenu du fichier de migration en une seule fois (il est idempotent). Ne pas utiliser `supabase db push` : il appliquerait aussi les 25 migrations en attente.

## 5. Tests à faire après le déploiement

### 5.1 Vérifications SQL (éditeur SQL)

```sql
-- Attendu : seule la ligne (apply_commission_payment, authenticated)
select routine_name, grantee
from information_schema.routine_privileges
where routine_schema = 'public'
  and grantee in ('anon', 'PUBLIC', 'authenticated')
  and routine_name in ('apply_commission_payment', 'apply_shop_subscription');

-- Attendu : 2 lignes (les deux politiques d'insertion seule, voulues)
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and tablename like 'corporate_%'
  and (qual = 'true' or with_check = 'true');

-- Attendu : 3 politiques par table (read, founder write, et append pour 2 tables)
select tablename, count(*) from pg_policies
where schemaname = 'public' and tablename like 'corporate_%' group by 1 order by 1;

-- Attendu : 2 lignes
select proname from pg_proc where proname in ('is_corporate_founder', 'is_corporate_reader');
```

### 5.2 Tests d'API avec de vrais JWT

À faire avec un compte marchand (sans rôle) et un compte fondateur. Utiliser un UUID de boutique inexistant : aucun effet de bord possible. Remplacer `URL`, `KEY` (clé anon), `TOKEN_MARCHAND`, `TOKEN_FONDATEUR`.

```bash
FAKE=eeeeeeee-0000-4000-8000-00000000000e
CP="{\"p_shop_id\":\"$FAKE\",\"p_amount\":1,\"p_transaction_reference\":\"deploy-test\"}"
call() { curl -s -X POST "$URL/rest/v1/rpc/$2" -H "apikey: $KEY" -H "Authorization: Bearer $1" -H "Content-Type: application/json" -d "$3"; echo; }

call "$KEY"             apply_commission_payment "$CP"   # anonyme   -> 42501 permission denied
call "$TOKEN_MARCHAND"  apply_commission_payment "$CP"   # marchand  -> 42501 forbidden
call "$TOKEN_FONDATEUR" apply_commission_payment "$CP"   # fondateur -> {"error":"shop_not_found","success":false}
call "$TOKEN_MARCHAND"  apply_shop_subscription  '{"p_shop_id":"'$FAKE'","p_user_id":"'$FAKE'","p_plan":"starter","p_amount":0,"p_transaction_reference":"deploy-test"}'  # -> 42501

for t in corporate_shareholders corporate_companies corporate_share_allocations corporate_audit_logs; do
  curl -s "$URL/rest/v1/$t?select=id" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN_MARCHAND"   # -> []
  curl -s "$URL/rest/v1/$t?select=id" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN_FONDATEUR"  # -> des lignes
done

# Écriture par un marchand : doit renvoyer [] (aucune ligne modifiée)
curl -s -X PATCH "$URL/rest/v1/corporate_companies?id=eq.00000000-0000-0000-0000-000000000001" \
  -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN_MARCHAND" -H "Content-Type: application/json" \
  -H "Prefer: return=representation" -d '{"name":"HACKED"}'
```

### 5.3 Tests dans l'application

| Parcours | Attendu |
|---|---|
| Connexion fondateur → page de gouvernance (`/corporate-governance`) | cap table, actionnaires, documents visibles |
| Connexion fondateur → `/founder/shop-payment-control` → « paiement manuel » | paiement enregistré, boutique réactivée |
| Connexion fondateur → `BillingPaymentModal` / `PayCommissionDialog` en mode fondateur | validation manuelle réussie |
| Connexion marchand (non fondateur) → pages de gouvernance | pas de données (vide ou accès refusé) |
| Connexion actionnaire avec rôle `shareholder` | lecture seule de la gouvernance |
| Onboarding actionnaire (signature des 3 documents) | acceptations et entrées d'audit enregistrées |
| Paiement GeniusPay de bout en bout (sandbox) | webhook → `apply_commission_payment` OK, solde mis à jour |
| Abonnement de boutique (GeniusPay) | webhook / `verify-payment` → `apply_shop_subscription` OK |
| Tâche `reconcile-pending-payments` | s'exécute sans erreur `forbidden` dans les journaux |

Surveiller après le déploiement, dans les journaux Postgres et edge functions : les erreurs `42501` et `forbidden`, qui signalent soit une tentative d'abus, soit un appelant légitime oublié.

## 5.4 Complément C2 : migration `20261012130000` (à appliquer après le hotfix)

Les trois fonctions de facturation (`apply_commission_payment`, `apply_shop_subscription`, `confirm_invoice_payment`) sont réservées à `service_role`. **Ce complément remplace les attendus de 5.1 et 5.2 pour `apply_commission_payment`** : un fondateur connecté ne peut plus l'appeler directement (`42501 permission denied`).

Ordre de déploiement : déployer d'abord les Edge Functions, puis le front, puis les migrations `20261012130000` et `20261012140000` (voir ci-dessous). Sinon les écrans de paiement manuel et d'activation manuelle des fondateurs échouent.

```bash
supabase functions deploy founder-record-commission-payment
supabase functions deploy founder-activate-shop
```

Vérification SQL (attendu : seule la ligne `service_role` pour chaque fonction) :

```sql
select routine_name, grantee
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('apply_commission_payment', 'apply_shop_subscription', 'confirm_invoice_payment',
                       'apply_shop_activation', 'prepare_shop_activation_payment')
  and grantee in ('anon', 'PUBLIC', 'authenticated', 'service_role')
order by 1, 2;
```

Tests d'API (`FN` = `$URL/functions/v1/founder-record-commission-payment`, UUID de boutique inexistant) :

```bash
FAKE=eeeeeeee-0000-4000-8000-00000000000e
B="\"shop_id\":\"$FAKE\",\"amount\":1,\"transaction_reference\":\"c2-test\""
H="-H apikey:$KEY -H Content-Type:application/json"
curl -s -X POST "$FN" $H -d "$B"                                              # sans JWT   -> 401
curl -s -X POST "$FN" $H -H "Authorization: Bearer $TOKEN_MARCHAND" -d "$B"   # marchand   -> 403
curl -s -X POST "$FN" $H -H "Authorization: Bearer $TOKEN_FONDATEUR" -d "$B"  # fondateur  -> {"success":false,"error":"shop_not_found"}
call "$TOKEN_FONDATEUR" apply_commission_payment "$CP"                         # RPC directe, même fondateur -> 42501 permission denied
```

Migration `20261012140000` : réserve aussi `apply_shop_activation` et `prepare_shop_activation_payment` à `service_role` (leur `REVOKE ... FROM PUBLIC` d'origine laissait `anon` et `authenticated`). L'activation manuelle de `FounderDashboard` passe par `founder-activate-shop` :

```bash
FA="$URL/functions/v1/founder-activate-shop"
BA="{\"shop_id\":\"$FAKE\",\"amount\":1}"
curl -s -X POST "$FA" $H -d "$BA"                                              # sans JWT  -> 401
curl -s -X POST "$FA" $H -H "Authorization: Bearer $TOKEN_MARCHAND" -d "$BA"   # marchand  -> 403
curl -s -X POST "$FA" $H -H "Authorization: Bearer $TOKEN_FONDATEUR" -d "$BA"  # fondateur -> {"success":false,"error":"Boutique introuvable."}
```

Tests dans l'application : les parcours « paiement manuel » de `ShopPaymentControl`, `FounderDashboard`, `BillingPaymentModal` et `PayCommissionDialog` (fondateur) doivent toujours enregistrer le paiement et réactiver la boutique. Dans `FounderDashboard`, l'onglet « activation de boutique » doit activer la boutique (auparavant, il affichait un succès sans rien activer) et créer une ligne `payments` avec `metadata.manual = true`. Les webhooks (`geniuspay-webhook`, `verify-payment`, `reconcile-pending-payments`) ne changent pas : ils utilisent déjà `service_role`.

Migration `20261012150000` : réserve à `service_role` seize fonctions serveur (files d'e-mails, tâches de maintenance, limitation de débit, incidents, usage des codes promo, file IA, `get_or_create_affiliate`), restées exécutables par `anon` et `authenticated` à cause d'un `REVOKE ... FROM PUBLIC` seul. Liste et analyse : annexe F.3 de l'audit. Vérification SQL après déploiement (attendu : 0 ligne) :

```sql
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('read_email_batch','enqueue_email','delete_email','move_to_dlq','cleanup_expired_trash',
    'cleanup_old_generated_media','cleanup_old_image_cache','expire_stale_pending_payments','expire_subscriptions',
    'enforce_shop_payment_state','check_rate_limit','record_app_incident','increment_promo_usage',
    'get_next_queue_item','count_processing_generations','get_or_create_affiliate')
  and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'));
```

Après déploiement, surveiller les erreurs `42501` dans les journaux : une tâche planifiée qui appellerait ces fonctions via l'API REST avec la clé `anon` échouerait.

Retour arrière : `GRANT EXECUTE ON FUNCTION public.apply_commission_payment(uuid, numeric, text, uuid, text, text) TO authenticated;` rétablit l'appel direct par les fondateurs (la garde interne du hotfix reste active).

## 6. Audit des accès passés (à faire en parallèle)

Les failles étaient actives avant le correctif. Dans les journaux de l'API Supabase de la production, rechercher :
- les appels `rpc/apply_commission_payment` et `rpc/apply_shop_subscription` qui ne viennent pas de vos edge functions ;
- des écritures inattendues sur les tables `corporate_*` ;
- dans `commission_payments`, des lignes sans paiement GeniusPay associé.

## 7. Retour arrière

Le plus sûr : restaurer le snapshot. Un retour arrière ciblé remet les failles en place, il ne doit servir qu'à rétablir temporairement un flux bloqué à tort.

```sql
-- Rouvrir les droits (rétablit la faille)
GRANT EXECUTE ON FUNCTION public.apply_commission_payment(uuid, numeric, text, uuid, text, text) TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_shop_subscription(uuid, uuid, text, numeric, text, text) TO PUBLIC, anon, authenticated;
```

Pour retirer la garde de `apply_commission_payment`, réexécuter la définition de la migration `20260701091528_fe65ae6e-2a3c-4adf-9ff0-fe9f5aeca17f.sql` (fonction `apply_commission_payment`, section 6). Pour les politiques `corporate_*`, recréer celles de `20260901000000_corporate_governance_system.sql` (lignes 278 à 307).

## 8. Limites connues et suite

- **Vérifié sur dev le 12/10/2026 :** avant les compléments, `anon` pouvait encore exécuter `apply_shop_activation`, `prepare_shop_activation_payment`, `check_rate_limit` et 15 fonctions serveur. Le hotfix seul ne suffit donc pas : appliquer aussi `130000`, `140000`, `150000` (section 5.4).
- **`user_roles` :** la politique `user_roles_manage_policy` provoque une récursion (HTTP 500) pour toute lecture ou écriture d'un utilisateur connecté. Correctif : `20261012160000_fix_user_roles_rls_recursion.sql` (appliqué sur dev).

- `corporate_audit_logs` et `corporate_document_acceptances` restaient ouverts en insertion à tout utilisateur connecté, et modifiables par les fondateurs. **Corrigé dans le code** par `20261015150000_h2_corporate_audit_append_only.sql` (à appliquer après `20261012120000`) : insertion au nom de l'appelant (`user_id = auth.uid()` et e-mail du JWT) ou par un fondateur, aucune politique UPDATE ni DELETE. Test : `supabase/tests/h2_corporate_8_tables.sql` (121 cas sur 121 en base jetable ; 17 échecs attendus sans la migration). Le front (`CorporateOnboardingPage.tsx`) écrit désormais avec l'identité de la session. **Non déployé.**
- La garde accepte les connexions directes à la base (`session_user` `postgres` ou `supabase_admin`) : sans effet sur l'API (rôle `authenticator`), mais cela rend les tests par simulation de rôle en SQL non fiables. Tester par HTTP.
- `corporate_invitations` (migration `20260906000000`, pas encore déployée) est ouverte à tous, y compris `anon` : à revoir avant tout déploiement.
- `strict_multitenant_privacy` (`20260902140000`, pas encore déployée) ne supprime pas les politiques `Allow authenticated view…` (mauvais nom), a un e-mail codé en dur et dépend de `profiles.is_admin` : à corriger avant déploiement.
- C1 (portefeuille Ecomfy Pay) est corrigé dans la migration d'origine `20260914190000` et validé en local (annexe D de l'audit), mais pas déployé. C4 (KYC) est corrigé de la même façon (voir `docs/KYC-REVUE-ET-DEPLOIEMENT-C4.md`, avec la procédure de production et les prérequis C5, C6, `payment_links`). Les migrations d'affiliation et de facturation par seuil contiennent encore des fonctions ouvertes (groupe B de l'annexe F.3 de l'audit) : ne pas les déployer avant correction.
- Les autres constats de l'audit (webhooks, rôles fondateur, XSS, cron, e-mails) ne sont pas traités par ce hotfix ; le KYC (C4) l'est dans les migrations Ecomfy Pay, pas dans ce hotfix.
