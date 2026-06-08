
-- Tighten enrollment SELECT: require email-verified JWT
DROP POLICY IF EXISTS "Students can view their own enrollments" ON public.enrollments;
CREATE POLICY "Students can view their own enrollments"
  ON public.enrollments FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND COALESCE((auth.jwt() ->> 'email_verified')::boolean, false) = true
    AND lower(student_email) = lower(COALESCE((auth.jwt() ->> 'email'), ''))
  );

-- Tighten collaborator read: require authenticated user
DROP POLICY IF EXISTS "Collaborator can read own invite" ON public.shop_collaborators;
CREATE POLICY "Collaborator can read own invite"
  ON public.shop_collaborators FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR (
        COALESCE((auth.jwt() ->> 'email_verified')::boolean, false) = true
        AND lower(invited_email) = lower(COALESCE((auth.jwt() ->> 'email'), ''))
      )
    )
  );

-- Remove direct UPDATE-by-email policy; acceptance must go through accept_shop_invitation RPC (token-based)
DROP POLICY IF EXISTS "Collaborator can accept own invite" ON public.shop_collaborators;
