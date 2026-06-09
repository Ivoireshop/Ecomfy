
CREATE OR REPLACE FUNCTION public.expire_stale_pending_payments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.payments
       SET status = 'failed',
           metadata = COALESCE(metadata, '{}'::jsonb)
                      || jsonb_build_object(
                           'expired_at', to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                           'failure_reason', 'pending_timeout_2h'
                         ),
           updated_at = now()
     WHERE status = 'pending'
       AND created_at < now() - interval '2 hours'
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;
  RETURN v_count;
END;
$function$;
