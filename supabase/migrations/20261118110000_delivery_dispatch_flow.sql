-- Livraison, étape A (2/2) : transmission, acceptation/refus, affectation, historique et gardes serveur.
--
-- Avant : le marchand insérait la course directement (statut « assigned », aucune acceptation possible) et le marchand
-- comme la structure pouvaient modifier TOUTES les colonnes d'une course (montant à encaisser, frais, statut).
-- Après : toute transition passe par une action serveur qui vérifie qui agit, depuis quel statut, et journalise.
-- Les courses existantes restent valides (statuts historiques conservés). Prérequis : 20261118100000.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Colonnes de suivi
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.delivery_dispatches
  ADD COLUMN IF NOT EXISTS transmitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS refused_at timestamptz,
  ADD COLUMN IF NOT EXISTS refusal_reason text,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS returned_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Droits d'agir. Un seul point d'entrée par acteur : l'étape B (équipe de la structure) n'aura qu'à
--    redéfinir delivery_company_can pour ouvrir l'accès aux collaborateurs, sans toucher au reste.
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_company_can(_company_id uuid, _perm text DEFAULT 'operate')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.delivery_companies c WHERE c.id = _company_id AND c.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.delivery_company_can(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_company_can(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delivery_dispatch_actor(_shop_id uuid, _company_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'system'; END IF;
  -- La propriété de la structure passe avant le rôle d'administrateur : un administrateur qui possède sa propre structure
  -- agit comme structure (matrice de transitions appliquée) ; il garde son pouvoir de supervision sur toutes les autres.
  IF _company_id IS NOT NULL AND public.delivery_company_can(_company_id, 'operate') THEN RETURN 'company'; END IF;
  IF public.delivery_is_platform_admin() THEN RETURN 'admin'; END IF;
  IF _shop_id IS NOT NULL AND public.is_shop_owner_or_collaborator(_shop_id) THEN RETURN 'seller'; END IF;
  RETURN 'other';
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_dispatch_actor(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_dispatch_actor(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Historique (ajout seul) : qui, quand, de quel statut à quel statut, pourquoi
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_dispatch_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id uuid NOT NULL,                      -- sans clé étrangère : l'historique survit à la suppression de la course
  order_id uuid,
  shop_id uuid,
  company_id uuid,
  event text NOT NULL,                            -- transmitted, received, accepted, refused, assigned, status, cancelled
  from_status text,
  to_status text,
  driver_id uuid,
  reason text,
  note text,
  actor_id uuid,
  actor_kind text NOT NULL CHECK (actor_kind IN ('seller', 'company', 'admin', 'system', 'other')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dispatch_history_dispatch ON public.delivery_dispatch_history(dispatch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dispatch_history_company ON public.delivery_dispatch_history(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispatch_history_shop ON public.delivery_dispatch_history(shop_id, created_at DESC);

ALTER TABLE public.delivery_dispatch_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_dispatch_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.delivery_dispatch_history TO authenticated;
GRANT ALL ON public.delivery_dispatch_history TO service_role;

DROP POLICY IF EXISTS "Dispatch history read" ON public.delivery_dispatch_history;
CREATE POLICY "Dispatch history read" ON public.delivery_dispatch_history
  FOR SELECT TO authenticated
  USING (
    public.delivery_is_platform_admin()
    OR (company_id IS NOT NULL AND public.delivery_company_can(company_id, 'read'))
    OR (shop_id IS NOT NULL AND public.is_shop_owner_or_collaborator(shop_id))
  );

CREATE OR REPLACE FUNCTION public.delivery_dispatch_history_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'L''historique des courses est en ajout seul.' USING ERRCODE = '42501';
END;
$$;
DROP TRIGGER IF EXISTS trg_dispatch_history_no_change ON public.delivery_dispatch_history;
CREATE TRIGGER trg_dispatch_history_no_change
  BEFORE UPDATE OR DELETE ON public.delivery_dispatch_history
  FOR EACH ROW EXECUTE FUNCTION public.delivery_dispatch_history_immutable();
DROP TRIGGER IF EXISTS trg_dispatch_history_no_truncate ON public.delivery_dispatch_history;
CREATE TRIGGER trg_dispatch_history_no_truncate
  BEFORE TRUNCATE ON public.delivery_dispatch_history
  FOR EACH STATEMENT EXECUTE FUNCTION public.delivery_dispatch_history_immutable();

-- Le marchand voit aussi ses courses lorsqu'il est collaborateur de la boutique (la politique d'origine ne couvrait que le propriétaire).
DROP POLICY IF EXISTS "Shop team can view dispatches" ON public.delivery_dispatches;
CREATE POLICY "Shop team can view dispatches" ON public.delivery_dispatches
  FOR SELECT TO authenticated USING (shop_id IS NOT NULL AND public.is_shop_owner_or_collaborator(shop_id));

-- Insertion directe fermée : on passe par delivery_dispatch_transmit.
DROP POLICY IF EXISTS "Sellers can create dispatches" ON public.delivery_dispatches;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Gardes : plus d'écriture libre sur une course ni sur les montants d'un transfert
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_delivery_dispatch_direct()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_free constant text[] := ARRAY['customer_parcel_photo_url', 'delivery_note', 'updated_at'];
BEGIN
  IF auth.uid() IS NULL
     OR current_setting('ecomfy.dispatch_internal', true) = '1'
     OR public.delivery_is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Une course se crée par la transmission d''une commande (delivery_dispatch_transmit).' USING ERRCODE = '42501';
  END IF;

  IF (to_jsonb(NEW) - v_free) IS DISTINCT FROM (to_jsonb(OLD) - v_free) THEN
    RAISE EXCEPTION 'Modification directe interdite : le statut, l''affectation et les montants passent par les actions de la course.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_delivery_dispatch_direct() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_guard_delivery_dispatch_direct ON public.delivery_dispatches;
CREATE TRIGGER trg_guard_delivery_dispatch_direct
  BEFORE INSERT OR UPDATE ON public.delivery_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_dispatch_direct();

CREATE OR REPLACE FUNCTION public.guard_delivery_cash_amounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR current_setting('ecomfy.dispatch_internal', true) = '1'
     OR public.delivery_is_platform_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.cod_amount IS DISTINCT FROM OLD.cod_amount
     OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee
     OR NEW.net_seller_amount IS DISTINCT FROM OLD.net_seller_amount
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.dispatch_id IS DISTINCT FROM OLD.dispatch_id
     OR NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.shop_id IS DISTINCT FROM OLD.shop_id THEN
    RAISE EXCEPTION 'Les montants d''un transfert d''argent ne se modifient pas.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_delivery_cash_amounts() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_guard_delivery_cash_amounts ON public.delivery_cash_transfers;
CREATE TRIGGER trg_guard_delivery_cash_amounts
  BEFORE UPDATE ON public.delivery_cash_transfers
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_cash_amounts();

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Historique et notifications, déclenchés par tout changement de statut ou de livreur (quelle qu'en soit l'origine)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_dispatch_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor text := public.delivery_dispatch_actor(NEW.shop_id, NEW.company_id);
  v_note text := NULLIF(current_setting('ecomfy.dispatch_note', true), '');
  v_reason text := NULLIF(current_setting('ecomfy.dispatch_reason', true), '');
  v_event text;
  v_from text;
  v_to text := NEW.status::text;
  v_num text;
  v_company_user uuid;
  v_shop_user uuid;
  v_title text;
  v_tone text := 'info';
  v_body text;
  v_target text;   -- 'company' ou 'shop'
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.assigned_driver_id IS NOT DISTINCT FROM OLD.assigned_driver_id THEN
      RETURN NEW;
    END IF;
    v_from := OLD.status::text;
  END IF;

  v_event := CASE
    WHEN TG_OP = 'INSERT' THEN 'transmitted'
    WHEN NEW.status IS NOT DISTINCT FROM OLD.status THEN 'assigned'
    WHEN v_to IN ('accepted', 'refused', 'assigned', 'cancelled') THEN v_to
    ELSE 'status'
  END;

  INSERT INTO public.delivery_dispatch_history
    (dispatch_id, order_id, shop_id, company_id, event, from_status, to_status, driver_id, reason, note, actor_id, actor_kind)
  VALUES
    (NEW.id, NEW.order_id, NEW.shop_id, NEW.company_id, v_event, v_from, v_to, NEW.assigned_driver_id, v_reason, v_note,
     auth.uid(), v_actor);

  SELECT o.order_number INTO v_num FROM public.orders o WHERE o.id = NEW.order_id;
  SELECT c.user_id INTO v_company_user FROM public.delivery_companies c WHERE c.id = NEW.company_id;
  SELECT s.user_id INTO v_shop_user FROM public.shops s WHERE s.id = NEW.shop_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.delivery_notify(v_company_user, NEW.company_id, NULL, 'dispatch_transmitted', 'info',
      'Nouvelle commande reçue', format('Commande %s à livrer à %s.', COALESCE(v_num, NEW.order_id::text), NEW.city),
      '/delivery/partner-dashboard');
    RETURN NEW;
  END IF;

  -- Qui prévenir : le marchand pour tout ce que fait la structure, la structure pour ce que fait le marchand.
  v_target := CASE WHEN v_actor = 'seller' THEN 'company' ELSE 'shop' END;

  IF v_event = 'assigned' THEN
    v_title := 'Commande affectée à un livreur'; v_tone := 'info';
  ELSE
    v_title := CASE v_to
      WHEN 'accepted' THEN 'Commande acceptée'
      WHEN 'refused' THEN 'Commande refusée'
      WHEN 'preparing' THEN 'Commande en préparation'
      WHEN 'assigned' THEN 'Commande affectée à un livreur'
      WHEN 'picked_up' THEN 'Colis récupéré par le livreur'
      WHEN 'in_transit' THEN 'Commande en cours de livraison'
      WHEN 'delivered' THEN 'Commande livrée'
      WHEN 'failed' THEN 'Livraison échouée'
      WHEN 'returned' THEN 'Commande retournée'
      WHEN 'cancelled' THEN 'Commande annulée'
      WHEN 'cod_collected' THEN 'Montant encaissé auprès du client'
      WHEN 'deposit_pending' THEN 'Reversement en attente de confirmation'
      WHEN 'completed' THEN 'Course terminée'
      WHEN 'disputed' THEN 'Litige ouvert'
      ELSE NULL END;
    v_tone := CASE v_to
      WHEN 'refused' THEN 'warning' WHEN 'failed' THEN 'error' WHEN 'cancelled' THEN 'warning'
      WHEN 'disputed' THEN 'error' WHEN 'delivered' THEN 'success' WHEN 'completed' THEN 'success' ELSE 'info' END;
  END IF;
  IF v_title IS NULL THEN RETURN NEW; END IF;

  v_body := format('Commande %s', COALESCE(v_num, NEW.order_id::text))
            || COALESCE(' : ' || COALESCE(v_reason, v_note), '');

  IF v_target = 'company' THEN
    PERFORM public.delivery_notify(v_company_user, NEW.company_id, NEW.assigned_driver_id, 'dispatch_' || v_to, v_tone,
      v_title, v_body, '/delivery/partner-dashboard');
  ELSE
    PERFORM public.delivery_notify(v_shop_user, NEW.company_id, NEW.assigned_driver_id, 'dispatch_' || v_to, v_tone,
      v_title, v_body, NULL);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_dispatch_log() FROM PUBLIC;
DROP TRIGGER IF EXISTS trg_delivery_dispatch_log ON public.delivery_dispatches;
CREATE TRIGGER trg_delivery_dispatch_log
  AFTER INSERT OR UPDATE OF status, assigned_driver_id ON public.delivery_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.delivery_dispatch_log();

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Transmission d'une commande à une structure
--    Adresse, destinataire, ville et montant à encaisser viennent de la COMMANDE (jamais du navigateur).
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_dispatch_transmit(
  _order_id uuid,
  _company_id uuid,
  _delivery_fee numeric DEFAULT 0,
  _note text DEFAULT NULL,
  _parcel_photo_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders%ROWTYPE;
  v_status text;
  v_cod numeric;
  v_fee numeric := COALESCE(_delivery_fee, 0);
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501'; END IF;

  SELECT * INTO o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND OR NOT public.is_shop_owner_or_collaborator(o.shop_id) THEN
    RAISE EXCEPTION 'Commande introuvable ou accès refusé.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(s.shop_payment_status, 'active') INTO v_status FROM public.shops s WHERE s.id = o.shop_id;
  IF v_status IN ('STORE_RESTRICTED', 'locked', 'PAYMENT_OVERDUE', 'final_suspension') THEN
    RAISE EXCEPTION 'Boutique restreinte : régularisez votre abonnement avant de transmettre des commandes.' USING ERRCODE = '42501';
  END IF;

  IF v_fee < 0 OR v_fee > 10000000 THEN
    RAISE EXCEPTION 'Frais de livraison invalides.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(NULLIF(trim(o.customer_address), ''), NULLIF(trim(o.customer_city), '')) IS NULL THEN
    RAISE EXCEPTION 'La commande n''a pas d''adresse de livraison.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.delivery_dispatches d
     WHERE d.order_id = _order_id
       AND d.status::text NOT IN ('refused', 'cancelled', 'returned', 'failed')
  ) THEN
    RAISE EXCEPTION 'Cette commande est déjà confiée à une structure de livraison.' USING ERRCODE = '23505';
  END IF;

  -- Paiement à la livraison : on encaisse le total tant que la commande n'est pas réglée en ligne.
  v_cod := CASE WHEN lower(COALESCE(o.payment_status, '')) IN ('paid', 'completed', 'success', 'succeeded') THEN 0 ELSE o.total END;

  PERFORM set_config('ecomfy.dispatch_internal', '1', true);
  PERFORM set_config('ecomfy.dispatch_note', COALESCE(_note, ''), true);
  PERFORM set_config('ecomfy.dispatch_reason', '', true);

  INSERT INTO public.delivery_dispatches
    (order_id, shop_id, company_id, status, delivery_address, recipient_name, recipient_phone, city,
     cod_amount, delivery_fee, currency, delivery_note, customer_parcel_photo_url, assigned_at, transmitted_at)
  VALUES
    (o.id, o.shop_id, _company_id, 'transmitted', COALESCE(NULLIF(trim(o.customer_address), ''), o.customer_city),
     o.customer_name, o.customer_phone, COALESCE(NULLIF(trim(o.customer_city), ''), 'N/A'),
     v_cod, v_fee, 'XOF', NULLIF(_note, ''), NULLIF(_parcel_photo_url, ''), NULL, now())
  RETURNING id INTO v_id;

  IF v_cod > 0 THEN
    INSERT INTO public.delivery_cash_transfers
      (dispatch_id, company_id, shop_id, cod_amount, delivery_fee, net_seller_amount, currency, status)
    VALUES (v_id, _company_id, o.shop_id, v_cod, v_fee, GREATEST(v_cod - v_fee, 0), 'XOF', 'pending_collection');
  END IF;

  PERFORM set_config('ecomfy.dispatch_internal', '', true);
  PERFORM set_config('ecomfy.dispatch_note', '', true);
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_dispatch_transmit(uuid, uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_dispatch_transmit(uuid, uuid, numeric, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 7. Transitions : matrice « statut de départ > statut d'arrivée » par acteur
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_dispatch_apply(
  _dispatch_id uuid, _to text, _note text, _reason text, _driver uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.delivery_dispatches%ROWTYPE;
  v_actor text;
  v_from text;
  v_key text;
  v_ok boolean := false;
  v_why text := NULLIF(trim(COALESCE(_reason, _note, '')), '');
  v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501'; END IF;

  SELECT * INTO d FROM public.delivery_dispatches WHERE id = _dispatch_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Course introuvable ou accès refusé.' USING ERRCODE = '42501'; END IF;

  v_actor := public.delivery_dispatch_actor(d.shop_id, d.company_id);
  IF v_actor NOT IN ('seller', 'company', 'admin') THEN
    RAISE EXCEPTION 'Course introuvable ou accès refusé.' USING ERRCODE = '42501';
  END IF;

  v_from := d.status::text;
  v_key := v_from || '>' || _to;

  IF v_actor = 'admin' THEN
    v_ok := true;
  ELSE
    v_ok := CASE
      -- structure
      WHEN v_key IN ('transmitted>accepted', 'pending_assignment>accepted', 'transmitted>refused', 'accepted>preparing',
                     'accepted>assigned', 'preparing>assigned', 'pending_assignment>assigned', 'assigned>assigned',
                     'failed>assigned', 'assigned>picked_up', 'picked_up>in_transit', 'picked_up>delivered',
                     'in_transit>delivered', 'picked_up>failed', 'in_transit>failed', 'failed>returned',
                     'delivered>cod_collected', 'delivered>deposit_pending', 'cod_collected>deposit_pending')
        THEN v_actor = 'company'
      -- annulation : le marchand tant que rien n'est parti, la structure avec un motif
      WHEN v_key IN ('transmitted>cancelled', 'pending_assignment>cancelled', 'accepted>cancelled', 'preparing>cancelled',
                     'assigned>cancelled') THEN v_actor IN ('seller', 'company')
      -- confirmation du reversement : le marchand uniquement
      WHEN v_key = 'deposit_pending>completed' THEN v_actor = 'seller'
      -- livraison sans encaissement : l'une ou l'autre partie peut clore
      WHEN v_key = 'delivered>completed' THEN d.cod_amount = 0 AND v_actor IN ('seller', 'company')
      WHEN v_key IN ('delivered>disputed', 'cod_collected>disputed', 'deposit_pending>disputed')
        THEN v_actor IN ('seller', 'company')
      ELSE false
    END;
    -- Un encaissement n'a de sens que s'il y a un montant à encaisser.
    IF v_ok AND _to IN ('cod_collected', 'deposit_pending') AND d.cod_amount <= 0 THEN v_ok := false; END IF;
    -- Annulation par la structure : réservée aux courses déjà acceptées.
    IF v_ok AND _to = 'cancelled' AND v_actor = 'company' AND v_from IN ('transmitted', 'pending_assignment') THEN v_ok := false; END IF;
  END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Transition non autorisée : % -> % (%).', v_from, _to, v_actor USING ERRCODE = '42501';
  END IF;

  IF _to IN ('refused', 'failed', 'disputed') OR (_to = 'cancelled' AND v_actor = 'company') THEN
    IF v_why IS NULL OR length(v_why) < 3 THEN
      RAISE EXCEPTION 'Un motif est obligatoire pour cette action.' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF _to = 'assigned' AND _driver IS NULL THEN
    RAISE EXCEPTION 'Choisissez le livreur à qui affecter la commande.' USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('ecomfy.dispatch_internal', '1', true);
  PERFORM set_config('ecomfy.dispatch_note', COALESCE(_note, ''), true);
  PERFORM set_config('ecomfy.dispatch_reason', COALESCE(_reason, ''), true);

  UPDATE public.delivery_dispatches SET
    status = _to::public.delivery_dispatch_status,
    assigned_driver_id = CASE WHEN _to = 'assigned' THEN _driver ELSE assigned_driver_id END,
    assigned_at = CASE WHEN _to = 'assigned' THEN v_now ELSE assigned_at END,
    accepted_at = CASE WHEN _to = 'accepted' THEN v_now ELSE accepted_at END,
    refused_at = CASE WHEN _to = 'refused' THEN v_now ELSE refused_at END,
    refusal_reason = CASE WHEN _to = 'refused' THEN v_why ELSE refusal_reason END,
    picked_up_at = CASE WHEN _to = 'picked_up' THEN v_now ELSE picked_up_at END,
    delivered_at = CASE WHEN _to = 'delivered' THEN v_now ELSE delivered_at END,
    cod_collected_at = CASE WHEN _to = 'cod_collected' THEN v_now ELSE cod_collected_at END,
    failed_at = CASE WHEN _to = 'failed' THEN v_now ELSE failed_at END,
    failure_reason = CASE WHEN _to = 'failed' THEN v_why ELSE failure_reason END,
    returned_at = CASE WHEN _to = 'returned' THEN v_now ELSE returned_at END,
    cancelled_at = CASE WHEN _to = 'cancelled' THEN v_now ELSE cancelled_at END,
    cancel_reason = CASE WHEN _to = 'cancelled' THEN v_why ELSE cancel_reason END,
    seller_payout_completed_at = CASE WHEN _to = 'completed' AND v_from = 'deposit_pending' THEN v_now ELSE seller_payout_completed_at END
  WHERE id = _dispatch_id;

  -- Le suivi de l'argent suit la course (le détail des preuves reste dans delivery_cash_transfers).
  IF _to IN ('delivered', 'cod_collected') THEN
    UPDATE public.delivery_cash_transfers SET status = 'collected_by_driver'
     WHERE dispatch_id = _dispatch_id AND status = 'pending_collection';
  END IF;

  PERFORM set_config('ecomfy.dispatch_internal', '', true);
  PERFORM set_config('ecomfy.dispatch_note', '', true);
  PERFORM set_config('ecomfy.dispatch_reason', '', true);
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_dispatch_apply(uuid, text, text, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delivery_dispatch_receive(_dispatch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.delivery_dispatches%ROWTYPE;
BEGIN
  SELECT * INTO d FROM public.delivery_dispatches WHERE id = _dispatch_id;
  IF NOT FOUND OR public.delivery_dispatch_actor(d.shop_id, d.company_id) <> 'company' THEN
    RAISE EXCEPTION 'Course introuvable ou accès refusé.' USING ERRCODE = '42501';
  END IF;
  IF d.received_at IS NOT NULL THEN RETURN; END IF;

  PERFORM set_config('ecomfy.dispatch_internal', '1', true);
  UPDATE public.delivery_dispatches SET received_at = now() WHERE id = _dispatch_id;
  PERFORM set_config('ecomfy.dispatch_internal', '', true);
  INSERT INTO public.delivery_dispatch_history
    (dispatch_id, order_id, shop_id, company_id, event, from_status, to_status, actor_id, actor_kind)
  VALUES (d.id, d.order_id, d.shop_id, d.company_id, 'received', d.status::text, d.status::text, auth.uid(), 'company');
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_dispatch_receive(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_dispatch_receive(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delivery_dispatch_accept(_dispatch_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS
$$ SELECT public.delivery_dispatch_apply(_dispatch_id, 'accepted', NULL, NULL, NULL) $$;

CREATE OR REPLACE FUNCTION public.delivery_dispatch_refuse(_dispatch_id uuid, _reason text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS
$$ SELECT public.delivery_dispatch_apply(_dispatch_id, 'refused', NULL, _reason, NULL) $$;

CREATE OR REPLACE FUNCTION public.delivery_dispatch_assign(_dispatch_id uuid, _driver_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS
$$ SELECT public.delivery_dispatch_apply(_dispatch_id, 'assigned', NULL, NULL, _driver_id) $$;

CREATE OR REPLACE FUNCTION public.delivery_dispatch_set_status(_dispatch_id uuid, _status text, _note text DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS
$$ SELECT public.delivery_dispatch_apply(_dispatch_id, _status, _note, _note, NULL) $$;

REVOKE ALL ON FUNCTION public.delivery_dispatch_accept(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delivery_dispatch_refuse(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delivery_dispatch_assign(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delivery_dispatch_set_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_dispatch_accept(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delivery_dispatch_refuse(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delivery_dispatch_assign(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delivery_dispatch_set_status(uuid, text, text) TO authenticated, service_role;
