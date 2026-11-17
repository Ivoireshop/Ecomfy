# Stock par QR code, scan livreur, historique et retours — 17/11/2026

Trois commits de `jeanmarc`, à passer en prod **dans cet ordre** :

| Commit | Contenu | Migration |
|---|---|---|
| `dcadb31` | Stock par QR code : activation par boutique, QR produit, scanner, `record_stock_movement` corrigée | `20261116100000_stock_qr.sql` |
| `1b54250` | Scan du livreur au ramassage, décrémentation du stock, remise en stock au retour de la course | `20261116110000_stock_driver_scan.sql` |
| `c1e11ba` | Historique des mouvements (global et par produit) et action « Retour client » dans le scanner | aucune (front seul) |

Aucune Edge Function. Tout est **désactivé par défaut** : rien ne change pour une boutique tant que son marchand n'a pas activé « Stock par QR code » (Paramètres > Général).

## Pourquoi c'est aussi un correctif de sécurité

L'ancienne `record_stock_movement` (migration du 29/09) lisait `products.stock`, colonne qui n'existe pas (c'est `stock_quantity`), et n'avait **aucun contrôle d'accès** : tout utilisateur connecté pouvait modifier le stock de n'importe quelle boutique. La migration `20261116100000` la réécrit avec contrôle d'appartenance, retire l'INSERT direct sur `stock_movements` (le journal n'est écrit que par des fonctions `SECURITY DEFINER`) et ne laisse la lecture qu'au propriétaire et aux collaborateurs. Si la fonction existe en prod avec l'ancien corps, la passer en prod ferme ce trou, indépendamment de l'usage de la fonctionnalité.

## Ordre de déploiement

**Migrations d'abord, front ensuite.** Le front appelle des fonctions SQL qui n'existent pas avant les migrations.

1. Avant de commencer, vérifier en lecture seule l'état de la prod (voir « Contrôles avant »).
2. Appliquer `20261116100000_stock_qr.sql`.
3. Appliquer `20261116110000_stock_driver_scan.sql` (dépend de la précédente : colonne `stock_qr_code`, `stock_qr_enabled`, journal).
4. Enregistrer l'historique des migrations (`migration repair`).
5. Contrôles après (ci-dessous).
6. Pousser `jeanmarc` puis PR vers `main` (déploiement du front).

Projet prod : `yfggrceynzcwklbxhgix`. **Toujours `--project-ref` explicite, jamais `db push`** : le lien du CLI change de projet d'une session à l'autre, et `db push` rejouerait des migrations volontairement non appliquées (ex. `20260908170000`). Appliquer chaque fichier tel quel, par exemple depuis le SQL Editor du tableau de bord Supabase de la prod, puis :

```
supabase migration repair --status applied 20261116100000 --project-ref yfggrceynzcwklbxhgix
supabase migration repair --status applied 20261116110000 --project-ref yfggrceynzcwklbxhgix
```

(`--project-ref` est déprécié au profit de `--remote` ; les deux fonctionnent.)

## Contrôles avant (lecture seule)

```sql
-- La table du journal existe-t-elle en prod, et avec quelles policies ?
select to_regclass('public.stock_movements');
select policyname, cmd from pg_policies where tablename = 'stock_movements';

-- L'ancienne fonction (sans contrôle d'accès) est-elle présente ?
select pg_get_functiondef(p.oid) from pg_proc p
 where p.proname = 'record_stock_movement' and p.pronamespace = 'public'::regnamespace;

-- Les colonnes existent-elles déjà ?
select column_name from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'shops' and column_name = 'stock_qr_enabled')
     or (table_name = 'products' and column_name = 'stock_qr_code'));
```

La migration crée `stock_movements` seulement si elle est absente (la migration du 29/09 n'a pas été appliquée partout) : elle est donc sûre dans les deux cas. Elle est rejouable.

## Contrôles après

```sql
-- Colonnes, fonctions, trigger
select column_name from information_schema.columns
 where table_schema='public' and column_name in ('stock_qr_enabled','stock_qr_code');          -- 2 lignes
select proname from pg_proc where pronamespace='public'::regnamespace
 and proname in ('get_or_create_product_stock_qr','lookup_product_by_stock_qr','record_stock_movement',
                 'driver_scan_context','get_delivery_scan_status','driver_scan_product','restock_on_delivery_return'); -- 7 lignes
select tgname from pg_trigger where tgname = 'order_deliveries_restock_on_return';              -- 1 ligne

-- Plus d'écriture directe sur le journal pour les utilisateurs connectés
select has_table_privilege('authenticated', 'public.stock_movements', 'INSERT');                -- false
select has_table_privilege('authenticated', 'public.stock_movements', 'SELECT');                -- true

-- Aucune boutique n'a la fonction activée par surprise
select count(*) from public.shops where stock_qr_enabled;                                        -- 0
```

Fonctions du livreur : `driver_scan_context` n'est exécutable par personne (usage interne) ; `get_delivery_scan_status` et `driver_scan_product` sont réservées aux utilisateurs connectés, et vérifient que l'appelant est le livreur actif de la course concernée.

## Ce que fait chaque partie

**Marchand (stock par QR code).** Réglage par boutique dans Paramètres > Général. Une fois activé : un QR (code opaque `ECP-XXXXXXXXXXXX`, il n'expose pas l'identifiant interne) par produit, imprimable ; un bouton « Scanner le stock » (caméra ou saisie du code) pour ajouter ou retirer des unités, chaque mouvement étant journalisé avec son auteur.

**Livreur (scan au ramassage).** Si la boutique a activé la fonction, le livreur scanne l'étiquette de chaque produit de la commande. Chaque scan retire du stock la quantité commandée (mouvement `driver_handover`). Un second scan du même produit ne décrémente pas deux fois. Le stock ne descend jamais sous 0. Le scan **n'est pas bloquant** pour passer la course en « Livré ». Quand la course passe en `returned`, les produits scannés sont remis en stock (`return_restock`, trigger `restock_on_delivery_return`).

**Historique et retours (`c1e11ba`).** « Historique du stock » en haut de la liste des produits et par produit : mouvements du plus récent au plus ancien, 30 à la fois, filtre par type (entrée, sortie, prise en charge livreur, retour, abîmé), avant → après, numéro de commande, note. Dans le scanner, « Retour client : remettre N en stock » enregistre un `return_restock` sans commande associée. Ces boutons n'apparaissent que si le stock par QR est activé.

## À savoir

- **Un retour client manuel n'est pas lié à une commande.** Il remonte le stock mais n'annule pas un scan livreur : le rapprochement scan/retour de la course se fait uniquement sur les mouvements portant la référence de la commande.
- **Quantité du scan livreur = quantité commandée**, pas d'une unité par scan. Un produit commandé en 3 exemplaires retire 3 au premier scan.
- **Stock insuffisant** : le stock est ramené à 0 (jamais négatif) et le scan est signalé `insufficient_stock` ; la prise en charge est quand même journalisée.
- `inventory_units` (QR par unité) n'est pas utilisé : seul le QR par produit existe.
- `stock_movements` garde les types de mouvement acceptés par `record_stock_movement` : `restock`, `adjustment`, `return_restock`, `damaged`. Tout autre type est refusé.
- Réglage désactivé = tout le module reste invisible et les fonctions refusent d'agir (« stock par QR code non activé »). Le désactiver ne supprime ni les codes déjà générés ni le journal.

## Recette conseillée en prod après déploiement

Sur une boutique de test (ne pas activer chez un marchand sans l'en prévenir) :

1. Paramètres > Général : activer « Stock par QR code » et sauvegarder.
2. Produits : les boutons « Scanner le stock » et « Historique du stock » apparaissent ; ouvrir le QR d'un produit.
3. Scanner (saisie du code) : Ajouter 1, Retirer 1, Retour client 1 ; le stock suit à chaque fois.
4. Historique : les trois lignes apparaissent avec le bon avant → après ; le filtre « Retour en stock » n'en montre qu'une ; fermer et rouvrir remet le filtre sur « Tous ».
5. Livreur : course d'une commande contenant ce produit, scan du code avant départ ; le stock baisse de la quantité commandée ; un second scan ne change rien ; passage de la course en `returned` : le stock remonte.
6. Remettre le réglage comme il était.

## Vérifications faites (sur la dev)

- Migration `20261116100000` : appliquée sur la dev, recette Chrome OK (activation, QR, scan par saisie manuelle, +1/−1 journalisés).
- Migration `20261116110000` : appliquée sur la dev ; test sur base jetable 20/20 (`supabase/tests/stock_driver_scan.sql`, `stock_driver_scan_cases.sql`) ; recette Chrome OK par saisie manuelle.
- Historique et retours (17/11) : recette Chrome sur la dev (boutique « BOUTIQUE TEST », produit « TEST PROD ») : boutons visibles, historique global et par produit, filtre par type (« Retour en stock » vide puis rempli), Retour client 10 → 11 journalisé avec sa note. Deux défauts trouvés et corrigés : filtre qui survivait à la fermeture de la fenêtre, badge des sorties en vert au lieu de rouge. `tsc` : aucune erreur sur les fichiers touchés.

## Non testé

- **Caméra** (scanner marchand et livreur) : seule la saisie manuelle du code a été testée. À essayer sur un téléphone réel (permission caméra, lumière, étiquette imprimée).
- **Impression de l'étiquette.**
- **Pagination de l'historique** au-delà de 30 mouvements (« Charger plus ») : le code est écrit, mais la dev n'a que quelques lignes.
- Parcours livreur complet de bout en bout en conditions réelles, y compris le retour de course vers la boutique.
- Production : rien n'a été exécuté en prod.
- Cette recette a laissé sur la dev deux lignes de journal pour « TEST PROD » (retour +1 puis sortie −1, stock revenu à 10) ; le réglage est redésactivé.

## Retour arrière

- Front : revenir au déploiement précédent sur Vercel (ou retirer `c1e11ba`). Les migrations restent compatibles avec l'ancien front.
- Fonctionnalité : décocher « Stock par QR code » boutique par boutique suffit à tout masquer.
- Base : ne **pas** remettre l'ancienne `record_stock_movement` (c'est le trou d'accès décrit plus haut). Si une remise à zéro du module est nécessaire : `drop trigger order_deliveries_restock_on_return on public.order_deliveries;` puis supprimer les fonctions de la liste ci-dessus ; les colonnes `shops.stock_qr_enabled` et `products.stock_qr_code` peuvent rester sans effet.
