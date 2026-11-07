# Déploiement — aiguillage du webhook GeniusPay vers Ecomfy Pay (29/10/2026)

**Projet prod :** `yfggrceynzcwklbxhgix` · **Branche :** `jeanmarc`. **Ne jamais utiliser `supabase db push`.** Aucune migration, aucun nouveau secret : une seule Edge Function (`geniuspay-webhook`). **État : commité ; déployé et testé en sandbox sur la dev le 06/11/2026 (paiement de bout en bout réussi, voir la fin du document) ; non déployé en production.**

## 1. Le problème (constaté en production le 29/10)

Les 15 paiements Ecomfy Pay créés depuis le 21/10 sont tous en `PENDING` : aucun n'a jamais été crédité, `payment_events` et le ledger sont vides.

Cause : GeniusPay n'a **qu'une URL de webhook par compte**, déclarée sur `…/functions/v1/geniuspay-webhook` (ancienne fonction, qui ne connaît que la table `payments` : abonnements, activations, commissions, crédits). `ecomfy-pay-initiate` n'envoie aucune URL de webhook ; `ecomfy-pay-webhook` n'a donc jamais été appelée. Les webhooks des paiements clients arrivaient à l'ancienne fonction, qui les journalisait dans `webhook_events` sans effet.

Preuve : `webhook_events` contient un `payment.success` du 26/10 à 21 h 39 (réf. `MTX-QPBYZCG36W`, 10 500 FCFA, `metadata.internal_reference = ECM-PAY-6L3Z341U23`). **Un client a réellement payé** ; l'argent est chez GeniusPay, rien n'a été crédité. C'est le seul `payment.success` de ce type : les 14 autres paiements n'ont jamais été payés (abandons, à confirmer dans le tableau de bord GeniusPay).

Changer l'URL chez GeniusPay est exclu : les abonnements cesseraient de s'activer.

## 2. Le correctif

`supabase/functions/geniuspay-webhook/index.ts` : après la vérification de signature et l'analyse du JSON, si `metadata.type == "ecomfy_pay_customer_order"` ou si `metadata.internal_reference` commence par `ECM-PAY-`, la requête est transmise telle quelle (corps brut, `X-Webhook-Signature`, `X-Webhook-Timestamp`, `X-Webhook-Event`, `X-Webhook-Delivery`) à `…/functions/v1/ecomfy-pay-webhook?provider=geniuspay`. Le code et le corps de la réponse sont repris tels quels (un 5xx fait réessayer GeniusPay). Un échec réseau de la transmission renvoie 502 (nouvelle tentative).

`ecomfy-pay-webhook` revérifie la signature avec le même `GENIUSPAY_WEBHOOK_SECRET`, confirme le paiement auprès de GeniusPay, puis appelle `confirm_ecomfy_payment` (paiement → commande → crédit en attente du portefeuille). Les autres événements (abonnements, activations, commissions, crédits) suivent leur chemin actuel.

Limite connue : les webhooks de **retrait** (payouts) arrivent sur la même URL et n'ont pas ces marqueurs ; ils iraient à l'ancienne fonction, qui ne les traite pas. À aiguiller avant d'ouvrir les retraits (`withdrawals_enabled`).

## 3. Déploiement

```powershell
$P = "yfggrceynzcwklbxhgix"
npx supabase@latest functions deploy geniuspay-webhook --project-ref $P --use-api
```

Contrôle sans signature : la fonction répond 200 avec `Missing signature headers` (comportement inchangé).

## 4. Test de bout en bout (obligatoire)

Un petit paiement réel (montant minimal) sur une boutique de test, en mode paiement en ligne :
1. `ecomfy_payments` : le paiement passe de `PENDING` à `SUCCEEDED`.
2. `payment_events` : une ligne pour l'événement ; `wallet_ledger` : une écriture `PAYMENT_PENDING`.
3. La commande liée : `payment_status` à `paid`.
4. Logs de `geniuspay-webhook` : `Forwarded to ecomfy-pay-webhook` avec `status: 200`.
5. Régression : un paiement d'abonnement (ou un événement rejoué) est toujours traité par `geniuspay-webhook` (ligne dans `webhook_events`, abonnement activé).

## 5. Rattrapage de `ECM-PAY-6L3Z341U23`

La signature de l'événement d'origine est périmée (tolérance de 5 minutes) : le rejouer tel quel est refusé. Dans l'ordre :
1. Demander à GeniusPay de renvoyer l'événement (si leur tableau de bord le permet) **après** le déploiement.
2. Sinon, après avoir vérifié chez GeniusPay que le paiement est `completed` et son montant (10 500), appeler `confirm_ecomfy_payment` à la main avec ses paramètres (`p_internal_reference`, `p_provider_reference`, `p_outcome = 'SUCCEEDED'`, `p_remote_amount`, `p_remote_currency`, `p_event_id`, `p_event_type`, `p_payload`). Fonction idempotente.

