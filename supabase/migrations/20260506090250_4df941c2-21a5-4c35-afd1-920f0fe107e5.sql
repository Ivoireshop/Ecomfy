
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS facebook_access_token text,
  ADD COLUMN IF NOT EXISTS facebook_test_event_code text,
  ADD COLUMN IF NOT EXISTS tiktok_access_token text,
  ADD COLUMN IF NOT EXISTS snapchat_access_token text,
  ADD COLUMN IF NOT EXISTS google_ads_conversion_id text,
  ADD COLUMN IF NOT EXISTS google_ads_conversion_label text,
  ADD COLUMN IF NOT EXISTS ga4_measurement_id text,
  ADD COLUMN IF NOT EXISTS ga4_api_secret text,
  ADD COLUMN IF NOT EXISTS tracking_enabled boolean DEFAULT true;
