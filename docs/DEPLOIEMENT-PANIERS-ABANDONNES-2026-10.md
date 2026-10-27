# Déploiement — correctifs « Paniers abandonnés » (22/10/2026)

**Projet prod :** `yfggrceynzcwklbxhgix`. **Branche :** `jeanmarc`. **Ne jamais utiliser `supabase db push`** (il pousserait aussi toutes les migrations en attente) ; appliquer uniquement le fichier ci-dessous, puis le front.

**Fichier :** `supabase/migrations/20261022120000_abandoned_carts_fixes.sql` (appliqué et testé sur dev `xfpbpxncserliskrbaim` le 22/10).

## 1. Ce qui était cassé

| # | Problème | Correction |
|---|---|---|
| P1 | **Aucun panier n'était enregistré** : `upsert_abandoned_cart` écrivait `customer_country`, colonne jamais créée (erreur 42703 avalée par le front). Dev : 0 ligne. | Colonne ajoutée. |
| P2 | Un panier déjà converti n'était jamais réactivé (même session) : les paniers suivants restaient invisibles. | Le serveur réactive la ligne ; le front renouvelle la session après une commande. |
| P3 | Articles, prix et total envoyés par le client. | Recalculés côté serveur (produit publié de la boutique, prix en base, variantes conservées, 50 lignes max, quantité 1–999). |
| P4 | Panier vidé par le visiteur : la ligne restait. | Nouvelle RPC `discard_abandoned_cart`. |
| P5 | Conversion dépendante d'un appel front silencieux. | Trigger sur `orders` : toute commande clôt les paniers ouverts de la boutique ayant le même numéro. |
| P6 | Table absente de la publication realtime : la liste ne se mettait pas à jour. | Ajoutée, avec `REPLICA IDENTITY FULL` (événements DELETE filtrés par boutique). |
| P7 | Pas de limitation de débit sur l'enregistrement. | 120 appels / 10 min / session ; au-delà, ignoré sans erreur. |
| F1 | Numéros partiels (« 0 ») enregistrés. | Téléphone valide ou e-mail plausible exigé. |
| F2 | Liste qui clignotait à chaque événement ; variantes absentes ; relance sans nom de boutique. | Rechargement silencieux ; variantes affichées ; « sur <boutique> » dans le message. |
| F3 | Panier modifié il y a moins de 30 min présenté comme abandonné. | Badge « En cours », bouton « Relancer » désactivé. |
| F4 | Suppression refusée en silence pour un collaborateur (RLS : propriétaire seulement). | Message « Suppression impossible ». |

Fichiers front : `src/pages/ShopView.tsx`, `src/components/shop/AbandonedCartsList.tsx`, `src/pages/ShopEditor.tsx`, `src/integrations/supabase/types.ts`.

## 2. Déploiement en production

**Ordre : migration, puis front.** L'ancien front reste compatible avec la nouvelle base (mêmes paramètres de RPC) ; le nouveau front exige la migration (`discard_abandoned_cart`).

### 2.1 Avant (lecture seule)

```bash
cat supabase/.temp/project-ref        # doit afficher yfggrceynzcwklbxhgix
```

Dans l'éditeur SQL de la production :

```sql
-- Prérequis (tout doit être présent)
select proname from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('is_shop_publicly_visible','check_rate_limit','upsert_abandoned_cart','mark_abandoned_cart_converted');   -- 4 lignes
select tablename from pg_tables where schemaname = 'public'
  and tablename in ('abandoned_carts','products','orders');                                                              -- 3 lignes
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'products' and column_name in ('price','is_published','shop_id','name');  -- 4 lignes

-- État actuel (P1 : attendu 0 ligne si la colonne manque en prod)
select count(*) as colonne_customer_country from information_schema.columns
 where table_schema = 'public' and table_name = 'abandoned_carts' and column_name = 'customer_country';                  -- 0 = bug présent
select count(*) as paniers_existants, count(*) filter (where converted) as convertis from public.abandoned_carts;
select pubname from pg_publication where pubname = 'supabase_realtime';                                                  -- 1 ligne
```

Règle de lecture : une ligne de prérequis manquante = **ne pas appliquer**. Si `colonne_customer_country` vaut déjà 1, la migration reste sans danger (`IF NOT EXISTS`). Aucune donnée n'est supprimée ni réécrite ; une sauvegarde automatique récente suffit.

### 2.2 Appliquer la migration

Deux méthodes : coller le fichier dans l'éditeur SQL de la production, ou

```bash
npx supabase db query --linked -f supabase/migrations/20261022120000_abandoned_carts_fixes.sql
```

