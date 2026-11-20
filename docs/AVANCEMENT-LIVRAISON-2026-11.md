# Ecomfy Livraison — avancement par rapport au cahier des charges

**Date :** 20/11/2026 · **Référence :** [CAHIER-CHARGE-LIVRAISON.md](CAHIER-CHARGE-LIVRAISON.md) · **Branche :** `jeanmarc`
**Dev :** `xfpbpxncserliskrbaim` (tout est appliqué) · **Prod :** `yfggrceynzcwklbxhgix` (étapes A à E **non déployées**)

Le découpage A à E est celui du chantier, pas celui du cahier. Aucune « étape F » n'est définie dans les documents.

## 1. Ce qui est fait

| Étape | Sections du cahier | Contenu | Commit | Guide |
|---|---|---|---|---|
| A | §6 | Transmission des commandes à une structure, réception, acceptation ou refus | d1b02d5 | — |
| B | §8 | Équipe de la structure : invitations, rôles (admin, opérations, réception, livreur), permissions | d1b02d5 | — |
| C | §7 | Suivi marchand (regroupement par état, historique daté) et filtres de la structure | 03099c9 | [DEPLOIEMENT-LIVRAISON-SUIVI-AFFECTATION-2026-11.md](DEPLOIEMENT-LIVRAISON-SUIVI-AFFECTATION-2026-11.md) |
| D | §9 | Affectation et réaffectation aux livreurs, notification du livreur, performances individuelles | 03099c9 | idem |
| Temps réel | §10 | Publication de `delivery_dispatches`, abonnements des tableaux de bord | 517c321 | idem |
| E | §11.2 | Page « Contrôle des opérations » réservée à l'administration | 31a8a81 | idem (section E) |
| Correctifs | — | Champ e-mail de l'équipe lisible, menu « Ecomfy Livraison » aiguillé, bouton « Suivi du dossier » (propriétaire), entrée de menu « Opérations Livraison » | ca0e826, d66e309 | — |

Déjà en production avant ce chantier : KYC/KYB des structures, permis, journal d'audit, notifications (07/11), flux logistique (05/11).

Migrations de ce chantier (dans l'ordre) : `20261118100000`, `20261118110000`, `20261118120000`, `20261119100000`, `20261119110000`, `20261119120000`, `20261119130000`.

## 2. Recette sur la dev (20/11/2026)

### Parcours navigateur (toujours en passant par les menus)
- **Propriétaire (Kouame Logistics Test)** : tableau de bord, notifications, invitation d'un collaborateur, bouton « Suivi du dossier ». Aucune erreur en console.
- **Compte non administrateur** : `/delivery-admin/operations` répond « Accès réservé à l'administration ». `/delivery-admin` s'ouvre mais ne liste aucune candidature.
- **Fondateur et propriétaire (Ulrich Djate Express)** : tableau de bord, filtres (statut, livreur), performances des livreurs, suivi de l'argent encaissé, page Opérations (périodes 7, 30 et 90 jours, chiffres conformes à la base), suivi marchand dans les commandes de la boutique avec son filtre « Chez un livreur ».
- **Collaborateur invité** : lien d'invitation accepté, statut `active` en base. Profil **réception** (en-tête « Agent de réception », sans équipe, performances ni suivi du dossier) et profil **livreur** (une seule commande visible, sans filtre commerçant, performances, équipe ni réaffectation).
- **Menu** : « Ecomfy Livraison » mène au tableau de bord ; Administration → « Fondation Livraison » puis « Opérations Livraison ».
- **Temps réel** : après une mise à jour sans changement de valeur, le tableau de bord de la structure et la liste des commandes du marchand rechargent leurs données d'eux-mêmes.

### Tests de base, en transaction annulée (rien n'est enregistré)
- Droits par rôle : opérations, réception et livreur n'accèdent ni à la liste de l'équipe, ni aux invitations, ni à la page admin. Les performances des livreurs ne sont visibles que pour « opérations » ; le filtre commerçant ne l'est ni pour le livreur.
- Cycle complet d'une commande : transmission, réception, acceptation, affectation, réaffectation, récupération, en livraison, livrée (8 lignes d'historique). Notifications correctes : « affectée » au nouveau livreur, « retirée » à l'ancien. L'ancien livreur ne peut plus agir et un livreur ne peut pas affecter.
- Page Opérations avec un échec de livraison : totaux, taux de réussite et bloc incidents corrects.

