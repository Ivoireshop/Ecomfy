-- Migration to fix shop_collaborators column permissions, role types, and full_admin checks

-- 1. Convert roles column to text[] to support full_admin, manage_catalog, view_stats, manage_customers
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'shop_collaborators' AND column_name = 'roles'
    AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE public.shop_collaborators ALTER COLUMN roles TYPE text[] USING roles::text[];
  END IF;
END $$;

-- 2. Ensure authenticated users (shop owners) have full SELECT access to shop_collaborators table (protected by RLS)
GRANT SELECT ON public.shop_collaborators TO authenticated;
GRANT ALL ON public.shop_collaborators TO authenticated;

-- 3. Update has_shop_role SQL helper function to check for full_admin role as master permission
CREATE OR REPLACE FUNCTION public.has_shop_role(_shop_id uuid, _user_id uuid, _required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops WHERE id = _shop_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.shop_collaborators
    WHERE shop_id = _shop_id 
      AND user_id = _user_id 
      AND status = 'active'
      AND (
        _required_role = ANY(roles)
        OR 'full_admin' = ANY(roles)
      )
  );
$$;
