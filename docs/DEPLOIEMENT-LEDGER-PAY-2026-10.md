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

1. **Migration** `20261022140000` (section 3).
2. **Migration** `20261022150000` (section 9, audit M4), si le système de facturation est déjà en production.
3. **Migration** `20261023100000` (section 10, audit M6).
4. **Edge Functions** `ecomfy-pay-withdraw`, `ecomfy-pay-webhook`, `ecomfy-pay-settlement`, puis `ecomfy-pay-initiate` (sections 4, 9 et 10).
5. **Front** (branche `jeanmarc`).

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
npx supabase@latest functions deploy ecomfy-pay-initiate --project-ref $P --use-api   # audit M4, section 9
```

`--use-api` est nécessaire sous Windows (le bundling Docker échoue). Vérification sans JWT (attendu 401 pour `ecomfy-pay-withdraw`, 401 pour le webhook sans signature) :

```powershell
foreach ($f in "ecomfy-pay-withdraw","ecomfy-pay-webhook") {   # ecomfy-pay-initiate : voir section 9
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
| Dev | Appliquée le 22/10 (+ partie retrait de `20261022150000`) ; `20261023100000` appliquée le 23/10 (section 10) | Déployées le 22/10 ; webhook, settlement et initiate redéployées le 23/10 | Local seulement ; checkout, liens et portefeuille testés dans le navigateur (sections 9 et 10) |
| Production | **Non** (Ecomfy Pay absent, section 0) | Non | Non |

## 9. Références non devinables et checkout réel (audit M4, 22/10/2026)

**Fichier :** `supabase/migrations/20261022150000_references_non_devinables.sql`, à appliquer **après** `20261022140000`. Ne pas utiliser `db push`.

| Changement | Détail |
|---|---|
| Références générées par le serveur | `ECM-PAY-`, `ECM-WDR-`, `BILL-ECOMFY-`, `PAY-ECOMFY-` : 12 caractères hexadécimaux issus de `crypto.randomUUID()` / `gen_random_uuid()` (avant : `Math.random()`, `random()` ou MD5 de `random()`, 8 caractères ou 900 000 valeurs). |
| Fonctions recréées | `request_wallet_withdrawal_atomic`, `check_and_trigger_billing_threshold`, `confirm_invoice_payment` (corps identiques, seule la référence change ; droits conservés). |
| Edge Function | `ecomfy-pay-initiate` à redéployer. |
| Front | `EcomfyPayCheckout` n'écrit plus de paiement `SUCCEEDED` depuis le navigateur : il appelle `ecomfy-pay-initiate` (montant relu en base), redirige vers la page de l'opérateur ou affiche « paiement en cours de traitement ». Plus de quantité ni de remise simulée : le serveur n'accepte que le montant du lien (ou plus, si la saisie libre est activée). `PaymentLinksTab` ne crée plus de boutique incomplète : sans boutique, il renvoie vers « Boutique ». |

### 9.1 Appliquer (production)

**Projet :** `yfggrceynzcwklbxhgix`. **Ne jamais utiliser `supabase db push`** (il pousserait aussi les autres migrations en attente). Prérequis : `20261022140000` déjà appliquée (la migration recrée `request_wallet_withdrawal_atomic` dans sa version à `p_payout_operator`).

**Les trois fonctions de facturation n'existent que si le système de facturation est déployé** (table `shop_invoices`, migration `20260909100000`). Sur une base sans ce système (c'est le cas de dev), `CREATE OR REPLACE` créerait deux fonctions orphelines : n'y appliquer que la partie « 3. Demande de retrait » (à partir de la ligne du commentaire `-- 3.`).

Avant, en lecture seule, pour savoir quel cas s'applique :

```sql
select to_regclass('public.shop_invoices') as facturation,   -- null = absent : appliquer la partie 3 seulement
       to_regprocedure('public.request_wallet_withdrawal_atomic(numeric,text,text,text,text,text,text)') as retrait;  -- doit exister
```

Base complète (facturation + ledger) :

```powershell
npx supabase db query --linked -f supabase/migrations/20261022150000_references_non_devinables.sql
```

(vérifier avant que le projet lié est bien `yfggrceynzcwklbxhgix` : `npx supabase projects list`, colonne « linked »).

Base sans facturation :

```powershell
$sql = Get-Content -Encoding UTF8 supabase/migrations/20261022150000_references_non_devinables.sql
$i = ($sql | Select-String -Pattern '^-- 3\.').LineNumber - 1
$sql[$i..($sql.Count-1)] | Set-Content $env:TEMP\m4_retrait.sql -Encoding utf8
npx supabase db query --linked -f $env:TEMP\m4_retrait.sql
```

Puis l'Edge Function et le front :

