-- 1. Wallet : création du portefeuille par le marchand connecté, sans passer par get_or_create_merchant_wallet.
--
-- get_or_create_merchant_wallet(p_merchant_id) est réservée à service_role (C1) : l'appel depuis le navigateur
-- (src/lib/ecomfyPay.ts, getWallet) échouait en 42501 et un marchand sans portefeuille n'en voyait jamais créer.
-- Cette variante n'accepte aucun identifiant : le portefeuille est celui de auth.uid().
CREATE OR REPLACE FUNCTION public.get_or_create_my_wallet()
RETURNS public.wallets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_wallet public.wallets;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE merchant_id = v_uid;

  IF NOT FOUND THEN
    INSERT INTO public.wallets (merchant_id, pending_balance, available_balance, total_withdrawn, total_received)
    VALUES (v_uid, 0, 0, 0, 0)
    ON CONFLICT (merchant_id) DO NOTHING;
    SELECT * INTO v_wallet FROM public.wallets WHERE merchant_id = v_uid;
  END IF;

  RETURN v_wallet;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_my_wallet() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_my_wallet() TO authenticated, service_role;

-- 2. is_founder_or_cofounder : plus d'oracle de rôles.
--
-- La fonction était exécutable par anon avec un UUID quelconque : n'importe qui pouvait demander si un compte
-- est fondateur. Elle ne répond désormais « oui » que pour l'appelant lui-même (auth.uid(), usage des politiques RLS)
-- ou pour service_role. Les politiques l'appellent toujours avec auth.uid() : leur comportement ne change pas.
CREATE OR REPLACE FUNCTION public.is_founder_or_cofounder(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.role() = 'service_role' OR _user_id = auth.uid())
     AND (public.has_role(_user_id, 'founder'::public.app_role)
          OR public.has_role(_user_id, 'co_founder'::public.app_role))
$$;
