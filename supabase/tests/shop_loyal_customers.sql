-- Test de 20261127150000_shop_loyal_customers.sql.
-- Base JETABLE uniquement (scripts/replay-migrations.sh --keep, conteneur "ecomfy-replay", toutes migrations rejouées).
-- Lancer : docker cp supabase/tests/shop_loyal_customers.sql ecomfy-replay:/t.sql
--          docker exec ecomfy-replay psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -f /t.sql
-- Attendu : « (0 échecs) » ; tout se passe dans une transaction que l'erreur finale annule.

BEGIN;

CREATE TEMP TABLE _t (n serial, label text, ok boolean, detail text);
GRANT ALL ON _t TO PUBLIC;
GRANT USAGE ON SEQUENCE _t_n_seq TO PUBLIC;
CREATE FUNCTION pg_temp.chk(l text, c boolean, d text DEFAULT '') RETURNS void LANGUAGE sql AS
$$ INSERT INTO _t(label, ok, detail) VALUES (l, COALESCE(c, false), d) $$;
-- Noms des clients d'une réponse, dans l'ordre reçu.
CREATE FUNCTION pg_temp.names(r jsonb) RETURNS text LANGUAGE sql AS
$$ SELECT COALESCE(string_agg(e->>'customer_name', '|' ORDER BY o), '') FROM jsonb_array_elements(r->'rows') WITH ORDINALITY AS x(e, o) $$;

