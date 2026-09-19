-- Migration to fix shop_collab_role enum and convert roles column to text[]

-- 1. Extend shop_collab_role ENUM type if it exists in PostgreSQL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_collab_role') THEN
    ALTER TYPE public.shop_collab_role ADD VALUE IF NOT EXISTS 'manage_catalog';
    ALTER TYPE public.shop_collab_role ADD VALUE IF NOT EXISTS 'view_stats';
    ALTER TYPE public.shop_collab_role ADD VALUE IF NOT EXISTS 'manage_customers';
    ALTER TYPE public.shop_collab_role ADD VALUE IF NOT EXISTS 'full_admin';
  END IF;
END $$;

-- 2. Convert roles column in shop_collaborators to text[] to support all roles seamlessly
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'shop_collaborators' AND column_name = 'roles'
  ) THEN
    ALTER TABLE public.shop_collaborators ALTER COLUMN roles TYPE text[] USING roles::text[];
  END IF;
END $$;

-- 3. Update has_shop_role function to support full_admin master role
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
