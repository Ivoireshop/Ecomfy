-- Fix product image persistence for collaborator accounts and keep a stable primary image.
-- Product text could be saved by edit_shop collaborators, but product_images had only
-- owner/public policies, so image rows failed to insert/select after upload.

DROP POLICY IF EXISTS "Collaborators edit_shop can view product images" ON public.product_images;
CREATE POLICY "Collaborators edit_shop can view product images"
ON public.product_images
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = product_images.product_id
      AND public.is_shop_collaborator(p.shop_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "Collaborators edit_shop can manage product images" ON public.product_images;
CREATE POLICY "Collaborators edit_shop can manage product images"
ON public.product_images
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = product_images.product_id
      AND public.has_shop_role(p.shop_id, auth.uid(), 'edit_shop')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = product_images.product_id
      AND public.has_shop_role(p.shop_id, auth.uid(), 'edit_shop')
  )
);

-- Ensure products with images always have exactly one primary candidate for display.
CREATE OR REPLACE FUNCTION public.ensure_product_primary_image(_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  primary_id uuid;
BEGIN
  SELECT id INTO primary_id
  FROM public.product_images
  WHERE product_id = _product_id
  ORDER BY is_primary DESC, display_order ASC NULLS LAST, created_at ASC
  LIMIT 1;

  IF primary_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.product_images
  SET is_primary = (id = primary_id),
      display_order = CASE WHEN id = primary_id THEN 0 ELSE COALESCE(display_order, 1) END
  WHERE product_id = _product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_product_images_keep_primary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.ensure_product_primary_image(OLD.product_id);
    RETURN OLD;
  END IF;

  IF NEW.is_primary THEN
    UPDATE public.product_images
    SET is_primary = false
    WHERE product_id = NEW.product_id
      AND id <> NEW.id;
  END IF;

  PERFORM public.ensure_product_primary_image(NEW.product_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_images_keep_primary ON public.product_images;
CREATE TRIGGER product_images_keep_primary
AFTER INSERT OR UPDATE OF is_primary, display_order OR DELETE ON public.product_images
FOR EACH ROW EXECUTE FUNCTION public.trg_product_images_keep_primary();

-- Backfill only metadata, not image URLs/files, so existing working fiches are not broken.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT product_id FROM public.product_images LOOP
    PERFORM public.ensure_product_primary_image(r.product_id);
  END LOOP;
END $$;
