CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  event_type text,
  reference text,
  amount numeric,
  currency text,
  payload jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_events_provider_event_unique UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_reference ON public.webhook_events(reference);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON public.webhook_events(provider);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- No public policies: only service role (which bypasses RLS) can read/write
