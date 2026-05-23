
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS domain_verification_code TEXT,
  ADD COLUMN IF NOT EXISTS domain_status TEXT DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS domain_last_check TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS ssl_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS dns_propagation_percentage INTEGER DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shops_custom_domain
  ON public.shops (LOWER(custom_domain))
  WHERE custom_domain IS NOT NULL AND custom_domain <> '';

CREATE OR REPLACE FUNCTION public.generate_shop_domain_verification_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  verification_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    verification_code := 'visualpro-shop-' || LOWER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 16));
    SELECT EXISTS(
      SELECT 1 FROM public.shops WHERE domain_verification_code = verification_code
    ) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN verification_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_shop_domain_verification_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.custom_domain IS NOT NULL AND NEW.custom_domain <> '' AND
     (OLD.custom_domain IS NULL OR OLD.custom_domain = '' OR OLD.custom_domain <> NEW.custom_domain) THEN
    NEW.domain_verification_code := public.generate_shop_domain_verification_code();
    NEW.domain_status := 'pending_verification';
    NEW.dns_propagation_percentage := 0;
    NEW.ssl_status := 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_shop_domain_verification_code ON public.shops;
CREATE TRIGGER trigger_set_shop_domain_verification_code
BEFORE UPDATE ON public.shops
FOR EACH ROW
EXECUTE FUNCTION public.set_shop_domain_verification_code();

-- Allow public lookup by custom_domain for published, activated, non-suspended shops
CREATE POLICY "Public can view published shops by custom domain"
ON public.shops
FOR SELECT
USING (
  is_published = true
  AND is_activated = true
  AND COALESCE(is_suspended, false) = false
  AND custom_domain IS NOT NULL
  AND custom_domain <> ''
);
