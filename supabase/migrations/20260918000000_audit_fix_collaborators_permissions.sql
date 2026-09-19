-- Migration locale d'audit et de correction du module Collaborateurs Ecomfy

-- 1. Migration sécurisée du type de colonne roles vers text[]
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'shop_collaborators' AND column_name = 'roles'
  ) THEN
    ALTER TABLE public.shop_collaborators ALTER COLUMN roles TYPE text[] USING roles::text[];
  END IF;
END $$;

-- 2. Mise à jour de la fonction SECURITY DEFINER has_shop_role
-- Elle accorde les droits si :
-- a) L'utilisateur est le propriétaire principal de la boutique
-- b) L'utilisateur est un collaborateur actif possédant le rôle spécifique OU le rôle master 'full_admin'
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

-- Surcharge de sécurité pour conserver la compatibilité avec l'ancien type enum si référencé
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_collab_role') THEN
    CREATE OR REPLACE FUNCTION public.has_shop_role(_shop_id uuid, _user_id uuid, _role public.shop_collab_role)
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT public.has_shop_role(_shop_id, _user_id, _role::text);
    $$;
  END IF;
END $$;

-- 3. Mise à jour des politiques RLS sur les produits pour inclure manage_catalog et full_admin
DROP POLICY IF EXISTS "Collaborators edit_shop can write products" ON public.products;
DROP POLICY IF EXISTS "Collaborators manage products" ON public.products;
CREATE POLICY "Collaborators manage products"
ON public.products FOR ALL
TO authenticated
USING (
  public.is_shop_owner(shop_id, auth.uid())
  OR public.has_shop_role(shop_id, auth.uid(), 'edit_shop')
  OR public.has_shop_role(shop_id, auth.uid(), 'manage_catalog')
)
WITH CHECK (
  public.is_shop_owner(shop_id, auth.uid())
  OR public.has_shop_role(shop_id, auth.uid(), 'edit_shop')
  OR public.has_shop_role(shop_id, auth.uid(), 'manage_catalog')
);

-- 4. Mise à jour des politiques RLS sur les images de produits
DROP POLICY IF EXISTS "Collaborators edit_shop can manage product images" ON public.product_images;
DROP POLICY IF EXISTS "Collaborators manage product images" ON public.product_images;
CREATE POLICY "Collaborators manage product images"
ON public.product_images FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_images.product_id
      AND (
        public.is_shop_owner(p.shop_id, auth.uid())
        OR public.has_shop_role(p.shop_id, auth.uid(), 'edit_shop')
        OR public.has_shop_role(p.shop_id, auth.uid(), 'manage_catalog')
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_images.product_id
      AND (
        public.is_shop_owner(p.shop_id, auth.uid())
        OR public.has_shop_role(p.shop_id, auth.uid(), 'edit_shop')
        OR public.has_shop_role(p.shop_id, auth.uid(), 'manage_catalog')
      )
  )
);

-- 5. Attribution des permissions SELECT/ALL sur shop_collaborators pour les utilisateurs authentifiés (géré par RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_collaborators TO authenticated;
