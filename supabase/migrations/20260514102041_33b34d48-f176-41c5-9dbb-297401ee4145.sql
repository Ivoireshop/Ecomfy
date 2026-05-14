
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS weekly_finance_email_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekly_finance_email TEXT;
