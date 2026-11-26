-- Test de 20261126100000_founder_search_shops.sql (boutiques paginées du tableau de bord fondateur).
-- Base JETABLE uniquement (scripts/replay-migrations.sh --keep, conteneur "ecomfy-replay", toutes migrations rejouées).
-- Lancer : docker cp supabase/tests/founder_search_shops.sql ecomfy-replay:/t.sql
--          docker exec ecomfy-replay psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -f /t.sql
-- Attendu : « (0 échecs) » ; tout est annulé par le RAISE EXCEPTION final.

CREATE TEMP TABLE _t (n serial, label text, ok boolean, detail text);
GRANT ALL ON _t TO PUBLIC;
GRANT USAGE ON SEQUENCE _t_n_seq TO PUBLIC;
CREATE FUNCTION pg_temp.chk(l text, c boolean, d text DEFAULT '') RETURNS void LANGUAGE sql AS
$$ INSERT INTO _t(label, ok, detail) VALUES (l, COALESCE(c, false), d) $$;

DO $$
DECLARE
  v_f uuid := gen_random_uuid(); v_m uuid := gen_random_uuid(); v_x uuid := gen_random_uuid();
  r jsonb; p1 jsonb; p2 jsonb; i int;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_f, 'fondateur@pg.test'), (v_m, 'proprio_unique@pg.test'), (v_x, 'autre@pg.test');
  INSERT INTO public.profiles (id, email) VALUES (v_f, 'fondateur@pg.test'), (v_m, 'proprio_unique@pg.test'), (v_x, 'autre@pg.test')
    ON CONFLICT (id) DO UPDATE SET email = excluded.email;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_f, 'founder');
  -- 30 boutiques, toutes créées au même instant : l'ordre doit rester stable d'une page à l'autre.
  FOR i IN 1..30 LOOP
    INSERT INTO public.shops (user_id, business_name, slug, city, whatsapp_number, is_published, is_activated, created_at)
    VALUES (CASE WHEN i <= 2 THEN v_m ELSE v_x END, 'Pagetest ' || i, 'pagetest-' || i,
            CASE WHEN i = 7 THEN 'Korhogo-Test' ELSE 'Abidjan' END, '0700000000', true, true, '2026-01-01');
  END LOOP;

  PERFORM set_config('request.jwt.claim.sub', v_f::text, true);
  SET LOCAL ROLE authenticated;
  p1 := public.founder_search_shops('pagetest', 25, 0);
  p2 := public.founder_search_shops('pagetest', 25, 25);
  RESET ROLE;
  PERFORM pg_temp.chk('total complet', (p1->>'total')::int = 30, p1->>'total');
  PERFORM pg_temp.chk('page 1 : 25 lignes', jsonb_array_length(p1->'rows') = 25);
  PERFORM pg_temp.chk('page 2 : 5 lignes', jsonb_array_length(p2->'rows') = 5);
  PERFORM pg_temp.chk('aucun doublon entre les pages',
    (SELECT count(DISTINCT e->>'id') FROM jsonb_array_elements((p1->'rows') || (p2->'rows')) e) = 30);

  SET LOCAL ROLE authenticated;
  r := public.founder_search_shops('  PROPRIO_UNIQUE@ ', 25, 0);
  RESET ROLE;
  PERFORM pg_temp.chk('recherche par e-mail du propriétaire', (r->>'total')::int = 2, r->>'total');
  PERFORM pg_temp.chk('e-mail renvoyé', r->'rows'->0->>'owner_email' = 'proprio_unique@pg.test', r->'rows'->0->>'owner_email');

  SET LOCAL ROLE authenticated;
  r := public.founder_search_shops('korhogo-test', 25, 0);
  RESET ROLE;
  PERFORM pg_temp.chk('recherche par ville', (r->>'total')::int = 1, r->>'total');

  SET LOCAL ROLE authenticated;
  r := public.founder_search_shops('page%st', 25, 0);
  RESET ROLE;
  PERFORM pg_temp.chk('« % » cherché tel quel', (r->>'total')::int = 0 AND r->'rows' = '[]'::jsonb, r::text);

  SET LOCAL ROLE authenticated;
  r := public.founder_search_shops('pagetest', 100000, -5);
  p2 := public.founder_search_shops('pagetest', 25, 500);
  RESET ROLE;
  PERFORM pg_temp.chk('bornes : décalage négatif toléré', jsonb_array_length(r->'rows') = 30);
  PERFORM pg_temp.chk('page au-delà : vide, total conservé', (p2->>'total')::int = 30 AND p2->'rows' = '[]'::jsonb);

  SET LOCAL ROLE authenticated;
  r := public.founder_search_shops(NULL, 1, 0);
  RESET ROLE;
  PERFORM pg_temp.chk('sans recherche : toutes les boutiques', (r->>'total')::int >= 30 AND jsonb_array_length(r->'rows') = 1);

  -- Un marchand n'obtient rien, même pour des boutiques publiques.
  PERFORM set_config('request.jwt.claim.sub', v_m::text, true);
  SET LOCAL ROLE authenticated;
  r := public.founder_search_shops('pagetest', 25, 0);
  RESET ROLE;
  PERFORM pg_temp.chk('marchand : aucune donnée', r IS NULL, r::text);

  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.founder_search_shops(NULL, 25, 0);
    RESET ROLE;
    PERFORM pg_temp.chk('anon refusé', false, 'aucune erreur');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    PERFORM pg_temp.chk('anon refusé', true);
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
