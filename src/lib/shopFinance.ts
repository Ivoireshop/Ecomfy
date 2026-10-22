// Règles de calcul de la page Finance de la boutique : périodes, devises, encaissements, export CSV.
// Fonctions pures, sans accès réseau, pour que l'affichage, l'export et le message WhatsApp restent d'accord.

export type FinancePeriod = "week" | "month" | "all";

/** Parité fixe : 1 EUR = 655,957 XOF = 655,957 XAF ; XOF et XAF s'échangent à 1 pour 1. */
const XOF_PER_UNIT: Record<string, number> = { XOF: 1, XAF: 1, FCFA: 1, EUR: 655.957 };

/** Montant converti en FCFA, ou null si la devise n'a pas de parité fixe (USD, GHS...) : on ne devine pas un taux. */
export function toFcfa(amount: number, currency: string | null | undefined): number | null {
  const rate = XOF_PER_UNIT[String(currency || "XOF").toUpperCase()];
  if (rate === undefined) return null;
  return (Number(amount) || 0) * rate;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Jour calendaire local au format AAAA-MM-JJ (celui de l'utilisateur, pas UTC). */
export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Jour d'un horodatage ou d'une date : « 2026-10-05 » reste tel quel, un horodatage est ramené au jour local. */
export function dayOf(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : localDayKey(d);
}

/** Premier jour inclus de la période (« 7 jours » = aujourd'hui et les 6 jours précédents), null pour « Tout ». */
export function periodStartKey(period: FinancePeriod, now = new Date()): string | null {
  if (period === "week") {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    return localDayKey(d);
  }
  if (period === "month") return localDayKey(new Date(now.getFullYear(), now.getMonth(), 1));
  return null;
}

export const isInPeriod = (value: string | null | undefined, startKey: string | null): boolean => {
  const day = dayOf(value);
  if (!day) return false;
  return !startKey || day >= startKey;
};

export const VALIDATED_STATUSES = ["confirmed", "processing", "shipped", "delivered"];

/** Une commande livrée est encaissée sauf si son paiement est remboursé ou en échec. */
export function isCashedIn(o: { order_status: string; payment_status?: string | null }): boolean {
  return o.order_status === "delivered" && !["refunded", "failed"].includes(String(o.payment_status || "").toLowerCase());
}

/** Cellule CSV : guillemets doublés, et préfixe qui neutralise les formules (=, +, -, @) que Excel exécuterait. */
export function csvCell(value: unknown): string {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Courriel plausible : une seule arobase, un domaine avec un point, pas d'espace. */
export const isValidEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/** Numéro pour wa.me : chiffres seulement, « 00 » international retiré. Null s'il est trop court pour être complet. */
export function whatsappDigits(raw: string | null | undefined): string | null {
  let digits = String(raw || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  return digits.length >= 8 ? digits : null;
}