## 6. Les 14 autres paiements `PENDING`

Aucun `payment.success` reçu : abandons. Après vérification dans le tableau de bord GeniusPay, les passer en `EXPIRED` et traiter leurs commandes (`new` / `processing` avec `payment_status = pending`). À décider avec le propriétaire de chaque boutique.

## 7. Anti-récidive (à faire)

`expire_stale_pending_payments` et `reconcile-pending-payments` ne lisent que `payments`, jamais `ecomfy_payments` : un paiement Ecomfy Pay abandonné reste `PENDING` indéfiniment. Ajouter une expiration (par exemple 24 h) et un rapprochement par `fetchPayment`.

## 8. Retour arrière

Redéployer la version précédente : `git checkout 1d97a70 -- supabase/functions/geniuspay-webhook`, déployer, puis revenir à `HEAD`. Sans effet de bord en base.

## 9. Scripts de diagnostic

- `supabase/maintenance/surveillance_post_deploiement.sql` : tableau de surveillance en lecture seule (cron, boutiques verrouillées, paiements, file d'e-mails, commandes).
- `supabase/maintenance/diagnostic_paiements_pending.sql` : détail des paiements Ecomfy Pay en `PENDING`.

## Test sandbox GeniusPay de bout en bout sur la dev — réussi (06/11/2026)

Environnement : dev (`xfpbpxncserliskrbaim`), front local, boutique de test du fondateur, clés GeniusPay **sandbox** posées sur la dev, URL de webhook GeniusPay pointée sur `…/functions/v1/geniuspay-webhook`. Fonctions déployées depuis le code actuel : `geniuspay-webhook`, `ecomfy-pay-initiate`, `ecomfy-pay-webhook`, `ecomfy-pay-settlement`, `ecomfy-pay-withdraw`.

| Étape | Résultat constaté |
|---|---|
| Commande boutique, Mobile Money, 200 FCFA (quantité 2 × 100) | commande créée, paiement `PENDING` avec `provider_reference = SANDBOX_…` |
| Redirection vers GeniusPay | page « Environnement Sandbox », montant 200 XOF, scénario « Paiement réussi » |
| Paiement simulé sur la page sandbox | « Paiement Réussi », puis retour sur `/order-confirmed?payment_ref=ECM-PAY-…` |
| Webhook (aiguillage `geniuspay-webhook` → `ecomfy-pay-webhook`) | paiement `SUCCEEDED`, commande `payment_status = paid` (`VP-20261106-ADEC1`) |
| Ledger | une écriture `CREDIT`, brut 200, frais Ecomfy 5, frais opérateur 0, opérateur `mobile_money` |
| Page client | « Félicitations, votre commande est confirmée » avec le numéro de commande |

**Trois défauts trouvés par ce test, corrigés dans `_shared/operators/geniuspay.ts` et `ecomfy-pay-initiate` :**

1. **Montant minimum GeniusPay : 200 XOF.** En dessous, l'API répond 422 (« Le montant minimum pour XOF est 200 »). Un produit à 100 FCFA ne peut pas être payé en ligne ; la démo et les recettes doivent partir de 200 FCFA.
2. **Sans `Accept: application/json`, GeniusPay répond à un refus par une redirection vers sa page d'accueil** (HTML, code 200 après suivi) : le motif réel disparaissait et le client voyait « service de paiement indisponible ». L'en-tête est maintenant envoyé sur tous les appels du connecteur (paiement, relecture, retrait).
3. **Diagnostic.** Le connecteur lit `error.message` avant `message` (GeniusPay met « Une erreur est survenue » en `message` et le vrai motif dans `error.message`), accepte le lien de paiement sous `checkout_url`, `payment_url`, `redirect_url`, `url` ou `link` (sous `data`, `result` ou à la racine, comme `process-payment`), et `ecomfy-pay-initiate` enregistre le motif brut (code HTTP, message, extrait de la réponse) dans `ecomfy_payments.metadata.gateway_error` quand le paiement échoue. Le client, lui, ne voit toujours qu'un message générique. Tests `operator-connector.test.ts` : 16 / 16.

**Limites relevées pendant le test**
- `create_public_order` limite à **5 commandes par heure par couple boutique + téléphone** (erreur 400 sans message visible côté client). Changer de numéro entre deux essais.
- `wallet_ledger.is_sandbox` reste `false` : aucune fonction ne renseigne ce champ, donc un paiement sandbox (référence `SANDBOX_…`) est compté comme un vrai dans le ledger. Sans effet sur la dev ; à traiter avant de brancher des clés sandbox ailleurs.

**Toujours non testé :** webhook en double, signature fausse (401), refus 503 sans confirmation de l'opérateur, scénarios « échec » et « annulation » de la page sandbox, retrait (`ecomfy-pay-withdraw`) et sa clôture par webhook `payout.*`, et la **production** (le correctif est commité mais pas déployé : prod à faire, voir les guides ci-dessus).
