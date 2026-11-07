# Démonstration fondateur : la livraison, étapes à suivre

**Date :** 6 novembre 2026 · **Environnement :** la **dev** (`xfpbpxncserliskrbaim`), app locale sur http://localhost:9080 · **Durée :** environ 25 minutes (A : 12 min, B : 10 min) · **Pour :** la personne qui présente.

Ce document décrit quoi préparer, quoi cliquer dans quel ordre, et quoi ne pas promettre. Tout ce qui est dit « testé » l'a été sur la dev (5 et 6 novembre) ; ce qui ne l'a pas été est signalé.

## 0. Ce qu'il faut savoir avant

Il existe **deux modules de livraison**. Ils ne se parlent pas.

| | Circuit A : commande → livraison | Circuit B : inscription et vérification d'un partenaire |
|---|---|---|
| Module | ancien (`delivery_providers`, `order_deliveries`) | nouveau « Ecomfy Livraison » (`delivery_companies`…) |
| Ce qu'on y montre | la boutique expédie, le prestataire affecte, le livreur livre avec signature, la boutique voit la preuve | un livreur ou une société s'inscrit avec ses pièces, un administrateur les vérifie, décision et historique |
| En production | **oui** (guide `DEPLOIEMENT-LOGISTIQUE-2026-11.md`, déployé le 05/11) | **non** : il n'existe dans aucune base de production, décision du fondateur (`H5-LIVRAISON-MISE-EN-PROD-2026-10.md`, section 4) |
| Testé dans le navigateur | 5 novembre | 6 novembre |

**Ne pas dire** que le circuit B reçoit déjà des commandes : l'écran qui enverrait une commande à une société du nouveau module (`DispatchOrderModal`) n'est branché sur aucune page. Le circuit B se montre comme la **porte d'entrée** (inscription, contrôle, décision), le circuit A comme **le flux réel**.

## 1. Préparation (à faire la veille, 30 minutes)

### 1.1 Lancer l'app sur la dev

```
npm run dev
```
Le fichier `.env` pointe déjà sur la dev et le port est 9080. Ouvrir http://localhost:9080 et se connecter avec le compte marchand (propriétaire de « BOUTIQUE TEST »).

### 1.2 Comptes à créer (inscription normale sur /auth)

| Rôle dans la démo | Compte | Sert pour |
|---|---|---|
| **Marchand** | le vôtre (propriétaire de BOUTIQUE TEST) | A |
| **Prestataire de livraison** | un second compte, par exemple `prestataire.demo@…` | A et B |
| **Livreur** | un troisième compte | A |
| **Candidat livreur** | un quatrième compte (nouveau, sans dossier) | B |
| **Administrateur** | un compte ayant le rôle `admin`, `founder` ou `co_founder` | B |

Utiliser des adresses que vous contrôlez : l'envoi d'e-mails n'a pas pu être vérifié (voir 5).

### 1.3 Circuit A : préparer le prestataire et le livreur

L'état de la dev au 6 novembre : le flux (migrations de garde, fonctions d'expédition et de suivi) est en place ; **aucune zone de livraison, aucun livreur rattaché, et BOUTIQUE TEST n'est connectée à aucun prestataire.** Deux prestataires existent déjà (DLK Services, elitis service), reliés à d'autres boutiques.

