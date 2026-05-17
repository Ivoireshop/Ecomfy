
-- Comptes publicitaires connectés par boutique
CREATE TABLE public.ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('meta','tiktok','google')),
  account_id text NOT NULL,
  access_token text NOT NULL,
  account_label text,
  currency text DEFAULT 'XOF',
  total_spend numeric DEFAULT 0,
  last_synced_at timestamptz,
  last_sync_status text DEFAULT 'pending',
  last_sync_error text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shop_id, provider, account_id)
);

CREATE INDEX idx_ad_accounts_shop ON public.ad_accounts(shop_id);

ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view ad_accounts"
ON public.ad_accounts FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.shops s WHERE s.id = ad_accounts.shop_id AND s.user_id = auth.uid())
);
CREATE POLICY "Owners insert ad_accounts"
ON public.ad_accounts FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.shops s WHERE s.id = ad_accounts.shop_id AND s.user_id = auth.uid())
);
CREATE POLICY "Owners update ad_accounts"
ON public.ad_accounts FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.shops s WHERE s.id = ad_accounts.shop_id AND s.user_id = auth.uid())
);
CREATE POLICY "Owners delete ad_accounts"
ON public.ad_accounts FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.shops s WHERE s.id = ad_accounts.shop_id AND s.user_id = auth.uid())
);

CREATE TRIGGER update_ad_accounts_updated_at
BEFORE UPDATE ON public.ad_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Dépenses quotidiennes par compte
CREATE TABLE public.ad_spend_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL,
  spend_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'XOF',
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ad_account_id, spend_date)
);

CREATE INDEX idx_ad_spend_daily_shop_date ON public.ad_spend_daily(shop_id, spend_date);

ALTER TABLE public.ad_spend_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view ad_spend_daily"
ON public.ad_spend_daily FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.shops s WHERE s.id = ad_spend_daily.shop_id AND s.user_id = auth.uid())
);
CREATE POLICY "Service inserts ad_spend_daily"
ON public.ad_spend_daily FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.shops s WHERE s.id = ad_spend_daily.shop_id AND s.user_id = auth.uid())
);
CREATE POLICY "Service updates ad_spend_daily"
ON public.ad_spend_daily FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.shops s WHERE s.id = ad_spend_daily.shop_id AND s.user_id = auth.uid())
);

CREATE TRIGGER update_ad_spend_daily_updated_at
BEFORE UPDATE ON public.ad_spend_daily
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
