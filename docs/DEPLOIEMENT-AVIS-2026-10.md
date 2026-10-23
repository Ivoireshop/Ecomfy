# Avis produits boutique : correctifs du 23/10/2026

**Branche :** `jeanmarc` (commité : `6055689`). **Ne jamais utiliser `supabase db push`.** Projet prod : `yfggrceynzcwklbxhgix` ; le projet lié dans ce dépôt est **dev** (`xfpbpxncserliskrbaim`).

**Guides liés :** [`DEPLOIEMENT-PRODUITS-2026-10.md`](DEPLOIEMENT-PRODUITS-2026-10.md) (la suppression de produit en dépend, A5), [`DEPLOIEMENT-APPARENCE-THEMES-2026-10.md`](DEPLOIEMENT-APPARENCE-THEMES-2026-10.md) (thèmes pro, A10), [`DEPLOIEMENT-FACTURATION-2026-10.md`](DEPLOIEMENT-FACTURATION-2026-10.md) (migrations 20261023120000 à 20261023150000, indépendantes de celle-ci).

## 1. Bugs corrigés

| # | Bug | Correctif |
|---|---|---|
| A1 | **Modération contournable** : la politique d'insertion publique ne contrôlait pas le statut. Avec la clé publique, `{"status":"approved"}` publiait l'avis sans modération (reproduit sur dev). | Politique `status = 'pending'` + déclencheur qui ramène le statut à `pending` pour tout visiteur. |
| A2 | Aucune limite de taille (commentaire de 20 000 caractères accepté) ; l'avis pouvait viser un produit **d'une autre boutique** ; email non vérifié. | Déclencheur `product_reviews_guard` : nom 1-80, commentaire 1-2000, email valide, produit de la même boutique. Messages en français. Statuts limités à `pending/approved/rejected` (contrainte `NOT VALID`). |
| A3 | Le marchand pouvait réécrire un avis (nom, note, texte). | En mise à jour, seul le statut peut changer (SQL direct et `service_role` restent libres). |
| A4 | **Avis orphelins** : aucune clé étrangère, un produit ou une boutique supprimé laissait ses avis. | Clés étrangères `ON DELETE CASCADE` (les avis orphelins existants sont supprimés par la migration). |
| A5 | **Suppression d'un produit silencieusement annulée** (hors avis, découvert en testant la cascade) : `enforce_shop_not_locked_products` (déclencheur `BEFORE DELETE`) faisait `RETURN NEW`, donc NULL : 0 ligne supprimée, aucune erreur ; l'application affichait « Produit supprimé ✓ » et le produit revenait. | `RETURN COALESCE(NEW, OLD)`. Même règle de verrouillage. |
| A6 | Note moyenne et « basés sur N avis » calculés sur les 50 derniers seulement. | RPC `get_product_review_stats` (tous les avis approuvés) ; liste paginée (20 + « Voir plus d'avis »). |
| A7 | Hooks React appelés après un `return null` : changer un réglage d'apparence section montée → erreur « Rendered fewer hooks ». Réponses concurrentes d'un changement de produit pouvaient s'écraser. | Hooks avant le retour ; annulation de la requête obsolète. |
| A8 | Erreur de chargement = « Aucun avis pour le moment » ; erreur technique brute affichée au visiteur. | Message + bouton « Réessayer » ; message lisible pour le visiteur. |
| A9 | L'interrupteur « Badge 5 étoiles & Compteur » masquait **aussi** la vraie section d'avis et le formulaire. | La section ne dépend que de « Section Témoignages & Formulaire d'Avis ». |
| A10 | **Thèmes pro** (`theme_slug`) : aucun avis, aucun formulaire, aucune barre d'avis. | Section d'avis insérée avant le pied de page de chaque thème ; barres d'avis au-dessus/dessous. |
| A11 | Modération : erreur de chargement masquée ; « Avis approuvé » affiché même si 0 ligne modifiée ; double clic ; nouveaux avis invisibles sans rechargement. | Erreur + « Réessayer » ; contrôle du nombre de lignes ; boutons désactivés pendant l'action ; relecture au retour sur l'onglet. |
| A13 | **Compteur et note fictifs** : « (128 avis) » et 5 étoiles s'affichaient par défaut sous le titre (`reviews_base_count`, +1 par commande, « variation réaliste »), sans lien avec les vrais avis, pendant que la section du bas disait « Aucun avis ». Preuve sociale inventée (pratique commerciale trompeuse). | Le badge affiche la note et le nombre des **avis réels approuvés** (RPC `get_product_review_stats`), et seulement à partir du premier avis. Les réglages fictifs sont retirés de l'éditeur (les clés restent en base, ignorées). |
| A14 | Coche verte « vérifié » sur chaque avis alors qu'aucun n'est lié à une commande. | Retirée. |
| A15 | Pas de limite contre le flot de faux avis ni les doublons. | Déclencheur : doublon exact (produit + nom + texte) refusé sur 7 jours ; 10 avis maximum par produit sur 10 minutes (se libère seul). |
| A16 | Le marchand n'était jamais prévenu d'un nouvel avis. | Pastille du nombre d'avis en attente dans le menu « Avis » (relecture toutes les 2 minutes et au retour sur l'onglet). |
| A17 | Les couleurs de la section d'avis disparaissaient de l'éditeur quand le badge était coupé. | Visibles tant que la section est active. |
| A12 | Éditeur : minimum/maximum « réalistes » affichés 120/180 alors que la vitrine utilisait 128/178. Étoiles du badge tronquées (4,6 → 4) ; note invalide → aucune étoile. Libellé « Publier l'avis » alors que l'avis est modéré. Compteur « (N avis) » cliquable sans effet. | Valeurs affichées = valeurs utilisées ; étoiles arrondies ; « Envoyer mon avis » ; le compteur défile jusqu'aux avis. Champ piège anti-robots, compteur de caractères, étoiles accessibles. |

