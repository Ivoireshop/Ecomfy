-- Migration to extend shop_collab_role enum and update has_shop_role SECURITY DEFINER function

-- 1. Extend shop_collab_role enum values if not present
ALTER TYPE public.shop_collab_role ADD VALUE IF NOT EXISTS 'manage_catalog';
ALTER TYPE public.shop_collab_role ADD VALUE IF NOT EXISTS 'view_stats';
ALTER TYPE public.shop_collab_role ADD VALUE IF NOT EXISTS 'manage_customers';
ALTER TYPE public.shop_collab_role ADD VALUE IF NOT EXISTS 'full_admin';

-- 2. Convert roles column to text[] to ensure flexible schema compatibility across environment caches
ALTER TABLE public.shop_collaborators ALTER COLUMN roles TYPE text[] USING roles::text[];

-- 3. Update has_shop_role SECURITY DEFINER function to support text roles & grant full_admin universal access
CREATE OR REPLACE FUNCTION public.has_shop_role(_shop_id uuid, _user_id uuid, _role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_collaborators
    WHERE shop_id = _shop_id
      AND user_id = _user_id
      AND status = 'active'
      AND ('full_admin' = ANY(roles) OR _role = ANY(roles))
  );
$$;

-- Overload for legacy calls specifying public.shop_collab_role
CREATE OR REPLACE FUNCTION public.has_shop_role(_shop_id uuid, _user_id uuid, _role public.shop_collab_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_shop_role(_shop_id, _user_id, _role::text);
$$;

-- Ensure is_shop_collaborator remains active and clean
CREATE OR REPLACE FUNCTION public.is_shop_collaborator(_shop_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_collaborators
    WHERE shop_id = _shop_id AND user_id = _user_id AND status = 'active'
  );
$$;
