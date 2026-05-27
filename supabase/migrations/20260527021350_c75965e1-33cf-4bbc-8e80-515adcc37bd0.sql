
-- email_unsubscribe_tokens: était ouvert au rôle public (anyone). Restreindre à service_role uniquement.
DROP POLICY IF EXISTS "Service role can read tokens" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can mark tokens as used" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can insert tokens" ON public.email_unsubscribe_tokens;

-- suppressed_emails: idem
DROP POLICY IF EXISTS "Service role can read suppressed emails" ON public.suppressed_emails;
DROP POLICY IF EXISTS "Service role can insert suppressed emails" ON public.suppressed_emails;

-- email_send_log: idem
DROP POLICY IF EXISTS "Service role can read send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can insert send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can update send log" ON public.email_send_log;

-- email_send_state: idem
DROP POLICY IF EXISTS "Service role can manage send state" ON public.email_send_state;

-- image_cache UPDATE: était au rôle public, restreindre à service_role
DROP POLICY IF EXISTS "Service role can update cache" ON public.image_cache;
CREATE POLICY "Service role can update cache"
  ON public.image_cache FOR UPDATE
  TO service_role
  USING (true) WITH CHECK (true);

-- Note: service_role bypass RLS de toute façon, donc les fonctions edge continuent de fonctionner.
-- Les tables restent accessibles aux service_role via les GRANTs existants.
