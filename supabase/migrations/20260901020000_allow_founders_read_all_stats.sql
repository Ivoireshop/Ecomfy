-- Migration: Allow founders/admins to select all rows across platform tables for metrics and real-time dashboard analytics

-- Helper function to check if caller is a founder or master founder
CREATE OR REPLACE FUNCTION public.is_founder_or_master()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (
      LOWER(auth.users.email) = 'djateulrich@gmail.com'
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role::text IN ('founder', 'co_founder', 'shareholder', 'admin')
      )
    )
  );
$$;

-- Safely add RLS policies for existing tables
DO $$
BEGIN
  -- shops table
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shops') THEN
    DROP POLICY IF EXISTS "Founders read all shops" ON public.shops;
    CREATE POLICY "Founders read all shops" ON public.shops FOR SELECT TO authenticated USING (public.is_founder_or_master() OR user_id = auth.uid());
  END IF;

  -- subscriptions table
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscriptions') THEN
    DROP POLICY IF EXISTS "Founders read all subscriptions" ON public.subscriptions;
    CREATE POLICY "Founders read all subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (public.is_founder_or_master() OR user_id = auth.uid());
  END IF;

  -- payments table
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payments') THEN
    DROP POLICY IF EXISTS "Founders read all payments" ON public.payments;
    CREATE POLICY "Founders read all payments" ON public.payments FOR SELECT TO authenticated USING (public.is_founder_or_master() OR user_id = auth.uid());
  END IF;

  -- profiles table
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
    DROP POLICY IF EXISTS "Founders read all profiles" ON public.profiles;
    CREATE POLICY "Founders read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_founder_or_master() OR id = auth.uid());
  END IF;

  -- generated_images table
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'generated_images') THEN
    DROP POLICY IF EXISTS "Founders read all generated_images" ON public.generated_images;
    CREATE POLICY "Founders read all generated_images" ON public.generated_images FOR SELECT TO authenticated USING (public.is_founder_or_master() OR user_id = auth.uid());
  END IF;

  -- generated_videos table
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'generated_videos') THEN
    DROP POLICY IF EXISTS "Founders read all generated_videos" ON public.generated_videos;
    CREATE POLICY "Founders read all generated_videos" ON public.generated_videos FOR SELECT TO authenticated USING (public.is_founder_or_master() OR user_id = auth.uid());
  END IF;
END $$;
