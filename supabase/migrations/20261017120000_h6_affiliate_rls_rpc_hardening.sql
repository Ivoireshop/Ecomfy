-- H6 : système d'affiliation, politiques RLS et RPC.
--
-- Constats corrigés (migration d'origine 20261005160000, à appliquer avant celle-ci) :
--   * INSERT sur `affiliates` ouvert à tout utilisateur (auth.uid() = user_id) : taux et statut au choix.
--   * INSERT sur `affiliate_referrals` ouvert à tout utilisateur connecté : on pouvait rattacher
--     n'importe quel compte à son propre code.
--   * record_affiliate_referral(p_referred_user_id, ...) et process_affiliate_commission_for_payment(...)
--     appelables par n'importe qui, sans contrôle de l'appelant.
--   * commission calculée sur tous les paiements `completed` (crédits, activation de boutique,
--     commissions de plateforme), jamais annulée en cas de remboursement.
--
-- Après cette migration :
--   * plus aucune écriture directe sur `affiliates` / `affiliate_referrals` pour un utilisateur ;
--     création du profil et du parrainage uniquement par RPC, avec taux imposé par le serveur
--     et filleul = appelant ;
--   * calcul des commissions et annulation réservés à service_role (appelés par les Edge Functions) ;
--   * seuls les types de paiement listés dans affiliate_settings.eligible_payment_types ouvrent droit
--     à commission (par défaut : abonnements) ;
--   * un remboursement annule les commissions non versées et journalise celles déjà versées.
--
-- Idempotent.

-- ---------------------------------------------------------------------
-- 1. Bornes sur les taux
-- ---------------------------------------------------------------------
-- Le taux est une fraction (0.20 = 20 %). Remet à la valeur par défaut les éventuelles lignes
-- déjà falsifiées avant de poser la contrainte.
UPDATE public.affiliates SET commission_rate = 0.20 WHERE commission_rate < 0 OR commission_rate > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'affiliates_commission_rate_range' AND conrelid = 'public.affiliates'::regclass
  ) THEN
    ALTER TABLE public.affiliates
      ADD CONSTRAINT affiliates_commission_rate_range CHECK (commission_rate >= 0 AND commission_rate <= 1);
  END IF;

  -- NOT VALID : n'altère pas l'historique déjà comptabilisé, ne contrôle que les nouvelles lignes.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'affiliate_commissions_rate_range' AND conrelid = 'public.affiliate_commissions'::regclass
  ) THEN
    ALTER TABLE public.affiliate_commissions
      ADD CONSTRAINT affiliate_commissions_rate_range CHECK (commission_rate >= 0 AND commission_rate <= 1) NOT VALID;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. Politiques RLS : plus d'écriture directe pour les utilisateurs
-- ---------------------------------------------------------------------
-- Sans politique INSERT, RLS refuse toute insertion par `authenticated`. Les écritures passent par
-- les RPC SECURITY DEFINER ci-dessous (ou par service_role, qui contourne RLS).
DROP POLICY IF EXISTS "Users can insert own affiliate profile" ON public.affiliates;
DROP POLICY IF EXISTS "Authenticated users can insert referral" ON public.affiliate_referrals;