## 2. Vérification (23/10/2026, dev)

- `supabase/tests/product_reviews.sql` (transaction annulée) : visiteur « approved » → `pending` ; produit d'une autre boutique, commentaire de 2001 caractères, nom vide, email invalide refusés ; autre marchand ne modère pas (0 ligne) ; propriétaire approuve ; réécriture refusée ; statistiques 2 avis / moyenne 4 ; vue publique 2 ; boutique non publiée : 0 ; suppression du produit : ses avis partent. **Contre-épreuve** avant migration : avis `approved` + 20 000 caractères + produit d'une autre boutique acceptés avec la clé publique.
- Navigateur (application locale sur dev, avis de test supprimés ensuite) : email invalide → message ; envoi valide → « Merci », avis `pending` non visible ; 25 avis approuvés → « 4.2 sur 5 basés sur 25 avis » (5,0 si calculé sur les 20 affichés), « Voir plus d'avis (5) » ; badge coupé → vraie section conservée ; thème pro → avis affichés avant le pied de page.
- Migration rejouée deux fois sans erreur (idempotente). `tsc` : aucune erreur dans les fichiers modifiés.
- Anti-spam (SQL) : doublon refusé, 10ᵉ avis en 10 minutes refusé (`plafond_refuse_au_rang` = 10).
- Navigateur, avec une boutique jetable rattachée au compte de test connecté (supprimée ensuite ; dev revenu à 5 avis, 0 boutique `zz-`) : pastille « Avis 3 » dans le menu ; Approuver, Rejeter et Supprimer fonctionnent (base vérifiée) ; pastille disparue à 0 ; vitrine : badge « (1 avis) » avec 5 étoiles réelles, clic qui défile jusqu'aux avis, plus de coche « vérifié ».
- Suppression de la boutique de test : ses produits et avis sont partis avec elle (cascade).

## 3. Déploiement

| Élément | Dev | Prod |
|---|---|---|
| `20261023160000_product_reviews_hardening.sql` | appliquée | à faire |
| Front | serveur local | à faire |

**Ordre : migration d'abord, puis front.** Indépendante des autres migrations du 23/10 (aucun objet commun) : elle peut être appliquée avant ou après celles de la facturation. Elle ne réécrit qu'une fonction existante, `enforce_shop_not_locked_products` (même règle de verrouillage, valeur retournée corrigée en suppression). Le front reste compatible avec une base sans la fonction de statistiques (repli sur les avis chargés), mais sans la migration la faille A1 reste ouverte.

**Avant (lecture seule, en prod)** : les avis qui seront supprimés (orphelins) et les statuts inattendus.
```sql
select count(*) filter (where product_id is not null and not exists (select 1 from products p where p.id = r.product_id)) orphelins_produit,
       count(*) filter (where not exists (select 1 from shops s where s.id = r.shop_id)) orphelins_boutique,
       count(*) filter (where status not in ('pending','approved','rejected')) statuts_inattendus,
       count(*) filter (where status = 'approved' and created_at > now() - interval '30 days') approuves_30j
  from product_reviews r;
```
Les avis approuvés récents méritent un coup d'œil : avant le correctif, un visiteur pouvait s'auto-approuver.

**Après** : `select proacl from pg_proc where proname = 'get_product_review_stats';` (exécutable par `anon`) ; puis un avis envoyé depuis une vraie fiche doit apparaître « En attente » dans Avis clients.

**Retour arrière** : `drop trigger trg_product_reviews_guard on product_reviews;` et restaurer l'ancienne politique d'insertion (`with check (is_shop_publicly_visible(shop_id))`) : à ne pas faire, elle rouvre la faille. La correction A5 est indépendante et sans risque.

## 4. Hors périmètre / limites connues

- **Les marchands qui avaient réglé un compteur fictif** le perdent : le badge est vide tant qu'aucun avis réel n'est approuvé. À annoncer si besoin.
- **Spam** : pas d'identification du visiteur ; le champ piège ne bloque que les robots simples, et la limite par produit est un garde-fou, pas une garantie.
- Pas de notification par email ou push pour un nouvel avis (seulement la pastille du menu).
