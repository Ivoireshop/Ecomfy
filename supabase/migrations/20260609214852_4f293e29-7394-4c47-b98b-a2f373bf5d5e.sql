
-- 1. Add 'delivery' role to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'delivery';

-- 2. delivery_providers table
CREATE TABLE IF NOT EXISTS public.delivery_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  slug text UNIQUE,
  contact_phone text NOT NULL,
  contact_email text,
  whatsapp_number text,
  city text,
  coverage_areas text[] DEFAULT '{}'::text[],
  description text,
  logo_url text,
  base_price numeric DEFAULT 0,
  is_recommended boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_providers TO authenticated;
GRANT SELECT ON public.delivery_providers TO anon;
GRANT ALL ON public.delivery_providers TO service_role;

ALTER TABLE public.delivery_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active delivery providers"
  ON public.delivery_providers FOR SELECT
  USING (is_active = true OR auth.uid() = user_id OR public.has_role(auth.uid(),'founder'));

CREATE POLICY "Users can create their own delivery provider"
  ON public.delivery_providers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update their delivery provider"
  ON public.delivery_providers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'founder'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(),'founder'));

CREATE POLICY "Owners can delete their delivery provider"
  ON public.delivery_providers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'founder'));

CREATE TRIGGER delivery_providers_set_updated_at
  BEFORE UPDATE ON public.delivery_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. shop_delivery_connections table
CREATE TABLE IF NOT EXISTS public.shop_delivery_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  delivery_provider_id uuid NOT NULL REFERENCES public.delivery_providers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  auto_transfer boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shop_id, delivery_provider_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_delivery_connections TO authenticated;
GRANT ALL ON public.shop_delivery_connections TO service_role;

ALTER TABLE public.shop_delivery_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop owners view their connections"
  ON public.shop_delivery_connections FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.delivery_providers dp WHERE dp.id = delivery_provider_id AND dp.user_id = auth.uid())
    OR public.has_role(auth.uid(),'founder')
  );

CREATE POLICY "Shop owners manage their connections"
  ON public.shop_delivery_connections FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid()));

CREATE POLICY "Shop owners update their connections"
  ON public.shop_delivery_connections FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid()));

CREATE POLICY "Shop owners delete their connections"
  ON public.shop_delivery_connections FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = shop_id AND s.user_id = auth.uid()));

CREATE TRIGGER shop_delivery_connections_set_updated_at
  BEFORE UPDATE ON public.shop_delivery_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Add columns on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_provider_id uuid REFERENCES public.delivery_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_transferred_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_delivery_provider_id ON public.orders(delivery_provider_id);

-- 5. Trigger: on order confirmed, auto-assign delivery provider
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
      NEW.delivery_provider_id := v_provider_id;
      NEW.delivery_transferred_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_auto_transfer_delivery ON public.orders;
CREATE TRIGGER orders_auto_transfer_delivery
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.auto_transfer_order_to_delivery();

-- 6. Allow delivery providers to read orders that were transferred to them
CREATE POLICY "Delivery providers view their assigned orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    delivery_provider_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.delivery_providers dp
      WHERE dp.id = orders.delivery_provider_id
        AND dp.user_id = auth.uid()
    )
  );

CREATE POLICY "Delivery providers view assigned order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.delivery_providers dp ON dp.id = o.delivery_provider_id
      WHERE o.id = order_items.order_id AND dp.user_id = auth.uid()
    )
  );

-- 7. Seed DLK Services as recommended partner (system-owned, no user_id)
INSERT INTO public.delivery_providers (company_name, slug, contact_phone, contact_email, city, coverage_areas, description, base_price, is_recommended, is_active, is_verified)
VALUES (
  'DLK Services',
  'dlk-services',
  '+225 07 58 15 27 61',
  'contact@dlkservices.ci',
  'Abidjan',
  ARRAY['Abidjan','Cocody','Yopougon','Marcory','Treichville','Plateau','Adjamé','Abobo','Port-Bouët','Koumassi','Riviera','Bingerville'],
  'Partenaire officiel de VisualPro. Livraison rapide à Abidjan et dans toute la Côte d''Ivoire.',
  1500,
  true,
  true,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  is_recommended = EXCLUDED.is_recommended,
  is_verified = EXCLUDED.is_verified,
  is_active = EXCLUDED.is_active;
