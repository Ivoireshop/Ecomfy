# Ecomfy Pay — interface commune des connecteurs opérateurs

Code : `supabase/functions/_shared/operators/` · tests : `supabase/tests/operator-connector.test.ts`
(`node --experimental-strip-types --test supabase/tests/operator-connector.test.ts`).

## Principe

Les trois Edge Functions d'Ecomfy Pay (`ecomfy-pay-initiate`, `ecomfy-pay-webhook`, `ecomfy-pay-withdraw`) ne parlent plus à GeniusPay directement : elles appellent un `OperatorConnector`. Ajouter un opérateur (Wave, Orange Money, MTN, Moov en direct) = écrire un connecteur et l'inscrire dans `CONNECTORS` (`_shared/operators/index.ts`). Aucune migration, aucun changement de front.

## Contrat (`types.ts`)

| Méthode | Rôle | Résultat |
|---|---|---|
| `isConfigured()` | identifiants API présents ? (sinon mode dev : paiement `PENDING`, retrait `REQUESTED`) | booléen |
| `initiatePayment(req)` | crée le paiement, renvoie la page de l'opérateur | `{ok:true, checkoutUrl, providerReference?}` ou `{ok:false, httpStatus?, reason}` |
| `fetchPayment(ref)` | relit le paiement (le webhook ne croit jamais son seul contenu) | `{kind:"unavailable"}` ou `{kind:"ok", status, amount, currency}` ; `status` ∈ `SUCCEEDED / PENDING / FAILED / UNKNOWN` |
| `initiatePayout(req)` | demande le versement d'un retrait | `ACCEPTED` → `PROCESSING` · `REJECTED` (4xx) → `finalize_withdrawal(FAILED)`, solde recrédité · `UNKNOWN` (réseau, 5xx, 2xx ambigu) → reste `REQUESTED`, clôturé par le webhook |
| `verifyWebhook(rawBody, headers)` | authentifie la livraison avant toute lecture | `{ok:true}` ou `{ok:false, status:401\|500}` |
| `parseWebhook(rawBody, headers)` | normalise l'événement | `invalid` · `ignored` · `payment` · `payout` (avec `outcome`, `eventId`, références) |

Règles : un connecteur **ne lève pas d'exception** pour un incident opérateur, **n'écrit jamais en base** et **ne lit pas l'environnement** (configuration injectée ; seul `index.ts` lit `Deno.env`). `UNKNOWN` n'est jamais traité comme un succès.

## Sélection de l'opérateur

- Nouveaux encaissements et retraits : variable `ECOMFY_PAY_PROVIDER` (défaut `geniuspay`) ; la valeur est inscrite dans `ecomfy_payments.provider`.
- Webhook : `…/ecomfy-pay-webhook?provider=<id>` (défaut `geniuspay`, donc l'URL déjà déclarée chez GeniusPay continue de fonctionner) ; identifiant inconnu → 404.

## Déploiement

Pas de migration, pas de nouveau secret, pas de changement de front. Seules 3 Edge Functions changent (elles embarquent `_shared/operators/`) : `ecomfy-pay-initiate`, `ecomfy-pay-webhook`, `ecomfy-pay-withdraw`. Ne jamais utiliser `supabase db push`.

| Environnement | État |
|---|---|
| Dev (`xfpbpxncserliskrbaim`) | **Déployé le 23/10/2026** (3 fonctions), testé (section suivante) |
| Production (`yfggrceynzcwklbxhgix`) | **À faire**, après les migrations Ecomfy Pay en attente (voir `DEPLOIEMENT-LEDGER-PAY-2026-10.md`) |

PowerShell, depuis `C:\dev\Ecomfy` (sous Windows, `--use-api` : le bundling Docker échoue) :

```powershell
$P = "yfggrceynzcwklbxhgix"   # production ; dev : xfpbpxncserliskrbaim
npx supabase@latest functions deploy ecomfy-pay-initiate --project-ref $P --use-api
npx supabase@latest functions deploy ecomfy-pay-webhook  --project-ref $P --use-api
npx supabase@latest functions deploy ecomfy-pay-withdraw --project-ref $P --use-api
```

Retour arrière : redéployer les trois fonctions depuis le commit précédent la refonte (`git checkout <commit-précédent> -- supabase/functions` puis les mêmes commandes). Aucune donnée n'est touchée par ce déploiement.

Le comportement avec GeniusPay est identique, à deux nuances près :

1. une erreur **réseau** lors de la création du paiement est maintenant traitée comme un refus de l'opérateur (paiement `FAILED`, commande annulée, réponse 502) au lieu d'une erreur 500 qui laissait le paiement `PENDING` ;
2. le statut distant `succeeded` est accepté en plus de `completed` / `paid` / `success`.

## Vérifié sur dev (23/10/2026)

Front local (`npm run dev`) contre dev, sans clés GeniusPay (mode « sans clés » : le paiement reste `PENDING`, pas de redirection).

| Test | Résultat |
|---|---|
| Lien de paiement `/pay/<clé>`, Wave, 1000 FCFA (Chrome) | écran « Paiement en cours de traitement » ; ligne `PENDING`, `provider = geniuspay` |
| Commande boutique, Mobile Money, 5000 FCFA (Chrome) | page « commande confirmée » ; paiement relié à la commande, 5000 relus côté serveur, frais 125, net 4875 |
| `ecomfy-pay-initiate` : corps vide, montant texte, boutique inconnue, ni lien ni commande, montant ≠ lien, lien d'une autre boutique | 400 / 400 / 404 / 400 / 400 / 404 |
| `ecomfy-pay-initiate` : lien valide en carte | 200, paiement `PENDING` |
| `ecomfy-pay-withdraw` : sans jeton, jeton anonyme, sans en-tête | 401 |
| `ecomfy-pay-webhook` : sans secret / `?provider=inconnu` / OPTIONS | 500 / 404 / 200 |
| `node --experimental-strip-types --test supabase/tests/operator-connector.test.ts` | 14 / 14 |

**Mise à jour du 06/11/2026 : le paiement client a été testé en sandbox GeniusPay sur la dev et fonctionne de bout en bout** (redirection, webhook signé, paiement `SUCCEEDED`, commande payée, écriture au ledger) : voir la section « Test sandbox GeniusPay de bout en bout » ci-dessous. Ce test a révélé et fait corriger trois défauts du connecteur (minimum 200 XOF, en-tête `Accept`, diagnostic des refus).

**Encore non testé** (en sandbox) : webhook en double, 401 sur signature fausse, 503 sans confirmation de l'opérateur, retrait et sa clôture par webhook `payout.*`. Pour les rejouer : payer un lien d'au moins 200 FCFA, puis vérifier la ligne `SUCCEEDED` et l'écriture `PAYMENT_*` au ledger.

Données de test laissées sur dev : paiements `ECM-PAY-75E3ADF497E4`, `ECM-PAY-31E61C3C4054`, `ECM-PAY-24BAE3959BEA` (`PENDING`) et la commande `VP-20261023-479C0`.

Test préexistant en échec, sans rapport : `pricing.test.ts` « ecomfy-pay-webhook compare le montant GeniusPay avant de créditer » (la comparaison est désormais dans `confirm_ecomfy_payment`).

## Hors périmètre

`process-payment`, `verify-payment`, `geniuspay-webhook` et `reconcile-pending-payments` (abonnements, activations, commissions) appellent encore GeniusPay directement ; ils peuvent adopter `fetchPayment` plus tard.

### Test sandbox GeniusPay de bout en bout sur la dev — réussi (06/11/2026)

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
