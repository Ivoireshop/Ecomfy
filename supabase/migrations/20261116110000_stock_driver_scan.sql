-- Stock par QR code, côté livreur : scan des colis au ramassage et décrémentation du stock.
--
-- Principe : quand la boutique a activé le stock par QR (shops.stock_qr_enabled), le livreur scanne l'étiquette de
-- chaque produit de la commande avant de partir. Chaque scan retire du stock la quantité commandée de ce produit
-- (mouvement `driver_handover`, journalisé avec la commande et le livreur). Un second scan du même produit ne
-- décrémente pas deux fois. Si la course revient à la boutique (statut `returned`), les produits scannés sont remis
-- en stock (`return_restock`). Rien ne change pour les boutiques qui n'ont pas activé la fonction.
--
-- Le livreur n'a aucun accès direct à `products`, `order_items` ni `stock_movements` : tout passe par deux fonctions
-- SECURITY DEFINER qui vérifient qu'il est bien le livreur actif de CETTE course et que le produit est dans CETTE commande.
-- Rejouable.

-- Retour de la course : lignes du journal à rapprocher (une remise en stock par prise en charge non encore annulée).
CREATE INDEX IF NOT EXISTS idx_stock_movements_order_product
  ON public.stock_movements (reference_order_id, product_id) WHERE reference_order_id IS NOT NULL;

