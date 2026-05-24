
-- 1. Create dedicated table for sensitive shop credentials
CREATE TABLE IF NOT EXISTS public.shop_secrets (
  shop_id uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  facebook_access_token text,
  tiktok_access_token text,
  snapchat_access_token text,
  ga4_api_secret text,
  google_ads_conversion_id text,
  google_ads_conversion_label text,
  weekly_finance_email text,
  weekly_finance_email_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Copy existing data from shops
INSERT INTO public.shop_secrets (
  shop_id, facebook_access_token, tiktok_access_token, snapchat_access_token,
  ga4_api_secret, google_ads_conversion_id, google_ads_conversion_label,
  weekly_finance_email, weekly_finance_email_enabled
)
SELECT
  id, facebook_access_token, tiktok_access_token, snapchat_access_token,
  ga4_api_secret, google_ads_conversion_id, google_ads_conversion_label,
  weekly_finance_email, COALESCE(weekly_finance_email_enabled, false)
FROM public.shops
ON CONFLICT (shop_id) DO NOTHING;

-- 3. Drop the sensitive columns from public.shops
ALTER TABLE public.shops
  DROP COLUMN IF EXISTS facebook_access_token,
  DROP COLUMN IF EXISTS tiktok_access_token,
  DROP COLUMN IF EXISTS snapchat_access_token,
  DROP COLUMN IF EXISTS ga4_api_secret,
  DROP COLUMN IF EXISTS google_ads_conversion_id,
  DROP COLUMN IF EXISTS google_ads_conversion_label,
  DROP COLUMN IF EXISTS weekly_finance_email,
  DROP COLUMN IF EXISTS weekly_finance_email_enabled;

-- 4. Enable RLS — owner only
ALTER TABLE public.shop_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop owners can view their secrets"
  ON public.shop_secrets FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_secrets.shop_id AND s.user_id = auth.uid()));

CREATE POLICY "Shop owners can insert their secrets"
  ON public.shop_secrets FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_secrets.shop_id AND s.user_id = auth.uid()));

CREATE POLICY "Shop owners can update their secrets"
  ON public.shop_secrets FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_secrets.shop_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_secrets.shop_id AND s.user_id = auth.uid()));

CREATE POLICY "Shop owners can delete their secrets"
  ON public.shop_secrets FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_secrets.shop_id AND s.user_id = auth.uid()));

-- 5. Auto-update timestamp
CREATE OR REPLACE FUNCTION public.update_shop_secrets_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shop_secrets_set_updated_at ON public.shop_secrets;
CREATE TRIGGER shop_secrets_set_updated_at
  BEFORE UPDATE ON public.shop_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_shop_secrets_updated_at();
