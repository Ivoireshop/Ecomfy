
CREATE TABLE public.shop_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('ads','stock','shipping','salary','other')),
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  description TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shop_expenses_shop_date ON public.shop_expenses(shop_id, expense_date DESC);

ALTER TABLE public.shop_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop owners manage their expenses"
ON public.shop_expenses FOR ALL
USING (EXISTS (SELECT 1 FROM public.shops WHERE shops.id = shop_expenses.shop_id AND shops.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.shops WHERE shops.id = shop_expenses.shop_id AND shops.user_id = auth.uid()));

CREATE TRIGGER trg_shop_expenses_updated_at
BEFORE UPDATE ON public.shop_expenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