-- Conditions de scan communes : renvoie la course si l'appelant en est le livreur actif.
CREATE OR REPLACE FUNCTION public.driver_scan_context(p_delivery_id uuid)
RETURNS TABLE (delivery_id uuid, status text, order_id uuid, shop_id uuid, stock_qr_enabled boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT od.id, od.status, od.order_id, o.shop_id, s.stock_qr_enabled
    FROM public.order_deliveries od
    JOIN public.orders o ON o.id = od.order_id
    JOIN public.shops s ON s.id = o.shop_id
    JOIN public.delivery_company_members m
      ON m.id = od.driver_id AND m.user_id = auth.uid() AND m.is_active AND m.role = 'driver'
   WHERE auth.uid() IS NOT NULL AND od.id = p_delivery_id
$$;
REVOKE ALL ON FUNCTION public.driver_scan_context(uuid) FROM PUBLIC, anon, authenticated;

-- Produits de la commande et état du scan (un produit est « scanné » tant qu'une prise en charge n'a pas été annulée par un retour).
CREATE OR REPLACE FUNCTION public.get_delivery_scan_status(p_delivery_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  v_items jsonb;
BEGIN
  SELECT * INTO c FROM public.driver_scan_context(p_delivery_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'course introuvable ou accès refusé' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT c.stock_qr_enabled THEN
    RETURN jsonb_build_object('enabled', false, 'items', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'product_id', t.product_id, 'name', t.name, 'sku', t.sku, 'quantity', t.qty, 'scanned', t.scanned
         ) ORDER BY t.name), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT oi.product_id, max(p.name) AS name, max(p.sku) AS sku, sum(oi.quantity)::int AS qty,
           (SELECT count(*) FILTER (WHERE m.movement_type = 'driver_handover')
                 > count(*) FILTER (WHERE m.movement_type = 'return_restock')
              FROM public.stock_movements m
             WHERE m.reference_order_id = c.order_id AND m.product_id = oi.product_id) AS scanned
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
     WHERE oi.order_id = c.order_id
     GROUP BY oi.product_id
  ) t;

  RETURN jsonb_build_object('enabled', true, 'items', v_items);
END $$;

-- Scan d'un produit par le livreur : retire du stock la quantité commandée, une seule fois par prise en charge.
CREATE OR REPLACE FUNCTION public.driver_scan_product(p_delivery_id uuid, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  v_prod record;
  v_qty integer;
  v_cur integer;
  v_new integer;
  v_taken integer;
  v_back integer;
BEGIN
  SELECT * INTO c FROM public.driver_scan_context(p_delivery_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'course introuvable ou accès refusé' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT c.stock_qr_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'Le stock par QR code n''est pas activé pour cette boutique');
  END IF;
  IF c.status NOT IN ('pending', 'assigned', 'picked_up', 'in_transit') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cette course est terminée : le scan n''est plus possible');
  END IF;

  -- Le code doit être celui d'un produit de la boutique de la commande ; sinon « inconnu » (pas de fuite entre boutiques).
  SELECT p.id, p.name INTO v_prod
    FROM public.products p
   WHERE p.stock_qr_code = upper(btrim(p_code)) AND p.shop_id = c.shop_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'QR code inconnu pour cette boutique');
  END IF;

  SELECT sum(quantity)::int INTO v_qty FROM public.order_items WHERE order_id = c.order_id AND product_id = v_prod.id;
  IF v_qty IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ce produit ne fait pas partie de cette commande', 'product_name', v_prod.name);
  END IF;

  -- Verrou de la ligne produit : sérialise deux scans simultanés du même produit.
  SELECT COALESCE(stock_quantity, 0) INTO v_cur FROM public.products WHERE id = v_prod.id FOR UPDATE;

  SELECT count(*) FILTER (WHERE movement_type = 'driver_handover'),
         count(*) FILTER (WHERE movement_type = 'return_restock')
    INTO v_taken, v_back
    FROM public.stock_movements
   WHERE reference_order_id = c.order_id AND product_id = v_prod.id;
  IF v_taken > v_back THEN
    RETURN jsonb_build_object('success', true, 'already_scanned', true, 'product_name', v_prod.name, 'quantity', v_qty);
  END IF;

  v_new := GREATEST(0, v_cur - v_qty);
  UPDATE public.products SET stock_quantity = v_new, updated_at = now() WHERE id = v_prod.id;

  INSERT INTO public.stock_movements (
    shop_id, product_id, movement_type, quantity, previous_stock, new_stock,
    source_location, destination_location, reference_order_id, driver_id, created_by, notes
  ) VALUES (
    c.shop_id, v_prod.id, 'driver_handover', -v_qty, v_cur, v_new,
    'warehouse', 'driver', c.order_id, auth.uid(), auth.uid(), 'Scan livreur au ramassage'
  );

  RETURN jsonb_build_object(
    'success', true, 'already_scanned', false, 'product_name', v_prod.name,
    'quantity', v_qty, 'insufficient_stock', v_cur < v_qty
  );
END $$;

-- Retour à la boutique : les produits pris en charge (et non déjà remis) retournent en stock.
CREATE OR REPLACE FUNCTION public.restock_on_delivery_return()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_cur integer;
  v_new integer;
  v_qty integer;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status <> 'returned' THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT m.product_id, o.shop_id
      FROM public.stock_movements m
      JOIN public.orders o ON o.id = m.reference_order_id
     WHERE m.reference_order_id = NEW.order_id
     GROUP BY m.product_id, o.shop_id
    HAVING count(*) FILTER (WHERE m.movement_type = 'driver_handover')
         > count(*) FILTER (WHERE m.movement_type = 'return_restock')
  LOOP
    SELECT -quantity INTO v_qty
      FROM public.stock_movements
     WHERE reference_order_id = NEW.order_id AND product_id = r.product_id AND movement_type = 'driver_handover'
     ORDER BY created_at DESC LIMIT 1;

    SELECT COALESCE(stock_quantity, 0) INTO v_cur FROM public.products WHERE id = r.product_id FOR UPDATE;
    v_new := v_cur + v_qty;
    UPDATE public.products SET stock_quantity = v_new, updated_at = now() WHERE id = r.product_id;

    INSERT INTO public.stock_movements (
      shop_id, product_id, movement_type, quantity, previous_stock, new_stock,
      source_location, destination_location, reference_order_id, notes
    ) VALUES (
      r.shop_id, r.product_id, 'return_restock', v_qty, v_cur, v_new,
      'driver', 'warehouse', NEW.order_id, 'Retour de la course à la boutique'
    );
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS order_deliveries_restock_on_return ON public.order_deliveries;
CREATE TRIGGER order_deliveries_restock_on_return
  AFTER UPDATE OF status ON public.order_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.restock_on_delivery_return();

REVOKE ALL ON FUNCTION public.get_delivery_scan_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.driver_scan_product(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restock_on_delivery_return() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_delivery_scan_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.driver_scan_product(uuid, text) TO authenticated;
