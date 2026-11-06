# Runbook — réparer le flux de paiement Ecomfy Pay en production

**À exécuter dans l'ordre, en une session.** Complète [DEPLOIEMENT-AIGUILLAGE-WEBHOOK-ECOMFY-PAY-2026-10.md](DEPLOIEMENT-AIGUILLAGE-WEBHOOK-ECOMFY-PAY-2026-10.md) (cause, preuve, correctif : commit `9a19c6a`). Ce document donne les commandes et les requêtes prêtes à coller.

**Projet prod :** `yfggrceynzcwklbxhgix` · **Éditeur SQL :** Dashboard prod → SQL Editor · **Ne jamais utiliser `supabase db push`.**

**Durée :** environ 1 h, dont un paiement réel de test. **Heure :** n'importe laquelle, aucune coupure (une seule fonction change, sans migration). Éviter seulement un pic de commandes.

## Déjà validé en sandbox (dev, 06/11/2026)

Le même enchaînement (redirection GeniusPay → webhook → `SUCCEEDED` → commande payée → écriture au ledger) a été rejoué avec succès sur la dev, avec les clés sandbox. Détail et défauts corrigés dans la dernière section de [DEPLOIEMENT-AIGUILLAGE-WEBHOOK-ECOMFY-PAY-2026-10.md](DEPLOIEMENT-AIGUILLAGE-WEBHOOK-ECOMFY-PAY-2026-10.md). **À retenir pour le paiement réel de test de l'étape 4 :** GeniusPay refuse moins de 200 XOF, et la prod doit aussi recevoir `ecomfy-pay-initiate` (correctif de diagnostic, même fonction partagée `_shared/operators/geniuspay.ts`) en plus de `geniuspay-webhook`.

## Ce qu'on répare

| # | Constat | Action |
|---|---|---|
| 1 | Les webhooks des paiements clients arrivent sur `geniuspay-webhook` et sont ignorés | Déployer l'aiguillage (étape 2) |
| 2 | 1 paiement réellement encaissé (`ECM-PAY-6L3Z341U23`, 10 500 FCFA, 26/10) jamais crédité | Rattrapage (étape 5) |
| 3 | 14 autres paiements `PENDING`, jamais payés | Vérifier chez GeniusPay puis expirer (étape 6) |
| 4 | Rien n'expire jamais dans `ecomfy_payments` | Fonction + tâche planifiée (étape 7) |
| 5 | Webhooks de retrait sur la même URL | Aiguiller avant d'ouvrir les retraits (étape 8) |

## Étape 0 — Avant de commencer

- [ ] Être sur la branche `jeanmarc`, au commit `9a19c6a` ou plus récent : `git log -1 --format=%h`.
- [ ] Le tableau de bord **GeniusPay** est ouvert (liste des transactions + historique des livraisons de webhook).
- [ ] Ouvrir le Dashboard prod → Edge Functions → `geniuspay-webhook` → **Logs** (à garder visible pendant les tests).
- [ ] Noter la version actuelle de `geniuspay-webhook` (Dashboard → Edge Functions → Versions), pour le retour arrière.

## Étape 1 — Pré-contrôle du paiement à rattraper (SQL, lecture seule)

```sql
select p.internal_reference, p.status, p.amount, p.currency, p.provider_reference,
       p.merchant_id, p.shop_id, p.order_id,
       o.order_status, o.payment_status,
       (select count(*) from public.wallet_ledger l where l.payment_id = p.id) as ecritures_ledger
from public.ecomfy_payments p
left join public.orders o on o.id = p.order_id
where p.internal_reference = 'ECM-PAY-6L3Z341U23';
```

Attendu : `status = PENDING`, `amount = 10500`, `ecritures_ledger = 0`, `payment_status = pending`.

Événement d'origine à rejouer (reçu le 26/10 à 21 h 39) :

```sql
select event_id, event_type, reference, amount, currency, created_at
from public.webhook_events
where event_type = 'payment.success'
  and payload->'data'->'metadata'->>'internal_reference' = 'ECM-PAY-6L3Z341U23';
```

Attendu : une seule ligne, `reference = MTX-QPBYZCG36W`, `amount = 10500`, `currency = XOF`.

**Dans GeniusPay**, ouvrir la transaction `MTX-QPBYZCG36W` : statut `completed`, montant 10 500 XOF. **Si ce n'est pas le cas, s'arrêter** : ne rien rattraper.

## Étape 2 — Déployer l'aiguillage

```powershell
$P = "yfggrceynzcwklbxhgix"
npx supabase@latest functions deploy geniuspay-webhook --project-ref $P --use-api
```

Contrôle sans signature (doit répondre 200, `Missing signature headers`) :

