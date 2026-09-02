# Ecomfy Corporate & Governance — Documentation Technique & Juridique Complete

Ce document constitue le manuel technique, juridique, architectural et opérationnel du module **Ecomfy Corporate & Governance**.

---

## 1. 📌 AVERTISSEMENT JURIDIQUE & LIMITES DU LOGICIEL

> **RÈGLE FONDAMENTALE (SECTION 23 DU CAHIER DES CHARGES)** :
> Le module **Ecomfy Corporate & Governance** est un outil de gouvernance interne, de documentation, de gestion et de traçabilité d'audit.
> 
> Le logiciel ne remplace en aucun cas :
> - Les statuts réels enregistrés de la société Ecomfy ;
> - Les actes sociaux officiels (Procès-Verbaux d'Assemblée Générale, Décisions du Gérant) ;
> - Les conventions signées de cession de parts/d'actions ou actes d'émission du capital ;
> - Les formalités légales d'immatriculation, de publication ou de dépôt au greffe du tribunal de commerce ;
> - Les conseils juridiques d'un professionnel du droit (Avocat, Notaire, Expert-Comptable).
> 
> **Distinction des Notions** :
> Une validation informatique (`INTERNAL APPROVAL`) dans l'interface **ne constitue pas automatiquement un effet juridique opposable (`LEGAL EFFECT`)** et ne transfert aucune propriété sociale sans l'accomplissement des formalités requises par la loi.

---

## 2. 🏛️ PRINCIPES DE GOUVERNANCE & STRUCTURE CIBLE

### Rôles Capitalistiques & Distincts
- **Fondateur Principal (`FOUNDER` / `OWNER`)** : Distinction stricte entre le créateur du projet et les associés.
  - **ULRICH DJATÉ YAPI** : Fondateur Principal et Propriétaire exclusif (`djateulrich@gmail.com`).
  - **Participation Cible Initialement Détenue** : **80 %** (800 000 actions sur la base de 1 000 000 actions). Statut : `ACQUIRED`.
- **Associés (`SHAREHOLDER`)** : Rôle standard pour toute personne détenant ou destinée à détenir une participation au capital.
  - **DÉSIRÉ TANO** : Associé / Bénéficiaire de Vesting | Target : **10 %** (100 000 actions max) | Status : `VESTING` (48m / 12m cliff).
  - **COUBOURA AMENA** : Associée / Bénéficiaire de Vesting | Target : **10 %** (100 000 actions max) | Status : `VESTING` (48m / 12m cliff).
- **Entités Externes & Exceptions** :
  - **ECOM IA MASTERY** : Participation : **0 %**. Aucune attribution automatique de 2 %.
- **Cofondateur (`COFOUNDER`)** : Titre exceptionnel réservé uniquement aux personnes formellement désignées et participant durablement à la responsabilité stratégique.
- **Investisseur (`INVESTOR`)** : Apporteur de fonds ou d'investissements financiers.
- **Testeur (`BETA TESTER`)** : Aucun droit automatique au capital ni attribution de parts pour de simples tests applicatifs.

---

## 3. 📊 CAP TABLE & MOTEUR DE VESTING

### A. Cap Table dynamique
- **Base d'actions de référence** : Configurable (Par défaut : **1 000 000 actions**).
- **Métrique clés** : Actions Autorisées, Émises, Détenues, Acquises, Soumises au Vesting, Non Acquises, Réservées et Dilution Potentielle.
- **Instantanés inaltérables (`corporate_cap_table_snapshots`)** : Chaque mise à jour effective du Cap Table fige un snapshot de la répartition.

### B. Moteur de Vesting
- **Paramètres par défaut** : Durée de **48 mois**, Cliff de **12 mois**, acquisition mensuelle progressive post-cliff.
- **Dispositif `VESTING ELIGIBLE`** :
  Lorsqu'une échéance de vesting est atteinte, le moteur génère l'événement **`VESTING ELIGIBLE`** (et non `SHARES TRANSFERRED`).
  - **Message obligatoire affiché** :
    > *« Les conditions de vesting semblent remplies. Une validation et les formalités juridiques applicables sont requises avant toute modification juridique du capital. »*

---

## 4. 🔄 WORKFLOW DE MODIFICATION DU CAPITAL (6 ÉTAPES)

Toute modification des parts/actions doit passer par le workflow sécurisé à 6 étapes :

1. **`PROPOSED`** : Soumission d'une proposition (`Cap Table Change Proposal`) avec motif, nombre d'actions et documents justificatifs.
2. **`DOCUMENTATION_REQUIRED` / `DOCUMENTATION_VERIFIED`** : Vérification des pièces justificatives.
3. **`APPROVAL_REQUIRED`** : Vote interne des organes compétents (`APPROVE`, `REJECT`, `REQUEST CHANGES`).
4. **`LEGAL_FORMALIZATION_REQUIRED`** : Exigence de joindre les actes sociaux ou conventions d'émission/cession signées.
5. **`LEGAL_FORMALIZATION_COMPLETED`** : Validation formelle de l'accomplissement des formalités juridiques.
6. **`CAP_TABLE_UPDATED`** : Mise à jour du Cap Table et enregistrement d'un Snapshot inaltérable.

---

## 5. 🚀 WORKFLOW D'ONBOARDING EN 7 NIVEAUX

1. **Niveau 1 — Invitation** : Invitation sécurisée envoyée par email par le Fondateur Principal.
2. **Niveau 2 — Vérification Identité MFA** : Confirmation de l'email, création du compte et activation de la MFA.
3. **Niveau 3 — Documentation** : Affichage des documents obligatoires personnalisés au rôle.
4. **Niveau 4 — Lecture Horodatée** : Enregistrement de l'événement de consultation complète (`READ`).
5. **Niveau 5 — Approbation** : Signature électronique **LIRE ET APPROUVER** avec capture de l'horodatage UTC, l'adresse IP et l'User-Agent.
6. **Niveau 6 — Activation des Droits** : Activation des permissions associées au rôle (`ASSOCIÉ`, `ADMINISTRATEUR`, etc.).
7. **Niveau 7 — Mon Espace Associé** : Dashboard personnel privé (`/associate-space`).

---

## 6. 📁 DOCUMENT CENTER & PROPRIÉTÉ INTELLECTUELLE

### Document Center (`corporate_documents` & `corporate_document_versions`)
- Versioning juridique strict (`v1.0`, `v1.1`, `v2.0`). Notification et ré-approbation obligatoire en cas de mise à jour majeure.
- Catégories : `LEGAL`, `CORPORATE`, `SHAREHOLDERS`, `VESTING`, `CONFIDENTIALITY`, `INTELLECTUAL_PROPERTY`, `SECURITY`, `GOVERNANCE`, `PARTNERSHIP`, `INVESTMENT`.

### Registre de Propriété Intellectuelle (`corporate_intellectual_property`)
- Traçabilité des actifs : Code source, algorithmes IA Ecomfy Gen Plus, marque, nom de domaine `ecomfy.cloud`, bases de données.
- **Sécurité** : Masquage systématique des clés API et secrets dans l'interface.

---

## 7. 🚪 OFFBOARDING & AUDIT LOGS

### Offboarding (`corporate_offboarding_cases`)
- Checklist de sortie : Révocation des sessions, des clés, des tokens, désactivation du compte et état des lieux du vesting.
- Pour les actions acquises, le système applique le statut **`LEGAL REVIEW REQUIRED`** et exige une analyse juridique explicite.

### Journal d'Audit Inaltérable (`corporate_audit_logs`)
- Traçabilité complète des invitations, connexions, signatures, propositions de capital, jalons de vesting et modifications de rôle avec horodatage et métadonnées.

---

## 8. 🗄️ TABLES POSTGRESQL DU MODULE

1. `corporate_companies`
2. `corporate_shareholders`
3. `corporate_share_allocations`
4. `corporate_vesting_plans`
5. `corporate_vesting_milestones`
6. `corporate_documents`
7. `corporate_document_versions`
8. `corporate_document_acceptances`
9. `corporate_proposals`
10. `corporate_proposal_approvals`
11. `corporate_cap_table_snapshots`
12. `corporate_intellectual_property`
13. `corporate_offboarding_cases`
14. `corporate_audit_logs`
15. `user_roles` (Mise à jour RLS)

---

## 9. 🌐 ROUTES & COMPOSANTS FRONTEND

- `/corporate-governance` ➔ [`src/pages/CorporateGovernance.tsx`](file:///Users/prom1/onlinefy/visualpro-african-ai-creations/src/pages/CorporateGovernance.tsx) (Protégée par `FounderRoute`)
- `/associate-space` ➔ [`src/pages/AssociateSpace.tsx`](file:///Users/prom1/onlinefy/visualpro-african-ai-creations/src/pages/AssociateSpace.tsx) (Protégée par `ProtectedRoute`)
- Custom Hook ➔ [`src/hooks/useCorporateGovernance.ts`](file:///Users/prom1/onlinefy/visualpro-african-ai-creations/src/hooks/useCorporateGovernance.ts)
- Types TypeScript ➔ [`src/types/corporate.ts`](file:///Users/prom1/onlinefy/visualpro-african-ai-creations/src/types/corporate.ts)
