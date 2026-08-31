-- Migration: Add shareholder to app_role, assign djateulrich@gmail.com as primary founder, and revoke all other founder roles

-- 1. Ensure 'shareholder' exists in app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'shareholder';

-- 2. Revoke any founder/co_founder/shareholder/admin roles for users who are NOT djateulrich@gmail.com
DELETE FROM public.user_roles
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email <> 'djateulrich@gmail.com'
)
AND role::text IN ('founder', 'co_founder', 'shareholder', 'admin');

-- 3. Ensure djateulrich@gmail.com has 'founder' role in user_roles
DO $$
DECLARE
  v_main_user_id UUID;
BEGIN
  SELECT id INTO v_main_user_id FROM auth.users WHERE email = 'djateulrich@gmail.com' LIMIT 1;
  IF v_main_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_main_user_id, 'founder'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- 4. Enable RLS and grant permissions on user_roles table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_manage_policy" ON public.user_roles;

-- Authenticated users can view user roles
CREATE POLICY "user_roles_select_policy" ON public.user_roles
  FOR SELECT TO authenticated
  USING (true);

-- Founders can insert/update/delete user roles
CREATE POLICY "user_roles_manage_policy" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('founder', 'co_founder')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('founder', 'co_founder')
    )
  );
