-- ========================================================
-- ECOMFY PAY — PAIEMENT → COMMANDE → CRÉDIT EN UNE SEULE TRANSACTION, REJOUABLE (audit M6)
-- ========================================================
-- Avant : le webhook faisait trois écritures séparées (paiement SUCCEEDED, commande PAID, crédit du portefeuille). Si le
-- crédit échouait, l'erreur était journalisée, le webhook acquitté, et le paiement déjà SUCCEEDED : plus aucun rejeu possible,
-- le marchand n'était jamais crédité. L'événement était aussi inscrit dans payment_events AVANT le traitement : la nouvelle
-- tentative du prestataire était alors ignorée comme doublon.
--
-- Maintenant : confirm_ecomfy_payment() verrouille le paiement, vérifie le montant, puis passe le paiement à SUCCEEDED, marque la
-- commande payée et crédite le portefeuille dans la même transaction (tout ou rien). Chaque étape est idempotente : rappeler la
-- fonction (nouvelle livraison du webhook, balayage, appel manuel) termine ce qui manque sans jamais créditer deux fois.
-- Les erreurs sont inscrites dans payment_events (processing_status = 'ERROR') ; l'événement n'écarte plus le rejeu.
--
-- Rejouable : le fichier peut être appliqué plusieurs fois (CREATE OR REPLACE, DROP … IF EXISTS).