```powershell
Invoke-RestMethod -Method Post -Uri "https://$P.supabase.co/functions/v1/geniuspay-webhook" -Body '{}' -ContentType 'application/json'
```

Contrôle d'aiguillage sans signature valide : même appel vers `ecomfy-pay-webhook?provider=geniuspay` → 401 `Unauthorized` (la fonction est atteignable et protégée).

## Étape 3 — Test de non-régression (abonnements)

Le chemin historique doit rester intact. Après le déploiement, surveiller les logs de `geniuspay-webhook` : le prochain webhook d'abonnement, d'activation ou de commission (`MTX-…` sans `ECM-PAY-`) doit produire une ligne `GeniusPay webhook:` et **aucune** ligne `Forwarded to ecomfy-pay-webhook`.

Contrôle SQL ensuite (un événement `payment.success` récent sans lien Ecomfy Pay) :

```sql
select event_type, reference, created_at
from public.webhook_events
where created_at > now() - interval '2 hours'
order by created_at desc;
```

S'il n'y a aucun webhook d'abonnement dans l'heure, ce test est différé à la surveillance (étape 9) : ne pas bloquer la suite.

## Étape 4 — Paiement réel de bout en bout

1. Choisir une boutique de test **vous appartenant**, avec un produit au prix le plus bas, **mode de paiement en ligne** activé.
2. Passer une commande depuis la vitrine publique, payer avec un vrai Mobile Money. Le montant est réellement débité ; il est crédité en attente au portefeuille du marchand (disponible après 72 h).
3. Pendant le paiement, noter la référence `ECM-PAY-…` (visible dans l'URL de retour `payment_ref=`).

Contrôle (remplacer la référence) :

```sql
select p.internal_reference, p.status, p.provider_reference, o.payment_status as commande_payee,
       (select count(*) from public.payment_events e where e.payment_id = p.id) as evenements,
       (select string_agg(l.entry_type || '/' || l.balance_type, ', ') from public.wallet_ledger l where l.payment_id = p.id) as ledger
from public.ecomfy_payments p
left join public.orders o on o.id = p.order_id
where p.internal_reference = 'ECM-PAY-XXXXXXXXXXXX';
```

| Attendu | |
|---|---|
| `status` | `SUCCEEDED` |
| `commande_payee` | `paid` |
| `evenements` | 1 |
| `ledger` | `PAYMENT_PENDING/PENDING` |
| Logs `geniuspay-webhook` | `Forwarded to ecomfy-pay-webhook` avec `status: 200` |

**Si le paiement reste `PENDING` :**
- logs `geniuspay-webhook` : `Forward … failed` ou `status: 401` / `500` → voir le tableau ci-dessous ;
- aucune ligne dans les logs → GeniusPay n'envoie rien (voir son historique de livraisons).

| Symptôme dans les logs | Cause probable | Action |
|---|---|---|
| `status: 500` + `Webhook secret not configured` | `GENIUSPAY_WEBHOOK_SECRET` absent | `npx supabase@latest secrets list --project-ref $P`, poser le secret |
| `status: 401` | Signature refusée par `ecomfy-pay-webhook` | Vérifier que le secret est celui de GeniusPay (même valeur pour les deux fonctions) |
| `status: 503` + `Cannot confirm payment` | GeniusPay ne confirme pas le paiement | Contrôler `GENIUSPAY_API_KEY` / `GENIUSPAY_API_SECRET` |
| `Amount mismatch` dans `payment_events` | Montant encaissé différent | Ne pas forcer ; comparer avec GeniusPay |
| `Forward … failed` (502) | Appel entre fonctions | Relancer ; GeniusPay réessaie |

**Critère d'annulation :** si les abonnements cessent de s'activer après le déploiement (webhook d'abonnement sans ligne `GeniusPay webhook:` dans les logs), revenir en arrière (étape 10).

## Étape 5 — Rattraper `ECM-PAY-6L3Z341U23`

**Une fois l'étape 4 réussie.** La signature de l'ancien événement est périmée (tolérance de 5 minutes) : on ne le rejoue pas par HTTP, on appelle directement la fonction de confirmation, qui fait exactement ce que fait le webhook (montant contrôlé, paiement, commande, crédit, en une transaction, **idempotente**).

Voie A (préférée) : dans GeniusPay, demander le **renvoi** de la livraison de l'événement `payment.success` de `MTX-QPBYZCG36W`, si l'option existe. Il passera par l'aiguillage. Vérifier avec la requête de l'étape 1.

Voie B (si le renvoi n'existe pas), dans l'éditeur SQL :

```sql
select public.confirm_ecomfy_payment(
  p_internal_reference := 'ECM-PAY-6L3Z341U23',
  p_provider_reference := w.reference,
  p_outcome            := 'SUCCEEDED',
  p_remote_amount      := w.amount::numeric,
  p_remote_currency    := w.currency,
  p_event_id           := w.event_id,
  p_event_type         := w.event_type,
  p_payload            := w.payload
) as resultat
from public.webhook_events w
where w.event_type = 'payment.success'
  and w.payload->'data'->'metadata'->>'internal_reference' = 'ECM-PAY-6L3Z341U23';
```

Résultat attendu : `success: true`, `status: SUCCEEDED`, `steps: {payment: updated, order: updated, credit: done}`.
- `Amount mismatch` : l'événement ne correspond pas au paiement ; s'arrêter.
- `credit: blocked` : le portefeuille du marchand est gelé ; le crédit sera rejoué automatiquement par `ecomfy-pay-settlement` après le dégel.
- Relancer la requête ne crédite jamais deux fois (`credit: already`).

Contrôle :

```sql
select p.status, o.payment_status as commande_payee, l.*
from public.ecomfy_payments p
left join public.orders o on o.id = p.order_id
left join public.wallet_ledger l on l.payment_id = p.id
where p.internal_reference = 'ECM-PAY-6L3Z341U23';
```

Attendu : `SUCCEEDED`, `paid`, une écriture `PAYMENT_PENDING`. Le crédit est disponible 72 h **après le rattrapage** (le délai part de l'appel, pas du 26/10).

Après : prévenir le marchand de la boutique (le courriel de succès n'est envoyé que par le webhook, pas par ce chemin manuel, et la file d'e-mails ne s'exécute pas encore en prod).

## Étape 6 — Les 14 autres paiements `PENDING`

**D'abord, vérifier chez GeniusPay qu'aucun n'a été payé.** Liste à comparer (les 14 hors `ECM-PAY-6L3Z341U23`) :

```sql
select p.internal_reference, p.provider_reference, p.amount, to_char(p.created_at, 'DD/MM HH24:MI') as cree,
       exists (select 1 from public.webhook_events w
               where w.payload::text like '%' || p.internal_reference || '%'
                 and w.event_type = 'payment.success') as success_recu
from public.ecomfy_payments p
where p.status = 'PENDING' and p.internal_reference <> 'ECM-PAY-6L3Z341U23'
order by p.created_at;
```

Dans GeniusPay, chercher chaque `provider_reference` : toute transaction `completed` est à traiter comme à l'étape 5 (même requête, en adaptant la référence et l'événement, ou en appelant `confirm_ecomfy_payment` avec le montant relevé chez GeniusPay). Pour les deux paiements du 29/10 (05 h 31 et 07 h 39), attendre au moins 24 h avant de conclure à un abandon.

Pour les références **non payées**, après vérification :

```sql
update public.ecomfy_payments
set status = 'EXPIRED',
    metadata = coalesce(metadata, '{}'::jsonb)
               || jsonb_build_object('expired_reason', 'aucun_paiement_recu_2026-10-29', 'expired_at', now()),
    updated_at = now()
where status = 'PENDING'
  and internal_reference <> 'ECM-PAY-6L3Z341U23'
  and created_at < now() - interval '24 hours'
returning internal_reference;
```

Un succès tardif reste possible après l'expiration : `confirm_ecomfy_payment` accepte tout statut sauf `REFUNDED`, donc un paiement `EXPIRED` encore payé serait crédité normalement.

### Commandes liées (à régler avec les marchands, sans automatisme)

Les 14 commandes sont en `new` (9) ou `processing` (5), avec `payment_status = pending`. Un marchand a peut-être déjà préparé une commande « en cours » qui n'a jamais été payée en ligne.

```sql
select to_jsonb(s)->>'name' as boutique, o.id as commande, o.order_status, o.payment_status, o.total,
       to_char(o.created_at, 'DD/MM') as le, p.internal_reference
from public.ecomfy_payments p
join public.orders o on o.id = p.order_id
left join public.shops s on s.id = p.shop_id
where p.status = 'EXPIRED' and p.metadata->>'expired_reason' = 'aucun_paiement_recu_2026-10-29'
order by boutique, o.created_at;
```

Pour chaque commande : contacter le client (téléphone en base) ou annuler (`order_status = 'cancelled'`) selon le marchand. Ne pas annuler en masse.

## Étape 7 — Expiration automatique (anti-récidive)

Aujourd'hui `expire_stale_pending_payments` ne lit que `payments`. Fonction équivalente pour `ecomfy_payments`, dans l'éditeur SQL (rejouable) :

```sql
create or replace function public.expire_stale_ecomfy_payments(p_hours int default 24)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_count integer;
begin
  with u as (
    update public.ecomfy_payments
       set status = 'EXPIRED',
           metadata = coalesce(metadata, '{}'::jsonb)
                      || jsonb_build_object('expired_reason', 'pending_timeout_' || p_hours || 'h', 'expired_at', now()),
           updated_at = now()
     where status in ('CREATED', 'PENDING')
       and created_at < now() - make_interval(hours => p_hours)
    returning 1
  )
  select count(*) into v_count from u;
  return v_count;
end;
$$;

revoke all on function public.expire_stale_ecomfy_payments(int) from public, anon, authenticated;
grant execute on function public.expire_stale_ecomfy_payments(int) to service_role;

do $$
declare v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname = 'expire-stale-ecomfy-payments';
  if v_jobid is not null then perform cron.unschedule(v_jobid); end if;
  perform cron.schedule('expire-stale-ecomfy-payments', '*/10 * * * *',
                        $cron$ select public.expire_stale_ecomfy_payments(24); $cron$);
end $$;
```

Contrôle : `select jobname, schedule, active from cron.job where jobname = 'expire-stale-ecomfy-payments';`

Retour arrière : `select cron.unschedule('expire-stale-ecomfy-payments');`

Cette expiration ne touche pas aux commandes. À moyen terme, un rapprochement par appel à GeniusPay (comme `reconcile-pending-payments` pour `payments`) évitera d'attendre un webhook qui ne vient pas.

## Étape 8 — Retraits (avant d'activer `withdrawals_enabled`)

Les événements de retrait (`payout.*`, `withdrawal.*`, `transfer.*`) arrivent sur la même URL et n'ont ni `ecomfy_pay_customer_order` ni `ECM-PAY-`. Ils sont donc traités par l'ancienne fonction, qui ne sait pas clôturer un retrait.

À faire **avant d'ouvrir les retraits** : étendre la condition d'aiguillage de `geniuspay-webhook` à `/^(payout|withdrawal|transfer)\./.test(event.toLowerCase())`, redéployer, puis tester avec un retrait de montant minimal. Les noms d'événements de retrait de GeniusPay restent supposés, non vérifiés (guide du ledger §4).

## Étape 9 — Surveillance (48 h)

- [ ] `supabase/maintenance/surveillance_post_deploiement.sql` : sections 05 et 06 (plus de `PENDING` vieux), 01 et 02 (cron sans échec).
- [ ] Chaque nouveau paiement client : `SUCCEEDED` en moins d'une minute.
- [ ] Logs `geniuspay-webhook` : une ligne `Forwarded … status: 200` par paiement client ; aucune ligne `Forward … failed`.
- [ ] Premier webhook d'abonnement après le déploiement : traité normalement (étape 3).
- [ ] `payment_events` : aucun `processing_status` en `ERROR`, `AMOUNT_MISMATCH` ou `CREDIT_BLOCKED` :

```sql
select processing_status, count(*) from public.payment_events group by 1;
```

## Étape 10 — Retour arrière

- **Aiguillage :** `git checkout 1d97a70 -- supabase/functions/geniuspay-webhook`, puis la commande de l'étape 2, puis `git checkout HEAD -- supabase/functions/geniuspay-webhook`. Sans effet de bord en base ; les paiements clients retombent à l'état précédent (aucun webhook traité).
- **Expiration :** `select cron.unschedule('expire-stale-ecomfy-payments');` (les paiements déjà `EXPIRED` restent tels quels ; un succès tardif les créditerait quand même).
- **Rattrapage :** ne se défait pas par un retour arrière de code. En cas d'erreur, passer par une écriture `ADJUSTMENT` au ledger, décidée au cas par cas.

## Liste de contrôle

- [ ] 0. Pré-requis, version de la fonction notée
- [ ] 1. Pré-contrôle : paiement `PENDING`, événement trouvé, `completed` chez GeniusPay
- [ ] 2. `geniuspay-webhook` déployée, contrôles sans signature
- [ ] 3. Abonnements toujours traités (ou différé à l'étape 9)
- [ ] 4. Paiement réel : `SUCCEEDED`, commande payée, ledger, `Forwarded … 200`
- [ ] 5. `ECM-PAY-6L3Z341U23` rattrapé et contrôlé ; marchand prévenu
- [ ] 6. 14 références vérifiées chez GeniusPay, expirées ; commandes traitées avec les marchands
- [ ] 7. `expire_stale_ecomfy_payments` + tâche planifiée
- [ ] 8. Aiguillage des retraits (avant d'ouvrir les retraits)
- [ ] 9. Surveillance 48 h
- [ ] Mettre à jour le journal [DEPLOIEMENT-JEANMARC-VERS-MAIN-2026-10.md](DEPLOIEMENT-JEANMARC-VERS-MAIN-2026-10.md) (§14 « Paiements Ecomfy Pay PENDING » et §16 test 22)
