CREATE OR REPLACE FUNCTION public.cleanup_old_generated_media()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.generated_images WHERE created_at < now() - interval '30 days';
  DELETE FROM public.generated_videos WHERE created_at < now() - interval '30 days';
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;