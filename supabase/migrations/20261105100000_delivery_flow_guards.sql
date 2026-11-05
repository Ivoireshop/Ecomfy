-- Logistique : flux commande -> affectation -> livraison, statuts (ancien module order_deliveries, celui de la prod).
--
-- Constats (audit du 05/11/2026) :
--  1. Un livreur (membre, pas propriétaire du prestataire) ne peut pas lire `orders` : la jointure de l'app livreur
--     revient `null`, la liste est vide et la page mission n'affiche ni client ni adresse.
--  2. Un livreur voit toutes les livraisons de son prestataire (politique SELECT sur tout membre).
--  3. Aucune garde de transition : `pending -> delivered` direct, `order_id`/`provider_id` modifiables, `delivered_at`
--     forgeable côté client, livreur d'un autre prestataire assignable. Le prestataire a un `FOR ALL` : il peut INSÉRER
--     une livraison sur n'importe quelle commande puis la passer `delivered` (la synchro marque alors la commande livrée).
--  4. Le déclencheur de synchro écrase `cancelled`/`returned` par `delivered`, et une commande annulée après envoi garde
--     une course active chez le livreur.
--  5. `in_transit` ne fait jamais passer la commande en `shipped` ; `failed` n'a aucun effet ni bouton.
--  6. L'auto-transfert (confirmation) ne choisit aucun livreur alors que « Expédier » en choisit un ; le choix est
--     aléatoire (sans tenir compte de la charge) ; un nouvel envoi écrase le livreur déjà affecté.
--
-- Correctifs :
--  * `get_my_delivery_missions` (SECURITY DEFINER) : le livreur ne reçoit que ses courses et les champs utiles
--    (pas de lecture directe de `orders`). `amount_to_collect` vaut 0 si la commande est déjà payée.
--  * SELECT : un livreur ne voit que ses courses ; propriétaire et gestionnaires voient tout le prestataire.
--  * Plus d'INSERT/DELETE direct sur `order_deliveries` (création uniquement par « Expédier » et l'auto-transfert) ;
--    mise à jour réservée au propriétaire, aux gestionnaires (admin, dispatcher) et au livreur actif assigné.
--  * Garde `guard_order_delivery_update` : order_id/provider_id immuables, machine d'états, livreur valide et
--    changeable seulement avant le départ, motif obligatoire pour `failed`, preuve (signature ou photo) obligatoire pour
--    un livreur qui livre (déposée dans le stockage privé, voir 20261105110000), horodatages posés par le serveur. Les appels internes (fonctions SECURITY DEFINER,
--    service_role) ne sont pas bridés, sauf motif d'échec et horodatages.
--  * Synchro vers la commande : `in_transit/picked_up -> shipped`, `delivered`/`returned` sans écraser `cancelled`.
--  * Annulation d'une commande : la livraison active passe `failed` (motif « Commande annulée par la boutique »).
--  * Affectation commune (`pick_delivery_driver`) : zone de la ville du client, livreur actif le moins chargé.
--    Utilisée par « Expédier » et par l'auto-transfert. Un nouvel envoi garde le livreur déjà affecté s'il reste valide.
--
-- Rejouable. Tests : supabase/tests/delivery_flow_guards.sql + delivery_flow_guards_cases.sql (base jetable).

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Fonctions d'aide
-- ---------------------------------------------------------------------------------------------------------------

