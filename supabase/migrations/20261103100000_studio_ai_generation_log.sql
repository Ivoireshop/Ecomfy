-- Studio IA (03/11/2026) : suivi des coûts, quotas réellement appliqués, remboursement automatique des échecs.
--
-- Constats avant cette migration :
--   * generate-ai-image ne vérifiait JAMAIS le solde avant de générer : un compte à 0 crédit générait gratuitement
--     (le décompte après coup ne décrémentait que s'il restait quelque chose).
--   * Il lisait profiles.is_founder et profiles.subscription_status, colonnes qui n'existent pas : fondateurs et
--     abonnés étaient donc débités comme les autres.
--   * generate-video n'imposait aucun solde (compteur codé en dur à 999) : toute personne connectée pouvait lancer des
--     vidéos (Replicate / Runway) dans la seule limite de 60 par heure.
--   * Le coût d'une génération n'était enregistré nulle part.
--
-- Cette migration ajoute :
--   1. ai_generation_log : une ligne par génération (réservation -> réussite / échec), coût estimé, tentatives, code d'erreur ;
--   2. start_studio_generation()  : (images Studio / visuels publicitaires / images de services, et vidéos) plafond de coût journalier + débit atomique AVANT l'appel payant ;
--   3. finish_studio_generation() : clôture + remboursement automatique si la génération a échoué (idempotent) ;
--   4. expire_stale_studio_generations() : rembourse les réservations restées ouvertes (fonction interrompue), toutes les 10 min.
--
-- Même règle d'exemption que consume_ai_credit : fondateur / co-fondateur, puis abonnement actif non échu.
-- Idempotent. Aucun crédit existant n'est modifié.

-- 1. Journal ------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_generation_log (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            uuid NOT NULL,                      -- instantané, sans clé étrangère : la comptabilité survit au compte
    feature            text NOT NULL,                      -- voir la contrainte ci-dessous
    status             text NOT NULL DEFAULT 'reserved',   -- voir la contrainte ci-dessous
    charge_source      text NOT NULL CHECK (charge_source IN ('free', 'credits', 'subscription', 'exempt')),
    charge_amount      numeric(10, 2) NOT NULL DEFAULT 0,  -- unités débitées (essai gratuit ou crédits achetés)
    refunded           boolean NOT NULL DEFAULT false,
    attempts           integer NOT NULL DEFAULT 0,         -- appels envoyés au fournisseur pour cette génération
    model              text,
    estimated_cost_usd numeric(10, 4) NOT NULL DEFAULT 0,  -- coût fournisseur estimé (voir _shared/ai-cost.ts)
    duration_ms        integer,
    error_code         text,
    created_at         timestamptz NOT NULL DEFAULT now(),
    finished_at        timestamptz
);

-- image = Studio, ad_visual = générateur de visuels publicitaires, feature_image = images de services / formations,
-- product_sheet = fiche produit rédigée par l'IA, video = vidéo. Contrainte recréée à chaque passage (idempotent).
ALTER TABLE public.ai_generation_log DROP CONSTRAINT IF EXISTS ai_generation_log_feature_check;
ALTER TABLE public.ai_generation_log ADD CONSTRAINT ai_generation_log_feature_check
    CHECK (feature IN ('image', 'video', 'ad_visual', 'feature_image', 'product_sheet'));

-- cancelled = rien n'a été livré à payer mais la réservation a été prise (résultat servi depuis le cache, moteur de
-- secours gratuit) : crédit rendu comme pour un échec, sans compter dans les erreurs.
ALTER TABLE public.ai_generation_log DROP CONSTRAINT IF EXISTS ai_generation_log_status_check;
ALTER TABLE public.ai_generation_log ADD CONSTRAINT ai_generation_log_status_check
    CHECK (status IN ('reserved', 'succeeded', 'failed', 'cancelled'));

CREATE INDEX IF NOT EXISTS ai_generation_log_user_created_idx ON public.ai_generation_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_generation_log_open_idx ON public.ai_generation_log (created_at) WHERE status = 'reserved';

ALTER TABLE public.ai_generation_log ENABLE ROW LEVEL SECURITY;

-- Lecture : ses propres lignes, ou tout pour l'équipe fondatrice. Aucune écriture côté client (seul service_role,
-- via les fonctions ci-dessous).
DROP POLICY IF EXISTS "Users read own ai_generation_log" ON public.ai_generation_log;
CREATE POLICY "Users read own ai_generation_log" ON public.ai_generation_log
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_founder_or_master());

REVOKE ALL ON public.ai_generation_log FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.ai_generation_log FROM authenticated;
GRANT SELECT ON public.ai_generation_log TO authenticated;
GRANT ALL ON public.ai_generation_log TO service_role;

