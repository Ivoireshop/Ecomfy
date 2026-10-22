# Déploiement — abonnement payé non appliqué et fin d'abonnement (22/10/2026)

**Projet prod :** `yfggrceynzcwklbxhgix`. **Branche :** `hotfix/abonnement-commission` (créée depuis `origin/main`, indépendante de `jeanmarc`). **Ne jamais utiliser `supabase db push`** : appliquer uniquement le fichier ci-dessous dans l'éditeur SQL, puis les Edge Functions, puis le front.

**Fichiers**

| Type | Fichier |
|---|---|
| Migration | `supabase/migrations/20261019120000_fix_subscription_activation_and_expiry.sql` |
| Rattrapage et vérification | `supabase/maintenance/abonnements_non_appliques.sql` |
| Test rejouable | `supabase/tests/subscription_activation_and_expiry.sql` (base jetable uniquement) |
| Edge Functions | `geniuspay-webhook`, `verify-payment`, `reconcile-pending-payments` |
| Front | `src/lib/shopSubscription.ts` (nouveau), `src/components/shop/SubscriptionRenewalBanner.tsx` (nouveau), `ShopPaymentGate.tsx`, `BillingHistory.tsx`, `shopPaymentStatus.ts`, `ShopEditor.tsx` |

## 1. Ce qui était cassé

Retour d'un utilisateur : après avoir pris un abonnement, il continuait à être facturé 50 FCFA par commande, et rien ne gérait la fin du mois.

| # | Constat (production) | Effet |
|---|---|---|
| A1 | `apply_shop_subscription` (version de `20260524`) n'acceptait que `starter`, `business`, `premium`. Le plan vendu sur `/pricing` est `pro_monthly` : la fonction répondait `invalid_plan`, et `verify-payment` ignorait la réponse. | Boutique du 11/09 : 12 000 FCFA encaissés, rien d'activé. |
| A2 | Les correctifs de sécurité d'octobre (H7, `20261015130000`) ont remplacé la fonction par une version qui écrit `shops.is_subscribed`. Cette colonne vient de `20260911` / `20260912`, **jamais appliquées en production**. | Toute souscription plante depuis le 15/10 : boutique du 22/10 (celle de l'utilisateur) : paiement pris, `subscription_active_until` resté vide, trigger `sync_shop_order_stats` qui continue de facturer. |
| A3 | Un paiement annuel (118 800 / 342 000 FCFA) n'était pas distingué d'un mensuel : le cycle n'est pas enregistré dans les métadonnées du paiement. | Un abonné annuel aurait reçu 30 jours. |
| A4 | Rien ne constatait la fin d'un abonnement : pas de tâche planifiée, pas de rappel, pas de fermeture. Le taux de commission mis à 0 à l'achat n'était jamais rétabli. | Fin de mois sans renouvellement demandé, boutique jamais fermée. |
| A5 | `verify-payment`, `geniuspay-webhook` et `reconcile-pending-payments` ne contrôlaient pas la réponse de `apply_shop_subscription` ; les branches « abonnement » étaient écartées dès que le paiement était `completed`. | Échec silencieux, jamais rejoué. |
| A6 | `BillingHistory` calculait « commissions facturées » = commandes × 50 même pour un abonné. | Affichage trompeur. |

