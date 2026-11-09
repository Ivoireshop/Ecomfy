/**
 * Calculs de gouvernance à partir des lignes réelles de la base (cap table, vesting, invitations,
 * parcours d'onboarding). Aucune valeur par défaut inventée : une donnée absente reste absente.
 */
import type {
  CorporateInvitation,
  CorporateShareholder,
  CorporateVestingPlan,
} from "@/types/corporate";

const EPS = 0.005;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const roundTo = (v: number, digits = 2): number => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

// ---------------------------------------------------------------------------
// Cap table
// ---------------------------------------------------------------------------

export interface CapTableSummary {
  /** Somme des participations cibles enregistrées (en %). */
  allocatedPct: number;
  allocatedShares: number;
  /** Reste à attribuer (jamais négatif). */
  unallocatedPct: number;
  /** Dépassement au-delà de 100 % (0 si aucun). */
  overAllocatedPct: number;
  complete: boolean;
  mainFounder: CorporateShareholder | null;
  /** Membres hors fondateur principal qui ont une participation enregistrée. */
  beneficiaries: CorporateShareholder[];
}

export function summarizeCapTable(shareholders: CorporateShareholder[]): CapTableSummary {
  let allocatedPct = 0;
  let allocatedShares = 0;
  for (const s of shareholders) {
    allocatedPct += num(s.allocation?.target_percentage);
    allocatedShares += num(s.allocation?.target_shares);
  }
  allocatedPct = roundTo(allocatedPct);
  const mainFounder = shareholders.find((s) => s.is_main_founder) ?? null;
  const beneficiaries = shareholders.filter((s) => !s.is_main_founder && s.allocation);
  return {
    allocatedPct,
    allocatedShares: roundTo(allocatedShares, 0),
    unallocatedPct: roundTo(Math.max(0, 100 - allocatedPct)),
    overAllocatedPct: roundTo(Math.max(0, allocatedPct - 100)),
    complete: Math.abs(allocatedPct - 100) < EPS,
    mainFounder,
    beneficiaries,
  };
}

/**
 * Peut-on porter la participation d'un membre à `newPct` ? Les autres participations restent
 * telles quelles et le total ne doit pas dépasser 100 %.
 */
export function checkAllocationRoom(
  shareholders: CorporateShareholder[],
  shareholderId: string | null,
  newPct: number,
): { ok: boolean; othersPct: number; maxPct: number } {
  const othersPct = roundTo(
    shareholders
      .filter((s) => s.id !== shareholderId)
      .reduce((acc, s) => acc + num(s.allocation?.target_percentage), 0),
  );
  const maxPct = roundTo(Math.max(0, 100 - othersPct));
  return {
    ok: Number.isFinite(newPct) && newPct > 0 && newPct <= maxPct + EPS,
    othersPct,
    maxPct,
  };
}

export const sharesForPercentage = (pct: number, totalShares: number): number =>
  roundTo((pct / 100) * totalShares, 0);

// ---------------------------------------------------------------------------
// Vesting
// ---------------------------------------------------------------------------

export interface VestingProgress {
  startDate: Date;
  cliffDate: Date;
  endDate: Date;
  monthsElapsed: number;
  cliffReached: boolean;
  completed: boolean;
  /** Part éligible au vesting à la date donnée (calcul linéaire mensuel après le cliff), en %. */
  eligiblePct: number;
  eligibleShares: number;
}

