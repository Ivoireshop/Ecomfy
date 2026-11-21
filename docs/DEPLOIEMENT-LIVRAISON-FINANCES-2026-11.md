# Livraison réseau — gestion financière de l'administration (§11.3)

**Date :** 21/11/2026 · **État :** code et migration écrits, **testés sur base jetable (545/545, dont 36 nouveaux cas)**, migration rejouable. **Migration appliquée sur la dev (xfpbpxncserliskrbaim, historique enregistré) et recette navigateur faite sur la dev.** Prod : à faire. Montants en **XOF** (aucune devise imposée : un paiement dans une autre devise serait affiché à part, jamais additionné).

## Contenu
| Cahier §11.3 | Où |
|---|---|
| Cotisations des structures | carte « Cotisations encaissées » · `delivery_admin_finance_summary` |
| Cautions encaissées / détenues | cartes « Cautions encaissées » (période) et « Cautions détenues » (à l'instant) |
| Abonnements Premium | carte « Abonnements Premium » + nombre de Premium actifs |
| Renouvellements | carte « Renouvellements » : cotisations et Premium payés par une structure déjà abonnée |
| Paiements en attente | carte « Paiements en attente » + lien « Contrôler les paiements » |
| Remboursements de caution | carte « Cautions restituées » (période) |
| Historique financier par structure | bouton « Historique » de chaque ligne : tous les paiements (rejetés et restitués compris), formules, périodes, motifs · `delivery_admin_company_finance` |
| (§12, alerte financière) | « Abonnements et échéances » : Premium et cotisations qui arrivent à échéance sous 30 jours |
| Export | « Exporter en CSV » (tableau par structure ; historique d'une structure), séparateur « ; », ouverture directe dans Excel |

Accès : menu Administration > « Finances livraison » et bouton « Finances » du back-office Livraison (`/delivery-admin/finance`). Réservé à l'administration.

## Règles posées par la base
- **Lecture seule** : aucune table nouvelle, aucune écriture. Les deux fonctions exigent un administrateur (propriétaire, tiers et anonyme refusés, y compris pour sa propre structure).
- **Période** : 7, 30, 90 jours, tout, ou dates choisies. Elle porte sur les **encaissements** (date de la décision), **renouvellements** et **restitutions** (date de restitution). **Caution détenue, paiements en attente et échéances** reflètent l'état à l'instant, quelle que soit la période.
- **Encaissé** = paiement confirmé, ou confirmé puis restitué (une caution restituée a bien été encaissée). Les paiements rejetés et en attente ne comptent jamais comme encaissés.
- **Renouvellement** = un paiement confirmé alors qu'un paiement confirmé plus ancien existe pour la même structure et la même nature (cotisation ou Premium).
- **Devises** : chaque total est donné par devise. Une période dont le début est après la fin est refusée (message d'erreur, résultats masqués).
- **Export CSV** : une cellule qui commencerait par `=`, `+`, `-` ou `@` est préfixée d'une apostrophe pour ne pas être exécutée comme formule par un tableur.

## À décider par la direction
- **Rapprochement bancaire** : la page suit ce qui est déclaré puis confirmé par l'administration ; il n'y a pas de rapprochement automatique avec un opérateur de paiement (le paiement reste hors application, cf. §4.1 et §4.2).
- **Alertes** : les échéances sont visibles dans la page ; il n'y a pas d'envoi automatique (e-mail, rappel) avant l'expiration.

## Tests (base jetable)
Même chaîne que [DEPLOIEMENT-LIVRAISON-PREMIUM-2026-11.md](DEPLOIEMENT-LIVRAISON-PREMIUM-2026-11.md), en ajoutant `20261121110000_delivery_finance.sql` puis `supabase/tests/delivery_finance_cases.sql` à la fin.
Résultat : **545 réussis, 0 échec** (509 précédents + 36). Migration rejouée une seconde fois : 0 erreur. Les cas couvrent : droits (propriétaire, tiers, anonyme, structure inconnue, période inversée), totaux sur toute la période par nature, rejeté et en attente non comptés, séparation des devises, renouvellements, restitué et détenu, échéances à 30 jours, filtrage par période, tableau par structure, historique d'une structure et de son livreur indépendant, lecture seule, droits d'exécution.

## Ordre en production
1. Prérequis : `20261121100000` (Premium) appliquée.
2. `cat supabase/.temp/project-ref` doit afficher `yfggrceynzcwklbxhgix`.
3. Appliquer `20261121110000_delivery_finance.sql` seule (pas de `db push`), puis `supabase migration repair --status applied 20261121110000`.
4. Déployer le front **après** la migration.
5. Contrôle : `select proname from pg_proc where proname in ('delivery_admin_finance_summary','delivery_admin_company_finance')` renvoie les deux fonctions.

## Recette navigateur sur la dev (21/11/2026, toujours par les menus)
Compte : un fondateur (administrateur). Données de test : 8 paiements fictifs (mode « RECETTE-FIN ») répartis sur deux structures, tous en XOF.

| Parcours | Résultat |
|---|---|
| Menu Administration > « Finances livraison » | page ouverte, période 30 jours par défaut |
| 30 jours | cotisations 15 000 (1), cautions 50 000 (1), Premium 3 250 (1), renouvellements 18 250 (2), en attente 15 000 (1), détenue 50 000, restituée 50 000 : conforme aux données |
| « Tout » | cotisations 30 000 (2), cautions 100 000 (2), Premium 6 500 (2) : identique aux cas de test de la base jetable |
| Échéances | « 1 Premium actif », « 2 échéances sous 30 jours » |
| Tableau par structure et historique de Kouame Logistics Test | tous les paiements, rejeté avec motif, « En contrôle » |
| Export CSV (tableau et historique) | contenu capturé et vérifié : colonnes, montants, dates, motifs |
| Période personnalisée avec début après la fin | message « La date de début est après la date de fin. », résultats masqués |
| Vue mobile (cadre de 390 px) | cartes en une colonne ; tableau défilant dans sa carte, sans débordement de la page |

**Défauts trouvés pendant la recette et corrigés :** résultats de l'ancienne période conservés sous le message d'erreur ; tableau écrasé en mobile (colonnes illisibles).
**Non vu à l'écran :** le défilement tactile du tableau sur un vrai téléphone ; l'ouverture du fichier CSV dans Excel (le contenu est vérifié, pas le logiciel).
**Données de dev remises en état :** paiements de test supprimés ; compte d'Ulrich redevenu livreur indépendant. Restent des lignes du journal d'audit (ajout seul).

## Limites connues
- **Pas de rapprochement bancaire ni de rappel automatique** (voir plus haut).
- **Pas de graphique ni de courbe dans le temps** : la page donne des totaux par période et par structure.
- Les paiements d'un livreur indépendant n'existent pas (la cotisation, la caution et le Premium ne concernent que les structures) : ils n'apparaissent donc pas dans les totaux.