-- 2. Réservation --------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_studio_generation(
    _user_id uuid,
    _feature text,
    _daily_cap_usd numeric DEFAULT 5,
    _credit_cost numeric DEFAULT 1
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_spent   numeric;
    v_source  text;
    v_amount  numeric := 0;
    v_sub     record;
    v_profile record;
    v_log     uuid;
BEGIN
    -- Fonctionnalités débitées ici : les images (tout sauf 'video') et la vidéo. La fiche produit passe par record_ai_generation.
    IF _user_id IS NULL OR _feature NOT IN ('image', 'video', 'ad_visual', 'feature_image') THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_request');
    END IF;

    -- Sérialise les demandes d'un même utilisateur : deux clics simultanés ne peuvent pas dépenser le même crédit.
    PERFORM pg_advisory_xact_lock(hashtext('studio_gen:' || _user_id::text));

    -- Plafond de coût du jour (UTC), tous profils.
    SELECT COALESCE(sum(estimated_cost_usd), 0) INTO v_spent
      FROM public.ai_generation_log
     WHERE user_id = _user_id
       AND created_at >= date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc';
    IF v_spent >= _daily_cap_usd THEN
        RETURN jsonb_build_object('success', false, 'error', 'daily_cost_cap', 'spent_usd', v_spent, 'cap_usd', _daily_cap_usd);
    END IF;

    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('founder', 'co_founder')) THEN
        v_source := 'exempt';
    ELSE
        SELECT * INTO v_sub FROM public.subscriptions WHERE user_id = _user_id LIMIT 1;
        IF v_sub.status = 'active' AND (v_sub.end_date IS NULL OR v_sub.end_date > now()) THEN
            v_source := 'subscription';
        ELSE
            SELECT free_generations_remaining, free_video_generations_remaining, COALESCE(purchased_credits, 0) AS purchased_credits
              INTO v_profile
              FROM public.profiles WHERE id = _user_id FOR UPDATE;
            IF NOT FOUND THEN
                RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
            END IF;

            IF _feature <> 'video' AND COALESCE(v_profile.free_generations_remaining, 0) > 0 THEN
                UPDATE public.profiles SET free_generations_remaining = free_generations_remaining - 1, updated_at = now() WHERE id = _user_id;
                v_source := 'free'; v_amount := 1;
            ELSIF _feature = 'video' AND COALESCE(v_profile.free_video_generations_remaining, 0) > 0 THEN
                UPDATE public.profiles SET free_video_generations_remaining = free_video_generations_remaining - 1, updated_at = now() WHERE id = _user_id;
                v_source := 'free'; v_amount := 1;
            ELSIF v_profile.purchased_credits >= _credit_cost THEN
                UPDATE public.profiles SET purchased_credits = purchased_credits - _credit_cost, updated_at = now() WHERE id = _user_id;
                v_source := 'credits'; v_amount := _credit_cost;
            ELSE
                RETURN jsonb_build_object('success', false, 'error', 'credits_required',
                                          'balance', v_profile.purchased_credits, 'needed', _credit_cost);
            END IF;
        END IF;
    END IF;

    INSERT INTO public.ai_generation_log (user_id, feature, charge_source, charge_amount)
    VALUES (_user_id, _feature, v_source, v_amount)
    RETURNING id INTO v_log;

    RETURN jsonb_build_object('success', true, 'log_id', v_log, 'source', v_source, 'charged', v_amount);
END $$;

-- 3. Clôture ------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finish_studio_generation(
    _log_id uuid,
    _status text,
    _attempts integer DEFAULT 0,
    _model text DEFAULT NULL,
    _cost_usd numeric DEFAULT 0,
    _duration_ms integer DEFAULT NULL,
    _error_code text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    r public.ai_generation_log;
    v_refund boolean := false;
BEGIN
    IF _status NOT IN ('succeeded', 'failed', 'cancelled') THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_status');
    END IF;

    -- Idempotent : seule une ligne encore « reserved » peut être clôturée (et donc remboursée) une fois.
    SELECT * INTO r FROM public.ai_generation_log WHERE id = _log_id AND status = 'reserved' FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'already_finished_or_unknown');
    END IF;

    IF _status IN ('failed', 'cancelled') AND r.charge_amount > 0 AND NOT r.refunded THEN
        PERFORM pg_advisory_xact_lock(hashtext('studio_gen:' || r.user_id::text));
        IF r.charge_source = 'credits' THEN
            UPDATE public.profiles SET purchased_credits = COALESCE(purchased_credits, 0) + r.charge_amount, updated_at = now() WHERE id = r.user_id;
        ELSIF r.charge_source = 'free' AND r.feature <> 'video' THEN
            UPDATE public.profiles SET free_generations_remaining = free_generations_remaining + 1, updated_at = now() WHERE id = r.user_id;
        ELSIF r.charge_source = 'free' AND r.feature = 'video' THEN
            UPDATE public.profiles SET free_video_generations_remaining = free_video_generations_remaining + 1, updated_at = now() WHERE id = r.user_id;
        END IF;
        v_refund := true;
    END IF;

    UPDATE public.ai_generation_log
       SET status = _status,
           attempts = GREATEST(0, _attempts),
           model = _model,
           estimated_cost_usd = GREATEST(0, COALESCE(_cost_usd, 0)),
           duration_ms = _duration_ms,
           error_code = CASE WHEN _status = 'succeeded' THEN NULL ELSE COALESCE(_error_code, 'unknown') END,
           refunded = v_refund,
           finished_at = now()
     WHERE id = _log_id;

    RETURN jsonb_build_object('success', true, 'refunded', v_refund);
