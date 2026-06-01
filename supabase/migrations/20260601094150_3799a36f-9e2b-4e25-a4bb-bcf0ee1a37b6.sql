
-- Incidents table for app-wide health monitoring
CREATE TABLE IF NOT EXISTS public.app_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  title text NOT NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  occurrence_count integer NOT NULL DEFAULT 1,
  detected_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_incidents_open_dedupe_idx
  ON public.app_incidents (dedupe_key) WHERE status <> 'resolved';
CREATE INDEX IF NOT EXISTS app_incidents_status_idx ON public.app_incidents (status, detected_at DESC);

GRANT SELECT ON public.app_incidents TO authenticated;
GRANT ALL ON public.app_incidents TO service_role;

ALTER TABLE public.app_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders can view incidents" ON public.app_incidents
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder'));

CREATE POLICY "Founders can update incidents" ON public.app_incidents
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder'));

-- RPC to upsert incident (called from edge function via service role; safe here too)
CREATE OR REPLACE FUNCTION public.record_app_incident(
  _dedupe_key text,
  _category text,
  _severity text,
  _title text,
  _description text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.app_incidents
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.app_incidents;
BEGIN
  INSERT INTO public.app_incidents (dedupe_key, category, severity, title, description, metadata)
  VALUES (_dedupe_key, _category, _severity, _title, _description, COALESCE(_metadata, '{}'::jsonb))
  ON CONFLICT (dedupe_key) WHERE status <> 'resolved'
  DO UPDATE SET
    last_seen_at = now(),
    occurrence_count = public.app_incidents.occurrence_count + 1,
    severity = EXCLUDED.severity,
    title = EXCLUDED.title,
    description = COALESCE(EXCLUDED.description, public.app_incidents.description),
    metadata = public.app_incidents.metadata || EXCLUDED.metadata,
    updated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

-- Schedule app-health-monitor every 5 minutes
DO $$
DECLARE
  v_job_id bigint;
  v_url text := 'https://dqlbmtkaamjohgbcjwtw.supabase.co/functions/v1/app-health-monitor';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxbGJtdGthYW1qb2hnYmNqd3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMTMyNTAsImV4cCI6MjA3NzY4OTI1MH0.Y74c0ym91Q29oW6C-F5g8rBF8y4AphYtB4KJtu1AOLg';
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'app-health-monitor';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
  PERFORM cron.schedule(
    'app-health-monitor',
    '*/5 * * * *',
    format($cmd$SELECT net.http_post(url := %L, headers := %L::jsonb, body := '{}'::jsonb);$cmd$,
      v_url,
      json_build_object('Content-Type','application/json','Authorization','Bearer '||v_anon)::text
    )
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
