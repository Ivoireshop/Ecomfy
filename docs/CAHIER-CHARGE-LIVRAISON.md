# CAHIER DES CHARGES FONCTIONNEL ET TECHNIQUE
# eComfy Livraison – Évolution vers une plateforme de gestion à 360°

**Projet :** eComfy  
**Module concerné :** eComfy Livraison  
**Version :** 2.0 – Nouvelles fonctionnalités  
**Destinataire :** Équipe de développement eComfy

---

## 1. VISION ET OBJECTIF DU PROJET

L'objectif est de faire évoluer eComfy Livraison afin de permettre aux commerçants de collaborer directement avec des structures de livraison professionnelles et des livreurs particuliers déjà inscrits sur eComfy.

Le système doit permettre de rechercher facilement une structure de livraison, consulter ses informations, lui transmettre des commandes, suivre leur traitement en temps réel et contrôler les différentes opérations.

De leur côté, les structures de livraison doivent disposer de leur propre espace de gestion afin de recevoir les commandes des commerçants, organiser leur traitement, affecter les livreurs et gérer leurs collaborateurs.

Enfin, eComfy doit disposer d'un espace d'administration permettant de vérifier les structures, contrôler les activités et garantir un environnement de confiance.

**Résultat attendu :** créer un écosystème dans lequel les commerçants, les structures de livraison, les livreurs particuliers et l'administration eComfy travaillent ensemble.

---

# 2. NOUVEAU SYSTÈME DE CHOIX DES STRUCTURES DE LIVRAISON

### 2.1. Répertoire des structures de livraison

Créer un espace permettant aux commerçants de découvrir et de rechercher les structures de livraison inscrites sur eComfy.

Chaque structure doit disposer d'une fiche de présentation contenant :

- Nom de la structure.
- Logo ou photo de présentation.
- Description de ses activités.
- Localisation géographique.
- Adresse physique complète.
- Numéro de téléphone.
- Coordonnées de contact.
- Zones géographiques couvertes.
- Statut de vérification eComfy.
- Niveau d'abonnement.
- Informations complémentaires sur ses services.

### 2.2. Recherche et sélection

Le commerçant doit pouvoir :

- Rechercher une structure par son nom.
- Trouver les structures situées dans une zone géographique précise.
- Consulter les coordonnées des structures.
- Identifier les structures vérifiées par eComfy.
- Consulter les informations de chaque structure.
- Choisir une structure pour lui transmettre ses commandes.

Il faut prévoir un système de recherche simple, rapide et intuitif.

### 2.3. Deux catégories de prestataires

Le système doit distinguer :

1. Les structures de livraison professionnelles.
2. Les livreurs particuliers indépendants.

Les deux catégories doivent être accessibles depuis eComfy Livraison, avec des parcours adaptés à leurs activités respectives.

---

# 3. ESPACE DÉDIÉ AUX STRUCTURES DE LIVRAISON

Chaque structure de livraison inscrite doit disposer de son propre tableau de bord.

Cet espace doit être indépendant de celui du commerçant.

### 3.1. Tableau de bord de la structure

Le responsable doit pouvoir consulter :

- Nombre total de commandes reçues.
- Nouvelles commandes en attente.
- Commandes acceptées.
- Commandes en cours de livraison.
- Commandes livrées.
- Commandes échouées.
- Commandes retournées.
- Nombre de livreurs actifs.
- Activité quotidienne et historique des opérations.

L'objectif est de permettre au responsable de piloter son activité depuis un seul espace.

### 3.2. Gestion du profil de la structure

Le responsable doit pouvoir modifier et compléter les informations de son entreprise :

- Nom commercial.
- Logo.
- Adresse et localisation.
- Contacts téléphoniques.
- Description.
- Zones de livraison.
- Informations administratives.
- Documents justificatifs.

Certaines modifications sensibles devront être soumises à validation par l'administration eComfy.

---

# 4. SYSTÈME DE COTISATION, CAUTION ET ABONNEMENT PREMIUM

L'inscription d'une structure de livraison ne doit pas automatiquement lui donner accès à toutes les fonctionnalités opérationnelles.

Un mécanisme d'activation doit être mis en place.

### 4.1. Cotisation et caution

