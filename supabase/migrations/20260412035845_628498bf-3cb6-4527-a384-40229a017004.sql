
-- Add social proof setting to shops
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS social_proof_enabled boolean DEFAULT false;

-- Create trigger function to sync shop stats on order changes
CREATE OR REPLACE FUNCTION public.sync_shop_order_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_shop_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_shop_id := OLD.shop_id;
  ELSE
    target_shop_id := NEW.shop_id;
  END IF;

  UPDATE shops SET
    total_orders = (SELECT COUNT(*) FROM orders WHERE shop_id = target_shop_id),
    total_sales = (SELECT COALESCE(SUM(total), 0) FROM orders WHERE shop_id = target_shop_id),
    updated_at = now()
  WHERE id = target_shop_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS trigger_sync_shop_stats ON orders;
CREATE TRIGGER trigger_sync_shop_stats
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_shop_order_stats();

-- Fix existing data
UPDATE shops s SET
  total_orders = sub.cnt,
  total_sales = sub.rev
FROM (
  SELECT shop_id, COUNT(*) as cnt, COALESCE(SUM(total), 0) as rev
  FROM orders
  GROUP BY shop_id
) sub
WHERE s.id = sub.shop_id;
