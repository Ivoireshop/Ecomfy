-- HOTFIX sécurité (appliquable seul sur la base de production, idempotent)
-- 1. apply_commission_payment / apply_shop_subscription : plus d'appel anonyme
-- 2. corporate_* : fin des politiques USING (true) ouvertes à tout utilisateur connecté

-- ====================================================================
-- 1. FONCTIONS DE FACTURATION
-- ====================================================================

-- apply_commission_payment : appelée par les edge functions (service_role)
-- et par l'interface fondateur (JWT d'un fondateur / cofondateur).
CREATE OR REPLACE FUNCTION public.apply_commission_payment(
  p_shop_id uuid,
  p_amount numeric,
  p_transaction_reference text,
  p_created_by uuid DEFAULT NULL,
  p_payment_method text DEFAULT 'geniuspay',
  p_notes text DEFAULT 'Paiement en ligne via GeniusPay'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shop record;
  v_existing uuid;
  v_new_balance numeric;
  v_pct numeric;
  v_event text;
BEGIN
  -- Garde d'accès : service_role, connexion directe ou fondateur uniquement
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND session_user NOT IN ('postgres', 'supabase_admin', 'service_role')
     AND NOT EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = auth.uid() AND ur.role::text IN ('founder', 'co_founder')
     ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_shop_id IS NULL OR COALESCE(p_amount,0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  IF p_transaction_reference IS NOT NULL THEN
    SELECT id INTO v_existing FROM public.commission_payments
      WHERE transaction_reference = p_transaction_reference LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'already_applied', true, 'payment_id', v_existing);
    END IF;
  END IF;

  SELECT id,
         COALESCE(commission_balance_due,0) AS balance,
         COALESCE(commission_threshold,12000) AS threshold,
         shop_payment_status
    INTO v_shop FROM public.shops WHERE id = p_shop_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'shop_not_found');
  END IF;

  v_pct := CASE WHEN v_shop.threshold > 0 THEN p_amount / v_shop.threshold ELSE 0 END;
  v_new_balance := GREATEST(0, v_shop.balance - p_amount);

  IF v_new_balance <= 0 THEN
    UPDATE public.shops
       SET commission_balance_due = 0,
           payment_deadline = NULL,
           is_suspended = false,
           shop_payment_status = 'active',
           threshold_reached_at = NULL,
           first_deadline_at = NULL,
           locked_at = NULL,
           second_deadline_at = NULL,
           final_suspension_at = NULL,
           updated_at = now()
     WHERE id = p_shop_id;
    UPDATE public.orders SET received_during_lock = false
      WHERE shop_id = p_shop_id AND received_during_lock = true;
    v_event := 'paid_full';
  ELSIF v_pct >= 0.75 THEN
    UPDATE public.shops
       SET commission_balance_due = v_new_balance,
           payment_deadline = now() + interval '3 days',
           first_deadline_at = now() + interval '3 days',
           second_deadline_at = NULL,
           locked_at = NULL,
           is_suspended = false,
           shop_payment_status = 'payment_pending',
           updated_at = now()
     WHERE id = p_shop_id;
    UPDATE public.orders SET received_during_lock = false
      WHERE shop_id = p_shop_id AND received_during_lock = true;
    v_event := 'payment_partial_75';
  ELSIF v_pct >= 0.50 THEN
    UPDATE public.shops
       SET commission_balance_due = v_new_balance,
           payment_deadline = now() + interval '3 days',
           first_deadline_at = now() + interval '3 days',
           second_deadline_at = NULL,
           locked_at = NULL,
           is_suspended = false,
           shop_payment_status = 'payment_pending',
           updated_at = now()
     WHERE id = p_shop_id;
    UPDATE public.orders SET received_during_lock = false
      WHERE shop_id = p_shop_id AND received_during_lock = true;
    v_event := 'payment_partial_50';
  ELSE
    UPDATE public.shops
       SET commission_balance_due = v_new_balance,
           updated_at = now()
     WHERE id = p_shop_id;
    v_event := 'payment_small';
  END IF;

  INSERT INTO public.commission_payments (shop_id, amount, payment_method, transaction_reference, status, created_by, notes)
  VALUES (p_shop_id, p_amount, COALESCE(NULLIF(p_payment_method,''),'geniuspay'), p_transaction_reference, 'paid', p_created_by, p_notes)
  ON CONFLICT (transaction_reference) WHERE transaction_reference IS NOT NULL DO NOTHING;

  INSERT INTO public.shop_payment_events(shop_id, event_type, amount, note, created_by)
  VALUES (p_shop_id, v_event, p_amount, p_notes, p_created_by);

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance, 'event', v_event);
END $$;

REVOKE ALL ON FUNCTION public.apply_commission_payment(uuid, numeric, text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_commission_payment(uuid, numeric, text, uuid, text, text) TO authenticated, service_role;

-- apply_shop_subscription : uniquement appelée par les edge functions
REVOKE ALL ON FUNCTION public.apply_shop_subscription(uuid, uuid, text, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_shop_subscription(uuid, uuid, text, numeric, text, text) TO service_role;

-- ====================================================================
-- 2. GOUVERNANCE CORPORATE
-- ====================================================================

CREATE OR REPLACE FUNCTION public.is_corporate_founder()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role::text IN ('founder', 'co_founder')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_corporate_reader()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role::text IN ('founder', 'co_founder', 'shareholder', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_corporate_founder() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_corporate_reader() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_corporate_founder() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_corporate_reader() TO authenticated, service_role;

DO $$
DECLARE
  t text;
  pol record;
  tables text[] := ARRAY[
    'corporate_companies','corporate_shareholders','corporate_share_allocations',
    'corporate_vesting_plans','corporate_vesting_milestones','corporate_documents',
    'corporate_document_versions','corporate_document_acceptances','corporate_proposals',
    'corporate_proposal_approvals','corporate_cap_table_snapshots',
    'corporate_intellectual_property','corporate_offboarding_cases','corporate_audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;

    -- Retire toutes les politiques existantes (ouvertes ou « Strict … »)
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Lecture : fondateurs, cofondateurs, actionnaires, admins
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_corporate_reader())',
      'Corporate read ' || t, t);

    -- Écriture complète : fondateurs et cofondateurs
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_corporate_founder()) WITH CHECK (public.is_corporate_founder())',
      'Corporate founder write ' || t, t);
  END LOOP;

  -- Journal d'audit et acceptations de documents : ajout seul pour tout utilisateur connecté
  -- (signature électronique à l'onboarding), sans modification ni suppression.
  IF to_regclass('public.corporate_audit_logs') IS NOT NULL THEN
    CREATE POLICY "Corporate append corporate_audit_logs" ON public.corporate_audit_logs
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF to_regclass('public.corporate_document_acceptances') IS NOT NULL THEN
    CREATE POLICY "Corporate append corporate_document_acceptances" ON public.corporate_document_acceptances
      FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;
