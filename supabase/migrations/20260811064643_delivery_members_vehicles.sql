-- 1. Create delivery_company_members table
CREATE TABLE IF NOT EXISTS public.delivery_company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.delivery_providers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'dispatcher', 'driver', 'cashier')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, user_id)
);

-- 2. Create delivery_vehicles table
CREATE TABLE IF NOT EXISTS public.delivery_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.delivery_providers(id) ON DELETE CASCADE,
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('moto', 'van', 'truck', 'car')),
  plate_number text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
  default_driver_id uuid REFERENCES public.delivery_company_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_company_members TO authenticated;
GRANT ALL ON public.delivery_company_members TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_vehicles TO authenticated;
GRANT ALL ON public.delivery_vehicles TO service_role;

-- 4. Enable RLS
ALTER TABLE public.delivery_company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_vehicles ENABLE ROW LEVEL SECURITY;

-- 5. Policies for delivery_company_members
CREATE POLICY "Users can view their own memberships"
  ON public.delivery_company_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.delivery_providers dp 
    WHERE dp.id = provider_id AND dp.user_id = auth.uid()
  ));

CREATE POLICY "Provider owners can manage memberships"
  ON public.delivery_company_members FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.delivery_providers dp 
    WHERE dp.id = provider_id AND dp.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.delivery_providers dp 
    WHERE dp.id = provider_id AND dp.user_id = auth.uid()
  ));

-- 6. Policies for delivery_vehicles
CREATE POLICY "Delivery members can view vehicles"
  ON public.delivery_vehicles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members dcm
      WHERE dcm.provider_id = delivery_vehicles.provider_id AND dcm.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.delivery_providers dp
      WHERE dp.id = provider_id AND dp.user_id = auth.uid()
    )
  );

CREATE POLICY "Provider admins can manage vehicles"
  ON public.delivery_vehicles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members dcm
      WHERE dcm.provider_id = delivery_vehicles.provider_id AND dcm.user_id = auth.uid() AND dcm.role = 'admin'
    ) OR EXISTS (
      SELECT 1 FROM public.delivery_providers dp
      WHERE dp.id = provider_id AND dp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members dcm
      WHERE dcm.provider_id = delivery_vehicles.provider_id AND dcm.user_id = auth.uid() AND dcm.role = 'admin'
    ) OR EXISTS (
      SELECT 1 FROM public.delivery_providers dp
      WHERE dp.id = provider_id AND dp.user_id = auth.uid()
    )
  );

-- 7. Triggers for updated_at
CREATE TRIGGER delivery_company_members_set_updated_at
  BEFORE UPDATE ON public.delivery_company_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER delivery_vehicles_set_updated_at
  BEFORE UPDATE ON public.delivery_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