-- Rôle de l'appelant sur une livraison : 'owner' (propriétaire du prestataire), 'manager' (membre admin/dispatcher),
-- 'driver' (livreur actif assigné) ou NULL. Lecture sans RLS (SECURITY DEFINER), identité = auth.uid().
CREATE OR REPLACE FUNCTION public.delivery_actor_kind(_provider_id uuid, _driver_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.delivery_providers dp WHERE dp.id = _provider_id AND dp.user_id = auth.uid()) THEN
    RETURN 'owner';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.delivery_company_members m
     WHERE m.provider_id = _provider_id AND m.user_id = auth.uid() AND m.is_active AND m.role IN ('admin', 'dispatcher')
  ) THEN
    RETURN 'manager';
  END IF;
  IF _driver_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.delivery_company_members m
     WHERE m.id = _driver_id AND m.provider_id = _provider_id AND m.user_id = auth.uid() AND m.is_active AND m.role = 'driver'
  ) THEN
    RETURN 'driver';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_actor_kind(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_actor_kind(uuid, uuid) TO authenticated, service_role;

-- Le livreur existe, est actif et appartient bien à ce prestataire.
CREATE OR REPLACE FUNCTION public.delivery_driver_is_valid(_driver_id uuid, _provider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.delivery_company_members m
     WHERE m.id = _driver_id AND m.provider_id = _provider_id AND m.role = 'driver' AND m.is_active
  );
$$;

REVOKE ALL ON FUNCTION public.delivery_driver_is_valid(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_driver_is_valid(uuid, uuid) TO authenticated, service_role;

-- Choix de la zone et du livreur pour une ville : zones actives du prestataire dont le nom ou la ville correspond,
-- livreur actif de ces zones ayant le moins de courses en cours (en cas d'égalité : au hasard).
CREATE OR REPLACE FUNCTION public.pick_delivery_driver(_provider_id uuid, _city text, OUT o_zone_id uuid, OUT o_driver_id uuid)
RETURNS record
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  o_zone_id := NULL;
  o_driver_id := NULL;
  IF _city IS NULL OR btrim(_city) = '' THEN RETURN; END IF;

  SELECT dz.zone_id, dz.driver_id INTO o_zone_id, o_driver_id
    FROM public.delivery_driver_zones dz
    JOIN public.delivery_zones z ON z.id = dz.zone_id AND z.provider_id = _provider_id AND z.is_active = true
    JOIN public.delivery_company_members m ON m.id = dz.driver_id AND m.provider_id = _provider_id
                                           AND m.is_active = true AND m.role = 'driver'
   WHERE dz.provider_id = _provider_id
     AND (lower(z.name) = lower(_city) OR lower(z.city) = lower(_city))
   ORDER BY (SELECT count(*) FROM public.order_deliveries od
              WHERE od.driver_id = m.id AND od.status IN ('pending', 'assigned', 'picked_up', 'in_transit')) ASC,
            random()
   LIMIT 1;

  -- Zone connue mais sans livreur : on renvoie quand même la zone (information du demandeur).
  IF o_zone_id IS NULL THEN
    SELECT z.id INTO o_zone_id
      FROM public.delivery_zones z
     WHERE z.provider_id = _provider_id AND z.is_active = true
       AND (lower(z.name) = lower(_city) OR lower(z.city) = lower(_city))
     LIMIT 1;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.pick_delivery_driver(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pick_delivery_driver(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Garde de mise à jour de order_deliveries
-- ---------------------------------------------------------------------------------------------------------------

-- SECURITY INVOKER : current_user vaut le rôle de l'appelant. Les appels internes (fonctions SECURITY DEFINER comme
-- « Expédier » ou l'annulation de commande, service_role, auth.uid() nul) passent sans contrôle de droits.
CREATE OR REPLACE FUNCTION public.guard_order_delivery_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_enforce boolean := auth.uid() IS NOT NULL AND current_user IN ('authenticated', 'anon');
  v_kind text;
  v_ok boolean;
BEGIN
  IF v_enforce THEN
    IF NEW.order_id IS DISTINCT FROM OLD.order_id OR NEW.provider_id IS DISTINCT FROM OLD.provider_id THEN
      RAISE EXCEPTION 'La commande et le prestataire d''une livraison ne peuvent pas être modifiés.' USING ERRCODE = '42501';
    END IF;

    v_kind := public.delivery_actor_kind(OLD.provider_id, OLD.driver_id);
    IF v_kind IS NULL THEN
      RAISE EXCEPTION 'Action non autorisée sur cette livraison.' USING ERRCODE = '42501';
    END IF;

    -- Preuve de livraison : un livreur dépose un CHEMIN du stockage privé « delivery-proofs », dans le dossier de cette
    -- livraison (<id de livraison>/<fichier>), jamais une URL externe ni une image encodée en base. Une valeur
    -- inchangée (ancienne preuve) reste tolérée.
    IF v_kind = 'driver' AND (
         (NEW.pod_signature_url IS DISTINCT FROM OLD.pod_signature_url AND NEW.pod_signature_url IS NOT NULL
            AND left(NEW.pod_signature_url, length(OLD.id::text) + 1) <> OLD.id::text || '/')
      OR (NEW.pod_photo_url IS DISTINCT FROM OLD.pod_photo_url AND NEW.pod_photo_url IS NOT NULL
            AND left(NEW.pod_photo_url, length(OLD.id::text) + 1) <> OLD.id::text || '/')
    ) THEN
      RAISE EXCEPTION 'La preuve doit être déposée dans le stockage sécurisé de cette livraison.' USING ERRCODE = '42501';
    END IF;

    -- Affectation du livreur : avant le départ seulement, par un gestionnaire, livreur valide du même prestataire
    IF NEW.driver_id IS DISTINCT FROM OLD.driver_id THEN
      IF v_kind = 'driver' THEN
        RAISE EXCEPTION 'Un livreur ne peut pas réassigner une course.' USING ERRCODE = '42501';
      END IF;
      IF OLD.status NOT IN ('pending', 'assigned', 'failed') THEN
        RAISE EXCEPTION 'Le livreur ne peut plus être changé : la course a commencé ou est terminée.' USING ERRCODE = '23514';
      END IF;
      IF NEW.driver_id IS NOT NULL AND NOT public.delivery_driver_is_valid(NEW.driver_id, OLD.provider_id) THEN
        RAISE EXCEPTION 'Livreur invalide : il doit être un livreur actif de ce prestataire.' USING ERRCODE = '23514';
      END IF;
    END IF;

    -- Machine d'états
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_ok := CASE
        WHEN OLD.status = 'pending'    AND NEW.status IN ('picked_up', 'in_transit', 'failed') THEN true
        WHEN OLD.status = 'assigned'   AND NEW.status IN ('pending', 'picked_up', 'in_transit', 'failed') THEN true
        WHEN OLD.status = 'picked_up'  AND NEW.status IN ('in_transit', 'delivered', 'failed') THEN true
        WHEN OLD.status = 'in_transit' AND NEW.status IN ('delivered', 'failed') THEN true
        WHEN OLD.status = 'failed'     AND NEW.status IN ('pending', 'returned') THEN true
        WHEN OLD.status = 'delivered'  AND NEW.status = 'returned' THEN true
        ELSE false
      END;
      -- Le livreur ne remet pas en attente et ne clôture pas un retour
      IF v_ok AND v_kind = 'driver' AND (NEW.status IN ('pending', 'returned') OR OLD.status IN ('failed', 'delivered')) THEN
        v_ok := false;
      END IF;
      IF NOT v_ok THEN
        RAISE EXCEPTION 'Changement de statut interdit : % vers %.', OLD.status, NEW.status USING ERRCODE = '23514';
      END IF;

      IF v_kind = 'driver' AND NEW.status = 'delivered'
         AND NEW.pod_signature_url IS NULL AND NEW.pod_photo_url IS NULL THEN
        RAISE EXCEPTION 'La preuve de livraison (signature ou photo) est obligatoire.' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  -- Motif obligatoire pour un échec (tous appelants)
  IF NEW.status = 'failed' AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.failure_reason := left(btrim(coalesce(NEW.failure_reason, '')), 300);
    IF NEW.failure_reason = '' THEN
      RAISE EXCEPTION 'Le motif de l''échec de livraison est obligatoire.' USING ERRCODE = '23514';
    END IF;
  END IF;

  -- Horodatages posés par le serveur
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('picked_up', 'in_transit') THEN
      NEW.picked_up_at := coalesce(OLD.picked_up_at, now());
    ELSIF NEW.status = 'delivered' THEN
      NEW.picked_up_at := coalesce(OLD.picked_up_at, now());
      NEW.delivered_at := now();
    ELSIF NEW.status = 'pending' THEN
      NEW.picked_up_at := NULL;
      NEW.delivered_at := NULL;
      NEW.failure_reason := NULL;
    END IF;
  ELSIF v_enforce THEN
    NEW.picked_up_at := OLD.picked_up_at;
    NEW.delivered_at := OLD.delivered_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_deliveries_guard ON public.order_deliveries;
CREATE TRIGGER order_deliveries_guard
  BEFORE UPDATE ON public.order_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_delivery_update();

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Droits et politiques RLS de order_deliveries
-- ---------------------------------------------------------------------------------------------------------------

-- Plus de création ni de suppression directes : « Expédier » et l'auto-transfert (SECURITY DEFINER) suffisent.
REVOKE INSERT, DELETE ON public.order_deliveries FROM authenticated, anon;

DROP POLICY IF EXISTS "Provider admins and dispatchers can manage deliveries" ON public.order_deliveries;
DROP POLICY IF EXISTS "Provider managers can update deliveries" ON public.order_deliveries;
CREATE POLICY "Provider managers can update deliveries"
  ON public.order_deliveries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members dcm
       WHERE dcm.provider_id = order_deliveries.provider_id AND dcm.user_id = auth.uid()
         AND dcm.is_active AND dcm.role IN ('admin', 'dispatcher')
    ) OR EXISTS (
      SELECT 1 FROM public.delivery_providers dp
       WHERE dp.id = order_deliveries.provider_id AND dp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members dcm
       WHERE dcm.provider_id = order_deliveries.provider_id AND dcm.user_id = auth.uid()
         AND dcm.is_active AND dcm.role IN ('admin', 'dispatcher')
    ) OR EXISTS (
      SELECT 1 FROM public.delivery_providers dp
       WHERE dp.id = order_deliveries.provider_id AND dp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Delivery drivers can update their assigned deliveries" ON public.order_deliveries;
CREATE POLICY "Delivery drivers can update their assigned deliveries"
  ON public.order_deliveries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members dcm
       WHERE dcm.id = order_deliveries.driver_id AND dcm.user_id = auth.uid() AND dcm.role = 'driver' AND dcm.is_active
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members dcm
       WHERE dcm.id = order_deliveries.driver_id AND dcm.user_id = auth.uid() AND dcm.role = 'driver' AND dcm.is_active
    )
  );

-- Lecture : propriétaire et gestionnaires (tous rôles sauf livreur) voient tout le prestataire ; un livreur, ses courses.
DROP POLICY IF EXISTS "Delivery provider members can view their deliveries" ON public.order_deliveries;
CREATE POLICY "Delivery provider members can view their deliveries"
  ON public.order_deliveries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_company_members dcm
       WHERE dcm.provider_id = order_deliveries.provider_id AND dcm.user_id = auth.uid()
         AND (dcm.role <> 'driver' OR dcm.id = order_deliveries.driver_id)
    ) OR EXISTS (
      SELECT 1 FROM public.delivery_providers dp
       WHERE dp.id = order_deliveries.provider_id AND dp.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Synchro livraison -> commande (ne ressuscite plus une commande annulée)
-- ---------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_delivery_status_to_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('picked_up', 'in_transit') THEN
    UPDATE public.orders SET order_status = 'shipped', updated_at = now()
     WHERE id = NEW.order_id AND order_status IN ('new', 'pending', 'confirmed', 'processing');
  ELSIF NEW.status = 'delivered' THEN
    UPDATE public.orders SET order_status = 'delivered', updated_at = now()
     WHERE id = NEW.order_id AND order_status NOT IN ('cancelled', 'returned', 'delivered');
  ELSIF NEW.status = 'returned' THEN
    UPDATE public.orders SET order_status = 'returned', updated_at = now()
     WHERE id = NEW.order_id AND order_status NOT IN ('cancelled', 'returned');
  END IF;
  -- 'failed' : la commande garde son statut ; la boutique voit l'échec dans « Suivi Livraison » et peut relancer.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_delivery_status_change ON public.order_deliveries;
CREATE TRIGGER on_delivery_status_change
  AFTER UPDATE OF status ON public.order_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.sync_delivery_status_to_order();

-- Commande annulée : la course active est clôturée en échec (le livreur ne la voit plus dans ses courses actives).
CREATE OR REPLACE FUNCTION public.close_delivery_on_order_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.order_deliveries
     SET status = 'failed', failure_reason = 'Commande annulée par la boutique'
   WHERE order_id = NEW.id AND status IN ('pending', 'assigned', 'picked_up', 'in_transit');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_close_delivery_on_cancel ON public.orders;
CREATE TRIGGER orders_close_delivery_on_cancel
  AFTER UPDATE OF order_status ON public.orders
  FOR EACH ROW
  WHEN (NEW.order_status = 'cancelled' AND OLD.order_status IS DISTINCT FROM 'cancelled')
  EXECUTE FUNCTION public.close_delivery_on_order_cancel();

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Affectation : « Expédier » et auto-transfert partagent le même choix de livreur
-- ---------------------------------------------------------------------------------------------------------------

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
  v_existing record;
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
  SELECT status, provider_id, driver_id INTO v_existing FROM public.order_deliveries WHERE order_id = p_order_id;
  IF v_existing.status IN ('picked_up', 'in_transit', 'delivered') THEN
    RETURN json_build_object('success', false, 'error', 'La livraison de cette commande est déjà en cours ou terminée.');
  END IF;

  -- 5-6. Zone de la ville du client et livreur le moins chargé
  SELECT p.o_zone_id, p.o_driver_id INTO v_zone_id, v_driver_id
    FROM public.pick_delivery_driver(p_provider_id, v_order.customer_city) p;

  -- Même prestataire et livreur déjà affecté toujours valide : on le garde
  IF v_existing.provider_id = p_provider_id AND v_existing.driver_id IS NOT NULL
     AND public.delivery_driver_is_valid(v_existing.driver_id, p_provider_id) THEN
    v_driver_id := v_existing.driver_id;
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

-- Auto-transfert à la confirmation : choisit aussi un livreur (comme « Expédier »).
CREATE OR REPLACE FUNCTION public.auto_transfer_order_to_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid;
  v_driver_id uuid;
BEGIN
  IF NEW.order_status = 'confirmed'
     AND (OLD.order_status IS DISTINCT FROM 'confirmed')
     AND NEW.delivery_provider_id IS NULL THEN

    SELECT sdc.delivery_provider_id INTO v_provider_id
      FROM public.shop_delivery_connections sdc
      JOIN public.delivery_providers dp ON dp.id = sdc.delivery_provider_id
     WHERE sdc.shop_id = NEW.shop_id
       AND sdc.status = 'active'
       AND sdc.auto_transfer = true
       AND dp.is_active = true
     ORDER BY sdc.created_at ASC
     LIMIT 1;

    IF v_provider_id IS NOT NULL THEN
      NEW.delivery_provider_id := v_provider_id;
      NEW.delivery_transferred_at := now();

      SELECT p.o_driver_id INTO v_driver_id FROM public.pick_delivery_driver(v_provider_id, NEW.customer_city) p;

      INSERT INTO public.order_deliveries (order_id, provider_id, driver_id, status)
      VALUES (NEW.id, v_provider_id, v_driver_id, 'pending')
      ON CONFLICT (order_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Missions du livreur (lecture minimale, sans ouvrir `orders`)
-- ---------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_delivery_missions(_delivery_id uuid DEFAULT NULL, _statuses text[] DEFAULT NULL)
RETURNS TABLE (
  delivery_id uuid,
  status text,
  order_id uuid,
  order_number text,
  order_status text,
  customer_name text,
  customer_phone text,
  customer_address text,
  customer_city text,
  total_amount numeric,
  payment_status text,
  amount_to_collect numeric,
  failure_reason text,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT od.id, od.status, od.order_id, o.order_number, o.order_status,
         o.customer_name, o.customer_phone, o.customer_address, o.customer_city,
         o.total, o.payment_status,
         CASE WHEN lower(coalesce(o.payment_status, '')) = 'paid' THEN 0 ELSE coalesce(o.total, 0) END,
         od.failure_reason, od.picked_up_at, od.delivered_at, od.created_at
    FROM public.order_deliveries od
    JOIN public.orders o ON o.id = od.order_id
    JOIN public.delivery_company_members m
      ON m.id = od.driver_id AND m.user_id = auth.uid() AND m.is_active AND m.role = 'driver'
   WHERE auth.uid() IS NOT NULL
     AND (_delivery_id IS NULL OR od.id = _delivery_id)
     AND (_statuses IS NULL OR od.status = ANY (_statuses))
   ORDER BY od.created_at ASC
$$;

REVOKE ALL ON FUNCTION public.get_my_delivery_missions(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_delivery_missions(uuid, text[]) TO authenticated, service_role;
