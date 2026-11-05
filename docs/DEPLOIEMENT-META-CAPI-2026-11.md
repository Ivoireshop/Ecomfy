# Déploiement — Meta CAPI : réconciliation, Purchase serveur, verrouillage (04/11/2026)

**Projet prod :** `yfggrceynzcwklbxhgix` · **Branche :** `jeanmarc` (commits `17fe936`, `2d3b799`, `6bbdac9`, `7368061`). **Ne jamais utiliser `supabase db push`** : appliquer uniquement le fichier SQL ci-dessous dans l'éditeur SQL, puis les Edge Functions, puis le front. Le projet lié du CLI peut pointer sur autre chose que la prod : toujours passer `--project-ref`. **État : commité, non poussé, non déployé, non testé avec de vraies clés Meta.**

Vérifié en local seulement : types des 6 fonctions (`deno check`), types du front, normalisations, migration sur un Postgres jetable (rejouable, droits et RLS corrects).

## 1. Ce qui était cassé (audit du 04/11)

| # | Problème | Effet |
|---|---|---|
| 1 | `reconcile-tracking` lisait `shops.facebook_pixel_id` (jamais créée) et `shops.facebook_access_token` (supprimée le 24/05) | La page « Réconciliation » répondait toujours 403 « Boutique non trouvée ou accès refusé » |
| 2 | La même fonction inventait des chiffres (85 % reçus, 70 % attribués, 80 % par jour) et des catégories de commandes tirées au hasard | Le marchand lisait des données fausses |
| 3 | Aucun `Purchase` n'était envoyé pour un paiement en ligne : le client revient du prestataire sans état (`/order-confirmed?payment_ref=…`) et `ecomfy-pay-webhook` n'envoyait rien | Meta ne voyait pas les ventes en ligne |
| 4 | `track-conversion` est public (`verify_jwt = false`) et acceptait n'importe quel `Purchase` pour n'importe quelle boutique | Faux achats possibles sur le pixel d'un marchand, avec son propre jeton |
| 5 | Seul le code HTTP de Meta était gardé, puis jeté | Un jeton expiré ne se voyait que chez Meta |
| 6 | `ShopView` créait la commande mobile money puis affichait « commande confirmée » sans lancer le paiement | Commandes `pending` jamais payables |
| 7 | API Graph figée en v19.0 ; nom complet haché comme prénom ; pas d'`external_id` | Fin de vie de l'API probable, correspondance dégradée |

## 2. Ce qui change

- **`reconcile-tracking`** : lit le jeton dans `shop_secrets`, les pixels dans `shops.facebook_pixels`, les achats Meta par l'API Insights du compte publicitaire lié (`ad_accounts`). Sans compte lié, les valeurs Meta sont `null` et la page l'explique. **Le chiffre Meta est le nombre d'achats attribués aux publicités, pas le nombre d'événements reçus** : un écart n'est pas forcément une perte.
- **`track-conversion`** :
  - `Purchase` exige une commande réelle de la boutique (`order_id` = numéro ou UUID).
  - Navigateur : montant relu en base ; refusé si la commande est `mobile_money` (réponse `purchase_from_server_only`), annulée, ou de plus de 48 h.
  - Webhooks : reconnus à l'en-tête `Authorization: Bearer <service_role>`.
  - Limiteur de débit indisponible : les `Purchase` du navigateur sont refusés.
  - Réponse de Meta lue (`events_received`, `fbtrace_id`, erreur), journalisée, résumée par pixel dans `tracking_delivery_status`.
  - Envois en parallèle, délai maximal de 8 s. Le détail des résultats n'est renvoyé qu'aux appels du serveur.
  - API Graph **v23.0** par défaut. IP lue depuis `cf-connecting-ip` en premier.
- **`ecomfy-pay-initiate`** : mémorise `fbp`, `fbc`, agent utilisateur, IP et URL du visiteur dans `ecomfy_payments.metadata.tracking`.
- **`ecomfy-pay-webhook`** : après `confirm_ecomfy_payment`, si `steps.order = "updated"` (la commande vient de passer à payée), envoie le `Purchase` via `track-conversion`. Pas de doublon si le prestataire rejoue l'événement ; l'`event_id` (`ord_<n° de commande>`) est le même que côté navigateur.
- **`geniuspay-webhook`** : n'écrit plus `orders.status` (colonne inexistante, l'écriture échouait sans bruit). Volontairement non remplacée : cette branche ne compare pas le montant à la commande.
- **`sync-ad-spend`** : même version d'API.
- **Front** : nouvelle carte « État des envois serveur » ; nom complet découpé en prénom et nom ; avertissement quand un code de test Meta est renseigné ; `ShopView` lance le paiement mobile money.

