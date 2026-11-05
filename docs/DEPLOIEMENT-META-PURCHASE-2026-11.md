# Déploiement — Meta : Purchase fiable (order_id, event_id, déduplication) (05/11/2026)

**Projet prod :** `yfggrceynzcwklbxhgix` · **Branche :** `jeanmarc`. **Ne jamais utiliser `supabase db push`** : appliquer le fichier SQL ci-dessous dans l'éditeur SQL, puis les Edge Functions, puis le front. Le projet lié du CLI pointe sur la prod : toujours passer `--project-ref`. **État : corrigé dans le code, testé sur base jetable (25 cas), en vitest (6 tests) et dans Chrome sur la dev (5 nov., section 5bis) ; non déployé en prod ; non testé avec de vraies clés Meta ni un vrai opérateur de paiement.**

Suite du guide `DEPLOIEMENT-META-CAPI-2026-11.md` : ce guide **s'ajoute** à lui (mêmes fonctions touchées), il ne le remplace pas.

## 1. Ce qui n'était pas fiable

| # | Problème | Effet |
|---|---|---|
| 1 | `track-conversion` utilisait l'`event_id` envoyé par l'appelant | Un même achat pouvait être rejoué avec des identifiants différents : plusieurs `Purchase` pour une commande, ventes gonflées |
| 2 | Aucun registre des envois | Une nouvelle livraison du webhook, ou un double appel, renvoyait le `Purchase` ; à l'inverse, un envoi raté (Meta indisponible, jeton expiré) était perdu pour de bon |
| 3 | Le `Purchase` serveur ne partait que si `steps.order = "updated"` | Si `track-conversion` échouait une fois, la nouvelle livraison du webhook ne le renvoyait jamais ; commande marquée payée par le balayage = aucun envoi |
| 4 | Retour du prestataire (`/order-confirmed?payment_ref=…`) sans aucun événement navigateur | Pas de pendant « pixel » : la déduplication navigateur/serveur n'était jamais exercée, Meta ne voyait l'achat que côté serveur |
| 5 | `InitiateCheckout` portait le même `event_id` que le `Purchase` (`ord_<n°>`) | Confusion possible sur TikTok / Snapchat / GA4 qui ne séparent pas toujours par nom d'événement |

## 2. Ce qui change

- **Identifiant canonique** : pour un `Purchase`, `track-conversion` recalcule toujours `event_id = ord_<n° de commande>` à partir de la commande trouvée en base, et ignore celui de l'appelant. Même formule côté navigateur (`src/lib/trackingIds.ts`) et serveur (`supabase/functions/_shared/tracking-event-id.ts`) ; un test vérifie qu'elles restent identiques. Les autres événements liés à une commande sont préfixés par leur nom (`initiatecheckout_ord_<n°>`).
- **Registre `tracking_purchase_log`** (une ligne par commande) : l'envoi est *réservé* avant d'être fait (`claim_purchase_send`, atomique), puis clos (`finish_purchase_send`) en `sent`, `failed` ou `skipped` (aucune destination serveur configurée / suivi désactivé). Un `Purchase` déjà parti répond `{ deduplicated: true }` sans rien renvoyer. Le registre garde la liste des destinations servies (`meta:<pixel>`, `tiktok:<pixel>`, `snapchat:<pixel>`, `ga4`) : une reprise n'envoie **qu'aux destinations manquantes**. Une réservation abandonnée depuis plus de 2 min peut être reprise.
- **Envoi serveur idempotent partagé** (`_shared/purchase-capi.ts`) : appelé par `ecomfy-pay-webhook` à **chaque** livraison d'un paiement confirmé (plus seulement à la première) et par `ecomfy-pay-settlement`.
- **Balayage** : `ecomfy-pay-settlement` reprend, à chaque passage, jusqu'à 25 paiements encaissés dont le `Purchase` n'est pas parti (`list_purchases_to_resend` : fenêtre de 72 h, 5 tentatives au plus, délai de grâce de 2 min, commandes annulées ignorées). Il couvre aussi les commandes marquées payées par le rejeu du règlement (limite connue du guide Meta CAPI du 04/11, désormais levée).
- **Page de retour de paiement** : `OrderConfirmed` lit `payment_ref`, interroge `get_payment_return_status`, attend jusqu'à ~24 s la confirmation du webhook, puis envoie le `Purchase` **du pixel seulement** (`serverMirror: false`) avec le même `event_id`. Rien n'est envoyé tant que le paiement n'est pas encaissé, ni si le paiement a échoué. Un rechargement de la page n'envoie rien de plus (`sessionStorage` + `event_id` identique). Le numéro de commande s'affiche aussi sur cette page.
- **Paiement à la livraison** : inchangé (le `Purchase` part à la création de la commande, pixel + serveur avec le même `event_id`), mais désormais protégé du rejeu par le registre.

