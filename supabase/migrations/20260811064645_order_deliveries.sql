-- 1. Create order_deliveries table
CREATE TABLE IF NOT EXISTS public.order_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.delivery_providers(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.delivery_company_members(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.delivery_vehicles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned')),
  picked_up_at timestamptz,
  delivered_at timestamptz,
  location_lat numeric,
  location_lng numeric,
  pod_signature_url text,
  pod_photo_url text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_deliveries TO authenticated;
GRANT ALL ON public.order_deliveries TO service_role;

-- 3. Enable RLS
ALTER TABLE public.order_deliveries ENABLE ROW LEVEL SECURITY;

-- 4. Policies for order_deliveries
CREATE POLICY "Shop owners can view deliveries for their orders"
  ON public.order_deliveries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.shops s ON s.id = o.shop_id
      WHERE o.id = order_deliveries.order_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Delivery provider members can view their deliveries"
  ON public.order_deliveries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members dcm
      WHERE dcm.provider_id = order_deliveries.provider_id AND dcm.user_id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM public.delivery_providers dp
      WHERE dp.id = order_deliveries.provider_id AND dp.user_id = auth.uid()
    )
  );

CREATE POLICY "Delivery drivers can update their assigned deliveries"
  ON public.order_deliveries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members dcm
      WHERE dcm.id = order_deliveries.driver_id AND dcm.user_id = auth.uid() AND dcm.role = 'driver'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members dcm
      WHERE dcm.id = order_deliveries.driver_id AND dcm.user_id = auth.uid() AND dcm.role = 'driver'
    )
  );

CREATE POLICY "Provider admins and dispatchers can manage deliveries"
  ON public.order_deliveries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members dcm
      WHERE dcm.provider_id = order_deliveries.provider_id AND dcm.user_id = auth.uid() AND dcm.role IN ('admin', 'dispatcher')
    ) OR EXISTS (
      SELECT 1 FROM public.delivery_providers dp
      WHERE dp.id = order_deliveries.provider_id AND dp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members dcm
      WHERE dcm.provider_id = order_deliveries.provider_id AND dcm.user_id = auth.uid() AND dcm.role IN ('admin', 'dispatcher')
    ) OR EXISTS (
      SELECT 1 FROM public.delivery_providers dp
      WHERE dp.id = order_deliveries.provider_id AND dp.user_id = auth.uid()
    )
  );

-- 5. Trigger for updated_at
CREATE TRIGGER order_deliveries_set_updated_at
  BEFORE UPDATE ON public.order_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Trigger to sync order_deliveries status back to orders table if delivered/failed
CREATE OR REPLACE FUNCTION public.sync_delivery_status_to_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
    UPDATE public.orders SET order_status = 'delivered', updated_at = now() WHERE id = NEW.order_id;
  ELSIF NEW.status = 'returned' AND OLD.status IS DISTINCT FROM 'returned' THEN
    UPDATE public.orders SET order_status = 'returned', updated_at = now() WHERE id = NEW.order_id;
  ELSIF NEW.status = 'failed' AND OLD.status IS DISTINCT FROM 'failed' THEN
    -- Or keep it in its current status, maybe add a note? For now we can just log or change status
    -- UPDATE public.orders SET order_status = 'failed', updated_at = now() WHERE id = NEW.order_id;
    NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_delivery_status_change
  AFTER UPDATE OF status ON public.order_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.sync_delivery_status_to_order();

-- 7. Modify existing trigger `auto_transfer_order_to_delivery` to also create an order_deliveries row
CREATE OR REPLACE FUNCTION public.auto_transfer_order_to_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid;
BEGIN
  IF NEW.order_status = 'confirmed'
     AND (OLD.order_status IS DISTINCT FROM 'confirmed')
     AND NEW.delivery_provider_id IS NULL THEN
    
    -- Find active delivery connection
    SELECT sdc.delivery_provider_id INTO v_provider_id
      FROM public.shop_delivery_connections sdc
      JOIN public.delivery_providers dp ON dp.id = sdc.delivery_provider_id
     WHERE sdc.shop_id = NEW.shop_id
       AND sdc.status = 'active'
       AND sdc.auto_transfer = true
       AND dp.is_active = true
     ORDER BY sdc.created_at ASC
     LIMIT 1;
     
    IF v_provider_id IS NOT NULL THEN
      -- Update order
      NEW.delivery_provider_id := v_provider_id;
      NEW.delivery_transferred_at := now();
      
      -- Insert into order_deliveries (we have to do this AFTER the order is inserted, but this is a BEFORE update trigger)
      -- So we can't easily insert referencing the NEW.id if this was an insert trigger. But it's an update, so order exists.
      -- However, doing DML in BEFORE trigger is fine, though conventionally done in AFTER. 
      -- We will just insert it.
      INSERT INTO public.order_deliveries (order_id, provider_id, status)
      VALUES (NEW.id, v_provider_id, 'pending')
      ON CONFLICT (order_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
