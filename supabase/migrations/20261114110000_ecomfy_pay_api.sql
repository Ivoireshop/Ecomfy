-- ========================================================
-- ECOMFY PAY — API PUBLIQUE POUR LES MARCHANDS + SANDBOX
-- ========================================================
-- Ce que cette migration ajoute (rien d'existant n'est modifié, sauf un déclencheur en lecture sur ecomfy_payments) :
--   * ecomfy_api_keys            : clés secrètes `ecm_sk_test_…` (sandbox) / `ecm_sk_live_…` (production). Seule l'empreinte
--                                  SHA-256 est stockée ; le secret n'est montré qu'une fois, à la création.
--   * ecomfy_api_payments        : paiements créés par l'API. Sandbox : ligne autonome, AUCUN lien avec le portefeuille, le
--                                  ledger, les commandes ni les statistiques. Production : liée à une ligne ecomfy_payments,
--                                  qui reste la source de vérité de l'argent (confirm_ecomfy_payment, ledger, règlements).
--   * ecomfy_api_idempotency     : en-tête Idempotency-Key (24 h).
--   * ecomfy_api_webhook_endpoints / ecomfy_api_events / ecomfy_api_webhook_deliveries : webhooks sortants vers le serveur du
--                                  marchand (signés HMAC-SHA256, reprises espacées), pour les deux modes.
--   * un déclencheur sur ecomfy_payments : quand un paiement lié à l'API change de statut, l'événement payment.* est créé
--     dans la même transaction. Il ne peut jamais faire échouer la confirmation d'un paiement (exceptions avalées).
-- Les clés et les webhooks se gèrent depuis Ecomfy Pay > Développeurs (fonctions RPC ci-dessous, propriétaire de la boutique).
-- Les fonctions marquées « service_role » ne sont appelées que par l'Edge Function ecomfy-pay-api.
--
-- Rejouable : CREATE … IF NOT EXISTS / CREATE OR REPLACE / DROP … IF EXISTS.

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Clés d'API
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ecomfy_api_keys (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id      UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name         TEXT NOT NULL DEFAULT 'Clé secrète' CHECK (char_length(name) BETWEEN 1 AND 60),
    livemode     BOOLEAN NOT NULL,
    key_hash     TEXT NOT NULL UNIQUE,
    key_prefix   TEXT NOT NULL,
    last4        TEXT NOT NULL,
    last_used_at TIMESTAMPTZ,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ecomfy_api_keys_shop ON public.ecomfy_api_keys (shop_id, livemode) WHERE revoked_at IS NULL;
ALTER TABLE public.ecomfy_api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads own API keys" ON public.ecomfy_api_keys;
CREATE POLICY "Owner reads own API keys" ON public.ecomfy_api_keys FOR SELECT TO authenticated USING (merchant_id = auth.uid());
REVOKE ALL ON public.ecomfy_api_keys FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, merchant_id, shop_id, name, livemode, key_prefix, last4, last_used_at, revoked_at, created_at)
    ON public.ecomfy_api_keys TO authenticated;