END $$;

-- 3 bis. Enregistrement direct (sans réservation) ---------------------------------------------------------------------
-- La fiche produit (generate-product-sheet) garde sa règle d'accueil : elle n'est jamais bloquée faute de crédits, et son
-- débit reste celui de consume_ai_credit. Elle écrit donc seulement une ligne déjà terminée, pour le suivi des coûts.
CREATE OR REPLACE FUNCTION public.record_ai_generation(
    _user_id uuid,
    _feature text,
    _status text,
    _charge_source text DEFAULT 'exempt',
    _charge_amount numeric DEFAULT 0,
    _attempts integer DEFAULT 0,
    _model text DEFAULT NULL,
    _cost_usd numeric DEFAULT 0,
    _duration_ms integer DEFAULT NULL,
    _error_code text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
    INSERT INTO public.ai_generation_log
        (user_id, feature, status, charge_source, charge_amount, attempts, model, estimated_cost_usd, duration_ms, error_code, finished_at)
    VALUES
        (_user_id, _feature, _status, _charge_source, GREATEST(0, COALESCE(_charge_amount, 0)), GREATEST(0, COALESCE(_attempts, 0)),
         _model, GREATEST(0, COALESCE(_cost_usd, 0)), _duration_ms, CASE WHEN _status = 'failed' THEN COALESCE(_error_code, 'unknown') END, now())
    RETURNING id INTO v_id;
    RETURN v_id;
END $$;

-- Coût estimé déjà engagé aujourd'hui (UTC) par un utilisateur, pour les fonctions qui contrôlent le plafond sans réserver.
CREATE OR REPLACE FUNCTION public.ai_daily_spend_usd(_user_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COALESCE(sum(estimated_cost_usd), 0)
      FROM public.ai_generation_log
     WHERE user_id = _user_id
       AND created_at >= date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc'
$$;

-- 4. Balayage des réservations abandonnées -----------------------------------------------------------------------
-- Une Edge Function interrompue (délai dépassé, redéploiement) laisse une réservation ouverte et un crédit débité sans
-- résultat. Au-delà de 30 minutes (une vidéo en demande au plus ~12), elle est clôturée en échec et remboursée.
CREATE OR REPLACE FUNCTION public.expire_stale_studio_generations()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    r record;
    n integer := 0;
BEGIN
    FOR r IN
        SELECT id FROM public.ai_generation_log
         WHERE status = 'reserved' AND created_at < now() - interval '30 minutes'
         LIMIT 500
    LOOP
        PERFORM public.finish_studio_generation(r.id, 'failed', 0, NULL, 0, NULL, 'stale_reservation');
        n := n + 1;
    END LOOP;
    RETURN n;
END $$;

-- Ces fonctions débitent des crédits : réservées au serveur (service_role), jamais appelables depuis le navigateur.
REVOKE ALL ON FUNCTION public.start_studio_generation(uuid, text, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_studio_generation(uuid, text, integer, text, numeric, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_stale_studio_generations() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_ai_generation(uuid, text, text, text, numeric, integer, text, numeric, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_daily_spend_usd(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_generation(uuid, text, text, text, numeric, integer, text, numeric, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ai_daily_spend_usd(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_studio_generation(uuid, text, numeric, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_studio_generation(uuid, text, integer, text, numeric, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_studio_generations() TO service_role;

DO $$
DECLARE v_jobid bigint;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'expire-stale-studio-generations';
        IF v_jobid IS NOT NULL THEN
            PERFORM cron.unschedule(v_jobid);
        END IF;
        PERFORM cron.schedule('expire-stale-studio-generations', '*/10 * * * *', 'SELECT public.expire_stale_studio_generations()');
    END IF;
END $$;

-- 5. Vue de pilotage pour l'équipe : coût estimé par jour et par fonction ---------------------------------------------
DROP VIEW IF EXISTS public.ai_generation_cost_daily;
CREATE VIEW public.ai_generation_cost_daily
WITH (security_invoker = true) AS
SELECT date_trunc('day', created_at AT TIME ZONE 'utc')::date AS day,
       feature,
       count(*)                                         AS generations,
       count(*) FILTER (WHERE status = 'succeeded')     AS succeeded,
       count(*) FILTER (WHERE status = 'failed')        AS failed,
       count(*) FILTER (WHERE status = 'cancelled')     AS cancelled,
       count(*) FILTER (WHERE refunded)                 AS refunded,
       sum(attempts)                                    AS provider_calls,
       round(sum(estimated_cost_usd), 2)                AS estimated_cost_usd
  FROM public.ai_generation_log
 GROUP BY 1, 2;

GRANT SELECT ON public.ai_generation_cost_daily TO authenticated;
