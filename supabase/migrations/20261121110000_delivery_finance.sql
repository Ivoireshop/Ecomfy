-- Livraison réseau — gestion financière de l'administration (cahier §11.3).
--
-- Lecture seule : aucune table nouvelle, aucune écriture. Les montants viennent de `delivery_company_payments`
-- (cotisations, cautions, abonnements Premium), jamais additionnés entre devises : chaque total est donné par devise.
--
--  * « Encaissé » = paiement confirmé (ou confirmé puis restitué, pour une caution) dont la décision tombe dans la période.
--  * « Renouvellement » = paiement de cotisation ou de Premium confirmé alors qu'un paiement confirmé plus ancien existe
--    pour la même structure et la même nature.
--  * « Caution détenue » = cautions confirmées non restituées, à l'instant de la lecture (indépendant de la période).
--  * « En attente » = paiements déclarés non encore traités, à l'instant de la lecture.
--  * « Restitué » = cautions restituées dans la période (date de restitution).
--
-- Prérequis : 20261121100000 (Premium) et 20261120120000 (cotisation, caution).

CREATE OR REPLACE FUNCTION public.delivery_admin_finance_summary(_from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from timestamptz := _from;
  v_to timestamptz := COALESCE(_to, now());
  v_result jsonb;
BEGIN
  PERFORM public.delivery_assert_admin();
  IF v_from IS NOT NULL AND v_from > v_to THEN
    RAISE EXCEPTION 'Période invalide : le début est après la fin.' USING ERRCODE = '22023';
  END IF;

  WITH base AS (
    SELECT p.*, c.company_name,
           -- Rang parmi les paiements confirmés (ou restitués) de la même structure et de la même nature.
           CASE WHEN p.status IN ('confirmed', 'refunded')
                THEN row_number() OVER (PARTITION BY p.company_id, p.kind, (p.status IN ('confirmed', 'refunded'))
                                        ORDER BY p.decided_at, p.created_at, p.id) END AS rank_in_kind
      FROM public.delivery_company_payments p
      JOIN public.delivery_companies c ON c.id = p.company_id
  ), collected AS (
    SELECT * FROM base
     WHERE status IN ('confirmed', 'refunded')
       AND (v_from IS NULL OR decided_at >= v_from) AND decided_at <= v_to
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object('from', v_from, 'to', v_to),
    'collected', COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', kind, 'currency', currency, 'amount', amt, 'count', n)
                                            ORDER BY kind, currency)
                             FROM (SELECT kind, currency, trim_scale(sum(amount)) AS amt, count(*) AS n FROM collected GROUP BY kind, currency) t), '[]'::jsonb),
    'renewals', COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', kind, 'currency', currency, 'amount', amt, 'count', n)
                                           ORDER BY kind, currency)
                            FROM (SELECT kind, currency, trim_scale(sum(amount)) AS amt, count(*) AS n FROM collected
                                   WHERE kind IN ('membership', 'premium') AND rank_in_kind > 1 GROUP BY kind, currency) t), '[]'::jsonb),
    'refunded', COALESCE((SELECT jsonb_agg(jsonb_build_object('currency', currency, 'amount', amt, 'count', n) ORDER BY currency)
                            FROM (SELECT currency, trim_scale(sum(amount)) AS amt, count(*) AS n FROM base
                                   WHERE status = 'refunded' AND (v_from IS NULL OR refunded_at >= v_from) AND refunded_at <= v_to
                                   GROUP BY currency) t), '[]'::jsonb),
    'deposits_held', COALESCE((SELECT jsonb_agg(jsonb_build_object('currency', currency, 'amount', amt, 'count', n) ORDER BY currency)
                                 FROM (SELECT currency, trim_scale(sum(amount)) AS amt, count(*) AS n FROM base
                                        WHERE kind = 'deposit' AND status = 'confirmed' GROUP BY currency) t), '[]'::jsonb),
    'pending', COALESCE((SELECT jsonb_agg(jsonb_build_object('kind', kind, 'currency', currency, 'amount', amt, 'count', n)
                                          ORDER BY kind, currency)
                           FROM (SELECT kind, currency, trim_scale(sum(amount)) AS amt, count(*) AS n FROM base
                                  WHERE status = 'pending' GROUP BY kind, currency) t), '[]'::jsonb),
    'premium_active', (SELECT count(DISTINCT company_id) FROM base
                        WHERE kind = 'premium' AND status = 'confirmed' AND period_start <= now() AND period_end > now()),
    'premium_expiring_30d', (SELECT count(*) FROM (SELECT company_id, max(period_end) AS e FROM base
                                                    WHERE kind = 'premium' AND status = 'confirmed' GROUP BY company_id) t
                              WHERE e > now() AND e <= now() + interval '30 days'),
    'membership_expiring_30d', (SELECT count(*) FROM (SELECT company_id, max(period_end) AS e FROM base
                                                       WHERE kind = 'membership' AND status = 'confirmed' AND period_end IS NOT NULL
                                                       GROUP BY company_id) t
                                 WHERE e > now() AND e <= now() + interval '30 days'),
    'by_company', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'company_id', company_id, 'company_name', company_name, 'currency', currency,
               'membership', membership, 'deposit_held', deposit_held, 'deposit_refunded', deposit_refunded,
               'premium', premium, 'pending', pending, 'last_payment_at', last_payment_at)
             ORDER BY company_name, currency)
        FROM (
          SELECT b.company_id, b.company_name, b.currency,
                 trim_scale(COALESCE(sum(b.amount) FILTER (WHERE b.kind = 'membership' AND b.status IN ('confirmed', 'refunded')
                            AND (v_from IS NULL OR b.decided_at >= v_from) AND b.decided_at <= v_to), 0)) AS membership,
                 trim_scale(COALESCE(sum(b.amount) FILTER (WHERE b.kind = 'deposit' AND b.status = 'confirmed'), 0)) AS deposit_held,
                 trim_scale(COALESCE(sum(b.amount) FILTER (WHERE b.kind = 'deposit' AND b.status = 'refunded'
                            AND (v_from IS NULL OR b.refunded_at >= v_from) AND b.refunded_at <= v_to), 0)) AS deposit_refunded,
                 trim_scale(COALESCE(sum(b.amount) FILTER (WHERE b.kind = 'premium' AND b.status IN ('confirmed', 'refunded')
                            AND (v_from IS NULL OR b.decided_at >= v_from) AND b.decided_at <= v_to), 0)) AS premium,
                 trim_scale(COALESCE(sum(b.amount) FILTER (WHERE b.status = 'pending'), 0)) AS pending,
                 max(b.decided_at) FILTER (WHERE b.status IN ('confirmed', 'refunded')) AS last_payment_at
            FROM base b
           GROUP BY b.company_id, b.company_name, b.currency
        ) s), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_finance_summary(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_finance_summary(timestamptz, timestamptz) TO authenticated, service_role;

-- Historique financier complet d'une structure (toutes natures, tous statuts, restitutions comprises).
CREATE OR REPLACE FUNCTION public.delivery_admin_company_finance(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.delivery_companies%ROWTYPE;
BEGIN
  PERFORM public.delivery_assert_admin();
  SELECT * INTO c FROM public.delivery_companies WHERE id = _company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Structure introuvable.' USING ERRCODE = 'P0002'; END IF;

  RETURN jsonb_build_object(
    'company_id', c.id,
    'company_name', c.company_name,
    'city', c.city,
    'profile_type', c.profile_type,
    'verification_status', c.verification_status,
    'fees', CASE WHEN c.profile_type = 'manager' THEN public.delivery_company_fee_state(c.id) END,
    'premium', CASE WHEN c.profile_type = 'manager' THEN public.delivery_premium_state(c.id) END,
    'totals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('kind', kind, 'currency', currency, 'amount', amt, 'count', n) ORDER BY kind, currency)
        FROM (SELECT p.kind, p.currency, trim_scale(sum(p.amount)) AS amt, count(*) AS n
                FROM public.delivery_company_payments p
               WHERE p.company_id = _company_id AND p.status IN ('confirmed', 'refunded')
               GROUP BY p.kind, p.currency) t), '[]'::jsonb),
    'payments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', p.id, 'kind', p.kind, 'plan_label', p.plan_label, 'amount', trim_scale(p.amount), 'currency', p.currency,
               'method', p.method, 'reference', p.reference, 'status', p.status, 'source', p.source,
               'period_start', p.period_start, 'period_end', p.period_end, 'decision_note', p.decision_note,
               'created_at', p.created_at, 'decided_at', p.decided_at, 'refunded_at', p.refunded_at,
               'refund_note', p.refund_note) ORDER BY p.created_at DESC)
        FROM public.delivery_company_payments p WHERE p.company_id = _company_id), '[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_company_finance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_company_finance(uuid) TO authenticated, service_role;
