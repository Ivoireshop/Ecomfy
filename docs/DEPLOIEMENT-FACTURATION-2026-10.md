# Facturation boutique : correctifs du 23/10/2026

**Branche :** `jeanmarc` (non commité). **Ne jamais utiliser `supabase db push`.** Projet prod : `yfggrceynzcwklbxhgix`.

## 0. Contexte important

La **facturation par seuil** (`shop_invoices`, `check_and_trigger_billing_threshold`, `enforce_shop_billing_deadlines`, migrations `20260909100000` et `20261003120000`) n'est déployée **ni sur dev ni en prod**. Le modèle en service est l'ancien : `active` → `payment_pending` → `locked` → `final_suspension`. L'onglet Facturation affichait pourtant des écrans écrits pour le nouveau modèle, d'où plusieurs bugs visibles aujourd'hui.

## 1. Bugs corrigés

| # | Bug | Correctif |
|---|---|---|
| B1 | Dès 240 commandes cumulées, la carte « Facture disponible — Seuil atteint » restait affichée à vie, même avec un solde à 0, avec un bouton « PAYER 12 000 FCFA » que le serveur refuse (« Aucune commission à régler »). Les montants de repli `12 000` étaient codés en dur (carte, historique, dialogue). | La carte d'échéance n'apparaît que s'il reste un montant dû ET qu'un délai ou une facture est ouvert. Sinon : « Aucun montant dû ». Le montant affiché est toujours le solde réel. |
| B2 | Après un règlement partiel, le compte à rebours disparaissait : il exigeait un solde ≥ 12 000 FCFA, et l'ancien bandeau était masqué dès qu'un solde existait. La boutique pouvait donc se verrouiller sans avertissement. | `isGracePeriod` = délai ouvert + délai non écoulé + solde > 0. |
| B3 | L'échéance d'une ancienne facture réglée était réutilisée comme échéance du solde suivant ; une facture réglée comptait comme « facture active » (bandeaux masqués). | L'échéance est celle de la boutique, seulement tant qu'un délai est ouvert. La facture active est une facture **ouverte**. |
| B4 | **Règlement partiel d'une boutique verrouillée** : à partir de 50 % du seuil, `apply_commission_payment` la déverrouillait, alors que tous les écrans annoncent « paiement complet obligatoire ». | Migration `20261023120000` : l'argent est enregistré et déduit, mais la restriction n'est levée que par le solde complet. `process-payment` refuse aussi le paiement partiel d'une boutique verrouillée avant l'encaissement. L'onglet Facturation force « paiement complet » quand la boutique est restreinte. |
| B5 | La fonction `apply_commission_payment` actuelle (H7, 15/10) avait perdu la clôture des factures de seuil du correctif du 03/10. | Le règlement complet passe les factures ouvertes en `PAYMENT_CONFIRMED` (si `shop_invoices` existe ; sans effet sinon). Le montant de la facture est conservé (l'ancienne version du 03/10 le mettait à 0). |
| B6 | Dialogue de paiement : champ vidé ou à 0 → le bouton affichait « Payer 0 FCFA » mais le paiement partait pour le solde entier ; montant > solde accepté côté écran ; le montant tapé était écrasé par un rafraîchissement du solde. | Montant débité = montant affiché ; erreurs min/max visibles, bouton désactivé ; réinitialisation à l'ouverture seulement ; arrondi au franc supérieur comme le serveur. |
| B7 | Section Facturation remplacée par un indicateur de chargement à chaque rafraîchissement temps réel (chaque commande) ; effet de bord dans une fonction de mise à jour React. | Chargement uniquement à l'ouverture ; minuteur via une référence. |
| B8 | 2 à 3 requêtes en 404 à chaque rafraîchissement sur une base sans le système de factures (hook monté plusieurs fois). | Détection « objet introuvable », mémorisée pour la session. |
| B9 | Facture imprimable : nom de boutique, méthode et référence injectés sans échappement dans une fenêtre de même origine ; un abonnement était facturé « Paiement de commission » ; pop-up bloqué sans message. | Échappement HTML, libellé « Abonnement Ecomfy », message si pop-up bloqué. |
| B11 | **Temps réel inopérant** : `shops` n'est dans la publication `supabase_realtime` sur aucune migration (sur dev, seule `orders` y figure). « Boutique déverrouillée » et les mises à jour du hook de facturation ne partaient jamais : il fallait recharger la page après un paiement. De plus, le hook écoutait `shop_invoices` dans le même canal que `shops` : sur une base sans cette table, tout le canal échouait. | Migration `20261023130000` (publication `shops`, et `shop_invoices` si elle existe) ; deux canaux séparés, le second seulement si le système de factures existe ; relecture au retour sur l'onglet. |
| B12 | Deux bandeaux superposés (l'ancien disait « approche le seuil » alors qu'une échéance courait) ; badge « STORE ACTIVE » illisible (texte sombre sur fond sombre) et en anglais. | Ancien bandeau masqué quand le nouveau s'affiche ; badge lisible et en français. |
| B13 | Un solde résiduel inférieur à 100 FCFA (une commande = 50 FCFA) ne pouvait jamais être payé en ligne : une boutique verrouillée avec un tel reste ne pouvait plus se déverrouiller. | Le minimum de 100 FCFA ne s'applique plus au solde final (serveur et dialogue). |
| B14 | **Échéances jamais appliquées par le serveur** : `enforce_shop_payment_state_for` n'était appelée que par le navigateur du marchand ; une boutique en retard dont le propriétaire ne se connecte pas n'était jamais verrouillée. | Migration `20261023140000` : fonction `enforce_all_shop_payment_states()` et tâche `enforce-shop-payment-deadlines` toutes les 5 minutes. Même règle qu'avant, seul le moment change. |
| B15 | « Total facturé » (commandes × commission) faux pour une boutique abonnée ; « Total payé » mélangeait commissions, abonnements et activation. | « Commissions facturées » = commissions payées + solde dû ; « Commissions payées » séparées de l'abonnement et de l'activation (affichés à part). |
| B16 | Facturation par seuil (non déployée) : voir la section 5, migration `20261023150000`. | Corrigée, testée sur dev dans une transaction annulée. |
| B10 | Libellés : « PAYEMENT ATTENDU », facture annulée présentée comme à payer avec bouton, pluriel « règlements » calculé sur tous les paiements, montants non formatés en fr-FR. | Corrigés ; le bouton « Payer » n'existe que sur la facture ouverte. |

## 2. Vérification (23/10/2026, dev `xfpbpxncserliskrbaim`)

**SQL** : `supabase/tests/billing_commission_payment.sql` (transaction annulée). Contre-épreuve sur l'ancienne fonction : boutique verrouillée déverrouillée par 75 %, facture jamais réglée. Après migration : 7 contrôles sur 7 conformes.

**Navigateur (Claude in Chrome, application locale sur la base dev)**, avec 3 boutiques jetables rattachées au compte de test déjà connecté, **supprimées ensuite** (dev revenu à 53 boutiques, 0 paiement ni utilisateur de test) :

| Scénario | Résultat |
|---|---|
| Boutique à jour, 300 commandes, solde 0 | Carte « Aucun montant dû », plus de bouton « PAYER 12 000 » ; badge « BOUTIQUE ACTIVE » lisible |
| En attente, solde 6 000 (partiel), échéance +2 jours | Compte à rebours visible (avant : rien), un seul bandeau, carte avec 6 000 FCFA |
| Dialogue de paiement | Champ vidé → « Minimum 100 FCFA », bouton désactivé ; 9 999 > solde → « Maximum 6 000 FCFA (solde dû) », bouton désactivé ; solde de 50 FCFA → « Payer 50 FCFA » activé |
| Verrouillée, solde 12 000 | Écran de verrouillage, dialogue « paiement complet obligatoire » |
| Verrouillée : paiement partiel de 9 000 (fonction serveur, comme le webhook) | Reste verrouillée, reste 3 000 ; l'écran affiche 3 000 après rechargement |
| Verrouillée : solde de 3 000 pendant que la page est ouverte | Déverrouillage **sans recharger**, message « Boutique déverrouillée » |
| En attente : solde complet pendant que l'onglet Facturation est ouvert | Bandeau retiré, « Aucun montant dû », badge actif, paiement de 6 000 dans l'historique, solde 0 |
| Facture imprimable avec nom de boutique `E2E <b>Gras</b> & "Cie"` | Affiché littéralement (échappé) |
| `process-payment` déployée sur dev, paiement partiel (6 000 puis 11 999) d'une boutique verrouillée | Refusé : « le règlement doit couvrir la totalité du solde (12000 FCFA) » |

**Non testé** : le paiement en ligne réel (redirection GeniusPay et webhook) : les encaissements ont été simulés par la fonction serveur, comme le fait le webhook. L'impression PDF.

**Tests unitaires** : `pricing.test.ts` 25 réussis, 1 échec déjà présent avant ces changements (`ecomfy-pay-webhook`, sans lien). `tsc` : aucune erreur dans les fichiers modifiés.

**Cron et seuil** (SQL, transactions annulées sur dev) :
- `billing_enforce_deadlines.sql` : boutique en retard verrouillée, `locked` échue fermée, solde nul et délai supplémentaire respectés, pas de double escalade. Tâche `enforce-shop-payment-deadlines` planifiée sur dev (`*/5 * * * *`).
- `billing_threshold_system.sql` (reconstruit le système de factures dans la transaction) : **contre-épreuve sur les anciennes fonctions** : solde 12 050 pour une facture de 12 000, paiement partiel effacé (solde 12 050 au lieu de 9 000), 2ᵉ cycle jamais facturé ni restreint, boutique sans solde restreinte, fonctions ouvertes à `anon` / aux utilisateurs connectés. **Après correctifs : tous les contrôles conformes.**
- Affichage : totaux de l'historique vérifiés dans le navigateur (7 000 facturés = 5 000 payés + 2 000 dus, abonnement de 12 000 séparé). Données de test supprimées.

## 3. Déploiement (facturation + abonnement, un seul jeu de fichiers)

**Projet prod :** `yfggrceynzcwklbxhgix`. Le projet lié dans ce dépôt est **dev** (`xfpbpxncserliskrbaim`) : `supabase db query --linked` vise donc dev. **Pour la prod : éditeur SQL du tableau de bord** (coller le contenu du fichier), et `--project-ref yfggrceynzcwklbxhgix` pour les fonctions. Ne jamais `supabase link` vers la prod ni `supabase db push` (il pousserait toutes les migrations en attente).

### 3.1 État

| Élément | Dev | Prod |
|---|---|---|
| `20261019120000_fix_subscription_activation_and_expiry.sql` (abonnement) | appliquée | à faire |
| `20261023120000_billing_commission_payment_lock_and_invoices.sql` | appliquée | à faire |
| `20261023130000_billing_realtime_publication.sql` | appliquée | à faire |
| `20261023140000_billing_enforce_deadlines_cron.sql` (tâche des échéances) | appliquée | à faire (voir 3.3) |
| `20261023150000_billing_threshold_system_fixes.sql` | sans objet (`shop_invoices` absente) | sans objet tant que la facturation par seuil n'est pas déployée |
| Edge Functions `process-payment`, `geniuspay-webhook`, `verify-payment`, `reconcile-pending-payments` | déployées | à faire |
| Front | serveur local | à faire |

### 3.2 Ordre en prod

1. **Contrôles avant** (lecture seule) : ceux de `docs/DEPLOIEMENT-ABONNEMENT-2026-10.md` §3.1 (colonne `is_subscribed` absente, fonction H7 présente, prérequis, droits C2). Et pour la facturation :
   `select pg_get_functiondef('public.apply_commission_payment(uuid,numeric,text,uuid,text,text)'::regprocedure) like '%pg_advisory_xact_lock%' as h7_en_place;` (doit être `true`) ;
   `select tablename from pg_publication_tables where pubname = 'supabase_realtime';` (noter si `shops` y est).
2. **Migrations, une par une, dans cet ordre** : `20261019120000`, `20261023120000`, `20261023130000`, puis `20261023140000` après l'étape 3.3. Chacune est idempotente. Puis enregistrer l'historique si souhaité : `supabase migration repair --status applied <version> --project-ref yfggrceynzcwklbxhgix`.
3. **Edge Functions** : `npx supabase functions deploy process-payment geniuspay-webhook verify-payment reconcile-pending-payments --use-api --project-ref yfggrceynzcwklbxhgix`. Sous Windows, sans `--use-api` le bundling Docker échoue (`invalid volume specification`).
4. **Front** (build habituel).
5. **Rattrapage des abonnements non appliqués** : `supabase/maintenance/abonnements_non_appliques.sql` (blocs 1 et 2 en lecture seule, bloc 3 = rattrapage), voir le guide abonnement §3.5.

### 3.3 Avant la tâche des échéances (`20261023140000`)

Au premier passage (dans les 5 minutes), toute boutique déjà en retard est verrouillée ou fermée. La lister d'abord :

```sql
select id, business_name, shop_payment_status, commission_balance_due, first_deadline_at, second_deadline_at
  from shops
 where commission_balance_due > 0
   and ((shop_payment_status = 'payment_pending' and first_deadline_at < now())
     or (shop_payment_status = 'locked' and second_deadline_at < now()
         and not (coalesce(extra_deadline_active, false) and extra_deadline_ends_at > now())));
```

Prévenir ces marchands ou régulariser d'abord. Désactiver la tâche : `select cron.unschedule('enforce-shop-payment-deadlines');`. Les fermetures pour abonnement non renouvelé (`locked` sans `second_deadline_at`) ne sont jamais concernées.

### 3.4 Contrôles après

```sql
select jobname, schedule, active from cron.job
 where jobname in ('enforce-shop-payment-deadlines', 'enforce-subscription-expiry');   -- 2 lignes (*/5 et */30)
select array_to_string(proacl, ',') from pg_proc where proname = 'apply_commission_payment';  -- service_role seul
select tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'shops';  -- 1 ligne
```

Dans l'application : une boutique de test verrouillée avec un solde, paiement partiel refusé (« le règlement doit couvrir la totalité du solde »), paiement complet : déverrouillage sans recharger la page. Test de l'abonnement : guide abonnement §3.6.

### 3.5 Ne pas faire

- Ne **pas** réappliquer `20261003120000` ni `20261015130000` après `20261023120000` : elles réécriraient l'ancienne version de `apply_commission_payment`.
- Ne **pas** déployer la branche `hotfix/abonnement-commission` à part : sa migration écrit la colonne inexistante `subscriptions.plan` (corrigée ici, voir guide abonnement §9).

### 3.6 Retour arrière

- `apply_commission_payment` : rejouer le corps de `20261015130000`.
- Tâches planifiées : `cron.unschedule('enforce-shop-payment-deadlines')`, `cron.unschedule('enforce-subscription-expiry')`.
- Publication temps réel : `alter publication supabase_realtime drop table public.shops;` (l'interface fonctionne sans, il faut alors recharger la page après un paiement).
- Abonnement : voir le guide abonnement.

## 4. Reste hors périmètre

- **Abonnement et verrouillage** : repris dans cette branche (voir `docs/DEPLOIEMENT-ABONNEMENT-2026-10.md`, section 9) : migration `20261019120000` (à appliquer **avant** celles du 23/10), Edge Functions `geniuspay-webhook`, `verify-payment`, `reconcile-pending-payments`, front. Il remet la boutique à `active` à l'achat et gère la fin d'abonnement.
- **Facturation par seuil** : avant son déploiement, appliquer dans l'ordre `20260909100000`, `20261022150000` si besoin, puis `20261023150000` ; `20260912000000` et `20261022150000` lisent `shops.is_subscribed`, colonne absente en production (la fonction de seuil corrigée n'en dépend plus, pas `apply_shop_subscription`). Les tests : `supabase/tests/billing_threshold_system.sql`.
- `BillingPaymentModal.tsx` n'est utilisé nulle part (code mort, numéro de facture factice `BILL-ECOMFY-000001`).
