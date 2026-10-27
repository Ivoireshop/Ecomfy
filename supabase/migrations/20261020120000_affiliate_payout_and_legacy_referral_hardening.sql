-- Affiliation : versement manuel cohérent avec les commissions, et ancien parrainage par crédits.
--
-- Constats corrigés (suite de 20261017120000_h6_affiliate_rls_rpc_hardening.sql, à appliquer avant) :
--   * mark_affiliate_payout_paid enregistrait n'importe quel montant, puis passait en PAID toutes les
--     commissions PENDING / APPROVED / PAYABLE de l'affilié, sans verrou : une commission encore « en
--     vérification » était soldée, et deux clics simultanés créaient deux versements.
--   * process_referral_signup(referred_user_id, code) acceptait un identifiant utilisateur choisi par
--     l'appelant : n'importe quel compte connecté pouvait créditer des générations gratuites à un
--     parrain et à un compte de son choix.
--
-- Après cette migration :
--   * un versement doit égaler la somme exacte des commissions PAYABLE / APPROVED visées (période
--     incluse) ; elles sont verrouillées pendant l'opération ; les PENDING ne sont jamais soldées ;
--   * l'ancien parrainage n'accepte que l'appelant comme filleul, une seule fois, jamais son propre code.
--
-- Idempotent.

-- ---------------------------------------------------------------------
-- 1. Versement manuel
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_affiliate_payout_paid(
  p_affiliate_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_payment_reference TEXT,
  p_period_code TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_founder_id UUID := auth.uid();
  v_period TEXT := NULLIF(TRIM(COALESCE(p_period_code, '')), '');
  v_payout_id UUID;
  v_due NUMERIC;
  v_count INT;
  v_updated_count INT;
BEGIN
  IF NOT public.is_founder_or_cofounder(v_founder_id) THEN
    RAISE EXCEPTION 'Accès refusé. Seul le fondateur peut valider un paiement manuel d''affiliation.';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Le montant du versement doit être supérieur à 0.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.affiliates WHERE id = p_affiliate_id) THEN
    RAISE EXCEPTION 'Affilié introuvable.';
  END IF;

  -- Verrouille les commissions visées : un second versement simultané attend, puis ne trouve plus rien.
  SELECT COALESCE(SUM(c.commission_amount), 0), COUNT(*)
  INTO v_due, v_count
  FROM (
    SELECT commission_amount
    FROM public.affiliate_commissions
    WHERE affiliate_id = p_affiliate_id
      AND status IN ('PAYABLE', 'APPROVED')
      AND (v_period IS NULL OR period_code = v_period)
    FOR UPDATE
  ) c;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Aucune commission payable pour cet affilié%.',
      CASE WHEN v_period IS NULL THEN '' ELSE ' sur la période ' || v_period END;
  END IF;

  IF ABS(v_due - p_amount) > 0.01 THEN
    RAISE EXCEPTION 'Le montant saisi (%) ne correspond pas aux commissions payables (%).', p_amount, v_due;
  END IF;

  INSERT INTO public.affiliate_payouts (
    affiliate_id, period_code, amount_paid, payment_method, payment_reference, notes, created_by
  ) VALUES (
    p_affiliate_id, v_period, p_amount, p_payment_method, p_payment_reference, p_notes, v_founder_id
  ) RETURNING id INTO v_payout_id;

  UPDATE public.affiliate_commissions
  SET status = 'PAID', payout_id = v_payout_id, updated_at = now()
  WHERE affiliate_id = p_affiliate_id
    AND status IN ('PAYABLE', 'APPROVED')
    AND (v_period IS NULL OR period_code = v_period);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  INSERT INTO public.affiliate_audit_logs (affiliate_id, action, performed_by, details)
  VALUES (
    p_affiliate_id,
    'MARK_PAID',
    v_founder_id,
    jsonb_build_object(
      'payout_id', v_payout_id,
      'amount', p_amount,
      'method', p_payment_method,
      'reference', p_payment_reference,
      'period', v_period,
      'commissions_updated', v_updated_count
    )
  );

  RETURN jsonb_build_object('success', true, 'payout_id', v_payout_id, 'updated_commissions', v_updated_count);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_affiliate_payout_paid(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_affiliate_payout_paid(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. Ancien parrainage par crédits : le filleul est toujours l'appelant
-- ---------------------------------------------------------------------
-- Signature conservée (le front envoie encore referred_user_id) ; la valeur doit être auth.uid().
CREATE OR REPLACE FUNCTION public.process_referral_signup(referred_user_id UUID, referral_code_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code TEXT := UPPER(TRIM(COALESCE(referral_code_input, '')));
  referrer_user_id UUID;
  bonus_gens INTEGER;
BEGIN
  IF v_uid IS NULL OR referred_user_id IS NULL OR referred_user_id <> v_uid OR v_code = '' THEN
    RETURN false;
  END IF;

  -- Un compte ne peut être parrainé qu'une fois.
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = v_uid) THEN
    RETURN false;
  END IF;

  -- Réservation atomique du code : un seul appel le fait passer de pending à completed.
  UPDATE public.referrals
  SET referred_id = v_uid, status = 'completed', completed_at = now()
  WHERE referral_code = v_code
    AND status = 'pending'
    AND referrer_id <> v_uid
  RETURNING referrer_id, bonus_generations INTO referrer_user_id, bonus_gens;

  IF referrer_user_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET free_generations_remaining = free_generations_remaining + bonus_gens
  WHERE id = referrer_user_id;

  UPDATE public.profiles
  SET free_generations_remaining = free_generations_remaining + 2
  WHERE id = v_uid;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.process_referral_signup(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.process_referral_signup(UUID, TEXT) TO authenticated, service_role;
