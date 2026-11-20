# Livraison réseau — cotisation, caution et activation opérationnelle (§4.1)

**Date :** 20/11/2026 · **État :** code et migration écrits, **testés sur base jetable (425/425, dont 90 nouveaux cas)**, migration rejouable. **Migration appliquée sur la dev (xfpbpxncserliskrbaim, historique enregistré) et recette navigateur faite sur la dev.** Prod : à faire. **Le Premium (§4.2) n'est pas traité.**

## Contenu
| Cahier | Quoi | Où |
|---|---|---|
| §4.1 | Afficher les frais exigibles | `delivery_company_fees` · page structure `/delivery/fees` (bouton « Cotisation et caution » du tableau de bord du propriétaire) |
| §4.1 | Enregistrer les paiements | la structure **déclare** un paiement (`delivery_company_declare_payment`) ; l'administration le confirme ou le rejette (`delivery_admin_decide_payment`) ou enregistre un paiement reçu hors ligne (`delivery_admin_record_payment`) |
| §4.1 | Historique et statut de paiement | historique dans la page structure ; états : à jour, paiement en contrôle, paiement à effectuer, cotisation expirée, dispensée, accès suspendu |
| §4.1 | Activer ou suspendre l'accès opérationnel | règle `require_company_activation` (désactivée par défaut), suspension et dispense motivées (`delivery_admin_set_activation`) |
| §4.1 | Contrôle par l'administration | page `/delivery-admin/fees` (menu « Cotisations livraison » et bouton « Cotisations » du back-office) |
| §4.1 | Restitution de la caution | `delivery_admin_refund_deposit` |
| §7.3 | Traçabilité | journal : `fee_declared`, `fee_confirmed`, `fee_rejected`, `deposit_refunded`, `access_suspended`, `access_restored` (visibles du propriétaire) |
| §12 | Notifications | administration (paiement à contrôler) ; structure (confirmé, rejeté avec motif, caution restituée, accès suspendu / rétabli) |

## Règles posées par la base
- **Aucun montant imposé.** Montant de la cotisation, durée (0 = payée une fois, sans échéance), montant de la caution, devise et conditions de restitution sont réglés par l'administration dans « Cotisations livraison ». **Un montant à 0 signifie « non exigé ».** Valeurs initiales : tout à 0.
- **Règle d'activation désactivée par défaut.** Tant qu'elle l'est, rien n'est bloqué : les structures voient seulement ce qu'elles doivent.
- **Activée**, une structure dont la cotisation ou la caution n'est pas à jour **ne peut plus recevoir de nouvelle course** (déclencheur sur la création d'une course) et **n'apparaît plus dans le répertoire** des marchands. Les courses déjà transmises ne sont pas touchées.
- **Suspension** : s'applique dans tous les cas, règle activée ou non. **Dispense** : décision motivée de l'administration (structure considérée à jour).
- **Seules les structures** (`profile_type = 'manager'`) sont concernées. Les livreurs indépendants ne le sont jamais.
- **Montant d'un paiement déclaré** = barème au moment de la déclaration (le client ne le choisit pas). Une seule déclaration en attente par structure et par nature. L'administration peut enregistrer directement un paiement : il remplace une déclaration en attente de même nature.
- **Cotisation** : un renouvellement part de la fin de validité en cours si elle n'est pas échue. **Caution** : une seule versée à la fois ; après restitution, la structure peut en reverser une.
- **Droits** : tables en lecture seule pour le propriétaire (ses lignes) et l'administration ; toute écriture passe par les fonctions. Le motif est obligatoire pour un rejet, une suspension, une dispense et les modalités d'une restitution (5 caractères).
- **Jobs système et migrations** (sans utilisateur) ne sont pas bloqués par le déclencheur.

## À décider par la direction
- **Montants, périodicité de la cotisation, montant de la caution, conditions de restitution** (le cahier les laisse à la direction) : à saisir dans « Cotisations livraison ».
- **Quand activer la règle d'activation.** Avant cela, prévenir les structures existantes (elles verront leur état dans « Cotisation et caution »), sinon elles cesseront de recevoir des commandes dès l'activation.
- **Modes de paiement acceptés** et où la structure doit payer : aujourd'hui le paiement est **déclaré** (mode, référence) puis contrôlé ; il n'y a pas de paiement en ligne.

