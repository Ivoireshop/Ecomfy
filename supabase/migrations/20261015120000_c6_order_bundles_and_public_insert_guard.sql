-- C6 (suite) : prix des commandes décidés par la base.
-- 1. Offres en lot : order_items.bundle_index désigne l'offre choisie dans products.bundle_offers ; le trigger
--    enforce_order_item_price applique alors le prix du lot (prix / quantité du lot) et refuse une quantité
--    inférieure à celle du lot. Jusqu'ici le trigger ignorait les lots : le total stocké était le prix plein.
-- 2. Insertion publique d'une commande : un visiteur (anon ou connecté non propriétaire de la boutique) ne peut plus
--    choisir le statut de paiement, un statut de commande hors 'new'/'pending', la livraison ni la commission.
-- Idempotent. À appliquer AVANT le déploiement de ecomfy-pay-initiate et du front (ils lisent bundle_index).
-- Tests : supabase/tests/c6_order_pricing.sql (base jetable).

ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS bundle_index integer;

-- guard_public_order_insert (plus bas) remet ces deux colonnes à NULL : si elles n'existent pas, TOUTE insertion publique
-- de commande échoue (« record "new" has no field "internal_delivery_note" »). Elles viennent de 20260918120000, que
-- dev (et peut-être la production) n'a pas reçue. Mêmes définitions, sans effet si elles existent déjà.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS scheduled_delivery_date date,
  ADD COLUMN IF NOT EXISTS internal_delivery_note text;

CREATE OR REPLACE FUNCTION public.enforce_order_item_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_product record;
  v_order_shop uuid;
  v_offer jsonb;
  v_offer_qty numeric;
  v_offer_price numeric;
BEGIN
  SELECT shop_id INTO v_order_shop FROM public.orders WHERE id = NEW.order_id;
  IF v_order_shop IS NULL THEN
    RAISE EXCEPTION 'Commande introuvable';
  END IF;

  SELECT id, shop_id, price, name, is_published, bundle_offers, COALESCE(stock_quantity, 0) AS stock_quantity
    INTO v_product
    FROM public.products
    WHERE id = NEW.product_id;

  IF v_product.id IS NULL OR v_product.shop_id <> v_order_shop OR v_product.is_published <> true THEN
    RAISE EXCEPTION 'Produit indisponible';
  END IF;

  IF NEW.quantity IS NULL OR NEW.quantity < 1 OR NEW.quantity > 999 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;

  IF NEW.bundle_index IS NULL THEN
    -- Always trust the DB price, never the client
    NEW.unit_price := v_product.price;
    NEW.total_price := ROUND(v_product.price * NEW.quantity, 2);
  ELSE
    IF jsonb_typeof(v_product.bundle_offers) IS DISTINCT FROM 'array'
       OR NEW.bundle_index < 0
       OR NEW.bundle_index >= jsonb_array_length(v_product.bundle_offers) THEN
      RAISE EXCEPTION 'Offre en lot invalide';
    END IF;
    v_offer := v_product.bundle_offers -> NEW.bundle_index;
    v_offer_qty := CASE WHEN (v_offer ->> 'quantity') ~ '^[0-9]+(\.[0-9]+)?$' THEN (v_offer ->> 'quantity')::numeric END;
    v_offer_price := CASE WHEN (v_offer ->> 'price') ~ '^[0-9]+(\.[0-9]+)?$' THEN (v_offer ->> 'price')::numeric END;
    IF v_offer_qty IS NULL OR v_offer_price IS NULL OR v_offer_qty < 1 THEN
      RAISE EXCEPTION 'Offre en lot invalide';
    END IF;
    IF NEW.quantity < v_offer_qty THEN
      RAISE EXCEPTION 'Quantité inférieure à celle de l''offre en lot';
    END IF;
    NEW.unit_price := ROUND(v_offer_price / v_offer_qty, 2);
    NEW.total_price := ROUND(v_offer_price * NEW.quantity / v_offer_qty, 2);
  END IF;

  NEW.product_name := COALESCE(NULLIF(btrim(NEW.product_name), ''), v_product.name);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enforce_order_item_price ON public.order_items;
CREATE TRIGGER enforce_order_item_price
  BEFORE INSERT OR UPDATE OF product_id, quantity, unit_price, total_price, bundle_index ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_item_price();

-- ---------- Valeurs imposées à l'insertion publique d'une commande ----------
CREATE OR REPLACE FUNCTION public.guard_public_order_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Edge Functions (service_role), connexions directes et propriétaire de la boutique : inchangé.
  IF COALESCE(auth.role(), '') = 'service_role'
     OR session_user IN ('postgres', 'supabase_admin', 'service_role')
     OR (auth.uid() IS NOT NULL AND public.is_shop_owner(NEW.shop_id, auth.uid())) THEN
    RETURN NEW;
  END IF;

  NEW.payment_status := 'pending';
  IF NEW.order_status IS NULL OR NEW.order_status NOT IN ('new', 'pending') THEN
    NEW.order_status := 'new';
  END IF;
  NEW.commission_amount := 0; -- recalculé par recompute_order_totals dès l'insertion des articles
  NEW.delivery_provider_id := NULL;
  NEW.delivery_transferred_at := NULL;
  NEW.internal_delivery_note := NULL;
  NEW.scheduled_delivery_date := NULL;
  NEW.is_read := false;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.guard_public_order_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_public_order_insert ON public.orders;
CREATE TRIGGER trg_guard_public_order_insert
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_public_order_insert();