## 3. Avant de commencer

1. **Confirmer la version d'API.** `v23.0` a été choisie de mémoire. Vérifier dans le changelog de Meta qu'elle est valide, ou fixer une autre version (étape 5).
2. Relire en lecture seule l'état de la prod (migrations appliquées, fonctions déployées) : ce guide date du 04/11.
3. Si un test sur la dev est voulu : la dev est une copie de la prod du 04/11 (migrations ≥ `20261016` et correctifs de fonctions effacés). Redéployer d'abord ce qui est en attente avant tout test.

## 4. Migration (éditeur SQL de la production)

Fichier : `supabase/migrations/20261104100000_tracking_delivery_status.sql`. Rejouable. Le coller dans l'éditeur SQL, entouré de `begin; … commit;`, puis :

```powershell
npx supabase@latest migration repair --status applied 20261104100000 --project-ref yfggrceynzcwklbxhgix
```

Elle crée `tracking_delivery_status` (lecture réservée au propriétaire de la boutique, aucune écriture directe) et la fonction `record_tracking_delivery` (réservée à `service_role`). **Sans elle, tout fonctionne** : l'enregistrement est tolérant à l'erreur, seule la carte d'état reste vide.

## 5. Secret optionnel

```powershell
npx supabase@latest secrets set META_GRAPH_VERSION=v23.0 --project-ref yfggrceynzcwklbxhgix
```

Seulement si la version par défaut doit changer. Une valeur qui n'a pas la forme `vNN.N` est ignorée (retour à `v23.0`). Le changement s'applique sans redéployer le code.

## 6. Edge Functions

Dans cet ordre (`track-conversion` d'abord, car le webhook l'appelle) :

```powershell
$P = "yfggrceynzcwklbxhgix"
npx supabase@latest functions deploy track-conversion --project-ref $P --use-api --no-verify-jwt
npx supabase@latest functions deploy ecomfy-pay-initiate --project-ref $P --use-api
npx supabase@latest functions deploy ecomfy-pay-webhook --project-ref $P --use-api --no-verify-jwt
npx supabase@latest functions deploy geniuspay-webhook --project-ref $P --use-api --no-verify-jwt
npx supabase@latest functions deploy reconcile-tracking --project-ref $P --use-api
npx supabase@latest functions deploy sync-ad-spend --project-ref $P --use-api
```

`supabase/config.toml` (vérifié le 04/11) déclare `verify_jwt = false` pour `track-conversion`, `ecomfy-pay-webhook`, `geniuspay-webhook` et `sync-ad-spend` ; les webhooks du prestataire n'ont pas de jeton Supabase. `ecomfy-pay-initiate` et `reconcile-tracking` gardent la vérification par défaut (le front les appelle avec la session ou la clé publique, comme avant).

Puis le front (déploiement habituel). L'ordre entre fonctions et front n'est pas bloquant : un ancien front continue de fonctionner, il n'envoie simplement pas le contexte publicitaire pour les paiements en ligne.

## 7. Tests (obligatoires avant de rouvrir les campagnes)

