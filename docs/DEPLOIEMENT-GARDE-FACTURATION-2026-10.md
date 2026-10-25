# Garde de facturation des boutiques et tests RLS des flux d'argent : correctifs du 25/10/2026

**Branche :** `jeanmarc` (commité : `ebce9de`). **Ne jamais utiliser `supabase db push`.** Projet prod : `yfggrceynzcwklbxhgix` ; le projet lié dans ce dépôt est **dev** (`xfpbpxncserliskrbaim`).

**Guides liés :** [`DEPLOIEMENT-FACTURATION-2026-10.md`](DEPLOIEMENT-FACTURATION-2026-10.md) (système de facturation par seuil, dont dépendent les échéances), [`DEPLOIEMENT-LEDGER-PAY-2026-10.md`](DEPLOIEMENT-LEDGER-PAY-2026-10.md) et [`DEPLOIEMENT-AFFILIATION-2026-10.md`](DEPLOIEMENT-AFFILIATION-2026-10.md) (tables couvertes par le test).

## 1. Bugs corrigés

| # | Bug | Correctif |
|---|---|---|
| G1 | **Un marchand pouvait réécrire sa facturation.** Les politiques « Users can manage their own shops » (ALL) et « Collaborators with edit_shop can update shop » laissaient le propriétaire **et son collaborateur `edit_shop`** modifier, avec la clé de session normale : `commission_balance_due` (effacer sa dette), `commission_rate`, `commission_per_order`, `commission_threshold`, `shop_payment_status` / `is_suspended` / échéances (se déverrouiller sans payer), `extra_deadline_*`, `subscription_plan` / `subscription_active_until` / `is_subscribed` (10 ans d'abonnement = 0 commission), `is_activated` / `activation_fee_paid` (activation sans payer), `total_sales` / `total_orders`. Aucun déclencheur ne les protégeait (`trg_enforce_lock_shops` ne garde que nom, logo, thème, publication). Reproduit sur dev : 36 modifications acceptées. | Déclencheur `trg_guard_shop_billing_columns` (fonction `guard_shop_billing_columns`, **non** `SECURITY DEFINER`) : refus `42501 shop_billing_columns_protected` si `current_user` est `authenticated` ou `anon`, sauf fondateur / co-fondateur. |
| G2 | **Création d'une boutique déjà « abonnée »** : l'`INSERT` était soumis à la même absence de contrôle (boutique née avec 10 ans d'abonnement, activée, commission à 0). | Le même déclencheur, à l'`INSERT` : les colonnes protégées doivent valoir leur défaut. |
| G3 | **Écran Dépannage du fondateur inopérant** : `handleActivateShop` faisait un `update` direct sur `shops` ; le fondateur n'a aucune politique d'`UPDATE` sur cette table, donc 0 ligne modifiée, aucune erreur, et le toast « Boutique activée ! ». Préexistant, sans lien avec G1. | Passe par `activateShopManually` (Edge Function `founder-activate-shop` : paiement manuel de 1 300 FCFA enregistré, puis activation et publication). Confirmation en deux clics (« Confirmer l'encaissement de 1300 FCFA »). |
| G4 | La liste de cet écran prenait 20 boutiques **sans tri** : les boutiques récentes, celles qu'on doit justement activer, n'apparaissaient pas. | Tri par date de création décroissante. |

Ce qui reste libre (et est testé) : les fonctions serveur `SECURITY DEFINER` (verrouillage automatique, hausse de la dette à chaque commande, `founder_reset_shop_payment`, etc., où `current_user` est leur propriétaire), `service_role` (Edge Functions), les fondateurs, et toutes les autres colonnes (nom, logo, thème, SEO, publication…).

**Production sans le système de facturation par seuil.** Le déclencheur compare les colonnes via `to_jsonb(NEW/OLD)` : une colonne absente de la base est ignorée. Sans cela, sur une base qui n'a pas `extra_deadline_*` ou `is_subscribed`, chaque modification de boutique par un marchand aurait échoué. Vérifié sur dev en supprimant temporairement deux colonnes dans une transaction annulée : renommer la boutique passe, modifier la dette et créer une boutique « activée » restent refusés.

## 2. Vérification (25/10/2026, dev)

- `supabase/tests/rls_money_flows.sql` : **234 cas, 0 échec** (voir §4). **Contre-épreuve** avant la migration : 44 échecs (36 `UPDATE` de facturation, 7 `INSERT`, 1 témoin).
- Navigateur (application locale sur dev, comptes de test supprimés ensuite) : le marchand A tente depuis la page, avec sa vraie session, de mettre sa dette à 0, de repasser en « active », de mettre son taux à 0, de se donner 10 ans d'abonnement, de créer une boutique abonnée : tout refusé en `42501` ; sa dette reste à 5 050 FCFA et la bannière de facturation l'affiche. Renommer la boutique dans l'éditeur : « ✓ Sauvegardé » (base vérifiée). Création d'une boutique par l'assistant : « Boutique créée ! ». Fondateur : activation de « E2E Boutique Neuve » par l'écran Dépannage → activée et publiée, un seul paiement manuel de 1 300 FCFA (`cash_direct`, `completed`) ; réactivation de « E2E Boutique A » par le contrôle de paiement → dette remise à 0. Marchand B sur Ecomfy Pay : voit son solde, pas celui de A ; ses modifications de la boutique de A touchent 0 ligne.
- Le navigateur a trouvé un défaut que le test SQL laissait passer : le refus sortait en `22P02 malformed array literal` (`text[] || 'texte'`). Corrigé, et le test exige maintenant le code `42501 shop_billing_columns_protected`.
- Migration rejouée plusieurs fois sans erreur (idempotente). `tsc` : aucune erreur dans le fichier modifié.

## 3. Déploiement

| Élément | Dev | Prod |
|---|---|---|
| `20261025100000_shops_billing_columns_guard.sql` | appliquée (`db query -f`, ciblée) | à faire |
| Edge Function `founder-activate-shop` | déployée, testée | **à vérifier**, à déployer si absente |
| Front (`FounderTroubleshooting.tsx`) | serveur local | à faire |

**Ordre : migration, puis front.** La migration n'a aucune dépendance (une fonction, un déclencheur) et peut passer avant ou après les migrations de facturation.

**Avant la production**, vérifier que la faille y est bien présente (contre-épreuve) : dans une transaction annulée, avec une boutique jetable, un `UPDATE shops SET commission_balance_due = 0` sous le rôle `authenticated` doit réussir **avant** la migration et échouer en `42501` **après**. Le test complet ne se lance pas tel quel en production (il suppose les tables Ecomfy Pay, d'affiliation et de facturation par seuil) : n'y rejouer que la section « shops » ou un bloc équivalent, jamais le fichier entier sans l'avoir relu.

Après application : `SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.shops'::regclass AND tgname = 'trg_guard_shop_billing_columns';` doit renvoyer une ligne ; modifier le nom d'une boutique avec un compte marchand doit continuer à fonctionner (point de contrôle principal : l'éditeur de boutique, les réglages, le sélecteur de domaine).

**Ce que le garde ne couvre pas, à surveiller :** toute **nouvelle** colonne de facturation ajoutée à `shops` doit être ajoutée à `v_defaults` dans la fonction, sinon elle reste modifiable par le propriétaire. Un fondateur n'a toujours aucune politique d'`UPDATE` directe sur `shops` (il passe par les fonctions et Edge Functions) : ne pas ajouter d'écran qui écrive directement.

## 4. Tests rejouables

`supabase/tests/rls_money_flows.sql`, **base de dev uniquement** (tout est annulé en fin de fichier) :
`npx supabase db query --linked -f supabase/tests/rls_money_flows.sql` → attendu : `(0 échecs sur 234 cas)`. Vérifier d'abord que `supabase/.temp/project-ref` vaut `xfpbpxncserliskrbaim`.

Le fichier crée ses utilisateurs, boutiques et lignes factices, usurpe les rôles `anon` / `authenticated` comme PostgREST, et joue chaque attaque dans une sous-transaction annulée (cas indépendants). Un cas réussit seulement si l'attaque est refusée **et** si l'état de la base est inchangé. Couverture :

- **Lecture** : portefeuilles, registre, retraits, règlements, paiements Ecomfy Pay, paiements et abonnements historiques, règlements de commission, historique de verrouillage, affiliation (profil, commissions, parrainages, versements, moyens de versement) : chacun ne voit que ses lignes ; un tiers connecté et un visiteur ne voient rien ; `payment_events` et `affiliate_audit_logs` (sans politique) invisibles pour tous, fondateur compris ; commandes d'une autre boutique invisibles.
- **Écriture directe** (≈ 70 cas) : gonfler un solde, détourner un numéro de retrait, écrire au registre, fabriquer un retrait ou un paiement, accélérer un règlement, s'octroyer un abonnement, effacer l'historique de verrouillage, créer un lien de paiement chez un autre, gonfler une commission d'affilié, s'attribuer un filleul, etc. : tout refusé, état inchangé.
- **Facturation de la boutique** : 18 colonnes × (propriétaire, collaborateur `edit_shop`) en `UPDATE`, 7 cas à l'`INSERT`.
- **Fonctions** : 15 fonctions internes non exécutables par `anon` / `authenticated` ; garde-fou : une **nouvelle** fonction `SECURITY DEFINER` « argent » ouverte à `anon` ou `authenticated` sans être ajoutée aux listes du test fait échouer le test ; `founder_reset_shop_payment` et `mark_affiliate_payout_paid` refusées aux non-fondateurs ; retrait refusé au visiteur et sans KYC ; `save_merchant_payout_config` ne touche que le portefeuille de l'appelant ; versement d'affiliation exact, une seule fois.
- **Témoins positifs** (pour qu'un refus ne vienne pas d'une erreur de test) : réglages ordinaires modifiables par le propriétaire et le collaborateur, `service_role` écrit la facturation, le verrouillage automatique et la hausse de la dette par commande passent malgré le garde.

**Observation hors périmètre :** `is_shop_subscription_active(p_shop_id)` est exécutable par tout utilisateur connecté pour n'importe quelle boutique ; elle ne révèle que « abonnement en cours ? ». Elle figure dans la liste autorisée du test.
