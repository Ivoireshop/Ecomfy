CREATE TABLE IF NOT EXISTS public.platform_stats (
  key text PRIMARY KEY,
  value integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_stats TO anon, authenticated;
GRANT ALL ON public.platform_stats TO service_role;
GRANT INSERT, UPDATE ON public.platform_stats TO authenticated;

ALTER TABLE public.platform_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform_stats public read"
  ON public.platform_stats FOR SELECT
  USING (true);

CREATE POLICY "platform_stats founder write"
  ON public.platform_stats FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'founder'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'founder'::app_role));

CREATE OR REPLACE FUNCTION public.platform_stats_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS platform_stats_set_updated_at ON public.platform_stats;
CREATE TRIGGER platform_stats_set_updated_at
  BEFORE UPDATE ON public.platform_stats
  FOR EACH ROW EXECUTE FUNCTION public.platform_stats_touch_updated_at();

INSERT INTO public.platform_stats (key, value, label, sort_order) VALUES
  ('visuals_generated', 979, 'Visuels générés', 1),
  ('shops_created', 120, 'Boutiques créées', 2),
  ('entrepreneurs_supported', 350, 'Entrepreneurs accompagnés', 3),
  ('videos_created', 45, 'Vidéos publicitaires créées', 4)
ON CONFLICT (key) DO NOTHING;