GRANT ALL ON public.ecomfy_api_keys TO service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Paiements de l'API
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ecomfy_api_payments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id        TEXT NOT NULL UNIQUE,               -- pay_test_… / pay_live_…
    key_id           UUID REFERENCES public.ecomfy_api_keys(id) ON DELETE SET NULL,
    merchant_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id          UUID REFERENCES public.shops(id) ON DELETE SET NULL,
    livemode         BOOLEAN NOT NULL,
    payment_id       UUID REFERENCES public.ecomfy_payments(id) ON DELETE SET NULL,   -- production uniquement
    amount           NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    currency         TEXT NOT NULL DEFAULT 'XOF',
    payment_method   TEXT NOT NULL,
    description      TEXT,
    customer         JSONB NOT NULL DEFAULT '{}'::jsonb,
    client_reference TEXT,
    metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
    success_url      TEXT,
    cancel_url       TEXT,
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled', 'expired', 'refunded')),
    failure_code     TEXT,
    failure_message  TEXT,
    checkout_url     TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ecomfy_api_payments_shop ON public.ecomfy_api_payments (shop_id, livemode, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_ecomfy_api_payments_payment ON public.ecomfy_api_payments (payment_id) WHERE payment_id IS NOT NULL;
ALTER TABLE public.ecomfy_api_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads own API payments" ON public.ecomfy_api_payments;
CREATE POLICY "Owner reads own API payments" ON public.ecomfy_api_payments FOR SELECT TO authenticated USING (merchant_id = auth.uid());
REVOKE ALL ON public.ecomfy_api_payments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ecomfy_api_payments TO authenticated;
GRANT ALL ON public.ecomfy_api_payments TO service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Idempotence
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ecomfy_api_idempotency (
    key_id           UUID NOT NULL REFERENCES public.ecomfy_api_keys(id) ON DELETE CASCADE,
    idem_key         TEXT NOT NULL,
    request_hash     TEXT NOT NULL,
    payment_public_id TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (key_id, idem_key)
);
ALTER TABLE public.ecomfy_api_idempotency ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ecomfy_api_idempotency FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ecomfy_api_idempotency TO service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. Webhooks sortants : destinations, événements, livraisons
-- ---------------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ecomfy_api_webhook_endpoints (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id     UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    url         TEXT NOT NULL CHECK (char_length(url) <= 500),
    livemode    BOOLEAN NOT NULL,
    events      TEXT[] NOT NULL DEFAULT ARRAY['*']::TEXT[],
    description TEXT CHECK (description IS NULL OR char_length(description) <= 120),
    secret      TEXT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ecomfy_api_endpoints_shop ON public.ecomfy_api_webhook_endpoints (shop_id, livemode) WHERE is_active;
ALTER TABLE public.ecomfy_api_webhook_endpoints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads own webhook endpoints" ON public.ecomfy_api_webhook_endpoints;
DROP POLICY IF EXISTS "Owner updates own webhook endpoints" ON public.ecomfy_api_webhook_endpoints;
DROP POLICY IF EXISTS "Owner deletes own webhook endpoints" ON public.ecomfy_api_webhook_endpoints;
CREATE POLICY "Owner reads own webhook endpoints" ON public.ecomfy_api_webhook_endpoints FOR SELECT TO authenticated USING (merchant_id = auth.uid());
CREATE POLICY "Owner updates own webhook endpoints" ON public.ecomfy_api_webhook_endpoints FOR UPDATE TO authenticated
    USING (merchant_id = auth.uid()) WITH CHECK (merchant_id = auth.uid());
CREATE POLICY "Owner deletes own webhook endpoints" ON public.ecomfy_api_webhook_endpoints FOR DELETE TO authenticated USING (merchant_id = auth.uid());
REVOKE ALL ON public.ecomfy_api_webhook_endpoints FROM PUBLIC, anon, authenticated;
-- Le secret de signature n'est jamais lisible par l'API REST : il est renvoyé une fois à la création / à la rotation.
GRANT SELECT (id, merchant_id, shop_id, url, livemode, events, description, is_active, created_at)
    ON public.ecomfy_api_webhook_endpoints TO authenticated;
GRANT UPDATE (is_active, description, events) ON public.ecomfy_api_webhook_endpoints TO authenticated;
GRANT DELETE ON public.ecomfy_api_webhook_endpoints TO authenticated;
GRANT ALL ON public.ecomfy_api_webhook_endpoints TO service_role;

CREATE TABLE IF NOT EXISTS public.ecomfy_api_events (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id      TEXT NOT NULL UNIQUE,                 -- evt_…
    merchant_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id        UUID REFERENCES public.shops(id) ON DELETE SET NULL,
    livemode       BOOLEAN NOT NULL,
    type           TEXT NOT NULL,
    api_payment_id UUID NOT NULL REFERENCES public.ecomfy_api_payments(id) ON DELETE CASCADE,
    payload        JSONB NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (api_payment_id, type)
);
ALTER TABLE public.ecomfy_api_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads own API events" ON public.ecomfy_api_events;
CREATE POLICY "Owner reads own API events" ON public.ecomfy_api_events FOR SELECT TO authenticated USING (merchant_id = auth.uid());
REVOKE ALL ON public.ecomfy_api_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ecomfy_api_events TO authenticated;
GRANT ALL ON public.ecomfy_api_events TO service_role;

CREATE TABLE IF NOT EXISTS public.ecomfy_api_webhook_deliveries (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id         UUID NOT NULL REFERENCES public.ecomfy_api_events(id) ON DELETE CASCADE,
    endpoint_id      UUID NOT NULL REFERENCES public.ecomfy_api_webhook_endpoints(id) ON DELETE CASCADE,
    status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
    attempts         INT NOT NULL DEFAULT 0,
    next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_http_status INT,
    last_error       TEXT,
    delivered_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, endpoint_id)
);
CREATE INDEX IF NOT EXISTS idx_ecomfy_api_deliveries_due ON public.ecomfy_api_webhook_deliveries (next_attempt_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ecomfy_api_deliveries_endpoint ON public.ecomfy_api_webhook_deliveries (endpoint_id, created_at DESC);
ALTER TABLE public.ecomfy_api_webhook_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads own webhook deliveries" ON public.ecomfy_api_webhook_deliveries;
CREATE POLICY "Owner reads own webhook deliveries" ON public.ecomfy_api_webhook_deliveries FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.ecomfy_api_webhook_endpoints e WHERE e.id = endpoint_id AND e.merchant_id = auth.uid()));
REVOKE ALL ON public.ecomfy_api_webhook_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ecomfy_api_webhook_deliveries TO authenticated;
GRANT ALL ON public.ecomfy_api_webhook_deliveries TO service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. Outils internes (jamais appelables depuis l'API REST)
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ecomfy_api_status_from_internal(p_status TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT CASE UPPER(COALESCE(p_status, ''))
        WHEN 'SUCCEEDED' THEN 'succeeded'
        WHEN 'FAILED'    THEN 'failed'
        WHEN 'CANCELLED' THEN 'cancelled'
        WHEN 'EXPIRED'   THEN 'expired'
        WHEN 'REFUNDED'  THEN 'refunded'
        ELSE 'pending'          -- CREATED, PENDING, PROCESSING
    END
$$;

-- Objet « payment » tel que le voit le marchand (même forme dans les réponses et dans les événements).
-- Production : le statut et les frais viennent de ecomfy_payments, source de vérité de l'argent.
CREATE OR REPLACE FUNCTION public.ecomfy_api_payment_json(p public.ecomfy_api_payments)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_status TEXT := p.status;
    v_fee NUMERIC := ROUND(p.amount * 0.025);
    v_net NUMERIC;
    v_ref TEXT;
    v_fail_code TEXT := p.failure_code;
    v_fail_msg TEXT := p.failure_message;
    v_pay public.ecomfy_payments;
BEGIN
    IF p.livemode AND p.payment_id IS NOT NULL THEN
        SELECT * INTO v_pay FROM public.ecomfy_payments WHERE id = p.payment_id;
        IF v_pay.id IS NOT NULL THEN
            v_status := public.ecomfy_api_status_from_internal(v_pay.status);
            v_fee := v_pay.fee_ecomfy;
            v_net := v_pay.net_merchant_amount;
            v_ref := v_pay.internal_reference;
            IF v_status = 'failed' AND v_fail_code IS NULL THEN
                v_fail_code := 'payment_failed';
                v_fail_msg := 'Le paiement a été refusé ou n''a pas abouti.';
            END IF;
        END IF;
    END IF;
    v_net := COALESCE(v_net, p.amount - v_fee);

    RETURN jsonb_build_object(
        'id', p.public_id,
        'object', 'payment',
        'livemode', p.livemode,
        'status', v_status,
        'amount', p.amount::BIGINT,
        'currency', p.currency,
        'fee_amount', v_fee::BIGINT,
        'net_amount', v_net::BIGINT,
        'payment_method', p.payment_method,
        'description', p.description,
        'customer', p.customer,
        'client_reference', p.client_reference,
        'metadata', p.metadata,
        'checkout_url', p.checkout_url,
        'success_url', p.success_url,
        'cancel_url', p.cancel_url,
        'reference', v_ref,
        'failure', CASE WHEN v_fail_code IS NULL THEN NULL
                        ELSE jsonb_build_object('code', v_fail_code, 'message', v_fail_msg) END,
        'created_at', to_char(p.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'updated_at', to_char(p.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'completed_at', CASE WHEN p.completed_at IS NULL THEN NULL
                             ELSE to_char(p.completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') END
    );
END;
$$;
REVOKE ALL ON FUNCTION public.ecomfy_api_payment_json(public.ecomfy_api_payments) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ecomfy_api_payment_json(public.ecomfy_api_payments) TO service_role;

-- Crée l'événement payment.* d'un paiement (une seule fois par paiement et par type) et ses livraisons : une par destination
-- active de la boutique, du même mode, qui écoute ce type. Le contenu est figé ici : une reprise renvoie le même corps.
CREATE OR REPLACE FUNCTION public.ecomfy_api_emit_event(p_api_payment_id UUID, p_type TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_p public.ecomfy_api_payments;
    v_evt_id UUID;
    v_public TEXT := 'evt_' || SUBSTR(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 24);
BEGIN
    SELECT * INTO v_p FROM public.ecomfy_api_payments WHERE id = p_api_payment_id;
    IF v_p.id IS NULL THEN RETURN; END IF;

    INSERT INTO public.ecomfy_api_events (public_id, merchant_id, shop_id, livemode, type, api_payment_id, payload)
    VALUES (v_public, v_p.merchant_id, v_p.shop_id, v_p.livemode, p_type, v_p.id,
            jsonb_build_object(
                'id', v_public, 'object', 'event', 'type', p_type, 'livemode', v_p.livemode,
                'created_at', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                'data', jsonb_build_object('object', public.ecomfy_api_payment_json(v_p))))
    ON CONFLICT (api_payment_id, type) DO NOTHING
    RETURNING id INTO v_evt_id;
    IF v_evt_id IS NULL THEN RETURN; END IF;

    INSERT INTO public.ecomfy_api_webhook_deliveries (event_id, endpoint_id)
    SELECT v_evt_id, e.id
    FROM public.ecomfy_api_webhook_endpoints e
    WHERE e.shop_id = v_p.shop_id AND e.livemode = v_p.livemode AND e.is_active
      AND ('*' = ANY (e.events) OR p_type = ANY (e.events));
END;
$$;
REVOKE ALL ON FUNCTION public.ecomfy_api_emit_event(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ecomfy_api_emit_event(UUID, TEXT) TO service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. Gestion des clés et des destinations (propriétaire de la boutique, depuis Ecomfy Pay > Développeurs)
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_ecomfy_api_key(p_shop_id UUID, p_livemode BOOLEAN, p_name TEXT DEFAULT 'Clé secrète')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_owner UUID;
    v_name TEXT := NULLIF(BTRIM(COALESCE(p_name, '')), '');
    v_secret TEXT;
    v_id UUID;
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
    SELECT user_id INTO v_owner FROM public.shops WHERE id = p_shop_id;
    IF v_owner IS NULL OR v_owner <> v_uid THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
    IF v_name IS NULL OR char_length(v_name) > 60 THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_name');
    END IF;
    IF p_livemode AND NOT EXISTS (SELECT 1 FROM public.merchant_kyc WHERE user_id = v_uid AND verification_status = 'VERIFIED') THEN
        RETURN jsonb_build_object('success', false, 'error', 'kyc_required');
    END IF;
    IF (SELECT COUNT(*) FROM public.ecomfy_api_keys WHERE shop_id = p_shop_id AND livemode = p_livemode AND revoked_at IS NULL) >= 10 THEN
        RETURN jsonb_build_object('success', false, 'error', 'too_many_keys');
    END IF;

    v_secret := 'ecm_sk_' || CASE WHEN p_livemode THEN 'live' ELSE 'test' END || '_'
                || REPLACE(gen_random_uuid()::TEXT || gen_random_uuid()::TEXT, '-', '');
    INSERT INTO public.ecomfy_api_keys (merchant_id, shop_id, name, livemode, key_hash, key_prefix, last4)
    VALUES (v_uid, p_shop_id, v_name, p_livemode, ENCODE(SHA256(CONVERT_TO(v_secret, 'UTF8')), 'hex'),
            LEFT(v_secret, 16), RIGHT(v_secret, 4))
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('success', true, 'id', v_id, 'secret', v_secret, 'livemode', p_livemode);
END;
$$;
REVOKE ALL ON FUNCTION public.create_ecomfy_api_key(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_ecomfy_api_key(UUID, BOOLEAN, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.revoke_ecomfy_api_key(p_key_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_rows INT;
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
    UPDATE public.ecomfy_api_keys SET revoked_at = NOW()
    WHERE id = p_key_id AND merchant_id = v_uid AND revoked_at IS NULL;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN jsonb_build_object('success', v_rows > 0);
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_ecomfy_api_key(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_ecomfy_api_key(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_ecomfy_webhook_endpoint(
    p_shop_id UUID, p_url TEXT, p_livemode BOOLEAN, p_events TEXT[] DEFAULT ARRAY['*']::TEXT[], p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_owner UUID;
    v_url TEXT := BTRIM(COALESCE(p_url, ''));
    v_events TEXT[] := COALESCE(p_events, ARRAY['*']::TEXT[]);
    v_secret TEXT;
    v_id UUID;
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
    SELECT user_id INTO v_owner FROM public.shops WHERE id = p_shop_id;
    IF v_owner IS NULL OR v_owner <> v_uid THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
    -- https obligatoire, sans identifiants dans l'URL ; les adresses internes sont refusées à l'envoi (garde SSRF de la fonction).
    IF v_url !~* '^https://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?(/[^[:space:]]*)?$' OR char_length(v_url) > 500 THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_url');
    END IF;
    IF cardinality(v_events) = 0 OR EXISTS (
        SELECT 1 FROM UNNEST(v_events) ev
        WHERE ev NOT IN ('*', 'payment.succeeded', 'payment.failed', 'payment.cancelled', 'payment.expired', 'payment.refunded')) THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_events');
    END IF;
    IF (SELECT COUNT(*) FROM public.ecomfy_api_webhook_endpoints WHERE shop_id = p_shop_id AND livemode = p_livemode) >= 5 THEN
        RETURN jsonb_build_object('success', false, 'error', 'too_many_endpoints');
    END IF;

    v_secret := 'whsec_' || REPLACE(gen_random_uuid()::TEXT || gen_random_uuid()::TEXT, '-', '');
    INSERT INTO public.ecomfy_api_webhook_endpoints (merchant_id, shop_id, url, livemode, events, description, secret)
    VALUES (v_uid, p_shop_id, v_url, p_livemode, v_events, NULLIF(LEFT(BTRIM(COALESCE(p_description, '')), 120), ''), v_secret)
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('success', true, 'id', v_id, 'secret', v_secret);
END;
$$;
REVOKE ALL ON FUNCTION public.create_ecomfy_webhook_endpoint(UUID, TEXT, BOOLEAN, TEXT[], TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_ecomfy_webhook_endpoint(UUID, TEXT, BOOLEAN, TEXT[], TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rotate_ecomfy_webhook_secret(p_endpoint_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_secret TEXT := 'whsec_' || REPLACE(gen_random_uuid()::TEXT || gen_random_uuid()::TEXT, '-', '');
    v_rows INT;
BEGIN
    IF v_uid IS NULL THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
    UPDATE public.ecomfy_api_webhook_endpoints SET secret = v_secret WHERE id = p_endpoint_id AND merchant_id = v_uid;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
    RETURN jsonb_build_object('success', true, 'secret', v_secret);
END;
$$;
REVOKE ALL ON FUNCTION public.rotate_ecomfy_webhook_secret(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_ecomfy_webhook_secret(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. Fonctions de l'Edge Function ecomfy-pay-api (service_role uniquement)
-- ---------------------------------------------------------------------------------------------------------------------

-- Authentification : empreinte de la clé → contexte (boutique, mode, KYC). NULL si la clé est inconnue ou révoquée.
CREATE OR REPLACE FUNCTION public.ecomfy_api_authenticate(p_key_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    k public.ecomfy_api_keys;
    v_shop public.shops;
BEGIN
    SELECT * INTO k FROM public.ecomfy_api_keys WHERE key_hash = p_key_hash AND revoked_at IS NULL;
    IF k.id IS NULL THEN RETURN NULL; END IF;
    SELECT * INTO v_shop FROM public.shops WHERE id = k.shop_id;
    IF v_shop.id IS NULL OR v_shop.user_id <> k.merchant_id THEN RETURN NULL; END IF;
    IF k.last_used_at IS NULL OR k.last_used_at < NOW() - INTERVAL '1 minute' THEN
        UPDATE public.ecomfy_api_keys SET last_used_at = NOW() WHERE id = k.id;
    END IF;
    RETURN jsonb_build_object(
        'key_id', k.id, 'merchant_id', k.merchant_id, 'shop_id', k.shop_id, 'livemode', k.livemode,
        'business_name', v_shop.business_name,
        'kyc_verified', EXISTS (SELECT 1 FROM public.merchant_kyc WHERE user_id = k.merchant_id AND verification_status = 'VERIFIED'));
END;
$$;
REVOKE ALL ON FUNCTION public.ecomfy_api_authenticate(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ecomfy_api_authenticate(TEXT) TO service_role;

-- Création d'un paiement. Retour : {ok:true, replay, payment, live?:{internal_reference, ecomfy_payment_id}} ou {ok:false, code}.
-- Sandbox : une seule ligne, aucune écriture ailleurs. Production : ligne ecomfy_payments (PENDING, frais 2,5 % comme le
-- paiement client) + ligne API ; l'Edge Function appelle ensuite l'opérateur puis ecomfy_api_finalize_live / ecomfy_api_abort_live.
CREATE OR REPLACE FUNCTION public.ecomfy_api_create_payment(
    p_key_id UUID, p_input JSONB, p_idem_key TEXT DEFAULT NULL, p_request_hash TEXT DEFAULT NULL,
    p_checkout_base TEXT DEFAULT NULL, p_provider TEXT DEFAULT 'geniuspay'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    k public.ecomfy_api_keys;
    v_shop public.shops;
    v_amount NUMERIC;
    v_method TEXT := p_input ->> 'payment_method';
    v_public TEXT;
    v_api public.ecomfy_api_payments;
    v_idem public.ecomfy_api_idempotency;
    v_rows INT;
    v_fee NUMERIC;
    v_pay public.ecomfy_payments;
    v_ref TEXT;
BEGIN
    SELECT * INTO k FROM public.ecomfy_api_keys WHERE id = p_key_id AND revoked_at IS NULL;
    IF k.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_api_key'); END IF;
    SELECT * INTO v_shop FROM public.shops WHERE id = k.shop_id;
    IF v_shop.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_api_key'); END IF;

    -- Défense en profondeur : l'Edge Function valide déjà ces champs.
    IF COALESCE(jsonb_typeof(p_input -> 'amount'), '') <> 'number' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'invalid_request', 'param', 'amount');
    END IF;
    v_amount := (p_input ->> 'amount')::NUMERIC;
    IF v_amount <> TRUNC(v_amount) OR v_amount < 200 OR v_amount > 10000000 THEN
        RETURN jsonb_build_object('ok', false, 'code', 'invalid_request', 'param', 'amount');
    END IF;
    IF COALESCE(p_input ->> 'currency', 'XOF') <> 'XOF' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'invalid_request', 'param', 'currency');
    END IF;
    IF v_method IS NULL OR v_method NOT IN ('wave', 'orange_money', 'mtn', 'moov', 'card') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'invalid_request', 'param', 'payment_method');
    END IF;

    IF p_idem_key IS NOT NULL THEN
        DELETE FROM public.ecomfy_api_idempotency WHERE key_id = k.id AND idem_key = p_idem_key AND created_at < NOW() - INTERVAL '24 hours';
        INSERT INTO public.ecomfy_api_idempotency (key_id, idem_key, request_hash)
        VALUES (k.id, p_idem_key, COALESCE(p_request_hash, ''))
        ON CONFLICT (key_id, idem_key) DO NOTHING;
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        IF v_rows = 0 THEN
            SELECT * INTO v_idem FROM public.ecomfy_api_idempotency WHERE key_id = k.id AND idem_key = p_idem_key;
            IF v_idem.request_hash <> COALESCE(p_request_hash, '') THEN
                RETURN jsonb_build_object('ok', false, 'code', 'idempotency_key_reuse');
            END IF;
            SELECT * INTO v_api FROM public.ecomfy_api_payments WHERE public_id = v_idem.payment_public_id;
            IF v_api.id IS NULL OR (v_api.livemode AND v_api.checkout_url IS NULL) THEN
                RETURN jsonb_build_object('ok', false, 'code', 'request_in_progress');
            END IF;
            RETURN jsonb_build_object('ok', true, 'replay', true, 'payment', public.ecomfy_api_payment_json(v_api));
        END IF;
    END IF;

    v_public := 'pay_' || CASE WHEN k.livemode THEN 'live' ELSE 'test' END || '_' || SUBSTR(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 24);
    v_fee := ROUND(v_amount * 0.025);

    IF k.livemode THEN
        v_ref := 'ECM-PAY-' || UPPER(SUBSTR(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 12));
        INSERT INTO public.ecomfy_payments (
            internal_reference, merchant_id, shop_id, provider, payment_method, amount, currency,
            fee_provider, fee_ecomfy, net_merchant_amount, status, customer_name, customer_phone, customer_email, metadata)
        VALUES (
            v_ref, k.merchant_id, k.shop_id, COALESCE(p_provider, 'geniuspay'), v_method, v_amount, 'XOF',
            0, v_fee, v_amount - v_fee, 'PENDING',
            p_input -> 'customer' ->> 'name', p_input -> 'customer' ->> 'phone', p_input -> 'customer' ->> 'email',
            jsonb_build_object('created_via', 'api', 'api_public_id', v_public, 'client_reference', p_input ->> 'client_reference'))
        RETURNING * INTO v_pay;
    END IF;

    INSERT INTO public.ecomfy_api_payments (
        public_id, key_id, merchant_id, shop_id, livemode, payment_id, amount, currency, payment_method, description,
        customer, client_reference, metadata, success_url, cancel_url, status, checkout_url)
    VALUES (
        v_public, k.id, k.merchant_id, k.shop_id, k.livemode, v_pay.id, v_amount, 'XOF', v_method,
        NULLIF(p_input ->> 'description', ''),
        COALESCE(p_input -> 'customer', '{}'::JSONB), NULLIF(p_input ->> 'client_reference', ''),
        COALESCE(p_input -> 'metadata', '{}'::JSONB), NULLIF(p_input ->> 'success_url', ''), NULLIF(p_input ->> 'cancel_url', ''),
        'pending',
        CASE WHEN k.livemode THEN NULL ELSE COALESCE(p_checkout_base, '') || '/' || v_public END)
    RETURNING * INTO v_api;

    IF p_idem_key IS NOT NULL THEN
        UPDATE public.ecomfy_api_idempotency SET payment_public_id = v_public WHERE key_id = k.id AND idem_key = p_idem_key;
    END IF;

    RETURN jsonb_build_object(
        'ok', true, 'replay', false, 'payment', public.ecomfy_api_payment_json(v_api),
        'live', CASE WHEN k.livemode THEN jsonb_build_object(
            'internal_reference', v_pay.internal_reference, 'ecomfy_payment_id', v_pay.id,
            'business_name', v_shop.business_name) ELSE NULL END);
END;
$$;
REVOKE ALL ON FUNCTION public.ecomfy_api_create_payment(UUID, JSONB, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ecomfy_api_create_payment(UUID, JSONB, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- Production : l'opérateur a fourni la page de paiement.
CREATE OR REPLACE FUNCTION public.ecomfy_api_finalize_live(p_public_id TEXT, p_checkout_url TEXT, p_provider_reference TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_api public.ecomfy_api_payments;
BEGIN
    UPDATE public.ecomfy_api_payments SET checkout_url = p_checkout_url, updated_at = NOW()
    WHERE public_id = p_public_id AND livemode AND checkout_url IS NULL
    RETURNING * INTO v_api;
    IF v_api.id IS NULL THEN RETURN NULL; END IF;
    IF p_provider_reference IS NOT NULL AND v_api.payment_id IS NOT NULL THEN
        UPDATE public.ecomfy_payments SET provider_reference = p_provider_reference, updated_at = NOW() WHERE id = v_api.payment_id;
    END IF;
    RETURN public.ecomfy_api_payment_json(v_api);
END;
$$;
REVOKE ALL ON FUNCTION public.ecomfy_api_finalize_live(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ecomfy_api_finalize_live(TEXT, TEXT, TEXT) TO service_role;

-- Production : l'opérateur a refusé ou est injoignable. Le paiement est clos (FAILED) sans événement : le marchand n'a jamais
-- reçu son identifiant (réponse 502), et la clé d'idempotence est libérée pour qu'il puisse réessayer.
CREATE OR REPLACE FUNCTION public.ecomfy_api_abort_live(p_public_id TEXT, p_reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_api public.ecomfy_api_payments;
BEGIN
    SELECT * INTO v_api FROM public.ecomfy_api_payments WHERE public_id = p_public_id AND livemode AND checkout_url IS NULL;
    IF v_api.id IS NULL THEN RETURN; END IF;
    UPDATE public.ecomfy_api_payments
    SET status = 'failed', failure_code = 'provider_unavailable', failure_message = 'Le prestataire de paiement est indisponible.',
        completed_at = NOW(), updated_at = NOW()
    WHERE id = v_api.id;
    IF v_api.payment_id IS NOT NULL THEN
        UPDATE public.ecomfy_payments
        SET status = 'FAILED', updated_at = NOW(),
            metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object('gateway_error', LEFT(COALESCE(p_reason, ''), 800))
        WHERE id = v_api.payment_id AND status IN ('CREATED', 'PENDING', 'PROCESSING');
    END IF;
    DELETE FROM public.ecomfy_api_idempotency WHERE payment_public_id = p_public_id;
END;
$$;
REVOKE ALL ON FUNCTION public.ecomfy_api_abort_live(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ecomfy_api_abort_live(TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.ecomfy_api_get_payment(p_key_id UUID, p_public_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    k public.ecomfy_api_keys;
    v_api public.ecomfy_api_payments;
BEGIN
    SELECT * INTO k FROM public.ecomfy_api_keys WHERE id = p_key_id AND revoked_at IS NULL;
    IF k.id IS NULL THEN RETURN NULL; END IF;
    SELECT * INTO v_api FROM public.ecomfy_api_payments
    WHERE public_id = p_public_id AND shop_id = k.shop_id AND livemode = k.livemode
      AND NOT (livemode AND checkout_url IS NULL);
    IF v_api.id IS NULL THEN RETURN NULL; END IF;
    RETURN public.ecomfy_api_payment_json(v_api);
END;
$$;
REVOKE ALL ON FUNCTION public.ecomfy_api_get_payment(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ecomfy_api_get_payment(UUID, TEXT) TO service_role;

-- Liste paginée (curseur starting_after = id du dernier élément reçu), du plus récent au plus ancien.
CREATE OR REPLACE FUNCTION public.ecomfy_api_list_payments(
    p_key_id UUID, p_limit INT DEFAULT 20, p_starting_after TEXT DEFAULT NULL, p_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    k public.ecomfy_api_keys;
    v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
    v_cur public.ecomfy_api_payments;
    v_rows JSONB;
    v_count INT;
BEGIN
    SELECT * INTO k FROM public.ecomfy_api_keys WHERE id = p_key_id AND revoked_at IS NULL;
    IF k.id IS NULL THEN RETURN NULL; END IF;
    IF p_starting_after IS NOT NULL THEN
        SELECT * INTO v_cur FROM public.ecomfy_api_payments
        WHERE public_id = p_starting_after AND shop_id = k.shop_id AND livemode = k.livemode;
        IF v_cur.id IS NULL THEN RETURN jsonb_build_object('error', 'invalid_cursor'); END IF;
    END IF;

    -- Le filtre de statut est appliqué AVANT la limite : sinon une page filtrée serait incomplète.
    SELECT COALESCE(jsonb_agg(s.j ORDER BY s.c DESC, s.i DESC), '[]'::JSONB), COUNT(*)
    INTO v_rows, v_count
    FROM (
        SELECT p.created_at AS c, p.id AS i, x.j
        FROM public.ecomfy_api_payments p
        CROSS JOIN LATERAL (SELECT public.ecomfy_api_payment_json(p) AS j) x
        WHERE p.shop_id = k.shop_id AND p.livemode = k.livemode
          AND NOT (p.livemode AND p.checkout_url IS NULL)
          AND (v_cur.id IS NULL OR (p.created_at, p.id) < (v_cur.created_at, v_cur.id))
          AND (p_status IS NULL OR x.j ->> 'status' = p_status)
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT v_limit + 1
    ) s;

    -- has_more : la requête lit une ligne de plus que demandé ; on rend au plus v_limit éléments.
    RETURN jsonb_build_object(
        'data', (SELECT COALESCE(jsonb_agg(e.value ORDER BY e.ordinality), '[]'::JSONB)
                 FROM jsonb_array_elements(v_rows) WITH ORDINALITY e(value, ordinality) WHERE e.ordinality <= v_limit),
        'has_more', v_count > v_limit);
END;
$$;
REVOKE ALL ON FUNCTION public.ecomfy_api_list_payments(UUID, INT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ecomfy_api_list_payments(UUID, INT, TEXT, TEXT) TO service_role;

-- Sandbox : fait aboutir un paiement de test selon un scénario. Appelée avec la clé (API) ou sans (page de paiement sandbox,
-- l'identifiant à 96 bits faisant office de secret). Aucune écriture hors des tables de l'API : pas de portefeuille, pas de commande.
CREATE OR REPLACE FUNCTION public.ecomfy_api_simulate(p_public_id TEXT, p_scenario TEXT, p_key_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_api public.ecomfy_api_payments;
    v_status TEXT;
    v_code TEXT;
    v_msg TEXT;
    v_type TEXT;
    k public.ecomfy_api_keys;
BEGIN
    IF p_scenario NOT IN ('success', 'insufficient_funds', 'declined', 'cancelled', 'expired') THEN
        RETURN jsonb_build_object('ok', false, 'code', 'invalid_scenario');
    END IF;
    IF p_key_id IS NOT NULL THEN
        SELECT * INTO k FROM public.ecomfy_api_keys WHERE id = p_key_id AND revoked_at IS NULL;
        IF k.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'invalid_api_key'); END IF;
        IF k.livemode THEN RETURN jsonb_build_object('ok', false, 'code', 'live_mode_not_simulable'); END IF;
    END IF;

    SELECT * INTO v_api FROM public.ecomfy_api_payments WHERE public_id = p_public_id AND NOT livemode FOR UPDATE;
    IF v_api.id IS NULL OR (k.id IS NOT NULL AND v_api.shop_id IS DISTINCT FROM k.shop_id) THEN
        RETURN jsonb_build_object('ok', false, 'code', 'not_found');
    END IF;
    IF v_api.status <> 'pending' THEN
        RETURN jsonb_build_object('ok', false, 'code', 'payment_not_pending', 'payment', public.ecomfy_api_payment_json(v_api));
    END IF;

    CASE p_scenario
        WHEN 'success' THEN v_status := 'succeeded'; v_type := 'payment.succeeded';
        WHEN 'insufficient_funds' THEN
            v_status := 'failed'; v_type := 'payment.failed'; v_code := 'insufficient_funds'; v_msg := 'Solde insuffisant (scénario de test).';
        WHEN 'declined' THEN
            v_status := 'failed'; v_type := 'payment.failed'; v_code := 'payment_declined'; v_msg := 'Paiement refusé par l''opérateur (scénario de test).';
        WHEN 'cancelled' THEN v_status := 'cancelled'; v_type := 'payment.cancelled';
        WHEN 'expired' THEN v_status := 'expired'; v_type := 'payment.expired';
    END CASE;

    UPDATE public.ecomfy_api_payments
    SET status = v_status, failure_code = v_code, failure_message = v_msg, completed_at = NOW(), updated_at = NOW()
    WHERE id = v_api.id
    RETURNING * INTO v_api;
    PERFORM public.ecomfy_api_emit_event(v_api.id, v_type);
    RETURN jsonb_build_object('ok', true, 'payment', public.ecomfy_api_payment_json(v_api));
END;
$$;
REVOKE ALL ON FUNCTION public.ecomfy_api_simulate(TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ecomfy_api_simulate(TEXT, TEXT, UUID) TO service_role;

-- Données de la page de paiement sandbox (aucune donnée client : ni nom, ni téléphone, ni e-mail).
CREATE OR REPLACE FUNCTION public.ecomfy_api_sandbox_checkout(p_public_id TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object(
        'id', p.public_id, 'status', p.status, 'amount', p.amount::BIGINT, 'currency', p.currency,
        'description', p.description, 'payment_method', p.payment_method,
        'business_name', s.business_name, 'success_url', p.success_url, 'cancel_url', p.cancel_url)
    FROM public.ecomfy_api_payments p
    LEFT JOIN public.shops s ON s.id = p.shop_id
    WHERE p.public_id = p_public_id AND NOT p.livemode
$$;
REVOKE ALL ON FUNCTION public.ecomfy_api_sandbox_checkout(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ecomfy_api_sandbox_checkout(TEXT) TO service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. Livraison des webhooks : réservation des envois dus, puis enregistrement du résultat
-- ---------------------------------------------------------------------------------------------------------------------
-- Réserve (bail de 2 minutes) les livraisons échues et renvoie de quoi les envoyer. SKIP LOCKED : deux balayages
-- simultanés ne prennent jamais la même livraison.
CREATE OR REPLACE FUNCTION public.ecomfy_api_claim_deliveries(p_limit INT DEFAULT 20)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_out JSONB;
BEGIN
    -- Destination désactivée entre-temps : la livraison est abandonnée.
    UPDATE public.ecomfy_api_webhook_deliveries d
    SET status = 'failed', last_error = 'endpoint_disabled'
    FROM public.ecomfy_api_webhook_endpoints e
    WHERE d.endpoint_id = e.id AND d.status = 'pending' AND NOT e.is_active;

    WITH due AS (
        SELECT d.id FROM public.ecomfy_api_webhook_deliveries d
        WHERE d.status = 'pending' AND d.next_attempt_at <= NOW()
        ORDER BY d.next_attempt_at
        LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100)
        FOR UPDATE SKIP LOCKED
    ), upd AS (
        UPDATE public.ecomfy_api_webhook_deliveries d
        SET attempts = d.attempts + 1, next_attempt_at = NOW() + INTERVAL '2 minutes'
        FROM due WHERE d.id = due.id
        RETURNING d.*
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'delivery_id', u.id, 'attempt', u.attempts, 'url', e.url, 'secret', e.secret,
        'event_id', ev.public_id, 'event_type', ev.type, 'payload', ev.payload)), '[]'::JSONB)
    INTO v_out
    FROM upd u
    JOIN public.ecomfy_api_webhook_endpoints e ON e.id = u.endpoint_id
    JOIN public.ecomfy_api_events ev ON ev.id = u.event_id;
    RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.ecomfy_api_claim_deliveries(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ecomfy_api_claim_deliveries(INT) TO service_role;

-- Résultat d'un envoi : 2xx = livré ; sinon reprise espacée (1 min, 5 min, 30 min, 2 h, 6 h, 12 h, 24 h), puis abandon.
CREATE OR REPLACE FUNCTION public.ecomfy_api_record_delivery(p_delivery_id UUID, p_http_status INT, p_error TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    d public.ecomfy_api_webhook_deliveries;
    v_delays INT[] := ARRAY[1, 5, 30, 120, 360, 720, 1440];
BEGIN
    SELECT * INTO d FROM public.ecomfy_api_webhook_deliveries WHERE id = p_delivery_id FOR UPDATE;
    IF d.id IS NULL THEN RETURN 'unknown'; END IF;
    IF p_http_status BETWEEN 200 AND 299 THEN
        UPDATE public.ecomfy_api_webhook_deliveries
        SET status = 'succeeded', last_http_status = p_http_status, last_error = NULL, delivered_at = NOW()
        WHERE id = d.id;
        RETURN 'succeeded';
    END IF;
    IF d.attempts >= 8 THEN
        UPDATE public.ecomfy_api_webhook_deliveries
        SET status = 'failed', last_http_status = p_http_status, last_error = LEFT(p_error, 300)
        WHERE id = d.id;
        RETURN 'failed';
    END IF;
    UPDATE public.ecomfy_api_webhook_deliveries
    SET last_http_status = p_http_status, last_error = LEFT(p_error, 300),
        next_attempt_at = NOW() + make_interval(mins => v_delays[LEAST(d.attempts, array_length(v_delays, 1))])
    WHERE id = d.id;
    RETURN 'retry';
END;
$$;
REVOKE ALL ON FUNCTION public.ecomfy_api_record_delivery(UUID, INT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ecomfy_api_record_delivery(UUID, INT, TEXT) TO service_role;

-- Ménage : clés d'idempotence de plus de 24 h et livraisons terminées de plus de 30 jours.
CREATE OR REPLACE FUNCTION public.ecomfy_api_purge()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_idem INT;
    v_del INT;
BEGIN
    DELETE FROM public.ecomfy_api_idempotency WHERE created_at < NOW() - INTERVAL '24 hours';
    GET DIAGNOSTICS v_idem = ROW_COUNT;
    DELETE FROM public.ecomfy_api_webhook_deliveries WHERE status <> 'pending' AND created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS v_del = ROW_COUNT;
    RETURN jsonb_build_object('idempotency', v_idem, 'deliveries', v_del);
END;
$$;
REVOKE ALL ON FUNCTION public.ecomfy_api_purge() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ecomfy_api_purge() TO service_role;

-- ---------------------------------------------------------------------------------------------------------------------
-- 9. Production : un paiement lié à l'API change de statut → événement payment.* (même transaction que la confirmation)
-- ---------------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ecomfy_api_sync_live_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_api public.ecomfy_api_payments;
    v_status TEXT;
    v_type TEXT;
BEGIN
    BEGIN
        SELECT * INTO v_api FROM public.ecomfy_api_payments WHERE payment_id = NEW.id AND livemode;
        -- Pas un paiement de l'API, ou jamais remis au marchand (checkout_url absent) : rien à notifier.
        IF v_api.id IS NULL OR v_api.checkout_url IS NULL THEN RETURN NEW; END IF;

        v_status := public.ecomfy_api_status_from_internal(NEW.status);
        UPDATE public.ecomfy_api_payments
        SET status = v_status, updated_at = NOW(),
            completed_at = CASE WHEN v_status = 'pending' THEN NULL ELSE COALESCE(completed_at, NOW()) END
        WHERE id = v_api.id;

        v_type := CASE v_status
            WHEN 'succeeded' THEN 'payment.succeeded' WHEN 'failed' THEN 'payment.failed'
            WHEN 'cancelled' THEN 'payment.cancelled' WHEN 'expired' THEN 'payment.expired'
            WHEN 'refunded'  THEN 'payment.refunded' ELSE NULL END;
        IF v_type IS NOT NULL THEN PERFORM public.ecomfy_api_emit_event(v_api.id, v_type); END IF;
    EXCEPTION WHEN OTHERS THEN
        -- La confirmation d'un paiement ne doit jamais échouer à cause des notifications marchand.
        RAISE WARNING 'ecomfy_api_sync_live_payment(%): %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ecomfy_api_sync_live_payment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ecomfy_api_sync_live_payment ON public.ecomfy_payments;
CREATE TRIGGER ecomfy_api_sync_live_payment
    AFTER UPDATE OF status ON public.ecomfy_payments
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.ecomfy_api_sync_live_payment();

-- ---------------------------------------------------------------------------------------------------------------------
-- 10. Planification : envoi des webhooks dus, chaque minute (reprises incluses). Sans pg_cron / invoke_edge_function :
--     avertissement, rien n'est planifié (les webhooks partent alors à la création de l'événement seulement).
-- ---------------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
    v_job_id BIGINT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        RAISE WARNING 'pg_cron absent : ecomfy-pay-api-deliveries non planifié';
        RETURN;
    END IF;
    IF to_regprocedure('public.invoke_edge_function(text,jsonb)') IS NULL THEN
        RAISE WARNING 'invoke_edge_function absente : appliquer d''abord 20261011120000_edge_function_url_from_vault.sql';
        RETURN;
    END IF;
    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'ecomfy-pay-api-deliveries';
    IF v_job_id IS NOT NULL THEN PERFORM cron.unschedule(v_job_id); END IF;
    PERFORM cron.schedule(
        'ecomfy-pay-api-deliveries',
        '* * * * *',
        $cmd$ SELECT public.invoke_edge_function('ecomfy-pay-api', '{"task":"deliver"}'::jsonb); $cmd$
    );
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ecomfy-pay-api-deliveries non planifié : %', SQLERRM;
END $$;
