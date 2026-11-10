import { describe, expect, it } from "vitest";
import {
  NO_INVITATION,
  buildOnboardingSteps,
  checkAllocationRoom,
  computeVestingProgress,
  countApprovers,
  invitationRank,
  resolveMemberStatus,
  sharesForPercentage,
  summarizeCapTable,
  wholeMonthsBetween,
} from "./governanceMetrics";
import type { CorporateShareholder } from "@/types/corporate";

const sh = (over: Partial<CorporateShareholder> & { pct?: number; shares?: number }): CorporateShareholder =>
  ({
    id: over.id ?? "s",
    user_id: null,
    email: `${over.id ?? "s"}@x.test`,
    full_name: over.full_name ?? "N",
    corporate_role: "shareholder",
    is_main_founder: false,
    onboarding_level: 1,
    onboarding_completed: false,
    mfa_enabled: false,
    created_at: "",
    updated_at: "",
    ...over,
    allocation:
      over.pct === undefined
        ? undefined
        : ({ target_percentage: over.pct, target_shares: over.shares ?? over.pct * 10000 } as never),
  }) as CorporateShareholder;

describe("summarizeCapTable", () => {
  it("additionne les participations réelles et détecte un capital complet", () => {
    const r = summarizeCapTable([sh({ id: "f", is_main_founder: true, pct: 80 }), sh({ id: "a", pct: 10 }), sh({ id: "b", pct: 10 })]);
    expect(r.allocatedPct).toBe(100);
    expect(r.complete).toBe(true);
    expect(r.unallocatedPct).toBe(0);
    expect(r.mainFounder?.id).toBe("f");
    expect(r.beneficiaries.map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("ne comble pas un capital incomplet et ne cache pas un dépassement", () => {
    const partial = summarizeCapTable([sh({ id: "f", is_main_founder: true, pct: 80 }), sh({ id: "a", pct: 10 })]);
    expect(partial.complete).toBe(false);
    expect(partial.unallocatedPct).toBe(10);
    const over = summarizeCapTable([sh({ id: "f", is_main_founder: true, pct: 80 }), sh({ id: "a", pct: 30 })]);
    expect(over.overAllocatedPct).toBe(10);
    expect(over.unallocatedPct).toBe(0);
  });

  it("un membre sans participation compte 0, pas 10 %", () => {
    const r = summarizeCapTable([sh({ id: "f", is_main_founder: true, pct: 80 }), sh({ id: "a" })]);
    expect(r.allocatedPct).toBe(80);
    expect(r.beneficiaries).toHaveLength(0);
  });

  it("n'identifie pas le fondateur principal par son e-mail", () => {
    const r = summarizeCapTable([{ ...sh({ id: "x", pct: 50 }), email: "djateulrich@gmail.com" }]);
    expect(r.mainFounder).toBeNull();
  });
});

describe("checkAllocationRoom", () => {
  const all = [sh({ id: "f", is_main_founder: true, pct: 80 }), sh({ id: "a", pct: 10 }), sh({ id: "b", pct: 10 })];

  it("autorise jusqu'à la place restante en ignorant la participation actuelle du bénéficiaire", () => {
    expect(checkAllocationRoom(all, "a", 10).ok).toBe(true);
    expect(checkAllocationRoom(all, "a", 10.01).ok).toBe(false);
    expect(checkAllocationRoom(all, "a", 10).maxPct).toBe(10);
  });

  it("refuse 0, négatif et NaN", () => {
    expect(checkAllocationRoom(all, "a", 0).ok).toBe(false);
    expect(checkAllocationRoom(all, "a", -1).ok).toBe(false);
    expect(checkAllocationRoom(all, "a", Number.NaN).ok).toBe(false);
  });

  it("pour une nouvelle personne, toutes les participations existantes comptent", () => {
    expect(checkAllocationRoom(all, null, 1).ok).toBe(false);
    expect(checkAllocationRoom(all.slice(0, 2), null, 10).ok).toBe(true);
  });
});

describe("sharesForPercentage", () => {
  it("convertit en actions entières", () => {
    expect(sharesForPercentage(10, 1_000_000)).toBe(100_000);
    expect(sharesForPercentage(0.5, 1_000_000)).toBe(5_000);
  });
});

describe("wholeMonthsBetween", () => {
  it("compte les mois entiers", () => {
    expect(wholeMonthsBetween(new Date("2026-01-31T00:00:00Z"), new Date("2026-02-28T00:00:00Z"))).toBe(0);
    expect(wholeMonthsBetween(new Date("2026-01-15T00:00:00Z"), new Date("2026-04-15T00:00:00Z"))).toBe(3);
    expect(wholeMonthsBetween(new Date("2026-05-01T00:00:00Z"), new Date("2026-01-01T00:00:00Z"))).toBe(0);
  });
});

describe("computeVestingProgress", () => {
  const plan = {
    start_date: "2026-01-01",
    end_date: "2030-01-01",
    cliff_date: "2027-01-01",
    duration_months: 48,
    cliff_months: 12,
    target_percentage: 10,
    target_shares: 100_000,
  };

  it("rien avant le cliff", () => {
    const r = computeVestingProgress(plan, new Date("2026-12-31T10:00:00Z"))!;
    expect(r.cliffReached).toBe(false);
    expect(r.eligiblePct).toBe(0);
    expect(r.eligibleShares).toBe(0);
  });

  it("au cliff, 12/48 de la cible", () => {
    const r = computeVestingProgress(plan, new Date("2027-01-01T00:00:00Z"))!;
    expect(r.cliffReached).toBe(true);
    expect(r.eligiblePct).toBe(2.5);
    expect(r.eligibleShares).toBe(25_000);
  });

  it("progresse chaque mois entier après le cliff", () => {
    const r = computeVestingProgress(plan, new Date("2027-07-01T00:00:00Z"))!;
    expect(r.monthsElapsed).toBe(18);
    expect(r.eligiblePct).toBe(3.75);
  });

  it("plafonne à la cible à la fin du plan", () => {
    const r = computeVestingProgress(plan, new Date("2032-01-01T00:00:00Z"))!;
    expect(r.completed).toBe(true);
    expect(r.eligiblePct).toBe(10);
    expect(r.eligibleShares).toBe(100_000);
  });

  it("dates illisibles ou durée nulle : pas de calcul inventé", () => {
    expect(computeVestingProgress({ ...plan, start_date: "n/a" })).toBeNull();
    expect(computeVestingProgress({ ...plan, duration_months: 0 })).toBeNull();
  });
});

describe("resolveMemberStatus", () => {
  it("sans invitation enregistrée, un membre non activé n'est pas « invité »", () => {
    const r = resolveMemberStatus({ is_main_founder: false, onboarding_completed: false });
    expect(r.status).toBe(NO_INVITATION);
    expect(r.isActive).toBe(false);
  });

  it("fondateur principal et onboarding terminé = actif", () => {
    expect(resolveMemberStatus({ is_main_founder: true, onboarding_completed: false }).isActive).toBe(true);
    expect(resolveMemberStatus({ is_main_founder: false, onboarding_completed: true }).status).toBe("ACTIVE");
  });

  it("une invitation acceptée attend l'activation du fondateur", () => {
    const r = resolveMemberStatus({ is_main_founder: false, onboarding_completed: true }, { status: "ACCEPTED" });
    expect(r.isAccepted).toBe(true);
    expect(r.isActive).toBe(false);
  });

  it("reprend le statut de l'invitation", () => {
    const r = resolveMemberStatus({ is_main_founder: false, onboarding_completed: false }, { status: "INVITATION_SENT" });
    expect(r.status).toBe("INVITATION_SENT");
    expect(r.fromInvitation).toBe(true);
  });
});

describe("buildOnboardingSteps", () => {
  const base = { emailConfirmed: false, mandatoryDocs: 3, viewedMandatory: 0, approvedMandatory: 0 };

  it("aucune étape de lecture ou de signature cochée d'office", () => {
    const steps = buildOnboardingSteps({
      ...base,
      shareholder: { is_main_founder: false, onboarding_level: 1, onboarding_completed: false },
    });
    expect(steps.map((s) => s.done)).toEqual([true, false, true, false, false, false, false]);
  });

  it("une signature complète valide lecture et approbation", () => {
    const steps = buildOnboardingSteps({
      ...base,
      emailConfirmed: true,
      approvedMandatory: 3,
      shareholder: { is_main_founder: false, onboarding_level: 1, onboarding_completed: false },
    });
    expect(steps.map((s) => s.done)).toEqual([true, true, true, true, true, false, false]);
  });

  it("sans profil associé, seule la disponibilité des documents peut être vraie", () => {
    const steps = buildOnboardingSteps({ ...base, shareholder: null });
    expect(steps.filter((s) => s.done).map((s) => s.lvl)).toEqual([3]);
  });

  it("un membre activé voit tout le parcours validé", () => {
    const steps = buildOnboardingSteps({
      ...base,
      shareholder: { is_main_founder: false, onboarding_level: 7, onboarding_completed: true },
    });
    expect(steps.every((s) => s.done)).toBe(true);
  });
});

describe("countApprovers", () => {
  const acc = [
    { document_id: "d1", version: "v1.0", user_id: "u1", action: "approved" },
    { document_id: "d1", version: "v1.0", user_id: "u1", action: "approved" },
    { document_id: "d1", version: "v1.0", user_id: "u2", action: "read" },
    { document_id: "d1", version: "v0.9", user_id: "u3", action: "approved" },
    { document_id: "d2", version: "v1.0", user_id: "u4", action: "approved" },
  ];
  it("compte les personnes distinctes, pour la bonne version et seulement les approbations", () => {
    expect(countApprovers(acc, "d1", "v1.0")).toBe(1);
    expect(countApprovers(acc, "d2", "v1.0")).toBe(1);
    expect(countApprovers(acc, "d3", "v1.0")).toBe(0);
  });
});

describe("invitationRank", () => {
  it("ordonne le parcours et traite les statuts d'attente comme l'étape précédente", () => {
    expect(["PENDING_INVITATION", "INVITATION_SENT", "INVITATION_OPENED", "EMAIL_VERIFIED", "DOCUMENTS_READ", "ACCEPTED", "ACTIVE"].map(invitationRank)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(invitationRank("DOCUMENTS_PENDING")).toBe(4);
    expect(invitationRank("APPROVAL_PENDING")).toBe(5);
  });
  it("0 pour un statut hors parcours", () => {
    expect(["REVOKED", "DECLINED", "EXPIRED", NO_INVITATION].map(invitationRank)).toEqual([0, 0, 0, 0]);
  });
});