Avant de commencer à recevoir et traiter des commandes sur eComfy, chaque structure devra s'acquitter d'une cotisation et d'une caution auprès d'eComfy.

Le système devra permettre :

- D'afficher les frais exigibles.
- D'enregistrer les paiements.
- De consulter l'historique des paiements.
- De vérifier le statut de paiement.
- D'activer ou de suspendre l'accès opérationnel selon les règles définies.

L'administration doit pouvoir contrôler les paiements et valider l'activation des structures.

**Important :** les montants, la périodicité de la cotisation, le montant de la caution et les conditions de restitution de celle-ci seront définis par la direction eComfy.

### 4.2. Abonnement Premium à 5 dollars

Mettre en place un abonnement Premium de 5 USD permettant aux structures de livraison d'améliorer leur visibilité sur la plateforme.

Les avantages envisagés :

- Meilleur positionnement dans les résultats de recherche.
- Mise en avant dans le répertoire des structures.
- Badge Premium sur leur profil.
- Plus grande visibilité auprès des commerçants.
- Présentation privilégiée dans les espaces de découverte.

Le système doit gérer automatiquement :

- La souscription.
- Le paiement.
- La durée de validité.
- Le renouvellement.
- L'expiration.
- Le changement de formule.

L'abonnement Premium doit être distinct de la vérification officielle de la structure. Le paiement ne doit jamais remplacer le contrôle physique.

---

# 5. SYSTÈME DE VÉRIFICATION PHYSIQUE DES STRUCTURES

C'est une fonctionnalité stratégique pour garantir la crédibilité d'eComfy.

Une structure ne doit pas être considérée comme officiellement vérifiée simplement parce qu'elle a créé un compte et renseigné ses informations.

### 5.1. Vérification sur le terrain

L'équipe terrain eComfy doit pouvoir se rendre physiquement dans les locaux des structures inscrites.

Les agents doivent vérifier :

- L'existence réelle des locaux.
- L'adresse communiquée.
- L'existence effective de l'entreprise.
- La présence d'une activité de livraison.
- Les équipements et moyens disponibles, dans la mesure du nécessaire.
- La cohérence des informations fournies lors de l'inscription.

### 5.2. Interface de vérification pour l'administration

Créer un espace permettant à l'équipe eComfy de :

- Consulter les demandes de vérification.
- Affecter une mission à un agent terrain.
- Consulter les informations de la structure.
- Enregistrer le résultat de la visite.
- Ajouter des photos des locaux.
- Ajouter des observations.
- Enregistrer la date de vérification.
- Accepter ou refuser la vérification.
- Demander des informations complémentaires.

### 5.3. Statuts de vérification

Prévoir les statuts suivants :

- Non vérifiée.
- Vérification demandée.
- Visite programmée.
- Vérification en cours.
- Vérifiée.
- Vérification refusée.
- Vérification suspendue.

Une fois la vérification validée, un badge officiel « Structure vérifiée par eComfy » doit apparaître sur son profil.

L'administration doit également pouvoir suspendre ou retirer cette validation en cas de problème.

---

# 6. SYSTÈME DE TRANSMISSION DES COMMANDES AUX STRUCTURES

Il s'agit de l'une des fonctionnalités centrales de cette évolution.

### 6.1. Envoi des commandes

Depuis son espace eComfy, le commerçant doit pouvoir sélectionner une structure de livraison et lui transmettre directement ses commandes.

Le système doit permettre :

1. De consulter les structures disponibles.
2. De sélectionner une structure.
3. De consulter son profil.
4. De sélectionner une ou plusieurs commandes.
5. De transmettre les commandes.
6. D'envoyer automatiquement une notification à la structure.

La structure doit recevoir une notification lorsqu'un commerçant lui transmet une nouvelle commande.

### 6.2. Réception et acceptation

Dans son espace, la structure doit pouvoir :

- Consulter les nouvelles commandes reçues.
- Identifier le commerçant expéditeur.
- Consulter les coordonnées du client.
- Consulter les produits commandés.
- Consulter l'adresse de livraison.
- Consulter les frais et informations de livraison.
- Accepter ou refuser une commande.
- Indiquer le motif d'un refus.

Le commerçant doit être automatiquement informé de l'acceptation ou du refus.

### 6.3. Historique des transmissions

Conserver un historique complet de toutes les commandes transmises à chaque structure.

