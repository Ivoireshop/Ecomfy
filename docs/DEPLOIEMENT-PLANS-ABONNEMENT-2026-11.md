# Grilles d'abonnement, boutiques incluses et commission paramétrables (07/11/2026)

Nouveau menu fondateur **Abonnements & commissions** (`/founder/subscription-plans`) :
- **Plans** : prix mensuel et annuel, nombre de boutiques incluses, quotas IA affichés, fonctionnalités, actif / affiché sur `/pricing`, création de nouveaux plans.
- **Commission** : commission par commande (50 F), seuil de blocage (12 000 F), délai de paiement après le seuil, délai de grâce d'un abonnement, rappel de renouvellement.
- **Aperçu et historique** : abonnés par plan, comptes au-dessus de la limite, journal de chaque modification.

## Règle métier

- Un abonnement est rattaché au **compte** du marchand. Il couvre ses **N boutiques les plus anciennes** (N = « boutiques incluses » du plan) : 0 commission.
- Les boutiques au-delà **restent créables** et paient la commission par commande, avec le seuil et les échéances habituels.
- Une nouvelle boutique d'un compte abonné est couverte tant qu'il reste de la place.
- **Hausse** de N : les abonnés actuels sont couverts tout de suite. **Baisse** de N : appliquée au prochain renouvellement de chaque abonné (on ne retire rien à quelqu'un qui a déjà payé).
- Une boutique hors des boutiques incluses dont l'abonnement échoit **n'est pas fermée** : elle repasse à la commission. Si elle était déjà fermée, le propriétaire la rouvre depuis l'écran « Abonnement expiré » (bouton « Rouvrir avec la commission »).
- Un changement de prix n'affecte que les prochains paiements. Le serveur revérifie toujours le montant (`checkAmount`) contre la table `subscription_plans`.
- Valeurs de départ de « boutiques incluses » : starter 1, Pro 3, Premium 10. **À ajuster dans le menu avant d'ouvrir à tous.**

## Fichiers

| Élément | Fichier |
|---|---|
| Migration | `supabase/migrations/20261107100000_subscription_plans_settings.sql` |
| Test SQL (base jetable, 74 cas) | `supabase/tests/subscription_plans_coverage.sql` |
| Edge Functions | `process-payment`, `geniuspay-webhook`, `verify-payment`, `reconcile-pending-payments` (+ `_shared/pricing.ts`) |
| Menu fondateur | `src/pages/founder/SubscriptionPlansAdmin.tsx`, route dans `src/App.tsx`, entrée dans `AppSidebar.tsx` |
| Lecture des plans / réglages | `src/lib/subscriptionPlans.ts`, `src/hooks/useSubscriptionPlans.ts` |
| Écrans branchés | `PricingDashboard`, `SubscriptionCard`, `LandingPricing`, `LandingFinalCta`, `Academy`, `Subscription`, `ShopPaymentGate`, `ShopManager`, `ShopBuilder`, `ShopPaymentControl` |

## Ce que fait la migration

- Crée `subscription_plans`, `billing_settings`, `billing_config_audit` (lecture publique des plans et réglages, aucune écriture directe : tout passe par `founder_save_subscription_plan` et `founder_save_billing_settings`, réservées aux fondateurs et co-fondateurs).
- Ajoute `subscriptions.plan_code` et le renseigne pour les comptes déjà abonnés (à partir du plan de leur boutique). **Aucune couverture n'est recalculée** à ce moment : personne ne perd une couverture déjà payée.
- Remplace `apply_shop_subscription` : nouveau paramètre optionnel `p_billing_cycle` (la signature à 6 arguments est supprimée pour ne pas laisser deux surcharges). Droits : `service_role` seul, comme avant.
- Remplace `sync_shop_order_stats` (délai de paiement et message de seuil paramétrés), `subscription_grace_interval()` (lit le réglage) et `enforce_subscription_expiry_one`.
- Ajoute les déclencheurs `trg_shops_sync_billing_defaults` (une boutique naît avec la commission et le seuil du moment) et `trg_shops_inherit_subscription` (nouvelle boutique couverte s'il reste de la place).
- Aucune colonne ajoutée à `shops` : le garde `trg_guard_shop_billing_columns` n'est pas touché.
- Idempotente (rejouable).

## Ordre de déploiement (important)

1. **Migration d'abord.** Vérifier avant que la base contient `20261019120000` et `20261025100000` (colonnes `is_subscribed`, `subscription_active_until`, fonctions `subscription_default_commission_rate`, `subscription_enforcement_start`, déclencheur `trg_guard_shop_billing_columns`).
2. **Edge Functions ensuite** : `process-payment`, `geniuspay-webhook`, `verify-payment`, `reconcile-pending-payments`. Si elles passent AVANT la migration, elles appellent `apply_shop_subscription` avec `p_billing_cycle`, paramètre inconnu : un abonnement payé ne serait pas appliqué (le webhook répond 500 et réessaie, la réconciliation rejoue, mais le marchand attend).
3. **Front** en dernier. Tant que la migration n'est pas passée, les écrans retombent sur les anciens montants et le menu fondateur affiche un bandeau d'avertissement.

L'ancien code (front et fonctions) continue de fonctionner avec la nouvelle base : `apply_shop_subscription` accepte toujours l'appel à 6 arguments.

```
supabase db query --linked --project-ref <PROD> -f supabase/migrations/20261107100000_subscription_plans_settings.sql
supabase migration repair --status applied 20261107100000 --linked --project-ref <PROD>
supabase functions deploy process-payment geniuspay-webhook verify-payment reconcile-pending-payments --use-api --project-ref <PROD>
```

Le lien Supabase du dépôt pointe sur la prod : toujours passer `--project-ref` explicitement.

## Vérifications après déploiement

```sql
select code, price_monthly, price_annual, max_shops, is_active, is_public from subscription_plans order by sort_order;
select key, value from billing_settings order by key;
select plan_code, count(*) from subscriptions group by 1;
select count(*) from pg_proc where proname = 'apply_shop_subscription';   -- doit valoir 1
```

Puis dans le menu : changer un prix, vérifier `/pricing`, vérifier qu'un paiement à l'ancien prix est refusé, puis rétablir. Faire un paiement test (minimum 200 F chez GeniusPay).

## Retour arrière

- Front et Edge Functions : redéployer les versions précédentes (elles fonctionnent avec la nouvelle base).
- Base : supprimer les déclencheurs `trg_shops_inherit_subscription` et `trg_shops_sync_billing_defaults`, supprimer `apply_shop_subscription(uuid, uuid, text, numeric, text, text, text)`, puis rejouer dans `20261019120000` les parties 1 (`subscription_grace_interval`), 3 (`apply_shop_subscription`), 4 (`sync_shop_order_stats`) et 5 (`enforce_subscription_expiry_one`). Les tables et `subscriptions.plan_code` peuvent rester.
- Les boutiques déjà couvertes par le nouveau mécanisme gardent leurs colonnes `subscription_*` : aucune remise en état nécessaire.

## Ce qui n'est PAS paramétrable (limites connues)

- Le **second délai** avant fermeture définitive reste fixé à 3 jours (codé dans plusieurs fonctions d'origine). Le réglage « délai de paiement » ne change que le premier délai, après le seuil.
- Les **quotas IA** par plan sont affichés mais pas appliqués côté serveur (`consume_ai_credit` traite tout abonnement actif comme illimité) : comportement inchangé.
- L'ancien module de **facturation par seuil de 240 commandes** (`src/lib/billingSystem.ts`, `BillingThresholdSection.tsx`) garde ses constantes (240 commandes, 12 000 F). Il n'est pas relié à ces réglages ; la commission réellement prélevée, elle, suit bien le menu.
- Abaisser le seuil ne déclenche pas le délai de paiement sur les boutiques déjà au-dessus : il démarre à leur prochaine commande.
- Le pourcentage d'économie annuelle est calculé à partir des prix (118 800 F pour 12 × 12 000 F = 17,5 %), alors que l'ancien texte annonçait « 20 % » en dur.
- Le plan « Starter » (non affiché) reste vendable pour le renouvellement des boutiques qui l'ont. La carte « Abonnement boutique » de l'éditeur propose désormais les plans affichés (Pro, Premium) au lieu de « Starter » et de deux cartes « Bientôt disponible » à prix factices.
- Un plan **désactivé** n'est plus vendable ni renouvelable (le serveur le refuse).

## Tests faits

- Base jetable (Postgres 17) : 74 contrôles OK (couverture des N plus anciennes, nouvelle boutique, hausse puis baisse de N, retour à la commission à l'échéance, durée mensuelle/annuelle avec prix modifiés, droits RLS, validations, journal, rejeu de la migration), plus le test d'abonnement existant (`subscription_activation_and_expiry.sql`) rejoué sans régression.
- `vitest` : 186 tests OK (dont 2 nouveaux sur les prix venant de la base). `typecheck` : aucune nouvelle erreur. Build OK.
- Dev (`xfpbpxncserliskrbaim`) : migration appliquée et enregistrée, 4 Edge Functions déployées, `/pricing`, « Mes boutiques » et « Créer une boutique » vérifiés dans le navigateur avec un compte marchand.
- **Scénario sur la vraie base dev (annulé automatiquement, vérifié intact ensuite)** : droits d'un marchand refusés (plan, réglage, UPDATE direct du plan de sa boutique bloqué par le garde de facturation), fondateur qui règle plan et commission, paiement annuel avec cycle transmis, couverture des 2 plus anciennes boutiques sur 3, 4e boutique non couverte et née avec la commission du moment, hausse à 4 puis baisse à 1 (rien retiré sur le champ, 3 retirées au renouvellement).
- **Navigateur sur la dev** : prix modifié par le fondateur, ancien prix refusé par le serveur (« Montant du plan incorrect »), nouveau prix accepté et transmis à GeniusPay (page de test « 10 000 XOF », non payée, métadonnées avec `billing_cycle`). Prix remis à 12 000 ensuite. Un paiement `pending` de 10 000 F (réf. `SANDBOX_8SX7TMSDI51DETWT`) reste dans `payments` de la dev.
- **Suites existantes rejouées sur la dev** : `rls_money_flows.sql` 232 / 234 (les 2 échecs concernent `get_payment_return_status`, `log_delivery_payment_event` et `get_provider_payments`, fonctions d'autres modules ouvertes aux utilisateurs connectés et absentes de la liste du garde-fou : à examiner à part ; mes 5 fonctions y sont déclarées avec leur justification), `billing_enforce_deadlines.sql` et `billing_commission_payment.sql` entièrement OK. Dans `rls_money_flows.sql`, la ligne d'amorçage des abonnements tolère maintenant la ligne déjà créée par `handle_new_user` (le test ne démarrait plus sur la dev actuelle).
- **Non vérifié** : la page fondateur dans le navigateur (le compte de test n'est pas fondateur, le garde d'accès l'a refusé comme prévu) et le paiement GeniusPay mené jusqu'au bout (webhook, application de l'abonnement) avec un plan modifié.