```powershell
npx supabase@latest functions deploy ecomfy-pay-initiate --project-ref yfggrceynzcwklbxhgix --use-api
```

Front : déployer la branche `jeanmarc` (Vercel). Le nouveau front appelle `ecomfy-pay-initiate` : **déployer la fonction avant le front**, sinon le checkout d'un lien de paiement échouera (l'ancienne fonction convient aussi, elle ne diffère que par la référence).

### 9.2 Vérifier (lecture seule)

```sql
select p.proname, pg_get_functiondef(p.oid) ~ 'gen_random_uuid' as uuid_ok, pg_get_functiondef(p.oid) ~* 'random\(\)' as random_restant
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('request_wallet_withdrawal_atomic','check_and_trigger_billing_threshold','confirm_invoice_payment');
-- attendu : uuid_ok = true et random_restant = false pour chaque fonction présente
```

Dans le navigateur : ouvrir un lien `/pay/<clé>` d'une boutique ; payer le montant du lien. Attendu : redirection vers l'opérateur (clés GeniusPay présentes) et une ligne `ecomfy_payments` en `PENDING` avec une référence `ECM-PAY-` suivie de 12 caractères hexadécimaux. Un montant différent du lien, appelé directement sur la fonction, doit renvoyer 400 « Le montant ne correspond pas au lien ».

### 9.3 Retour arrière

- Front : redéployer la version précédente.
- Fonctions SQL : rejouer les versions précédentes (`20260912000000` pour `check_and_trigger_billing_threshold`, `20260911120000` pour `confirm_invoice_payment`, bloc `request_wallet_withdrawal_atomic` de `20261022140000`). Les références déjà émises restent valides : le format change, pas les colonnes.
- Edge Function : redéployer l'ancienne version de `ecomfy-pay-initiate`.

**Tests faits sur dev le 22/10 :**
- `supabase/tests/ecomfy_pay_ledger.sql` : 0 échec (référence de retrait à 12 caractères) ;
- fonctions de facturation, dans une transaction annulée (tables absentes créées dans la transaction, 240 commandes) : 10 contrôles, 0 échec ;
- `ecomfy-pay-initiate` déployée : `ECM-PAY-…` de 12 caractères, montant falsifié refusé (400) ;
- navigateur (Chrome, utilisateur et boutique de test créés puis supprimés) : création de lien, paiement sur lien à montant fixe enregistré en `PENDING`, cas sans boutique (message clair, aucune création).

**Reste à brancher :** sans clés `GENIUSPAY_API_KEY` / `GENIUSPAY_API_SECRET` (cas de dev), `ecomfy-pay-initiate` renvoie un succès sans `checkout_url` et le paiement reste `PENDING` ; en production, le client est redirigé vers l'opérateur.

## 10. Paiement → commande → crédit en une transaction, rejouable (audit M6, 23/10/2026)

**Fichier :** `supabase/migrations/20261023100000_ecomfy_pay_confirm_transaction.sql`, à appliquer **après** `20261022140000` (le ledger enrichit les écritures du crédit). Ne pas utiliser `db push`.

**Le défaut corrigé.** Le webhook faisait trois écritures séparées : paiement `SUCCEEDED`, commande `PAID`, crédit du portefeuille. Si le crédit échouait, l'erreur était seulement journalisée et le webhook acquitté ; le paiement étant déjà `SUCCEEDED`, plus aucun rejeu ne le reprenait : **argent encaissé, marchand jamais crédité**. L'événement était aussi inscrit dans `payment_events` *avant* le traitement : la nouvelle tentative du prestataire était écartée comme doublon. Enfin tout événement qui n'était pas un succès (« créé », « en cours »…) faisait passer le paiement à `FAILED`.

| Élément | Comportement |
|---|---|
| `confirm_ecomfy_payment(...)` (`service_role`) | Verrouille le paiement, contrôle montant et devise (C6, tolérance 1 FCFA), puis paiement `SUCCEEDED` + commande `paid` + crédit en attente **dans la même transaction** : tout ou rien. Chaque étape est idempotente (`updated` / `already` / `none` / `done` / `blocked`) : rappeler la fonction termine ce qui manque et ne crédite jamais deux fois (verrou, `settlements.payment_id`, index unique du ledger). |
| Erreur en cours de route | Rien n'a bougé (paiement resté `PENDING`), l'erreur est inscrite dans `payment_events` (`processing_status = 'ERROR'`), le webhook répond **500** : le prestataire réessaie et la même livraison est retraitée. |
| Portefeuille gelé | L'encaissement reste acquis (paiement `SUCCEEDED`, commande `paid`), le crédit est `blocked` (`CREDIT_BLOCKED`), le webhook répond 200 ; le balayage crédite après le dégel. |
| Échec (`p_outcome = 'FAILED'`) | Ne touche que `CREATED` / `PENDING` / `PROCESSING`. Un échec tardif ou rejoué ne défait jamais un paiement encaissé. Un succès tardif après `FAILED` est encaissé et crédité. |
| `replay_incomplete_ecomfy_payments(limite)` (`service_role`) | Reprend tout paiement `SUCCEEDED` sans règlement ou dont la commande n'est pas payée (y compris les états laissés par l'ancien webhook). Retourne `examined / completed / blocked / failed`. |
| `payment_events` | `processing_status` : `PROCESSED`, `AMOUNT_MISMATCH`, `PAYMENT_NOT_FOUND`, `ERROR`, `CREDIT_BLOCKED`. L'état d'un événement est mis à jour à chaque rejeu. |
| Commande | `payment_status` s'écrit désormais **`paid`** en minuscules (valeur lue par `mcp`, `reconcile-tracking`, résumé hebdomadaire). Le `PAID` majuscule de l'ancien webhook n'était lu par personne. La migration rattrape les commandes déjà en `PAID` et liées à un paiement Ecomfy Pay. |

