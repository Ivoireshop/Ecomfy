-- Migration: Purge all default roles from user_roles so ONLY djateulrich@gmail.com remains as founder

-- 1. Remove all non-founder entries from user_roles for any user other than djateulrich@gmail.com
DELETE FROM public.user_roles
WHERE user_id NOT IN (
  SELECT id FROM auth.users WHERE LOWER(email) = 'djateulrich@gmail.com'
);

-- 2. Ensure djateulrich@gmail.com has 'founder' role in user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'founder'::public.app_role
FROM auth.users
WHERE LOWER(email) = 'djateulrich@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Modify handle_new_user trigger function so it DOES NOT add default rows to user_roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
  
  -- Create inactive subscription
  INSERT INTO public.subscriptions (user_id, status)
  VALUES (NEW.id, 'inactive')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;
