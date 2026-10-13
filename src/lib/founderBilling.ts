import { supabase } from "@/integrations/supabase/client";

export interface ManualCommissionPaymentParams {
  shopId: string;
  amount: number;
  transactionReference?: string;
  paymentMethod?: string;
  notes?: string;
}

export interface ManualShopActivationParams {
  shopId: string;
  amount: number;
  paymentMethod?: string;
}

// Appelle une edge function réservée aux fondateurs et lève une erreur lisible en cas d'échec.
async function invokeFounderFunction(name: string, body: Record<string, unknown>): Promise<void> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    // En cas de réponse non 2xx, le message utile est dans le corps JSON.
    let message = error.message;
    try {
      const payload = await (error as any).context?.json?.();
      if (payload?.error) message = payload.error;
    } catch {
      /* corps illisible : on garde error.message */
    }
    throw new Error(message || "Échec de l'opération.");
  }
  if (!data?.success) {
    throw new Error(data?.error || "Échec de l'opération.");
  }
}

/**
 * Enregistre un règlement de commission encaissé hors ligne.
 * Passe par l'edge function `founder-record-commission-payment` : apply_commission_payment
 * n'est plus exécutable depuis le navigateur. Lève une erreur si le paiement est refusé.
 */
export function recordManualCommissionPayment(params: ManualCommissionPaymentParams): Promise<void> {
  return invokeFounderFunction("founder-record-commission-payment", {
    shop_id: params.shopId,
    amount: params.amount,
    transaction_reference: params.transactionReference,
    payment_method: params.paymentMethod,
    notes: params.notes,
  });
}

/**
 * Active une boutique dont les frais d'activation ont été encaissés hors ligne.
 * Passe par l'edge function `founder-activate-shop` : apply_shop_activation n'est plus
 * exécutable depuis le navigateur. Lève une erreur si l'activation est refusée.
 */
export function activateShopManually(params: ManualShopActivationParams): Promise<void> {
  return invokeFounderFunction("founder-activate-shop", {
    shop_id: params.shopId,
    amount: params.amount,
    payment_method: params.paymentMethod,
  });
}
