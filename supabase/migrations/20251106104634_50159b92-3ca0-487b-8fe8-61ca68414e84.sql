-- Function to assign founder role based on email
CREATE OR REPLACE FUNCTION public.assign_founder_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if user is the founder
  IF NEW.email = 'djateulrich@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'founder')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  -- Check if user is the co-founder
  IF NEW.email = 'regnis13@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'co_founder')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users for new signups
DROP TRIGGER IF EXISTS assign_founder_role_on_signup ON auth.users;
CREATE TRIGGER assign_founder_role_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_founder_role();

-- Assign roles to existing users with these emails
DO $$
DECLARE
  founder_id uuid;
  cofounder_id uuid;
BEGIN
  -- Get founder user id
  SELECT id INTO founder_id
  FROM auth.users
  WHERE email = 'djateulrich@gmail.com'
  LIMIT 1;
  
  IF founder_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (founder_id, 'founder')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  -- Get co-founder user id
  SELECT id INTO cofounder_id
  FROM auth.users
  WHERE email = 'regnis13@gmail.com'
  LIMIT 1;
  
  IF cofounder_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (cofounder_id, 'co_founder')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;