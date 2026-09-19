-- Migration locale pour ajouter la planification de livraison aux commandes Ecomfy

-- 1. Ajout des colonnes de planification de livraison sur la table orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS scheduled_delivery_date date,
ADD COLUMN IF NOT EXISTS internal_delivery_note text;

-- 2. Création d'un index de performance pour les filtres et tri par date de livraison
CREATE INDEX IF NOT EXISTS idx_orders_scheduled_delivery 
ON public.orders(shop_id, scheduled_delivery_date);

-- 3. Mise à jour de la politique RLS d'UPDATE sur la table orders
-- Permet au propriétaire et aux collaborateurs autorisés de mettre à jour la date de livraison programmée
DROP POLICY IF EXISTS "Collaborators can update orders" ON public.orders;
CREATE POLICY "Collaborators can update orders"
ON public.orders FOR UPDATE
TO authenticated
USING (
  public.is_shop_owner(shop_id, auth.uid())
  OR public.has_shop_role(shop_id, auth.uid(), 'manage_delivered_orders')
  OR public.has_shop_role(shop_id, auth.uid(), 'view_orders')
  OR public.has_shop_role(shop_id, auth.uid(), 'edit_shop')
)
WITH CHECK (
  public.is_shop_owner(shop_id, auth.uid())
  OR public.has_shop_role(shop_id, auth.uid(), 'manage_delivered_orders')
  OR public.has_shop_role(shop_id, auth.uid(), 'view_orders')
  OR public.has_shop_role(shop_id, auth.uid(), 'edit_shop')
);
