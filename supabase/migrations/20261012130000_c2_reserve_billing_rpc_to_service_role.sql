-- Audit C2 : les fonctions de facturation ne sont exécutables que par service_role.
-- Idempotent, appliquable seul sur la production (confirm_invoice_payment peut ne pas y exister).
--
-- Les appelants légitimes passent désormais par une edge function :
--   * webhooks / verify-payment / reconcile-pending-payments : clé service_role
--   * écrans fondateur (paiement manuel) : edge function founder-record-commission-payment,
--     qui vérifie le rôle founder / co_founder puis appelle la RPC avec service_role.
-- Un utilisateur connecté, fondateur compris, ne peut donc plus appeler ces RPC directement.

REVOKE ALL ON FUNCTION public.apply_commission_payment(uuid, numeric, text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_commission_payment(uuid, numeric, text, uuid, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.apply_shop_subscription(uuid, uuid, text, numeric, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_shop_subscription(uuid, uuid, text, numeric, text, text)
  TO service_role;

-- confirm_invoice_payment (migration 20260909100000, pas encore déployée en production)
DO $$
BEGIN
  IF to_regprocedure('public.confirm_invoice_payment(uuid, uuid, text, text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.confirm_invoice_payment(uuid, uuid, text, text)
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.confirm_invoice_payment(uuid, uuid, text, text)
      TO service_role;
  END IF;
END $$;
