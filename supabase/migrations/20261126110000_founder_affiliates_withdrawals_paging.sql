-- Pagination côté serveur : affiliés et retraits du tableau de bord fondateur.

-- 1. Liste des affiliés avec leurs totaux, calculés en base.
--    SECURITY INVOKER : les politiques RLS des tables d'affiliation s'appliquent à l'appelant.
CREATE OR REPLACE FUNCTION public.founder_affiliate_list(
  _period text    DEFAULT NULL,
  _query  text    DEFAULT NULL,
  _limit  integer DEFAULT 25,
  _offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH people AS (
    -- first_name / last_name n'existent pas sur toutes les bases (absentes de la dev) : lecture via jsonb.
    SELECT p.id, p.email, p.full_name,
           btrim(coalesce(to_jsonb(p) ->> 'first_name', '') || ' ' || coalesce(to_jsonb(p) ->> 'last_name', '')) AS split_name
    FROM public.profiles p
    WHERE p.id IN (SELECT user_id FROM public.affiliates)
  ),
  matching AS (
    SELECT a.id, a.created_at, to_jsonb(a) AS affiliate, a.status, p.email AS user_email,
           coalesce(
             nullif(p.full_name, ''),
             nullif(p.split_name, ''),
             nullif(p.email, ''),
             'Utilisateur') AS user_name
    FROM public.affiliates a
    LEFT JOIN people p ON p.id = a.user_id
    WHERE coalesce(btrim(_query), '') = ''
       OR strpos(lower(a.affiliate_code), lower(btrim(_query))) > 0
       OR strpos(lower(coalesce(p.email, '')), lower(btrim(_query))) > 0
       OR strpos(lower(coalesce(p.full_name, '')), lower(btrim(_query))) > 0
       OR strpos(lower(coalesce(p.split_name, '')), lower(btrim(_query))) > 0
  ),
  page AS (
    SELECT * FROM matching
    ORDER BY created_at DESC, id DESC
    LIMIT least(greatest(coalesce(_limit, 25), 1), 100)
    OFFSET greatest(coalesce(_offset, 0), 0)
  ),
  detailed AS (
    SELECT page.created_at, page.id,
           jsonb_build_object(
             'affiliate', page.affiliate,
             'user_email', page.user_email,
             'user_name', page.user_name,
             'status', page.status,
             'payout_method', (SELECT to_jsonb(m) FROM public.affiliate_payout_methods m WHERE m.affiliate_id = page.id),
             'referred_count', (SELECT count(*) FROM public.affiliate_referrals r WHERE r.affiliate_id = page.id),
             'subscriptions_count', c.nb,
             'total_earned', c.payable + c.paid,
             'payable_amount', c.payable,
             'paid_amount', c.paid
           ) AS item
    FROM page
    CROSS JOIN LATERAL (
      SELECT count(*) AS nb,
             coalesce(sum(k.commission_amount) FILTER (WHERE k.status IN ('PAYABLE', 'APPROVED')), 0) AS payable,
             coalesce(sum(k.commission_amount) FILTER (WHERE k.status = 'PAID'), 0) AS paid
      FROM public.affiliate_commissions k
      WHERE k.affiliate_id = page.id
        AND (coalesce(_period, '') IN ('', 'ALL') OR k.period_code = _period)
    ) c
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM matching),
    'rows', coalesce((SELECT jsonb_agg(item ORDER BY created_at DESC, id DESC) FROM detailed), '[]'::jsonb)
  )
  WHERE public.is_founder_or_master();
$$;

REVOKE ALL ON FUNCTION public.founder_affiliate_list(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.founder_affiliate_list(text, text, integer, integer) TO authenticated;

-- 2. Totaux de l'affiliation : additionnés en base, une lecture directe s'arrêtant à 1 000 lignes.
CREATE OR REPLACE FUNCTION public.founder_affiliate_overview(_period text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH c AS (
    SELECT count(*) AS nb,
           coalesce(sum(commission_amount) FILTER (WHERE status = 'PENDING'), 0)  AS pending,
           coalesce(sum(commission_amount) FILTER (WHERE status = 'APPROVED'), 0) AS approved,
           coalesce(sum(commission_amount) FILTER (WHERE status = 'PAYABLE'), 0)  AS payable,
           coalesce(sum(commission_amount) FILTER (WHERE status = 'PAID'), 0)     AS paid
    FROM public.affiliate_commissions
    WHERE coalesce(_period, '') IN ('', 'ALL') OR period_code = _period
  ),
  v AS (
    SELECT coalesce(sum(amount_paid), 0) AS paid_out
    FROM public.affiliate_payouts
    WHERE coalesce(_period, '') IN ('', 'ALL') OR period_code = _period
  )
  SELECT jsonb_build_object(
    'totalAffiliates', (SELECT count(*) FROM public.affiliates),
    'activeAffiliates', (SELECT count(*) FROM public.affiliates WHERE status = 'active'),
    'totalReferredUsers', (SELECT count(*) FROM public.affiliate_referrals),
    'totalSubscriptionsCount', c.nb,
    'pendingAmount', c.pending,
    'approvedAmount', c.approved,
    'payableAmount', c.payable + c.approved,
    'paidAmount', coalesce(nullif(v.paid_out, 0), c.paid),
    'totalPaidAmount', coalesce(nullif(v.paid_out, 0), c.paid),
    'remainingPayableAmount', c.payable + c.approved
  )
  FROM c, v
  WHERE public.is_founder_or_master();
$$;

REVOKE ALL ON FUNCTION public.founder_affiliate_overview(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.founder_affiliate_overview(text) TO authenticated;

-- 3. File des retraits : décalage, total de la vue et nombre de demandes à valider.
--    L'ancienne signature est retirée ; l'ancien front (p_status, p_limit) appelle la nouvelle sans changement.
DROP FUNCTION IF EXISTS public.founder_list_withdrawals(TEXT, INT);

CREATE OR REPLACE FUNCTION public.founder_list_withdrawals(
  p_status TEXT DEFAULT NULL,
  p_limit  INT  DEFAULT 200,
  p_offset INT  DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_rows JSONB;
BEGIN
  PERFORM public._assert_withdrawal_reviewer();

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC, x.id DESC), '[]'::jsonb) INTO v_rows
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
    ORDER BY w.created_at DESC, w.id DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  ) x;

  RETURN jsonb_build_object(
    'success', true,
    'withdrawals', v_rows,
    'total', (SELECT count(*) FROM public.withdrawal_requests WHERE p_status IS NULL OR status = p_status),
    'pending_count', (SELECT count(*) FROM public.withdrawal_requests WHERE status = 'REQUESTED')
  );
END $$;

REVOKE ALL ON FUNCTION public.founder_list_withdrawals(TEXT, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.founder_list_withdrawals(TEXT, INT, INT) TO authenticated, service_role;
