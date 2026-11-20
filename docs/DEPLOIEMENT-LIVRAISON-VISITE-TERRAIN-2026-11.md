# Livraison réseau — vérification physique des structures (§5)

**Date :** 20/11/2026 · **État :** code et migration écrits, **testés sur base jetable (335/335, dont 105 nouveaux cas)**, migration rejouable. **Migration appliquée sur la dev (xfpbpxncserliskrbaim, historique enregistré) et recette navigateur faite sur la dev (voir plus bas).** Rien commité. Prod : à faire.

## Contenu
| Cahier | Quoi | Où |
|---|---|---|
| §5.1 | Agents terrain : comptes eComfy désignés par e-mail, activables / désactivables | tables `delivery_field_agents`, RPC `delivery_admin_set_field_agent` / `delivery_admin_field_agents` · page `/delivery-admin/visits` |
| §5.2 | Consulter les demandes de vérification, affecter une mission à un agent, voir la structure | `delivery_admin_pending_verifications`, `delivery_admin_schedule_visit` |
| §5.2 | Enregistrer le résultat, la date, les observations, les photos des locaux | `delivery_agent_submit_visit` · page agent `/delivery-agent` (contrôles cochés, photos caméra, date) |
| §5.2 | Accepter / refuser / demander des compléments | décisions existantes du back-office (`admin_decide_delivery_company`) ; bouton « Décider dans le dossier » sous le rapport |
| §5.3 | Statuts : non vérifiée, demandée, visite programmée, vérification en cours, vérifiée, refusée, suspendue (+ « informations demandées ») | `delivery_company_field_status`, déduit des statuts existants et de la visite (aucun statut ancien modifié) |
| §5.3 | Badge officiel seulement après validation, retrait possible | badge existant (`trust_badge_active`), inchangé |
| §12 | Notifications : agent (nouvelle mission, annulation), structure (visite programmée / annulée / effectuée), administration (rapport déposé) | `delivery_notify` |
| §7.3 | Traçabilité | journal `delivery_verification_audit` : `visit_scheduled`, `visit_cancelled` (visibles du candidat), `visit_started`, `visit_completed` (internes) |

## Règles posées par la base
- **Un agent ne lit aucune table.** Il passe par `delivery_agent_my_visits` (ses missions seulement, sans pièce d'identité ni numéro fiscal), `delivery_agent_start_visit` et `delivery_agent_submit_visit`. Un autre agent, un propriétaire de structure ou un compte quelconque est refusé (42501 / P0002).
- **Une seule visite ouverte par dossier** (index unique). Annuler (avec motif obligatoire) pour en reprogrammer une.
- **Rapport** : visite démarrée avant d'être rapportée. « Concluante » exige les cinq contrôles obligatoires cochés (locaux, adresse, entreprise, activité de livraison, cohérence) et au moins une photo ; « non concluante » ou « informations à compléter » exigent des observations (10 caractères). Date ni dans le futur, ni à plus de 30 jours. 12 photos maximum.
- **Photos** : bucket privé `delivery-visits` (10 Mo, JPG/PNG/WEBP) ; dépôt par un agent actif dans son seul dossier ; lecture par l'agent auteur et l'administration (liens signés de 10 min). Le propriétaire de la structure **ne voit ni le rapport, ni les photos, ni les observations** : il voit le statut, la date prévue et « visite effectuée le … ».
- **Agent désactivé** : ses missions non commencées sont annulées, il n'accède plus à rien.
- **Règle d'approbation (réglage `require_field_visit`, désactivée par défaut)** : activée dans « Visites terrain », une **structure** ne peut être approuvée que si une visite concluante a eu lieu **depuis sa dernière demande de vérification** ; un changement d'adresse ou de ville (qui remet le dossier en vérification) impose donc une nouvelle visite. Les livreurs indépendants ne sont pas concernés. Les refus et demandes de compléments restent possibles sans visite. Les jobs système (sans utilisateur) ne sont pas bloqués.

## À décider par la direction
- **Activer la règle d'approbation ?** Le cahier dit qu'une structure n'est « officiellement vérifiée » qu'après contrôle physique. Elle est **désactivée par défaut** pour ne pas bloquer les approbations tant qu'il n'y a pas d'agents désignés. Elle s'active d'une case à cocher dans `/delivery-admin/visits`.
- **Qui sont les agents** : des comptes eComfy existants (la personne crée son compte, puis l'administration saisit son e-mail).

## Tests (base jetable)
```
docker run -d --rm --name ecomfy-visit-test -e POSTGRES_PASSWORD=test postgres:16-alpine
M=supabase/migrations; T=supabase/tests
(cat $T/delivery_kyc.sql $M/20260906010000_ecomfy_delivery_module.sql $M/20260907140000_fix_delivery_rls_and_submission.sql \
     $M/20261016120000_h5_delivery_verification_guard.sql $M/20261106110000_delivery_kyc_audit_notifications.sql \
     $M/20261109110000_delivery_back_sides_and_location.sql $T/delivery_kyc_cases.sql $T/delivery_back_sides_cases.sql \
     $M/20261120100000_delivery_directory_profile.sql $T/delivery_directory_profile_cases.sql \
     $M/20261120110000_delivery_field_visits.sql $T/delivery_field_visits_cases.sql) \
  | docker exec -i ecomfy-visit-test psql -U postgres -v ON_ERROR_STOP=1
```
Résultat : **335 réussis, 0 échec** (122 + 49 + 59 + 105). Migration rejouée une seconde fois : 0 erreur. Les 105 cas couvrent : désignation des agents (admin seulement, e-mail inconnu), programmation (doublon, date passée, agent inactif, droits), isolation entre agents, absence de données d'identité dans la mission, validations du rapport (contrôles, photo, observations, chemins de photo d'un autre dossier / URL / `..`, clés inconnues, date), confidentialité du rapport vis-à-vis du propriétaire, journal interne, règle d'approbation (désactivée, activée, après visite, après changement d'adresse, refus toujours possible), annulation et désactivation d'un agent, droits sur les tables et sur le stockage, droits d'exécution.

