-- 1. Create delivery_driver_zones table to link drivers to zones
CREATE TABLE IF NOT EXISTS public.delivery_driver_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.delivery_providers(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.delivery_company_members(id) ON DELETE CASCADE,
  zone_id uuid NOT NULL REFERENCES public.delivery_zones(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(driver_id, zone_id)
);

-- 2. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_driver_zones TO authenticated;
GRANT ALL ON public.delivery_driver_zones TO service_role;

-- 3. Enable RLS
ALTER TABLE public.delivery_driver_zones ENABLE ROW LEVEL SECURITY;

-- 4. Policies
CREATE POLICY "Provider admins can manage driver zones"
  ON public.delivery_driver_zones FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members dcm
      WHERE dcm.provider_id = delivery_driver_zones.provider_id AND dcm.user_id = auth.uid() AND dcm.role = 'admin'
    ) OR EXISTS (
      SELECT 1 FROM public.delivery_providers dp
      WHERE dp.id = provider_id AND dp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members dcm
      WHERE dcm.provider_id = delivery_driver_zones.provider_id AND dcm.user_id = auth.uid() AND dcm.role = 'admin'
    ) OR EXISTS (
      SELECT 1 FROM public.delivery_providers dp
      WHERE dp.id = provider_id AND dp.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view active driver zones"
  ON public.delivery_driver_zones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_providers dp 
      WHERE dp.id = provider_id AND dp.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.delivery_company_members dcm
      WHERE dcm.provider_id = delivery_driver_zones.provider_id AND dcm.user_id = auth.uid()
    )
  );


-- 5. RPC to push an order to a delivery provider
CREATE OR REPLACE FUNCTION public.push_order_to_delivery_provider(
  p_order_id uuid,
  p_provider_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_zone_id uuid;
  v_driver_id uuid;
BEGIN
  -- 1. Check if the order exists and belongs to the user's shop
  SELECT * INTO v_order FROM public.orders 
  WHERE id = p_order_id;
  
  IF v_order IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- Verify user has permission (must be shop owner)
  IF NOT EXISTS (
    SELECT 1 FROM public.shops s 
    WHERE s.id = v_order.shop_id AND s.user_id = auth.uid()
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- 2. Try to find a matching zone for the customer's city
  IF v_order.customer_city IS NOT NULL THEN
    SELECT id INTO v_zone_id FROM public.delivery_zones
    WHERE provider_id = p_provider_id
      AND is_active = true
      AND (
        lower(name) = lower(v_order.customer_city) OR
        lower(city) = lower(v_order.customer_city)
      )
    LIMIT 1;
  END IF;

  -- 3. Try to find an available driver in that zone
  IF v_zone_id IS NOT NULL THEN
    SELECT driver_id INTO v_driver_id FROM public.delivery_driver_zones dz
    JOIN public.delivery_company_members dcm ON dz.driver_id = dcm.id
    WHERE dz.zone_id = v_zone_id 
      AND dz.provider_id = p_provider_id
      AND dcm.is_active = true
      AND dcm.role = 'driver'
    ORDER BY random() -- Simple round robin / random assignment
    LIMIT 1;
  END IF;

  -- 4. Insert into order_deliveries
  INSERT INTO public.order_deliveries (
    order_id, 
    provider_id, 
    driver_id, 
    status
  ) VALUES (
    p_order_id, 
    p_provider_id, 
    v_driver_id, 
    'pending'
  )
  ON CONFLICT (order_id) DO UPDATE 
  SET provider_id = EXCLUDED.provider_id,
      driver_id = EXCLUDED.driver_id,
      status = 'pending';

  -- 5. Update the order
  UPDATE public.orders 
  SET delivery_provider_id = p_provider_id,
      delivery_transferred_at = now()
  WHERE id = p_order_id;

  RETURN json_build_object(
    'success', true, 
    'assigned_driver_id', v_driver_id,
    'assigned_zone_id', v_zone_id
  );
END;
$$;
