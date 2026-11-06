# Ecomfy Livraison : KYC/KYB, permis A/B, journal d'audit, notifications

**Date :** 6 novembre 2026 · **Périmètre :** le module « sociétés de livraison » (`delivery_companies`, `delivery_drivers`, `delivery_dispatches`…), pas l'ancien module `delivery_providers` / `order_deliveries` (voir [`DEPLOIEMENT-LOGISTIQUE-2026-11.md`](DEPLOIEMENT-LOGISTIQUE-2026-11.md)).
**État :** code et migration prêts, **testés sur base jetable (122 cas sur 122)** puis **appliqués sur la dev (6 nov.) et testés dans Chrome** (section 4bis). Edge Function déployée sur la dev. **Pas appliqué en prod. Non commité.**
**Prérequis de décision :** [`H5-LIVRAISON-MISE-EN-PROD-2026-10.md`](H5-LIVRAISON-MISE-EN-PROD-2026-10.md), section 4 : ce module n'existe dans **aucune** base (prod comprise). Le mettre en prod est une décision du fondateur ; ce travail la rend possible, il ne la prend pas.

## 1. Ce qui était faux ou cassé

| # | Constat | Gravité |
|---|---|---|
| 1 | La migration d'origine du module (`20260906010000`) **ne pouvait pas s'appliquer** : `CREATE TRIGGER … AT BEFORE UPDATE` n'est pas du SQL, et ses politiques lisaient `profiles.role`, colonne qui n'existe pas | Bloquant |
| 2 | Les pièces n'étaient **jamais téléversées** : l'assistant enregistrait des `blob:` (disparaissent à la fermeture de l'onglet) et des `data:` (images entières dans une colonne texte). L'administrateur ne voyait rien | Bloquant |
| 3 | Vérification **simulée** : « OCR » toujours réussi, score facial `Math.random()`, catégories de permis **toujours `['A','B']`** donc le contrôle permis ↔ véhicule ne pouvait jamais échouer. Le back-office affichait des chiffres figés (« 98.4 % Conforme », « CNI Officielle (CI) ») | Trompeur |
| 4 | Journal d'audit dans `localStorage` du navigateur de l'administrateur : perdu, non partagé, falsifiable | Sécurité |
| 5 | `20260907140000` donnait `FOR ALL` sur `delivery_drivers` à **tout utilisateur connecté** (pièces d'identité et permis lisibles et modifiables par n'importe qui) et ouvrait aussi `delivery_hubs` | Sécurité |
| 6 | « Demander un complément » envoyait l'e-mail de **refus**. L'e-mail d'approbation affirmait « Permis A/B validé » et « Face matching réussi (94 %) » sans qu'aucun contrôle n'ait eu lieu ; sans clé d'envoi, la fonction répondait « e-mail envoyé » | Trompeur |
| 7 | Les « notes internes (privées) » étaient lues par le candidat (« Instructions de la fondation ») et par tout utilisateur connecté tant que la structure était approuvée | Fuite |
| 8 | Si l'Edge Function échouait (y compris pour un non-administrateur), le service retournait `success: true` et écrivait le statut directement | Contournement |
| 9 | Un propriétaire dont le dossier était **suspendu** pouvait se remettre « en attente » ; `delivery_cash_transfers` acceptait une insertion libre (`WITH CHECK (true)`) | Sécurité |

## 2. Ce que fait le module maintenant

**KYC (responsable).** Identité déclarée (prénom, nom, date de naissance, type, numéro et expiration de la pièce) dans une table à part `delivery_company_kyc` (lisible du seul propriétaire et des administrateurs, pas de l'annuaire des vendeurs). Pièce et selfie avec la pièce **déposés dans le bucket privé `delivery-kyc`** (10 Mo, JPG/PNG/WEBP/PDF), affichés par liens signés de 5 minutes. Le serveur refuse : un chemin qui n'est pas un fichier de l'appelant (`blob:`, `data:`, URL, dossier d'un autre), un responsable mineur, une pièce expirée, un numéro de pièce **déjà associé à un autre dossier** (même refusé : un administrateur tranche).

**KYB (structure).** Nom, adresse, photo de l'entrepôt (obligatoire pour une société), NIF et RCCM avec leurs justificatifs (facultatifs, mais si « immatriculée » est coché, un des deux numéros est exigé).

**Il n'y a toujours aucune vérification automatique.** Aucun fournisseur d'identité (Smile Identity, Veriff…) n'est branché et je n'ai pas inventé de simulation à la place. La comparaison nom / naissance / pièce / visage est faite **par un humain** au back-office, avec une liste de quatre contrôles à cocher avant de pouvoir valider (cochées, elles sont inscrites dans la note interne du journal). L'interface le dit au candidat.

**Permis A/B.** La catégorie est **déclarée** par le livreur (cases A à E), avec numéro et date d'expiration, et comparée au véhicule : moto et tricycle → A ; voiture → B ; van → B ou C ; autre → A ou B. Même règle dans la base (`delivery_driver_issues`) et dans le navigateur (`src/lib/vehicleLicenseMatcher.ts`, figée par `vehicleLicenseMatcher.test.ts`).

- La base **refuse l'enregistrement** d'un livreur au permis incompatible ou expiré (propriétaire) et **refuse l'approbation** (administrateur) ; pièces et numéro de permis doivent être présents.
- **Invariant, même pour un administrateur ou le service** : un livreur n'est `is_active` que s'il est approuvé **et** que son permis est conforme et valable.
- Modifier permis, véhicule, pièces ou identité d'un livreur approuvé le repasse **en attente et inactif** jusqu'à nouvelle vérification. Idem pour une structure approuvée dont les pièces ou l'identité changent (badge retiré).
- Une course (`delivery_dispatches`) ne peut aller qu'à une structure approuvée avec badge, et n'être affectée qu'à un livreur approuvé, actif et de cette structure.
- **Expiration** : une tâche quotidienne (03:30 UTC, `pg_cron`) suspend les livreurs dont le permis ou la pièce a expiré, passe en « complément demandé » les structures dont la pièce du responsable a expiré, et envoie des rappels à 30 et 7 jours.

**Journal d'audit.** Table `delivery_verification_audit`, **en ajout seul** (UPDATE, DELETE et TRUNCATE refusés à tous, même au propriétaire de la base), écrite uniquement par des déclencheurs de la base : soumission, resoumission, re-vérification, décisions (avec acteur, rôle, ancien et nouveau statut, code et motif), pièces modifiées (noms des champs, **jamais** leurs valeurs ni les numéros de pièce), livreurs ajoutés/décidés/suspendus. Les notes internes sont des lignes `internal` que le candidat ne peut pas lire. Le candidat voit son propre historique ; l'administrateur voit tout.

**Notifications.** Table `delivery_notifications` (lisible et « marquer comme lu » par son seul destinataire), publiée en temps réel, avec une cloche sur la page de statut, le tableau de bord partenaire, la resoumission et le back-office. Candidat : dossier approuvé / refusé / complément / suspendu, livreur approuvé / refusé / suspendu, rappels d'expiration. Administrateurs (rôles `admin`, `founder`, `co_founder`) : nouveau dossier, dossier resoumis, re-vérification requise, nouveau livreur d'une structure déjà approuvée. L'e-mail de décision reste envoyé par l'Edge Function, en doublon.

**Décisions.** Elles passent par les RPC `admin_decide_delivery_company` et `admin_decide_delivery_driver` : atomiques, réservées aux administrateurs **par la base**, avec contrôle des conditions d'approbation. L'Edge Function `verify-delivery-identity` les appelle **avec le JWT de l'administrateur** (l'acteur est donc journalisé) puis envoie l'e-mail, dont le texte n'affirme plus que ce qui est vrai ; sans clé d'envoi elle répond `emailSent: false`.

