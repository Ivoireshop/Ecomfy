
DROP POLICY IF EXISTS "Service role can update cache" ON public.image_cache;
DROP POLICY IF EXISTS "System can update cache stats" ON public.image_cache;

CREATE POLICY "Service role can update cache"
ON public.image_cache
FOR UPDATE
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

REVOKE SELECT (facebook_access_token, tiktok_access_token, snapchat_access_token, ga4_api_secret)
  ON public.shops FROM anon, authenticated;
REVOKE UPDATE (facebook_access_token, tiktok_access_token, snapchat_access_token, ga4_api_secret)
  ON public.shops FROM anon, authenticated;
REVOKE INSERT (facebook_access_token, tiktok_access_token, snapchat_access_token, ga4_api_secret)
  ON public.shops FROM anon, authenticated;
