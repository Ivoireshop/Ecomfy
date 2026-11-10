# Livraison : suivi du dossier, verso des pièces, localisation de l'entrepôt (09/11/2026)

Retour reçu le 09/11 (deux notes vocales) sur la partie livraison. Trois sujets traités.

**État (09/11, soir) : code et migration testés (base jetable 171/171, vitest 284/284, build OK). Migration `20261109110000` APPLIQUÉE SUR LA DEV et enregistrée dans l'historique ; parcours complet testé dans Chrome sur la dev (section « Recette navigateur »). Pas en prod. Non commité.**

## Recette navigateur (dev, 09/11)
Comptes de test : un candidat sans dossier (société) et le fondateur (dossier « livreur » ancien sans verso).
- Inscription société : recto/verso obligatoires (blocage sans verso), localisation obligatoire, clic sur la carte, glisser du repère, GPS simulé ; envoi réel des fichiers ; redirection vers le statut ; le menu mène ensuite au statut (plus au formulaire).
- Back-office : dossier ancien signalé « incomplet » ; pré-remplissage + « Demander un complément » ; « Demander le verso » sur un livreur (refus motif `MISSING_BACK_SIDE` accepté par la base) ; bouton « Valider » bloqué tant que verso/localisation manquent ; lien Google Maps ; versos affichés.
- Candidat : message de l'admin et pièces manquantes visibles, correction avec versos et GPS, retour « en attente ».
- Admin : approbation du livreur puis des deux dossiers une fois complets.
- Rappel : un compte fondateur est « privilégié » côté base (les gardes de pièces ne s'appliquent pas à lui) ; le reset du livreur après dépôt d'un verso se vérifie avec un compte non-admin (couvert par les cas SQL 160-165).
- Données de test laissées sur la dev : dossier « Kouame Logistics Test » (approuvé) et le dossier « Ulrich Djate Express » passé en approuvé pendant la recette.

## Défauts d'interface corrigés au passage
Cartes recto/verso de hauteurs inégales ; textes de la carte de statut alignés à gauche malgré l'icône centrée (une règle globale remet `text-align: left` sur les `div`) ; messages de l'équipe sans retours à la ligne ; étape « Examen » en rouge quand un complément est demandé ; bouton « Examiner le dossier » blanc sur fond sombre ; badge de statut coupé en deux sur mobile ; bouton « Accéder à l'espace livreur » qui débordait sur mobile ; ponctuation du récapitulatif.

## Ce qui change

### 1. Le candidat retrouve toujours le statut de sa demande
- Avant : le lien « Ecomfy Livraison » du menu menait toujours au formulaire d'inscription ; la page de statut n'était vue qu'une fois, juste après l'envoi.
- Maintenant : `/delivery/register` redirige vers `/delivery/status` dès qu'un dossier existe.
- La page de statut affiche en plus : les étapes (dossier reçu → examen → décision), les dates, la liste des pièces fournies/manquantes, un lien « Compléter mon dossier ».
- Le motif de refus et le message de complément étaient déjà affichés ; inchangés.

### 2. Recto et verso
- Pièce d'identité du responsable, pièce d'identité d'un livreur, permis : deux imports (recto + verso). Le passeport garde une seule page.
- Inscription, correction du dossier et ajout/correction d'un livreur sont couverts.
- **L'administrateur peut demander le verso** : dans le dossier, encadré « Éléments absents » avec « Pré-remplir la demande » (puis « Demander un complément ») ; pour un livreur, bouton « Demander le verso » (refus avec le motif `MISSING_BACK_SIDE`, déjà rempli).
- Règle serveur : un dossier ancien sans verso n'est **pas invalidé**, un dossier déjà approuvé le reste, mais **une nouvelle approbation est refusée** tant que le verso manque. Une resoumission l'exige aussi.

### 3. Localisation de l'entrepôt (société de livraison)
- Bouton « Utiliser ma position » (GPS) **et** carte OpenStreetMap : clic ou glisser du repère. La source (GPS ou carte) et la précision sont conservées.
- Exigée à l'inscription, à la resoumission et à l'approbation d'une société (pas d'un livreur indépendant).
- Visible du seul propriétaire et des administrateurs (table `delivery_company_location`, RLS comme l'identité du responsable), **pas** de l'annuaire des vendeurs. Le back-office affiche les coordonnées et un lien « Ouvrir dans Google Maps ».
- Un déplacement de l'entrepôt par un dossier approuvé est journalisé, sans nouvelle vérification (décision à confirmer).

## Fichiers
- `supabase/migrations/20261109110000_delivery_back_sides_and_location.sql` (additive, rejouable) ; tests `supabase/tests/delivery_back_sides_cases.sql` (49 cas) + fixtures de `delivery_kyc_cases.sql` mises à jour.
- Front : `deliveryDossier.ts` (+ tests), `LocationMap.tsx`, `WarehouseLocationPicker.tsx`, `DeliveryApplicationProgress.tsx`, assistant d'inscription, page de correction, page de statut, panneau livreurs, back-office.
- Dépendances : `leaflet` et `@types/leaflet` (carte chargée à la demande, ~45 ko gzip). `bun.lock` / `bun.lockb` non mis à jour (la CI utilise `package-lock.json`).

## Ordre de déploiement (dev puis prod)
1. **Migration d'abord** : sans elle, le front ne peut plus lire le dossier (la requête demande `delivery_company_location`).
   `supabase db query --linked -f supabase/migrations/20261109110000_delivery_back_sides_and_location.sql` puis `supabase migration repair --status applied 20261109110000 --linked`. **Jamais `db push`** : l'historique n'est pas aligné et ce serait appliquer des dizaines d'autres migrations. Vérifier avant que le lien CLI pointe sur le bon projet.
2. Front.
3. Aucune Edge Function à redéployer (`verify-delivery-identity` laisse passer le nouveau code de motif ; la base le valide).

## Preuves
- Base jetable (Postgres 16) : chaîne complète des migrations du module + 171 cas, dont 49 nouveaux (refus sans verso/localisation, coordonnées invalides, point (0,0), confidentialité face à un tiers/anonyme, approbation refusée sur dossier ancien, complément, resoumission, ré-approbation, verso modifié sur dossier approuvé, livreur à passeport). Migration rejouée une seconde fois sans erreur.
- Carte testée seule dans Chrome (page temporaire supprimée) : clic, GPS simulé, alerte de précision faible, refus de permission.

## Non testé / à savoir
- Non joué en navigateur : livreur indépendant s'inscrivant de zéro (testé en SQL seulement), passeport, mobile de l'assistant d'inscription (carte testée seule en 375 px), e-mails réellement reçus.
- Dev seulement : en prod, appliquer la migration avant le front (voir ci-dessus).
- Les tuiles viennent de `tile.openstreetmap.org` : correct pour un faible trafic ; à passer sur un fournisseur de tuiles si l'usage grossit. La CSP actuelle les autorise (`img-src https:`).
- Pas de recherche d'adresse sur la carte (pas de géocodage).
- Dossiers déjà déposés en prod : ils apparaissent « incomplets » dans le back-office tant que verso/localisation manquent ; l'admin les demande avec le bouton prévu.
- Le glisser du repère sur la carte n'a pas été joué (clic seulement).
