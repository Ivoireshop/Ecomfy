# Hotfix sécurité d'octobre 2026 : déploiement et tests

**Migration :** `supabase/migrations/20261012120000_hotfix_security_billing_rpc_and_corporate_rls.sql`
**Constats traités :** C2 (en partie : `apply_commission_payment`, `apply_shop_subscription`) et H2 (tables `corporate_*`), voir `AUDIT-PROJET-2026-10.md`.
**État :** appliqué et validé sur la base de dev (copie de la production). **Pas encore appliqué en production.**

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

- `corporate_audit_logs` et `corporate_document_acceptances` restent ouverts en insertion à tout utilisateur connecté (onboarding). Un marchand peut y écrire de fausses lignes ; à restreindre (`user_id = auth.uid()` ou e-mail du JWT).
- La garde accepte les connexions directes à la base (`session_user` `postgres` ou `supabase_admin`) : sans effet sur l'API (rôle `authenticator`), mais cela rend les tests par simulation de rôle en SQL non fiables. Tester par HTTP.
- `corporate_invitations` (migration `20260906000000`, pas encore déployée) est ouverte à tous, y compris `anon` : à revoir avant tout déploiement.
- `strict_multitenant_privacy` (`20260902140000`, pas encore déployée) ne supprime pas les politiques `Allow authenticated view…` (mauvais nom), a un e-mail codé en dur et dépend de `profiles.is_admin` : à corriger avant déploiement.
- Les migrations Ecomfy Pay, affiliation et facturation par seuil contiennent les failles C1, C3 et C4 : ne pas les déployer avant correction (annexe C de l'audit).
- Les autres constats de l'audit (webhooks, rôles fondateur, XSS, KYC, cron, e-mails) ne sont pas traités par ce hotfix.
