# Déploiement — ledger Ecomfy Pay (22/10/2026)

**Projet prod :** `yfggrceynzcwklbxhgix`. **Branche :** `jeanmarc`. **Ne jamais utiliser `supabase db push`** : il pousserait toutes les migrations en attente. Appliquer uniquement le fichier ci-dessous.

**Fichier :** `supabase/migrations/20261022140000_ecomfy_pay_ledger_schema.sql`. Appliqué sur dev `xfpbpxncserliskrbaim` le 22/10 ; rejoué avant cela dans une transaction annulée avec 33 contrôles (0 échec). Schéma : `docs/ECOMFY-PAY-LEDGER-SCHEMA-2026-10.md`.

## 0. Prérequis bloquant : Ecomfy Pay n'est pas en production

Au 22/10, `wallets`, `wallet_ledger`, `ecomfy_payments`, `settlements` et `withdrawal_requests` **n'existent pas** en production (vague 2, `docs/DEPLOIEMENT-PROD-2026-10.md` section 7). Cette migration étend ces tables : elle échoue sans elles. Elle se déploie donc **avec ou après** la vague 2, jamais avant. Si la vague 2 est livrée, l'appliquer juste après `20260914200000` et `20261018130000`.

Les prérequis de la vague 2 (C5 secret du webhook, C6 montants serveur, revue KYC) restent à lever avant d'ouvrir le portefeuille ; ils ne sont pas couverts ici.

## 1. Ce que fait la migration