Chaque transmission doit comporter :

- Identifiant de commande.
- Identifiant du commerçant.
- Identifiant de la structure.
- Date et heure de transmission.
- Statut de traitement.
- Historique des changements.
- Informations sur le livreur affecté.

---

# 7. ESPACE DE CONTRÔLE ET DE SUIVI DES COMMANDES

Créer un espace commun de suivi accessible au commerçant et à la structure de livraison.

Chaque acteur doit voir les informations correspondant à ses autorisations.

### 7.1. Tableau de suivi du commerçant

Le commerçant doit pouvoir consulter :

- Les commandes envoyées.
- Les structures destinataires.
- Les commandes acceptées.
- Les commandes en attente.
- Les commandes en cours de traitement.
- Les commandes confiées à un livreur.
- Les commandes livrées.
- Les commandes échouées.
- Les commandes retournées.

### 7.2. Tableau de suivi de la structure

La structure doit disposer d'un tableau de bord équivalent, lui permettant de contrôler toutes les commandes reçues des différents commerçants.

Elle doit pouvoir filtrer les commandes par :

- Commerçant.
- Date.
- Statut.
- Livreur affecté.
- Zone géographique.

### 7.3. Historique et traçabilité

Chaque modification de statut doit être enregistrée avec :

- La date.
- L'heure.
- L'utilisateur ayant effectué l'action.
- Le nouveau statut.
- Les éventuelles observations.

L'objectif est de permettre aux deux parties de suivre les commandes et de réduire les litiges.

---

# 8. ESPACE COLLABORATEURS DE LA STRUCTURE DE LIVRAISON

Chaque responsable de structure doit pouvoir gérer son équipe directement depuis eComfy Livraison.

### 8.1. Invitation des collaborateurs

Le responsable doit pouvoir :

- Ajouter un collaborateur.
- Inviter un collaborateur par e-mail ou par le mécanisme d'invitation disponible sur eComfy.
- Associer un compte existant.
- Consulter les collaborateurs actifs.
- Désactiver un accès.
- Réattribuer les responsabilités.

### 8.2. Gestion des rôles et permissions

Prévoir différents profils :

**Administrateur de la structure**
- Accès complet à l'espace de la structure.
- Gestion des collaborateurs.
- Gestion des commandes.
- Affectation des livreurs.
- Consultation des statistiques.

**Responsable des opérations**
- Gestion des commandes.
- Affectation des livreurs.
- Suivi des opérations.
- Gestion des incidents.

**Agent de livraison / livreur**
- Consultation des commandes qui lui sont affectées.
- Consultation des informations nécessaires à la livraison.
- Mise à jour des statuts autorisés.
- Confirmation de livraison.

**Agent de réception / traitement**
- Réception des commandes.
- Enregistrement des colis.
- Organisation des commandes.
- Transmission aux responsables concernés.

Le responsable de la structure doit pouvoir attribuer des permissions adaptées à chaque collaborateur.

### 8.3. Tableau de suivi des collaborateurs

Afficher :

- Nombre de collaborateurs.
- Collaborateurs actifs.
- Collaborateurs inactifs.
- Nombre de commandes attribuées.
- Nombre de commandes livrées.
- Nombre de commandes en cours.
- Historique des activités.

---

# 9. AFFECTATION DES COMMANDES AUX LIVREURS

La structure de livraison doit pouvoir affecter les commandes reçues à ses propres livreurs.

Le responsable doit pouvoir :

- Consulter la liste de ses livreurs.
- Ajouter ou inviter un livreur.
- Affecter une commande à un livreur.
- Réaffecter une commande.
- Consulter les commandes attribuées à chaque livreur.
- Suivre les performances individuelles.

Une notification doit être envoyée au livreur lorsqu'une commande lui est affectée.

Le livreur doit pouvoir mettre à jour les étapes de livraison selon les permissions qui lui sont accordées.

---

# 10. VISIBILITÉ EN TEMPS RÉEL ET AUTOMATISATION DES STATUTS

Le système doit offrir une visibilité complète sur l'évolution des commandes.

Prévoir les différentes étapes suivantes :

