-- Add founder access to all profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Founders can view all profiles'
  ) THEN
    CREATE POLICY "Founders can view all profiles"
    ON public.profiles
    FOR SELECT
    USING (
      has_role(auth.uid(), 'founder'::app_role) OR has_role(auth.uid(), 'co_founder'::app_role)
    );
  END IF;
END $$;

-- Add founder access to all feedback
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'feedback' AND policyname = 'Founders can view all feedback'
  ) THEN
    CREATE POLICY "Founders can view all feedback"
    ON public.feedback
    FOR SELECT
    USING (
      has_role(auth.uid(), 'founder'::app_role) OR has_role(auth.uid(), 'co_founder'::app_role)
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'feedback' AND policyname = 'Founders can update feedback'
  ) THEN
    CREATE POLICY "Founders can update feedback"
    ON public.feedback
    FOR UPDATE
    USING (
      has_role(auth.uid(), 'founder'::app_role) OR has_role(auth.uid(), 'co_founder'::app_role)
    )
    WITH CHECK (
      has_role(auth.uid(), 'founder'::app_role) OR has_role(auth.uid(), 'co_founder'::app_role)
    );
  END IF;
END $$;

-- Ensure trigger to create profiles and default data on new user signups
-- Drop existing triggers if they exist (safety)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    DROP TRIGGER on_auth_user_created ON auth.users;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_assign_role'
  ) THEN
    DROP TRIGGER on_auth_user_created_assign_role ON auth.users;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_referral'
  ) THEN
    DROP TRIGGER on_auth_user_created_referral ON auth.users;
  END IF;
END $$;

-- Create triggers on auth.users to call existing functions
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_created_assign_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_founder_role();

CREATE TRIGGER on_auth_user_created_referral
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_referral_code();