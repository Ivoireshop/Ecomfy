-- Migration to make has_shop_role SECURITY DEFINER function grant all permissions when full_admin is present

CREATE OR REPLACE FUNCTION public.has_shop_role(_shop_id uuid, _user_id uuid, _role public.shop_collab_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_collaborators
    WHERE shop_id = _shop_id
      AND user_id = _user_id
      AND status = 'active'
      AND ('full_admin' = ANY(roles) OR _role = ANY(roles))
  );
$$;

-- Ensure is_shop_collaborator remains active and clean
CREATE OR REPLACE FUNCTION public.is_shop_collaborator(_shop_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_collaborators
    WHERE shop_id = _shop_id AND user_id = _user_id AND status = 'active'
  );
$$;