DO $$
DECLARE
  v_owner uuid := gen_random_uuid(); v_x uuid := gen_random_uuid();
  v_reader uuid := gen_random_uuid(); v_market uuid := gen_random_uuid();
  v_s uuid; v_s2 uuid; v_big uuid; v_locked uuid;
  r jsonb; a jsonb;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_owner, 'marchand@prod.test'), (v_x, 'autre@prod.test'),
    (v_reader, 'lecture@prod.test'), (v_market, 'marketing@prod.test');

  ALTER TABLE public.shops DISABLE TRIGGER USER;
  ALTER TABLE public.orders DISABLE TRIGGER USER;
  ALTER TABLE public.shop_collaborators DISABLE TRIGGER USER;

  INSERT INTO public.shops (user_id, business_name, slug) VALUES (v_owner, 'Fideles', 'fideles-test') RETURNING id INTO v_s;
  INSERT INTO public.shops (user_id, business_name, slug) VALUES (v_x, 'Voisine', 'fideles-voisine') RETURNING id INTO v_s2;
  INSERT INTO public.shops (user_id, business_name, slug) VALUES (v_owner, 'Grande', 'fideles-grande') RETURNING id INTO v_big;
  INSERT INTO public.shops (user_id, business_name, slug, shop_payment_status) VALUES (v_owner, 'Bloquee', 'fideles-bloquee', 'locked') RETURNING id INTO v_locked;
  INSERT INTO public.shop_collaborators (shop_id, user_id, invited_email, roles, status, invitation_token, invited_by)
  VALUES (v_s, v_reader, 'lecture@prod.test', ARRAY['view_orders'], 'active', gen_random_uuid()::text, v_owner),
         (v_s, v_market, 'marketing@prod.test', ARRAY['manage_catalog'], 'active', gen_random_uuid()::text, v_owner);

  -- Aïcha : 5 commandes sous trois écritures du même numéro ; le nom, la ville et l'e-mail les plus récents l'emportent.
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, customer_email, customer_city, total, created_at)
  VALUES (v_s, 'A-1', 'Aicha ancienne', '0707070707', 'vieux@mail.test', 'Daloa', 1000, now() - interval '9 days'),
         (v_s, 'A-2', 'Aicha', '+225 07 07 07 07 07', 'aicha@mail.test', 'Bouaké', 1000, now() - interval '8 days'),
         (v_s, 'A-3', 'Aicha', '002250707070707', NULL, NULL, 1000, now() - interval '7 days'),
         (v_s, 'A-4', 'Aicha', '07 07 07 07 07', NULL, NULL, 1000, now() - interval '6 days'),
         (v_s, 'A-5', '  Aïcha Koné ', '+2250707070707', '', '', 1000, now() - interval '5 days');
  -- Binta : 3 commandes (or) ; une annulée et une retournée en plus, ignorées.
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, total, order_status, created_at)
  VALUES (v_s, 'B-1', 'Binta', '0101010101', 2000, 'delivered', now() - interval '5 days'),
         (v_s, 'B-2', 'Binta', '0101010101', 2000, 'new', now() - interval '4 days'),
         (v_s, 'B-3', 'Binta', '0101010101', 2000, 'confirmed', now() - interval '3 days'),
         (v_s, 'B-4', 'Binta annulée', '0101010101', 90000, 'cancelled', now() - interval '2 days'),
         (v_s, 'B-5', 'Binta retour', '0101010101', 90000, 'returned', now() - interval '1 day');
  -- Cheick et Dia : 2 commandes (argent), Dia dépense plus.
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, total, created_at)
  VALUES (v_s, 'C-1', 'Cheick', '0303030303', 500, now() - interval '2 days'),
         (v_s, 'C-2', 'Cheick', '0303030303', 500, now() - interval '1 day'),
         (v_s, 'D-1', 'Dia', '0404040404', 4000, now() - interval '20 days'),
         (v_s, 'D-2', 'Dia', '0404040404', 4000, now() - interval '19 days');
  -- Sans téléphone : regroupé par e-mail ; sans les deux : ignoré. Nom vide : « Client ».
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, customer_email, total, created_at)
  VALUES (v_s, 'E-1', 'Eve', '', ' EVE@mail.test ', 700, now() - interval '11 days'),
         (v_s, 'E-2', 'Eve', '', 'eve@mail.test', 700, now() - interval '10 days'),
         (v_s, 'F-1', 'Fantôme', '', NULL, 999, now()),
         (v_s, 'H-1', '   ', '0505050505', NULL, 300, now() - interval '30 days');
  -- Client seulement annulé : absent.
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, total, order_status)
  VALUES (v_s, 'Z-1', 'Zoé', '0909090909', 100, 'cancelled');
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, total) VALUES (v_s2, 'V-1', 'Voisin', '0707070707', 5);
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, total) VALUES (v_locked, 'L-1', 'Secret', '0808080808', 5);
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, total, created_at)
  SELECT v_big, 'G-' || g, 'C' || g, '07' || lpad(g::text, 8, '0'), g, now() - (g || ' minutes')::interval FROM generate_series(1, 1200) g;

  ALTER TABLE public.shops ENABLE TRIGGER USER;
  ALTER TABLE public.orders ENABLE TRIGGER USER;
  ALTER TABLE public.shop_collaborators ENABLE TRIGGER USER;

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  SET LOCAL ROLE authenticated;

  r := public.shop_loyal_customers(v_s);
  PERFORM pg_temp.chk('classement : commandes puis montant', pg_temp.names(r) = 'Aïcha Koné|Binta|Dia|Eve|Cheick|Client', pg_temp.names(r));
  PERFORM pg_temp.chk('indicateurs', r->'stats' = '{"customers":6,"repeating":5,"platine":1,"or":1,"argent":3,"bronze":1,"repeat_revenue":21400}'::jsonb, (r->'stats')::text);
  PERFORM pg_temp.chk('total', (r->>'total')::int = 6 AND NOT (r->>'restricted')::boolean, r::text);
  a := r->'rows'->0;
  PERFORM pg_temp.chk('même numéro sous trois écritures', (a->>'order_count')::int = 5 AND (a->>'total_spent')::numeric = 5000 AND a->>'id' = '07070707', a::text);
  PERFORM pg_temp.chk('nom et numéro les plus récents', a->>'customer_name' = 'Aïcha Koné' AND a->>'customer_phone' = '+2250707070707', a::text);
  PERFORM pg_temp.chk('dernière valeur renseignée (ville, e-mail)', a->>'delivery_city' = 'Bouaké' AND a->>'customer_email' = 'aicha@mail.test', a::text);
  PERFORM pg_temp.chk('première et dernière commande',
    (a->>'last_order_date')::timestamptz - (a->>'first_order_date')::timestamptz = interval '4 days' AND a->>'tier' = 'platine', a::text);
  a := r->'rows'->1;
  PERFORM pg_temp.chk('annulées et retournées ignorées', (a->>'order_count')::int = 3 AND (a->>'total_spent')::numeric = 6000 AND a->>'customer_name' = 'Binta' AND a->>'tier' = 'or', a::text);
  a := r->'rows'->3;
  PERFORM pg_temp.chk('sans téléphone : regroupé par e-mail', a->>'id' = 'eve@mail.test' AND (a->>'order_count')::int = 2 AND a->>'customer_phone' = '', a::text);
  PERFORM pg_temp.chk('ni téléphone ni e-mail, ou tout annulé : absent', position('Fantôme' in r::text) = 0 AND position('Zoé' in r::text) = 0);
  PERFORM pg_temp.chk('absence d''e-mail : null', r->'rows'->2->'customer_email' = 'null'::jsonb AND r->'rows'->2->'delivery_city' = 'null'::jsonb, (r->'rows'->2)::text);

  PERFORM pg_temp.chk('niveau fidèles', pg_temp.names(public.shop_loyal_customers(v_s, _tier => 'repeating')) = 'Aïcha Koné|Binta|Dia|Eve|Cheick');
  PERFORM pg_temp.chk('niveau platine', pg_temp.names(public.shop_loyal_customers(v_s, _tier => 'platine')) = 'Aïcha Koné');
  PERFORM pg_temp.chk('niveau or', pg_temp.names(public.shop_loyal_customers(v_s, _tier => 'or')) = 'Binta');
  PERFORM pg_temp.chk('niveau argent', pg_temp.names(public.shop_loyal_customers(v_s, _tier => 'argent')) = 'Dia|Eve|Cheick');
  PERFORM pg_temp.chk('niveau première commande', pg_temp.names(public.shop_loyal_customers(v_s, _tier => 'bronze')) = 'Client');
  PERFORM pg_temp.chk('niveau inconnu : aucun client', (public.shop_loyal_customers(v_s, _tier => 'diamant')->>'total')::int = 0);

  r := public.shop_loyal_customers(v_s, _search => '  AICHA kone ');
  PERFORM pg_temp.chk('recherche par nom sans accents', pg_temp.names(r) = 'Aïcha Koné' AND (r->>'total')::int = 1, pg_temp.names(r));
  PERFORM pg_temp.chk('les indicateurs ignorent la recherche', (r->'stats'->>'customers')::int = 6, (r->'stats')::text);
  PERFORM pg_temp.chk('recherche par ville', pg_temp.names(public.shop_loyal_customers(v_s, _search => 'bouake')) = 'Aïcha Koné');
  PERFORM pg_temp.chk('recherche par e-mail', pg_temp.names(public.shop_loyal_customers(v_s, _search => 'eve@')) = 'Eve');
  PERFORM pg_temp.chk('numéro saisi avec des espaces', pg_temp.names(public.shop_loyal_customers(v_s, _search => '07 07 07')) = 'Aïcha Koné');
  PERFORM pg_temp.chk('texte avec chiffres : pas une recherche de numéro', (public.shop_loyal_customers(v_s, _search => 'jean #7')->>'total')::int = 0);
  PERFORM pg_temp.chk('« % » est ordinaire', (public.shop_loyal_customers(v_s, _search => '%')->>'total')::int = 0);
  PERFORM pg_temp.chk('recherche et niveau combinés', (public.shop_loyal_customers(v_s, _search => 'binta', _tier => 'argent')->>'total')::int = 0);

  r := public.shop_loyal_customers(v_s, _limit => 2, _offset => 2);
  PERFORM pg_temp.chk('deuxième page', pg_temp.names(r) = 'Dia|Eve' AND (r->>'total')::int = 6, pg_temp.names(r));
  r := public.shop_loyal_customers(v_s, _limit => 2, _offset => 40);
  PERFORM pg_temp.chk('page au-delà : vide avec le total', r->'rows' = '[]'::jsonb AND (r->>'total')::int = 6, r::text);

  r := public.shop_loyal_customers(v_big, _limit => 20, _offset => 1180);
  PERFORM pg_temp.chk('au-delà de 1 000 clients', (r->>'total')::int = 1200 AND jsonb_array_length(r->'rows') = 20
    AND r->'rows'->19->>'customer_name' = 'C1', pg_temp.names(r));
  r := public.shop_loyal_customers(v_big, _limit => 5000);
  PERFORM pg_temp.chk('limite plafonnée à 1 000', jsonb_array_length(r->'rows') = 1000, jsonb_array_length(r->'rows')::text);

  r := public.shop_loyal_customers(v_locked);
  PERFORM pg_temp.chk('boutique restreinte : signalée, aucune ligne', (r->>'restricted')::boolean AND r->'rows' = '[]'::jsonb AND position('Secret' in r::text) = 0, r::text);
  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', v_reader::text, true);
  SET LOCAL ROLE authenticated;
  r := public.shop_loyal_customers(v_s);
  RESET ROLE;
  PERFORM pg_temp.chk('collaborateur « voir les commandes »', (r->>'total')::int = 6, r::text);

  PERFORM set_config('request.jwt.claim.sub', v_market::text, true);
  SET LOCAL ROLE authenticated;
  r := public.shop_loyal_customers(v_s);
  RESET ROLE;
  PERFORM pg_temp.chk('collaborateur sans droit sur les commandes : rien', (r->>'total')::int = 0 AND r->'rows' = '[]'::jsonb, r::text);

  PERFORM set_config('request.jwt.claim.sub', v_x::text, true);
  SET LOCAL ROLE authenticated;
  r := public.shop_loyal_customers(v_s);
  RESET ROLE;
  PERFORM pg_temp.chk('un étranger ne voit rien', (r->>'total')::int = 0 AND (r->'stats'->>'customers')::int = 0 AND r->'rows' = '[]'::jsonb, r::text);

  PERFORM pg_temp.chk('refusé sans connexion',
    NOT has_function_privilege('anon', 'public.shop_loyal_customers(uuid,text,text,integer,integer)', 'execute'));
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
