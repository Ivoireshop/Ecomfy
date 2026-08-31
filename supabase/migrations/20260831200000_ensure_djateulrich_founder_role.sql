-- Migration: Ensure djateulrich@gmail.com is unconditionally inserted as founder in user_roles for any matching email in auth.users
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'founder'::public.app_role
FROM auth.users
WHERE LOWER(email) = 'djateulrich@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
