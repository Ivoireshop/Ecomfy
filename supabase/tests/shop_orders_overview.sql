-- Test de 20261127110000_shop_orders_overview.sql.
-- Base JETABLE uniquement (scripts/replay-migrations.sh --keep, conteneur "ecomfy-replay", toutes migrations rejouées).
-- Lancer : docker cp supabase/tests/shop_orders_overview.sql ecomfy-replay:/t.sql
--          docker exec ecomfy-replay psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -f /t.sql
-- Attendu : « (0 échecs) » ; tout se passe dans une transaction que l'erreur finale annule.

BEGIN;

CREATE TEMP TABLE _t (n serial, label text, ok boolean, detail text);
GRANT ALL ON _t TO PUBLIC;
GRANT USAGE ON SEQUENCE _t_n_seq TO PUBLIC;
CREATE FUNCTION pg_temp.chk(l text, c boolean, d text DEFAULT '') RETURNS void LANGUAGE sql AS
$$ INSERT INTO _t(label, ok, detail) VALUES (l, COALESCE(c, false), d) $$;
-- Cumul « nombre/montant » d'un jour de la réponse.
CREATE FUNCTION pg_temp.day_of(r jsonb, wanted date) RETURNS text LANGUAGE sql AS
$$ SELECT COALESCE((SELECT (e->>'count') || '/' || (e->>'total')::numeric::bigint FROM jsonb_array_elements(r->'days') e WHERE e->>'day' = to_char(wanted, 'YYYY-MM-DD')), '0/0') $$;

DO $$
DECLARE
  v_owner uuid := gen_random_uuid(); v_x uuid := gen_random_uuid();
  v_reader uuid := gen_random_uuid(); v_market uuid := gen_random_uuid();
  v_s uuid; v_s2 uuid; v_empty uuid; v_locked uuid;
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_noon timestamptz;
  v_late timestamptz;
  r jsonb;
