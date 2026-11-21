# Livraison réseau — abonnement Premium des structures (§4.2)

**Date :** 21/11/2026 · **État :** code et migration écrits, **testés sur base jetable (509/509, dont 84 nouveaux cas)**, migration rejouable (0 erreur au second passage). **Migration appliquée sur la dev (xfpbpxncserliskrbaim, historique enregistré) et recette navigateur faite sur la dev le 21/11. Prod : à faire. Rien n'est commité.**

## Contenu
| Cahier | Quoi | Où |
|---|---|---|
| §4.2 | Abonnement Premium « de 5 USD » | formule initiale « Premium mensuel », **3 250 XOF** (5 USD au taux de 650 XOF de l'application ; devise demandée : franc CFA), 1 mois (réglage `premium_plans`, modifiable) |
| §4.2 | Souscription | page structure `/delivery/premium` (bouton « Premium » du tableau de bord du propriétaire) · `delivery_company_declare_premium` |
| §4.2 | Paiement | la structure **déclare** un paiement, l'administration le confirme ou le rejette (même circuit que la cotisation) ou enregistre un paiement hors ligne (`delivery_admin_record_premium`) |
| §4.2 | Durée de validité, expiration | période datée sur chaque paiement confirmé ; l'expiration est constatée à la lecture |
| §4.2 | Renouvellement, changement de formule | un nouveau paiement prolonge à partir de la fin en cours ; la nouvelle formule prend effet à l'échéance de la précédente (rien n'est perdu) |
| §4.2 | Badge, meilleur positionnement, mise en avant | fiche du répertoire : `premium` + badge « Premium » ; **classement : Premium d'abord**, puis note, livraisons réussies, nom |
| §4.2 | Distinct de la vérification | le Premium ne touche ni `verification_status`, ni `trust_badge_active`, ni la cotisation, ni l'accès opérationnel |
| §11.1 / §11.3 | Contrôle administration | page `/delivery-admin/fees` : éditeur de formules, paiements Premium à contrôler, état Premium par structure, « Enregistrer un Premium », « Arrêter le Premium » |
| §7.3, §12 | Traçabilité et notifications | journal : `premium_declared`, `premium_confirmed`, `premium_rejected`, `premium_ended` ; notifications à l'administration (paiement à contrôler) et à la structure (confirmé, rejeté avec motif, arrêté) |

## Règles posées par la base
- **Le paiement ne remplace jamais le contrôle physique.** Une structure non vérifiée peut souscrire, mais n'apparaît pas au répertoire (test P54, P55). Le badge « Premium » ne dit rien sur la vérification, qui garde son badge propre.
- **Formules réglables** (`delivery_admin_set_premium_plans`) : code, libellé, durée 1 à 120 mois, montant > 0, devise ; 6 formules au maximum. **Liste vide = souscription désactivée** ; les abonnements déjà payés restent valables.
- **Montant, devise et durée figés à la déclaration** (colonnes `plan_code`, `plan_label`, `period_months`) : le client ne les choisit pas, et un changement de barème n'affecte pas un paiement déjà déclaré.
- **Une seule déclaration en attente par structure.** Un enregistrement par l'administration remplace une déclaration en attente.
- **Seules les structures** (`profile_type = 'manager'`) : un livreur indépendant est refusé. Une structure **suspendue** ne peut pas souscrire et sort du répertoire (non opérationnelle).
- **Fin anticipée** (`delivery_admin_end_premium`) : motif obligatoire (5 caractères), tracée, notifiée.
- **Historique** : la page « Cotisation et caution » ne montre plus les paiements Premium (page dédiée).
- **Droits** : tables en lecture seule ; tout passe par des fonctions ; fonctions internes (`delivery_premium_state`, `delivery_premium_plans_list`, `delivery_company_is_premium`) non exécutables par `authenticated`.

## À décider par la direction
- **Le montant et la durée.** Le cahier dit « un abonnement Premium de 5 USD » sans durée : j'ai posé **un mois** (modifiable dans « Formules Premium » sans toucher au code ; une formule annuelle ou trimestrielle s'ajoute au même endroit).
- **Le changement de formule** prend effet à l'échéance (choix de prudence : aucun prorata, aucun remboursement). À revoir si la direction veut un effet immédiat.
- **Le paiement en ligne** : aujourd'hui, paiement hors application puis déclaration et contrôle manuel, comme pour la cotisation. Un vrai paiement en ligne (Ecomfy Pay / GeniusPay) demanderait des clés qui ne sont pas disponibles sur la dev.

