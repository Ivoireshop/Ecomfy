
CREATE OR REPLACE FUNCTION public.expire_stale_pending_payments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.payments
       SET status = 'failed',
           metadata = COALESCE(metadata, '{}'::jsonb)
                      || jsonb_build_object(
                           'expired_at', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                           'failure_reason', 'pending_timeout_10min'
                         ),
           updated_at = now()
     WHERE status = 'pending'
       AND created_at < now() - interval '10 minutes'
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$$;

SELECT public.expire_stale_pending_payments();

DO $$
DECLARE v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'expire-stale-pending-payments';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;
  PERFORM cron.schedule(
    'expire-stale-pending-payments',
    '* * * * *',
    $cron$ SELECT public.expire_stale_pending_payments(); $cron$
  );
END $$;
