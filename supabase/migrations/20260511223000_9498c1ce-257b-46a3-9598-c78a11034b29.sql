
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS slug text;

CREATE OR REPLACE FUNCTION public.slugify(_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' from
    regexp_replace(
      regexp_replace(
        lower(unaccent(coalesce(_value, ''))),
        '[^a-z0-9]+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  );
$$;

DO $$
DECLARE
  r record;
  base text;
  candidate text;
  n int;
BEGIN
  FOR r IN SELECT id, shop_id, name FROM public.products WHERE slug IS NULL OR slug = '' LOOP
    base := public.slugify(r.name);
    IF base IS NULL OR base = '' THEN base := 'produit'; END IF;
    candidate := base;
    n := 1;
    WHILE EXISTS (
      SELECT 1 FROM public.products
      WHERE shop_id = r.shop_id AND slug = candidate AND id <> r.id
    ) LOOP
      n := n + 1;
      candidate := base || '-' || n;
    END LOOP;
    UPDATE public.products SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS products_shop_slug_unique
  ON public.products (shop_id, slug);

CREATE OR REPLACE FUNCTION public.ensure_product_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base text;
  candidate text;
  n int := 1;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := public.slugify(NEW.name);
  ELSE
    base := public.slugify(NEW.slug);
    IF base IS NULL OR base = '' THEN base := public.slugify(NEW.name); END IF;
  END IF;
  IF base IS NULL OR base = '' THEN base := 'produit'; END IF;

  candidate := base;
  WHILE EXISTS (
    SELECT 1 FROM public.products
    WHERE shop_id = NEW.shop_id AND slug = candidate AND id <> NEW.id
  ) LOOP
    n := n + 1;
    candidate := base || '-' || n;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_ensure_slug ON public.products;
CREATE TRIGGER trg_products_ensure_slug
BEFORE INSERT OR UPDATE OF slug, name ON public.products
FOR EACH ROW EXECUTE FUNCTION public.ensure_product_slug();
