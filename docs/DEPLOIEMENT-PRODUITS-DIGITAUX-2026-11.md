# Produits digitaux : création et vente (12/11/2026)

**Branche :** `jeanmarc` · **État :** code écrit, migration testée sur **base jetable** (38 cas sur 38, migration passée deux fois) · **rien n'est appliqué sur la dev ni sur la prod** · **non commité** · **jamais vu dans un navigateur**.

## Ce qui existait

« Produit numérique » n'était qu'un drapeau (`products.is_digital` → badge « Digital »). Aucun fichier déposé, aucune remise après paiement, adresse et paiement à la livraison demandés comme pour un colis, produit « en rupture » dès que `stock_quantity` tombait à 0. La colonne `products.digital_file_url` existait mais la politique publique de lecture des produits l'aurait exposée : y mettre un lien = le publier.

## Ce qui est ajouté

| Où | Quoi |
|---|---|
| Base | Bucket **privé** `digital-products` (50 Mo/fichier, types listés, pas d'exécutable) ; table `product_digital_files` (10 fichiers max par produit) ; `digital_order_access` (un jeton secret de 64 hex par commande contenant un produit digital, créé par trigger) ; `digital_download_log` ; colonne `products.digital_download_limit` (5 par défaut, NULL = illimité) |
| Garde serveur | Produit digital + paiement à la livraison = **refusé** par trigger (annule toute la transaction de `create_public_order`, sans toucher à cette fonction) |
| Garde serveur | `products.digital_file_url` forcé à NULL pour `anon` / `authenticated` |
| Edge Function | `digital-download` (niveau « public ») : `resolve` (référence de paiement → jeton), `list`, `link` (lien signé de 60 s). Droit **recalculé à chaque demande** depuis `orders.payment_status = 'paid'` : un remboursement coupe l'accès sans code en plus. Limitation de débit par IP. |
| Front marchand | Section « Fichiers à vendre » dans l'éditeur de produit (dépôt multiple, vérification par lien signé, suppression, limite de téléchargements) ; textes de l'assistant et de l'éditeur mis à jour |
| Front acheteur | Page `/telechargement/:token` ; bloc « Accéder à mes téléchargements » sur `/order-confirmed?payment_ref=…` dès que le webhook a confirmé le paiement ; Mobile Money seul proposé ; ville et adresse non exigées si tout le panier est digital ; plus de faux « rupture de stock » |

Aucun changement dans les fonctions de paiement (`ecomfy_pay_confirm_transaction`, webhooks) : la livraison est tirée par l'acheteur, pas poussée.

## Remise du lien par e-mail (ajouté le 12/11)

Le lien n'existait d'abord que sur la page de retour de paiement : fermer l'onglet = perdre l'achat. Désormais :
- **Mail automatique** `digital-order-ready` (modèle `supabase/functions/_shared/transactional-email-templates/digital-order-ready.tsx`) envoyé par `ecomfy-pay-webhook` dès que la commande est payée, via `_shared/digital-delivery.ts`. Clé d'idempotence `digital-ready-<commande>` : un seul mail même si le webhook est rejoué, et un envoi raté est repris à la livraison suivante du webhook. Best-effort : un échec d'envoi ne bloque jamais le paiement.
- **E-mail obligatoire** pour un panier digital : champ forcé visible et requis dans `ProductView` et `ShopView` même si la boutique l'a désactivé, **et** refus côté serveur (trigger) d'une commande digitale sans e-mail.
- **Lien perdu** : page `/telechargement` (n° de commande + e-mail) → action `recover` de `digital-download` : renvoie le mail à l'adresse de la commande, réponse toujours identique, jeton jamais affiché, 5 demandes / 10 min / IP, un renvoi par commande et par heure.

Limite connue : le balayage `ecomfy-pay-settlement` (paiement SUCCEEDED rattrapé plus tard) ne déclenche pas le mail ; l'acheteur a alors la page de retour et le formulaire « lien perdu ».

## Déploiement (ordre obligatoire)

Vérifier d'abord le projet Supabase lié (`supabase projects list`) : le lien CLI change de projet. Dev = `xfpbpxncserliskrbaim` (« ecomfy dev »), prod = `yfggrceynzcwklbxhgix`.

1. **Migration** : `npx supabase db query --linked -f supabase/migrations/20261112120000_digital_products.sql` (jamais `db push`). Idempotente.
2. **Edge Functions** (Windows : `--use-api`) : `digital-download`, `ecomfy-pay-webhook`, **`send-transactional-email`** (le registre des modèles est embarqué dans cette fonction : sans redéploiement, le modèle est introuvable).
3. **Front** (Vercel / fusion).

Un front déployé avant la migration affiche une section vide en erreur ; un front ancien après la migration continue de fonctionner (les produits digitaux existants passent simplement en Mobile Money seul côté serveur).

Limite globale de taille d'envoi : celle du projet Supabase (50 Mo par défaut en plan gratuit) l'emporte sur celle du bucket.

## Recette sur la dev du 12/11/2026 (navigateur + sandbox GeniusPay)

Migration et fonctions (`digital-download`, `ecomfy-pay-webhook`, `send-transactional-email`) déployées sur la dev. Vérifié de bout en bout :
- création d'un produit digital (assistant), dépôt d'un PDF dans « Fichiers à vendre » ; fichier illisible pour un visiteur (« Bucket not found ») ;
- achat avec e-mail obligatoire, Mobile Money seul, paiement sandbox → webhook → bouton de téléchargement sur `/order-confirmed` → page `/telechargement/<jeton>` ;
- limite : 4 téléchargements acceptés, le 5ᵉ refusé (403), compteur « restants » exact, contenu servi = le PDF ;
- mail `digital-order-ready` envoyé (redirigé vers la boîte Yopmail de la dev, `EMAIL_MODE=redirect`) puis renvoi via le formulaire « lien perdu » ;
- serveur : produit digital + paiement à la livraison refusé, commande digitale sans e-mail refusée.

Trois défauts trouvés pendant la recette, corrigés et revérifiés : bannière « il ne reste que 10 articles en stock » sur un produit digital ; ville et adresse toujours demandées pour un panier 100 % digital ; message de confirmation « un conseiller va vous appeler pour la livraison ».

**Non testé** : panier mixte (physique + digital) dans le navigateur, suppression d'un fichier après achat, remboursement qui coupe l'accès, commande directe de la page d'accueil, rendu mobile.

Traces laissées sur la dev : boutique BOUTIQUE TEST activée et publiée le 12/11 par paiement manuel `MANUAL-ACTIVATION-DEVTEST-20261112` (1300 XOF, via `apply_shop_activation`) ; produit « Guide E-commerce PDF (test digital) » + 1 fichier ; commandes `VP-20261112-2509A` et `VP-20261112-DAE1A` (payées, sandbox).

## Avant de migrer la prod : produits existants

```sql
-- Produits digitaux déjà créés (aucun fichier n'existe : ils restent des « services » livrés à la main)
select count(*) from products where is_digital;
-- Liens hérités qui auraient été lisibles publiquement : à vider après lecture (le trigger les masque pour les futurs écrits)
select id, shop_id, digital_file_url from products where digital_file_url is not null;
```

La migration ne remplit pas rétroactivement d'accès pour les anciennes commandes (aucun fichier n'existait à livrer).

