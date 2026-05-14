-- Cleanup stuck processing items (older than 10 minutes)
UPDATE public.generation_queue
SET status = 'failed',
    error_message = COALESCE(error_message, 'Auto-failed: stuck in processing for more than 10 minutes'),
    completed_at = now()
WHERE status = 'processing'
  AND started_at < now() - interval '10 minutes';

-- Cleanup very old pending items
UPDATE public.generation_queue
SET status = 'failed',
    error_message = COALESCE(error_message, 'Auto-failed: pending for more than 24 hours'),
    completed_at = now()
WHERE status = 'pending'
  AND created_at < now() - interval '24 hours';

-- Update count_processing_generations to ignore stale processing items
CREATE OR REPLACE FUNCTION public.count_processing_generations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM public.generation_queue
  WHERE status = 'processing'
    AND started_at > now() - interval '10 minutes';
  RETURN cnt;
END;
$function$;