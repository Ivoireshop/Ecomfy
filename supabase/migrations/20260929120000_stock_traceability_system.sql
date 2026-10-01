-- Migration: Stock Traceability & Movements System for Ecomfy
-- Date: 2026-09-29
-- Author: Ecomfy Local Architecture Phase 1

-- 1. Create Stock Movements table (Immutable audit log)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    unit_code TEXT,
    movement_type TEXT NOT NULL, -- 'restock', 'reservation', 'driver_handover', 'delivered', 'failed_delivery', 'return_restock', 'adjustment'
    quantity INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL DEFAULT 0,
    new_stock INTEGER NOT NULL DEFAULT 0,
    source_location TEXT DEFAULT 'warehouse',
    destination_location TEXT,
    reference_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT
);

-- Indexing for fast query performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_shop ON public.stock_movements(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_order ON public.stock_movements(reference_order_id);

-- Enable RLS on stock_movements
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Shop owners & collaborators can view their shop movements
CREATE POLICY "Shop users can view their stock movements"
    ON public.stock_movements
    FOR SELECT
    USING (
        shop_id IN (
            SELECT id FROM public.shops WHERE user_id = auth.uid()
        )
        OR
        shop_id IN (
            SELECT shop_id FROM public.delivery_company_members WHERE user_id = auth.uid()
        )
    );

-- RLS Policy: Insert allowed via authenticated shop users
CREATE POLICY "Shop users can insert stock movements"
    ON public.stock_movements
    FOR INSERT
    WITH CHECK (
        shop_id IN (
            SELECT id FROM public.shops WHERE user_id = auth.uid()
        )
        OR
        shop_id IN (
            SELECT shop_id FROM public.delivery_company_members WHERE user_id = auth.uid()
        )
    );


-- 2. Create Inventory Units table (Physical serial/QR Code tracking)
CREATE TABLE IF NOT EXISTS public.inventory_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    unit_qr_code TEXT UNIQUE NOT NULL, -- e.g. ECOMFY-UNIT-8F92K2
    status TEXT NOT NULL DEFAULT 'available', -- 'available', 'reserved', 'in_transit', 'delivered', 'returned', 'damaged'
    current_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    current_driver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for unit tracking
CREATE INDEX IF NOT EXISTS idx_inventory_units_qr ON public.inventory_units(unit_qr_code);
CREATE INDEX IF NOT EXISTS idx_inventory_units_shop ON public.inventory_units(shop_id);
CREATE INDEX IF NOT EXISTS idx_inventory_units_driver ON public.inventory_units(current_driver_id, status);

-- Enable RLS on inventory_units
ALTER TABLE public.inventory_units ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Shop owners & collaborators view units
CREATE POLICY "Shop users can view inventory units"
    ON public.inventory_units
    FOR SELECT
    USING (
        shop_id IN (
            SELECT id FROM public.shops WHERE user_id = auth.uid()
        )
        OR current_driver_id = auth.uid()
    );

-- RLS Policy: Insert/Update allowed for shop members
CREATE POLICY "Shop users can manage inventory units"
    ON public.inventory_units
    FOR ALL
    USING (
        shop_id IN (
            SELECT id FROM public.shops WHERE user_id = auth.uid()
        )
        OR current_driver_id = auth.uid()
    );


-- 3. Stored Procedure: Record Stock Movement Atomically
CREATE OR REPLACE FUNCTION public.record_stock_movement(
    p_shop_id UUID,
    p_product_id UUID,
    p_variant_id UUID,
    p_unit_code TEXT,
    p_movement_type TEXT,
    p_quantity INTEGER,
    p_reference_order_id UUID DEFAULT NULL,
    p_driver_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_stock INTEGER := 0;
    v_new_stock INTEGER := 0;
    v_movement_id UUID;
BEGIN
    -- Fetch current stock with lock
    SELECT stock INTO v_current_stock
    FROM public.products
    WHERE id = p_product_id AND shop_id = p_shop_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Produit non trouvé ou non autorisé');
    END IF;

    v_new_stock := GREATEST(0, v_current_stock + p_quantity);

    -- Update products stock
    UPDATE public.products
    SET stock = v_new_stock,
        updated_at = now()
    WHERE id = p_product_id;

    -- Insert stock movement audit log
    INSERT INTO public.stock_movements (
        shop_id,
        product_id,
        variant_id,
        unit_code,
        movement_type,
        quantity,
        previous_stock,
        new_stock,
        reference_order_id,
        driver_id,
        created_by,
        notes
    ) VALUES (
        p_shop_id,
        p_product_id,
        p_variant_id,
        p_unit_code,
        p_movement_type,
        p_quantity,
        v_current_stock,
        v_new_stock,
        p_reference_order_id,
        p_driver_id,
        auth.uid(),
        p_notes
    )
    RETURNING id INTO v_movement_id;

    RETURN jsonb_build_object(
        'success', true,
        'movement_id', v_movement_id,
        'previous_stock', v_current_stock,
        'new_stock', v_new_stock
    );
END;
$$;
