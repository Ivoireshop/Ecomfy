# Livraison réseau — étapes C (suivi) et D (affectation aux livreurs)

**Date :** 19/11/2026 · **Dev :** `xfpbpxncserliskrbaim` (appliqué) · **Prod :** `yfggrceynzcwklbxhgix` (à faire)

## Contenu
| Étape | Quoi | Où |
|---|---|---|
| C | Suivi côté marchand (regroupement par état, historique daté, temps réel) | `DispatchTrackingBoard.tsx`, intégré en tête de `OrdersList.tsx` |
| C | Filtres de la structure : recherche, statut, commerçant, livreur, date | `DeliveryPartnerDashboard.tsx` |
| C | Filtre « commerçant » | migration `20261119100000_delivery_company_dispatch_shops.sql` (RPC `delivery_company_dispatch_shops`) |
| D | Notification au livreur (affectation / retrait) | migration `20261119110000_delivery_driver_assignment.sql` |
| D | Performances individuelles des livreurs | même migration (RPC `delivery_company_driver_stats`) + `DeliveryDriverStatsPanel.tsx` |
| D | Réaffectation d'une commande déjà affectée | `DeliveryPartnerDashboard.tsx` (la transition `assigned>assigned` existait déjà côté serveur) |

## Ordre en production
1. Prérequis : migrations `20261118100000`, `20261118110000`, `20261118120000` (étapes A et B) déjà appliquées.
2. Appliquer `20261119100000` puis `20261119110000` (pas de `db push` : voir `prod-deploy-2026-11-07`).
3. Vérifier que le lien du CLI est bien sur la prod avant d'appliquer : `cat supabase/.temp/project-ref` doit afficher `yfggrceynzcwklbxhgix`.
4. Déployer le front **après** les migrations.

## Contrôles après déploiement
- Une structure voit uniquement ses boutiques dans « Tous les commerçants » ; un compte d'une autre structure obtient 0 ligne de `delivery_company_driver_stats` et de `delivery_company_dispatch_shops`.
- Réaffecter une commande : l'ancien livreur reçoit « Une commande vous a été retirée », le nouveau « Une commande vous est affectée » (si son compte est un membre actif de rôle livreur).
- Rôle « livreur » : ne voit ni les performances ni le filtre commerçant ; rôle « réception » : voit le filtre commerçant seulement.

## Limites connues
- La notification du livreur n'existe que s'il a accepté une invitation (compte lié). Un livreur sans compte n'est pas prévenu.
- Le marchand voit le suivi dans la liste de ses commandes ; il n'y a pas de page dédiée.
- Bande blanche sous le contenu des pages sombres : défaut de mise en page global, non traité.