## Tests

- Base jetable : `psql -v ON_ERROR_STOP=1 -f supabase/tests/digital_products.sql -f supabase/migrations/20261112120000_digital_products.sql -f supabase/migrations/20261112120000_digital_products.sql -f supabase/tests/digital_products_cases.sql` → rapport « 38 cas, 0 en échec » (la dernière ligne est une exception voulue qui annule tout). Contre-épreuve faite : deux gardes retirées → 4 cas échouent (contre-épreuve faite avant l’ajout de la garde e-mail).
- `npm run typecheck` : aucune nouvelle erreur ; eslint propre sur les fichiers ajoutés ; `deno check` de la fonction : OK.
- **Non testé** : les Edge Functions en réel (jamais déployées : `digital-download`, webhook, mail), le dépôt d'un vrai fichier, un paiement sandbox de bout en bout, le rendu navigateur.

## Recette à faire sur la dev après déploiement

1. Éditeur d'un produit → option avancée « Produit numérique » → section « Fichiers à vendre » : déposer un PDF, le télécharger pour vérifier, régler la limite.
2. Boutique publique : badge « Digital », pas de « rupture de stock » à stock 0, panier digital → seul Mobile Money, adresse non exigée.
3. Paiement sandbox GeniusPay (min 200 XOF) → mail reçu avec le lien ; retour `/order-confirmed?payment_ref=…` → bouton → page de téléchargement → télécharger N+1 fois : refus à la limite.
4. Commande non payée : la page de téléchargement affiche « en attente » et aucun nom de fichier. Rembourser/annuler : accès coupé.
5. Panier mixte (physique + digital) : Mobile Money seul, adresse exigée.

## Points connus, non traités

- La commande directe de la page d'accueil (`ShopView`, paiement `cod`) échoue avec le message serveur si le produit est digital ; pas de message dédié dans l'interface.
- `/order-confirmed` garde son message par défaut « un conseiller va vous appeler pour la livraison », faux pour un produit digital.
- Dans `ShopView`, le bouton Mobile Money n'est pas pré-sélectionné visuellement pour un panier digital (la valeur envoyée est bien Mobile Money).
- Pas de filigrane ni de protection anti-partage du fichier téléchargé ; le lien de la page est personnel.
- Le marchand voit le nombre de téléchargements par fichier en base (`digital_download_log`), pas encore dans l'interface.
