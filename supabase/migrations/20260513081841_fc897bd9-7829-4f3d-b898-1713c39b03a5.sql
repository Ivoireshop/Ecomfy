DELETE FROM public.device_tokens a
USING public.device_tokens b
WHERE a.user_id = b.user_id
  AND a.user_agent IS NOT DISTINCT FROM b.user_agent
  AND a.id <> b.id
  AND (
    a.last_used_at < b.last_used_at
    OR (a.last_used_at = b.last_used_at AND a.created_at < b.created_at)
    OR (a.last_used_at = b.last_used_at AND a.created_at = b.created_at AND a.id::text < b.id::text)
  );

ALTER TABLE public.device_tokens
ADD CONSTRAINT device_tokens_one_per_device UNIQUE (user_id, user_agent);