## 3. Fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20260906010000_ecomfy_delivery_module.sql` | **Corrigé en place** (syntaxe des déclencheurs, administrateurs via `has_role`). Jamais appliqué nulle part |
| `supabase/migrations/20261106110000_delivery_kyc_audit_notifications.sql` | Nouvelle migration, rejouable |
| `supabase/tests/delivery_kyc.sql` + `delivery_kyc_cases.sql` | Socle et 122 cas (base jetable) |
| `supabase/functions/verify-delivery-identity/index.ts` | Réécrite |
| `src/lib/deliveryService.ts`, `deliveryKycStorage.ts`, `driverLicenseForm.ts`, `vehicleLicenseMatcher.ts` (+ test) | Services et règles |
| `src/hooks/useDeliveryNotifications.ts` | Notifications temps réel |
| `src/components/delivery/` : `DeliveryOnboardingWizard`, `DeliveryDocUpload`, `DeliverySelfieCapture`, `DriverLicenseFields`, `DeliveryDriversPanel`, `DeliveryAuditTimeline`, `DeliveryDocThumb`, `DeliveryNotificationBell` | Écrans |
| `src/pages/` : `DeliveryAdminPage`, `DeliveryResubmissionPage`, `DeliveryStatusPage`, `DeliveryPartnerDashboard` | Pages |
| **Supprimés** | `identityVerificationEngine.ts`, `kycAbstractionService.ts`, `verificationAuditService.ts`, `DeliveryIdentityVerificationStep.tsx` (les contrôles simulés) |

