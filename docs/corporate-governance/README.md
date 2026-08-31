# Ecomfy Corporate & Governance — Technical Documentation

Ce document sert de référence technique, juridique et d'architecture pour le module **Ecomfy Corporate & Governance**.

---

## 📌 AVERTISSEMENT JURIDIQUE & LIMITES LOGICIELLES

> Le module **Ecomfy Corporate & Governance** est un outil de gouvernance, de documentation et de traçabilité interne.
> Il ne remplace en aucun cas :
> - Les statuts juridiques de la société Ecomfy ;
> - Les actes sociaux (procès-verbaux d'assemblée générale, décisions de la gérance) ;
> - Les conventions de cession d'actions ou actes d'émission du capital ;
> - Les formalités légales d'immatriculation ou de dépôt au greffe ;
> - Les conseils d'un professionnel du droit.

Aucune action informatique dans ce logiciel ne constitue automatiquement un transfert juridique ou une modification opposable du capital social sans l'accomplissement des formalités et actes juridiques requis.

---

## 🏛️ PRINCIPES DE GOUVERNANCE & STRUCTURE CIBLE

### 1. Structure Initiale d'Ecomfy (1 000 000 Actions de Référence)
- **ULRICH DJATÉ YAPI** : `FONDATEUR PRINCIPAL` & `PROPRIÉTAIRE` | Participation Cible : **80 %** (800 000 actions). Status : `ACQUIRED`.
- **DÉSIRÉ TANO** : `ASSOCIÉ / BÉNÉFICIAIRE DE VESTING` | Participation Cible Max : **10 %** (100 000 actions). Status : `VESTING` (48 mois, 12 mois cliff).
- **COUBOURA AMENA** : `ASSOCIÉE / BÉNÉFICIAIRE DE VESTING` | Participation Cible Max : **10 %** (100 000 actions). Status : `VESTING` (48 mois, 12 mois cliff).
- **ECOM IA MASTERY** : Participation : **0 %** (Aucune attribution automatique).

---

## ⏳ MOTEUR DE VESTING & STATUT `VESTING ELIGIBLE`

- **Paramètres par défaut** : Durée de 48 mois, Cliff de 12 mois.
- **Franchissement de jalon** : Lorsqu'une échéance de vesting est atteinte, le système attribue le statut **`VESTING ELIGIBLE`** et **ne transfert jamais automatiquement les actions** (`SHARES TRANSFERRED`).
- **Alerte obligatoire** :
  > « Les conditions de vesting semblent remplies. Une validation et les formalités juridiques applicables sont requises avant toute modification juridique du capital. »

---

## 🔄 WORKFLOW DE MODIFICATION DU CAP TABLE (6 ÉTAPES)

Toute modification du capital est soumise à un workflow strict d'approbation et de formalisation :

1. **`PROPOSED`** : Création d'une proposition de modification d'attribution.
2. **`DOCUMENTATION_VERIFIED`** : Vérification des pièces justificatives.
3. **`APPROVAL_REQUIRED`** : Vote et approbation par l'organe compétent.
4. **`LEGAL_FORMALIZATION_REQUIRED`** : Exigence de joindre les actes sociaux ou conventions signées.
5. **`LEGAL_FORMALIZATION_COMPLETED`** : Validation de l'accomplissement des formalités légales.
6. **`CAP_TABLE_UPDATED`** : Mise à jour effective du Cap Table et création d'un Snapshot inaltérable (`corporate_cap_table_snapshots`).

---

## 🚀 WORKFLOW D'ONBOARDING EN 7 NIVEAUX

1. **Niveau 1 — Invitation** : Invitation envoyée par email par le Fondateur Principal.
2. **Niveau 2 — Vérification Identité MFA** : Inscription, confirmation email et MFA.
3. **Niveau 3 — Documentation** : Dossier juridique obligatoire (Charte, Vesting, PI, NDA).
4. **Niveau 4 — Lecture Horodatée** : Consultation complète enregistrée `READ`.
5. **Niveau 5 — Approbation** : Signature électronique **LIRE ET APPROUVER** avec horodatage, adresse IP et User-Agent.
6. **Niveau 6 — Activation des Droits** : Octroi des permissions associées au rôle.
7. **Niveau 7 — Mon Espace Associé** : Dashboard personnel privé de l'associé.

---

## 🛠️ TABLES POSTGRESQL DU MODULE

- `corporate_companies`
- `corporate_shareholders`
- `corporate_share_allocations`
- `corporate_vesting_plans`
- `corporate_vesting_milestones`
- `corporate_documents`
- `corporate_document_versions`
- `corporate_document_acceptances`
- `corporate_proposals`
- `corporate_proposal_approvals`
- `corporate_cap_table_snapshots`
- `corporate_intellectual_property`
- `corporate_offboarding_cases`
- `corporate_audit_logs`
