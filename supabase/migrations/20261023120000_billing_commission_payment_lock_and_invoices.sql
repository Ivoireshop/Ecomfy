-- Facturation boutique (23/10/2026) : apply_commission_payment.
--
-- 1. Une boutique verrouillée (locked, final_suspension, STORE_RESTRICTED, PAYMENT_OVERDUE) ou suspendue ne se
--    débloque plus par un règlement partiel. Avant, un paiement de 50 % ou plus du seuil repassait la boutique en
--    « payment_pending » et la déverrouillait, alors que les écrans annoncent « paiement complet obligatoire »
--    (ShopPaymentCountdown, LockedOrdersScreen, PayCommissionDialog fullOnly). L'argent reçu est toujours enregistré
--    et déduit du solde ; seule la levée de la restriction exige le solde complet.
-- 2. Le règlement complet clôt aussi les factures de seuil ouvertes (shop_invoices) quand ce système est déployé.
--    La migration 20261003120000 le faisait, mais 20261012120000 puis 20261015130000 ont réécrit la fonction à partir
--    d'une version antérieure et ont perdu ce comportement. Le montant de la facture est conservé (l'ancienne version
--    le mettait à 0, ce qui affichait « 0 FCFA » dans l'historique d'une facture réglée).
--
-- Corps repris de 20261015130000 (verrou consultatif par référence, droits service_role). Idempotent.
-- Fonctionne avec ou sans la table shop_invoices (testée par to_regclass : rien n'est créé).

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
  v_restricted boolean;
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
    -- Sérialise les appels concurrents portant sur la même référence (relâché au COMMIT)
    PERFORM pg_advisory_xact_lock(hashtext('apply_billing:' || p_transaction_reference));

    SELECT id INTO v_existing FROM public.commission_payments
      WHERE transaction_reference = p_transaction_reference LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'already_applied', true, 'payment_id', v_existing);
    END IF;
  END IF;

  SELECT id,
         COALESCE(commission_balance_due,0) AS balance,
         COALESCE(commission_threshold,12000) AS threshold,
         shop_payment_status,
         COALESCE(is_suspended, false) AS suspended
    INTO v_shop FROM public.shops WHERE id = p_shop_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'shop_not_found');
  END IF;

  -- Même définition que public.is_shop_restricted()
  v_restricted := v_shop.suspended
    OR COALESCE(v_shop.shop_payment_status, '') IN ('STORE_RESTRICTED', 'locked', 'PAYMENT_OVERDUE', 'final_suspension');

  v_pct := CASE WHEN v_shop.threshold > 0 THEN p_amount / v_shop.threshold ELSE 0 END;
  v_new_balance := GREATEST(0, v_shop.balance - p_amount);

  IF v_new_balance <= 0 THEN
    -- Règlement complet : accès rétabli
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

    -- Factures de seuil ouvertes : réglées (système de facturation par seuil, s'il est déployé)
    IF to_regclass('public.shop_invoices') IS NOT NULL THEN
      EXECUTE 'UPDATE public.shop_invoices
                  SET status = ''PAYMENT_CONFIRMED'',
                      paid_at = now(),
                      payment_reference = COALESCE($2, payment_reference),
                      payment_method = COALESCE($3, payment_method),
                      reactivated_at = now()
                WHERE shop_id = $1 AND status NOT IN (''PAYMENT_CONFIRMED'', ''CANCELLED'')'
        USING p_shop_id, p_transaction_reference, NULLIF(p_payment_method, '');
    END IF;
    v_event := 'paid_full';
  ELSIF v_restricted THEN
    -- Règlement partiel d'une boutique verrouillée : le solde baisse, la restriction et les échéances restent.
    UPDATE public.shops
       SET commission_balance_due = v_new_balance,
           updated_at = now()
     WHERE id = p_shop_id;
    v_event := 'payment_partial_restricted';
  ELSIF v_pct >= 0.50 THEN
    -- 50 % du seuil ou plus (75 % et 100 % avaient des branches identiques) : nouveau délai de 3 jours
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
    v_event := CASE WHEN v_pct >= 0.75 THEN 'payment_partial_75' ELSE 'payment_partial_50' END;
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

-- Droits (audit C2) : service_role uniquement. CREATE OR REPLACE les conserve ; rappel idempotent.
REVOKE ALL ON FUNCTION public.apply_commission_payment(uuid, numeric, text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_commission_payment(uuid, numeric, text, uuid, text, text)
  TO service_role;