const parseDay = (v: string | null | undefined): Date | null => {
  if (!v) return null;
  const d = new Date(`${v.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Nombre de mois entiers écoulés entre deux jours (UTC). */
export function wholeMonthsBetween(from: Date, to: Date): number {
  if (to < from) return 0;
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * Éligibilité au vesting d'un plan à une date. Rien avant le cliff ; au cliff, la part
 * correspondant aux mois du cliff ; ensuite un mois de plus à chaque mois entier écoulé, plafonné
 * à la durée du plan. Un plan en pause ou annulé ne progresse pas : on le signale sans le calculer.
 * Retourne null si les dates du plan sont illisibles.
 */
export function computeVestingProgress(
  plan: Pick<
    CorporateVestingPlan,
    "start_date" | "end_date" | "cliff_date" | "duration_months" | "cliff_months" | "target_percentage" | "target_shares"
  >,
  today: Date = new Date(),
): VestingProgress | null {
  const start = parseDay(plan.start_date);
  const end = parseDay(plan.end_date);
  const cliff = parseDay(plan.cliff_date);
  const duration = num(plan.duration_months);
  if (!start || !end || !cliff || duration <= 0) return null;

  const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const monthsElapsed = Math.min(duration, wholeMonthsBetween(start, day));
  const cliffReached = day >= cliff;
  const eligibleMonths = cliffReached ? Math.max(monthsElapsed, num(plan.cliff_months)) : 0;
  const ratio = Math.min(1, eligibleMonths / duration);

  return {
    startDate: start,
    cliffDate: cliff,
    endDate: end,
    monthsElapsed,
    cliffReached,
    completed: monthsElapsed >= duration,
    eligiblePct: roundTo(num(plan.target_percentage) * ratio),
    eligibleShares: roundTo(num(plan.target_shares) * ratio, 0),
  };
}

// ---------------------------------------------------------------------------
// Invitations et parcours d'un membre
// ---------------------------------------------------------------------------

/** Statut affiché quand aucune invitation n'est enregistrée pour un membre non activé. */
export const NO_INVITATION = "NO_INVITATION";

/**
 * Étape atteinte par une invitation (1 à 7). Les statuts d'attente intermédiaires valent l'étape
 * précédente : « documents à lire » = e-mail vérifié, « approbation en attente » = documents lus.
 * Les statuts hors parcours (refusée, expirée, révoquée) valent 0.
 */
const INVITATION_STAGE: Record<string, number> = {
  PENDING_INVITATION: 1,
  INVITATION_SENT: 2,
  INVITATION_OPENED: 3,
  EMAIL_VERIFIED: 4,
  DOCUMENTS_PENDING: 4,
  DOCUMENTS_READ: 5,
  APPROVAL_PENDING: 5,
  ACCEPTED: 6,
  ACTIVE: 7,
};

export function invitationRank(status: string): number {
  return INVITATION_STAGE[status] ?? 0;
}

export interface MemberStatus {
  status: string;
  isActive: boolean;
  isAccepted: boolean;
  /** Vrai si ce statut vient d'une ligne d'invitation enregistrée. */
  fromInvitation: boolean;
}

/**
 * Statut réel d'un membre : la ligne d'invitation si elle existe, sinon activé (fondateur principal ou
 * onboarding terminé) ou « aucune invitation enregistrée ». Aucun statut n'est inventé.
 */
export function resolveMemberStatus(
  shareholder: Pick<CorporateShareholder, "is_main_founder" | "onboarding_completed">,
  invitation?: Pick<CorporateInvitation, "status"> | null,
): MemberStatus {
  if (shareholder.is_main_founder) {
    return { status: "ACTIVE", isActive: true, isAccepted: false, fromInvitation: !!invitation };
  }
  if (invitation) {
    const isActive = invitation.status === "ACTIVE" || (shareholder.onboarding_completed && invitation.status !== "ACCEPTED");
    return {
      status: invitation.status,
      isActive,
      isAccepted: invitation.status === "ACCEPTED",
      fromInvitation: true,
    };
  }
  if (shareholder.onboarding_completed) {
    return { status: "ACTIVE", isActive: true, isAccepted: false, fromInvitation: false };
  }
  return { status: NO_INVITATION, isActive: false, isAccepted: false, fromInvitation: false };
}

export interface OnboardingStep {
  lvl: number;
  title: string;
  desc: string;
  done: boolean;
}

/**
 * Parcours de l'associé : chaque étape n'est validée que par un fait enregistré (invitation, e-mail
 * confirmé du compte connecté, consultation journalisée, signature, activation).
 */
export function buildOnboardingSteps(input: {
  shareholder: Pick<CorporateShareholder, "is_main_founder" | "onboarding_level" | "onboarding_completed"> | null;
  invitation?: Pick<CorporateInvitation, "status"> | null;
  emailConfirmed: boolean;
  mandatoryDocs: number;
  viewedMandatory: number;
  approvedMandatory: number;
}): OnboardingStep[] {
  const { shareholder, invitation, emailConfirmed, mandatoryDocs, viewedMandatory, approvedMandatory } = input;
  const active = !!shareholder && (shareholder.is_main_founder || shareholder.onboarding_completed);
  const level = shareholder?.onboarding_level ?? 0;
  const rank = invitation ? invitationRank(invitation.status) : 0;
  const allViewed = mandatoryDocs > 0 && viewedMandatory >= mandatoryDocs;
  const allApproved = mandatoryDocs > 0 && approvedMandatory >= mandatoryDocs;

  return [
    { lvl: 1, title: "1. Invitation", desc: "Profil enregistré", done: !!shareholder },
    { lvl: 2, title: "2. Identité", desc: "E-mail confirmé", done: emailConfirmed || rank >= 4 || active },
    { lvl: 3, title: "3. Documents", desc: "Dossier disponible", done: mandatoryDocs > 0 },
    { lvl: 4, title: "4. Lecture", desc: "Consultation journalisée", done: allViewed || allApproved || rank >= 5 || active },
    { lvl: 5, title: "5. Approbation", desc: "Signature enregistrée", done: allApproved || rank >= 6 || level >= 5 || active },
    { lvl: 6, title: "6. Activation", desc: "Validée par le fondateur", done: active },
    { lvl: 7, title: "7. Espace associé", desc: "Accès complet", done: active },
  ];
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/** Nombre de personnes distinctes ayant approuvé la version courante d'un document. */
export function countApprovers(
  acceptances: Array<{ document_id: string; version: string; user_id: string; action: string }>,
  documentId: string,
  version: string,
): number {
  const ids = new Set<string>();
  for (const a of acceptances) {
    if (a.document_id === documentId && a.version === version && a.action === "approved") ids.add(a.user_id);
  }
  return ids.size;
}
