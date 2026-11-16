-- Stock par QR code : activation par boutique + QR code produit.
--
-- 1. shops.stock_qr_enabled : le marchand active la fonction boutique par boutique (désactivée par défaut).
-- 2. products.stock_qr_code : code opaque (ECP-XXXXXXXXXXXX) imprimé dans le QR ; il n'expose pas l'identifiant interne.
-- 3. RPC get_or_create_product_stock_qr / lookup_product_by_stock_qr : réservées au propriétaire et aux collaborateurs.
-- 4. record_stock_movement corrigée. La version du 29/09 lisait `products.stock`, colonne qui n'existe pas (la colonne est
--    `stock_quantity`), et n'avait aucun contrôle d'accès : n'importe quel utilisateur connecté pouvait modifier le stock
--    de n'importe quelle boutique (SECURITY DEFINER sans vérification). Elle vérifie maintenant l'appartenance à la boutique.

ALTER TABLE public.shops    ADD COLUMN IF NOT EXISTS stock_qr_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_qr_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_stock_qr_code
  ON public.products (stock_qr_code) WHERE stock_qr_code IS NOT NULL;

-- Journal des mouvements. La migration 20260929120000 le crée mais n'a pas été appliquée partout (absent de la dev) :
-- on ne la suppose donc pas. Même définition, créée seulement si absente.
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID,
  unit_code TEXT,
  movement_type TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_stock_movements_shop ON public.stock_movements(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Lecture réservée au propriétaire / collaborateurs ; plus d'INSERT direct (journal infalsifiable : seule
-- record_stock_movement, SECURITY DEFINER, écrit). L'ancienne politique d'insertion permettait de forger des lignes.
DROP POLICY IF EXISTS "Shop users can view their stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Shop users can insert stock movements" ON public.stock_movements;
DROP POLICY IF EXISTS "Shop members can view stock movements" ON public.stock_movements;
CREATE POLICY "Shop members can view stock movements" ON public.stock_movements
  FOR SELECT TO authenticated USING (public.is_shop_owner_or_collaborator(shop_id));
REVOKE ALL ON public.stock_movements FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.stock_movements FROM authenticated;
GRANT SELECT ON public.stock_movements TO authenticated;

-- Génère (ou renvoie) le code QR stock d'un produit. Refuse si la boutique n'a pas activé la fonction.
CREATE OR REPLACE FUNCTION public.get_or_create_product_stock_qr(p_product_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_id uuid;
  v_enabled boolean;
  v_code text;
BEGIN
  SELECT p.shop_id, p.stock_qr_code, s.stock_qr_enabled
    INTO v_shop_id, v_code, v_enabled
  FROM public.products p
  JOIN public.shops s ON s.id = p.shop_id
  WHERE p.id = p_product_id;

  IF v_shop_id IS NULL OR auth.uid() IS NULL OR NOT public.is_shop_owner_or_collaborator(v_shop_id) THEN
    RAISE EXCEPTION 'produit introuvable ou accès refusé' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT v_enabled THEN
    RAISE EXCEPTION 'stock_qr_disabled' USING ERRCODE = 'check_violation';
  END IF;
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  LOOP
    v_code := 'ECP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    BEGIN
      UPDATE public.products SET stock_qr_code = v_code WHERE id = p_product_id AND stock_qr_code IS NULL;
      -- Concurrence : un autre appel a posé un code entre-temps, on renvoie le sien.
      SELECT stock_qr_code INTO v_code FROM public.products WHERE id = p_product_id;
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      -- Collision de code (quasi impossible) : on retente avec un autre tirage.
      NULL;
    END;
  END LOOP;
END $$;

-- Retrouve un produit à partir d'un code scanné. Aucune fuite entre boutiques : accès refusé = « introuvable ».
CREATE OR REPLACE FUNCTION public.lookup_product_by_stock_qr(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT p.id, p.shop_id, p.name, p.sku, p.stock_quantity, s.stock_qr_enabled
    INTO r
  FROM public.products p
  JOIN public.shops s ON s.id = p.shop_id
  WHERE p.stock_qr_code = upper(btrim(p_code));

  IF NOT FOUND OR NOT public.is_shop_owner_or_collaborator(r.shop_id) OR NOT r.stock_qr_enabled THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'product_id', r.id,
    'shop_id', r.shop_id,
    'name', r.name,
    'sku', r.sku,
    'stock_quantity', COALESCE(r.stock_quantity, 0)
  );
END $$;

-- Mouvement de stock atomique et audité. Même signature qu'avant ; accès contrôlé.
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
SET search_path = public
AS $$
DECLARE
  v_current_stock INTEGER := 0;
  v_new_stock INTEGER := 0;
  v_movement_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_shop_owner_or_collaborator(p_shop_id) THEN
    RAISE EXCEPTION 'accès refusé' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND stock_qr_enabled) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le stock par QR code n''est pas activé pour cette boutique');
  END IF;
  IF p_quantity IS NULL OR p_quantity = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantité invalide');
  END IF;
  IF p_movement_type NOT IN ('restock', 'adjustment', 'return_restock', 'damaged') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Type de mouvement non autorisé');
  END IF;

  SELECT COALESCE(stock_quantity, 0) INTO v_current_stock
  FROM public.products
  WHERE id = p_product_id AND shop_id = p_shop_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Produit non trouvé ou non autorisé');
  END IF;

  v_new_stock := GREATEST(0, v_current_stock + p_quantity);

  UPDATE public.products
  SET stock_quantity = v_new_stock, updated_at = now()
  WHERE id = p_product_id;

  INSERT INTO public.stock_movements (
    shop_id, product_id, variant_id, unit_code, movement_type, quantity,
    previous_stock, new_stock, reference_order_id, driver_id, created_by, notes
  ) VALUES (
    p_shop_id, p_product_id, p_variant_id, p_unit_code, p_movement_type, p_quantity,
    v_current_stock, v_new_stock, p_reference_order_id, p_driver_id, auth.uid(), p_notes
  )
  RETURNING id INTO v_movement_id;

  RETURN jsonb_build_object(
    'success', true,
    'movement_id', v_movement_id,
    'previous_stock', v_current_stock,
    'new_stock', v_new_stock
  );
END $$;

REVOKE ALL ON FUNCTION public.get_or_create_product_stock_qr(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lookup_product_by_stock_qr(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_stock_movement(uuid, uuid, uuid, text, text, integer, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_product_stock_qr(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_product_by_stock_qr(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_stock_movement(uuid, uuid, uuid, text, text, integer, uuid, uuid, text) TO authenticated;
