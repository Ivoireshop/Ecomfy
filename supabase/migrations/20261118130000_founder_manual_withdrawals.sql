-- Retraits Ecomfy Pay : validation et versement MANUELS par le fondateur (18/11/2026).
-- Jusqu'ici, un retrait déclenchait aussitôt le versement automatique chez GeniusPay. Désormais :
--   1. la demande déduit le solde et reste en REQUESTED (« en attente de validation ») ;
--   2. le fondateur voit la file, verse lui-même l'argent hors plateforme, puis clôture :
--        - founder_approve_withdrawal : « payé » (référence de transaction obligatoire) -> SUCCEEDED ;
--        - founder_reject_withdrawal  : « rejeté » (motif obligatoire) -> FAILED, montant recrédité ;
--   3. le versement automatique reste disponible derrière le réglage withdrawals_auto_payout (faux par défaut).
-- Toute clôture est tracée (qui, quand, référence, note). Aucune de ces fonctions n'est appelable sans rôle fondateur.

-- 1. Traçabilité de la revue
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manual_reference TEXT,
  ADD COLUMN IF NOT EXISTS review_note TEXT;

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status_created
  ON public.withdrawal_requests(status, created_at DESC);

-- 2. Réglage : versement automatique (désactivé tant que le fondateur ne l'a pas décidé)
INSERT INTO public.ecomfy_pay_settings (key, value)
VALUES ('withdrawals_auto_payout', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 3. Contrôle d'accès commun
CREATE OR REPLACE FUNCTION public._assert_withdrawal_reviewer()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(v_uid, 'founder') OR public.has_role(v_uid, 'co_founder')) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN v_uid;
END $$;
REVOKE ALL ON FUNCTION public._assert_withdrawal_reviewer() FROM PUBLIC, anon, authenticated;

-- 4. File des retraits (p_status NULL = tous ; sinon REQUESTED, SUCCEEDED, FAILED…)
CREATE OR REPLACE FUNCTION public.founder_list_withdrawals(p_status TEXT DEFAULT NULL, p_limit INT DEFAULT 200)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows JSONB;
BEGIN
  PERFORM public._assert_withdrawal_reviewer();

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT w.id, w.withdrawal_reference, w.merchant_id, w.amount, w.currency, w.payout_method, w.payout_operator,
           w.destination_phone, w.destination_name, w.destination_bank_iban, w.status, w.failure_reason,
           w.manual_reference, w.review_note, w.reviewed_at, w.processed_at, w.created_at,
           u.email AS merchant_email,
           k.full_name AS kyc_full_name, k.phone_number AS kyc_phone, k.verification_status AS kyc_status,
           wa.available_balance AS wallet_available_balance, wa.is_frozen AS wallet_frozen,
           rv.email AS reviewed_by_email
    FROM public.withdrawal_requests w
    LEFT JOIN auth.users u ON u.id = w.merchant_id
    LEFT JOIN public.merchant_kyc k ON k.user_id = w.merchant_id
    LEFT JOIN public.wallets wa ON wa.id = w.wallet_id
    LEFT JOIN auth.users rv ON rv.id = w.reviewed_by
    WHERE (p_status IS NULL OR w.status = p_status)
    ORDER BY w.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
  ) x;

  RETURN jsonb_build_object('success', true, 'withdrawals', v_rows);
END $$;
REVOKE ALL ON FUNCTION public.founder_list_withdrawals(TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.founder_list_withdrawals(TEXT, INT) TO authenticated, service_role;

-- 5. Valider : l'argent a été versé à la main
CREATE OR REPLACE FUNCTION public.founder_approve_withdrawal(
  p_withdrawal_reference TEXT,
  p_manual_reference TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := public._assert_withdrawal_reviewer();
  v_wd public.withdrawal_requests;
  v_ref TEXT := NULLIF(btrim(COALESCE(p_manual_reference, '')), '');
  r JSONB;
BEGIN
  IF v_ref IS NULL OR length(v_ref) < 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez la référence de la transaction de versement (3 caractères minimum).');
  END IF;

  SELECT * INTO v_wd FROM public.withdrawal_requests WHERE withdrawal_reference = p_withdrawal_reference FOR UPDATE;
  IF v_wd.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Retrait introuvable.');
  END IF;
  IF v_wd.status NOT IN ('REQUESTED', 'PROCESSING') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce retrait est déjà clôturé (' || v_wd.status || ').');
  END IF;

  r := public.finalize_withdrawal(p_withdrawal_reference, 'SUCCEEDED', NULL, v_ref);
  IF COALESCE((r->>'success')::boolean, false) IS NOT TRUE THEN
    RETURN r;
  END IF;

  UPDATE public.withdrawal_requests
  SET reviewed_by = v_uid, reviewed_at = NOW(), manual_reference = v_ref,
      review_note = NULLIF(btrim(COALESCE(p_note, '')), ''), provider = 'manual'
  WHERE id = v_wd.id;

  RETURN jsonb_build_object('success', true, 'status', 'SUCCEEDED', 'withdrawal_reference', p_withdrawal_reference);
END $$;
REVOKE ALL ON FUNCTION public.founder_approve_withdrawal(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.founder_approve_withdrawal(TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 6. Rejeter : rien n'a été versé, le montant retourne au solde disponible
CREATE OR REPLACE FUNCTION public.founder_reject_withdrawal(
  p_withdrawal_reference TEXT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := public._assert_withdrawal_reviewer();
  v_wd public.withdrawal_requests;
  v_reason TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  r JSONB;
BEGIN
  IF v_reason IS NULL OR length(v_reason) < 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Indiquez le motif du rejet (3 caractères minimum).');
  END IF;

  SELECT * INTO v_wd FROM public.withdrawal_requests WHERE withdrawal_reference = p_withdrawal_reference FOR UPDATE;
  IF v_wd.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Retrait introuvable.');
  END IF;
  IF v_wd.status NOT IN ('REQUESTED', 'PROCESSING') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce retrait est déjà clôturé (' || v_wd.status || ').');
  END IF;

  r := public.finalize_withdrawal(p_withdrawal_reference, 'FAILED', v_reason, NULL);
  IF COALESCE((r->>'success')::boolean, false) IS NOT TRUE THEN
    RETURN r;
  END IF;

  UPDATE public.withdrawal_requests
  SET reviewed_by = v_uid, reviewed_at = NOW(), review_note = v_reason
  WHERE id = v_wd.id;

  RETURN jsonb_build_object('success', true, 'status', 'FAILED', 'withdrawal_reference', p_withdrawal_reference,
                            'available_balance', r->'available_balance');
END $$;
REVOKE ALL ON FUNCTION public.founder_reject_withdrawal(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.founder_reject_withdrawal(TEXT, TEXT) TO authenticated, service_role;
