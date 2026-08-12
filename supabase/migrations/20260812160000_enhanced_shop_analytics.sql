-- Add new columns for advanced analytics in shop_visits table
ALTER TABLE public.shop_visits
ADD COLUMN IF NOT EXISTS visitor_ip TEXT,
ADD COLUMN IF NOT EXISTS visitor_country TEXT,
ADD COLUMN IF NOT EXISTS visitor_city TEXT,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS referrer TEXT,
ADD COLUMN IF NOT EXISTS page_path TEXT,
ADD COLUMN IF NOT EXISTS device_type TEXT,
ADD COLUMN IF NOT EXISTS browser TEXT;

-- Create indexes to speed up analytics queries
CREATE INDEX IF NOT EXISTS idx_shop_visits_visited_at ON public.shop_visits(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_visits_visitor_country ON public.shop_visits(visitor_country);
CREATE INDEX IF NOT EXISTS idx_shop_visits_referrer ON public.shop_visits(referrer);
