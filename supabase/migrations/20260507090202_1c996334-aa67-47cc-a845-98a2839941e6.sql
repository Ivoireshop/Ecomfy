-- Helper that checks if a shop is publicly visible, bypassing RLS on shops
CREATE OR REPLACE FUNCTION public.is_shop_publicly_visible(_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops
    WHERE id = _shop_id
      AND is_published = true
      AND is_activated = true
      AND COALESCE(is_suspended, false) = false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_shop_publicly_visible(uuid) TO anon, authenticated;

-- Replace the products SELECT policy
DROP POLICY IF EXISTS "Anyone can view published products" ON public.products;
CREATE POLICY "Anyone can view published products"
ON public.products
FOR SELECT
TO anon, authenticated
USING (is_published = true AND public.is_shop_publicly_visible(shop_id));

-- Replace the product_images SELECT policy
DROP POLICY IF EXISTS "Anyone can view product images" ON public.product_images;
CREATE POLICY "Anyone can view product images"
ON public.product_images
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_images.product_id
      AND p.is_published = true
      AND public.is_shop_publicly_visible(p.shop_id)
  )
);