-- 1. Journal des événements : écriture ou mise à jour (l'état d'un événement évolue avec les rejeux)
CREATE OR REPLACE FUNCTION public.ecomfy_log_payment_event(
    p_event_id TEXT,
    p_event_type TEXT,
    p_payment_id UUID,
    p_payload JSONB,
    p_status TEXT,
    p_error TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_event_id IS NULL THEN
        RETURN;
    END IF;
    INSERT INTO public.payment_events (event_id, provider, payment_id, event_type, payload, processing_status, error_message)
    VALUES (p_event_id, 'geniuspay', p_payment_id, COALESCE(p_event_type, 'payment.success'), COALESCE(p_payload, '{}'::jsonb), p_status, p_error)
    ON CONFLICT (provider, event_id) DO UPDATE
    SET payment_id = COALESCE(EXCLUDED.payment_id, public.payment_events.payment_id),
        processing_status = EXCLUDED.processing_status,
        error_message = EXCLUDED.error_message;
END;
$$;
REVOKE ALL ON FUNCTION public.ecomfy_log_payment_event(TEXT, TEXT, UUID, JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- 2. Confirmation d'un paiement (succès ou échec) : une transaction, rejouable
CREATE OR REPLACE FUNCTION public.confirm_ecomfy_payment(
    p_internal_reference TEXT DEFAULT NULL,
    p_provider_reference TEXT DEFAULT NULL,
    p_outcome TEXT DEFAULT 'SUCCEEDED',          -- 'SUCCEEDED' | 'FAILED'
    p_remote_amount NUMERIC DEFAULT NULL,         -- montant encaissé chez le prestataire (obligatoire tant que le paiement n'est pas SUCCEEDED)
    p_remote_currency TEXT DEFAULT NULL,
    p_event_id TEXT DEFAULT NULL,
    p_event_type TEXT DEFAULT NULL,
    p_payload JSONB DEFAULT NULL,
    p_failure_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pay public.ecomfy_payments;
    v_credit JSONB;
    v_rows INT;
    v_payment_step TEXT;
    v_order_step TEXT := 'none';
    v_credit_step TEXT;
    v_error TEXT;
BEGIN
    IF p_outcome NOT IN ('SUCCEEDED', 'FAILED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Résultat inconnu : ' || COALESCE(p_outcome, 'NULL'));
    END IF;

    -- Verrou : deux livraisons simultanées du même paiement passent l'une après l'autre.
    IF p_internal_reference IS NOT NULL THEN
        SELECT * INTO v_pay FROM public.ecomfy_payments WHERE internal_reference = p_internal_reference FOR UPDATE;
    ELSIF p_provider_reference IS NOT NULL THEN
        SELECT * INTO v_pay FROM public.ecomfy_payments WHERE provider_reference = p_provider_reference
        ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
    END IF;

    IF v_pay.id IS NULL THEN
        PERFORM public.ecomfy_log_payment_event(p_event_id, p_event_type, NULL, p_payload, 'PAYMENT_NOT_FOUND',
                                                COALESCE(p_internal_reference, p_provider_reference));
        RETURN jsonb_build_object('success', false, 'error', 'Payment record not found');
    END IF;

    -- ---------- Échec ----------
    IF p_outcome = 'FAILED' THEN
        IF v_pay.status IN ('CREATED', 'PENDING', 'PROCESSING') THEN
            UPDATE public.ecomfy_payments
            SET status = 'FAILED',
                metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object('failure_reason', p_failure_reason)),
                updated_at = NOW()
            WHERE id = v_pay.id;
            v_payment_step := 'updated';
        ELSE
            -- SUCCEEDED / REFUNDED / déjà FAILED : un événement d'échec tardif ou rejoué ne défait jamais un paiement encaissé.
            v_payment_step := 'ignored';
        END IF;
        PERFORM public.ecomfy_log_payment_event(p_event_id, p_event_type, v_pay.id, p_payload, 'PROCESSED', NULL);
        RETURN jsonb_build_object('success', true, 'status', CASE WHEN v_payment_step = 'updated' THEN 'FAILED' ELSE v_pay.status END,
                                  'payment_id', v_pay.id, 'internal_reference', v_pay.internal_reference,
                                  'steps', jsonb_build_object('payment', v_payment_step));
    END IF;

    -- ---------- Succès ----------
    IF v_pay.status = 'REFUNDED' THEN
        PERFORM public.ecomfy_log_payment_event(p_event_id, p_event_type, v_pay.id, p_payload, 'PROCESSED', NULL);
        RETURN jsonb_build_object('success', true, 'already_processed', true, 'status', 'REFUNDED',
                                  'payment_id', v_pay.id, 'internal_reference', v_pay.internal_reference);
    END IF;

    -- C6 : le montant encaissé chez le prestataire doit être celui enregistré à l'initialisation (même devise).
    -- Contrôle fait tant que le paiement n'est pas SUCCEEDED ; un rejeu d'un paiement déjà confirmé n'a pas à le refaire.
    IF v_pay.status <> 'SUCCEEDED' THEN
        IF p_remote_amount IS NULL
           OR ABS(p_remote_amount - v_pay.amount) > 1
           OR (p_remote_currency IS NOT NULL AND UPPER(p_remote_currency) <> UPPER(COALESCE(v_pay.currency, 'XOF'))) THEN
            PERFORM public.ecomfy_log_payment_event(p_event_id, p_event_type, v_pay.id, p_payload, 'AMOUNT_MISMATCH',
                format('attendu %s %s, reçu %s %s', v_pay.amount, v_pay.currency, COALESCE(p_remote_amount::text, 'NULL'), COALESCE(p_remote_currency, '?')));
            RETURN jsonb_build_object('success', false, 'error', 'Amount mismatch', 'reference', v_pay.internal_reference);
        END IF;
    END IF;

    -- Les trois écritures : un sous-bloc, annulé en bloc à la moindre erreur (le paiement reste alors dans son état d'origine).
    BEGIN
        IF v_pay.status <> 'SUCCEEDED' THEN
            UPDATE public.ecomfy_payments
            SET status = 'SUCCEEDED',
                provider_reference = COALESCE(p_provider_reference, provider_reference),
                updated_at = NOW()
            WHERE id = v_pay.id;
            v_payment_step := 'updated';
        ELSE
            UPDATE public.ecomfy_payments
            SET provider_reference = p_provider_reference, updated_at = NOW()
            WHERE id = v_pay.id AND provider_reference IS NULL AND p_provider_reference IS NOT NULL;
            v_payment_step := 'already';
        END IF;

        IF v_pay.order_id IS NOT NULL THEN
            -- 'paid' en minuscules, comme partout ailleurs (mcp, reconcile-tracking, résumé hebdomadaire) ; l'ancien « PAID » n'était lu par personne.
            UPDATE public.orders
            SET payment_status = 'paid', updated_at = NOW()
            WHERE id = v_pay.order_id AND LOWER(COALESCE(payment_status, '')) <> 'paid';
            GET DIAGNOSTICS v_rows = ROW_COUNT;
            v_order_step := CASE WHEN v_rows > 0 THEN 'updated' ELSE 'already' END;
        END IF;

        v_credit := public.credit_merchant_wallet_pending(
            v_pay.merchant_id, v_pay.id, v_pay.amount, v_pay.net_merchant_amount, v_pay.currency, 72, v_pay.internal_reference
        );
        IF COALESCE((v_credit ->> 'success')::boolean, false) IS NOT TRUE THEN
            -- Portefeuille gelé : l'encaissement reste acquis (paiement et commande), le crédit attend le dégel et sera rejoué.
            v_credit_step := 'blocked';
            v_error := v_credit ->> 'error';
        ELSIF COALESCE((v_credit ->> 'duplicate')::boolean, false) THEN
            v_credit_step := 'already';
        ELSE
            v_credit_step := 'done';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Le sous-bloc est annulé : ni paiement, ni commande, ni crédit n'a bougé. La trace d'erreur, elle, est conservée.
        PERFORM public.ecomfy_log_payment_event(p_event_id, p_event_type, v_pay.id, p_payload, 'ERROR', SQLERRM);
        RETURN jsonb_build_object('success', false, 'retryable', true, 'error', 'Transaction annulée : ' || SQLERRM,
                                  'payment_id', v_pay.id, 'internal_reference', v_pay.internal_reference);
    END;

    PERFORM public.ecomfy_log_payment_event(p_event_id, p_event_type, v_pay.id, p_payload,
        CASE WHEN v_credit_step = 'blocked' THEN 'CREDIT_BLOCKED' ELSE 'PROCESSED' END, v_error);

    RETURN jsonb_build_object(
        'success', v_credit_step <> 'blocked',
        'status', 'SUCCEEDED',
        'payment_id', v_pay.id,
        'internal_reference', v_pay.internal_reference,
        'already_processed', v_payment_step = 'already' AND v_order_step IN ('already', 'none') AND v_credit_step = 'already',
        'steps', jsonb_build_object('payment', v_payment_step, 'order', v_order_step, 'credit', v_credit_step),
        'pending_replay', v_credit_step = 'blocked',
        'error', v_error
    );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_ecomfy_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_ecomfy_payment(TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, JSONB, TEXT) TO service_role;

-- 3. Balayage : termine tout paiement SUCCEEDED dont la commande n'est pas payée ou dont le crédit manque
-- (webhook tombé en erreur, portefeuille dégelé depuis). Appelé par ecomfy-pay-settlement ; utilisable à la main.
CREATE OR REPLACE FUNCTION public.replay_incomplete_ecomfy_payments(p_limit INT DEFAULT 100)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
    v_res JSONB;
    v_examined INT := 0;
    v_completed INT := 0;
    v_blocked INT := 0;
    v_failed INT := 0;
BEGIN
    FOR r IN
        SELECT p.internal_reference
        FROM public.ecomfy_payments p
        WHERE p.status = 'SUCCEEDED'
          AND (
              NOT EXISTS (SELECT 1 FROM public.settlements s WHERE s.payment_id = p.id)
              OR (p.order_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.orders o WHERE o.id = p.order_id AND LOWER(COALESCE(o.payment_status, '')) <> 'paid'))
          )
        ORDER BY p.updated_at
        LIMIT GREATEST(COALESCE(p_limit, 100), 1)
    LOOP
        v_examined := v_examined + 1;
        v_res := public.confirm_ecomfy_payment(p_internal_reference := r.internal_reference);
        IF (v_res ->> 'success')::boolean THEN
            v_completed := v_completed + 1;
        ELSIF (v_res ->> 'pending_replay')::boolean THEN
            v_blocked := v_blocked + 1;
        ELSE
            v_failed := v_failed + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('examined', v_examined, 'completed', v_completed, 'blocked', v_blocked, 'failed', v_failed);
END;
$$;

REVOKE ALL ON FUNCTION public.replay_incomplete_ecomfy_payments(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replay_incomplete_ecomfy_payments(INT) TO service_role;

-- 4. Rattrapage des commandes déjà marquées « PAID » (majuscules) par l'ancien webhook : mêmes commandes, valeur lue par le reste de l'application.
UPDATE public.orders o
SET payment_status = 'paid', updated_at = NOW()
WHERE o.payment_status = 'PAID'
  AND EXISTS (SELECT 1 FROM public.ecomfy_payments p WHERE p.order_id = o.id);