| Bloc | Effet |
|---|---|
| Colonnes de `wallet_ledger` | `internal_reference`, `provider`, `provider_reference`, `operator`, `payment_id`, `settlement_id`, `withdrawal_id`, `order_id`, `order_number`, `shop_id`, `gross_amount`, `fee_provider`, `fee_ecomfy`, `is_sandbox`, `metadata`, `entry_seq`, `direction` (généré) |
| Rattachement | remplit les écritures existantes ; trigger `wallet_ledger_enrich` (BEFORE INSERT) pour les nouvelles, sans toucher `credit_merchant_wallet_pending` ni `process_wallet_settlements` |
| Contraintes | CHECK `entry_type`, `balance_type`, montant ≠ 0 (sauf `WITHDRAWAL_COMPLETED`), soldes courants ≥ 0 (en `NOT VALID`, donc sans bloquer l'existant) ; index uniques d'idempotence |
| Immuabilité | `UPDATE`, `DELETE` direct et `TRUNCATE` refusés, même pour `service_role` ; la suppression en cascade d'un compte reste possible ; plus aucun `INSERT/UPDATE/DELETE` pour `anon` / `authenticated` |
| Retraits | `withdrawal_requests.payout_operator` ; `request_wallet_withdrawal_atomic` passe à **7 paramètres** (l'ancienne signature à 6 est supprimée, le nouveau paramètre est facultatif) |
| `finalize_withdrawal` | clôture un retrait (`SUCCEEDED` / `FAILED`, recrédit si échec), `service_role` uniquement |
| `refund_merchant_payment` | remboursement total ou partiel, idempotent par clé, `service_role` uniquement, **sans appelant pour l'instant** |

**Rien n'est supprimé** hors l'ancienne signature de `request_wallet_withdrawal_atomic`. Le fichier est rejouable (colonnes, index, triggers et contraintes sont gardés par `IF NOT EXISTS` / `DROP … IF EXISTS`), sauf que rejouer après des écritures réelles ne modifie pas ces écritures (l'immuabilité bloque `UPDATE` ; le rattachement ne touche que les lignes sans `payment_id`).

## 2. Ordre de déploiement

1. **Migration** (section 3).
2. **Edge Functions** `ecomfy-pay-withdraw` puis `ecomfy-pay-webhook` (section 4).
3. **Front** (branche `jeanmarc`).

Pourquoi migration d'abord : le nouveau front trie le ledger par `entry_seq` et la fenêtre de retrait envoie `p_payout_operator`. Avec l'ancienne base, la liste du portefeuille serait vide (colonne inconnue) et les retraits échoueraient (paramètre inconnu). **L'ancien front et les anciennes fonctions restent compatibles avec la nouvelle base** : le paramètre ajouté est facultatif et les nouvelles colonnes sont nullables ou ont une valeur par défaut.

## 3. Migration

### 3.1 Avant (lecture seule, éditeur SQL de la production)

```bash
cat supabase/.temp/project-ref        # doit afficher yfggrceynzcwklbxhgix
```

```sql
-- Prérequis : 5 tables présentes, ancienne signature à 6 paramètres, fonctions financières présentes
select to_regclass('public.wallets') w, to_regclass('public.wallet_ledger') l, to_regclass('public.ecomfy_payments') p,
       to_regclass('public.settlements') s, to_regclass('public.withdrawal_requests') r, to_regclass('public.orders') o;   -- aucun NULL
select p.oid::regprocedure from pg_proc p where pronamespace = 'public'::regnamespace
  and proname in ('request_wallet_withdrawal_atomic','credit_merchant_wallet_pending','process_wallet_settlements','get_or_create_merchant_wallet');  -- 4 lignes
select count(*) as ecritures, count(*) filter (where running_pending_balance < 0 or running_available_balance < 0) as soldes_negatifs,
       count(*) filter (where amount = 0) as montants_nuls
  from public.wallet_ledger;                                       -- soldes_negatifs et montants_nuls : informatif (NOT VALID, ne bloque pas)
select count(*) from public.withdrawal_requests where status in ('REQUESTED','PROCESSING');   -- retraits en cours : voir 3.4
```

Prendre une sauvegarde / un point de restauration avant (le ledger devient immuable : une erreur ne se corrige plus par `UPDATE`).

### 3.2 Appliquer

Coller le fichier **en entier** dans l'éditeur SQL (une seule transaction) ou :

```bash
supabase db query --linked -f supabase/migrations/20261022140000_ecomfy_pay_ledger_schema.sql
```

Si le projet lié n'est pas la production, ajouter `--project-ref yfggrceynzcwklbxhgix` et vérifier deux fois. Ne pas utiliser `db push`.

### 3.3 Après (lecture seule)

```sql
select count(*) as colonnes from information_schema.columns where table_schema='public' and table_name='wallet_ledger';   -- 29
select count(*) as triggers from pg_trigger where tgrelid = 'public.wallet_ledger'::regclass and not tgisinternal;          -- 3
select p.oid::regprocedure from pg_proc p where pronamespace='public'::regnamespace
  and proname in ('request_wallet_withdrawal_atomic','finalize_withdrawal','refund_merchant_payment');                       -- 3 lignes, request_… à 7 paramètres
select count(*) filter (where payment_id is null and entry_type in ('PAYMENT_PENDING','SETTLEMENT_AVAILABLE')) as paiements_non_rattaches,
       count(*) filter (where withdrawal_id is null and entry_type like 'WITHDRAWAL\_%') as retraits_non_rattaches
  from public.wallet_ledger;                                       -- attendu 0 et 0
select has_function_privilege('anon','public.finalize_withdrawal(text,text,text,text)','execute') a,
       has_function_privilege('authenticated','public.refund_merchant_payment(uuid,numeric,text,text)','execute') b,
       has_table_privilege('authenticated','public.wallet_ledger','insert') c;                                               -- false, false, false
```

Test de comportement : `supabase/tests/ecomfy_pay_ledger.sql` (33 contrôles : rattachement, doublons, remboursements, retraits, immuabilité, droits). Il crée des paiements factices puis se termine par une exception qui annule tout ; attendu `(0 échecs)`. **Dev uniquement** : il écrit dans le ledger et active temporairement les retraits dans sa transaction ; en production, ne pas le lancer (le jeu d'essai ne pourrait pas être nettoyé si l'exception n'était pas atteinte, le ledger étant immuable).

### 3.4 Retraits en cours au moment du déploiement

Un retrait `REQUESTED` / `PROCESSING` créé avant la migration n'a pas d'opérateur (`payout_operator` NULL) : sans conséquence. Sa fin sera inscrite normalement par `finalize_withdrawal` quand le webhook de payout arrivera.

## 4. Edge Functions

```powershell
$P = "yfggrceynzcwklbxhgix"
npx supabase@latest functions deploy ecomfy-pay-withdraw --project-ref $P --use-api
npx supabase@latest functions deploy ecomfy-pay-webhook  --project-ref $P --use-api
```

`--use-api` est nécessaire sous Windows (le bundling Docker échoue). Vérification sans JWT (attendu 401 pour `ecomfy-pay-withdraw`, 401 pour le webhook sans signature) :

```powershell
foreach ($f in "ecomfy-pay-withdraw","ecomfy-pay-webhook") {
  try { Invoke-WebRequest -Method Post -Uri "https://$P.supabase.co/functions/v1/$f" -ContentType "application/json" -Body "{}" -UseBasicParsing | Out-Null; "$f -> 200" }
  catch { "$f -> $($_.Exception.Response.StatusCode.value__)" }
}
```

### Points à confirmer avec GeniusPay avant d'ouvrir les retraits

- **Noms d'événements de payout** : le webhook traite `payout.*`, `withdrawal.*` et `transfer.*` (succès : `.success`, `.succeeded`, `.completed`, `.paid` ; échec : `.failed`, `.rejected`, `.cancelled`, `.error`). Ces noms et la forme de la charge utile (`data.reference`, `data.id`, `data.status`, `data.failure_reason`) sont **supposés** : aucune documentation du payout n'est dans le dépôt. Les comparer à la documentation GeniusPay ; ajuster l'expression régulière dans `ecomfy-pay-webhook/index.ts` si besoin.
- **Référence renvoyée** : le dispatch envoie `reference = ECM-WDR-…` et stocke `data.reference || data.id` dans `provider_reference`. Le webhook retrouve le retrait par l'une ou l'autre.
- **Abonnement au webhook** : vérifier que l'URL du webhook GeniusPay est abonnée aux événements de payout, et que `GENIUSPAY_WEBHOOK_SECRET` est défini.
- **Refus au dispatch** : un HTTP 4xx de l'API payout recrédite immédiatement le marchand ; un 5xx ou une erreur réseau laisse le retrait en `REQUESTED` (en attente du webhook). Un retrait resté `REQUESTED` sans webhook doit être clôturé à la main (section 6).

## 5. Front

Fichiers : `src/lib/ecomfyPay.ts`, `src/types/ecomfyPay.ts`, `src/components/ecomfy-pay/WalletTab.tsx`, `src/components/ecomfy-pay/WithdrawalModal.tsx`. Déployer après la migration (section 2). Changements visibles : le ledger affiche la référence interne, la commande et l'opérateur ; une écriture « retrait abouti » apparaît à montant nul (« … FCFA versés ») ; la fenêtre de retrait Mobile Money propose Wave / Orange Money / MTN / Moov.

## 6. Exploitation

Clôturer à la main un retrait bloqué (éditeur SQL, rôle `postgres` ou `service_role`) :

```sql
select public.finalize_withdrawal('ECM-WDR-XXXXXXXX', 'SUCCEEDED', null, 'REF-PRESTATAIRE');
select public.finalize_withdrawal('ECM-WDR-XXXXXXXX', 'FAILED', 'motif');   -- recrédite le solde disponible
```

Rembourser un paiement (après le remboursement chez le prestataire ; **aucun écran ni fonction ne l'appelle encore**) :

```sql
select public.refund_merchant_payment('<uuid du paiement>', null, 'motif', 'cle-unique-par-remboursement');   -- null = tout le reste
select public.refund_merchant_payment('<uuid>', 2000, 'remboursement partiel', 'autre-cle');                    -- 2000 = part nette marchand
```

Le montant est la part **nette marchand** (`net_merchant_amount`), prélevée sur le solde en attente tant que le règlement n'est pas libéré, sinon sur le solde disponible (refus « fonds déjà retirés » si insuffisant). La commande liée n'est pas modifiée.

Corriger une erreur de ledger : jamais par `UPDATE` (refusé). Poster une écriture inverse (`ADJUSTMENT`) via une fonction `service_role`. En dernier recours seulement, pour supprimer des lignes de test : `alter table public.wallet_ledger disable trigger wallet_ledger_block_mutation;` … `enable trigger …;` dans une même transaction, rôle `postgres`, en recalculant les soldes de `wallets`.

## 7. Retour arrière

Il n'y a pas de retour arrière propre une fois des écritures réelles inscrites (le ledger est immuable et les nouvelles colonnes servent). Avant toute écriture réelle uniquement :

```sql
begin;
drop trigger if exists wallet_ledger_block_mutation on public.wallet_ledger;
drop trigger if exists wallet_ledger_block_truncate on public.wallet_ledger;
drop trigger if exists wallet_ledger_enrich on public.wallet_ledger;
drop function if exists public.finalize_withdrawal(text, text, text, text);
drop function if exists public.refund_merchant_payment(uuid, numeric, text, text);
drop function if exists public.request_wallet_withdrawal_atomic(numeric, text, text, text, text, text, text);
-- recréer l'ancienne signature : bloc request_wallet_withdrawal_atomic de 20260914190000 (6 paramètres) + ses REVOKE/GRANT
commit;
```

Les colonnes ajoutées peuvent rester : elles sont inoffensives pour l'ancien code. Le plus sûr reste la restauration de la sauvegarde de 3.1.

## 8. État

| Environnement | Migration | Edge Functions | Front |
|---|---|---|---|
| Dev | Appliquée le 22/10 | Déployées le 22/10 | Local seulement ; test navigateur du ledger non fait (connexion à fournir) |
| Production | **Non** (Ecomfy Pay absent, section 0) | Non | Non |
