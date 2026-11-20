# Livraison réseau — répertoire des structures (§2) et profil modifiable (§3.2)

**Date :** 20/11/2026 · **État :** code et migration **testés sur base jetable (230/230)**, **migration appliquée sur la dev** (xfpbpxncserliskrbaim, historique enregistré) et **recette navigateur faite sur la dev** (section « Recette »). Rien commité. Prod : à faire.

## Contenu
| Cahier | Quoi | Où |
|---|---|---|
| §2.1 | Fiche : nom, logo, description, services, ville, adresse, téléphone, WhatsApp, e-mail, zones, note, avis, livraisons réussies, badge « vérifiée » | `delivery_directory_card` (migration) · `DeliveryDirectoryParts.tsx` |
| §2.2 | Recherche par nom, par zone (ville du siège ou zone couverte), filtre structures / livreurs indépendants, pagination | RPC `delivery_directory_search` · `DeliveryDirectoryBrowser.tsx` |
| §2.3 | Deux catégories dans le même répertoire (`profile_type` : `manager` / `driver`) | idem |
| §6.1 | Le marchand consulte la fiche puis choisit la structure dans la fenêtre « Envoyer à un livreur » | `DispatchOrderModal.tsx` (liste remplacée par le répertoire) |
| §2 | Page autonome `/delivery/directory`, entrée de menu « Répertoire livreurs » | `DeliveryDirectoryPage.tsx`, `App.tsx`, `AppSidebar.tsx` |
| §3.2 | Profil modifiable par le responsable : nom, logo, description, services, adresse, ville, zones, téléphones, e-mail | `DeliveryProfileEditor.tsx` (bouton « Modifier le profil de ma structure », propriétaire seulement) |
| §3.2 | Modification sensible soumise à l'administration | trigger `guard_delivery_company_profile` (migration) |

## Règles posées par la base (pas seulement par l'écran)
- **Répertoire** : seules les structures `approved` avec badge sont renvoyées. La fiche ne contient ni identité, ni pièces, ni numéros fiscaux, ni notes internes. **L'adresse d'un livreur indépendant n'est jamais renvoyée** (c'est son domicile). Fonctions refusées à `anon`.
- **Modification sensible** : changer le nom, l'adresse, la ville ou le pays d'une structure **approuvée** la renvoie en `pending_verification`, retire le badge et la sort du répertoire jusqu'à la décision d'un administrateur. L'écran prévient et demande une confirmation. Un administrateur n'est pas soumis à cette règle.
- **Journal** : chaque modification de profil écrit une ligne `profile_updated` dans `delivery_verification_audit` (champs modifiés, jamais les valeurs ; indique si une nouvelle vérification a été déclenchée).
- **Faille corrigée au passage** : le propriétaire pouvait écrire lui-même `rating_score`, `reviews_count`, `successful_deliveries_count`, `total_dispatches_count`, `total_drivers_count`, `average_payout_delay_hours`. Désormais refusé (42501) ; les mises à jour internes de la base (compteur de livreurs) passent toujours.
- **Logo** : bucket public `delivery-logos` (2 Mo, JPG/PNG/WEBP) ; dépôt, remplacement et suppression seulement dans son propre dossier ; la base refuse un chemin hors de son dossier, une URL ou un `..`.

## Tests (base jetable)
```
docker run -d --rm --name ecomfy-dir-test -e POSTGRES_PASSWORD=test postgres:16-alpine
M=supabase/migrations; T=supabase/tests
(cat $T/delivery_kyc.sql $M/20260906010000_ecomfy_delivery_module.sql $M/20260907140000_fix_delivery_rls_and_submission.sql \
     $M/20261016120000_h5_delivery_verification_guard.sql $M/20261106110000_delivery_kyc_audit_notifications.sql \
     $M/20261109110000_delivery_back_sides_and_location.sql $T/delivery_kyc_cases.sql $T/delivery_back_sides_cases.sql \
     $M/20261120100000_delivery_directory_profile.sql $T/delivery_directory_profile_cases.sql) \
  | docker exec -i ecomfy-dir-test psql -U postgres -v ON_ERROR_STOP=1
```
Résultat : **230 réussis, 0 échec** (122 KYC + 49 verso/localisation + 59 nouveaux). La migration rejouée une seconde fois : 0 erreur. Les 59 cas couvrent : accès refusé à `anon`, structures non approuvées exclues, recherche par nom (casse, jokers littéraux), par zone, par type, classement par note, pagination et plafond, absence de champs sensibles, adresse d'un indépendant masquée, modification du profil, limites de longueur, logo (dossier d'autrui, URL, `..`), indicateurs de performance verrouillés, retour en vérification sur changement d'adresse ou de ville, exemption de l'administrateur, journal, droits d'exécution, bucket.

