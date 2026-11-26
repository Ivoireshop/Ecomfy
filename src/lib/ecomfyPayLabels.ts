// Libellés affichés au marchand : les codes de la base (SUCCEEDED, orange_money…) ne sont jamais montrés tels quels.
import type { PaymentStatus, WithdrawalStatus } from "@/types/ecomfyPay";

interface StatusLabel {
  label: string;
  className: string;
}

const SUCCESS = "bg-emerald-100 text-emerald-800";
const WAITING = "bg-amber-100 text-amber-800";
const FAILURE = "bg-rose-100 text-rose-800";
const NEUTRAL = "bg-slate-100 text-slate-700";

const PAYMENT: Record<PaymentStatus, StatusLabel> = {
  CREATED: { label: "Créé", className: WAITING },
  PENDING: { label: "En attente", className: WAITING },
  PROCESSING: { label: "En cours", className: WAITING },
  SUCCEEDED: { label: "Réussi", className: SUCCESS },
  FAILED: { label: "Échoué", className: FAILURE },
  EXPIRED: { label: "Expiré", className: NEUTRAL },
  CANCELLED: { label: "Annulé", className: NEUTRAL },
  REFUNDED: { label: "Remboursé", className: NEUTRAL },
};

const WITHDRAWAL: Record<WithdrawalStatus, StatusLabel> = {
  REQUESTED: { label: "En attente de validation", className: WAITING },
  PROCESSING: { label: "En cours", className: WAITING },
  SUCCEEDED: { label: "Payé", className: SUCCESS },
  FAILED: { label: "Échoué", className: FAILURE },
  REVERSED: { label: "Annulé", className: NEUTRAL },
  CANCELLED: { label: "Annulé", className: NEUTRAL },
};

const METHODS: Record<string, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
  mtn: "MTN",
  moov: "Moov",
  mobile_money: "Mobile Money",
  bank_transfer: "Virement bancaire",
  card: "Carte bancaire",
};

export const paymentStatusLabel = (status: string): StatusLabel =>
  PAYMENT[status as PaymentStatus] ?? { label: status, className: NEUTRAL };

export const withdrawalStatusLabel = (status: string): StatusLabel =>
  WITHDRAWAL[status as WithdrawalStatus] ?? { label: status, className: NEUTRAL };

/** Nom d'un opérateur ou d'un moyen de paiement ; un code inconnu reste lisible. */
export const paymentMethodLabel = (code: string): string => METHODS[code.toLowerCase()] ?? code.replace(/_/g, " ");