1. **Créer le prestataire.** Connecté avec le compte « prestataire », ouvrir `/delivery-signup`, remplir nom (par exemple « Démo Express »), téléphone, ville. Puis `/delivery-dashboard` doit s'ouvrir.
2. **Connecter la boutique au prestataire.** Compte marchand : Paramètres de la boutique, bloc **Partenaires de livraison**, bouton **Connecter** en face de « Démo Express ».
3. **Rattacher le livreur.** Aucun écran ne permet à un livreur de rejoindre un prestataire (le code d'invitation affiché dans « Mon Équipe » n'est pas traité par l'app livreur). Le faire dans l'**éditeur SQL du tableau de bord Supabase de la dev** :

```sql
insert into public.delivery_company_members (provider_id, user_id, role, is_active)
select dp.id, u.id, 'driver', true
from public.delivery_providers dp, auth.users u
where dp.company_name = 'Démo Express'
  and u.email = 'EMAIL_DU_COMPTE_LIVREUR';
```
Vérifier : une ligne insérée. (Si l'étape 2 échoue, la même chose en SQL : `insert into public.shop_delivery_connections (shop_id, delivery_provider_id, status) values ('d5dcee9c-b484-4ead-bb13-42cdc57db009', '<id du prestataire>', 'active');`)

4. **Pas de zone** : aucun écran ne crée de zones, donc l'**affectation automatique du livreur ne se fera pas**. C'est voulu pour la démo : le prestataire choisit le livreur à la main (étape A3). Ne pas promettre l'affectation automatique.

### 1.4 Circuit A : préparer une commande payée

Faire une commande payée en ligne sur la boutique de test, comme pour la démonstration du paiement : `http://localhost:9080/shop/boutique-test/p/test-prod`, **quantité 2** (le minimum GeniusPay est 200 FCFA), **un numéro jamais utilisé dans l'heure** (limite de 5 commandes par heure et par numéro), paiement simulé sur la page sandbox. Résultat : une commande « payée ». À faire **une seule fois, la veille** ; pendant la démo on réutilise cette commande, ou on en refait une (30 secondes) devant le fondateur.

Si vous voulez aussi montrer l'argent encaissé à la livraison (A7) : dans les paramètres de la boutique, ajouter le paiement à la livraison, puis faire une commande « À la livraison ».

### 1.5 Circuit B : préparer les fichiers

Trois images (JPG ou PNG, moins de 10 Mo chacune) : une pièce d'identité fictive, un selfie, une photo d'entrepôt. **Jamais de vraies pièces d'identité.** Elles sont stockées dans le bucket privé de la dev.

### 1.6 Répétition générale

Dérouler A1 à A5 et B1 à B4 une fois entièrement. Le plus fragile à découvrir en direct : le rattachement du livreur (1.3) et le numéro de téléphone déjà utilisé.

## 2. Circuit A : de la commande à la preuve de livraison (12 min)

À dire en ouverture : « Un client a payé en ligne ; voyons ce qui se passe pour la boutique, le prestataire et le livreur. »

| # | Qui | Action | Ce que l'on voit |
|---|---|---|---|
| A1 | Marchand | Gestion de la boutique, **Commandes** : ouvrir la commande payée | Commande « payée », client, adresse |
| A2 | Marchand | Cliquer **Expédier** sur la commande (une commande livrée, annulée ou retournée ne peut plus être expédiée), choisir « Démo Express », valider | Une livraison « en attente » apparaît, **sans livreur** (pas de zone). Le bouton Expédier reste visible tant que la course n'a pas démarré |
| A3 | Prestataire | `/delivery-dashboard`, onglet **Missions & Dispatch** : dans la ligne de la livraison, choisir le livreur dans la liste | Livreur affecté. Son nom et son téléphone s'affichent, ainsi que ceux du client |
| A4 | Livreur | `/delivery/driver` | Il ne voit **que ses courses**, avec client, adresse et « Déjà payé · rien à encaisser » |
| A5 | Livreur | Ouvrir la mission, **Démarrer la course**, puis **Livrer** : tracer une signature à la souris et valider | Course « livrée » |
| A6 | Marchand | Rafraîchir la commande | Statut **Livré**, lien **Voir la preuve de livraison** (ouvre la signature) |

Deux moments forts à ne pas rater :
- **Alerte en direct.** Laisser l'app livreur ouverte (livraison affectée, course non démarrée), puis annuler la commande côté marchand : l'app livreur affiche « Course annulée » sans rechargement. À faire sur une seconde commande.
- **Sécurité.** Le statut ne peut pas sauter d'étape : une course ne peut pas passer de « en attente » à « livrée » sans signature, même en appelant la base directement (règle appliquée côté base, 142 cas de test).

Options si le temps le permet :
- **A6bis. Échec de livraison.** Sur une autre course, le livreur clique **Échec de livraison** et saisit un motif (« Client absent ») : le motif est visible côté marchand et prestataire. Le prestataire réassigne (retour « en attente ») ou déclare le colis **retourné**.
- **A7. Argent encaissé à la livraison.** Avec une commande « À la livraison » : après la livraison, onglet **Caisse** du prestataire : « Chez le livreur » → « Reçu » → « Reversé » ; côté marchand : « X FCFA encaissés · reversés ». Une commande déjà payée en ligne n'a rien à encaisser.

## 3. Circuit B : inscription et vérification d'un partenaire (10 min)

À dire en ouverture : « Avant d'accepter des livraisons, un livreur ou une société doit être vérifié. Voici comment. »

| # | Qui | Action | Ce que l'on voit |
|---|---|---|---|
| B1 | Candidat | `/delivery/register` : choisir **livreur indépendant**, remplir l'identité, envoyer les trois images, choisir un véhicule **Moto / Scooter** et cocher la catégorie de permis **B** | Message « catégorie A requise pour Moto / Scooter (déclaré : B) » : l'étape suivante est **bloquée** |
| B2 | Candidat | Corriger : cocher **A**, continuer, envoyer le dossier | Dossier transmis, statut « en attente » ; page `/delivery/status` avec la cloche |
| B3 | Administrateur | `/delivery-admin` : ouvrir le dossier | Identité, pièces et permis (liens signés de 5 minutes), historique. **Les quatre contrôles à cocher** par un humain |
| B4 | Administrateur | **Demander un complément** avec une note interne | Le candidat reçoit le message et une notification ; **il ne voit pas la note interne** |
| B5 | Candidat | `/delivery/resubmit` : renvoyer un nouveau selfie | Dossier de nouveau en attente ; historique « resoumis » |
| B6 | Administrateur | Cocher les quatre contrôles, **Valider** | Structure approuvée avec badge, livreur approuvé et actif |
| B7 | Candidat | `/delivery/status` puis `/delivery/partner-dashboard` | Statut approuvé, historique complet, livreurs actifs |

Points forts à dire : pièces déposées dans un stockage **privé**, historique **en ajout seul** (même un administrateur ne peut pas le modifier), un numéro de pièce déjà utilisé par un autre dossier est refusé, permis et véhicule comparés par la base elle-même.

Option : refaire B1 avec une **société** (entrepôt, NIF) ; si l'on réutilise le même numéro de pièce que le livreur : « Cette pièce d'identité est déjà associée à un autre dossier ».

## 4. Ce qu'il ne faut pas dire

- « La vérification est automatique » : **faux**. Aucun fournisseur d'identité (OCR, reconnaissance faciale) n'est branché. La comparaison est **humaine**, guidée par quatre cases. L'interface le dit au candidat.
- « Le circuit B est en production » : faux, ni la base ni l'app de production ne l'ont.
- « Le livreur est affecté automatiquement » : pas sans zones, et aucun écran n'en crée.
- « Les livreurs reçoivent une notification sur téléphone » : non. Les alertes sont **dans l'application ouverte** ; les notifications push de livraison ne sont pas branchées.
- « Le marchand confirme la réception de l'argent reversé » : non, c'est le prestataire qui marque « Reversé ».

## 5. Plan B et pièges

| Si… | Faire |
|---|---|
| « Expédier » ne propose aucun prestataire | La boutique n'est pas connectée : refaire 1.3 étape 2 (ou le SQL) |
| La liste des livreurs est vide dans A3 | Le SQL 1.3 n'a pas été joué, ou l'e-mail du livreur est faux |
| L'app livreur est vide | La course n'est pas affectée à CE livreur : l'affecter en A3 |
| Erreur silencieuse à la commande | Limite de 5 commandes par heure par numéro : changer de numéro |
| Paiement refusé (200 XOF) | Quantité 2 minimum sur le produit à 100 FCFA |
| Le bouton « Confirmer ma commande » ne réagit pas | La page a défilé : recliquer sur le bouton visible |
| La signature ne se valide pas | Tracer un trait dans le cadre puis **Valider** ; rafraîchir la page si besoin (un défaut de ce bouton a été corrigé le 5 novembre) |
| E-mail de décision non reçu | Attendu possible : l'envoi n'a pas été vérifié ; montrer plutôt la **cloche** et l'historique |
| Besoin d'un résultat garanti | Capture d'écran de chaque étape faite pendant la répétition (1.6) |

**Non testé, à ne pas montrer en direct :** l'affichage sur téléphone, l'alerte en direct côté boutique et côté prestataire (seule celle du livreur a été vue), un livreur qui rejoint par le code d'invitation, l'ajout d'un livreur depuis la page de statut, le refus et la suspension depuis l'interface (couverts par les tests de base).

## 6. Après la démo : nettoyage

- Supprimer les comptes jetables et leurs données (dossiers du circuit B, notifications, historique) : le journal d'audit est en ajout seul, il faut désactiver son déclencheur `trg_delivery_audit_no_change` le temps de la suppression puis le réactiver (voir `DEPLOIEMENT-LIVRAISON-KYC-2026-11.md`).
- Supprimer les fichiers de test dans les buckets `delivery-kyc` et `delivery-proofs` **depuis le tableau de bord Storage** (les supprimer en SQL laisserait les fichiers orphelins).
- Les commandes et paiements sandbox de BOUTIQUE TEST peuvent rester.

## 7. Documents liés

- [`DEPLOIEMENT-LOGISTIQUE-2026-11.md`](DEPLOIEMENT-LOGISTIQUE-2026-11.md) : circuit A (règles, transitions, test navigateur du 5 novembre).
- [`DEPLOIEMENT-LIVRAISON-KYC-2026-11.md`](DEPLOIEMENT-LIVRAISON-KYC-2026-11.md) : circuit B (règles, test navigateur du 6 novembre).
- [`H5-LIVRAISON-MISE-EN-PROD-2026-10.md`](H5-LIVRAISON-MISE-EN-PROD-2026-10.md) : décision de mise en production du circuit B.
- [`DEPLOIEMENT-AIGUILLAGE-WEBHOOK-ECOMFY-PAY-2026-10.md`](DEPLOIEMENT-AIGUILLAGE-WEBHOOK-ECOMFY-PAY-2026-10.md) : paiement sandbox testé de bout en bout (étape A1).
