import { CorporateDocument, LegalStatus, DocumentCategory } from "@/types/corporate";

export interface SeedGovernanceDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  legal_status: LegalStatus;
  summary: string;
  author: string;
  is_mandatory: boolean;
  current_version: string;
  content_markdown: string;
}

export const LEGAL_DISCLAIMER_TEXT = `> ⚠️ **AVERTISSEMENT JURIDIQUE & PÉRIMÈTRE LOGICIEL ECOMFY**
> Ce document constitue un document de gouvernance, une politique interne ou un projet d'accord d'Ecomfy selon son statut. Il ne remplace pas les statuts, actes sociaux, contrats ou formalités légalement requis. Lorsque nécessaire, il doit être soumis à une revue juridique professionnelle avant signature ou mise en œuvre.`;

export const INITIAL_GOVERNANCE_DOCUMENTS: SeedGovernanceDocument[] = [
  {
    id: "doc-01-charte-gouvernance",
    title: "Doc 01 — Charte de Gouvernance Ecomfy",
    category: "governance",
    legal_status: "INTERNAL POLICY",
    summary: "Règles d'organisation, fonctionnement du Conseil des Fondateurs et mécanismes décisionnels de la startup Ecomfy.",
    author: "Ulrich DJATÉ YAPI (Fondateur Principal)",
    is_mandatory: true,
    current_version: "v1.0",
    content_markdown: `${LEGAL_DISCLAIMER_TEXT}

# Charte de Gouvernance Ecomfy (v1.0)

## Article 1 — Objet et Champ d'Application
La présente Charte de Gouvernance définit les principes directeurs, l'éthique, la structure décisionnelle et les modalités de gestion de la plateforme SaaS Ecomfy (ci-après "la Société"). Elle s'applique à l'ensemble des associés, fondateurs, dirigeants et collaborateurs disposant d'un rôle de gouvernance dans le système.

## Article 2 — Conseil des Fondateurs et Direction Générale
1. **Direction Générale** : La direction stratégique, technique et opérationnelle d'Ecomfy est assurée par le Fondateur Principal (**Ulrich DJATÉ YAPI**).
2. **Conseil des Fondateurs** : Le Conseil réunit l'ensemble des associés détenteurs de titres ou en cours de vesting. Il est consulté sur les décisions stratégiques majeures (levée de fonds, modifications statutaires, partenariats stratégiques).

## Article 3 — Principes d'Équité et de Transparence
- **Traçabilité Numérique** : Toutes les décisions, propositions de modification du capital et approbations de documents sont enregistrées de façon inaltérable dans le registre d'audit interne d'Ecomfy.
- **Accès à l'Information** : Chaque associé a accès à son Espace Associé lui présentant en temps réel la structure du Cap Table, l'état de son plan de vesting et le registre documentaire.

## Article 4 — Clause de Révision
La présente charte peut être modifiée par décision formelle du Fondateur Principal après consultation du Conseil des Fondateurs.`
  },
  {
    id: "doc-02-charte-actionnariat",
    title: "Doc 02 — Charte d'Actionnariat & Répartition du Cap Table",
    category: "shareholders",
    legal_status: "APPROVED INTERNALLY",
    summary: "Répartition officielle du capital social d'Ecomfy (1 000 000 d'actions autorisées) : Fondateur (80%), Associés en vesting (20%), Partenaire extérieur (0%).",
    author: "Ulrich DJATÉ YAPI (Fondateur Principal)",
    is_mandatory: true,
    current_version: "v1.0",
    content_markdown: `${LEGAL_DISCLAIMER_TEXT}

# Charte d'Actionnariat et Structure du Cap Table Ecomfy

## Article 1 — Capital Social de Référence
Le capital social de référence de la société Ecomfy est composé de **1 000 000 (un million) d'actions** d'une valeur nominale égale.

## Article 2 — Répartition Cible du Cap Table
La répartition cible officielle de la société s'établit comme suit :

| Associé / Entité | Qualité / Rôle | Participation Cible (%) | Actions Cible | Régime d'Acquisition |
| :--- | :--- | :--- | :--- | :--- |
| **Ulrich DJATÉ YAPI** | Fondateur Principal | **80,00 %** | **800 000** | Acquis d'Origine (Fondateur) |
| **Désiré TANO** | Associé / Business Dev | **10,00 %** | **100 000** | Vesting (48 Mois / Cliff 12M) |
| **Couboura AMENA** | Associée / Ops & Expansion | **10,00 %** | **100 000** | Vesting (48 Mois / Cliff 12M) |
| **Ecom IA Mastery** | Partenaire Extérieur | **0,00 %** | **0** | Non attribué (0%) |

## Article 3 — Clarification sur les Partenaires Extérieurs
Il est expressément rappelé que la structure **Ecom IA Mastery** ne dispose d'aucune attribution automatique au capital. Toute entrée d'un partenaire extérieur nécessite une proposition formelle du Cap Table selon le workflow à 9 étapes.

## Article 4 — Droits Attachés aux Actions
- Les actions d'origine du Fondateur Principal confèrent l'intégralité des droits de vote et de décision.
- Les actions en sous-régime de vesting deviennent éligibles au transfert juridique au fur et à mesure du franchissement des jalons prévus au contrat.`
  },
  {
    id: "doc-03-accord-vesting",
    title: "Doc 03 — Accord-Cadre de Vesting & Acquisition Progressive",
    category: "vesting",
    legal_status: "INTERNAL POLICY",
    summary: "Règles d'acquisition progressive sur 48 mois avec période de franchissement initial (Cliff) de 12 mois et statut Vesting Eligible.",
    author: "Ulrich DJATÉ YAPI (Fondateur Principal)",
    is_mandatory: true,
    current_version: "v1.0",
    content_markdown: `${LEGAL_DISCLAIMER_TEXT}

# Accord-Cadre de Vesting et d'Acquisition Progressive d'Actions

## Article 1 — Durée du Vesting et Cliff Initial
1. **Durée Totale** : Le plan d'acquisition progressive s'étend sur une durée totale de **48 (quarante-huit) mois** à compter de la date d'effet fixée individuellement.
2. **Cliff Initial de 12 Mois** : Aucun droit sur les actions visées n'est acquis au cours des 12 premiers mois. 
3. À la date d'échéance du 12ème mois (Cliff), l'associé acquiert l'éligibilité sur **25 %** de son attribution cible.
4. Les 75 % restants s'acquièrent ensuite progressivement par tranches mensuelles égales sur les 36 mois suivants.

## Article 2 — Qualification de "Vesting Eligible" (Règle d'Or)
L'atteinte d'un jalon de vesting dans le logiciel Ecomfy attribue le statut **VESTING ELIGIBLE**. 
> **Important** : L'acquisition d'éligibilité ne constitue pas un transfert juridique automatique d'actions. L'émission et la cession effectives des titres sont subordonnées à la formalisation légale et à la signature des actes de cession conformément aux statuts.

## Article 3 — Interruption et Départ d'un Associé
En cas de départ (démission, révocation ou inexécution des engagements) avant la fin de la période de 48 mois, le plan de vesting est immédiatement gelé.`
  },
  {
    id: "doc-04-politique-attribution-capital",
    title: "Doc 04 — Politique d'Attribution du Capital & Pool BSADP",
    category: "corporate",
    legal_status: "INTERNAL POLICY",
    summary: "Conditions de création d'un pool d'options/actions réservé aux futurs talents, conseillers et investisseurs.",
    author: "Ulrich DJATÉ YAPI (Fondateur Principal)",
    is_mandatory: true,
    current_version: "v1.0",
    content_markdown: `${LEGAL_DISCLAIMER_TEXT}

# Politique d'Attribution du Capital et Pool de Talents Ecomfy

## Article 1 — Principes d'Émission
Toute attribution future de titres, d'options d'achat d'actions ou de bons de souscription d'actions (BSA/BSPCE) au profit d'employés clés ou de conseillers doit être formellement approuvée par le Fondateur Principal.

## Article 2 — Interdiction de Dilution Sauvage
Aucune décision d'attribution ne peut réduire la participation de 80 % détenue par le Fondateur Principal sans un accord écrit et exprès préalable. Les attributions s'effectuent prioritairement à partir de réserves ou par création de catégories d'actions spécifiques.`
  },
  {
    id: "doc-05-politique-decision-approbation",
    title: "Doc 05 — Politique de Décision et d'Approbation",
    category: "governance",
    legal_status: "INTERNAL POLICY",
    summary: "Workflow décisionnel interne, gouvernance électronique et règles de majorité pour les résolutions Ecomfy.",
    author: "Ulrich DJATÉ YAPI (Fondateur Principal)",
    is_mandatory: true,
    current_version: "v1.0",
    content_markdown: `${LEGAL_DISCLAIMER_TEXT}

# Politique de Décision et d'Approbation de la Gouvernance Ecomfy

## Article 1 — Types de Décisions
1. **Décisions Opérationnelles Courantes** : Prises directement par le Fondateur Principal ou les responsables de pôle désignés.
2. **Décisions Stratégiques Majeures** : Modification du Cap Table, intégration d'investisseurs, cession d'actifs ou signature d'accords majeurs.

## Article 2 — Validation Numérique et Preuve
Chaque membre du Conseil approuve les documents obligatoires directement depuis son Espace Associé. La validation numérique enregistre :
- L'adresse IP du signataire.
- L'horodatage universel UTC.
- L'empreinte user-agent du navigateur.
- La déclaration d'acceptation formelle.`
  },
  {
    id: "doc-06-politique-propriete-intellectuelle",
    title: "Doc 06 — Politique et Cession de Propriété Intellectuelle (PI)",
    category: "intellectual_property",
    legal_status: "APPROVED INTERNALLY",
    summary: "Transfert exclusif de l'intégralité du code source, des algorithmes, prompts IA et briques SaaS à la société Ecomfy.",
    author: "Ulrich DJATÉ YAPI (Fondateur Principal)",
    is_mandatory: true,
    current_version: "v1.0",
    content_markdown: `${LEGAL_DISCLAIMER_TEXT}

# Politique de Propriété Intellectuelle et Cession des Créations Ecomfy

## Article 1 — Propriété Exclusive d'Ecomfy
L'intégralité des actifs immatériels développés ou exploités dans le cadre du projet Ecomfy est et demeure la propriété exclusive et inaliénable de la Société. Cela comprend :
- Le code source complet (Frontend React/Vite, Backend Supabase, Edge Functions Deno).
- Les algorithmes de génération visuelle et vidéo IA, y compris l'ensemble des prompts optimisés.
- Le nom de marque "Ecomfy", le logo, les sous-domaines \`ecomfy.cloud\` et domaines associés.
- Les bases de données, architectures de tables et workflows UI/UX.

## Article 2 — Engagement des Développeurs et Associés
Chaque associé et intervenant cède sans réserve à Ecomfy tous ses droits d'auteur, droits sur les bases de données et propriété industrielle nés au cours de sa collaboration.`
  },
  {
    id: "doc-07-accord-confidentialite",
    title: "Doc 07 — Accord de Confidentialité & Non-Concurrence",
    category: "confidentiality",
    legal_status: "APPROVED INTERNALLY",
    summary: "Protection absolue des secrets d'affaires, métriques financières réelles, algorithmes et clause de non-concurrence de 24 mois.",
    author: "Ulrich DJATÉ YAPI (Fondateur Principal)",
    is_mandatory: true,
    current_version: "v1.0",
    content_markdown: `${LEGAL_DISCLAIMER_TEXT}

# Accord de Confidentialité et de Non-Concurrence Ecomfy

## Article 1 — Informations Confidentielles
Constituent des informations strictly confidentielles :
- Les données financières réelles de la plateforme Ecomfy (revenus cumulés, MRR, nombre de boutiques activées à 1 300 FCFA).
- La structure du code source, les clés d'API et secrets Supabase.
- La stratégie d'acquisition marchande et le catalogue produit.

## Article 2 — Obligation de Non-Concurrence
Pendant toute la durée de sa détention de titres ou de sa collaboration, et pour une période de **24 mois** suivant son départ, chaque associé s'interdit de créer, participer ou conseiller directement ou indirectement une entreprise concurrente proposant un SaaS e-commerce similaire sur le marché africain.`
  },
  {
    id: "doc-08-charte-associes",
    title: "Doc 08 — Charte des Associés & Engagements Opérationnels",
    category: "partnership",
    legal_status: "INTERNAL POLICY",
    summary: "Droits, devoirs, rôle actif des associés et règles de courtoisie et d'éthique professionnelle au sein d'Ecomfy.",
    author: "Ulrich DJATÉ YAPI (Fondateur Principal)",
    is_mandatory: true,
    current_version: "v1.0",
    content_markdown: `${LEGAL_DISCLAIMER_TEXT}

# Charte des Associés d'Ecomfy

## Article 1 — Engagement Opérationnel
Chaque associé bénéficiant d'un plan de vesting s'engage à fournir un travail effectif, régulier et conforme aux objectifs définis d'un commun accord avec le Fondateur Principal.

## Article 2 — Devoir de Diligence et Alignement
Les associés s'engagent à représenter dignement la marque Ecomfy, à promouvoir la solution auprès de la communauté et à respecter la vision portée par la direction générale.`
  },
  {
    id: "doc-09-politique-investisseurs",
    title: "Doc 09 — Politique Investisseurs & Conditions d'Entrée au Capital",
    category: "investment",
    legal_status: "DRAFT",
    summary: "Directives préalables aux levées de fonds, accords SAFE/BSA-AIR et règles de Due Diligence Ecomfy.",
    author: "Ulrich DJATÉ YAPI (Fondateur Principal)",
    is_mandatory: false,
    current_version: "v0.9-draft",
    content_markdown: `${LEGAL_DISCLAIMER_TEXT}

# Politique Investisseurs & Protocoles d'Investissement Ecomfy (Draft)

## Article 1 — Principes de Levée de Fonds
L'ouverture du capital à des investisseurs extérieurs (Business Angels, Fonds de VC) s'effectue selon la méthode des instruments d'investissement rapides (BSA-AIR / SAFE) prévoyant une décote à la valorisation future.

## Article 2 — Transparence des Métriques
Toute due diligence investisseur s'appuie exclusivement sur les données financières réelles auditées du module \`financialMetricsService\` d'Ecomfy.`
  },
  {
    id: "doc-10-politique-sortie-offboarding",
    title: "Doc 10 — Politique de Sortie, Offboarding & Rachat de Titres",
    category: "employment",
    legal_status: "INTERNAL POLICY",
    summary: "Procédure d'offboarding sécurisée lors du départ d'un associé : gel du vesting non acquis, révocation des sessions et arbitrage juridique.",
    author: "Ulrich DJATÉ YAPI (Fondateur Principal)",
    is_mandatory: true,
    current_version: "v1.0",
    content_markdown: `${LEGAL_DISCLAIMER_TEXT}

# Politique de Sortie et Offboarding des Associés Ecomfy

## Article 1 — Déclenchement du Protocole d'Offboarding
En cas de démission, de résignation ou de fin de collaboration d'un associé, le système d'Offboarding Ecomfy est immédiatement activé.

## Article 2 — Actions Système Automatisées
1. **Révocation des Accès** : Désactivation du compte utilisateur, suspension des jetons d'API et des sessions actives.
2. **Gel du Vesting** : Annulation immédiate de toutes les tranches de vesting non encore acquises.
3. **Actions Acquises (Statut Bad / Good Leaver)** : Les actions déjà acquises ou formalisées font l'objet d'un avis juridique obligatoire pour déterminer les modalités de rachat ou de conservation par la Société.`
  }
];
