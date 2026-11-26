-- Une commande ne part que par UN circuit à la fois : structure de livraison (delivery_dispatches) OU livraison
-- « Expédier » (order_deliveries). Avant : delivery_dispatch_transmit ignorait order_deliveries et
-- push_order_to_delivery_provider ignorait delivery_dispatches, donc deux livreurs pouvaient recevoir la même commande.
--
-- Course active : statut autre que refused, cancelled, returned, failed.
-- Livraison « Expédier » active : statut autre que failed, returned.
-- Seule l'ENTRÉE dans un état actif est contrôlée : les doublons déjà présents continuent d'avancer normalement.
-- Prérequis : 20261105100000, 20261118110000. Rejouable.

CREATE OR REPLACE FUNCTION public.guard_order_single_delivery_circuit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'order_deliveries' THEN
    IF NEW.status IN ('failed', 'returned') THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' THEN
      IF OLD.status NOT IN ('failed', 'returned') AND NEW.provider_id IS NOT DISTINCT FROM OLD.provider_id THEN
        RETURN NEW;
      END IF;
    END IF;
  ELSE
    IF NEW.status::text IN ('refused', 'cancelled', 'returned', 'failed') THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' THEN
      IF OLD.status::text NOT IN ('refused', 'cancelled', 'returned', 'failed') THEN RETURN NEW; END IF;
    END IF;
  END IF;

  -- Verrou sur la commande : deux envois simultanés passent l'un après l'autre.
  PERFORM 1 FROM public.orders WHERE id = NEW.order_id FOR NO KEY UPDATE;

  IF TG_TABLE_NAME = 'order_deliveries' THEN
    IF EXISTS (
      SELECT 1 FROM public.delivery_dispatches d
       WHERE d.order_id = NEW.order_id
         AND d.status::text NOT IN ('refused', 'cancelled', 'returned', 'failed')
    ) THEN
      RAISE EXCEPTION 'Cette commande est déjà confiée à une structure de livraison.' USING ERRCODE = '23505';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.delivery_dispatches d
       WHERE d.order_id = NEW.order_id AND d.id <> NEW.id
         AND d.status::text NOT IN ('refused', 'cancelled', 'returned', 'failed')
    ) THEN
      RAISE EXCEPTION 'Cette commande est déjà confiée à une structure de livraison.' USING ERRCODE = '23505';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.order_deliveries od
       WHERE od.order_id = NEW.order_id AND od.status NOT IN ('failed', 'returned')
    ) THEN
      RAISE EXCEPTION 'Cette commande est déjà expédiée vers un partenaire de livraison.' USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_order_single_delivery_circuit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_single_delivery_circuit ON public.order_deliveries;
CREATE TRIGGER trg_single_delivery_circuit
  BEFORE INSERT OR UPDATE OF status, provider_id ON public.order_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_single_delivery_circuit();

DROP TRIGGER IF EXISTS trg_single_delivery_circuit ON public.delivery_dispatches;
CREATE TRIGGER trg_single_delivery_circuit
  BEFORE INSERT OR UPDATE OF status ON public.delivery_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_single_delivery_circuit();

-- L'auto-transfert à la confirmation doit ignorer une commande déjà confiée à une structure : sans cela, la garde
-- ci-dessus ferait échouer la confirmation elle-même. Reprise de 20261105100000 avec cette seule condition en plus.
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
     AND NEW.delivery_provider_id IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.delivery_dispatches d
        WHERE d.order_id = NEW.id
          AND d.status::text NOT IN ('refused', 'cancelled', 'returned', 'failed')
     ) THEN

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