## Ordre en production
1. Prérequis : migrations `20261106110000` et `20261109110000` déjà en prod (KYC du 07/11 ; la seconde est à vérifier).
2. Vérifier `cat supabase/.temp/project-ref` : `yfggrceynzcwklbxhgix`.
3. Appliquer `20261120100000_delivery_directory_profile.sql` seule (pas de `db push`), puis `supabase migration repair --status applied 20261120100000`.
4. Déployer le front **après** la migration.
5. Contrôles : `select count(*) from storage.buckets where id='delivery-logos' and public` = 1 ; `select tgname from pg_trigger where tgname='trg_guard_delivery_company_verification_profile'` = 1 ligne ; un compte non connecté obtient `permission denied` sur `delivery_directory_search`.

## Limites connues
- **Niveau d'abonnement** (§2.1) et **mise en avant Premium** : absents, ils dépendent du §4 (décision de la direction). Le classement est : note, puis livraisons réussies, puis nom ; l'ajout du Premium se fera dans `delivery_directory_search`.
- Les **avis** ne sont pas encore alimentés (aucun écran n'écrit `delivery_company_reviews`) : la note affichée reste celle par défaut tant qu'aucun avis n'existe ; l'écran affiche « Pas encore d'avis » quand `reviews_count` vaut 0.
- Le **remplacement du logo** laisse l'ancien fichier dans le bucket (pas de nettoyage).
- Le **profil** n'est modifiable que par le **propriétaire** du dossier, pas par un collaborateur « administrateur de la structure ».
- Les **documents justificatifs** restent gérés par le parcours existant (« Suivi du dossier » / resoumission), pas par ce formulaire.
- Si le téléphone public est vide, la fiche montre le téléphone du responsable (comportement antérieur de l'annuaire).

## Recette navigateur sur la dev (20/11/2026, toujours par les menus)
Compte utilisé : un **fondateur** (donc administrateur de la plateforme) qui est aussi propriétaire de « Ulrich Djate Express ».

| Parcours | Résultat |
|---|---|
| Menu « Répertoire livreurs » | 2 fiches (structure + livreur indépendant), badge « Vérifiée par eComfy » |
| Fiche du livreur indépendant | Ville seulement, **aucune adresse**, WhatsApp, zones |
| Fiche de la structure | Adresse complète, téléphone, WhatsApp, zones |
| Recherche par nom (« kouAME ») | 1 résultat, casse ignorée |
| Zone « Bouaké » (non couverte) | Message « Aucune structure vérifiée… » |
| Zone « abidj » | 2 résultats, badge « Couvre votre zone » |
| Filtre « Livreurs indépendants » | 1 résultat |
| Boutique > Commandes > « Transmettre à une structure » | Fenêtre avec recherche, 2 structures, « Voir la fiche », « Choisir » ; « Structure choisie : Oui ✓ ». **Annulé : aucune commande transmise** (les boutiques de la dev contiennent des commandes d'allure réelle) |
| Ecomfy Livraison > « Modifier le profil de ma structure » | Formulaire chargé avec les valeurs du dossier |
| Description + zone ajoutées, enregistrées | Toast « Profil enregistré » ; base : valeurs écrites, statut resté `approved` ; **visible dans le répertoire** (description, recherche par la nouvelle zone) |
| Modification de l'adresse | Avertissement orange + case à cocher ; bouton « Enregistrer » désactivé tant qu'elle n'est pas cochée. **Non enregistré** |

**Corrigé pendant la recette :** la fenêtre d'envoi filtrait d'office sur la ville du client (Bongouanou) et affichait « 0 résultat » alors que deux structures existent. Elle liste maintenant toutes les structures et propose un lien « Ne montrer que celles qui couvrent <ville> ». Le badge « Matching auto / Recommandé », devenu faux, est remplacé par « Structure choisie ». Libellé « Logo » qui touchait le bouton : espacé.

**Non vu à l'écran :**
- le **retour en vérification** après changement d'adresse et la **ligne de journal** `profile_updated` : le compte de test est administrateur, que la base exempte volontairement (aucune ligne de journal n'a donc été écrite). Couvert par la base jetable (D80 à D85, D90 à D94) ; à revoir en navigateur avec un compte propriétaire non administrateur ;
- le **dépôt d'un logo** (aucun fichier envoyé) ;
- la vue **mobile** ;
- le refus d'un **e-mail de contact invalide** à l'écran (couvert côté base, D54).

**Données de dev remises en état :** description de « Ulrich Djate Express » vidée, zones remises à « Abidjan ». Aucune commande transmise.
