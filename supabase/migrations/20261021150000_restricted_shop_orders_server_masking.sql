-- Boutique restreinte : le masquage des coordonnées clients est imposé par la base, plus seulement par l'écran.
--
-- Constat : une boutique « restreinte » (seuil de facturation atteint, délai écoulé) ne voyait ses clients masqués
-- que par le front. Côté base, deux définitions de « restreinte » coexistaient :
--   * la RLS de `orders` ne bloquait la lecture directe que si `shops.is_suspended = true` ;
--   * `get_shop_orders_secure` masquait selon `shop_payment_status IN ('STORE_RESTRICTED','locked','PAYMENT_OVERDUE','final_suspension')`.
-- Un statut restreint sans `is_suspended` (ex. PAYMENT_OVERDUE) laissait donc le propriétaire lire les noms, téléphones et
-- adresses de ses clients par l'API, sans régler sa facture. À l'inverse, une boutique suspendue ne recevait AUCUNE ligne
-- (la RLS filtre tout) : tableau de bord vide au lieu de commandes masquées.
--
-- Après cette migration :
--   * `is_shop_restricted(shop)` est l'unique définition (suspendue OU statut restreint) ;
--   * la lecture directe de `orders` est refusée au propriétaire et aux collaborateurs d'une boutique restreinte
--     (les fournisseurs de livraison assignés et les fondateurs ne sont pas concernés) ;
--   * `get_shop_orders_secure` s'appuie sur cette définition et masque aussi `notes` (note interne de livraison, qui peut
--     citer un client) ; c'est la seule voie de lecture d'une boutique restreinte, le front l'utilise (ShopEditor).
-- Signature de `get_shop_orders_secure` inchangée. Idempotent. Sans effet sur les boutiques non restreintes.
-- Tests : supabase/tests/restricted_shop_orders.sql (base jetable).

CREATE OR REPLACE FUNCTION public.is_shop_restricted(_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT COALESCE(s.is_suspended, false)
            OR COALESCE(s.shop_payment_status, 'active') IN ('STORE_RESTRICTED', 'locked', 'PAYMENT_OVERDUE', 'final_suspension')
       FROM public.shops s
      WHERE s.id = _shop_id),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_shop_restricted(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_shop_restricted(uuid) TO authenticated, service_role;

-- Lecture directe : propriétaire
DROP POLICY IF EXISTS "Shop owners can view orders unlocked" ON public.orders;
CREATE POLICY "Shop owners can view orders unlocked"
ON public.orders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = orders.shop_id
      AND s.user_id = auth.uid()
  )
  AND NOT public.is_shop_restricted(orders.shop_id)
);

-- Lecture directe : collaborateurs
DROP POLICY IF EXISTS "Collaborators can view shop orders unlocked" ON public.orders;
CREATE POLICY "Collaborators can view shop orders unlocked"
ON public.orders FOR SELECT
USING (
  (public.has_shop_role(shop_id, auth.uid(), 'view_orders'::shop_collab_role)
   OR public.has_shop_role(shop_id, auth.uid(), 'manage_delivered_orders'::shop_collab_role))
  AND NOT public.is_shop_restricted(orders.shop_id)
);

-- Lecture masquée (boutique restreinte) ou complète (sinon), contrôle d'accès inchangé.
CREATE OR REPLACE FUNCTION public.get_shop_orders_secure(_shop_id uuid)
RETURNS TABLE (
  id uuid,
  order_number text,
  shop_id uuid,
  customer_name text,
  customer_phone text,
  customer_email text,
  customer_address text,
  customer_city text,
  customer_country text,
  subtotal numeric,
  total numeric,
  commission_amount numeric,
  payment_method text,
  payment_status text,
  order_status text,
  products_summary text,
  received_during_lock boolean,
  is_read boolean,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  is_restricted boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_restricted boolean;
BEGIN
  -- Contrôle de propriété : propriétaire, collaborateur actif ou fondateur uniquement.
  IF auth.uid() IS NULL
     OR NOT (
       public.is_shop_owner(_shop_id, auth.uid())
       OR public.is_shop_collaborator(_shop_id, auth.uid())
       OR public.has_role(auth.uid(), 'founder')
       OR public.has_role(auth.uid(), 'co_founder')
     )
  THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_is_restricted := public.is_shop_restricted(_shop_id);

  IF v_is_restricted THEN
    RETURN QUERY
    SELECT
      o.id,
      o.order_number,
      o.shop_id,
      '••••••••'::text AS customer_name,
      '••••••••'::text AS customer_phone,
      '••••••••'::text AS customer_email,
      '••••••••'::text AS customer_address,
      '••••••••'::text AS customer_city,
      o.customer_country,
      o.subtotal,
      o.total,
      o.commission_amount,
      o.payment_method,
      o.payment_status,
      o.order_status,
      o.products_summary,
      o.received_during_lock,
      o.is_read,
      NULL::text AS notes,
      o.created_at,
      o.updated_at,
      true AS is_restricted
    FROM public.orders o
   WHERE o.shop_id = _shop_id
   ORDER BY o.created_at DESC;
  ELSE
    RETURN QUERY
    SELECT
      o.id,
      o.order_number,
      o.shop_id,
      o.customer_name,
      o.customer_phone,
      o.customer_email,
      o.customer_address,
      o.customer_city,
      o.customer_country,
      o.subtotal,
      o.total,
      o.commission_amount,
      o.payment_method,
      o.payment_status,
      o.order_status,
      o.products_summary,
      o.received_during_lock,
      o.is_read,
      o.notes,
      o.created_at,
      o.updated_at,
      false AS is_restricted
    FROM public.orders o
   WHERE o.shop_id = _shop_id
   ORDER BY o.created_at DESC;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_shop_orders_secure(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shop_orders_secure(uuid) TO authenticated;
