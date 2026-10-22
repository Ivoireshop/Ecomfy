# Ecomfy Pay — schéma du ledger (`wallet_ledger`)

Migration : `supabase/migrations/20261022140000_ecomfy_pay_ledger_schema.sql` (non appliquée — dev puis prod à faire).

## Colonnes

| Colonne | Type | Rôle |
|---|---|---|
| `id` | uuid PK | identifiant |
| `entry_seq` | bigint identity, unique | ordre strict (`created_at` est identique pour un lot de règlements) |
| `wallet_id`, `merchant_id` | uuid | portefeuille et marchand |
| `entry_type` | text (CHECK) | `PAYMENT_PENDING`, `SETTLEMENT_AVAILABLE`, `WITHDRAWAL_REQUESTED`, `WITHDRAWAL_COMPLETED`, `WITHDRAWAL_FAILED`, `REFUND`, `ADJUSTMENT` |
| **`amount`** | numeric(12,2), ≠ 0 | signé : + crédit, − débit |
| `direction` | text généré | `CREDIT` / `DEBIT` d'après le signe |
| **`currency`** | text | `XOF` par défaut |
| `balance_type` | text (CHECK) | solde touché : `PENDING` / `AVAILABLE` |
| `running_pending_balance`, `running_available_balance` | numeric, ≥ 0 | soldes après l'écriture |
| **`internal_reference`** | text | `ECM-PAY-…` (paiement) ou `ECM-WDR-…` (retrait) |
| `provider_reference`, `provider` | text | référence et prestataire (GeniusPay, …) |
| **`operator`** | text | `orange_money`, `mtn`, `wave`, `moov`, `card` (= `ecomfy_payments.payment_method`) |
| **`shop_id`** | uuid | boutique |
| **`order_id`**, `order_number` | uuid, text | commande (numéro figé à l'écriture) |
| `payment_id`, `settlement_id`, `withdrawal_id` | uuid | rattachements |
| `gross_amount`, `fee_provider`, `fee_ecomfy` | numeric | brut et frais du paiement (`amount` = net marchand) |
| `is_sandbox` | boolean | paiement de test |
| `reference_id` | text | ancienne référence libre, conservée |
| `description`, `metadata`, `created_at` | | libellé, extension, horodatage |

Les rattachements n'ont **pas de clé étrangère** : le registre survit à la suppression d'une commande, d'une boutique ou d'un paiement.

## Garanties

- **Rattachement automatique** : trigger `BEFORE INSERT` qui déduit paiement, commande, boutique, opérateur et frais depuis `reference_id`. Les trois fonctions financières ne sont pas modifiées.
- **Idempotence** : un seul `PAYMENT_PENDING` et un seul `SETTLEMENT_AVAILABLE` par paiement ; une seule écriture de chaque type par retrait.
- **Immuabilité** : `UPDATE`, `TRUNCATE` et `DELETE` direct refusés (même pour `service_role`). Correction = écriture inverse. La suppression en cascade d'un compte reste possible.
- **Droits** : marchands en lecture seule (RLS « Merchants view own ledger » inchangée), plus aucun `INSERT/UPDATE/DELETE` pour `anon`/`authenticated`.

## Écritures de fin de vie (ajoutées par la même migration)

| Fonction (service_role uniquement) | Effet |
|---|---|
| `finalize_withdrawal(ref, 'SUCCEEDED')` | `WITHDRAWAL_COMPLETED`, montant 0 (le solde a été débité à la demande), `gross_amount` = montant versé |
| `finalize_withdrawal(ref, 'FAILED', motif)` | `WITHDRAWAL_FAILED`, +montant : retour au solde disponible, `total_withdrawn` décrémenté |
| `refund_merchant_payment(paiement, montant net, motif, clé)` | `REFUND`, −montant ; prélevé sur le solde en attente si le règlement n'est pas libéré (le règlement ne libère plus que le reste, `REVERSED` si tout est remboursé), sinon sur le disponible (refus si déjà retiré) ; paiement `REFUNDED` au remboursement final ; une même clé ne rembourse qu'une fois |

Les retraits portent leur opérateur : `withdrawal_requests.payout_operator` (`wave`, `orange_money`, `mtn`, `moov`), choisi dans la fenêtre de retrait.

## Branchements

- `ecomfy-pay-withdraw` : transmet l'opérateur ; sur refus définitif du prestataire (HTTP 4xx au dispatch), appelle `finalize_withdrawal(..., 'FAILED')`. Une erreur réseau ou 5xx laisse le retrait en `REQUESTED`.
- `ecomfy-pay-webhook` : les événements `payout.*`, `withdrawal.*` et `transfer.*` (signature vérifiée comme les autres) appellent `finalize_withdrawal`. **Les noms d'événements et la forme de la charge utile sont supposés** : aucune documentation du payout GeniusPay n'est dans le dépôt, à confirmer avant la production.
- `refund_merchant_payment` n'a pas encore d'appelant (aucun écran, aucune fonction d'administration) : à brancher quand le remboursement chez le prestataire existera.

## Limites connues

- Le passage de la commande liée à `REFUNDED` n'est pas fait (`orders.payment_status` mélange `PAID` / `pending`).
- La liste du portefeuille est triée par `entry_seq` : le front exige la migration.