## Ordre en production
1. Prérequis : `20261120100000` (répertoire et profil) appliquée ; `20261106110000` et `20261109110000` déjà en prod.
2. `cat supabase/.temp/project-ref` doit afficher `yfggrceynzcwklbxhgix`.
3. Appliquer `20261120110000_delivery_field_visits.sql` seule (pas de `db push`), puis `supabase migration repair --status applied 20261120110000`.
4. Déployer le front **après** la migration.
5. Contrôles : `select count(*) from storage.buckets where id='delivery-visits' and not public` = 1 ; `select value from delivery_settings where key='require_field_visit'` = `false` ; trigger `trg_guard_delivery_company_visit_gate` présent.
6. Désigner les agents, puis décider d'activer la règle.

## Limites connues
- **Pas d'e-mail ni de SMS** : les notifications sont dans l'application (cloche), comme le reste du module (§12 e-mail à faire séparément).
- **Pas de reprogrammation** en un geste : annuler puis reprogrammer.
- **Un agent est un compte eComfy ordinaire** : il voit l'entrée « Missions terrain » dans son menu quand il est actif ; il n'a aucun droit d'administration.
- **Les photos ne sont pas redimensionnées** côté application (10 Mo maximum chacune).
- **Les statuts « refusée » et « suspendue »** viennent du statut du dossier : la décision de refus ou de suspension se prend dans le back-office existant.

## Recette navigateur sur la dev (20/11/2026, toujours par les menus)
Compte utilisé : un fondateur (administrateur), désigné aussi agent terrain ; la structure visitée est « Kouame Logistics Test », que j'ai **remise temporairement en attente** pour l'occasion.

| Parcours | Résultat |
|---|---|
| Administration > « Visites terrain » | Page chargée, « Kouame Logistics Test » listée en « Vérification demandée » ; « Programmer une visite » désactivé tant qu'aucun agent n'existe |
| Désigner un agent (e-mail, nom) | « Agent enregistré », agent listé |
| Programmer une visite (21/11, 10 h, consignes) | « Visite programmée », visite « Programmée », statut de vérification « Visite programmée » |
| Menu « Missions terrain » (visible une fois agent) | Mission affichée : adresse, contact (lien téléphone), zones, consignes |
| Démarrer la visite | Statut « En cours », formulaire de rapport |
| Validations du formulaire | « Concluante » sans contrôle : message listant ce qui manque, envoi désactivé ; contrôles cochés sans photo : « Ajoutez au moins une photo » |
| Photo | Image PNG générée dans la page et envoyée par le champ photo : déposée dans le bucket privé (1/12) |
| Envoyer le rapport | Mission passée en « Terminées : Concluante · 20/11/2026 » ; en base : contrôles, observations, chemin de la photo, date ; **dossier resté « en attente »** (la décision reste à l'administration) |
| Administration > rapport | Contrôles, observations, **photo affichée par lien signé**, bouton « Décider dans le dossier » ; « Dossiers à visiter » indique « dernière visite : concluante » |
| Case « Exiger une visite concluante » | Activée (message « Visite terrain exigée avant approbation »), puis désactivée |
| Ecomfy Livraison > Suivi du dossier | Carte « Vérification sur le terrain » : « Votre structure est vérifiée… » (structure approuvée) |

**Non vu à l'écran :**
- la **règle d'approbation en action** (refus d'approuver sans visite) : couverte par la base jetable (V84, V92) ; aucun dossier de la dev ne s'y prêtait sans en modifier un autre ;
- l'**annulation** d'une visite, la **désactivation** d'un agent ;
- la carte « Vérification sur le terrain » pour un dossier **en attente ou avec visite programmée** (j'ai vu la version « vérifiée » ; le compte propriétaire disponible était celui d'une structure déjà approuvée) ;
- le **point de vue d'un agent qui n'est pas administrateur** : le compte de test cumule les deux rôles (isolation couverte par la base jetable) ;
- la **vue mobile** et la **prise de photo par la caméra** (une image générée a été envoyée à la place).

**Données de dev remises en état :** « Kouame Logistics Test » de nouveau `approved` avec badge, mêmes dates qu'avant ; visites, agent, notifications `field_*`, photo de test supprimés ; réglage `require_field_visit` à `false`. **Restent** : des lignes de journal (`delivery_verification_audit` est en ajout seul : programmation, démarrage, rapport, et deux changements de statut du dossier de test).
