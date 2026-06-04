
-- Defense-in-depth: ensure ad_accounts (OAuth tokens) is strictly owner-only,
-- even if a future collaborator-style policy is accidentally added.

-- Restrictive policy: every access must satisfy the owner check.
DROP POLICY IF EXISTS "Restrict ad_accounts to shop owners only" ON public.ad_accounts;
CREATE POLICY "Restrict ad_accounts to shop owners only"
ON public.ad_accounts
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = ad_accounts.shop_id AND s.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = ad_accounts.shop_id AND s.user_id = auth.uid()
  )
);

-- Revoke anon access explicitly (tokens must never be reachable unauthenticated)
REVOKE ALL ON public.ad_accounts FROM anon;

COMMENT ON COLUMN public.ad_accounts.access_token IS
'Sensitive OAuth token. Access restricted to shop owners only via RLS RESTRICTIVE policy. Do not add collaborator SELECT policies.';