## 3. Déploiement (dans cet ordre)

1. **Migration** `supabase/migrations/20261105120000_tracking_purchase_log.sql` dans l'éditeur SQL de la prod. Rejouable. Crée la table `tracking_purchase_log` (lecture réservée au propriétaire de la boutique) et 4 fonctions (`claim_purchase_send`, `finish_purchase_send`, `list_purchases_to_resend`, `get_payment_return_status`).
2. **Edge Functions** (3) : `track-conversion`, `ecomfy-pay-webhook`, `ecomfy-pay-settlement` (les fichiers `_shared/` sont embarqués). Si les correctifs Meta CAPI du 04/11 ne sont pas encore en prod, déployer aussi les 4 autres du guide `DEPLOIEMENT-META-CAPI-2026-11.md` (`reconcile-tracking`, `ecomfy-pay-initiate`, `geniuspay-webhook`, `sync-ad-spend`) et appliquer sa migration `20261104100000` **avant**.
   ```
   supabase functions deploy track-conversion ecomfy-pay-webhook ecomfy-pay-settlement --project-ref yfggrceynzcwklbxhgix
   ```
3. **Front** (Vercel) : `OrderConfirmed`, `tracking.ts`, `trackingIds.ts`.

**Ordre et tolérance :** sans la migration, `track-conversion` continue d'envoyer (la réservation échoue, un avertissement est journalisé) mais sans protection de rejeu ni reprise, et le balayage ne trouve rien. Les fonctions peuvent donc être déployées avant la migration sans casser les ventes ; ne pas oublier la migration ensuite. Le front peut être déployé avant : tant que `get_payment_return_status` n'existe pas, la page de retour échoue silencieusement.

## 4. Vérifications après déploiement

```sql
select to_regclass('public.tracking_purchase_log');                                         -- non nul
select proname from pg_proc where proname in ('claim_purchase_send','finish_purchase_send','list_purchases_to_resend','get_payment_return_status');  -- 4 lignes
select has_function_privilege('anon','claim_purchase_send(uuid,uuid,text,text)','EXECUTE'); -- false
select has_function_privilege('anon','get_payment_return_status(text)','EXECUTE');          -- true
```
Après un achat test (commande à la livraison, puis paiement en ligne) :
```sql
select order_id, event_id, status, delivered, attempts, last_error from tracking_purchase_log order by updated_at desc limit 5;
-- attendu : event_id = ord_<n° de commande>, status = sent, une seule ligne par commande
```
Dans le **Gestionnaire d'événements Meta** (onglet « Tester les événements » avec le code de test de la boutique) : un seul `Purchase` par commande, avec la mention « Dédoublonné » / sources « Navigateur et Serveur », même `event_id`. Pour un paiement en ligne : le `Purchase` serveur arrive à l'encaissement, celui du navigateur à l'arrivée sur la page de retour.

## 5. Tests