La migration est **idempotente** (`ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS`, ajout à la publication gardé par un test) : en cas d'échec ou d'interruption, relancer le même fichier. Seule précaution : `CREATE TRIGGER` sur `orders` prend brièvement un verrou sur cette table ; appliquer hors des heures de pointe.

### 2.3 Vérifier la base (lecture seule)

```sql
select column_name from information_schema.columns
 where table_name = 'abandoned_carts' and column_name = 'customer_country';                         -- 1 ligne
select proname, proacl::text from pg_proc where proname in
  ('upsert_abandoned_cart','mark_abandoned_cart_converted','discard_abandoned_cart');               -- 3 lignes ; anon et authenticated présents (ce sont des RPC publiques voulues ; « =X/ » (PUBLIC) est normal sur les deux premières, discard_abandoned_cart l'a révoqué)
select tgname from pg_trigger where tgname = 'trg_orders_mark_abandoned_carts_converted';          -- 1 ligne
select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'abandoned_carts';   -- 1
select relreplident from pg_class where oid = 'public.abandoned_carts'::regclass;                  -- 'f'
```

Contrôle fonctionnel sans compte, clé anonyme de production (une boutique publique et l'un de ses produits publiés) :

```bash
curl -s -X POST "https://yfggrceynzcwklbxhgix.supabase.co/rest/v1/rpc/upsert_abandoned_cart" \
  -H "apikey: <ANON_KEY_PROD>" -H "Authorization: Bearer <ANON_KEY_PROD>" -H "Content-Type: application/json" \
  -d '{"_shop_id":"<SHOP_ID>","_session_id":"verif-deploiement-0001","_customer_name":"Verif","_customer_phone":"+2250000000000","_customer_email":null,"_customer_city":null,"_customer_address":null,"_customer_country":null,"_payment_method":null,"_items":[{"product_id":"<PRODUCT_ID>","quantity":1}],"_items_count":0,"_total":0}'
# attendu : un UUID. Une erreur « column customer_country » = migration non appliquée.
```

Puis supprimer la ligne de vérification dans l'éditeur SQL : `delete from public.abandoned_carts where session_id = 'verif-deploiement-0001';`

### 2.4 Déployer le front

Déployer la branche `jeanmarc` comme d'habitude (aucune variable d'environnement nouvelle).

### 2.5 Vérifier en production

1. Boutique publique : ajouter un produit, saisir un téléphone valide et un nom. Dans l'éditeur de la boutique, section **Paniers abandonnés**, une ligne apparaît (badge « En cours » pendant 30 min, « Relancer » désactivé).
2. Saisir seulement « 0 » comme téléphone : aucune ligne.
3. Vider le panier : la ligne disparaît (sans recharger la page du propriétaire).
4. Passer une commande avec ce numéro : la ligne disparaît de la liste (convertie). Refaire un panier avec le même numéro : une nouvelle ligne apparaît.
5. Une variante choisie (taille, couleur) apparaît dans la ligne.

## 3. Retour arrière

Le front ancien reste utilisable avec la base corrigée. Pour retirer les ajouts sans toucher aux données :

```sql
drop trigger if exists trg_orders_mark_abandoned_carts_converted on public.orders;
drop function if exists public.mark_abandoned_carts_converted_on_order();
drop function if exists public.discard_abandoned_cart(uuid, text);
alter publication supabase_realtime drop table public.abandoned_carts;
alter table public.abandoned_carts replica identity default;
```

Ne pas supprimer la colonne `customer_country` (l'ancienne RPC en dépend) ; ne pas rétablir l'ancienne version de `upsert_abandoned_cart`, elle ne prend en compte ni P2 ni P3.

## 4. Vérifié sur dev (22/10)

- SQL (transaction annulée) : prix falsifié ignoré (2 × 12 000 = 24 000), variantes conservées, réactivation d'un panier converti, trigger sur `orders`, suppression, entrée vide refusée (`invalid_input`).
- Navigateur, parcours visiteur : « 0 » ignoré ; téléphone valide enregistré ; mise à jour en place ; panier vidé supprimé ; commande réelle → converti ; nouvelle session ; nouveau panier visible.
- Navigateur, parcours propriétaire : converti exclu ; badge « En cours » et « Relancer » désactivé ; variantes affichées ; ajout et suppression en base reflétés en direct ; message de relance avec le nom de la boutique ; suppression par le propriétaire.
- **Non testé :** message « Suppression impossible » pour un collaborateur (aucun compte collaborateur de test).

## 5. Non traité

- Aucune purge des vieux paniers (pas de rétention) ; à décider avant que la table grossisse.
- Pas de limitation par IP (seulement par session) : un script peut changer de session.
- Un blocage ponctuel de la requête `upsert_abandoned_cart` côté navigateur a été observé une fois sur dev (session de test d'un autre compte) ; non reproduit après rechargement, cause non établie.
