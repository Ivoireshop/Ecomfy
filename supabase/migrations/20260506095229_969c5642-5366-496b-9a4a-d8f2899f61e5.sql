
-- Add billing columns to shops
ALTER TABLE public.shops 
  ADD COLUMN IF NOT EXISTS commission_balance_due numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_per_order numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS commission_threshold numeric NOT NULL DEFAULT 12000,
  ADD COLUMN IF NOT EXISTS payment_deadline timestamp with time zone,
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_advisor_phone text,
  ADD COLUMN IF NOT EXISTS order_confirmation_message text DEFAULT 'Félicitations ! Votre commande a été validée. Un conseiller va vous appeler très bientôt pour organiser la livraison.';

-- Update sync function to also accumulate commission balance and trigger threshold logic
CREATE OR REPLACE FUNCTION public.sync_shop_order_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_shop_id uuid;
  v_per_order numeric;
  v_threshold numeric;
  v_new_balance numeric;
  v_current_deadline timestamp with time zone;
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

  -- On each new order, increment commission balance due and arm 3-day deadline if threshold reached
  IF TG_OP = 'INSERT' THEN
    SELECT commission_per_order, commission_threshold, payment_deadline
      INTO v_per_order, v_threshold, v_current_deadline
      FROM shops WHERE id = target_shop_id;

    UPDATE shops
      SET commission_balance_due = COALESCE(commission_balance_due, 0) + COALESCE(v_per_order, 50)
      WHERE id = target_shop_id
      RETURNING commission_balance_due INTO v_new_balance;

    IF v_new_balance >= COALESCE(v_threshold, 12000) AND v_current_deadline IS NULL THEN
      UPDATE shops
        SET payment_deadline = now() + interval '3 days'
        WHERE id = target_shop_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;
