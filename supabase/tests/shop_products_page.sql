-- Test de 20261127100000_shop_products_page.sql.
-- Base JETABLE uniquement (scripts/replay-migrations.sh --keep, conteneur "ecomfy-replay", toutes migrations rejouées).
-- Lancer : docker cp supabase/tests/shop_products_page.sql ecomfy-replay:/t.sql
--          docker exec ecomfy-replay psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -f /t.sql
-- Attendu : « (0 échecs) » ; tout se passe dans une transaction que l'erreur finale annule.

BEGIN;

CREATE TEMP TABLE _t (n serial, label text, ok boolean, detail text);
GRANT ALL ON _t TO PUBLIC;
GRANT USAGE ON SEQUENCE _t_n_seq TO PUBLIC;
CREATE FUNCTION pg_temp.chk(l text, c boolean, d text DEFAULT '') RETURNS void LANGUAGE sql AS
$$ INSERT INTO _t(label, ok, detail) VALUES (l, COALESCE(c, false), d) $$;
-- Noms des produits d'une réponse, dans l'ordre reçu.
CREATE FUNCTION pg_temp.names(r jsonb) RETURNS text LANGUAGE sql AS
$$ SELECT COALESCE(string_agg(e->>'name', '|' ORDER BY o), '') FROM jsonb_array_elements(r->'rows') WITH ORDINALITY AS x(e, o) $$;
CREATE FUNCTION pg_temp.orders_of(r jsonb, wanted text) RETURNS int LANGUAGE sql AS
$$ SELECT (e->>'order_count')::int FROM jsonb_array_elements(r->'rows') e WHERE e->>'name' = wanted $$;

