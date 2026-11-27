-- Test de 20261126130000_delivery_affiliate_summaries.sql.
-- Base JETABLE uniquement (scripts/replay-migrations.sh --keep, conteneur "ecomfy-replay", toutes migrations rejouées).
-- Lancer : docker cp supabase/tests/delivery_affiliate_summaries.sql ecomfy-replay:/t.sql
--          docker exec ecomfy-replay psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -f /t.sql
-- Attendu : « (0 échecs) » ; tout se passe dans une transaction que l'erreur finale annule.

BEGIN;

CREATE TEMP TABLE _t (n serial, label text, ok boolean, detail text);
GRANT ALL ON _t TO PUBLIC;
GRANT USAGE ON SEQUENCE _t_n_seq TO PUBLIC;
CREATE FUNCTION pg_temp.chk(l text, c boolean, d text DEFAULT '') RETURNS void LANGUAGE sql AS
$$ INSERT INTO _t(label, ok, detail) VALUES (l, COALESCE(c, false), d) $$;

DO $$
DECLARE
  v_owner uuid := gen_random_uuid(); v_driver_user uuid := gen_random_uuid(); v_x uuid := gen_random_uuid();
  v_aff_user uuid := gen_random_uuid(); v_c uuid; v_c2 uuid; v_drv uuid; v_a uuid; v_a2 uuid; v_ref uuid; v_period text;
  v_today date := (now() AT TIME ZONE 'UTC')::date; v_late timestamptz; r jsonb; r2 jsonb; day jsonb;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_owner, 'gerant@ov.test'), (v_driver_user, 'livreur@ov.test'),
    (v_x, 'autre@ov.test'), (v_aff_user, 'affilie@ov.test');

  ALTER TABLE public.delivery_companies DISABLE TRIGGER USER;
  ALTER TABLE public.delivery_drivers DISABLE TRIGGER USER;
  ALTER TABLE public.delivery_company_staff DISABLE TRIGGER USER;
  ALTER TABLE public.delivery_dispatches DISABLE TRIGGER USER;

  INSERT INTO public.delivery_companies (user_id, company_name, country, city, headquarters_address, manager_name, manager_phone, manager_whatsapp, verification_status)
  VALUES (v_owner, 'Vue Ensemble', 'CI', 'Abidjan', 'Rue', 'M', '+2250700000001', '+2250700000001', 'approved') RETURNING id INTO v_c;
  INSERT INTO public.delivery_companies (user_id, company_name, country, city, headquarters_address, manager_name, manager_phone, manager_whatsapp, verification_status)
  VALUES (v_x, 'Autre', 'CI', 'Abidjan', 'Rue', 'M', '+2250700000002', '+2250700000002', 'approved') RETURNING id INTO v_c2;
  INSERT INTO public.delivery_drivers (company_id, full_name, first_name, last_name, phone, vehicle_type, license_categories, license_expiry, id_expiry, photo_url, national_id_photo_url, license_photo_url, verification_status, is_active)
  VALUES (v_c, 'Livreur Un', 'Livreur', 'Un', '1', 'car', ARRAY['B'], v_today + 400, v_today + 400, 'p', 'i', 'l', 'approved', true) RETURNING id INTO v_drv;
  INSERT INTO public.delivery_company_staff (company_id, invited_email, user_id, role, status, driver_id)
  VALUES (v_c, 'livreur@ov.test', v_driver_user, 'driver', 'active', v_drv);

  -- 23 h 30 UTC la veille : déjà « aujourd'hui » à Nairobi (UTC+3).
  v_late := ((v_today - 1)::timestamp + interval '23 hours 30 minutes') AT TIME ZONE 'UTC';

  -- 3 reçues aujourd'hui, 1 reçue tard hier, 1 vieille de 60 jours, 1 d'une autre structure.
  INSERT INTO public.delivery_dispatches (company_id, status, city, delivery_address, recipient_name, recipient_phone, cod_amount, delivery_fee, transmitted_at, created_at, delivered_at, failed_at, returned_at, assigned_driver_id)
  VALUES
    (v_c, 'transmitted', 'Abidjan', 'A', 'R1', '1', 0, 0, now(), now(), NULL, NULL, NULL, NULL),
    (v_c, 'delivered',   'Abidjan', 'A', 'R2', '2', 0, 0, now(), now(), now(), NULL, NULL, v_drv),
    (v_c, 'failed',      'Abidjan', 'A', 'R3', '3', 0, 0, NULL,  now(), NULL, now(), NULL, v_drv),
    (v_c, 'returned',    'Abidjan', 'A', 'R4', '4', 0, 0, v_late, v_late, NULL, NULL, now(), NULL),
    (v_c, 'completed',   'Abidjan', 'A', 'R5', '5', 0, 0, now() - interval '60 days', now() - interval '60 days', now() - interval '60 days', NULL, NULL, NULL),
    (v_c2, 'transmitted','Abidjan', 'A', 'R6', '6', 0, 0, now(), now(), NULL, NULL, NULL, NULL);

  ALTER TABLE public.delivery_companies ENABLE TRIGGER USER;
  ALTER TABLE public.delivery_drivers ENABLE TRIGGER USER;
  ALTER TABLE public.delivery_company_staff ENABLE TRIGGER USER;
  ALTER TABLE public.delivery_dispatches ENABLE TRIGGER USER;

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  SET LOCAL ROLE authenticated;
  r := public.delivery_company_overview(v_c, 30, 'UTC');
  r2 := public.delivery_company_overview(v_c, 30, 'Africa/Nairobi');
  RESET ROLE;
  PERFORM pg_temp.chk('états : la structure seulement, anciennes comprises',
    r->'by_status' = '{"transmitted":1,"delivered":1,"failed":1,"returned":1,"completed":1}'::jsonb, (r->'by_status')::text);
  day := (SELECT e FROM jsonb_array_elements(r->'daily') e WHERE e->>'day' = v_today::text);
  PERFORM pg_temp.chk('aujourd''hui : reçues (dont sans date de transmission)', (day->>'received')::int = 3, day::text);
  PERFORM pg_temp.chk('aujourd''hui : livrées, échouées, retournées',
    (day->>'delivered')::int = 1 AND (day->>'failed')::int = 1 AND (day->>'returned')::int = 1, day::text);
  PERFORM pg_temp.chk('la course de 60 jours n''est pas dans l''activité',
    NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'daily') e WHERE (e->>'day')::date < v_today - 29), (r->'daily')::text);
  PERFORM pg_temp.chk('jours du plus récent au plus ancien', (r->'daily'->0->>'day') = v_today::text, (r->'daily')::text);
  PERFORM pg_temp.chk('en temps universel, la course tardive compte la veille',
    (SELECT (e->>'received')::int FROM jsonb_array_elements(r->'daily') e WHERE e->>'day' = (v_today - 1)::text) = 1, (r->'daily')::text);
  PERFORM pg_temp.chk('fuseau du navigateur : la même course compte le lendemain',
    NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r2->'daily') e WHERE e->>'day' = (v_today - 1)::text)
    AND (SELECT sum((e->>'received')::int) FROM jsonb_array_elements(r2->'daily') e) = 4, (r2->'daily')::text);

  SET LOCAL ROLE authenticated;
  r := public.delivery_company_overview(v_c, 30, 'Mars/Olympus');
  r2 := public.delivery_company_overview(v_c, 90, 'UTC');
  RESET ROLE;
  PERFORM pg_temp.chk('fuseau inconnu : temps universel', (r->'daily'->0->>'day') = v_today::text, r::text);
  PERFORM pg_temp.chk('période de 90 jours : la vieille course apparaît',
    EXISTS (SELECT 1 FROM jsonb_array_elements(r2->'daily') e WHERE (e->>'day')::date < v_today - 29), (r2->'daily')::text);

  PERFORM set_config('request.jwt.claim.sub', v_driver_user::text, true);
  SET LOCAL ROLE authenticated;
  r := public.delivery_company_overview(v_c, 30, 'UTC');
  RESET ROLE;
  PERFORM pg_temp.chk('un livreur ne compte que ses missions', r->'by_status' = '{"delivered":1,"failed":1}'::jsonb, r::text);

  PERFORM set_config('request.jwt.claim.sub', v_aff_user::text, true);
  SET LOCAL ROLE authenticated;
  r := public.delivery_company_overview(v_c, 30, 'UTC');
  RESET ROLE;
  PERFORM pg_temp.chk('un étranger ne voit rien', r->'by_status' = '{}'::jsonb AND r->'daily' = '[]'::jsonb, r::text);

  -- ---------------- Affiliation ----------------
  SELECT code INTO v_period FROM public.affiliate_payout_periods ORDER BY start_date LIMIT 1;
  INSERT INTO public.affiliates (user_id, affiliate_code) VALUES (v_aff_user, 'OVTEST1')
    ON CONFLICT (user_id) DO UPDATE SET affiliate_code = excluded.affiliate_code RETURNING id INTO v_a;
  INSERT INTO public.affiliates (user_id, affiliate_code) VALUES (v_x, 'OVTEST2')
    ON CONFLICT (user_id) DO UPDATE SET affiliate_code = excluded.affiliate_code RETURNING id INTO v_a2;
  INSERT INTO public.affiliate_referrals (affiliate_id, referred_user_id, referral_code_used) VALUES (v_a, v_owner, 'OVTEST1'), (v_a, v_driver_user, 'OVTEST1');
  INSERT INTO public.affiliate_commissions (affiliate_id, referred_user_id, amount_paid, commission_amount, status)
  VALUES (v_a, v_owner, 1000, 100, 'PAYABLE'), (v_a, v_owner, 1000, 200, 'APPROVED'), (v_a, v_driver_user, 1000, 400, 'PAID'),
         (v_a, v_x, 1000, 800, 'PENDING'), (v_a, v_x, 1000, 1600, 'CANCELLED'), (v_a, v_x, 1000, 3200, 'REVERSED'),
         (v_a2, v_owner, 1000, 6400, 'PAYABLE');
  INSERT INTO public.affiliate_payouts (affiliate_id, amount_paid, payment_method) VALUES (v_a, 400, 'wave');

  SET LOCAL ROLE authenticated;
  r := public.affiliate_summary(v_a);
  r2 := public.affiliate_summary(v_a2);
  RESET ROLE;
  PERFORM pg_temp.chk('montants : attente, payable (dont approuvé), payé',
    (r->>'pending_amount')::numeric = 800 AND (r->>'payable_amount')::numeric = 300 AND (r->>'paid_amount')::numeric = 400, r::text);
  PERFORM pg_temp.chk('clients payants distincts, hors attente et annulés', (r->>'paid_customers')::int = 2, r::text);
  PERFORM pg_temp.chk('compteurs des onglets',
    (r->>'commissions_count')::int = 6 AND (r->>'referred_count')::int = 2 AND (r->>'payouts_count')::int = 1, r::text);
  PERFORM pg_temp.chk('rien du compte d''un autre affilié',
    (r2->>'payable_amount')::numeric = 0 AND (r2->>'commissions_count')::int = 0, r2::text);

  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.affiliate_summary(v_a);
    RESET ROLE;
    PERFORM pg_temp.chk('affiliation refusée sans connexion', false, 'aucune erreur');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    PERFORM pg_temp.chk('affiliation refusée sans connexion', true);
  END;
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.delivery_company_overview(v_c, 30, 'UTC');
    RESET ROLE;
    PERFORM pg_temp.chk('vue d''ensemble refusée sans connexion', false, 'aucune erreur');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    PERFORM pg_temp.chk('vue d''ensemble refusée sans connexion', true);
  END;
END $$;

DO $$
DECLARE r record; total int; bad int;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE NOT ok) INTO total, bad FROM _t;
  FOR r IN SELECT * FROM _t ORDER BY n LOOP
    RAISE NOTICE '% % %', CASE WHEN r.ok THEN 'OK   ' ELSE 'ECHEC' END, r.label, CASE WHEN r.ok THEN '' ELSE r.detail END;
  END LOOP;
  RAISE EXCEPTION 'Fin du test : % cas (% échecs) — annulation volontaire', total, bad;
END $$;
