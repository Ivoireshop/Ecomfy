-- Livraisons : fin de la récursion de politique RLS et garde-fous sur « Expédier ».
--
-- Constat 1 (récursion) : lire `order_deliveries` échouait pour tout le monde avec
--   42P17 « infinite recursion detected in policy for relation "delivery_company_members" ».
-- Cycle : les politiques de `order_deliveries` lisent `delivery_company_members` (pour savoir si on est membre ou
-- livreur), et la politique « Shop owners can view assigned delivery members » de `delivery_company_members` relit
-- `order_deliveries`. Conséquence côté boutique : la requête « Suivi Livraison » du tableau de bord renvoyait 500 et
-- aucune livraison ne s'affichait, pour aucune boutique.
-- Correction : la politique du propriétaire de boutique passe par une fonction SECURITY DEFINER (lecture sans RLS),
-- ce qui rompt le cycle sans toucher aux droits des prestataires et des livreurs.
--
-- Constat 2 (push_order_to_delivery_provider) :
--   * une commande déjà livrée, annulée ou retournée pouvait être (re)confiée à un livreur ;
--   * le prestataire n'était pas vérifié : ni actif, ni connecté à la boutique ;
--   * `ON CONFLICT DO UPDATE … status = 'pending'` remettait à zéro une livraison déjà récupérée, en route ou livrée
--     (et écrasait son livreur).
-- Après : ces trois cas sont refusés avec un message en français. Un nouvel envoi reste possible tant que la livraison
-- est en attente, assignée, en échec ou retournée. Signature et format de retour inchangés.
--
-- Idempotent. Tests : supabase/tests/delivery_rls_recursion*.sql (base jetable).

CREATE OR REPLACE FUNCTION public.shop_owner_can_see_delivery_member(_member_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.order_deliveries od
      JOIN public.orders o ON o.id = od.order_id
      JOIN public.shops s ON s.id = o.shop_id
     WHERE od.driver_id = _member_id
       AND s.user_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.shop_owner_can_see_delivery_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_owner_can_see_delivery_member(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Shop owners can view assigned delivery members" ON public.delivery_company_members;
CREATE POLICY "Shop owners can view assigned delivery members"
  ON public.delivery_company_members FOR SELECT
  TO authenticated
  USING (public.shop_owner_can_see_delivery_member(id, auth.uid()));

CREATE OR REPLACE FUNCTION public.push_order_to_delivery_provider(
  p_order_id uuid,
  p_provider_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_existing_status text;
  v_zone_id uuid;
  v_driver_id uuid;
BEGIN
  -- 1. La commande existe et appartient à une boutique du demandeur
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;

  IF v_order IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.shops s
    WHERE s.id = v_order.shop_id AND s.user_id = auth.uid()
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- 2. Une commande terminée ou annulée ne part plus en livraison
  IF v_order.order_status IN ('delivered', 'cancelled', 'returned') THEN
    RETURN json_build_object('success', false, 'error', 'Cette commande est déjà clôturée (livrée, annulée ou retournée) : elle ne peut plus être expédiée.');
  END IF;

  -- 3. Le prestataire est actif et connecté à cette boutique
  IF NOT EXISTS (
    SELECT 1
      FROM public.shop_delivery_connections sdc
      JOIN public.delivery_providers dp ON dp.id = sdc.delivery_provider_id
     WHERE sdc.shop_id = v_order.shop_id
       AND sdc.delivery_provider_id = p_provider_id
       AND sdc.status = 'active'
       AND dp.is_active = true
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Ce partenaire de livraison n''est pas connecté à votre boutique ou n''est plus actif.');
  END IF;

  -- 4. Une livraison déjà en cours ne se réinitialise pas
  SELECT status INTO v_existing_status FROM public.order_deliveries WHERE order_id = p_order_id;
  IF v_existing_status IN ('picked_up', 'in_transit', 'delivered') THEN
    RETURN json_build_object('success', false, 'error', 'La livraison de cette commande est déjà en cours ou terminée.');
  END IF;

  -- 5. Zone correspondant à la ville du client
  IF v_order.customer_city IS NOT NULL THEN
    SELECT id INTO v_zone_id FROM public.delivery_zones
    WHERE provider_id = p_provider_id
      AND is_active = true
      AND (
        lower(name) = lower(v_order.customer_city) OR
        lower(city) = lower(v_order.customer_city)
      )
    LIMIT 1;
  END IF;

  -- 6. Livreur disponible dans cette zone
  IF v_zone_id IS NOT NULL THEN
    SELECT driver_id INTO v_driver_id FROM public.delivery_driver_zones dz
    JOIN public.delivery_company_members dcm ON dz.driver_id = dcm.id
    WHERE dz.zone_id = v_zone_id
      AND dz.provider_id = p_provider_id
      AND dcm.is_active = true
      AND dcm.role = 'driver'
    ORDER BY random()
    LIMIT 1;
  END IF;

  -- 7. Livraison
  INSERT INTO public.order_deliveries (order_id, provider_id, driver_id, status)
  VALUES (p_order_id, p_provider_id, v_driver_id, 'pending')
  ON CONFLICT (order_id) DO UPDATE
  SET provider_id = EXCLUDED.provider_id,
      driver_id = EXCLUDED.driver_id,
      status = 'pending';

  -- 8. Commande
  UPDATE public.orders
  SET delivery_provider_id = p_provider_id,
      delivery_transferred_at = now()
  WHERE id = p_order_id;

  RETURN json_build_object(
    'success', true,
    'assigned_driver_id', v_driver_id,
    'assigned_zone_id', v_zone_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.push_order_to_delivery_provider(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.push_order_to_delivery_provider(uuid, uuid) TO authenticated, service_role;