-- ---------------------------------------------------------------------
-- 3. Paramètre : types de paiement ouvrant droit à commission
-- ---------------------------------------------------------------------
INSERT INTO public.affiliate_settings (key, value)
VALUES ('eligible_payment_types', '["subscription","shop_subscription"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------
-- 4. Création du profil d'affilié (appelant = propriétaire, taux imposé)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_my_affiliate(p_name_hint TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_affiliate public.affiliates%ROWTYPE;
  v_base TEXT;
  v_suffix TEXT;
  v_code TEXT;
  v_counter INT := 1;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_affiliate FROM public.affiliates WHERE user_id = v_uid;
  IF FOUND THEN
    RETURN to_jsonb(v_affiliate);
  END IF;

  -- Base du code : nom sans accents, majuscules, séparateurs ramenés à un tiret, 18 caractères max.
  v_base := upper(translate(
    left(COALESCE(p_name_hint, ''), 80),
    'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖòóôõöÙÚÛÜùúûüÝýÿ',
    'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOoooooUUUUuuuuYyy'
  ));
  v_base := regexp_replace(v_base, '[^A-Z0-9]+', '-', 'g');
  v_base := regexp_replace(v_base, '^-+|-+$', '', 'g');
  IF length(v_base) < 2 OR v_base LIKE 'ECOMFY-USER%' OR v_base LIKE 'UTILISATEUR%' THEN
    v_base := 'USER';
  END IF;
  v_base := regexp_replace(left(v_base, 18), '-+$', '', 'g');
  v_suffix := upper(left(replace(v_uid::text, '-', ''), 4));

  LOOP
    v_code := v_base || '-' || v_suffix || CASE WHEN v_counter > 1 THEN v_counter::text ELSE '' END;
    BEGIN
      INSERT INTO public.affiliates (user_id, affiliate_code, commission_rate, status)
      VALUES (v_uid, v_code, 0.20, 'active')
      RETURNING * INTO v_affiliate;
      RETURN to_jsonb(v_affiliate);
    EXCEPTION WHEN unique_violation THEN
      -- Soit un appel concurrent a créé la ligne de ce compte, soit le code est déjà pris.
      SELECT * INTO v_affiliate FROM public.affiliates WHERE user_id = v_uid;
      IF FOUND THEN
        RETURN to_jsonb(v_affiliate);
      END IF;
      v_counter := v_counter + 1;
      IF v_counter > 100 THEN
        RAISE EXCEPTION 'Impossible de générer un code d''affiliation unique.';
      END IF;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_my_affiliate(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_my_affiliate(TEXT) TO authenticated, service_role;

-- Ancienne variante prenant un user_id : réservée au serveur (déjà révoquée par 20261012150000).
ALTER FUNCTION public.get_or_create_affiliate(UUID) SET search_path = public;
REVOKE ALL ON FUNCTION public.get_or_create_affiliate(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_affiliate(UUID) TO service_role;

-- ---------------------------------------------------------------------
-- 5. Enregistrement d'un parrainage : le filleul est toujours l'appelant
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.record_affiliate_referral(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.record_affiliate_referral(p_affiliate_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_code TEXT := UPPER(TRIM(COALESCE(p_affiliate_code, '')));
  v_affiliate public.affiliates%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;

  IF v_code = '' OR length(v_code) > 64 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code affilié manquant ou invalide');
  END IF;

  SELECT * INTO v_affiliate
  FROM public.affiliates
  WHERE UPPER(affiliate_code) = v_code AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code affilié invalide');
  END IF;

  IF v_affiliate.user_id = v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Auto-parrainage interdit');
  END IF;

  IF EXISTS (SELECT 1 FROM public.affiliate_referrals WHERE referred_user_id = v_uid) THEN
    RETURN jsonb_build_object('success', true, 'already_referred', true);
  END IF;

  -- Pas de rattachement a posteriori : un compte qui a déjà payé ne peut plus être parrainé.
  IF EXISTS (SELECT 1 FROM public.payments WHERE user_id = v_uid AND status = 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parrainage impossible après un premier paiement');
  END IF;

  INSERT INTO public.affiliate_referrals (affiliate_id, referred_user_id, referral_code_used)
  VALUES (v_affiliate.id, v_uid, v_code)
  ON CONFLICT (referred_user_id) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'affiliate_id', v_affiliate.id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_affiliate_referral(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_affiliate_referral(TEXT) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6. Commission sur paiement : serveur uniquement, types de paiement éligibles
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_affiliate_commission_for_payment(p_payment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_referral RECORD;
  v_affiliate RECORD;
  v_period_code TEXT;
  v_payment_type TEXT;
  v_eligible JSONB;
  v_commission_amount NUMERIC(12,2);
  v_commission_id UUID;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;

  IF NOT FOUND OR v_payment.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Paiement introuvable ou non complété');
  END IF;

  IF COALESCE(v_payment.amount, 0) <= 0 THEN
    RETURN jsonb_build_object('success', true, 'not_eligible', true, 'reason', 'montant nul');
  END IF;

  -- Seuls certains types de paiement ouvrent droit à commission (les paiements sans type sont des abonnements).
  v_payment_type := COALESCE(NULLIF(v_payment.metadata->>'payment_type', ''), 'subscription');
  SELECT value INTO v_eligible FROM public.affiliate_settings WHERE key = 'eligible_payment_types';
  IF v_eligible IS NULL OR jsonb_typeof(v_eligible) <> 'array' THEN
    v_eligible := '["subscription","shop_subscription"]'::jsonb;
  END IF;
  IF NOT (v_eligible @> to_jsonb(v_payment_type)) THEN
    RETURN jsonb_build_object('success', true, 'not_eligible', true, 'payment_type', v_payment_type);
  END IF;

  IF EXISTS (SELECT 1 FROM public.affiliate_commissions WHERE payment_id = p_payment_id) THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END IF;

  SELECT * INTO v_referral FROM public.affiliate_referrals WHERE referred_user_id = v_payment.user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'no_referral', true);
  END IF;

  SELECT * INTO v_affiliate FROM public.affiliates WHERE id = v_referral.affiliate_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Affilié inactif ou non trouvé');
  END IF;

  SELECT code INTO v_period_code FROM public.affiliate_payout_periods
  WHERE CURRENT_DATE BETWEEN start_date AND end_date
  ORDER BY start_date DESC LIMIT 1;

  IF v_period_code IS NULL THEN
    v_period_code := '2026-Q4';
  END IF;

  v_commission_amount := ROUND((v_payment.amount * v_affiliate.commission_rate)::numeric, 2);

  INSERT INTO public.affiliate_commissions (
    affiliate_id, referred_user_id, payment_id, amount_paid,
    commission_rate, commission_amount, status, period_code, notes
  ) VALUES (
    v_affiliate.id, v_payment.user_id, v_payment.id, v_payment.amount,
    v_affiliate.commission_rate, v_commission_amount, 'PAYABLE', v_period_code,
    'Commission automatique sur paiement (' || v_payment_type || ', ' || v_payment.amount || ' FCFA)'
  )
  ON CONFLICT (payment_id) DO NOTHING
  RETURNING id INTO v_commission_id;

  IF v_commission_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'commission_id', v_commission_id,
    'amount', v_commission_amount,
    'affiliate_id', v_affiliate.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_affiliate_commission_for_payment(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_affiliate_commission_for_payment(UUID) TO service_role;

-- ---------------------------------------------------------------------
-- 7. Remboursement : annule la commission non versée, journalise celle déjà versée
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reverse_affiliate_commission_for_payment(p_payment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reversed INT := 0;
  v_paid INT := 0;
BEGIN
  WITH reversed AS (
    UPDATE public.affiliate_commissions
    SET status = 'REVERSED',
        notes = COALESCE(notes || ' | ', '') || 'Annulée : paiement remboursé',
        updated_at = now()
    WHERE payment_id = p_payment_id AND status IN ('PENDING', 'APPROVED', 'PAYABLE')
    RETURNING id, affiliate_id, commission_amount
  ), logged AS (
    INSERT INTO public.affiliate_audit_logs (affiliate_id, action, details)
    SELECT affiliate_id, 'COMMISSION_REVERSED',
           jsonb_build_object('payment_id', p_payment_id, 'commission_id', id, 'commission_amount', commission_amount)
    FROM reversed
  )
  SELECT count(*) INTO v_reversed FROM reversed;

  -- Déjà versée : pas d'annulation automatique, trace pour récupération manuelle.
  WITH paid AS (
    SELECT id, affiliate_id, commission_amount
    FROM public.affiliate_commissions
    WHERE payment_id = p_payment_id AND status = 'PAID'
  ), logged AS (
    INSERT INTO public.affiliate_audit_logs (affiliate_id, action, details)
    SELECT affiliate_id, 'REFUND_AFTER_PAYOUT',
           jsonb_build_object('payment_id', p_payment_id, 'commission_id', id, 'commission_amount', commission_amount)
    FROM paid
  )
  SELECT count(*) INTO v_paid FROM paid;

  RETURN jsonb_build_object('success', true, 'reversed', v_reversed, 'already_paid', v_paid);
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_affiliate_commission_for_payment(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_affiliate_commission_for_payment(UUID) TO service_role;

-- ---------------------------------------------------------------------
-- 8. Versement manuel : contrôle fondateur déjà dans la fonction ; ajoute search_path et ferme anon
-- ---------------------------------------------------------------------
ALTER FUNCTION public.mark_affiliate_payout_paid(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) SET search_path = public;
REVOKE ALL ON FUNCTION public.mark_affiliate_payout_paid(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_affiliate_payout_paid(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
