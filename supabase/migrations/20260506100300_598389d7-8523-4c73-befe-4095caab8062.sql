
-- 1) Create commission_payments table for billing history
CREATE TABLE IF NOT EXISTS public.commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL,
  amount numeric NOT NULL,
  payment_method text,
  transaction_reference text,
  status text NOT NULL DEFAULT 'paid',
  period_start timestamptz,
  period_end timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop owners view their commission payments"
  ON public.commission_payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM shops WHERE shops.id = commission_payments.shop_id AND shops.user_id = auth.uid()));

CREATE POLICY "Founders view all commission payments"
  ON public.commission_payments FOR SELECT
  USING (has_role(auth.uid(), 'founder'::app_role) OR has_role(auth.uid(), 'co_founder'::app_role));

CREATE POLICY "Founders manage commission payments"
  ON public.commission_payments FOR ALL
  USING (has_role(auth.uid(), 'founder'::app_role) OR has_role(auth.uid(), 'co_founder'::app_role))
  WITH CHECK (has_role(auth.uid(), 'founder'::app_role) OR has_role(auth.uid(), 'co_founder'::app_role));

CREATE TRIGGER trg_commission_payments_updated_at
  BEFORE UPDATE ON public.commission_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_commission_payments_shop ON public.commission_payments(shop_id, created_at DESC);

-- 2) Backfill commission_balance_due from existing orders
UPDATE public.shops s
SET commission_balance_due = GREATEST(0,
  (COALESCE((SELECT COUNT(*) FROM orders o WHERE o.shop_id = s.id), 0) * COALESCE(s.commission_per_order, 50))
  - COALESCE((SELECT SUM(amount) FROM commission_payments cp WHERE cp.shop_id = s.id AND cp.status = 'paid'), 0)
);

-- 3) Arm 3-day deadline for shops already over threshold
UPDATE public.shops
SET payment_deadline = now() + interval '3 days'
WHERE commission_balance_due >= COALESCE(commission_threshold, 12000)
  AND payment_deadline IS NULL
  AND is_suspended = false;
