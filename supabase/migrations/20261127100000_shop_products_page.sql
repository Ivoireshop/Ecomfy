-- Pagination côté serveur (lot 4C) : le tableau des produits d'une boutique est lu page par page ; la recherche,
-- les filtres, les tris et le nombre de commandes par produit sont donc calculés par la base.
-- SECURITY INVOKER : chaque appelant ne lit et ne compte que les lignes que ses droits (RLS) lui ouvrent,
-- comme lorsque le navigateur faisait ces calculs sur les lignes reçues.

-- Comparaison de noms sans majuscules ni accents.
CREATE OR REPLACE FUNCTION public.normalize_product_label(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT btrim(regexp_replace(normalize(lower(COALESCE(_value, '')), NFD), E'[\u0300-\u036f]', '', 'g'))
$$;

-- Produits cités dans le résumé d'une ancienne commande. Les noms arrivent du plus long au plus court : chaque nom
-- trouvé est retiré du résumé, pour qu'un nom contenu dans un autre ne soit compté que s'il est cité à part
-- (« Terminus kooko » ne compte pas dans « Terminus kooko homme fort »).
CREATE OR REPLACE FUNCTION public.legacy_summary_labels(_summary text, _labels text[])
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_rest text := _summary;
  v_label text;
  v_found text[] := '{}';
BEGIN
  FOREACH v_label IN ARRAY _labels LOOP
    IF position(v_label IN v_rest) > 0 THEN
      v_found := v_found || v_label;
      v_rest := replace(v_rest, v_label, chr(10));
    END IF;
  END LOOP;
  RETURN v_found;
END;
$$;

-- Nombre de commandes distinctes par produit (une commande compte une fois, quelle que soit la quantité).
-- Les anciennes commandes sans ligne d'article citent le produit dans products_summary : rapprochement par nom,
-- et seulement pour elles (sinon « Sac » comptait dans une commande de « Sac à dos »).
CREATE OR REPLACE FUNCTION public.shop_product_order_counts(_shop_id uuid, _product_ids uuid[])
RETURNS TABLE (product_id uuid, order_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  -- Les droits (RLS) sont évalués ligne par ligne : commandes et lignes d'article ne sont lues qu'une fois
  -- (MATERIALIZED), et chaque nom ou résumé n'est normalisé qu'une fois.
  WITH shop_orders AS MATERIALIZED (
    SELECT o.id, o.products_summary
      FROM public.orders o
     WHERE o.shop_id = _shop_id AND cardinality(_product_ids) > 0
  ),
  items AS MATERIALIZED (
    SELECT i.order_id, i.product_id
      FROM public.order_items i
     WHERE i.order_id = ANY (ARRAY(SELECT s.id FROM shop_orders s))
  ),
  legacy AS MATERIALIZED (
    SELECT s.id, public.normalize_product_label(s.products_summary) AS summary
      FROM shop_orders s
     WHERE COALESCE(s.products_summary, '') <> ''
       AND NOT EXISTS (SELECT 1 FROM items i WHERE i.order_id = s.id)
  ),
  names AS MATERIALIZED (
    -- Deux produits de même nom : un seul reçoit les commandes rapprochées par le nom (le dernier du catalogue).
    SELECT DISTINCT ON (l.label) l.id, l.label
      FROM (SELECT p.id, p.display_order, public.normalize_product_label(p.name) AS label
              FROM public.products p
             WHERE p.shop_id = _shop_id AND EXISTS (SELECT 1 FROM legacy)) l
     WHERE l.label <> ''
     ORDER BY l.label, l.display_order DESC NULLS FIRST, l.id DESC
  ),
  candidates AS (
    SELECT s.id AS order_id, s.summary, array_agg(n.label ORDER BY length(n.label) DESC, n.label) AS labels
      FROM legacy s
      JOIN names n ON position(n.label IN s.summary) > 0
     GROUP BY s.id, s.summary
  ),
  matches AS (
    SELECT i.product_id, i.order_id
      FROM items i
     WHERE i.product_id = ANY (_product_ids)
    UNION
    SELECT n.id, c.order_id
      FROM candidates c
     CROSS JOIN LATERAL unnest(public.legacy_summary_labels(c.summary, c.labels)) AS m(label)
      JOIN names n ON n.label = m.label
     WHERE n.id = ANY (_product_ids)
  )
  SELECT m.product_id, count(*) FROM matches m GROUP BY m.product_id
$$;

-- Une page du tableau des produits : { total, categories, rows: [produit + product_images + order_count] }.
CREATE OR REPLACE FUNCTION public.shop_products_page(
  _shop_id uuid,
  _search text DEFAULT '',
  _status text DEFAULT 'all',
  _category text DEFAULT NULL,
  _sort text DEFAULT 'recent',
  _limit integer DEFAULT 20,
  _offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_search text := lower(btrim(COALESCE(_search, '')));
  v_limit integer := LEAST(GREATEST(COALESCE(_limit, 20), 1), 100);
  v_offset integer := GREATEST(COALESCE(_offset, 0), 0);
  v_matching uuid[];
  v_page uuid[];
  v_rows jsonb;
BEGIN
  SELECT COALESCE(array_agg(p.id), '{}')
    INTO v_matching
    FROM public.products p
   WHERE p.shop_id = _shop_id
     AND (v_search = ''
          OR position(v_search IN lower(COALESCE(p.name, ''))) > 0
          OR position(v_search IN lower(COALESCE(p.sku, ''))) > 0
          OR position(v_search IN lower(COALESCE(p.category, ''))) > 0)
     AND (COALESCE(_status, 'all') = 'all'
          OR (_status = 'published' AND p.is_published IS TRUE)
          OR (_status = 'draft' AND p.is_published IS NOT TRUE)
          -- Stock vide = illimité : ce n'est pas une rupture.
          OR (_status = 'out_of_stock' AND p.stock_quantity <= 0))
     AND (_category IS NULL OR p.category = _category);

  -- Le comptage des commandes de tout le catalogue n'est fait que si le tri en dépend.
  SELECT COALESCE(array_agg(s.id ORDER BY s.rank), '{}')
    INTO v_page
    FROM (
      SELECT p.id,
             row_number() OVER (ORDER BY
               CASE WHEN _sort = 'name_asc' THEN public.normalize_product_label(p.name) END ASC,
               CASE WHEN _sort = 'name_desc' THEN public.normalize_product_label(p.name) END DESC,
               CASE WHEN _sort = 'price_asc' THEN p.price END ASC,
               CASE WHEN _sort = 'price_desc' THEN p.price END DESC,
               CASE WHEN _sort = 'orders_desc' THEN COALESCE(c.order_count, 0) END DESC,
               CASE WHEN _sort = 'stock_asc' THEN p.stock_quantity END ASC NULLS LAST,
               p.created_at DESC NULLS LAST,
               p.id
             ) AS rank
        FROM public.products p
        LEFT JOIN public.shop_product_order_counts(
               _shop_id, CASE WHEN _sort = 'orders_desc' THEN v_matching ELSE '{}'::uuid[] END) c
          ON c.product_id = p.id
       WHERE p.id = ANY (v_matching)
       ORDER BY rank
       LIMIT v_limit OFFSET v_offset
    ) s;

  SELECT COALESCE(jsonb_agg(
           to_jsonb(p) || jsonb_build_object(
             'order_count', COALESCE(c.order_count, 0),
             'product_images', COALESCE((
               SELECT jsonb_agg(jsonb_build_object('id', i.id, 'image_url', i.image_url,
                                                   'is_primary', i.is_primary, 'display_order', i.display_order)
                                ORDER BY i.is_primary DESC NULLS LAST, i.display_order, i.id)
                 FROM public.product_images i
                WHERE i.product_id = p.id), '[]'::jsonb))
           ORDER BY u.rank), '[]'::jsonb)
    INTO v_rows
    FROM unnest(v_page) WITH ORDINALITY AS u(id, rank)
    JOIN public.products p ON p.id = u.id
    LEFT JOIN public.shop_product_order_counts(_shop_id, v_page) c ON c.product_id = p.id;

  RETURN jsonb_build_object(
    'total', cardinality(v_matching),
    'categories', COALESCE((SELECT jsonb_agg(DISTINCT p.category ORDER BY p.category)
                              FROM public.products p
                             WHERE p.shop_id = _shop_id AND COALESCE(p.category, '') <> ''), '[]'::jsonb),
    'rows', v_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.shop_product_order_counts(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.shop_products_page(uuid, text, text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_product_order_counts(uuid, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.shop_products_page(uuid, text, text, text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_product_label(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.legacy_summary_labels(text, text[]) TO authenticated, service_role;
