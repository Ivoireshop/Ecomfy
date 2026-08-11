-- 1. Create delivery_zones table
CREATE TABLE IF NOT EXISTS public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.delivery_providers(id) ON DELETE CASCADE,
  name text NOT NULL,
  city text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, name)
);

-- 2. Create delivery_fees table
CREATE TABLE IF NOT EXISTS public.delivery_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.delivery_providers(id) ON DELETE CASCADE,
  zone_id uuid NOT NULL REFERENCES public.delivery_zones(id) ON DELETE CASCADE,
  base_fee numeric NOT NULL DEFAULT 0,
  weight_fee_per_kg numeric DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, zone_id)
);

-- 3. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_zones TO authenticated;
GRANT ALL ON public.delivery_zones TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_fees TO authenticated;
GRANT ALL ON public.delivery_fees TO service_role;

-- 4. Enable RLS
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_fees ENABLE ROW LEVEL SECURITY;

-- 5. Policies for delivery_zones
CREATE POLICY "Anyone can view active delivery zones"
  ON public.delivery_zones FOR SELECT
  TO authenticated
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM public.delivery_providers dp 
    WHERE dp.id = provider_id AND dp.user_id = auth.uid()
  ));

CREATE POLICY "Provider admins can manage zones"
  ON public.delivery_zones FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members dcm
      WHERE dcm.provider_id = delivery_zones.provider_id AND dcm.user_id = auth.uid() AND dcm.role = 'admin'
    ) OR EXISTS (
      SELECT 1 FROM public.delivery_providers dp
      WHERE dp.id = provider_id AND dp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members dcm
      WHERE dcm.provider_id = delivery_zones.provider_id AND dcm.user_id = auth.uid() AND dcm.role = 'admin'
    ) OR EXISTS (
      SELECT 1 FROM public.delivery_providers dp
      WHERE dp.id = provider_id AND dp.user_id = auth.uid()
    )
  );

-- 6. Policies for delivery_fees
CREATE POLICY "Anyone can view active delivery fees"
  ON public.delivery_fees FOR SELECT
  TO authenticated
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM public.delivery_providers dp 
    WHERE dp.id = provider_id AND dp.user_id = auth.uid()
  ));

CREATE POLICY "Provider admins can manage fees"
  ON public.delivery_fees FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members dcm
      WHERE dcm.provider_id = delivery_fees.provider_id AND dcm.user_id = auth.uid() AND dcm.role = 'admin'
    ) OR EXISTS (
      SELECT 1 FROM public.delivery_providers dp
      WHERE dp.id = provider_id AND dp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members dcm
      WHERE dcm.provider_id = delivery_fees.provider_id AND dcm.user_id = auth.uid() AND dcm.role = 'admin'
    ) OR EXISTS (
      SELECT 1 FROM public.delivery_providers dp
      WHERE dp.id = provider_id AND dp.user_id = auth.uid()
    )
  );

-- 7. Triggers for updated_at
CREATE TRIGGER delivery_zones_set_updated_at
  BEFORE UPDATE ON public.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER delivery_fees_set_updated_at
  BEFORE UPDATE ON public.delivery_fees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