## 4. Tests

```
docker run -d --rm --name ecomfy-kyc-test -e POSTGRES_PASSWORD=test postgres:16-alpine
(cat supabase/tests/delivery_kyc.sql \
     supabase/migrations/20260906010000_ecomfy_delivery_module.sql \
     supabase/migrations/20260907140000_fix_delivery_rls_and_submission.sql \
     supabase/migrations/20261016120000_h5_delivery_verification_guard.sql \
     supabase/migrations/20261106110000_delivery_kyc_audit_notifications.sql \
     supabase/tests/delivery_kyc_cases.sql) | docker exec -i ecomfy-kyc-test psql -U postgres -v ON_ERROR_STOP=1
```

Résultat du 06/11 : **122 réussis, 0 échec** (puis les mêmes migrations sur la dev, section 4bis). Les trois migrations du module sont jouées telles quelles, donc la chaîne s'applique. Migration rejouée une seconde fois : 0 erreur. Contrôle négatif : sur l'état d'**avant** (trois anciennes migrations seules), un tiers connecté lit et modifie les livreurs d'un autre dossier ; après, il lit 0 ligne.

Les cas couvrent : inscription (URL `blob:`, chemin d'autrui, mineur, doublon de pièce, permis incompatible / expiré / absent), absence d'auto-validation, isolation entre candidats, annuaire (voit les structures approuvées mais ni identité ni livreurs), décisions (motifs obligatoires, note interne invisible du candidat, cascade des livreurs conformes seulement), re-vérification automatique, journal en ajout seul (y compris pour un administrateur), notifications (lecture et marquage limités à soi), course et transfert d'argent, droits d'exécution des fonctions, règle permis ↔ véhicule, stockage privé, expiration et rappels (non doublés).

## 4bis. Test navigateur sur la dev (6 novembre 2026)

Les quatre migrations ont été appliquées sur la dev (`xfpbpxncserliskrbaim`) dans l'ordre, sans erreur ; `verify-delivery-identity` déployée ; app locale sur la dev ; comptes `logitest-*` créés puis **supprimés** (comptes, dossiers, journal, notifications, fichiers du bucket). Rien d'autre n'a été touché.

| Parcours | Résultat |
|---|---|
| Livreur indépendant : permis **B** pour une moto | Message « catégorie A requise pour Moto / Scooter (déclaré : B) » et passage à l'étape suivante **bloqué** |
| Même parcours avec la catégorie **A**, 3 pièces envoyées | OK. Les trois fichiers sont des JPEG dans le bucket **privé**, chemins en base (plus de `blob:`) |
| Dossier soumis | Statut « en attente », livreur en attente et inactif ; journal : soumission, identité, livreur ajouté ; les administrateurs reçoivent la notification |
| Back-office : ouverture du dossier | Identité, pièces et permis affichés par liens signés ; permis jugé compatible |
| « Demander un complément » avec une note interne | Candidat : message de l'équipe, cloche (1), historique ; **la note interne n'apparaît nulle part côté candidat** ; acteur journalisé = l'administrateur |
| Resoumission d'un nouveau selfie | Dossier de nouveau en attente ; journal : « resubmitted » |
| Validation avec les 4 contrôles cochés et cascade | Structure approuvée, badge actif ; le livreur conforme est approuvé et actif ; `total_drivers_count` = 1 ; contrôles cochés recopiés dans la note interne |
| Société : même numéro de pièce qu'un autre dossier | Refusé : « Cette pièce d'identité est déjà associée à un autre dossier » |
| Société : entrepôt, NIF, selfie | Dossier transmis |
| `delivery_enforce_document_expiry()` sur la dev | S'exécute (0 suspension, 0 rappel : aucune pièce à échéance) |

Corrigé pendant le test (interface) : boutons « Précédent », « Actualiser », « Ouvrir la caméra », « Ajouter »… blancs avec texte illisible (la variante `outline` a un fond clair) ; puces de catégories A à E presque invisibles ; étapes inactives trop pâles ; récapitulatif « pour motorcycle » (maintenant « Moto / Scooter ») ; libellés illisibles sur la page de resoumission ; « 0 livreurs enregistrés » (maintenant « 0 livreur(s) actif(s) sur 1 ») ; titre « Dossier refusé » sur une erreur d'envoi (maintenant « Envoi impossible »).

**Non testé :** e-mail réellement reçu (l'adresse de test est invalide ; la fonction a répondu « e-mail envoyé » sans que je puisse le vérifier) ; alerte en direct sans rechargement ; ajout d'un livreur depuis la page de statut ; refus et suspension depuis l'interface (couverts par les 122 cas SQL) ; mobile ; expiration réelle d'un permis (simulée seulement en base jetable).

**Constat hors module, corrigé :** `20260907140000` (et `20260908170000`) créent le bucket public `shop-assets` avec un dépôt **et une mise à jour** ouverts à tout le monde, sans compte : n'importe qui pouvait héberger des fichiers sous le domaine du projet ou écraser l'avatar d'un autre utilisateur. Le code n'utilise ce bucket que pour `avatars/<user_id>/…` (`Profile.tsx`) et `parcel-photos/…` (`CustomerParcelPhotoModal`, composant non branché aujourd'hui).

Correctif : `20261106120000_shop_assets_restrict_uploads.sql` (nouvelle migration, les anciennes ne sont pas modifiées). Elle supprime **toutes** les politiques d'écriture du bucket (quel que soit leur nom), puis autorise : un utilisateur connecté dépose et remplace seulement dans `avatars/<son id>/`, et dépose (sans écraser ni supprimer) dans `parcel-photos/`. Lecture publique inchangée, donc les URL existantes continuent de fonctionner. Plafond 10 Mo et images seulement (jpeg, png, webp, gif ; le PDF n'est plus accepté dans ce bucket, aucun usage). Aucun bucket créé.

Preuve : `supabase/tests/shop_assets_policies.sql` + `shop_assets_policies_cases.sql` sur base jetable, avec les politiques ouvertes d'origine et une politique de nom inconnu : **5/16 avant, 16/16 après** (anonyme refusé, dossier d'autrui refusé en dépôt, en écrasement et en déplacement, chemins hors règle refusés, lecture publique conservée, politique d'un autre bucket intacte). Appliquée sur la dev et enregistrée dans l'historique ; non testée dans le navigateur (le changement d'avatar passe par `Profile.tsx` avec repli sur `avatars` puis sur une image `data:`).

À savoir : un visiteur **non connecté** qui téléverserait une photo de colis est maintenant refusé (le composant retombe sur un aperçu local, comme avant quand le bucket n'existait pas). Le bucket `avatars` (20260908170000) garde la même faiblesse d'écriture ouverte ; il n'est utilisé qu'en repli, à durcir de la même façon si on le garde.

## 5. Déploiement (ne rien appliquer sans décision du fondateur)

1. **Décider** que le module part (H5 section 4). Sinon, ne rien faire : l'ancien front reste cassé comme avant et l'Edge Function déployée est sans danger.
2. Pré-contrôle (lecture seule, éditeur SQL) : `to_regclass('public.delivery_companies')` doit être `NULL` ; types `delivery_verification_status`, `delivery_dispatch_status`, `delivery_cash_status` absents ; `pg_cron` actif ; secret `RESEND_API_KEY` présent (sinon les e-mails ne partent pas, les notifications dans l'application fonctionnent).
3. Appliquer **une migration à la fois dans l'éditeur SQL** (jamais `db push`), dans l'ordre : `20260906010000` (corrigée), `20260907140000`, `20261016120000`, `20261106110000`, puis `20261106120000` (durcissement de `shop-assets`, voir 4bis ; à jouer aussi si `20260908170000` l'a été avant). Vérifier après chacune.
4. Déployer `verify-delivery-identity` (`--use-api --project-ref …`) **avant** le front, puis le front.
5. Contrôles : le bucket `delivery-kyc` est privé ; `select tgname from pg_trigger where tgrelid='public.delivery_verification_audit'::regclass and not tgisinternal` renvoie 2 lignes ; la tâche `delivery-document-expiry` existe dans `cron.job`.
6. Recette navigateur avec de vrais comptes (non faite) : inscription livreur et société, refus puis resoumission, complément, approbation avec cascade, permis incompatible refusé, notification en direct côté candidat et administrateur, lien signé qui expire.

## 6. Reste hors périmètre, à décider

- **Vérification automatique** (OCR, liveness, comparaison faciale) : il faut un fournisseur et des clés. La structure est prête (pièces en bucket privé, journal, décisions), pas le branchement.
- **Les deux modules de livraison coexistent** (`delivery_providers` / `order_deliveries` en prod, `delivery_companies` / `delivery_dispatches` ici). Ils ont chacun leur flux de commande, d'affectation et d'argent à la livraison. Mettre le second en prod sans trancher laisse deux circuits d'encaissement.
- **`delivery_dispatches` et `delivery_cash_transfers`** : j'ai fermé l'insertion libre des transferts et verrouillé l'affectation, mais la mise à jour reste permissive (la boutique comme la structure peuvent modifier n'importe quelle colonne d'une course, montants compris). C'est l'étape 3 du plan H5 (« relire toutes les politiques du module »), non faite ici.
- **Alerte e-mail aux administrateurs** à chaque nouveau dossier : seules les notifications dans l'application existent.
- **Suppression des fichiers** du bucket `delivery-kyc` quand un dossier est supprimé ou refusé définitivement (conservation légale à définir).
- Un dossier **refusé** garde son numéro de pièce « pris » : si le vrai titulaire s'inscrit après un usurpateur, un administrateur doit supprimer l'ancien dossier.

## 7. Retour arrière

Supprimer les déclencheurs `trg_delivery_company_audit`, `trg_delivery_company_kyc_audit`, `trg_delivery_driver_audit`, `trg_guard_delivery_company_kyc`, `trg_guard_delivery_driver`, `trg_guard_delivery_dispatch_assignment`, les fonctions `register_delivery_application`, `resubmit_delivery_application`, `admin_decide_delivery_*`, `delivery_enforce_document_expiry` (et `cron.unschedule('delivery-document-expiry')`), puis rétablir `guard_delivery_company_verification` depuis `20261016120000`. Les tables `delivery_verification_audit`, `delivery_notifications`, `delivery_company_kyc`, `delivery_company_review_notes` et leurs données peuvent rester. Rétablir les politiques d'avant rouvre le trou n° 5 : ne le faire qu'avec le front précédent, et seulement sur une base où le module n'est pas encore utilisé.
