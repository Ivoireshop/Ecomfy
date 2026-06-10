import { toast } from "sonner";

/** Opens the global "Recharger vos crédits IA" dialog (AICreditsBadge). */
export function openCreditsDialog() {
  window.dispatchEvent(new CustomEvent("open-credits-dialog"));
}

/**
 * Shows a persistent toast with a clear "Acheter du crédit" CTA. Use this
 * whenever an edge function returns `{ error: "credits_required" }`.
 */
export function showCreditsRequiredToast(message?: string) {
  toast.error(
    message ||
      "Vous avez utilisé votre essai gratuit. Achetez un pack de crédits IA (à partir de 2 000 FCFA) pour continuer.",
    {
      duration: 10000,
      action: {
        label: "Acheter du crédit",
        onClick: () => openCreditsDialog(),
      },
    },
  );
}

/**
 * Inspects an edge-function response/error and, if it indicates a missing
 * credit balance, shows the purchase toast and returns true.
 */
export function handleCreditsRequired(payload: any): boolean {
  const err = payload?.error || payload?.data?.error;
  const msg = payload?.message || payload?.data?.message;
  if (err === "credits_required") {
    showCreditsRequiredToast(msg);
    return true;
  }
  return false;
}