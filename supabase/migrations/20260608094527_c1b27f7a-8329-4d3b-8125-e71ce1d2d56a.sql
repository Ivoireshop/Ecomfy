
CREATE OR REPLACE FUNCTION public.get_public_product_page(
  p_shop_slug text,
  p_product_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop public.shops_public%ROWTYPE;
  v_product jsonb;
  v_related jsonb;
BEGIN
  SELECT * INTO v_shop FROM public.shops_public WHERE slug = p_shop_slug LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('shop', null, 'product', null, 'related', '[]'::jsonb);
  END IF;

  SELECT to_jsonb(p) || jsonb_build_object(
    'product_images', COALESCE((
      SELECT jsonb_agg(to_jsonb(pi) ORDER BY pi.display_order NULLS LAST, pi.id)
      FROM public.product_images pi WHERE pi.product_id = p.id
    ), '[]'::jsonb)
  )
  INTO v_product
  FROM public.products p
  WHERE p.shop_id = v_shop.id
    AND p.slug = p_product_slug
    AND p.is_published = true
  LIMIT 1;

  IF v_product IS NULL THEN
    RETURN jsonb_build_object('shop', to_jsonb(v_shop), 'product', null, 'related', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) INTO v_related FROM (
    SELECT to_jsonb(p) || jsonb_build_object(
      'product_images', COALESCE((
        SELECT jsonb_agg(to_jsonb(pi) ORDER BY pi.display_order NULLS LAST, pi.id)
        FROM public.product_images pi WHERE pi.product_id = p.id
      ), '[]'::jsonb)
    ) AS row
    FROM public.products p
    WHERE p.shop_id = v_shop.id
      AND p.is_published = true
      AND p.id <> (v_product->>'id')::uuid
    ORDER BY p.created_at DESC
    LIMIT 4
  ) sub;

  RETURN jsonb_build_object(
    'shop', to_jsonb(v_shop),
    'product', v_product,
    'related', v_related
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_product_page(text, text) TO anon, authenticated, service_role;

-- Index to speed up the public lookup (no-op if it already exists)
CREATE INDEX IF NOT EXISTS idx_products_shop_slug_published
  ON public.products (shop_id, slug) WHERE is_published = true;