1. Commande transmise à la structure.
2. Commande reçue.
3. Commande acceptée.
4. Commande en préparation.
5. Commande affectée à un livreur.
6. Colis récupéré par le livreur.
7. Commande en cours de livraison.
8. Commande livrée.
9. Livraison échouée.
10. Commande retournée au commerçant, si nécessaire.

Chaque changement de statut doit être automatiquement visible dans l'espace du commerçant et dans celui de la structure.

### Notifications automatiques

Prévoir des notifications pour :

- Nouvelle commande reçue.
- Commande acceptée.
- Commande refusée.
- Commande affectée à un livreur.
- Colis récupéré.
- Commande en cours de livraison.
- Commande livrée.
- Livraison échouée.
- Commande retournée.

Le système doit également enregistrer l'heure de chaque événement.

**Évolution complémentaire :** prévoir la possibilité d'intégrer ultérieurement une géolocalisation du livreur et un suivi cartographique en direct, sous réserve de disponibilité des données GPS et des autorisations nécessaires.

---

# 11. ESPACE ADMINISTRATION GÉNÉRALE ECOMFY

L'administration eComfy doit disposer d'une interface centrale pour superviser l'ensemble du réseau de livraison.

### 11.1. Gestion des structures

L'administration doit pouvoir :

- Consulter toutes les structures inscrites.
- Rechercher une structure.
- Consulter son profil.
- Contrôler ses documents.
- Vérifier ses paiements.
- Valider ou refuser son activation.
- Gérer son abonnement.
- Suspendre une structure.
- Réactiver une structure.
- Consulter son historique.

### 11.2. Contrôle des opérations

L'administration doit pouvoir consulter :

- Le volume global de commandes transmises.
- Le nombre de commandes acceptées.
- Le nombre de commandes livrées.
- Le nombre de commandes échouées.
- Les performances des structures.
- Les activités des livreurs.
- Les éventuels incidents.
- Les litiges signalés.

### 11.3. Gestion financière

Prévoir un espace permettant de suivre :

- Les cotisations des structures.
- Les cautions encaissées.
- Les abonnements Premium à 5 USD.
- Les renouvellements.
- Les paiements en attente.
- Les remboursements de caution, lorsqu'ils sont autorisés.
- L'historique financier par structure.

---

# 12. NOTIFICATIONS ET COMMUNICATION ENTRE LES ACTEURS

Mettre en place un système de notification centralisé.

Chaque acteur doit recevoir les notifications correspondant à son rôle.

**Commerçant :** réception, acceptation, refus, affectation du livreur, évolution de la livraison et confirmation de livraison.

**Structure :** nouvelles commandes, nouvelles affectations, activités des collaborateurs et alertes opérationnelles.

**Livreur :** nouvelles missions, modifications d'affectation et informations de livraison.

**Administration eComfy :** nouvelles inscriptions, demandes de vérification, incidents, suspensions et alertes financières.

Les notifications doivent être consultables dans l'application. Prévoir également une architecture permettant l'ajout de notifications par e-mail ou d'autres canaux.

---

# 13. CONSERVATION DU SYSTÈME ACTUEL

**Point technique très important : ne pas supprimer ou dégrader le fonctionnement actuel d'eComfy Livraison.**

Le parcours actuel de choix du livreur doit être conservé.

Les nouvelles fonctionnalités doivent venir enrichir le système existant.

Le nouveau parcours devra notamment permettre de choisir entre :

- Un livreur particulier inscrit sur eComfy.
- Une structure de livraison inscrite sur eComfy.

Lorsque le commerçant sélectionne une structure, il accède au nouveau parcours de transmission, de réception, de contrôle et de suivi des commandes.

Le fonctionnement actuel reste disponible pour les utilisateurs qui choisissent un livreur particulier.

---

# 14. ARCHITECTURE FONCTIONNELLE CIBLE

Le fonctionnement global doit respecter le parcours suivant :

**ÉTAPE 1 – INSCRIPTION ET ACTIVATION**

La structure crée son compte, complète son profil, s'acquitte des frais exigibles et demande sa vérification.

**ÉTAPE 2 – VÉRIFICATION**

L'équipe terrain eComfy effectue une visite physique et l'administration valide la structure.

**ÉTAPE 3 – VISIBILITÉ**

La structure devient consultable dans le répertoire eComfy Livraison. Elle peut souscrire à l'abonnement Premium pour améliorer sa visibilité.