BEGIN
  v_noon := (v_today + time '00:00:01') AT TIME ZONE 'UTC';
  v_late := (v_today + time '20:00') AT TIME ZONE 'UTC';
  INSERT INTO auth.users (id, email) VALUES (v_owner, 'marchand@prod.test'), (v_x, 'autre@prod.test'),
    (v_reader, 'lecture@prod.test'), (v_market, 'marketing@prod.test');

  ALTER TABLE public.shops DISABLE TRIGGER USER;
  ALTER TABLE public.orders DISABLE TRIGGER USER;
  ALTER TABLE public.shop_collaborators DISABLE TRIGGER USER;

  INSERT INTO public.shops (user_id, business_name, slug) VALUES (v_owner, 'Ventes', 'ventes-test') RETURNING id INTO v_s;
  INSERT INTO public.shops (user_id, business_name, slug) VALUES (v_x, 'Voisine', 'voisine-o-test') RETURNING id INTO v_s2;
  INSERT INTO public.shops (user_id, business_name, slug) VALUES (v_owner, 'Vide', 'vide-test') RETURNING id INTO v_empty;
  INSERT INTO public.shops (user_id, business_name, slug, shop_payment_status, is_suspended)
  VALUES (v_owner, 'Bloquee', 'bloquee-test', 'locked', false) RETURNING id INTO v_locked;
  INSERT INTO public.shop_collaborators (shop_id, user_id, invited_email, roles, status, invitation_token, invited_by)
  VALUES (v_s, v_reader, 'lecture@prod.test', ARRAY['view_orders'], 'active', gen_random_uuid()::text, v_owner),
         (v_s, v_market, 'marketing@prod.test', ARRAY['manage_catalog'], 'active', gen_random_uuid()::text, v_owner),
         (v_locked, v_reader, 'lecture@prod.test', ARRAY['view_orders'], 'active', gen_random_uuid()::text, v_owner);

  -- 1 200 commandes anciennes (au-delà du plafond de 1 000 lignes), lues.
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, total, order_status, is_read, created_at)
  SELECT v_s, 'A-' || g, 'Ancien', '1', 10, 'delivered', true, now() - interval '90 days' - (g || ' seconds')::interval
    FROM generate_series(1, 1200) g;
  -- Aujourd'hui : deux ventes (dont une non lue), une annulée et une retournée.
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, total, order_status, is_read, created_at)
  VALUES (v_s, 'J-1', 'Awa', '0700000001', 1000, 'new', false, v_noon),
         (v_s, 'J-2', 'Binta', '0700000002', 2000, 'confirmed', true, v_late),
         (v_s, 'J-3', 'Cheick', '0700000003', 4000, 'cancelled', false, v_noon + interval '1 second'),
         (v_s, 'J-4', 'Dia', '0700000004', 8000, 'returned', true, v_noon + interval '2 seconds'),
         (v_s, 'H-1', 'Eve', '0700000005', 500, 'delivered', true, v_noon - interval '1 day'),
         (v_s, 'V-1', 'Fanta', '0700000006', 70, 'delivered', true, now() - interval '70 days');
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, total, order_status, is_read)
  VALUES (v_s2, 'X-1', 'Voisin', '1', 999999, 'new', false),
         (v_locked, 'L-1', 'Secret', '0700000009', 300, 'new', false);

  ALTER TABLE public.shops ENABLE TRIGGER USER;
  ALTER TABLE public.orders ENABLE TRIGGER USER;
  ALTER TABLE public.shop_collaborators ENABLE TRIGGER USER;

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  SET LOCAL ROLE authenticated;

  r := public.shop_orders_overview(v_s);
  PERFORM pg_temp.chk('toutes les commandes comptées (plus de 1 000)', (r->>'total_count')::int = 1206, r->>'total_count');
  PERFORM pg_temp.chk('non lues', (r->>'unread_count')::int = 2, r->>'unread_count');
  PERFORM pg_temp.chk('cumul hors annulées et retournées', (r->>'revenue_total')::numeric = 12000 + 1000 + 2000 + 500 + 70, r->>'revenue_total');
  PERFORM pg_temp.chk('aujourd''hui', pg_temp.day_of(r, v_today) = '2/3000', (r->'days')::text);
  PERFORM pg_temp.chk('hier', pg_temp.day_of(r, v_today - 1) = '1/500', (r->'days')::text);
  PERFORM pg_temp.chk('rien d''antérieur au mois ou à J-6',
    NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'days') e WHERE (e->>'day')::date < LEAST(date_trunc('month', v_today)::date, v_today - 6)), (r->'days')::text);
  PERFORM pg_temp.chk('4 dernières commandes, de la plus récente à la plus ancienne',
    (SELECT string_agg(e->>'order_number', '|' ORDER BY o) FROM jsonb_array_elements(r->'recent') WITH ORDINALITY x(e, o)) = 'J-2|J-4|J-3|J-1', (r->'recent')::text);
  PERFORM pg_temp.chk('colonnes des commandes récentes', (r->'recent'->0) ?& array['id','order_number','customer_name','total','order_status','is_read','created_at']
    AND NOT (r->'recent'->0) ? 'customer_phone', (r->'recent'->0)::text);

  r := public.shop_orders_overview(v_s, 'Asia/Tokyo');
  PERFORM pg_temp.chk('jour du fuseau demandé', pg_temp.day_of(r, (v_late AT TIME ZONE 'Asia/Tokyo')::date) = '1/2000', (r->'days')::text);
  r := public.shop_orders_overview(v_s, 'Nulle/Part');
  PERFORM pg_temp.chk('fuseau inconnu : UTC', pg_temp.day_of(r, v_today) = '2/3000', (r->'days')::text);
  r := public.shop_orders_overview(v_s, NULL);
  PERFORM pg_temp.chk('fuseau absent : UTC', pg_temp.day_of(r, v_today) = '2/3000', (r->'days')::text);

  r := public.shop_orders_overview(v_empty);
  PERFORM pg_temp.chk('boutique sans commande', r = '{"total_count":0,"unread_count":0,"revenue_total":0,"days":[],"recent":[]}'::jsonb, r::text);

  r := public.shop_orders_overview(v_locked);
  PERFORM pg_temp.chk('boutique restreinte : le propriétaire garde ses chiffres', (r->>'total_count')::int = 1 AND (r->>'revenue_total')::numeric = 300, r::text);
  PERFORM pg_temp.chk('boutique restreinte : nom masqué', r->'recent'->0->>'customer_name' = '••••••••' AND position('Secret' in r::text) = 0, r::text);
  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', v_reader::text, true);
  SET LOCAL ROLE authenticated;
  r := public.shop_orders_overview(v_s);
  PERFORM pg_temp.chk('collaborateur « voir les commandes »', (r->>'total_count')::int = 1206, r->>'total_count');
  r := public.shop_orders_overview(v_locked);
  PERFORM pg_temp.chk('collaborateur d''une boutique restreinte : masqué', (r->>'total_count')::int = 1 AND position('Secret' in r::text) = 0, r::text);
  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', v_market::text, true);
  SET LOCAL ROLE authenticated;
  r := public.shop_orders_overview(v_s);
  RESET ROLE;
  PERFORM pg_temp.chk('collaborateur sans droit sur les commandes : rien (comme avant)', (r->>'total_count')::int = 0 AND r->'recent' = '[]'::jsonb, r::text);

  PERFORM set_config('request.jwt.claim.sub', v_x::text, true);
  SET LOCAL ROLE authenticated;
  r := public.shop_orders_overview(v_s);
  PERFORM pg_temp.chk('un étranger ne voit rien', (r->>'total_count')::int = 0 AND (r->>'revenue_total')::numeric = 0, r::text);
  BEGIN
    PERFORM public.shop_orders_overview(v_locked);
    PERFORM pg_temp.chk('étranger sur boutique restreinte : refusé', false, 'aucune erreur');
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.chk('étranger sur boutique restreinte : refusé', true);
  END;
  RESET ROLE;

  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.shop_orders_overview(v_s);
    RESET ROLE;
    PERFORM pg_temp.chk('refusé sans connexion', false, 'aucune erreur');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    PERFORM pg_temp.chk('refusé sans connexion', true);
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
