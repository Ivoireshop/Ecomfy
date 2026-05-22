
-- Roles a shop owner can grant to a collaborator
CREATE TYPE public.shop_collab_role AS ENUM (
  'view_orders',
  'edit_shop',
  'manage_expenses',
  'manage_delivered_orders'
);

CREATE TABLE public.shop_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  user_id uuid,
  roles public.shop_collab_role[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','revoked')),
  invitation_token text NOT NULL UNIQUE,
  invited_by uuid NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, invited_email)
);

CREATE INDEX idx_shop_collab_shop ON public.shop_collaborators(shop_id);
CREATE INDEX idx_shop_collab_user ON public.shop_collaborators(user_id);
CREATE INDEX idx_shop_collab_email ON public.shop_collaborators(lower(invited_email));

ALTER TABLE public.shop_collaborators ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_shop_collab_updated
BEFORE UPDATE ON public.shop_collaborators
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Security definer helpers (avoid recursive RLS lookups)
CREATE OR REPLACE FUNCTION public.is_shop_owner(_shop_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.has_shop_role(_shop_id uuid, _user_id uuid, _role public.shop_collab_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_collaborators
    WHERE shop_id = _shop_id
      AND user_id = _user_id
      AND status = 'active'
      AND _role = ANY(roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_shop_collaborator(_shop_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_collaborators
    WHERE shop_id = _shop_id AND user_id = _user_id AND status = 'active'
  );
$$;

-- RLS for shop_collaborators
CREATE POLICY "Owners manage their collaborators"
ON public.shop_collaborators FOR ALL
USING (public.is_shop_owner(shop_id, auth.uid()))
WITH CHECK (public.is_shop_owner(shop_id, auth.uid()));

CREATE POLICY "Collaborator can read own invite"
ON public.shop_collaborators FOR SELECT
USING (user_id = auth.uid() OR lower(invited_email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

CREATE POLICY "Collaborator can accept own invite"
ON public.shop_collaborators FOR UPDATE
USING (lower(invited_email) = lower(coalesce((auth.jwt() ->> 'email'), '')))
WITH CHECK (lower(invited_email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

-- Extend shop access: collaborators get SELECT on shops they're active on
CREATE POLICY "Collaborators can view assigned shop"
ON public.shops FOR SELECT
USING (public.is_shop_collaborator(id, auth.uid()));

CREATE POLICY "Collaborators with edit_shop can update shop"
ON public.shops FOR UPDATE
USING (public.has_shop_role(id, auth.uid(), 'edit_shop'))
WITH CHECK (public.has_shop_role(id, auth.uid(), 'edit_shop'));

-- Orders: collaborators with view/manage roles can read
CREATE POLICY "Collaborators can view shop orders"
ON public.orders FOR SELECT
USING (
  public.has_shop_role(shop_id, auth.uid(), 'view_orders')
  OR public.has_shop_role(shop_id, auth.uid(), 'manage_delivered_orders')
  OR public.has_shop_role(shop_id, auth.uid(), 'edit_shop')
);

CREATE POLICY "Collaborators can update orders"
ON public.orders FOR UPDATE
USING (public.has_shop_role(shop_id, auth.uid(), 'manage_delivered_orders'))
WITH CHECK (public.has_shop_role(shop_id, auth.uid(), 'manage_delivered_orders'));

-- Products: collaborators with edit_shop role can manage
CREATE POLICY "Collaborators edit_shop can view products"
ON public.products FOR SELECT
USING (public.is_shop_collaborator(shop_id, auth.uid()));

CREATE POLICY "Collaborators edit_shop can write products"
ON public.products FOR ALL
USING (public.has_shop_role(shop_id, auth.uid(), 'edit_shop'))
WITH CHECK (public.has_shop_role(shop_id, auth.uid(), 'edit_shop'));

-- Expenses: collaborators with manage_expenses can manage
CREATE POLICY "Collaborators manage_expenses on shop_expenses"
ON public.shop_expenses FOR ALL
USING (public.has_shop_role(shop_id, auth.uid(), 'manage_expenses'))
WITH CHECK (public.has_shop_role(shop_id, auth.uid(), 'manage_expenses'));

-- Abandoned carts visible to collaborators with view_orders
CREATE POLICY "Collaborators can view abandoned carts"
ON public.abandoned_carts FOR SELECT
USING (
  public.has_shop_role(shop_id, auth.uid(), 'view_orders')
  OR public.has_shop_role(shop_id, auth.uid(), 'edit_shop')
);

-- RPC to accept invitation by token (links current user to invite)
CREATE OR REPLACE FUNCTION public.accept_shop_invitation(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce((auth.jwt() ->> 'email'), ''));
  v_invite public.shop_collaborators%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  SELECT * INTO v_invite FROM public.shop_collaborators
    WHERE invitation_token = _token LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;
  IF lower(v_invite.invited_email) <> v_email THEN
    RETURN jsonb_build_object('success', false, 'error', 'email_mismatch',
      'expected_email', v_invite.invited_email);
  END IF;
  IF v_invite.status = 'revoked' THEN
    RETURN jsonb_build_object('success', false, 'error', 'revoked');
  END IF;
  UPDATE public.shop_collaborators
    SET user_id = v_uid, status = 'active', accepted_at = now(), updated_at = now()
    WHERE id = v_invite.id;
  RETURN jsonb_build_object('success', true, 'shop_id', v_invite.shop_id);
END;
$$;
