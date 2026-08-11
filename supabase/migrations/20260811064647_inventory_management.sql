-- 1. Create warehouses table
CREATE TABLE IF NOT EXISTS public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  city text,
  is_default boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create inventory_levels table
CREATE TABLE IF NOT EXISTS public.inventory_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0,
  reserved_quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, warehouse_id)
);

-- 3. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;
GRANT ALL ON public.warehouses TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_levels TO authenticated;
GRANT ALL ON public.inventory_levels TO service_role;

-- 4. Enable RLS
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_levels ENABLE ROW LEVEL SECURITY;

-- 5. Policies for warehouses
CREATE POLICY "Shop owners can manage their warehouses"
  ON public.warehouses FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = warehouses.shop_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = warehouses.shop_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view active warehouses"
  ON public.warehouses FOR SELECT
  USING (status = 'active');

-- 6. Policies for inventory_levels
CREATE POLICY "Shop owners can manage their inventory levels"
  ON public.inventory_levels FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.warehouses w
      JOIN public.shops s ON s.id = w.shop_id
      WHERE w.id = inventory_levels.warehouse_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.warehouses w
      JOIN public.shops s ON s.id = w.shop_id
      WHERE w.id = inventory_levels.warehouse_id AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view inventory levels"
  ON public.inventory_levels FOR SELECT
  USING (true);

-- 7. Triggers for updated_at
CREATE TRIGGER warehouses_set_updated_at
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER inventory_levels_set_updated_at
  BEFORE UPDATE ON public.inventory_levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Data Migration: Create a default warehouse for each shop and migrate stock
DO $$
DECLARE
  v_shop record;
  v_warehouse_id uuid;
  v_product record;
BEGIN
  -- Loop through all shops
  FOR v_shop IN SELECT id, city, address FROM public.shops LOOP
    -- Create default warehouse for shop
    INSERT INTO public.warehouses (shop_id, name, address, city, is_default, status)
    VALUES (v_shop.id, 'Dépôt Principal', v_shop.address, v_shop.city, true, 'active')
    RETURNING id INTO v_warehouse_id;

    -- Loop through products of this shop to migrate stock_quantity
    FOR v_product IN SELECT id, COALESCE(stock_quantity, 0) as stock_quantity FROM public.products WHERE shop_id = v_shop.id LOOP
      -- Insert inventory level
      INSERT INTO public.inventory_levels (product_id, warehouse_id, quantity)
      VALUES (v_product.id, v_warehouse_id, v_product.stock_quantity)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;
