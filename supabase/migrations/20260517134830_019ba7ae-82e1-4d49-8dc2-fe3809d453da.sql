
ALTER TABLE public.ad_accounts
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS token_expiry_notified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ad_accounts_token_expires_at
  ON public.ad_accounts (token_expires_at)
  WHERE token_expires_at IS NOT NULL;