- `npx vitest run supabase/tests/purchase-dedup.test.ts` : 6 tests (identifiants identiques navigateur/serveur, canonicalisation, câblage webhook / balayage / page de retour).
- Base jetable (25 cas : réservation, rejeu, reprise partielle, réservation périmée, file de reprise, retour de paiement, droits, RLS) :
  ```
  docker run -d --rm --name ecomfy-purchase-test -e POSTGRES_PASSWORD=test postgres:16-alpine
  (cat supabase/tests/tracking_purchase_log.sql supabase/migrations/20261105120000_tracking_purchase_log.sql \
       supabase/tests/tracking_purchase_log_cases.sql) | docker exec -i ecomfy-purchase-test psql -U postgres -v ON_ERROR_STOP=1
  ```
- `deno check --node-modules-dir=none` sur `track-conversion`, `ecomfy-pay-webhook`, `ecomfy-pay-settlement` : sans erreur. Aucune erreur de type nouvelle dans le front (celles d'autres fichiers existaient déjà).

## 5bis. Test navigateur sur la dev (5 novembre 2026)

Dev `xfpbpxncserliskrbaim` : migration appliquée et `track-conversion` déployée (le webhook et le balayage n'y sont **pas** déployés : la dev est une copie de la prod avec 11 boutiques portant de vrais jetons Meta, le balayage aurait pu renvoyer de vrais achats). Boutique « BOUTIQUE TEST » (sans jeton), pixel remplacé par un espion `fbq` dans la page : aucun envoi vers Meta.

- **Commande à la livraison par l'interface** : pixel et serveur utilisent le même `event_id` (`ord_<n°>`) ; une seule ligne `skipped` au registre ; pas de second Purchase sur `/order-confirmed`.
- **Appel direct avec un `event_id` falsifié et un montant truqué** : identifiant canonique renvoyé, montant ignoré ; rejeu = `deduplicated: true` ; mobile money refusé depuis le navigateur ; commande inconnue et absence de commande refusées, sans ligne au registre.
- **Mobile money par l'interface** : paiement non démarré (la dev n'a pas de clé d'opérateur, réponse 502) → aucun Purchase, `InitiateCheckout` avec un identifiant distinct (`initiatecheckout_ord_<n°>`), panier conservé.
- **Page de retour (`?payment_ref=`)** : paiement encaissé = un Purchase pixel, aucun appel serveur ; paiement en attente puis encaissé pendant l'attente = Purchase envoyé à ce moment ; référence inconnue ou mal formée, rechargement = rien.
- **Non testé** : webhook, balayage, confirmation d'un vrai paiement, Meta réel, script Facebook réel.

## 6. Limites connues

- **Jamais testé avec de vraies clés Meta ni un vrai opérateur de paiement** : le comportement de Meta (dédoublonnage, `events_received`) reste à constater dans le Gestionnaire d'événements.
- `get_payment_return_status` est appelable sans compte : il ne rend que statut, montant, devise, numéro de commande et slug de boutique, pour une référence de 12 caractères hexadécimaux aléatoires (48 bits). Pas de limiteur de débit sur cette fonction.
- Le `Purchase` du navigateur au retour de paiement ne porte pas l'e-mail ni le téléphone (le navigateur ne les connaît plus) : la correspondance côté pixel repose sur les cookies `_fbp` / `_fbc` ; le serveur, lui, envoie les données client hachées.
- `geniuspay-webhook` (branche sans contrôle de montant) appelle toujours `track-conversion` ; l'identifiant et le registre s'appliquent à lui aussi, côté serveur.
- Le `Purchase` du paiement à la livraison part à la création de la commande, même si elle est annulée ensuite (choix métier inchangé). Aucun événement d'annulation n'est envoyé.
- Un `skipped` (boutique sans jeton CAPI) n'est jamais repris : ajouter un jeton plus tard n'envoie pas les achats passés.
- Pas de contrôle de consentement cookies.