DO $$
DECLARE
  v_owner uuid := gen_random_uuid(); v_x uuid := gen_random_uuid(); v_s uuid; v_s2 uuid; v_s3 uuid;
  v_sac uuid; v_dos uuid; v_creme uuid; v_lampe uuid; v_autre uuid; v_o uuid;
  r jsonb; img jsonb;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_owner, 'marchand@prod.test'), (v_x, 'autre@prod.test');

  ALTER TABLE public.shops DISABLE TRIGGER USER;
  ALTER TABLE public.products DISABLE TRIGGER USER;
  ALTER TABLE public.orders DISABLE TRIGGER USER;
  ALTER TABLE public.order_items DISABLE TRIGGER USER;

  INSERT INTO public.shops (user_id, business_name, slug) VALUES (v_owner, 'Catalogue', 'catalogue-test') RETURNING id INTO v_s;
  INSERT INTO public.shops (user_id, business_name, slug) VALUES (v_x, 'Voisine', 'voisine-test') RETURNING id INTO v_s2;

  INSERT INTO public.products (shop_id, name, slug, sku, category, price, stock_quantity, is_published, display_order, created_at)
  VALUES (v_s, 'Sac', 'sac', 'REF-001', 'Mode', 3000, 0, true, 1, now() - interval '4 days') RETURNING id INTO v_sac;
  INSERT INTO public.products (shop_id, name, slug, sku, category, price, stock_quantity, is_published, display_order, created_at)
  VALUES (v_s, 'Sac à dos', 'sac-a-dos', 'REF-002', 'Mode', 9000, 3, true, 2, now() - interval '3 days') RETURNING id INTO v_dos;
  INSERT INTO public.products (shop_id, name, slug, sku, category, price, stock_quantity, is_published, display_order, created_at)
  VALUES (v_s, 'Crème 100%', 'creme', NULL, 'Beauté', 1000, NULL, false, 3, now() - interval '2 days') RETURNING id INTO v_creme;
  INSERT INTO public.products (shop_id, name, slug, sku, category, price, stock_quantity, is_published, display_order, created_at)
  VALUES (v_s, 'Écran', 'ecran', 'LUM_9', 'Maison', 5000, 20, true, 4, now() - interval '1 day') RETURNING id INTO v_lampe;
  INSERT INTO public.products (shop_id, name, slug, category, price, stock_quantity, is_published)
  VALUES (v_s2, 'Sac', 'sac', 'Autre', 1, 1, false) RETURNING id INTO v_autre;

  INSERT INTO public.product_images (product_id, image_url, is_primary, display_order)
  VALUES (v_sac, 'b', false, 0), (v_sac, 'c', false, 2), (v_sac, 'a', true, 5);

  -- Commande 1 : deux lignes du même produit (compte une fois) ; son résumé cite « Sac » mais elle a des lignes.
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, products_summary)
  VALUES (v_s, 'P-1', 'C', '1', 'Sac à dos x2') RETURNING id INTO v_o;
  INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
  VALUES (v_o, v_dos, 'Sac à dos', 1, 9000, 9000), (v_o, v_dos, 'Sac à dos', 1, 9000, 9000);
  -- Commande 2 : une ligne.
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone)
  VALUES (v_s, 'P-2', 'C', '1') RETURNING id INTO v_o;
  INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
  VALUES (v_o, v_dos, 'Sac à dos', 3, 9000, 27000);
  -- Anciennes commandes sans ligne : rapprochement par le nom, sans accents ni majuscules.
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, products_summary)
  VALUES (v_s, 'P-3', 'C', '1', 'CREME 100% x1'), (v_s, 'P-4', 'C', '1', 'ecran x2'),
         (v_s, 'P-5', 'C', '1', 'Ecran, Creme 100%'), (v_s, 'P-6', 'C', '1', 'rien de connu'), (v_s, 'P-7', 'C', '1', 'écran');
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, products_summary)
  VALUES (v_s2, 'V-1', 'C', '1', 'Sac, Ecran');
  -- Boutique aux noms imbriqués : « Kooko » est contenu dans « Kooko homme fort ».
  INSERT INTO public.shops (user_id, business_name, slug) VALUES (v_owner, 'Imbriques', 'imbriques-test') RETURNING id INTO v_s3;
  INSERT INTO public.products (shop_id, name, slug, price, display_order)
  VALUES (v_s3, 'Kooko', 'kooko', 1, 1), (v_s3, 'Kooko homme fort', 'kooko-hf', 2, 2), (v_s3, 'Homme', 'homme', 3, 3);
  INSERT INTO public.orders (shop_id, order_number, customer_name, customer_phone, products_summary)
  VALUES (v_s3, 'I-1', 'C', '1', 'Kooko homme fort x1'), (v_s3, 'I-2', 'C', '1', 'kooko x2'),
         (v_s3, 'I-3', 'C', '1', 'Kooko x1, Kooko homme fort x1'), (v_s3, 'I-4', 'C', '1', 'Homme x1'),
         (v_s3, 'I-5', 'C', '1', 'Kooko homme fort, Kooko homme fort');

  ALTER TABLE public.shops ENABLE TRIGGER USER;
  ALTER TABLE public.products ENABLE TRIGGER USER;
  ALTER TABLE public.orders ENABLE TRIGGER USER;
  ALTER TABLE public.order_items ENABLE TRIGGER USER;

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  SET LOCAL ROLE authenticated;

  r := public.shop_products_page(v_s);
  PERFORM pg_temp.chk('plus récents d''abord, la boutique seulement', pg_temp.names(r) = 'Écran|Crème 100%|Sac à dos|Sac' AND (r->>'total')::int = 4, r::text);
  PERFORM pg_temp.chk('catégories de la boutique', r->'categories' @> '["Beauté","Maison","Mode"]' AND jsonb_array_length(r->'categories') = 3, (r->'categories')::text);
  PERFORM pg_temp.chk('commandes distinctes par lignes d''article', pg_temp.orders_of(r, 'Sac à dos') = 2, r::text);
  PERFORM pg_temp.chk('rapprochement par nom sans accents', pg_temp.orders_of(r, 'Crème 100%') = 2 AND pg_temp.orders_of(r, 'Écran') = 3, r::text);
  PERFORM pg_temp.chk('« Sac » ne compte pas dans une commande à lignes de « Sac à dos »', pg_temp.orders_of(r, 'Sac') = 0, r::text);
  img := (SELECT e->'product_images' FROM jsonb_array_elements(r->'rows') e WHERE e->>'name' = 'Sac');
  PERFORM pg_temp.chk('images : principale puis ordre choisi',
    (img->0->>'image_url') = 'a' AND (img->1->>'image_url') = 'b' AND (img->2->>'image_url') = 'c', img::text);
  PERFORM pg_temp.chk('toutes les colonnes du produit', (r->'rows'->0) ?& array['slug','description','variants','is_published','created_at','sku'], (r->'rows'->0)::text);

  r := public.shop_products_page(v_s, _limit => 3, _offset => 3);
  PERFORM pg_temp.chk('deuxième page', pg_temp.names(r) = 'Sac' AND (r->>'total')::int = 4, r::text);
  r := public.shop_products_page(v_s, _limit => 3, _offset => 30);
  PERFORM pg_temp.chk('page au-delà : vide avec le total', r->'rows' = '[]'::jsonb AND (r->>'total')::int = 4, r::text);

  r := public.shop_products_page(v_s, _search => '  SAC ');
  PERFORM pg_temp.chk('recherche par nom', pg_temp.names(r) = 'Sac à dos|Sac', pg_temp.names(r));
  r := public.shop_products_page(v_s, _search => 'ref-002');
  PERFORM pg_temp.chk('recherche par référence', pg_temp.names(r) = 'Sac à dos', pg_temp.names(r));
  r := public.shop_products_page(v_s, _search => 'beauté');
  PERFORM pg_temp.chk('recherche par catégorie', pg_temp.names(r) = 'Crème 100%', pg_temp.names(r));
  r := public.shop_products_page(v_s, _search => '%');
  PERFORM pg_temp.chk('« % » est un caractère ordinaire', pg_temp.names(r) = 'Crème 100%', pg_temp.names(r));
  r := public.shop_products_page(v_s, _search => 'zzz');
  PERFORM pg_temp.chk('aucun résultat, catégories conservées', (r->>'total')::int = 0 AND jsonb_array_length(r->'categories') = 3, r::text);

  r := public.shop_products_page(v_s, _status => 'published');
  PERFORM pg_temp.chk('visibles', pg_temp.names(r) = 'Écran|Sac à dos|Sac', pg_temp.names(r));
  r := public.shop_products_page(v_s, _status => 'draft');
  PERFORM pg_temp.chk('brouillons', pg_temp.names(r) = 'Crème 100%', pg_temp.names(r));
  r := public.shop_products_page(v_s, _status => 'out_of_stock');
  PERFORM pg_temp.chk('rupture : stock illimité exclu', pg_temp.names(r) = 'Sac', pg_temp.names(r));
  r := public.shop_products_page(v_s, _category => 'Mode', _search => 'dos');
  PERFORM pg_temp.chk('filtres combinés', pg_temp.names(r) = 'Sac à dos', pg_temp.names(r));

  r := public.shop_products_page(v_s, _sort => 'name_asc');
  PERFORM pg_temp.chk('nom A→Z (accents ignorés)', pg_temp.names(r) = 'Crème 100%|Écran|Sac|Sac à dos', pg_temp.names(r));
  r := public.shop_products_page(v_s, _sort => 'name_desc');
  PERFORM pg_temp.chk('nom Z→A', pg_temp.names(r) = 'Sac à dos|Sac|Écran|Crème 100%', pg_temp.names(r));
  r := public.shop_products_page(v_s, _sort => 'price_asc');
  PERFORM pg_temp.chk('prix croissant', pg_temp.names(r) = 'Crème 100%|Sac|Écran|Sac à dos', pg_temp.names(r));
  r := public.shop_products_page(v_s, _sort => 'price_desc');
  PERFORM pg_temp.chk('prix décroissant', pg_temp.names(r) = 'Sac à dos|Écran|Sac|Crème 100%', pg_temp.names(r));
  r := public.shop_products_page(v_s, _sort => 'stock_asc');
  PERFORM pg_temp.chk('stock faible, illimité en dernier', pg_temp.names(r) = 'Sac|Sac à dos|Écran|Crème 100%', pg_temp.names(r));
  r := public.shop_products_page(v_s, _sort => 'orders_desc');
  PERFORM pg_temp.chk('plus commandés (à égalité : plus récent)', pg_temp.names(r) = 'Écran|Crème 100%|Sac à dos|Sac', pg_temp.names(r));
  r := public.shop_products_page(v_s, _sort => 'orders_desc', _limit => 2, _offset => 2);
  PERFORM pg_temp.chk('tri par commandes sur la deuxième page', pg_temp.names(r) = 'Sac à dos|Sac' AND pg_temp.orders_of(r, 'Sac à dos') = 2, r::text);
  r := public.shop_products_page(v_s3);
  PERFORM pg_temp.chk('nom long : compté une fois par commande qui le cite', pg_temp.orders_of(r, 'Kooko homme fort') = 3, r::text);
  PERFORM pg_temp.chk('nom court : seulement quand il est cité à part', pg_temp.orders_of(r, 'Kooko') = 2, r::text);
  PERFORM pg_temp.chk('un mot d''un nom plus long ne compte pas', pg_temp.orders_of(r, 'Homme') = 1, r::text);
  r := public.shop_products_page(v_s3, _search => 'kooko', _sort => 'orders_desc', _limit => 1, _offset => 1);
  PERFORM pg_temp.chk('même compte quand le nom long est hors de la page', pg_temp.orders_of(r, 'Kooko') = 2, r::text);
  RESET ROLE;

  PERFORM set_config('request.jwt.claim.sub', v_x::text, true);
  SET LOCAL ROLE authenticated;
  r := public.shop_products_page(v_s);
  RESET ROLE;
  PERFORM pg_temp.chk('un étranger ne voit rien d''une boutique non publiée', (r->>'total')::int = 0 AND r->'categories' = '[]'::jsonb, r::text);

  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.shop_products_page(v_s);
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
