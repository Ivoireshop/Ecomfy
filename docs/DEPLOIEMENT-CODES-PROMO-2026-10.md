# Déploiement — codes promo de boutique et « Clients fidèles » (22/10/2026)

**Projet prod :** `yfggrceynzcwklbxhgix`. **Branche :** `jeanmarc`. **Ne jamais utiliser `supabase db push`** (il pousserait aussi toutes les migrations en attente) ; appliquer uniquement le fichier ci-dessous, puis le front.

**Fichier :** `supabase/migrations/20261022130000_shop_promo_codes.sql` (appliqué et testé sur dev `xfpbpxncserliskrbaim` le 22/10). Test rejouable : `supabase/tests/shop_promo_codes.sql` (base de dev uniquement, tout est annulé).

## 1. Ce qui était cassé

### 1.1 Onglet « Clients fidèles » (front seul, aucune migration)

| # | Problème | Correction |
|---|---|---|
| L1 | Commandes lues par une seule requête : au-delà de 1 000 lignes, l'historique ancien disparaissait (un client à 6 commandes anciennes n'était plus vu). | Lecture par pages de 1 000. |
| L2 | Commandes annulées et retournées comptées comme commandes et chiffre d'affaires. | Exclues. |
| L3 | `+225 07…`, `07…` et `00225 07…` donnaient trois clients. | Regroupement sur les 8 derniers chiffres. |
| L4 | Commandes sans téléphone ni e-mail regroupées par nom (faux clients fidèles). | Ignorées. |
| L5 | Modale : le message ne suivait pas le code / la réduction saisis (valeur d'état périmée). | Message reconstruit avec les nouvelles valeurs. |
| L6 | Code `FIDELITE20` / `20%` écrit en dur, inexistant dans la boutique. | Champs vides ; pastilles des vrais codes actifs du client (publics ou qui lui sont attribués) ; avertissement si le code saisi n'existe pas. |
| L7 | WhatsApp avec un numéro local (`wa.me/0700…`) ; SMS ignorant le texte modifié et gardant les `*gras*`. | Indicatif ajouté (`normalizeToE164`) ; SMS = texte de la modale sans astérisques ; boutons désactivés sans numéro. |
| L8 | Chaque commande reçue remplaçait la page par un spinner et fermait la modale ouverte. | Rechargement silencieux, regroupé (500 ms). |
| L9 | Export CSV : coupé au premier `#`, accents illisibles dans Excel, une seule colonne en Excel français, formules `=…` exécutables. | Blob UTF-8 avec BOM, séparateur `;`, cellules neutralisées. |
| L10 | Filtres Argent et 1ère commande absents ; recherche par numéro formaté impossible ; taux « 0 % » pour 4/1105. | Boutons et compteurs ; recherche sur les chiffres (seulement si la saisie ressemble à un numéro) ; une décimale. |

Fichier : `src/components/shop/LoyalCustomersList.tsx`.

### 1.2 Codes promo de boutique

| # | Problème | Correction |
|---|---|---|
| P1 | `promo_codes` n'avait que les colonnes des codes d'abonnement fondateur : pas de `shop_id`, de type de remise, de montant fixe, de minimum de commande ni de ciblage. L'écran « Codes promo » du marchand (et la création de codes fondateur avec ces champs) échouait. | Colonnes ajoutées ; `discount_percentage` accepte 0 (montant fixe) ; contraintes de cohérence. |
| P2 | Une politique RESTRICTIVE (`20260609143212`) réservait toute lecture aux fondateurs : un marchand ne pouvait pas lister ses codes. | Remplacée : fondateurs, ou propriétaire / collaborateurs de la boutique du code. Le propriétaire gère (FOR ALL), les collaborateurs lisent. |
| P3 | Aucune commande n'appliquait de code : `create_public_order` ignorait toute remise. | Nouveau paramètre `p_promo_code` : le serveur vérifie actif, expiration, quota, minimum, ciblage (e-mail ou 8 derniers chiffres du téléphone) et calcule la remise dans la transaction de la commande. |
| P4 | `UNIQUE (code)` global : deux boutiques ne pouvaient pas avoir le même code. | Unicité par boutique (et globale pour les codes d'abonnement), insensible à la casse ; trigger de normalisation (3 à 32 caractères, lettres, chiffres, `-`, `_`). |
| P5 | Total et commission ne tenaient pas compte d'une remise. | `orders.promo_code`, `orders.discount_amount` ; `recompute_order_totals_for()` : total après remise, commission calculée sur ce total ; le trigger sur `order_items` l'appelle. |
| P6 | Les codes d'abonnement et de boutique partageaient la même table. | `validate_promo_code` et `increment_promo_usage` ne voient que `shop_id IS NULL`. |
| F1 | Pas de champ code dans le tunnel de commande. | Composant `PromoCodeField` (panier de `ShopView`, fiche produit de `ProductView`) : aperçu via `preview_shop_promo_code` (limité à 20 essais / 10 min / IP / boutique), recalcul quand le panier ou les coordonnées changent. Le montant définitif vient toujours du serveur. |
| F2 | Écran « Codes promo » : « Livraison offerte » sans effet (aucun frais de livraison dans une commande), libellés « sur Abonnement », valeurs non bornées, suppression refusée en silence pour un collaborateur. | Modèle remplacé par « -2 000 FCFA dès 8 000 » ; libellés par mode ; pourcentage 1–100 ; message explicite. |
| F3 | Plafond de 1 000 commandes dans l'éditeur (PostgREST ignore `.limit(5000)`). | Lecture par pages jusqu'à 5 000 (`ShopEditor.tsx`). |
| F4 | Remise absente des commandes côté marchand. | Code et remise dans la liste et dans le message de la commande. |

Fichiers front : `src/components/shop/LoyalCustomersList.tsx`, `src/components/shop/PromoCodeField.tsx` (nouveau), `src/services/publicOrderService.ts`, `src/pages/ShopView.tsx`, `src/pages/ProductView.tsx`, `src/pages/PromoCodeManager.tsx`, `src/pages/ShopEditor.tsx`, `src/components/shop/OrdersList.tsx`, `src/integrations/supabase/types.ts`.

**Comportement voulu à connaître :** un code refusé au moment de la commande (quota atteint entre-temps, par exemple) ne bloque pas la commande : elle est créée au prix plein et le front affiche la raison du refus. Une exception annulerait aussi la limitation de débit et permettrait de deviner des codes sans limite.

## 2. Déploiement en production

**Ordre : migration, puis front.** Le nouveau front appelle `preview_shop_promo_code` et passe `p_promo_code` : il exige la migration. L'ancien front reste compatible avec la nouvelle base (le paramètre `p_promo_code` est facultatif).

**Prérequis : la migration H10 (`20261018120000`, `create_public_order`) doit déjà être appliquée en production**, ainsi que `20261015120000` (`guard_public_order_insert`, `enforce_order_item_price`). La présente migration remplace `create_public_order` (nouvelle signature, ancienne supprimée) et `guard_public_order_insert`.

### 2.1 Avant (lecture seule)

```bash
cat supabase/.temp/project-ref        # doit afficher yfggrceynzcwklbxhgix
```

Dans l'éditeur SQL de la production :

```sql
-- Prérequis (tout doit être présent)
select proname from pg_proc where pronamespace = 'public'::regnamespace and proname in
  ('create_public_order','guard_public_order_insert','enforce_order_item_price','recompute_order_totals',
   'is_shop_owner','is_shop_owner_or_collaborator','is_shop_publicly_visible','check_rate_limit','has_role',
   'generate_order_number','validate_promo_code','increment_promo_usage');                                  -- 12 lignes
select pg_get_function_identity_arguments(oid) from pg_proc
 where proname = 'create_public_order' and pronamespace = 'public'::regnamespace;                          -- 1 ligne, 10 paramètres (sans p_promo_code)

-- État actuel
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'promo_codes'
 order by ordinal_position;                                    -- attendu sans shop_id si le bug P1 est présent
select policyname, permissive, cmd from pg_policies where tablename = 'promo_codes';
select count(*) as codes, count(*) filter (where discount_percentage <= 0 or discount_percentage > 100) as hors_bornes
  from public.promo_codes;                                     -- hors_bornes doit valoir 0 (sinon la nouvelle contrainte échouera)
select upper(code), count(*) from public.promo_codes group by 1 having count(*) > 1;   -- doit être vide (doublons de casse)
select count(*) from public.promo_codes where code !~ '^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$';  -- codes existants non conformes : voir ci-dessous
```

Règle de lecture : une ligne de prérequis manquante = **ne pas appliquer**. Les codes existants (codes d'abonnement fondateur) ne sont pas modifiés : le trigger de normalisation ne s'exécute qu'à l'insertion ou au changement du code, pas à l'application de la migration. Un code existant non conforme au format reste utilisable, mais ne pourra plus être modifié tel quel. Aucune donnée n'est supprimée ; une sauvegarde automatique récente suffit.

### 2.2 Appliquer la migration

Deux méthodes : coller le fichier dans l'éditeur SQL de la production, ou

```bash
npx supabase db query --linked -f supabase/migrations/20261022130000_shop_promo_codes.sql
```

La migration est **idempotente** (`ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT / POLICY / TRIGGER IF EXISTS`, `CREATE OR REPLACE`, `DROP FUNCTION IF EXISTS` sur l'ancienne signature) : en cas d'échec ou d'interruption, relancer le même fichier. Précautions : elle remplace la fonction de commande publique (fenêtre de quelques ms où un appel peut échouer) et pose des contraintes sur `orders` ; appliquer hors des heures de pointe.

### 2.3 Vérifier la base (lecture seule)

```sql
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'promo_codes'
  and column_name in ('shop_id','discount_type','discount_amount','min_order_amount','target_user_email','target_user_phone');  -- 6
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'orders'
  and column_name in ('promo_code','discount_amount');                                                                              -- 2
select pg_get_function_identity_arguments(oid) from pg_proc
 where proname = 'create_public_order' and pronamespace = 'public'::regnamespace;       -- 1 ligne, se termine par p_promo_code text
select policyname, permissive from pg_policies where tablename = 'promo_codes';
   -- « Restrict promo_codes reads to founders and shop team » (RESTRICTIVE), « Founders can manage promo codes »,
   -- « Shop owners manage shop promo codes », « Shop collaborators read shop promo codes »
select proname, proacl::text from pg_proc where proname in ('evaluate_shop_promo','recompute_order_totals_for','increment_promo_usage')
  and pronamespace = 'public'::regnamespace;     -- service_role seulement (ni anon ni authenticated)
select proname, proacl::text from pg_proc where proname in ('preview_shop_promo_code','create_public_order')
  and pronamespace = 'public'::regnamespace;     -- anon et authenticated présents (RPC publiques voulues)
```

Test fonctionnel : sur **dev**, `npx supabase db query --linked -f supabase/tests/shop_promo_codes.sql` (en prod, ne pas créer de données de test ; faire la vérification manuelle du 2.5).

### 2.4 Déployer le front

Déployer la branche `jeanmarc` comme d'habitude (aucune variable d'environnement nouvelle).

### 2.5 Vérifier en production

1. Éditeur d'une boutique de test, onglet **Codes Promo** : le formulaire se charge sans erreur ; créer un code (modèle « Bienvenue Client -15 % »). Il apparaît dans la liste avec « -15 % sur la commande » et « Dès 5 000 FCFA ».
2. Boutique publique, panier ou fiche produit : « J'ai un code promo » ; un faux code affiche « Code promo invalide » ; le bon code affiche la remise et le nouveau total ; changer la quantité recalcule la remise.
3. Passer la commande : dans l'éditeur, la commande affiche « Code … : -X FCFA » ; le total est celui d'après remise ; le code passe à 1 utilisation.
4. Un code dont le minimum n'est pas atteint affiche « Commande minimum de … FCFA pour ce code ».
5. Onglet **Clients fidèles** : la modale de relance propose les codes actifs sous forme de pastilles ; choisir un code remplit le message.
6. Une boutique de plus de 1 000 commandes : le tableau de bord les compte toutes (jusqu'à 5 000).
7. Fondateur : l'onglet « Codes promo » du tableau de bord fondateur crée un code d'abonnement (pourcentage et montant fixe) ; la page d'abonnement l'accepte toujours.
8. Supprimer ensuite les codes et commandes de test.

## 3. Retour arrière

Le front ancien reste utilisable avec la base migrée. Pour retirer le comportement promo sans toucher aux données :

```sql
-- Les commandes déjà remisées gardent leur total ; seules les nouvelles n'ont plus de remise.
drop function if exists public.preview_shop_promo_code(uuid, text, numeric, text, text);
drop function if exists public.evaluate_shop_promo(uuid, text, numeric, text, text, boolean);
-- Remettre create_public_order à 10 paramètres : rejouer supabase/migrations/20261018120000_h10_create_public_order_rpc.sql
-- (il ne supprime pas la version à 11 paramètres : la supprimer d'abord)
--   drop function if exists public.create_public_order(uuid, text, text, jsonb, text, text, text, text, text, text, text);
drop policy if exists "Shop owners manage shop promo codes" on public.promo_codes;
drop policy if exists "Shop collaborators read shop promo codes" on public.promo_codes;
```

Ne pas supprimer les colonnes ajoutées (`promo_codes.shop_id`…, `orders.promo_code`, `orders.discount_amount`) : des lignes peuvent les utiliser. Si `recompute_order_totals` doit revenir à l'ancienne version, rejouer sa définition de `20261015120000`.

## 4. Vérifié sur dev (22/10)

- SQL (transaction annulée, `supabase/tests/shop_promo_codes.sql`) : remise en pourcentage (45 000 → 36 000, commission 5 % de 36 000) et en montant fixe (→ 40 000) ; minimum, code désactivé, expiré, épuisé, inconnu refusés (commande créée au prix plein avec le message) ; code attribué à un client refusé aux autres et accepté pour son numéro (`+225 07 11 11 11 11` ≡ `0711111111`) ; doublon de casse et code trop court refusés ; un autre marchand ne voit ni ne crée de codes pour la boutique ; les codes d'abonnement ne voient pas les codes de boutique ; compteurs d'utilisation corrects.
- Navigateur, propriétaire : création de deux codes depuis les modèles ; liste correcte ; modale « Clients fidèles » avec les pastilles et le message mis à jour ; tableau de bord à 1 103 commandes (au lieu de 1 000).
- Navigateur, client, panier : faux code refusé, `BIENVENUE15` → 20 000 − 3 000 = 17 000 ; commande enregistrée (sous-total 20 000, remise 3 000, total 17 000, commission 850, 1 utilisation).
- Navigateur, client, fiche produit : minimum refusé avec le bon message, `FICHE10` → −1 000 ; quantité 2 → −2 000, total 18 000 ; commande enregistrée (remise 2 000, total 18 000, commission 900) ; boutons « Commander » à 9 000 après remise.
- Onglet « Clients fidèles » (session précédente) : 1 105 clients attendus, pagination, regroupement des numéros, annulées exclues, client sans numéro, WhatsApp `wa.me/2250711111111`, temps réel avec modale ouverte, recherche, export CSV (BOM, `;`, `#` conservé, formule neutralisée).
- **Non testé :** lecture des codes par un collaborateur (aucun compte collaborateur de test) ; paiement Mobile Money avec remise (le montant envoyé au paiement est le total serveur, non exercé) ; commande directe de la page d'accueil (pas de champ code) ; boutique restreinte (la fonction `get_shop_orders_secure` plafonne encore à 1 000 lignes).

## 5. Non traité

- Pas de « livraison offerte » : une commande n'a pas de frais de livraison (la valeur `free_shipping` reste acceptée pour les codes fondateur, refusée pour une boutique par contrainte).
- Un client peut réutiliser un code public autant de fois que son quota le permet (pas de limite par client) ; seul le ciblage par e-mail ou téléphone restreint un code.
- Un pourcentage est calculé sur le sous-total au moment de la commande : si le marchand modifie ensuite les lignes de la commande, la remise en montant reste celle enregistrée (plafonnée au nouveau sous-total).
- Les boutons « Commander » de la fiche produit calculent toujours `prix × quantité` (ignorent les offres en lot) ; seul le montant de remise a été répercuté.
- `get_shop_orders_secure` (boutique restreinte) ne renvoie pas la remise ni plus de 1 000 commandes.