### Limites de la recette
- Le filtre commerçant du profil **réception** n'a pas pu être vu à l'écran (aucune commande dans la structure de test) ; côté serveur il est bien accessible.
- Le bloc **litiges** de la page Opérations est vide : seule la forme de la réponse est vérifiée.
- La réaffectation n'a **pas** été faite dans le navigateur sur les données de dev (elles ressemblent à de vraies commandes). Elle est validée côté base.
- L'événement temps réel lui-même n'a pas été observé : on a constaté le rechargement de la page après la mise à jour.
- Limites déjà connues : un livreur sans compte lié n'est pas notifié ; litiges et incidents plafonnés à 50 lignes ; le marchand voit le suivi dans la liste de ses commandes, sans page dédiée.

### État laissé sur la dev
- L'invitation de test `invitation.johnmarkus00@gmail.com` est active sur « Kouame Logistics Test » avec le rôle `operations`. À supprimer avant la prod si on copie la base.
- Une mise à jour sans changement (`delivery_note = delivery_note`) a été faite sur le dispatch `305301b4-…` pour le test du temps réel.

## 3. Ce qui reste à faire

Constat établi par recherche dans le code et les migrations, pas par lecture fichier par fichier.

| Section | Attendu | État |
|---|---|---|
| §2.1, 2.2 | Répertoire des structures : fiches, recherche par nom ou zone, choix d'une structure | **Absent.** Seule `getVerifiedCompaniesForCity` liste les structures vérifiées de la ville d'une commande. |
| §2.3 | Deux catégories (structures et livreurs indépendants) | Champ `profile_type` présent ; parcours côté marchand à vérifier avec le répertoire. |
| §3.1 | Tableau de bord structure complet | **Partiel** : total reçu, retournées et historique quotidien non vus. |
| §3.2 | Profil modifiable (nom, logo, description, zones, documents), validation admin des changements sensibles | **Absent** (aucune fonction de modification trouvée). |
| §4 | Cotisation, caution, Premium à 5 USD | **Absent.** Montants, périodicité et restitution de la caution **à définir par la direction**. |
| §11.1 | Gestion de l'abonnement et historique d'une structure | À vérifier (valider, refuser, suspendre existent). |
| §11.3 | Gestion financière admin | **Absent**, dépend du §4. |
| §12 | Notifications par e-mail ou autre canal | **Absent** (dans l'application seulement). Le cahier demande de prévoir l'architecture. |
| §10 | Géolocalisation du livreur | Hors périmètre (« ultérieurement » dans le cahier). |
| §16 | Scénarios « le marchand recherche une structure », « la structure souscrit au Premium », « les livreurs particuliers sans régression » | Non réalisables tant que §2 et §4 manquent. |

### Ordre proposé
1. §2 (répertoire) et §3.2 (profil) : indépendants d'une décision de la direction.
2. §4 et §11.3 : après décision de la direction sur les montants et conditions.
3. §12 e-mail et §3.1 complet.

### Déploiement en production (étapes A à E)
1. Vérifier que `supabase/.temp/project-ref` vaut `yfggrceynzcwklbxhgix`.
2. Appliquer les 7 migrations ci-dessus dans l'ordre, **sans `db push`** (voir le déploiement du 07/11).
3. Déployer le front **après** les migrations.
4. Contrôles : voir le guide [DEPLOIEMENT-LIVRAISON-SUIVI-AFFECTATION-2026-11.md](DEPLOIEMENT-LIVRAISON-SUIVI-AFFECTATION-2026-11.md).
5. Pousser les 6 commits de `jeanmarc` et ouvrir la PR.
