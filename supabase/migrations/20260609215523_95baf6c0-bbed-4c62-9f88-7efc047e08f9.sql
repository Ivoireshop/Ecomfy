
-- 1) ad_templates: restrict SELECT to founders/co_founders
DROP POLICY IF EXISTS "Authenticated can view active templates" ON public.ad_templates;

CREATE POLICY "Founders can view templates"
  ON public.ad_templates
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'founder'::app_role)
    OR public.has_role(auth.uid(), 'co_founder'::app_role)
  );

-- 2) shop_collaborators: hide invitation_token at column level
REVOKE SELECT (invitation_token) ON public.shop_collaborators FROM authenticated;
REVOKE SELECT (invitation_token) ON public.shop_collaborators FROM anon;

-- Helper RPC: fetch only the invited email for a given token (safe for anon)
CREATE OR REPLACE FUNCTION public.get_invite_email_by_token(_token text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT invited_email
  FROM public.shop_collaborators
  WHERE invitation_token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_email_by_token(text) TO anon, authenticated;