## Tests (base jetable)
Même chaîne que [DEPLOIEMENT-LIVRAISON-VISITE-TERRAIN-2026-11.md](DEPLOIEMENT-LIVRAISON-VISITE-TERRAIN-2026-11.md), en ajoutant `20261120120000_delivery_fees_activation.sql` puis `supabase/tests/delivery_fees_activation_cases.sql` à la fin.
Résultat : **425 réussis, 0 échec** (335 précédents + 90). Migration rejouée une seconde fois : 0 erreur. Les cas couvrent : réglages (droits, valeurs invalides), déclaration (montant du barème, doublon, tiers, livreur indépendant, anonyme), droits sur les tables, règle désactivée puis activée (blocage d'une course, système non bloqué, livreur indépendant non bloqué), confirmation et rejet, durée de 12 mois, renouvellement, expiration, suspension (même règle désactivée), dispense, restitution de la caution, répertoire masquant les structures non à jour, tableau de contrôle, droits d'exécution.

## Ordre en production
1. Prérequis : `20261120110000` (visites terrain) appliquée.
2. `cat supabase/.temp/project-ref` doit afficher `yfggrceynzcwklbxhgix`.
3. Appliquer `20261120120000_delivery_fees_activation.sql` seule (pas de `db push`), puis `supabase migration repair --status applied 20261120120000`.
4. Déployer le front **après** la migration.
5. Contrôles : `select key, value from delivery_settings where key in ('require_company_activation','membership_fee','deposit_fee')` = `false`, montants à 0 ; trigger `trg_guard_delivery_dispatch_company_operational` présent sur `delivery_dispatches`.
6. Saisir le barème, informer les structures, puis décider d'activer la règle.

## Recette navigateur sur la dev (20/11/2026, toujours par les menus)
Compte utilisé : un fondateur (administrateur), propriétaire d'un livreur indépendant que j'ai **passé temporairement en structure** pour tester la page structure ; remis en livreur ensuite.

| Parcours | Résultat |
|---|---|
| Administration > « Cotisations livraison » : barème (15 000 XOF / 12 mois, caution 50 000, conditions de restitution) | « Barème enregistré » |
| Propriétaire > Ecomfy Livraison > « Cotisation et caution » | Frais, durée et conditions affichés ; état « Paiement à effectuer » |
| Déclarer la cotisation (mode, référence) | « Paiement déclaré » ; état « Paiement en contrôle » ; ligne « En contrôle » dans l'historique |
| Administration > confirmer | Paiement hors de la liste ; cotisation valable jusqu'au 20/11/2027 |
| Administration > enregistrer la caution (espèces) | Structure « À jour », « Restituer la caution » proposé |
| Administration > suspendre (motif) | Le propriétaire voit « Accès suspendu » avec le motif |
| Compte livreur indépendant | « Non soumis à la cotisation ni à la caution » |
| Rejet d'un paiement | Motif vide bloqué ; avec motif, retour à « Paiement à effectuer » |
| Dispense | État « Dispensée » |
| Restitution de la caution | Retour à « caution : à verser » |
| Règle activée, transmission de la commande #996 à une structure non à jour | Refusée : « Cette structure ne peut pas recevoir de commandes… » ; aucune course créée |
| Même fenêtre de transmission, après correctif | « Aucune structure » : les structures non à jour ne sont plus proposées |

**Défauts trouvés pendant la recette et corrigés :** montant à 0 affiché « jusqu'au — » (désormais « non exigée ») ; structures non à jour encore proposées dans le répertoire (désormais masquées) ; texte de la case d'activation figé sur « Désactivé » (désormais selon l'état).

**Non vu à l'écran :**
- la **vue mobile** (la fenêtre du navigateur n'a pas changé de largeur) ;
- l'**expiration** d'une cotisation et le **renouvellement** (couverts par la base jetable) ;
- le **déblocage** réel d'une commande après paiement (couvert par la base jetable ; je n'ai pas transmis de vraie commande pour ne pas créer de course sur des données de dev ressemblant à de vraies commandes) ;
- la page structure avec une cotisation **sans échéance** (durée 0).

**Données de dev remises en état :** compte de test redevenu livreur indépendant ; paiements, suspensions, dispenses et notifications `fee_*` supprimés ; barème à 0, règle désactivée ; aucune course créée. **Restent** : des lignes de journal (`delivery_verification_audit` est en ajout seul).

## Limites connues
- **Pas de paiement en ligne** : la structure paie hors de l'application puis déclare ; l'administration contrôle à la main.
- **Pas de rappel automatique** avant l'expiration d'une cotisation (pas d'e-mail ni de tâche planifiée) ; l'expiration est constatée au moment où on regarde l'état.
- **Pas de renouvellement automatique** ; le **Premium (§4.2)** (5 USD, visibilité, badge, souscription, changement de formule) reste à faire et demande un vrai paiement en ligne.
- **Les courses déjà transmises** à une structure devenue non opérationnelle ne sont pas retirées.
- **Le tableau de bord financier (§11.3)** n'existe pas encore ; la page « Cotisations livraison » en est la base.
