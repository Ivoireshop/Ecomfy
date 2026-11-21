-- Livraison réseau — abonnement Premium des structures (cahier §4.2).
--
-- Principes :
--  * Le Premium est DISTINCT de la vérification officielle et de la cotisation : il n'a aucune incidence sur
--    `verification_status`, sur `trust_badge_active` ni sur l'accès opérationnel. Il ne change que la visibilité
--    (classement et badge dans le répertoire). Le paiement ne remplace jamais le contrôle physique : une structure non
--    vérifiée n'apparaît pas dans le répertoire, Premium ou non.
--  * Mêmes mécanismes que la cotisation (§4.1) : la structure DÉCLARE un paiement, l'administration le confirme ou le
--    rejette, ou enregistre un paiement reçu hors ligne. Pas de paiement en ligne.
--  * Les formules (code, libellé, durée, montant, devise) sont RÉGLABLES par l'administration (réglage « premium_plans »).
--    Valeur initiale : une formule « mensuelle » de 3 250 XOF (5 USD au taux de 650 XOF utilisé ailleurs dans l'application). Une liste vide désactive la souscription.
--  * Le montant et la durée sont ceux de la formule au moment de la déclaration (le client ne les choisit pas).
--  * Renouvellement et changement de formule : un nouveau paiement prolonge à partir de la fin de validité en cours
--    (la nouvelle formule prend effet à l'échéance de la précédente). L'expiration est constatée à la lecture.
--  * Seules les STRUCTURES (profile_type = 'manager') sont concernées.
--
-- Prérequis : 20261120120000 (paiements, aides d'administration, répertoire).

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Table des paiements : nature « premium » + formule figée à la déclaration
-- ---------------------------------------------------------------------------------------------------------------
DO $$
DECLARE v_name text;
BEGIN
  FOR v_name IN
    SELECT con.conname FROM pg_constraint con
     WHERE con.conrelid = 'public.delivery_company_payments'::regclass AND con.contype = 'c'
       AND pg_get_constraintdef(con.oid) ILIKE '%kind%membership%deposit%'
  LOOP
    EXECUTE format('ALTER TABLE public.delivery_company_payments DROP CONSTRAINT %I', v_name);
  END LOOP;
END $$;

ALTER TABLE public.delivery_company_payments DROP CONSTRAINT IF EXISTS delivery_company_payments_kind_check;
ALTER TABLE public.delivery_company_payments
  ADD CONSTRAINT delivery_company_payments_kind_check CHECK (kind IN ('membership', 'deposit', 'premium'));

ALTER TABLE public.delivery_company_payments
  ADD COLUMN IF NOT EXISTS plan_code text CHECK (plan_code IS NULL OR char_length(plan_code) <= 30),
  ADD COLUMN IF NOT EXISTS plan_label text CHECK (plan_label IS NULL OR char_length(plan_label) <= 60),
  ADD COLUMN IF NOT EXISTS period_months int CHECK (period_months IS NULL OR period_months BETWEEN 1 AND 120);

-- Réglage par défaut : une formule mensuelle de 3 250 XOF (modifiable).
INSERT INTO public.delivery_settings (key, value) VALUES
  ('premium_plans', '[{"code":"monthly","label":"Premium mensuel","months":1,"amount":3250,"currency":"XOF"}]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Etat Premium (interne)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_premium_plans_list()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT CASE WHEN jsonb_typeof(s.value) = 'array' THEN s.value END
                     FROM public.delivery_settings s WHERE s.key = 'premium_plans'), '[]'::jsonb);
$$;
REVOKE ALL ON FUNCTION public.delivery_premium_plans_list() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delivery_company_is_premium(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.delivery_company_payments p
     WHERE p.company_id = _company_id AND p.kind = 'premium' AND p.status = 'confirmed'
       AND p.period_start <= now() AND p.period_end > now());
$$;
REVOKE ALL ON FUNCTION public.delivery_company_is_premium(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_company_is_premium(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.delivery_premium_state(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.delivery_companies%ROWTYPE;
  v_active boolean;
  v_until timestamptz;
  v_last public.delivery_company_payments%ROWTYPE;
  v_has boolean;
  v_next timestamptz;
BEGIN
  SELECT * INTO c FROM public.delivery_companies WHERE id = _company_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_active := public.delivery_company_is_premium(_company_id);
  SELECT max(p.period_end) INTO v_until FROM public.delivery_company_payments p
   WHERE p.company_id = _company_id AND p.kind = 'premium' AND p.status = 'confirmed';
  v_has := v_until IS NOT NULL;
  -- Formule de la période en cours (ou de la dernière période acquise).
  SELECT * INTO v_last FROM public.delivery_company_payments p
   WHERE p.company_id = _company_id AND p.kind = 'premium' AND p.status = 'confirmed'
   ORDER BY (p.period_start <= now() AND p.period_end > now()) DESC, p.period_end DESC LIMIT 1;
  -- Première période à venir (changement de formule déjà payé mais pas encore commencé).
  SELECT min(p.period_start) INTO v_next FROM public.delivery_company_payments p
   WHERE p.company_id = _company_id AND p.kind = 'premium' AND p.status = 'confirmed' AND p.period_start > now();

  RETURN jsonb_build_object(
    'company_id', _company_id,
    'applicable', c.profile_type = 'manager',
    'active', v_active,
    'expired', v_has AND NOT v_active AND v_next IS NULL,
    'paid_until', v_until,
    'plan_code', v_last.plan_code,
    'plan_label', v_last.plan_label,
    'next_period_start', v_next,
    'pending', EXISTS (SELECT 1 FROM public.delivery_company_payments p
                        WHERE p.company_id = _company_id AND p.kind = 'premium' AND p.status = 'pending'));
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_premium_state(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Côté structure
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_company_premium(_company_id uuid)
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
  RETURN public.delivery_premium_state(_company_id) || jsonb_build_object(
    'plans', public.delivery_premium_plans_list(),
    'suspended', COALESCE((SELECT a.suspended FROM public.delivery_company_activation a WHERE a.company_id = _company_id), false),
    'payments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'plan_code', p.plan_code, 'plan_label', p.plan_label, 'amount', p.amount, 'currency', p.currency,
        'method', p.method, 'reference', p.reference, 'status', p.status, 'source', p.source,
        'period_start', p.period_start, 'period_end', p.period_end, 'decision_note', p.decision_note,
        'created_at', p.created_at, 'decided_at', p.decided_at) ORDER BY p.created_at DESC)
      FROM public.delivery_company_payments p WHERE p.company_id = _company_id AND p.kind = 'premium'), '[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_company_premium(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_company_premium(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delivery_company_declare_premium(
  _company_id uuid, _plan_code text, _method text, _reference text DEFAULT NULL, _note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.delivery_companies%ROWTYPE;
  v_plan jsonb;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO c FROM public.delivery_companies WHERE id = _company_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Structure introuvable ou accès refusé.' USING ERRCODE = '42501'; END IF;
  IF c.profile_type IS DISTINCT FROM 'manager' THEN
    RAISE EXCEPTION 'Le Premium est réservé aux structures.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE((SELECT a.suspended FROM public.delivery_company_activation a WHERE a.company_id = _company_id), false) THEN
    RAISE EXCEPTION 'Votre accès est suspendu : souscription impossible.' USING ERRCODE = '42501';
  END IF;
  IF char_length(trim(COALESCE(_method, ''))) < 2 THEN RAISE EXCEPTION 'Indiquez le mode de paiement.' USING ERRCODE = '22023'; END IF;
  IF char_length(COALESCE(_reference, '')) > 120 OR char_length(COALESCE(_note, '')) > 500 THEN
    RAISE EXCEPTION 'Référence ou note trop longue.' USING ERRCODE = '22023';
  END IF;

  SELECT e INTO v_plan FROM jsonb_array_elements(public.delivery_premium_plans_list()) e WHERE e ->> 'code' = _plan_code LIMIT 1;
  IF v_plan IS NULL THEN RAISE EXCEPTION 'Formule Premium inconnue ou indisponible.' USING ERRCODE = '22023'; END IF;

  BEGIN
    INSERT INTO public.delivery_company_payments
      (company_id, kind, amount, currency, method, reference, note, declared_by, plan_code, plan_label, period_months)
    VALUES (_company_id, 'premium', (v_plan ->> 'amount')::numeric, v_plan ->> 'currency', trim(_method),
            NULLIF(trim(COALESCE(_reference, '')), ''), NULLIF(trim(COALESCE(_note, '')), ''), auth.uid(),
            v_plan ->> 'code', v_plan ->> 'label', (v_plan ->> 'months')::int)
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Un paiement Premium est déjà en attente de contrôle.' USING ERRCODE = '23505';
  END;

  PERFORM public.delivery_visit_audit(_company_id, 'premium_declared', 'owner', 'owner',
    jsonb_build_object('plan', v_plan ->> 'code', 'amount', (v_plan ->> 'amount')::numeric, 'payment_id', v_id));
  PERFORM public.delivery_notify_admins_to(_company_id, 'fee_declared', 'info', 'Paiement à contrôler',
    c.company_name || ' déclare un paiement (Premium, ' || (v_plan ->> 'label') || ').', '/delivery-admin/fees');
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_company_declare_premium(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_company_declare_premium(uuid, text, text, text, text) TO authenticated, service_role;

-- L'historique de la cotisation et de la caution ne montre plus les paiements Premium (page dédiée).
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
      FROM public.delivery_company_payments p WHERE p.company_id = _company_id AND p.kind <> 'premium'), '[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_company_fees(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_company_fees(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Côté administration
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_admin_set_premium_plans(_plans jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e jsonb;
  v_codes text[] := '{}';
  v_clean jsonb := '[]'::jsonb;
  v_code text;
  v_label text;
  v_cur text;
BEGIN
  PERFORM public.delivery_assert_admin();
  IF _plans IS NULL OR jsonb_typeof(_plans) <> 'array' THEN RAISE EXCEPTION 'Liste de formules invalide.' USING ERRCODE = '22023'; END IF;
  IF jsonb_array_length(_plans) > 6 THEN RAISE EXCEPTION 'Six formules au maximum.' USING ERRCODE = '22023'; END IF;

  FOR e IN SELECT * FROM jsonb_array_elements(_plans) LOOP
    IF jsonb_typeof(e) <> 'object' THEN RAISE EXCEPTION 'Formule invalide.' USING ERRCODE = '22023'; END IF;
    v_code := lower(trim(COALESCE(e ->> 'code', '')));
    v_label := trim(COALESCE(e ->> 'label', ''));
    v_cur := upper(COALESCE(NULLIF(trim(e ->> 'currency'), ''), 'XOF'));
    IF v_code !~ '^[a-z0-9_-]{2,30}$' THEN RAISE EXCEPTION 'Code de formule invalide (2 à 30 caractères : lettres, chiffres, - et _).' USING ERRCODE = '22023'; END IF;
    IF v_code = ANY (v_codes) THEN RAISE EXCEPTION 'Code de formule en double : %.', v_code USING ERRCODE = '22023'; END IF;
    IF char_length(v_label) NOT BETWEEN 2 AND 60 THEN RAISE EXCEPTION 'Libellé de formule invalide (2 à 60 caractères).' USING ERRCODE = '22023'; END IF;
    IF v_cur !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Devise invalide.' USING ERRCODE = '22023'; END IF;
    IF jsonb_typeof(e -> 'months') IS DISTINCT FROM 'number' OR (e ->> 'months')::numeric <> trunc((e ->> 'months')::numeric)
       OR (e ->> 'months')::int NOT BETWEEN 1 AND 120 THEN
      RAISE EXCEPTION 'Durée invalide (1 à 120 mois).' USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(e -> 'amount') IS DISTINCT FROM 'number' OR (e ->> 'amount')::numeric <= 0 OR (e ->> 'amount')::numeric > 100000000 THEN
      RAISE EXCEPTION 'Montant invalide.' USING ERRCODE = '22023';
    END IF;
    v_codes := v_codes || v_code;
    v_clean := v_clean || jsonb_build_object('code', v_code, 'label', v_label, 'months', (e ->> 'months')::int,
                                             'amount', (e ->> 'amount')::numeric, 'currency', v_cur);
  END LOOP;

  INSERT INTO public.delivery_settings (key, value, updated_by) VALUES ('premium_plans', v_clean, auth.uid())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = auth.uid(), updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_set_premium_plans(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_set_premium_plans(jsonb) TO authenticated, service_role;

-- Les réglages lus par l'administration incluent les formules.
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
    'deposit_refund_policy', COALESCE((SELECT s.value #>> '{}' FROM public.delivery_settings s WHERE s.key = 'deposit_refund_policy'), ''),
    'premium_plans', public.delivery_premium_plans_list());
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_fee_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_fee_settings() TO authenticated, service_role;

-- Confirmation : la cotisation et le Premium prolongent à partir de la fin en cours (même nature uniquement).
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
  ELSIF p.kind = 'premium' THEN
    SELECT max(q.period_end) INTO v_current FROM public.delivery_company_payments q
     WHERE q.company_id = p.company_id AND q.kind = 'premium' AND q.status = 'confirmed' AND q.id <> p.id;
    v_base := GREATEST(COALESCE(v_current, now()), now());
    UPDATE public.delivery_company_payments
       SET status = 'confirmed', decided_by = auth.uid(), decided_at = now(), decision_note = NULLIF(trim(COALESCE(_note, '')), ''),
           period_start = v_base,
           period_end = v_base + make_interval(months => COALESCE(p.period_months, 1))
     WHERE id = _payment_id;
  ELSE
    UPDATE public.delivery_company_payments
       SET status = 'confirmed', decided_by = auth.uid(), decided_at = now(), decision_note = NULLIF(trim(COALESCE(_note, '')), '')
     WHERE id = _payment_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_fee_confirm_row(uuid, text) FROM PUBLIC, anon, authenticated;

-- Décision sur un paiement : mêmes règles, libellés par nature (cotisation, caution, Premium).
CREATE OR REPLACE FUNCTION public.delivery_admin_decide_payment(_payment_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.delivery_company_payments%ROWTYPE;
  c public.delivery_companies%ROWTYPE;
  v_label text;
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
  v_label := CASE p.kind WHEN 'membership' THEN 'cotisation' WHEN 'deposit' THEN 'caution' ELSE 'abonnement Premium' END;

  IF _approve THEN
    PERFORM public.delivery_fee_confirm_row(_payment_id, _note);
  ELSE
    UPDATE public.delivery_company_payments
       SET status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_note = trim(_note)
     WHERE id = _payment_id;
  END IF;

  PERFORM public.delivery_visit_audit(p.company_id,
    CASE WHEN p.kind = 'premium' THEN CASE WHEN _approve THEN 'premium_confirmed' ELSE 'premium_rejected' END
         ELSE CASE WHEN _approve THEN 'fee_confirmed' ELSE 'fee_rejected' END END,
    'owner', 'admin', jsonb_build_object('kind', p.kind, 'amount', p.amount, 'payment_id', p.id));
  PERFORM public.delivery_notify(c.user_id, p.company_id, NULL,
    CASE WHEN _approve THEN 'fee_confirmed' ELSE 'fee_rejected' END,
    CASE WHEN _approve THEN 'success' ELSE 'warning' END,
    CASE WHEN _approve THEN 'Paiement confirmé' ELSE 'Paiement rejeté' END,
    CASE WHEN _approve THEN 'Votre ' || v_label || ' est confirmée.'
         ELSE 'Votre paiement n''a pas été retenu : ' || trim(_note) END,
    CASE WHEN p.kind = 'premium' THEN '/delivery/premium' ELSE '/delivery/fees' END);
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_decide_payment(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_decide_payment(uuid, boolean, text) TO authenticated, service_role;

-- Premium payé hors ligne, enregistré directement (confirmé tout de suite). Montant et durée : ceux de la formule.
CREATE OR REPLACE FUNCTION public.delivery_admin_record_premium(
  _company_id uuid, _plan_code text, _method text, _reference text DEFAULT NULL, _note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.delivery_companies%ROWTYPE;
  v_plan jsonb;
  v_id uuid;
BEGIN
  PERFORM public.delivery_assert_admin();
  SELECT * INTO c FROM public.delivery_companies WHERE id = _company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Structure introuvable.' USING ERRCODE = 'P0002'; END IF;
  IF c.profile_type IS DISTINCT FROM 'manager' THEN RAISE EXCEPTION 'Le Premium est réservé aux structures.' USING ERRCODE = '22023'; END IF;
  IF char_length(trim(COALESCE(_method, ''))) < 2 THEN RAISE EXCEPTION 'Indiquez le mode de paiement.' USING ERRCODE = '22023'; END IF;
  SELECT e INTO v_plan FROM jsonb_array_elements(public.delivery_premium_plans_list()) e WHERE e ->> 'code' = _plan_code LIMIT 1;
  IF v_plan IS NULL THEN RAISE EXCEPTION 'Formule Premium inconnue ou indisponible.' USING ERRCODE = '22023'; END IF;

  UPDATE public.delivery_company_payments
     SET status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_note = 'Remplacé par un enregistrement de l''administration.'
   WHERE company_id = _company_id AND kind = 'premium' AND status = 'pending';

  INSERT INTO public.delivery_company_payments
    (company_id, kind, amount, currency, method, reference, note, status, source, declared_by, plan_code, plan_label, period_months)
  VALUES (_company_id, 'premium', (v_plan ->> 'amount')::numeric, v_plan ->> 'currency', trim(_method),
          NULLIF(trim(COALESCE(_reference, '')), ''), NULLIF(trim(COALESCE(_note, '')), ''), 'pending', 'admin', auth.uid(),
          v_plan ->> 'code', v_plan ->> 'label', (v_plan ->> 'months')::int)
  RETURNING id INTO v_id;
  PERFORM public.delivery_fee_confirm_row(v_id, _note);

  PERFORM public.delivery_visit_audit(_company_id, 'premium_confirmed', 'owner', 'admin',
    jsonb_build_object('plan', v_plan ->> 'code', 'payment_id', v_id, 'recorded_by_admin', true));
  PERFORM public.delivery_notify(c.user_id, _company_id, NULL, 'fee_confirmed', 'success', 'Premium enregistré',
    'Votre abonnement Premium (' || (v_plan ->> 'label') || ') est enregistré.', '/delivery/premium');
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_record_premium(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_record_premium(uuid, text, text, text, text) TO authenticated, service_role;

-- Fin anticipée motivée du Premium (abus, litige) : les périodes en cours ou à venir s'arrêtent maintenant.
CREATE OR REPLACE FUNCTION public.delivery_admin_end_premium(_company_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.delivery_companies%ROWTYPE;
  v_n int;
BEGIN
  PERFORM public.delivery_assert_admin();
  IF char_length(trim(COALESCE(_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'Indiquez le motif (5 caractères minimum).' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO c FROM public.delivery_companies WHERE id = _company_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Structure introuvable.' USING ERRCODE = 'P0002'; END IF;

  UPDATE public.delivery_company_payments
     SET period_end = now(), period_start = LEAST(period_start, now()),
         decision_note = left(trim(_reason), 500)
   WHERE company_id = _company_id AND kind = 'premium' AND status = 'confirmed' AND period_end > now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RAISE EXCEPTION 'Aucun abonnement Premium en cours.' USING ERRCODE = 'P0002'; END IF;

  PERFORM public.delivery_visit_audit(_company_id, 'premium_ended', 'owner', 'admin', jsonb_build_object('reason', trim(_reason)));
  PERFORM public.delivery_notify(c.user_id, _company_id, NULL, 'premium_ended', 'warning', 'Premium arrêté',
    'Votre abonnement Premium a été arrêté : ' || trim(_reason), '/delivery/premium');
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_end_premium(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_end_premium(uuid, text) TO authenticated, service_role;

-- Tableau de contrôle : le Premium en plus (paiements en attente avec formule, état par structure).
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
        'currency', p.currency, 'method', p.method, 'reference', p.reference, 'note', p.note, 'plan_label', p.plan_label,
        'created_at', p.created_at)
        ORDER BY p.created_at)
      FROM public.delivery_company_payments p JOIN public.delivery_companies c ON c.id = p.company_id
      WHERE p.status = 'pending'), '[]'::jsonb),
    'companies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'company_id', c.id, 'company_name', c.company_name, 'city', c.city, 'verification_status', c.verification_status,
        'fees', public.delivery_company_fee_state(c.id), 'premium', public.delivery_premium_state(c.id))
        ORDER BY c.company_name)
      FROM public.delivery_companies c WHERE c.profile_type = 'manager'), '[]'::jsonb),
    'premium_plans', public.delivery_premium_plans_list());
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_fee_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_fee_overview() TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Répertoire : badge Premium et mise en avant (classement), sans toucher à la vérification
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_directory_card(c public.delivery_companies)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', c.id,
    'profile_type', c.profile_type,
    'company_name', c.company_name,
    'logo_url', c.logo_url,
    'description', c.description,
    'services_info', c.services_info,
    'city', c.city,
    'country', c.country,
    -- Pour un livreur indépendant, l'adresse est son domicile : jamais montrée.
    'address', CASE WHEN c.profile_type = 'driver' THEN NULL ELSE c.headquarters_address END,
    'phone', COALESCE(NULLIF(btrim(c.public_phone), ''), c.manager_phone),
    'whatsapp', c.manager_whatsapp,
    'email', NULLIF(btrim(c.public_email), ''),
    'covered_cities', c.covered_cities,
    'rating_score', c.rating_score,
    'reviews_count', c.reviews_count,
    'successful_deliveries_count', c.successful_deliveries_count,
    'drivers_count', c.total_drivers_count,
    'verified', (c.verification_status = 'approved' AND c.trust_badge_active),
    'verified_at', c.verified_at,
    'premium', (c.profile_type = 'manager' AND public.delivery_company_is_premium(c.id))
  );
$$;
REVOKE ALL ON FUNCTION public.delivery_directory_card(public.delivery_companies) FROM PUBLIC, anon;

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

  IF v_q IS NOT NULL THEN v_q := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%'; END IF;
  IF v_city IS NOT NULL THEN v_city := '%' || replace(replace(replace(v_city, '\', '\\'), '%', '\%'), '_', '\_') || '%'; END IF;

  -- Classement : les structures Premium d'abord, puis note, livraisons réussies et nom. Seules des structures déjà
  -- vérifiées (approuvées avec badge) et opérationnelles sont listées : le Premium ne contourne rien.
  WITH matches AS (
    SELECT c AS comp, c.rating_score, c.successful_deliveries_count, c.company_name, c.id,
           (c.profile_type = 'manager' AND public.delivery_company_is_premium(c.id)) AS is_premium
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
     ORDER BY m.is_premium DESC, COALESCE(m.rating_score, 0) DESC, m.successful_deliveries_count DESC, m.company_name ASC, m.id ASC
     LIMIT v_limit OFFSET v_offset
  )
  SELECT (SELECT count(*) FROM matches),
         COALESCE((SELECT jsonb_agg(public.delivery_directory_card(p.comp)
                                    ORDER BY p.is_premium DESC, COALESCE(p.rating_score, 0) DESC,
                                    p.successful_deliveries_count DESC, p.company_name ASC, p.id ASC) FROM page p), '[]'::jsonb)
    INTO v_total, v_items;

  RETURN jsonb_build_object('total', v_total, 'items', v_items);
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_directory_search(text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_directory_search(text, text, text, integer, integer) TO authenticated, service_role;
