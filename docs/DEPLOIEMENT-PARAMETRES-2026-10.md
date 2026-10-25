# Paramètres de la boutique : correctifs du 25/10/2026

**Branche :** `jeanmarc` (non commité au moment de la rédaction). **Ne jamais utiliser `supabase db push`.** Projet prod : `yfggrceynzcwklbxhgix` ; le projet lié dans ce dépôt est **dev** (`xfpbpxncserliskrbaim`).

## 1. Bugs corrigés

| # | Défaut | Correctif | Fichier |
|---|---|---|---|
| P1 | « Objectif mensuel de revenus » jamais enregistré (absent de la sauvegarde), champ impossible à vider | Ajouté à la sauvegarde et au suivi des modifications non enregistrées ; champ vidable, minimum 0 | `ShopEditor.tsx`, `ShopSettings.tsx` |
| P2 | Paiement à la livraison affiché désactivé : la base crée `cash_on_delivery`, les réglages lisaient `cod` (impossible à retirer ensuite) | `cod` et `cash_on_delivery` traités comme un seul mode ; défaut aligné sur la vitrine | `ShopSettings.tsx` |
| P3 | Tous les modes de paiement décochables (la vitrine retombait silencieusement sur le COD) | Au moins un mode actif exigé, message explicite | `ShopSettings.tsx` |
| P4 | Suppression de boutique : produits puis commandes effacés à la main sans contrôle d'erreur ; si la suppression de la boutique échouait, les commandes étaient perdues et « Boutique supprimée » s'affichait quand même | Suppression de la boutique seule (cascade en base, vérifié : aucune clé étrangère vers `shops` sans cascade ni `set null`), erreur contrôlée et affichée ; confirmation impossible avec un nom vide | `ShopSettings.tsx` |
| P5 | Après l'enregistrement d'un domaine, toute la ligne de la base remplaçait la boutique en mémoire : réglages non enregistrés perdus | Seuls les champs du domaine sont repris | `ShopSettings.tsx` |
| P6 | Bouton « Passer à l'abonnement Premium » sans action | Mène à `/subscription` | `ShopSettings.tsx` |
| P7 | Lien public : conflit avec la boutique non publiée d'un autre marchand (invisible pour la vérification) = enregistrement refusé par la base ; nom de boutique vide accepté | Nouvel essai avec suffixe sur violation d'unicité du lien, message indiquant le lien final ; nom vide refusé | `ShopEditor.tsx` |
| P8 | Taux de délivrabilité COD : valeurs négatives ou > 100 possibles | Borné entre 0 et 100 | `ShopSettings.tsx` |
| P9 | Taux de délivrabilité COD annoncé « utilisé dans les statistiques » mais lu nulle part | Estimation affichée sous le chiffre d'affaires (« Dont X FCFA en attente de livraison : environ Y FCFA attendus »), à part : le chiffre d'affaires et les autres totaux ne changent pas. Commandes comptées : de la période, ni livrées ni `payment_status = paid`. Rien d'affiché à 100 % | `ShopStatistics.tsx`, `ShopEditor.tsx` |
| P10 | Preuve sociale : faux acheteurs inventés (Kouadio, Aminata…) quand il n'y avait pas de commande, produit réellement acheté remplacé par celui de la page, commandes annulées et anciennes proposées | Uniquement de vraies commandes des 7 derniers jours (hors annulées/retournées), produit réellement commandé, ancienneté en minutes/heures/jours, rien d'affiché sans commande récente ; libellé des réglages réécrit | `SocialProofNotification.tsx`, migration, `ShopSettings.tsx` |

## 2. Migration

| Fichier | Dev | Prod |
|---|---|---|
| `20261024100000_social_proof_real_orders.sql` | appliquée (25/10) | à faire |

Remplace la fonction `get_shop_social_proof_orders` (même signature, même format de retour) : fenêtre de 7 jours et exclusion des commandes `cancelled` / `returned`. Réversible en rejouant la version de `20260812124000_social_proof_image.sql`.

**Ordre : migration d'abord, puis front.** Sans la migration, le front corrigé affiche encore les commandes anciennes ou annulées (mais plus aucun faux acheteur).

```bash
cat supabase/.temp/project-ref        # doit afficher yfggrceynzcwklbxhgix (et non xfpbpxncserliskrbaim = dev)
npx supabase db query --linked -f supabase/migrations/20261024100000_social_proof_real_orders.sql
```

Pas d'Edge Function.

## 3. Effet visible pour les marchands

Les boutiques qui avaient activé la preuve sociale et ont peu de commandes récentes ne verront plus de notification tant qu'elles n'ont pas de commande des 7 derniers jours. C'est voulu (plus de fausses ventes).

## 4. Vérification sur dev (navigateur, 25/10/2026)

Boutique « Test Securite Dev » (dev, plan gratuit). État initial relevé avant les essais et **rétabli à l'identique après** (ligne `shops` comparée champ par champ : aucune différence).

| Contrôle | Résultat |
|---|---|
| P1 : objectif 1 234 567, « Sauvegarder », lecture en base, rechargement | Valeur en base `1234567`, affichée après rechargement, reprise par « Objectif du mois » dans les statistiques |
| P2 : onglet Paiement sur une boutique dont la base contient `mobile_money` + `cash_on_delivery` | Les deux modes affichés actifs |
| P3 : Mobile Money désactivé, puis tentative de désactiver COD | COD reste actif, message « Au moins un mode de paiement » |
| P8 : saisie 150, puis -5, puis 80 | 100, jamais négatif (« 05 » affiché : défaut d'affichage mineur du champ), 80 ; sauvegarde en base `80` |
| P9 : statistiques, 9 commandes `new` pour 48 000 FCFA, taux 80 % | « Dont 48 000 FCFA en attente de livraison : environ 38 400 FCFA attendus (taux de 80 %, estimation) » |
| P6 : bouton Premium (onglet Nom de domaine, plan gratuit) | Navigation vers `/subscription` |
| P7 : nom de boutique vidé, « Sauvegarder » | Refusé, message « Nom de la boutique requis » |
| P4 : nom vidé, Zone de danger, fenêtre de confirmation | « Supprimer » désactivé (suppression réelle non exécutée) |
| P10 : fonction SQL sur la boutique de test | 9 vraies commandes (prénoms réels, « Produit Test H10 ») |
| P10 : fonction SQL sur une boutique visible dont toutes les commandes sont anciennes | 0 ligne |
| P10 : vitrine avec la preuve sociale activée | « Test a commandé Produit Test H10 », « il y a 1 jour » (vraie commande du 23/10) |

**Non testé dans le navigateur :** suppression réelle d'une boutique (vérifiée seulement par le contrôle des clés étrangères), enregistrement d'un domaine personnalisé avec réglages non enregistrés (nécessite un plan payant), nouvel essai du lien public en cas de collision.

**Particularité des données de test :** le compte marchand de test n'a aucune ligne dans `subscriptions` ; la page `/subscription` y affiche « Impossible de charger votre abonnement » (non lié à ces correctifs).
