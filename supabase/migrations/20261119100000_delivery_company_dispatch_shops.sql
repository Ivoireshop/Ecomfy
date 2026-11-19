-- Livraison, étape C : filtre « commerçant » du tableau de suivi de la structure (cahier des charges §7.2).
-- La structure ne peut pas lire la table shops (RLS) : cette fonction ne renvoie que le nom public des boutiques
-- qui lui ont transmis au moins une commande, et seulement si l'appelant a le droit de consulter cette structure.
CREATE OR REPLACE FUNCTION public.delivery_company_dispatch_shops(_company_id uuid)
RETURNS TABLE (shop_id uuid, business_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT d.shop_id, s.business_name
    FROM public.delivery_dispatches d
    JOIN public.shops s ON s.id = d.shop_id
   WHERE d.company_id = _company_id
     AND d.shop_id IS NOT NULL
     AND public.delivery_company_can(_company_id, 'read');
$$;
REVOKE ALL ON FUNCTION public.delivery_company_dispatch_shops(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_company_dispatch_shops(uuid) TO authenticated, service_role;
