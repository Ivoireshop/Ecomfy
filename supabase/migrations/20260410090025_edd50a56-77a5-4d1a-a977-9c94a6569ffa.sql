
-- Add pixel tracking columns to shops
ALTER TABLE public.shops
ADD COLUMN IF NOT EXISTS facebook_pixels text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS tiktok_pixels text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS snapchat_pixels text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS google_analytics_ids text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS google_analytics_code text DEFAULT '',
ADD COLUMN IF NOT EXISTS checkout_fields jsonb DEFAULT '[
  {"id":"first_name","label":"Prénom","type":"text","enabled":true,"required":true},
  {"id":"phone","label":"Numéro de téléphone","type":"tel","enabled":true,"required":true},
  {"id":"country","label":"Pays","type":"text","enabled":true,"required":true},
  {"id":"city","label":"Ville / Commune","type":"text","enabled":true,"required":true},
  {"id":"address","label":"Adresse de livraison","type":"text","enabled":true,"required":false},
  {"id":"email","label":"E-mail","type":"email","enabled":false,"required":false},
  {"id":"last_name","label":"Nom de famille","type":"text","enabled":false,"required":false}
]'::jsonb,
ADD COLUMN IF NOT EXISTS cod_delivery_rate integer DEFAULT 100;