**Edge Functions.**
- `ecomfy-pay-webhook` : appelle `confirm_ecomfy_payment` ; n'envoie l'e-mail au vendeur que lorsque ce traitement vient de créditer ; ignore les événements intermédiaires. Les événements de payout ne sont plus écartés si `finalize_withdrawal` échoue (la ligne d'événement est retirée avant le 500, sinon la nouvelle tentative était ignorée).
- `ecomfy-pay-settlement` : **exige désormais** la clé de service (`Authorization: Bearer`) ou `x-cron-secret` (`isAuthorizedCron`), comme les autres fonctions de planification. **Tout appelant actuel sans autorisation recevra 401** : vérifier le planificateur (pg_cron / `invoke_edge_function`) avant de déployer. Elle rejoue d'abord les paiements incomplets, puis libère les règlements échus.
- `ecomfy-pay-initiate` : l'annulation d'une commande dont le prestataire n'a pas répondu ignore aussi `paid` en minuscules.

```powershell
$P = "yfggrceynzcwklbxhgix"
npx supabase db query --linked -f supabase/migrations/20261023100000_ecomfy_pay_confirm_transaction.sql   # vérifier le projet lié avant
npx supabase@latest functions deploy ecomfy-pay-webhook    --project-ref $P --use-api
npx supabase@latest functions deploy ecomfy-pay-settlement --project-ref $P --use-api
npx supabase@latest functions deploy ecomfy-pay-initiate   --project-ref $P --use-api
```

**Vérifier (lecture seule) :**

```sql
select has_function_privilege('anon','public.confirm_ecomfy_payment(text,text,text,numeric,text,text,text,jsonb,text)','execute') a,
       has_function_privilege('authenticated','public.replay_incomplete_ecomfy_payments(int)','execute') b,
       has_function_privilege('service_role','public.confirm_ecomfy_payment(text,text,text,numeric,text,text,text,jsonb,text)','execute') c;   -- false, false, true
-- paiements encaissés mais sans règlement (attendu 0 après un passage de ecomfy-pay-settlement)
select p.internal_reference, p.status from ecomfy_payments p left join settlements s on s.payment_id = p.id
where p.status = 'SUCCEEDED' and s.id is null;
-- livraisons en erreur, crédit bloqué ou montant refusé
select event_id, processing_status, error_message, created_at from payment_events
where processing_status in ('ERROR','CREDIT_BLOCKED','AMOUNT_MISMATCH') order by created_at desc;
```

Sans autorisation, `ecomfy-pay-settlement` doit répondre 401 ; avec la clé de service, 200 et un champ `replay`.

**Rejeu manuel** d'un paiement précis (éditeur SQL, rôle `postgres` ou `service_role`) : `select public.confirm_ecomfy_payment(p_internal_reference := 'ECM-PAY-XXXXXXXXXXXX');` (sans montant distant, accepté seulement si le paiement est déjà `SUCCEEDED`). Un paiement resté `PENDING` dont le webhook n'est jamais arrivé n'est **pas** repris automatiquement : il n'y a pas encore de relecture de l'état chez GeniusPay pour `ecomfy_payments` (limite connue).

**Test :** `supabase/tests/ecomfy_pay_confirm.sql` (36 contrôles : succès, rejeu, montant et devise, panne simulée au règlement puis rejeu, portefeuille gelé puis dégel, état hérité, échecs, droits). Dev uniquement ; se termine par une exception qui annule tout ; attendu `(0 échecs)`. Passé sur dev le 23/10/2026 : 0 échec.

**Parcours navigateur sur dev (23/10/2026).** Lien `/pay/…` → paiement `PENDING` (`ecomfy-pay-initiate`) ; faux montant refusé ; confirmation → paiement `SUCCEEDED`, crédit en attente de 97,5 % du montant (frais Ecomfy 2,5 %) ; tableau de bord et onglet Wallet du marchand affichent le solde en attente et une seule écriture au registre ; rejeu de la même livraison : crédit « déjà fait », aucune seconde écriture. **Non testé de bout en bout : le webhook lui-même** (dev n'a ni clés GeniusPay ni `GENIUSPAY_WEBHOOK_SECRET`, il répond 500 sans secret) ; la livraison a été simulée en appelant `confirm_ecomfy_payment`. Le chemin avec commande liée n'est couvert que par le test SQL.

**Retour arrière.** Redéployer l'ancien `ecomfy-pay-webhook` suffit (il n'appelle pas les fonctions ajoutées ; les commandes écrites `paid` restent valides). Suppression possible : `drop function public.replay_incomplete_ecomfy_payments(int); drop function public.confirm_ecomfy_payment(text,text,text,numeric,text,text,text,jsonb,text); drop function public.ecomfy_log_payment_event(text,text,uuid,jsonb,text,text);`.

| Environnement | Migration | Edge Functions |
|---|---|---|
| Dev | Appliquée le 23/10 ; test 0 échec | Déployées le 23/10 (`ecomfy-pay-settlement` répond 401 sans autorisation) |
| Production | Non (Ecomfy Pay absent, section 0) | Non |

### 10.1 Checklist production (dans l'ordre)

1. **Prérequis** : vague 2 d'Ecomfy Pay en production (section 0), puis `20261022140000` et, si le système de facturation est déployé, `20261022150000` (section 9). `20261023100000` n'a besoin que des tables Ecomfy Pay et de `credit_merchant_wallet_pending`.
2. **Planificateur de `ecomfy-pay-settlement`** : la fonction exige maintenant la clé de service ou `x-cron-secret`. Avant de la déployer, repérer qui l'appelle (pg_cron, `invoke_edge_function`, planificateur externe) et lui faire envoyer `Authorization: Bearer <clé de service>` (ou `x-cron-secret` = `CRON_SECRET`, déjà défini en production depuis le 14/10). Aucune planification de cette fonction n'existe dans les migrations du dépôt : s'il n'y en a pas en production, en créer une (toutes les 5 à 15 minutes) ; sans elle, ni le rejeu ni la libération des règlements à 72 h ne tournent.
3. **Sauvegarde** puis, en lecture seule, état de départ :
   ```sql
   select count(*) filter (where p.status='SUCCEEDED' and s.id is null) as encaisses_sans_reglement,
          count(*) filter (where o.payment_status = 'PAID') as commandes_PAID_majuscules
   from ecomfy_payments p left join settlements s on s.payment_id = p.id left join orders o on o.id = p.order_id;
   ```
   Sur une base où Ecomfy Pay vient d'être déployé, les deux valeurs doivent être 0. Sinon : le premier passage du balayage créditera ces paiements (c'est voulu) ; la migration passe aussi les `PAID` en `paid`.
