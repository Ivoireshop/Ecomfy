-- Produits : méta titre et méta description propres à chaque fiche (éditeur de produit, section « SEO »).
-- Avant, ces deux champs s'affichaient dans l'éditeur mais n'étaient enregistrés nulle part : ce qui était saisi
-- disparaissait à la fermeture. La fiche publique les utilise désormais pour <title>, la description des moteurs de
-- recherche et le partage (Open Graph) ; vides, elle garde le nom du produit et son résumé court.
-- Idempotent. Le front fonctionne avant et après cette migration (il n'envoie ces champs que s'ils sont remplis
-- ou si la colonne existe déjà).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_seo_title_length') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_seo_title_length CHECK (seo_title IS NULL OR char_length(seo_title) <= 200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_seo_description_length') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_seo_description_length CHECK (seo_description IS NULL OR char_length(seo_description) <= 500);
  END IF;
END $$;