## Tests (base jetable)
```
docker run -d --rm --name ecomfy-prem-test -e POSTGRES_PASSWORD=test postgres:16-alpine
M=supabase/migrations; T=supabase/tests
(cat $T/delivery_kyc.sql $M/20260906010000_ecomfy_delivery_module.sql $M/20260907140000_fix_delivery_rls_and_submission.sql \
     $M/20261016120000_h5_delivery_verification_guard.sql $M/20261106110000_delivery_kyc_audit_notifications.sql \
     $M/20261109110000_delivery_back_sides_and_location.sql $T/delivery_kyc_cases.sql $T/delivery_back_sides_cases.sql \
     $M/20261120100000_delivery_directory_profile.sql $T/delivery_directory_profile_cases.sql \
     $M/20261120110000_delivery_field_visits.sql $T/delivery_field_visits_cases.sql \
     $M/20261120120000_delivery_fees_activation.sql $T/delivery_fees_activation_cases.sql \
     $M/20261121100000_delivery_premium.sql $T/delivery_premium_cases.sql) \
  | docker exec -i ecomfy-prem-test psql -U postgres -v ON_ERROR_STOP=1
```
Résultat : **509 réussis, 0 échec** (425 précédents + 84). Les cas couvrent : formules (droits, montant, durée, doublon, code, forme), déclaration (montant figé, doublon, tiers, livreur indépendant, formule inconnue, anonyme), décision (rejet motivé, confirmation, double traitement), durée exacte, indépendance de la vérification et de la cotisation, structure non vérifiée absente du répertoire, badge et classement (un Premium passe devant un non-Premium mieux noté), renouvellement et changement de formule, expiration (badge retiré, classement), réabonnement, enregistrement hors ligne, fin anticipée, suspension, formules désactivées, tableau de contrôle, droits d'exécution.

## Recette navigateur sur la dev (21/11/2026, toujours par les menus)
Compte : un fondateur (administrateur), propriétaire d'un livreur indépendant que j'ai **passé temporairement en structure**, remis en livreur ensuite.

| Parcours | Résultat |
|---|---|
| Livreur indépendant > Ecomfy Livraison > « Premium » | « réservé aux structures de livraison » |
| Structure > « Premium » | « Non souscrit », formule **3 250 XOF**, valable 1 mois |
| Souscrire (mode, référence) | « Paiement déclaré » ; état « Paiement en contrôle » ; bouton de souscription masqué ; ligne « En contrôle » dans l'historique |
| Administration > « Cotisations livraison » | éditeur de formules (3250 XOF) ; paiement « Premium · Premium mensuel » à contrôler |
| Confirmer | structure : « Premium mensuel jusqu'au 21 déc. 2026 » ; bouton « Arrêter le Premium » proposé |
| Répertoire livreurs (menu) | badge « Premium » à côté de « Vérifiée par eComfy » ; la structure Premium passe **avant** une autre qui la précède par ordre alphabétique |
| Arrêter le Premium, motif de 3 caractères | refusé (« 5 caractères minimum ») |
| Arrêter avec un motif valide | « Premium arrêté » ; côté structure : « Expiré », badge retiré, réabonnement proposé, historique conservé |
| Console | aucune erreur |

### Compléments de recette (21/11/2026)
| Parcours | Résultat |
|---|---|
| Déclaration puis **rejet** avec motif | structure : retour à « non souscrit » ; historique « Rejeté » avec le motif ; notification « Paiement rejeté : <motif> » |
| **Enregistrement hors ligne** par l'administration (« Enregistrer un Premium ») | confirmé tout de suite ; « Premium enregistré » ; bouton « Arrêter le Premium » proposé ; notification « Premium enregistré » |
| **Éditeur de formules** : ajout d'une formule trimestrielle (8 000 XOF, 3 mois), modification du montant mensuel (3 500), enregistrement | base mise à jour (contrôlée) |
| Éditeur : retrait de la formule trimestrielle, retour à 3 250 XOF | base conforme |
| **Notifications** de la structure (cloche) | « Premium enregistré », « Paiement rejeté » (avec motif), « Paiement à contrôler » |
| **Vue mobile** (cadre de 390 px de large : le navigateur ne redimensionne pas la fenêtre) | page structure et page d'administration lisibles, une colonne, barre de navigation basse, historique et éditeur utilisables |

**Non vu à l'écran :** le renouvellement et l'expiration naturelle (couverts par la base jetable, P70 à P81) ; la souscription avec une seconde formule côté structure ; la vue mobile sur un vrai téléphone (cadre de 390 px seulement, sans les gestes tactiles). Défaut mineur constaté : le libellé d'une formule est tronqué dans son champ en mobile (la valeur est complète).
**Données de dev remises en état :** compte redevenu livreur indépendant ; paiements Premium et notifications supprimés ; formules revenues à « Premium mensuel, 3 250 XOF, 1 mois ». **Restent** des lignes du journal (`delivery_verification_audit` est en ajout seul).

## Ordre en production
1. Prérequis : `20261120120000` (cotisation) appliquée.
2. `cat supabase/.temp/project-ref` doit afficher `yfggrceynzcwklbxhgix`.
3. Appliquer `20261121100000_delivery_premium.sql` seule (pas de `db push`), puis `supabase migration repair --status applied 20261121100000`.
4. Déployer le front **après** la migration.
5. Contrôles : `select value from delivery_settings where key = 'premium_plans'` renvoie la formule à 3250 XOF ; la contrainte `delivery_company_payments_kind_check` accepte `premium`.

## Limites connues
- **Pas de paiement en ligne** ni de **rappel avant expiration** (pas d'e-mail, pas de tâche planifiée) ; pas de **renouvellement automatique**.
- **Recette navigateur à faire** : page structure, page d'administration (éditeur de formules, enregistrement, arrêt), badge et ordre dans le répertoire côté marchand, vue mobile.
- Le Premium n'est proposé qu'aux **structures** ; les livreurs indépendants n'ont pas de formule équivalente (le cahier parle de « structures de livraison »).