**État de la production à connaître.** `20260909`, `20260911` et `20260912` ne sont pas appliquées (le système de factures de seuil `shop_invoices` n'existe pas). La migration de ce correctif est donc **autonome** : elle ne s'appuie sur rien de tout cela et ne les remplace pas. `sync_shop_order_stats` de production est celle de `20260701091528` ; la migration la reprend à l'identique, seule la condition d'exemption change.

## 2. Règles après correctif

- **Une seule règle :** une boutique est abonnée si `shops.subscription_active_until > now()`. Plus aucune autre colonne ne fait foi (`is_subscribed` n'est qu'un reflet pour la compatibilité).
- **Achat / renouvellement** (`apply_shop_subscription`) : plan accepté (hors `free`), 30 jours (365 si le montant payé atteint 100 000 FCFA), cumul des jours restants au renouvellement, idempotent par référence. Il remet aussi la boutique à zéro : solde de commission effacé, statut `active`, `is_suspended = false`, échéances et délai supplémentaire supprimés, `commission_rate = 0`. Le solde effacé est noté dans `shop_payment_events` (voir §5).
- **Commandes** : aucune commission tant que l'abonnement court **et pendant le délai de grâce** (3 jours).
- **Échéance** : taux de commission rétabli (0,025), événement `subscription_expired` ; la boutique reste ouverte avec un bandeau « renouvelez » pendant 3 jours.
- **Fin du délai de grâce** : `shop_payment_status = 'locked'` + `is_suspended = true` (le mécanisme du non-paiement : l'espace de gestion est fermé, la boutique publique continue de vendre), sans échéance de fermeture définitive. Écran « Abonnement expiré » avec bouton Renouveler. Le renouvellement rouvre aussitôt.
- **Rappel** : bandeau dès 5 jours avant l'échéance (orange, rouge à 1 jour).
- **Anciens abonnés** : une boutique dont l'abonnement a pris fin **avant** l'application de la migration n'est jamais fermée rétroactivement (voir `subscription_enforcement_start()`, §5).
- **Planification** : tâche `enforce-subscription-expiry` toutes les 30 minutes (`public.enforce_subscription_expiry()`), plus vérification à l'ouverture de l'espace boutique (`enforce_subscription_expiry_for`), qui ne concerne que la boutique du demandeur.

## 3. Déploiement en production

**Ordre : migration, Edge Functions, front, rattrapage.** Le front appelle `enforce_subscription_expiry_for` (créée par la migration) ; l'ancien front reste compatible avec la nouvelle base.

### 3.1 Avant (lecture seule)

```bash
cat supabase/.temp/project-ref        # doit afficher yfggrceynzcwklbxhgix (et non xfpbpxncserliskrbaim = dev)
```

Dans l'éditeur SQL de la production :

```sql
-- État attendu avant correctif : colonne absente, fonction H7 présente
select count(*) as is_subscribed_existe from information_schema.columns
 where table_schema = 'public' and table_name = 'shops' and column_name = 'is_subscribed';            -- 0
select prosrc like '%is_subscribed%' as h7_presente from pg_proc where proname = 'apply_shop_subscription';  -- true
-- Prérequis utilisés par la migration
select to_regclass('public.shop_payment_events') is not null as events,
       to_regclass('public.commission_payments') is not null as paiements,
       to_regclass('public.subscriptions') is not null as abonnements,
       to_regprocedure('public.has_role(uuid, text)') is not null as has_role;                        -- 4 × true
-- Les droits C2 doivent être en place (la migration ne les modifie pas)
select grantee from information_schema.routine_privileges
 where routine_name = 'apply_shop_subscription' and routine_schema = 'public';                         -- service_role (+ postgres)
-- Boutiques qui seront concernées par la fermeture : abonnements échus avant l'application (ignorés)
select count(*) from shops where subscription_active_until is not null and subscription_active_until < now();
```

### 3.2 Migration

Coller le contenu de `supabase/migrations/20261019120000_fix_subscription_activation_and_expiry.sql` dans l'éditeur SQL de la production et l'exécuter. Elle est idempotente (rejouable sans effet). Ensuite, pour que l'historique des migrations la connaisse :

```bash
supabase migration repair --status applied 20261019120000 --project-ref yfggrceynzcwklbxhgix
```

Contrôles après :

```sql
select count(*) as is_subscribed_existe from information_schema.columns
 where table_schema = 'public' and table_name = 'shops' and column_name = 'is_subscribed';             -- 1
select prosrc like '%subscription_grace_interval%' as sync_a_jour from pg_proc where proname = 'sync_shop_order_stats';  -- true
select public.subscription_enforcement_start();     -- = l'heure d'application de la migration
select jobname, schedule, active from cron.job where jobname = 'enforce-subscription-expiry';          -- 1 ligne, */30 * * * *
```

Si `cron.job` n'existe pas (pg_cron absent), la migration l'indique par un NOTICE et ne planifie rien : créer la tâche depuis le tableau de bord Supabase (Integrations → Cron) avec `select public.enforce_subscription_expiry();` toutes les 30 minutes. Les boutiques sont aussi vérifiées à l'ouverture de leur espace, mais la tâche est ce qui ferme les boutiques inactives.

### 3.3 Edge Functions

```bash
supabase functions deploy geniuspay-webhook verify-payment reconcile-pending-payments --project-ref yfggrceynzcwklbxhgix
```

Changements : le résultat de `apply_shop_subscription` est contrôlé ; en cas d'échec, le webhook répond 500 (GeniusPay réessaie) et `verify-payment` répond `subscription_not_applied` ; l'abonnement est appliqué **avant** la réservation du paiement (idempotent par référence), donc un échec est rejoué à la livraison suivante au lieu d'être écarté ; la date de fin n'est plus ramenée à 30 jours. `reconcile-pending-payments` journalise les échecs.

### 3.4 Front

Déployer le front de la branche. Aucune variable d'environnement nouvelle.

### 3.5 Vérification et rattrapage des paiements non appliqués

Dans l'éditeur SQL, `supabase/maintenance/abonnements_non_appliques.sql` :

1. **Bloc 1** (lecture seule) : tous les paiements d'abonnement `completed`, sans limite de date, sans trace d'application. Il contient aussi la liste des paiements restés `pending` depuis plus d'une heure. Au 22/10, la requête sur 60 jours ne montrait que deux cas.
2. **Bloc 2** (lecture seule) : aperçu de ce que le rattrapage appliquerait (limité aux deux utilisateurs constatés : retirer le filtre `user_id` pour élargir).
3. **Bloc 3** : rattrapage. Décisions actuelles du fondateur : **un mois complet à partir d'aujourd'hui**, **solde de commission effacé**. Idempotent : le relancer ne prolonge rien une seconde fois.

### 3.6 Après

```sql
-- Les deux boutiques doivent être abonnées, soldées, ouvertes
select id, business_name, subscription_plan, subscription_active_until, commission_balance_due,
       shop_payment_status, is_suspended
  from shops
 where user_id in ('a4822b15-6559-4a84-bbd3-bcc8876064d5', 'ae93f995-1f46-497b-b75a-29c858e62b57');
-- Aucune boutique abonnée ne doit accumuler de commission
select id, business_name, commission_balance_due from shops
 where subscription_active_until > now() and commission_balance_due > 0;                                -- 0 ligne
```

Puis un essai de bout en bout avec un petit abonnement réel (ou en dev) : paiement → `subscription_active_until` posé, bannière « Plan actuel » ; une commande de test ne change pas `commission_balance_due`.

## 4. Tests

`supabase/tests/subscription_activation_and_expiry.sql` reproduit l'état de la production (pas de colonne `is_subscribed`, trigger de `20260701`, fonction H7, droits C2), **prouve d'abord le bug** (la fonction H7 échoue sur la colonne manquante), applique la migration, puis déroule 37 cas : plan `pro_monthly`, boutique verrouillée rouverte, 0 commission, idempotence, renouvellement cumulé, annuel, refus (`free`, boutique inconnue), abonnement de compte sans boutique, anciens abonnés ignorés, grâce, fermeture, renouvellement, tâche planifiée, droits (`anon`/`authenticated` refusés, droits C2 conservés), vérification à la lecture réservée au propriétaire. La migration est rejouée deux fois de suite sans erreur.

```bash
docker run -d --rm --name sub-pgtest -e POSTGRES_PASSWORD=test postgres:17-alpine
(sed -n '1,/^-- ====== FIN DU SCHÉMA/p' supabase/tests/subscription_activation_and_expiry.sql;
 cat supabase/migrations/20261019120000_fix_subscription_activation_and_expiry.sql;
 sed -n '/^-- ====== FIN DU SCHÉMA/,$p' supabase/tests/subscription_activation_and_expiry.sql) \
| docker exec -i sub-pgtest psql -U postgres -v ON_ERROR_STOP=1 -P pager=off
```

Résultat du 22/10/2026 : `TOUS LES CAS PASSENT`. Le script de rattrapage a aussi été rejoué sur cette base avec des paiements reproduisant les deux cas : détection, application, puis seconde exécution sans effet.

**Limites.** Ces tests tournent sur une base jetable avec un schéma minimal, pas sur dev ni sur la production : la migration n'a pas été appliquée à dev. Les Edge Functions sont vérifiées par `deno check` (compilation) mais pas exécutées contre GeniusPay. Les écrans (bandeau, écran « Abonnement expiré ») ne sont pas testés dans un navigateur : à regarder une fois en dev.

## 5. Modifier une décision après coup

**Délai de grâce** (3 jours aujourd'hui) :

```sql
create or replace function public.subscription_grace_interval() returns interval language sql immutable
as $$ select interval '5 days' $$;
```

et la constante `SUBSCRIPTION_GRACE_DAYS` de `src/lib/shopSubscription.ts` (elle sert aux dates affichées). Le changement s'applique à toutes les boutiques au passage suivant de la tâche.

**Fin d'abonnement d'une boutique rattrapée, au lieu d'un mois à partir d'aujourd'hui, par exemple un mois à partir de la date de paiement** (à adapter : référence du paiement, boutique, utilisateur) :

```sql
update shops set subscription_active_until = (select created_at from payments where transaction_id = '<référence>') + interval '30 days'
 where id = '<id boutique>';
update subscriptions set end_date = (select subscription_active_until from shops where id = '<id boutique>')
 where user_id = '<id utilisateur>';
```

Si la nouvelle date est dans le passé, la boutique est constatée échue puis fermée au prochain passage de la tâche (délai de grâce compris).

**Rétablir le solde de commission effacé** d'une boutique (il est conservé dans le journal de l'abonnement) :

```sql
update shops s
   set commission_balance_due = (regexp_match(e.note, 'effacé : ([0-9.]+) FCFA'))[1]::numeric
  from (select distinct on (shop_id) * from shop_payment_events
         where event_type = 'subscription_activated' and shop_id = '<id boutique>'
         order by shop_id, created_at desc) e
 where s.id = e.shop_id;
```

Pour voir tous les soldes effacés : `select shop_id, created_at, note from shop_payment_events where event_type = 'subscription_activated' order by created_at desc;`. Un solde rétabli sur une boutique abonnée n'est pas facturé davantage (l'abonnement continue d'exempter les nouvelles commandes) ; il ne ferme rien tant qu'aucune échéance n'est posée.

**Appliquer la fermeture à d'anciens abonnés échus** (aujourd'hui ignorés) :

```sql
create or replace function public.subscription_enforcement_start() returns timestamptz language sql immutable
as $$ select '2026-01-01'::timestamptz $$;
```

À n'utiliser qu'après avoir listé les boutiques concernées (`select id, business_name, subscription_active_until from shops where subscription_active_until < now()`) : toutes seraient fermées au prochain passage.

## 6. Retour arrière

- **Base** : `apply_shop_subscription` et `sync_shop_order_stats` d'avant correctif sont dans `20261015130000` (qui plante, voir A2) et `20260701091528`. Le retour utile est uniquement de désactiver la fermeture : `select cron.unschedule('enforce-subscription-expiry');` ; les boutiques déjà verrouillées pour abonnement se rouvrent au renouvellement, ou à la main : `update shops set shop_payment_status = 'active', is_suspended = false, locked_at = null where id = '<id>';`.
- **Edge Functions et front** : redéployer la version précédente de la branche `main`.
- **Rattrapage** : voir §5 (date de fin, solde) ; une ligne `commission_payments` (notes « Abonnement … ») et un événement `subscription_activated` ont été écrits par abonnement rattrapé.

## 7. À savoir

- Le plan de renouvellement proposé dans l'écran « Abonnement expiré » est celui de la boutique (`starter`, `pro_monthly`, `premium_academy_pro`), en mensuel. Pour passer en annuel ou changer de formule, l'utilisateur passe par `/pricing`.
- Les commandes reçues pendant la fermeture sont traitées comme celles d'un verrouillage pour impayé (`tag_order_received_during_lock`) et la lecture de la liste par le propriétaire suit les règles de la boutique restreinte une fois la branche `jeanmarc` déployée.
- Quand `jeanmarc` sera fusionné : sa migration `20261022150000_references_non_devinables.sql` recrée `check_and_trigger_billing_threshold` et `confirm_invoice_payment`, qui n'ont de sens qu'avec le système de facturation de seuil (`20260909`), absent de la production ; elles ne touchent ni `apply_shop_subscription` ni `sync_shop_order_stats` et n'entrent donc pas en conflit avec ce correctif.
