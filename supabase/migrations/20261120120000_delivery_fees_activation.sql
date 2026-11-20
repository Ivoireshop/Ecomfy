-- Livraison réseau — cotisation et caution des structures (cahier §4.1).
--
-- Principes :
--  * Les montants, la périodicité et les conditions de restitution relèvent de la direction : tout est RÉGLABLE par
--    l'administration (réglages « delivery_settings »). Aucun montant n'est imposé ici.
--  * La règle d'activation (« une structure doit être à jour pour recevoir des commandes ») est DÉSACTIVÉE par défaut
--    (`require_company_activation` = false) : rien ne change tant que la direction ne l'a pas activée.
--  * Paiement manuel déclaré puis contrôlé : la structure déclare un paiement (mode, référence), l'administration le
--    confirme ou le rejette. L'administration peut aussi enregistrer un paiement reçu hors ligne. Le montant d'un
--    paiement déclaré est celui du barème au moment de la déclaration (le client ne le choisit pas).
--  * Seules les STRUCTURES (profile_type = 'manager') sont concernées ; les livreurs indépendants ne le sont pas.
--  * L'abonnement Premium (§4.2) est distinct et n'est pas traité ici.
--
-- Prérequis : 20261120110000 (delivery_settings, aides d'administration, journal et notifications).

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_company_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.delivery_companies(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('membership', 'deposit')),
  amount numeric(14, 2) NOT NULL CHECK (amount > 0 AND amount <= 100000000),
  currency text NOT NULL DEFAULT 'XOF',
  method text NOT NULL CHECK (char_length(method) BETWEEN 2 AND 60),
  reference text CHECK (reference IS NULL OR char_length(reference) <= 120),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'refunded')),
  source text NOT NULL DEFAULT 'declared' CHECK (source IN ('declared', 'admin')),
  period_start timestamptz,
  period_end timestamptz,                 -- cotisation : fin de validité ; NULL = sans échéance
  declared_by uuid,
  decided_by uuid,
  decided_at timestamptz,
  decision_note text CHECK (decision_note IS NULL OR char_length(decision_note) <= 500),
  refunded_at timestamptz,
  refunded_by uuid,
  refund_note text CHECK (refund_note IS NULL OR char_length(refund_note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_company_payments_company ON public.delivery_company_payments (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_company_payments_status ON public.delivery_company_payments (status, created_at);
-- Une seule déclaration en attente par structure et par nature : on ne multiplie pas les demandes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_company_payments_one_pending
  ON public.delivery_company_payments (company_id, kind) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.delivery_company_activation (
  company_id uuid PRIMARY KEY REFERENCES public.delivery_companies(id) ON DELETE CASCADE,
  suspended boolean NOT NULL DEFAULT false,
  suspended_reason text CHECK (suspended_reason IS NULL OR char_length(suspended_reason) <= 500),
  waived boolean NOT NULL DEFAULT false,   -- dispensée de cotisation / caution par décision de l'administration
  waived_reason text CHECK (waived_reason IS NULL OR char_length(waived_reason) <= 500),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_company_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_company_activation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_company_payments, public.delivery_company_activation FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.delivery_company_payments, public.delivery_company_activation TO authenticated;
GRANT ALL ON public.delivery_company_payments, public.delivery_company_activation TO service_role;

DROP POLICY IF EXISTS "Company payments owner or admin read" ON public.delivery_company_payments;
CREATE POLICY "Company payments owner or admin read" ON public.delivery_company_payments
  FOR SELECT TO authenticated
  USING (public.delivery_is_platform_admin()
         OR EXISTS (SELECT 1 FROM public.delivery_companies c WHERE c.id = company_id AND c.user_id = auth.uid()));
DROP POLICY IF EXISTS "Company activation owner or admin read" ON public.delivery_company_activation;
CREATE POLICY "Company activation owner or admin read" ON public.delivery_company_activation
  FOR SELECT TO authenticated
  USING (public.delivery_is_platform_admin()
         OR EXISTS (SELECT 1 FROM public.delivery_companies c WHERE c.id = company_id AND c.user_id = auth.uid()));

-- Réglages par défaut (aucun montant imposé, règle désactivée).
INSERT INTO public.delivery_settings (key, value) VALUES
  ('require_company_activation', 'false'::jsonb),
  ('membership_fee', '{"amount":0,"currency":"XOF","period_months":12}'::jsonb),
  ('deposit_fee', '{"amount":0,"currency":"XOF"}'::jsonb),
  ('deposit_refund_policy', '""'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Calcul de l'état d'une structure (interne)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_fee_setting_amount(_key text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT NULLIF(s.value ->> 'amount', '')::numeric FROM public.delivery_settings s WHERE s.key = _key), 0);
$$;
REVOKE ALL ON FUNCTION public.delivery_fee_setting_amount(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delivery_company_fee_state(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.delivery_companies%ROWTYPE;
  act public.delivery_company_activation%ROWTYPE;
  v_required boolean;
  v_mem_amount numeric := public.delivery_fee_setting_amount('membership_fee');
  v_dep_amount numeric := public.delivery_fee_setting_amount('deposit_fee');
  v_mem_until timestamptz;
  v_mem_has boolean;
  v_mem_forever boolean;
  v_mem_ok boolean;
  v_dep_held boolean;
  v_dep_ok boolean;
  v_mem_pending boolean;
  v_dep_pending boolean;
  v_state text;
BEGIN
  SELECT * INTO c FROM public.delivery_companies WHERE id = _company_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO act FROM public.delivery_company_activation WHERE company_id = _company_id;
  v_required := COALESCE((SELECT s.value = 'true'::jsonb FROM public.delivery_settings s WHERE s.key = 'require_company_activation'), false);

  SELECT bool_or(p.period_end IS NULL), max(p.period_end), count(*) > 0
    INTO v_mem_forever, v_mem_until, v_mem_has
    FROM public.delivery_company_payments p
   WHERE p.company_id = _company_id AND p.kind = 'membership' AND p.status = 'confirmed';
  v_mem_ok := v_mem_has AND (COALESCE(v_mem_forever, false) OR v_mem_until > now());
  v_dep_held := EXISTS (SELECT 1 FROM public.delivery_company_payments p
                         WHERE p.company_id = _company_id AND p.kind = 'deposit' AND p.status = 'confirmed');
  v_mem_pending := EXISTS (SELECT 1 FROM public.delivery_company_payments p WHERE p.company_id = _company_id AND p.kind = 'membership' AND p.status = 'pending');
  v_dep_pending := EXISTS (SELECT 1 FROM public.delivery_company_payments p WHERE p.company_id = _company_id AND p.kind = 'deposit' AND p.status = 'pending');

  v_mem_ok := v_mem_ok OR v_mem_amount <= 0;
  v_dep_ok := v_dep_held OR v_dep_amount <= 0;

  IF c.profile_type IS DISTINCT FROM 'manager' THEN
    v_state := 'not_applicable';
  ELSIF COALESCE(act.suspended, false) THEN
    v_state := 'suspended';
  ELSIF COALESCE(act.waived, false) THEN
    v_state := 'waived';
  ELSIF v_mem_ok AND v_dep_ok THEN
    v_state := 'active';
  ELSIF v_mem_pending OR v_dep_pending THEN
    v_state := 'payment_review';
  ELSIF v_mem_has AND NOT v_mem_ok THEN
    v_state := 'expired';
  ELSE
    v_state := 'payment_due';
  END IF;

  RETURN jsonb_build_object(
    'company_id', _company_id,
    'applicable', c.profile_type = 'manager',
    'enforced', v_required,
    'state', v_state,
    -- Peut recevoir des commandes : jamais bloquée si la règle n'est pas activée ; suspendue = jamais.
    'operational', CASE WHEN c.profile_type IS DISTINCT FROM 'manager' THEN true
                        WHEN COALESCE(act.suspended, false) THEN false
                        WHEN NOT v_required THEN true
                        ELSE v_state IN ('active', 'waived') END,
    'suspended', COALESCE(act.suspended, false),
    'suspended_reason', act.suspended_reason,
    'waived', COALESCE(act.waived, false),
    'membership', jsonb_build_object(
      'amount', v_mem_amount, 'currency', COALESCE((SELECT s.value ->> 'currency' FROM public.delivery_settings s WHERE s.key = 'membership_fee'), 'XOF'),
      'period_months', (SELECT NULLIF(s.value ->> 'period_months', '')::int FROM public.delivery_settings s WHERE s.key = 'membership_fee'),
      'ok', v_mem_ok, 'paid_until', CASE WHEN COALESCE(v_mem_forever, false) THEN NULL ELSE v_mem_until END,
      'no_expiry', COALESCE(v_mem_forever, false), 'pending', v_mem_pending),
    'deposit', jsonb_build_object(
      'amount', v_dep_amount, 'currency', COALESCE((SELECT s.value ->> 'currency' FROM public.delivery_settings s WHERE s.key = 'deposit_fee'), 'XOF'),
      'ok', v_dep_ok, 'held', v_dep_held, 'pending', v_dep_pending,
      'policy', (SELECT s.value #>> '{}' FROM public.delivery_settings s WHERE s.key = 'deposit_refund_policy'))
  );
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_company_fee_state(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delivery_company_is_operational(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((public.delivery_company_fee_state(_company_id) ->> 'operational')::boolean, true);
$$;
REVOKE ALL ON FUNCTION public.delivery_company_is_operational(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_company_is_operational(uuid) TO service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Côté structure : voir ses frais, déclarer un paiement
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_company_fees(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501'; END IF;
  IF NOT (public.delivery_is_platform_admin()
          OR EXISTS (SELECT 1 FROM public.delivery_companies c WHERE c.id = _company_id AND c.user_id = auth.uid())) THEN
    RAISE EXCEPTION 'Structure introuvable ou accès refusé.' USING ERRCODE = '42501';
  END IF;
  RETURN public.delivery_company_fee_state(_company_id) || jsonb_build_object(
    'payments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'kind', p.kind, 'amount', p.amount, 'currency', p.currency, 'method', p.method,
        'reference', p.reference, 'status', p.status, 'source', p.source, 'period_end', p.period_end,
        'decision_note', p.decision_note, 'created_at', p.created_at, 'decided_at', p.decided_at,
        'refunded_at', p.refunded_at) ORDER BY p.created_at DESC)
      FROM public.delivery_company_payments p WHERE p.company_id = _company_id), '[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_company_fees(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_company_fees(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delivery_company_declare_payment(
  _company_id uuid, _kind text, _method text, _reference text DEFAULT NULL, _note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.delivery_companies%ROWTYPE;
  v_amount numeric;
  v_currency text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM public.delivery_companies WHERE id = _company_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Structure introuvable ou accès refusé.' USING ERRCODE = '42501'; END IF;
  IF c.profile_type IS DISTINCT FROM 'manager' THEN
    RAISE EXCEPTION 'Les livreurs indépendants ne sont pas concernés.' USING ERRCODE = '22023';
  END IF;
  IF _kind NOT IN ('membership', 'deposit') THEN RAISE EXCEPTION 'Nature de paiement invalide.' USING ERRCODE = '22023'; END IF;
  IF char_length(trim(COALESCE(_method, ''))) < 2 THEN RAISE EXCEPTION 'Indiquez le mode de paiement.' USING ERRCODE = '22023'; END IF;
  IF char_length(COALESCE(_reference, '')) > 120 OR char_length(COALESCE(_note, '')) > 500 THEN
    RAISE EXCEPTION 'Référence ou note trop longue.' USING ERRCODE = '22023';
  END IF;

  v_amount := public.delivery_fee_setting_amount(CASE WHEN _kind = 'membership' THEN 'membership_fee' ELSE 'deposit_fee' END);
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Aucun montant n''est exigé pour cette nature de paiement.' USING ERRCODE = '22023'; END IF;
  IF _kind = 'deposit' AND EXISTS (SELECT 1 FROM public.delivery_company_payments p
                                    WHERE p.company_id = _company_id AND p.kind = 'deposit' AND p.status = 'confirmed') THEN
    RAISE EXCEPTION 'La caution est déjà versée.' USING ERRCODE = '23505';
  END IF;
  v_currency := COALESCE((SELECT s.value ->> 'currency' FROM public.delivery_settings s
                           WHERE s.key = CASE WHEN _kind = 'membership' THEN 'membership_fee' ELSE 'deposit_fee' END), 'XOF');

  BEGIN
    INSERT INTO public.delivery_company_payments (company_id, kind, amount, currency, method, reference, note, declared_by)
    VALUES (_company_id, _kind, v_amount, v_currency, trim(_method), NULLIF(trim(COALESCE(_reference, '')), ''),
            NULLIF(trim(COALESCE(_note, '')), ''), auth.uid())
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Un paiement de ce type est déjà en attente de contrôle.' USING ERRCODE = '23505';
  END;

  PERFORM public.delivery_visit_audit(_company_id, 'fee_declared', 'owner', 'owner',
    jsonb_build_object('kind', _kind, 'amount', v_amount, 'payment_id', v_id));
  PERFORM public.delivery_notify_admins_to(_company_id, 'fee_declared', 'info', 'Paiement à contrôler',
    c.company_name || ' déclare un paiement (' || CASE WHEN _kind = 'membership' THEN 'cotisation' ELSE 'caution' END || ').',
    '/delivery-admin/fees');
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_company_declare_payment(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_company_declare_payment(uuid, text, text, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Côté administration
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_admin_fee_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.delivery_assert_admin();
  RETURN jsonb_build_object(
    'require_company_activation', COALESCE((SELECT s.value = 'true'::jsonb FROM public.delivery_settings s WHERE s.key = 'require_company_activation'), false),
    'membership_fee', COALESCE((SELECT s.value FROM public.delivery_settings s WHERE s.key = 'membership_fee'), '{}'::jsonb),
    'deposit_fee', COALESCE((SELECT s.value FROM public.delivery_settings s WHERE s.key = 'deposit_fee'), '{}'::jsonb),
    'deposit_refund_policy', COALESCE((SELECT s.value #>> '{}' FROM public.delivery_settings s WHERE s.key = 'deposit_refund_policy'), ''));
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_fee_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_fee_settings() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delivery_admin_set_fee_settings(
  _membership_amount numeric, _membership_period_months int, _deposit_amount numeric, _currency text,
  _refund_policy text, _require_activation boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cur text := upper(COALESCE(NULLIF(trim(_currency), ''), 'XOF'));
BEGIN
  PERFORM public.delivery_assert_admin();
  IF _membership_amount IS NULL OR _membership_amount < 0 OR _membership_amount > 100000000
     OR _deposit_amount IS NULL OR _deposit_amount < 0 OR _deposit_amount > 100000000 THEN
    RAISE EXCEPTION 'Montant invalide.' USING ERRCODE = '22023';
  END IF;
  -- 0 = cotisation sans échéance (payée une fois).
  IF _membership_period_months IS NULL OR _membership_period_months < 0 OR _membership_period_months > 120 THEN
    RAISE EXCEPTION 'Périodicité invalide (0 à 120 mois ; 0 = sans échéance).' USING ERRCODE = '22023';
  END IF;
  IF v_cur !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Devise invalide.' USING ERRCODE = '22023'; END IF;
  IF char_length(COALESCE(_refund_policy, '')) > 1500 THEN RAISE EXCEPTION 'Conditions de restitution trop longues.' USING ERRCODE = '22023'; END IF;
  IF _require_activation IS NULL THEN RAISE EXCEPTION 'Valeur requise.' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.delivery_settings (key, value, updated_by) VALUES
    ('membership_fee', jsonb_build_object('amount', _membership_amount, 'currency', v_cur, 'period_months', _membership_period_months), auth.uid()),
    ('deposit_fee', jsonb_build_object('amount', _deposit_amount, 'currency', v_cur), auth.uid()),
    ('deposit_refund_policy', to_jsonb(COALESCE(_refund_policy, '')), auth.uid()),
    ('require_company_activation', to_jsonb(_require_activation), auth.uid())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = auth.uid(), updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_set_fee_settings(numeric, int, numeric, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_set_fee_settings(numeric, int, numeric, text, text, boolean) TO authenticated, service_role;

-- Prolonge la cotisation : à partir de la fin en cours si elle est encore valide, sinon à partir de maintenant.
CREATE OR REPLACE FUNCTION public.delivery_fee_confirm_row(_payment_id uuid, _note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.delivery_company_payments%ROWTYPE;
  v_months int;
  v_base timestamptz;
  v_current timestamptz;
BEGIN
  SELECT * INTO p FROM public.delivery_company_payments WHERE id = _payment_id FOR UPDATE;
  IF p.kind = 'membership' THEN
    v_months := COALESCE((SELECT NULLIF(s.value ->> 'period_months', '')::int FROM public.delivery_settings s WHERE s.key = 'membership_fee'), 12);
    SELECT max(q.period_end) INTO v_current FROM public.delivery_company_payments q
     WHERE q.company_id = p.company_id AND q.kind = 'membership' AND q.status = 'confirmed' AND q.id <> p.id;
    v_base := GREATEST(COALESCE(v_current, now()), now());
    UPDATE public.delivery_company_payments
       SET status = 'confirmed', decided_by = auth.uid(), decided_at = now(), decision_note = NULLIF(trim(COALESCE(_note, '')), ''),
           period_start = v_base,
           period_end = CASE WHEN v_months = 0 THEN NULL ELSE v_base + make_interval(months => v_months) END
     WHERE id = _payment_id;
  ELSE
    UPDATE public.delivery_company_payments
       SET status = 'confirmed', decided_by = auth.uid(), decided_at = now(), decision_note = NULLIF(trim(COALESCE(_note, '')), '')
     WHERE id = _payment_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_fee_confirm_row(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delivery_admin_decide_payment(_payment_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.delivery_company_payments%ROWTYPE;
  c public.delivery_companies%ROWTYPE;
BEGIN
  PERFORM public.delivery_assert_admin();
  IF _approve IS NULL THEN RAISE EXCEPTION 'Décision requise.' USING ERRCODE = '22023'; END IF;
  SELECT * INTO p FROM public.delivery_company_payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paiement introuvable.' USING ERRCODE = 'P0002'; END IF;
  IF p.status <> 'pending' THEN RAISE EXCEPTION 'Ce paiement a déjà été traité.' USING ERRCODE = '22023'; END IF;
  IF NOT _approve AND char_length(trim(COALESCE(_note, ''))) < 5 THEN
    RAISE EXCEPTION 'Indiquez le motif du rejet (5 caractères minimum).' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO c FROM public.delivery_companies WHERE id = p.company_id;

  IF _approve THEN
    PERFORM public.delivery_fee_confirm_row(_payment_id, _note);
  ELSE
    UPDATE public.delivery_company_payments
       SET status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_note = trim(_note)
     WHERE id = _payment_id;
  END IF;

  PERFORM public.delivery_visit_audit(p.company_id, CASE WHEN _approve THEN 'fee_confirmed' ELSE 'fee_rejected' END, 'owner', 'admin',
    jsonb_build_object('kind', p.kind, 'amount', p.amount, 'payment_id', p.id));
  PERFORM public.delivery_notify(c.user_id, p.company_id, NULL,
    CASE WHEN _approve THEN 'fee_confirmed' ELSE 'fee_rejected' END,
    CASE WHEN _approve THEN 'success' ELSE 'warning' END,
    CASE WHEN _approve THEN 'Paiement confirmé' ELSE 'Paiement rejeté' END,
    CASE WHEN _approve THEN 'Votre ' || CASE WHEN p.kind = 'membership' THEN 'cotisation' ELSE 'caution' END || ' est confirmée.'
         ELSE 'Votre paiement n''a pas été retenu : ' || trim(_note) END,
    '/delivery/fees');
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_decide_payment(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_decide_payment(uuid, boolean, text) TO authenticated, service_role;

-- Paiement reçu hors ligne, enregistré directement par l'administration (confirmé tout de suite).
CREATE OR REPLACE FUNCTION public.delivery_admin_record_payment(
  _company_id uuid, _kind text, _amount numeric, _method text, _reference text DEFAULT NULL, _note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.delivery_companies%ROWTYPE;
  v_id uuid;
  v_currency text;
BEGIN
  PERFORM public.delivery_assert_admin();
  SELECT * INTO c FROM public.delivery_companies WHERE id = _company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Structure introuvable.' USING ERRCODE = 'P0002'; END IF;
  IF c.profile_type IS DISTINCT FROM 'manager' THEN RAISE EXCEPTION 'Les livreurs indépendants ne sont pas concernés.' USING ERRCODE = '22023'; END IF;
  IF _kind NOT IN ('membership', 'deposit') THEN RAISE EXCEPTION 'Nature de paiement invalide.' USING ERRCODE = '22023'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 100000000 THEN RAISE EXCEPTION 'Montant invalide.' USING ERRCODE = '22023'; END IF;
  IF char_length(trim(COALESCE(_method, ''))) < 2 THEN RAISE EXCEPTION 'Indiquez le mode de paiement.' USING ERRCODE = '22023'; END IF;
  IF _kind = 'deposit' AND EXISTS (SELECT 1 FROM public.delivery_company_payments p
                                    WHERE p.company_id = _company_id AND p.kind = 'deposit' AND p.status = 'confirmed') THEN
    RAISE EXCEPTION 'La caution est déjà versée.' USING ERRCODE = '23505';
  END IF;
  v_currency := COALESCE((SELECT s.value ->> 'currency' FROM public.delivery_settings s
                           WHERE s.key = CASE WHEN _kind = 'membership' THEN 'membership_fee' ELSE 'deposit_fee' END), 'XOF');

  -- Un éventuel paiement déclaré en attente de même nature est remplacé par cet enregistrement.
  UPDATE public.delivery_company_payments
     SET status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_note = 'Remplacé par un enregistrement de l''administration.'
   WHERE company_id = _company_id AND kind = _kind AND status = 'pending';

  INSERT INTO public.delivery_company_payments
    (company_id, kind, amount, currency, method, reference, note, status, source, declared_by)
  VALUES (_company_id, _kind, _amount, v_currency, trim(_method), NULLIF(trim(COALESCE(_reference, '')), ''),
          NULLIF(trim(COALESCE(_note, '')), ''), 'pending', 'admin', auth.uid())
  RETURNING id INTO v_id;
  PERFORM public.delivery_fee_confirm_row(v_id, _note);

  PERFORM public.delivery_visit_audit(_company_id, 'fee_confirmed', 'owner', 'admin',
    jsonb_build_object('kind', _kind, 'amount', _amount, 'payment_id', v_id, 'recorded_by_admin', true));
  PERFORM public.delivery_notify(c.user_id, _company_id, NULL, 'fee_confirmed', 'success', 'Paiement enregistré',
    'Votre ' || CASE WHEN _kind = 'membership' THEN 'cotisation' ELSE 'caution' END || ' est enregistrée.', '/delivery/fees');
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_record_payment(uuid, text, numeric, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_record_payment(uuid, text, numeric, text, text, text) TO authenticated, service_role;

-- Restitution de la caution (les conditions sont décidées par la direction ; ici l'administration constate la restitution).
CREATE OR REPLACE FUNCTION public.delivery_admin_refund_deposit(_company_id uuid, _note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.delivery_company_payments%ROWTYPE;
  c public.delivery_companies%ROWTYPE;
BEGIN
  PERFORM public.delivery_assert_admin();
  IF char_length(trim(COALESCE(_note, ''))) < 5 THEN
    RAISE EXCEPTION 'Indiquez les modalités de la restitution (5 caractères minimum).' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO p FROM public.delivery_company_payments
   WHERE company_id = _company_id AND kind = 'deposit' AND status = 'confirmed' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Aucune caution à restituer.' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO c FROM public.delivery_companies WHERE id = _company_id;

  UPDATE public.delivery_company_payments
     SET status = 'refunded', refunded_at = now(), refunded_by = auth.uid(), refund_note = trim(_note)
   WHERE id = p.id;
  PERFORM public.delivery_visit_audit(_company_id, 'deposit_refunded', 'owner', 'admin',
    jsonb_build_object('amount', p.amount, 'payment_id', p.id));
  PERFORM public.delivery_notify(c.user_id, _company_id, NULL, 'deposit_refunded', 'info', 'Caution restituée',
    'Votre caution a été restituée : ' || trim(_note), '/delivery/fees');
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_refund_deposit(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_refund_deposit(uuid, text) TO authenticated, service_role;

-- Suspension / dispense, indépendantes du paiement.
CREATE OR REPLACE FUNCTION public.delivery_admin_set_activation(_company_id uuid, _suspended boolean, _waived boolean, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.delivery_companies%ROWTYPE;
BEGIN
  PERFORM public.delivery_assert_admin();
  IF _suspended IS NULL OR _waived IS NULL THEN RAISE EXCEPTION 'Valeurs requises.' USING ERRCODE = '22023'; END IF;
  IF (_suspended OR _waived) AND char_length(trim(COALESCE(_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Indiquez le motif (5 caractères minimum).' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO c FROM public.delivery_companies WHERE id = _company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Structure introuvable.' USING ERRCODE = 'P0002'; END IF;
  IF c.profile_type IS DISTINCT FROM 'manager' THEN RAISE EXCEPTION 'Les livreurs indépendants ne sont pas concernés.' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.delivery_company_activation (company_id, suspended, suspended_reason, waived, waived_reason, updated_by)
  VALUES (_company_id, _suspended, CASE WHEN _suspended THEN trim(_reason) END, _waived, CASE WHEN _waived THEN trim(_reason) END, auth.uid())
  ON CONFLICT (company_id) DO UPDATE
    SET suspended = EXCLUDED.suspended, suspended_reason = EXCLUDED.suspended_reason,
        waived = EXCLUDED.waived, waived_reason = EXCLUDED.waived_reason, updated_by = auth.uid(), updated_at = now();

  PERFORM public.delivery_visit_audit(_company_id, CASE WHEN _suspended THEN 'access_suspended' ELSE 'access_restored' END, 'owner', 'admin',
    jsonb_build_object('suspended', _suspended, 'waived', _waived));
  PERFORM public.delivery_notify(c.user_id, _company_id, NULL, CASE WHEN _suspended THEN 'access_suspended' ELSE 'access_restored' END,
    CASE WHEN _suspended THEN 'warning' ELSE 'success' END,
    CASE WHEN _suspended THEN 'Accès opérationnel suspendu' ELSE 'Accès opérationnel rétabli' END,
    CASE WHEN _suspended THEN 'Vous ne recevez plus de nouvelles commandes : ' || trim(_reason) ELSE 'Vous pouvez de nouveau recevoir des commandes.' END,
    '/delivery/fees');
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_set_activation(uuid, boolean, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_set_activation(uuid, boolean, boolean, text) TO authenticated, service_role;

-- Tableau de contrôle : une ligne par structure + paiements en attente.
CREATE OR REPLACE FUNCTION public.delivery_admin_fee_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.delivery_assert_admin();
  RETURN jsonb_build_object(
    'pending', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'company_id', p.company_id, 'company_name', c.company_name, 'kind', p.kind, 'amount', p.amount,
        'currency', p.currency, 'method', p.method, 'reference', p.reference, 'note', p.note, 'created_at', p.created_at)
        ORDER BY p.created_at)
      FROM public.delivery_company_payments p JOIN public.delivery_companies c ON c.id = p.company_id
      WHERE p.status = 'pending'), '[]'::jsonb),
    'companies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'company_id', c.id, 'company_name', c.company_name, 'city', c.city, 'verification_status', c.verification_status,
        'fees', public.delivery_company_fee_state(c.id)) ORDER BY c.company_name)
      FROM public.delivery_companies c WHERE c.profile_type = 'manager'), '[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_fee_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_fee_overview() TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Accès opérationnel : plus de nouvelle course vers une structure non à jour (si la règle est activée)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_delivery_dispatch_company_operational()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Jobs système et migrations (pas d'utilisateur) : non concernés.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.company_id IS NOT NULL AND NOT public.delivery_company_is_operational(NEW.company_id) THEN
    RAISE EXCEPTION 'Cette structure ne peut pas recevoir de commandes pour le moment (cotisation ou caution à régulariser, ou accès suspendu).'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_delivery_dispatch_company_operational() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_guard_delivery_dispatch_company_operational ON public.delivery_dispatches;
CREATE TRIGGER trg_guard_delivery_dispatch_company_operational
  BEFORE INSERT ON public.delivery_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_dispatch_company_operational();

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Répertoire : une structure qui ne peut pas recevoir de commandes n'est plus proposée aux marchands
--    (même corps que 20261120100000, avec la condition d'accès opérationnel en plus).
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_directory_search(
  _query text DEFAULT NULL,
  _city text DEFAULT NULL,
  _profile_type text DEFAULT NULL,
  _limit integer DEFAULT 24,
  _offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := NULLIF(btrim(COALESCE(_query, '')), '');
  v_city text := NULLIF(btrim(COALESCE(_city, '')), '');
  v_limit int := LEAST(GREATEST(COALESCE(_limit, 24), 1), 60);
  v_offset int := GREATEST(COALESCE(_offset, 0), 0);
  v_total int;
  v_items jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501';
  END IF;
  IF _profile_type IS NOT NULL AND _profile_type NOT IN ('manager', 'driver') THEN
    RAISE EXCEPTION 'Type de prestataire inconnu.' USING ERRCODE = '22023';
  END IF;

  IF v_q IS NOT NULL THEN v_q := '%' || replace(replace(replace(v_q, '\', '\'), '%', '\%'), '_', '\_') || '%'; END IF;
  IF v_city IS NOT NULL THEN v_city := '%' || replace(replace(replace(v_city, '\', '\'), '%', '\%'), '_', '\_') || '%'; END IF;

  WITH matches AS (
    SELECT c.*
      FROM public.delivery_companies c
     WHERE c.verification_status = 'approved'
       AND c.trust_badge_active
       AND public.delivery_company_is_operational(c.id)
       AND (_profile_type IS NULL OR c.profile_type::text = _profile_type)
       AND (v_q IS NULL OR c.company_name ILIKE v_q)
       AND (v_city IS NULL OR c.city ILIKE v_city
            OR EXISTS (SELECT 1 FROM unnest(c.covered_cities) z WHERE z ILIKE v_city))
  ), page AS (
    SELECT m.*
      FROM matches m
     ORDER BY COALESCE(m.rating_score, 0) DESC, m.successful_deliveries_count DESC, m.company_name ASC, m.id ASC
     LIMIT v_limit OFFSET v_offset
  )
  SELECT (SELECT count(*) FROM matches),
         COALESCE((SELECT jsonb_agg(public.delivery_directory_card(p) ORDER BY COALESCE(p.rating_score, 0) DESC,
                                    p.successful_deliveries_count DESC, p.company_name ASC, p.id ASC) FROM page p), '[]'::jsonb)
    INTO v_total, v_items;

  RETURN jsonb_build_object('total', v_total, 'items', v_items);
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_directory_search(text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_directory_search(text, text, text, integer, integer) TO authenticated, service_role;