4. **Migration** `20261023100000` (commande de la section 10, après avoir vérifié le projet lié `yfggrceynzcwklbxhgix`). Ne pas lancer `supabase/tests/ecomfy_pay_confirm.sql` en production.
5. **Edge Functions** dans cet ordre : `ecomfy-pay-webhook`, `ecomfy-pay-settlement`, `ecomfy-pay-initiate`. Déployer le webhook **après** la migration : l'ancien webhook reste compatible avec la nouvelle base, mais le nouveau échoue (500, donc réessayé par GeniusPay) tant que `confirm_ecomfy_payment` n'existe pas.
6. **Vérifications** : requêtes de lecture de la section 10 ; `ecomfy-pay-settlement` sans autorisation → 401, avec la clé de service → 200 avec le champ `replay` ; `ecomfy-pay-webhook` sans signature → 401.
7. **Premier vrai paiement** (petit montant) : suivre la ligne `payment_events` (`PROCESSED`), le paiement (`SUCCEEDED`), la commande (`paid`) et l'écriture `PAYMENT_PENDING` du ledger. C'est le seul test du webhook de bout en bout (`GENIUSPAY_WEBHOOK_SECRET`, `GENIUSPAY_API_KEY`, `GENIUSPAY_API_SECRET` doivent être définis ; sans eux le webhook répond 500 / 503 et GeniusPay réessaie).
8. **Surveillance** les premiers jours : `payment_events` en `ERROR` ou `CREDIT_BLOCKED`, et la requête « encaissés sans règlement » (attendu 0 après un passage du balayage).

**Retour arrière** : voir plus haut ; redéployer l'ancien `ecomfy-pay-webhook` (et, si le planificateur ne peut pas être adapté, l'ancien `ecomfy-pay-settlement`) suffit.
