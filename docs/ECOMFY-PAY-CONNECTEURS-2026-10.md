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

**Non testé sur dev** (pas de clés GeniusPay, pas de secret de webhook, aucun marchand avec KYC et solde) : redirection vers l'opérateur, webhook signé (paiement `SUCCEEDED` / `FAILED`, doublon, 401 sur signature fausse, 503 sans confirmation de l'opérateur), retrait et sa clôture par webhook `payout.*`. À rejouer en sandbox GeniusPay avant ou juste après la production : poser `GENIUSPAY_API_KEY`, `GENIUSPAY_API_SECRET`, `GENIUSPAY_WEBHOOK_SECRET`, payer un lien de 1000 FCFA, vérifier la redirection, puis la ligne `SUCCEEDED` et l'écriture `PAYMENT_*` au ledger.

Données de test laissées sur dev : paiements `ECM-PAY-75E3ADF497E4`, `ECM-PAY-31E61C3C4054`, `ECM-PAY-24BAE3959BEA` (`PENDING`) et la commande `VP-20261023-479C0`.

Test préexistant en échec, sans rapport : `pricing.test.ts` « ecomfy-pay-webhook compare le montant GeniusPay avant de créditer » (la comparaison est désormais dans `confirm_ecomfy_payment`).

## Hors périmètre

`process-payment`, `verify-payment`, `geniuspay-webhook` et `reconcile-pending-payments` (abonnements, activations, commissions) appellent encore GeniusPay directement ; ils peuvent adopter `fetchPayment` plus tard.