**ÉTAPE 4 – CHOIX PAR LE COMMERÇANT**

Le commerçant recherche une structure, consulte sa fiche et la sélectionne.

**ÉTAPE 5 – TRANSMISSION DES COMMANDES**

Le commerçant transmet ses commandes à la structure sélectionnée.

**ÉTAPE 6 – RÉCEPTION ET ORGANISATION**

La structure reçoit les notifications, accepte les commandes et les organise.

**ÉTAPE 7 – AFFECTATION**

Le responsable affecte les commandes à ses collaborateurs et livreurs.

**ÉTAPE 8 – LIVRAISON**

Les livreurs prennent en charge les colis et mettent à jour les statuts.

**ÉTAPE 9 – SUIVI**

Le commerçant et la structure suivent les opérations depuis leurs tableaux de bord respectifs.

**ÉTAPE 10 – CONTRÔLE**

L'administration eComfy supervise les activités, les performances et les éventuels incidents.

---

# 15. EXIGENCES TECHNIQUES POUR LE DÉVELOPPEUR

Avant toute modification, effectuer un audit du module eComfy Livraison existant.

Le développeur devra notamment :

1. Analyser l'architecture actuelle du module.
2. Identifier les fonctionnalités déjà opérationnelles.
3. Identifier les tables de données existantes.
4. Vérifier les relations entre commandes, commerçants et livreurs.
5. Définir les nouvelles tables et relations nécessaires.
6. Mettre en place les permissions par rôle.
7. Assurer l'isolation des données entre les différentes structures.
8. Mettre en place les notifications automatiques.
9. Prévoir un historique complet des opérations.
10. Garantir la compatibilité avec le système actuel.

### Exigences de sécurité

- Un commerçant ne doit accéder qu'à ses propres commandes et aux informations de suivi autorisées.
- Une structure ne doit accéder qu'aux commandes qui lui sont transmises.
- Les collaborateurs ne doivent accéder qu'aux fonctionnalités autorisées par leur responsable.
- Un livreur ne doit voir que les missions qui lui sont affectées.
- L'administration eComfy doit disposer des permissions de supervision nécessaires.
- Toutes les opérations sensibles doivent être traçables.

### Consigne de développement

Ne pas effectuer de modifications directes en production sans validation préalable.

Procéder par étapes :
- Audit.
- Proposition d'architecture.
- Validation.
- Développement.
- Tests.
- Correction des anomalies.
- Validation finale.
- Déploiement.

---

# 16. CRITÈRES DE VALIDATION FINALE

Le module sera considéré comme fonctionnel lorsque les scénarios suivants auront été testés avec succès :

- Un commerçant peut rechercher une structure et consulter ses informations.
- Une structure peut s'inscrire et compléter son profil.
- L'administration peut vérifier physiquement et valider une structure.
- Une structure peut être activée après satisfaction des conditions financières.
- Une structure peut souscrire au Premium à 5 USD.
- Un commerçant peut transmettre une ou plusieurs commandes à une structure.
- La structure reçoit automatiquement les commandes.
- La structure peut accepter ou refuser les commandes.
- Le commerçant peut consulter le statut de ses commandes.
- La structure peut affecter les commandes à ses collaborateurs et livreurs.
- Les collaborateurs disposent de permissions adaptées.
- Les changements de statut sont visibles par les acteurs concernés.
- L'administration peut superviser les activités.
- Le système actuel de choix des livreurs particuliers continue de fonctionner sans régression.

---

# 17. RÉSULTAT FINAL ATTENDU

À terme, eComfy Livraison ne doit plus être uniquement un outil permettant de choisir un livreur.

Il doit devenir un véritable réseau de distribution et de gestion logistique intégré à l'écosystème eComfy.

Les commerçants pourront trouver des structures de livraison fiables, leur confier leurs commandes et contrôler les opérations.

Les structures de livraison pourront digitaliser leur activité, gérer leurs équipes, recevoir des commandes de plusieurs commerçants et suivre leurs performances.

L'administration eComfy pourra contrôler la qualité du réseau, vérifier les prestataires et superviser les opérations.

**Vision finale : faire d'eComfy Livraison une infrastructure logistique intégrée, fiable, transparente et évolutive au service du commerce en ligne africain.**

**Fin du cahier des charges.**