Utiliser une boutique de test avec un pixel Meta et un jeton valides, et **renseigner un code de test** dans les réglages (Gestionnaire d'événements > Événements de test). Le vider ensuite.

1. **Paiement à la livraison.** Commander. Dans « Événements de test » : un `Purchase` navigateur et un `Purchase` serveur avec le même identifiant `ord_<n°>`, marqué « dédupliqué ».
2. **Paiement en ligne** (petit montant réel). Après paiement :
   - `ecomfy_payments` passe à `SUCCEEDED`, la commande à `payment_status = paid` ;
   - un `Purchase` serveur apparaît chez Meta, avec le bon montant, l'e-mail et le téléphone hachés, `fbp`/`fbc` si le client venait d'une publicité ;
   - logs de `ecomfy-pay-webhook` : pas d'avertissement `Purchase serveur non envoyé`.
3. **Rejeu** : renvoyer le même webhook ; aucun second `Purchase`.
4. **Page boutique, mobile money** : redirection vers le prestataire (avant : « commande confirmée » sans paiement). Échec de paiement : panier conservé et message d'erreur.
5. **Jeton volontairement faux** sur la boutique de test, puis une commande : la carte « État des envois serveur » passe en rouge avec « Le jeton d'accès Meta est expiré ou invalide ». Remettre le bon jeton ; elle repasse au vert au prochain envoi.
6. **Verrouillage** (sans clé de confiance, avec la clé publique `anon`) :
   ```powershell
   $body = '{"shop_id":"<uuid boutique>","event":"Purchase","event_id":"ord_FAUX","payload":{"order_id":"FAUX","value":99999}}'
   Invoke-RestMethod -Method Post -Uri "https://yfggrceynzcwklbxhgix.supabase.co/functions/v1/track-conversion" -ContentType "application/json" -Headers @{ apikey = "<clé anon>" } -Body $body
   ```
   Attendu : `success: false`, `error: "order_not_found"`. Avec le numéro d'une commande mobile money : `purchase_from_server_only`.
7. **Page « Réconciliation »** : plus de 403. Sans compte publicitaire lié, bandeau explicatif et colonnes Meta à « — ». Avec un compte lié, les achats attribués s'affichent par jour.
8. **Régression** : un paiement d'abonnement ou d'activation est toujours traité par `geniuspay-webhook` (ligne dans `webhook_events`).

## 8. Requêtes de contrôle (lecture seule)

```sql
-- État des envois par pixel
select shop_id, provider, pixel_id, last_ok, consecutive_failures, last_error_code, last_error, last_success_at, last_failure_at
from tracking_delivery_status order by last_ok, last_failure_at desc nulls last;

-- Contexte publicitaire mémorisé avec les paiements en ligne récents
select internal_reference, status, created_at, metadata->'tracking' as tracking
from ecomfy_payments order by created_at desc limit 20;

-- Commandes mobile money créées par l'ancienne page boutique, jamais payées (voir section 9)
select o.order_number, o.shop_id, o.total, o.created_at
from orders o
where o.payment_method = 'mobile_money' and o.payment_status = 'pending'
  and not exists (select 1 from ecomfy_payments p where p.order_id = o.id)
order by o.created_at desc;
```

## 9. Commandes créées par l'ancien `ShopView`

Les commandes de la dernière requête ont été créées en mobile money sans que le paiement soit lancé : le client a vu « commande confirmée » sans payer. À traiter avec le propriétaire de chaque boutique (contacter le client pour un paiement à la livraison ou annuler). Aucune action automatique.

## 10. Limites connues

- Si la commande est marquée payée par le balayage `ecomfy-pay-settlement` et non par le webhook, **aucun `Purchase` n'est envoyé**.
- L'IP du visiteur est stockée dans `ecomfy_payments.metadata`, lisible par le marchand propriétaire du paiement.
- Le `Purchase` du paiement à la livraison part à la **création** de la commande (choix métier à confirmer), donc il compte aussi les commandes qui seront refusées à la livraison.
- Pas de contrôle de consentement cookies ; le jeton Meta est toujours passé en paramètre d'URL.
- `geniuspay-webhook` envoie encore un `Purchase` pour ses paiements de plateforme à partir de `metadata` : désormais filtré par la vérification de commande de `track-conversion`.
- Le rapprochement des événements CAPI **reçus** n'est pas possible par l'API Insights ; la page compare aux achats attribués.

## 11. Retour arrière

Fonctions : `git checkout 940c7f3 -- supabase/functions/track-conversion supabase/functions/ecomfy-pay-initiate supabase/functions/ecomfy-pay-webhook supabase/functions/geniuspay-webhook supabase/functions/reconcile-tracking supabase/functions/sync-ad-spend`, redéployer, puis revenir à `HEAD`. Front : redéployer la version précédente. La table `tracking_delivery_status` peut rester (inoffensive) ; sinon `drop table tracking_delivery_status; drop function record_tracking_delivery(uuid, text, text, boolean, integer, text, text, text);`.
