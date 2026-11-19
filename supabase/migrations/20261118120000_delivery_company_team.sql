-- Livraison, étape B : équipe de la structure (collaborateurs, rôles, livreurs avec compte, notifications d'équipe).
--
-- Avant : une structure = un seul compte (le propriétaire) ; ses livreurs n'avaient pas de compte.
-- Après : le propriétaire invite des collaborateurs avec un rôle ; chacun ne voit et ne fait que ce que son rôle permet.
--   owner      : propriétaire de la structure (tout)
--   admin      : tout sauf nommer un autre admin
--   operations : commandes, affectations, statuts, argent, statistiques
--   reception  : voit les commandes, accuse réception, met en préparation
--   driver     : ne voit que les courses qui lui sont affectées ; récupère, démarre, livre, déclare l'échec
-- Prérequis : 20261118110000. Les montants et le suivi d'argent restent réservés à owner/admin/operations.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Table des collaborateurs (écritures uniquement par les actions serveur)
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_company_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.delivery_companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'operations', 'reception', 'driver')),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'inactive')),
  driver_id uuid REFERENCES public.delivery_drivers(id) ON DELETE SET NULL,
  invitation_token text UNIQUE,
  invited_by uuid,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_staff_driver_role CHECK ((role = 'driver') = (driver_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_staff_email ON public.delivery_company_staff (company_id, lower(invited_email)) WHERE status IN ('invited', 'active');
CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_staff_driver ON public.delivery_company_staff (driver_id) WHERE driver_id IS NOT NULL AND status IN ('invited', 'active');
CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_staff_user_active ON public.delivery_company_staff (user_id) WHERE user_id IS NOT NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_delivery_staff_company ON public.delivery_company_staff (company_id, status);

ALTER TABLE public.delivery_company_staff ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_company_staff FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.delivery_company_staff TO authenticated;
GRANT ALL ON public.delivery_company_staff TO service_role;

DROP TRIGGER IF EXISTS trg_delivery_staff_updated ON public.delivery_company_staff;
CREATE TRIGGER trg_delivery_staff_updated BEFORE UPDATE ON public.delivery_company_staff
  FOR EACH ROW EXECUTE FUNCTION public.update_delivery_modified_column();

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Rôle et permissions (point d'entrée unique, déjà utilisé par l'étape A)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_company_role(_company_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    WHEN EXISTS (SELECT 1 FROM public.delivery_companies c WHERE c.id = _company_id AND c.user_id = auth.uid()) THEN 'owner'
    ELSE (SELECT s.role FROM public.delivery_company_staff s
           WHERE s.company_id = _company_id AND s.user_id = auth.uid() AND s.status = 'active' LIMIT 1)
  END;
$$;

CREATE OR REPLACE FUNCTION public.delivery_role_perms(_role text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE _role
    WHEN 'owner'      THEN ARRAY['member', 'read', 'operate', 'assign', 'cash', 'stats', 'manage_team']
    WHEN 'admin'      THEN ARRAY['member', 'read', 'operate', 'assign', 'cash', 'stats', 'manage_team']
    WHEN 'operations' THEN ARRAY['member', 'read', 'operate', 'assign', 'cash', 'stats']
    WHEN 'reception'  THEN ARRAY['member', 'read']
    WHEN 'driver'     THEN ARRAY['member']
    ELSE ARRAY[]::text[]
  END;
$$;

CREATE OR REPLACE FUNCTION public.delivery_company_can(_company_id uuid, _perm text DEFAULT 'operate')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_perm = ANY (public.delivery_role_perms(public.delivery_company_role(_company_id))), false);
$$;

-- Livreur (fiche delivery_drivers) lié au compte connecté dans cette structure.
CREATE OR REPLACE FUNCTION public.delivery_staff_driver(_company_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.driver_id FROM public.delivery_company_staff s
   WHERE s.company_id = _company_id AND s.user_id = auth.uid() AND s.status = 'active' AND s.role = 'driver' LIMIT 1;
$$;

-- Lecture d'une course : l'équipe (sauf livreur) voit tout ; un livreur ne voit que ses missions.
CREATE OR REPLACE FUNCTION public.delivery_can_read_dispatch(_company_id uuid, _assigned_driver uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.delivery_company_can(_company_id, 'read')
      OR (_assigned_driver IS NOT NULL AND public.delivery_staff_driver(_company_id) = _assigned_driver);
$$;

REVOKE ALL ON FUNCTION public.delivery_company_role(uuid), public.delivery_role_perms(text), public.delivery_company_can(uuid, text),
  public.delivery_staff_driver(uuid), public.delivery_can_read_dispatch(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_company_role(uuid), public.delivery_role_perms(text), public.delivery_company_can(uuid, text),
  public.delivery_staff_driver(uuid), public.delivery_can_read_dispatch(uuid, uuid) TO authenticated, service_role;

-- Qui agit : la propriété ou le rôle dans la structure passe avant le rôle d'administrateur de la plateforme.
CREATE OR REPLACE FUNCTION public.delivery_dispatch_actor(_shop_id uuid, _company_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN 'system'; END IF;
  IF _company_id IS NOT NULL AND public.delivery_company_role(_company_id) IS NOT NULL THEN RETURN 'company'; END IF;
  IF public.delivery_is_platform_admin() THEN RETURN 'admin'; END IF;
  IF _shop_id IS NOT NULL AND public.is_shop_owner_or_collaborator(_shop_id) THEN RETURN 'seller'; END IF;
  RETURN 'other';
END;
$$;

-- Lectures par l'équipe : courses, argent (réservé à qui gère l'argent), profil de ses propres lignes.
DROP POLICY IF EXISTS "Company team can view dispatches" ON public.delivery_dispatches;
CREATE POLICY "Company team can view dispatches" ON public.delivery_dispatches
  FOR SELECT TO authenticated USING (public.delivery_can_read_dispatch(company_id, assigned_driver_id));

DROP POLICY IF EXISTS "Company team can view cash transfers" ON public.delivery_cash_transfers;
CREATE POLICY "Company team can view cash transfers" ON public.delivery_cash_transfers
  FOR SELECT TO authenticated USING (public.delivery_company_can(company_id, 'cash'));

DROP POLICY IF EXISTS "Staff read own membership" ON public.delivery_company_staff;
CREATE POLICY "Staff read own membership" ON public.delivery_company_staff
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Notifications d'équipe
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_notify_company_team(
  _company uuid, _roles text[], _kind text, _tone text, _title text, _body text, _link text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.user_id AS uid FROM public.delivery_companies c WHERE c.id = _company AND c.user_id IS NOT NULL
    UNION
    SELECT s.user_id FROM public.delivery_company_staff s
     WHERE s.company_id = _company AND s.status = 'active' AND s.user_id IS NOT NULL AND s.role = ANY (_roles)
  LOOP
    PERFORM public.delivery_notify(r.uid, _company, NULL, _kind, _tone, _title, _body, _link);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_notify_company_team(uuid, text[], text, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- Journal et notifications d'une course (remplace la version de l'étape A : l'équipe et le livreur sont prévenus).
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
  v_shop_user uuid;
  v_driver_user uuid;
  v_title text;
  v_tone text := 'info';
  v_body text;
  v_label text;
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
  SELECT s.user_id INTO v_shop_user FROM public.shops s WHERE s.id = NEW.shop_id;
  v_label := COALESCE(v_num, NEW.order_id::text);

  IF TG_OP = 'INSERT' THEN
    PERFORM public.delivery_notify_company_team(NEW.company_id, ARRAY['admin', 'operations', 'reception'], 'dispatch_transmitted', 'info',
      'Nouvelle commande reçue', format('Commande %s à livrer à %s.', v_label, NEW.city), '/delivery/partner-dashboard');
    RETURN NEW;
  END IF;

  -- Le livreur concerné : nouvelle mission, ou mission retirée en cas de réaffectation.
  IF NEW.assigned_driver_id IS DISTINCT FROM OLD.assigned_driver_id THEN
    IF NEW.assigned_driver_id IS NOT NULL THEN
      SELECT s.user_id INTO v_driver_user FROM public.delivery_company_staff s
       WHERE s.driver_id = NEW.assigned_driver_id AND s.status = 'active';
      PERFORM public.delivery_notify(v_driver_user, NEW.company_id, NEW.assigned_driver_id, 'dispatch_mission', 'info',
        'Nouvelle mission', format('Commande %s à livrer à %s.', v_label, NEW.city), '/delivery/partner-dashboard');
    END IF;
    IF OLD.assigned_driver_id IS NOT NULL THEN
      SELECT s.user_id INTO v_driver_user FROM public.delivery_company_staff s
       WHERE s.driver_id = OLD.assigned_driver_id AND s.status = 'active';
      PERFORM public.delivery_notify(v_driver_user, NEW.company_id, OLD.assigned_driver_id, 'dispatch_mission_removed', 'warning',
        'Mission retirée', format('La commande %s ne vous est plus affectée.', v_label), '/delivery/partner-dashboard');
    END IF;
  END IF;

  IF v_event = 'assigned' THEN
    v_title := 'Commande affectée à un livreur';
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

  v_body := format('Commande %s', v_label) || COALESCE(' : ' || COALESCE(v_reason, v_note), '');

  IF v_actor = 'seller' THEN
    -- Le marchand agit : la structure (équipe de gestion) est prévenue.
    PERFORM public.delivery_notify_company_team(NEW.company_id, ARRAY['admin', 'operations'], 'dispatch_' || v_to, v_tone,
      v_title, v_body, '/delivery/partner-dashboard');
  ELSE
    -- La structure ou l'administration agit : le marchand est prévenu.
    PERFORM public.delivery_notify(v_shop_user, NEW.company_id, NEW.assigned_driver_id, 'dispatch_' || v_to, v_tone,
      v_title, v_body, NULL);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_dispatch_log() FROM PUBLIC;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Transitions : restrictions par rôle dans la structure
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
  v_role text;
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
  v_role := CASE WHEN v_actor = 'company' THEN public.delivery_company_role(d.company_id) END;

  v_from := d.status::text;
  v_key := v_from || '>' || _to;

  IF v_actor = 'admin' THEN
    v_ok := true;
  ELSE
    v_ok := CASE
      WHEN v_key IN ('transmitted>accepted', 'pending_assignment>accepted', 'transmitted>refused', 'accepted>preparing',
                     'accepted>assigned', 'preparing>assigned', 'pending_assignment>assigned', 'assigned>assigned',
                     'failed>assigned', 'assigned>picked_up', 'picked_up>in_transit', 'picked_up>delivered',
                     'in_transit>delivered', 'picked_up>failed', 'in_transit>failed', 'failed>returned',
                     'delivered>cod_collected', 'delivered>deposit_pending', 'cod_collected>deposit_pending')
        THEN v_actor = 'company'
      WHEN v_key IN ('transmitted>cancelled', 'pending_assignment>cancelled', 'accepted>cancelled', 'preparing>cancelled',
                     'assigned>cancelled') THEN v_actor IN ('seller', 'company')
      WHEN v_key = 'deposit_pending>completed' THEN v_actor = 'seller'
      WHEN v_key = 'delivered>completed' THEN d.cod_amount = 0 AND v_actor IN ('seller', 'company')
      WHEN v_key IN ('delivered>disputed', 'cod_collected>disputed', 'deposit_pending>disputed')
        THEN v_actor IN ('seller', 'company')
      ELSE false
    END;
    IF v_ok AND _to IN ('cod_collected', 'deposit_pending') AND d.cod_amount <= 0 THEN v_ok := false; END IF;
    IF v_ok AND _to = 'cancelled' AND v_actor = 'company' AND v_from IN ('transmitted', 'pending_assignment') THEN v_ok := false; END IF;

    -- Restrictions du rôle dans la structure.
    IF v_ok AND v_actor = 'company' THEN
      IF v_role = 'reception' THEN
        v_ok := v_key = 'accepted>preparing';
      ELSIF v_role = 'driver' THEN
        v_ok := v_key IN ('assigned>picked_up', 'picked_up>in_transit', 'picked_up>delivered', 'in_transit>delivered',
                          'picked_up>failed', 'in_transit>failed')
                AND d.assigned_driver_id IS NOT NULL
                AND d.assigned_driver_id = public.delivery_staff_driver(d.company_id);
      END IF;
    END IF;
  END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Transition non autorisée : % -> % (%).', v_from, _to, COALESCE(v_role, v_actor) USING ERRCODE = '42501';
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

-- Accusé de réception : propriétaire, admin, opérations, réception (pas le livreur).
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
  IF NOT FOUND OR NOT public.delivery_company_can(d.company_id, 'read') THEN
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

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Gestion de l'équipe
-- ---------------------------------------------------------------------------------------------------------------
-- Droit de gérer un collaborateur : owner et admin ; seul le propriétaire gère les admins.
CREATE OR REPLACE FUNCTION public.delivery_staff_assert_manage(_company_id uuid, _target_role text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.delivery_company_can(_company_id, 'manage_team') THEN
    RAISE EXCEPTION 'Gestion de l''équipe réservée au propriétaire et aux administrateurs de la structure.' USING ERRCODE = '42501';
  END IF;
  IF _target_role = 'admin' AND public.delivery_company_role(_company_id) <> 'owner' THEN
    RAISE EXCEPTION 'Seul le propriétaire peut nommer ou modifier un administrateur.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_staff_assert_manage(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delivery_staff_invite(_company_id uuid, _email text, _role text, _driver_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(COALESCE(_email, '')));
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_id uuid;
BEGIN
  PERFORM public.delivery_staff_assert_manage(_company_id, _role);
  IF _role NOT IN ('admin', 'operations', 'reception', 'driver') THEN
    RAISE EXCEPTION 'Rôle inconnu.' USING ERRCODE = '22023';
  END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Adresse e-mail invalide.' USING ERRCODE = '22023';
  END IF;
  IF _role = 'driver' THEN
    IF _driver_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.delivery_drivers d WHERE d.id = _driver_id AND d.company_id = _company_id) THEN
      RAISE EXCEPTION 'Choisissez un livreur de votre structure.' USING ERRCODE = '22023';
    END IF;
  ELSIF _driver_id IS NOT NULL THEN
    RAISE EXCEPTION 'Seul le rôle livreur est lié à une fiche livreur.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    INSERT INTO public.delivery_company_staff (company_id, invited_email, role, driver_id, invitation_token, invited_by)
    VALUES (_company_id, v_email, _role, _driver_id, v_token, auth.uid())
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Ce collaborateur ou ce livreur est déjà invité ou actif dans la structure.' USING ERRCODE = '23505';
  END;
  RETURN jsonb_build_object('id', v_id, 'token', v_token);
END;
$$;

-- L'invité accepte avec le jeton, depuis un compte dont l'e-mail confirmé correspond à l'invitation.
CREATE OR REPLACE FUNCTION public.delivery_staff_accept(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  s public.delivery_company_staff%ROWTYPE;
  v_name text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501'; END IF;
  IF _token IS NULL OR length(_token) < 32 THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_token'); END IF;

  SELECT lower(u.email), u.email_confirmed_at INTO v_email, v_confirmed FROM auth.users u WHERE u.id = v_uid;
  SELECT * INTO s FROM public.delivery_company_staff WHERE invitation_token = _token FOR UPDATE;
  IF NOT FOUND OR s.status <> 'invited' THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_token'); END IF;
  IF s.invited_at < now() - interval '14 days' THEN RETURN jsonb_build_object('success', false, 'error', 'expired'); END IF;
  IF v_confirmed IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'email_not_confirmed'); END IF;
  IF v_email IS DISTINCT FROM lower(s.invited_email) THEN RETURN jsonb_build_object('success', false, 'error', 'email_mismatch'); END IF;
  IF EXISTS (SELECT 1 FROM public.delivery_companies c WHERE c.user_id = v_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_owner');
  END IF;
  IF EXISTS (SELECT 1 FROM public.delivery_company_staff x WHERE x.user_id = v_uid AND x.status = 'active') THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_member');
  END IF;

  UPDATE public.delivery_company_staff
     SET user_id = v_uid, status = 'active', accepted_at = now(), invitation_token = NULL
   WHERE id = s.id;

  SELECT c.company_name INTO v_name FROM public.delivery_companies c WHERE c.id = s.company_id;
  PERFORM public.delivery_notify_company_team(s.company_id, ARRAY['admin'], 'staff_joined', 'success',
    'Un collaborateur a rejoint la structure', format('%s (%s) a accepté l''invitation.', s.invited_email, s.role), '/delivery/partner-dashboard');
  RETURN jsonb_build_object('success', true, 'company_id', s.company_id, 'role', s.role, 'company_name', v_name);
END;
$$;

CREATE OR REPLACE FUNCTION public.delivery_staff_set_status(_staff_id uuid, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.delivery_company_staff%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.delivery_company_staff WHERE id = _staff_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Collaborateur introuvable.' USING ERRCODE = '42501'; END IF;
  PERFORM public.delivery_staff_assert_manage(s.company_id, s.role);
  IF _status NOT IN ('active', 'inactive') THEN RAISE EXCEPTION 'Statut invalide.' USING ERRCODE = '22023'; END IF;
  IF _status = 'active' AND s.user_id IS NULL THEN
    RAISE EXCEPTION 'Cette invitation n''a pas encore été acceptée.' USING ERRCODE = '22023';
  END IF;
  IF s.status = 'invited' THEN RAISE EXCEPTION 'Invitation en attente : révoquez-la plutôt.' USING ERRCODE = '22023'; END IF;

  BEGIN
    UPDATE public.delivery_company_staff SET status = _status WHERE id = _staff_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Ce compte est déjà actif dans une autre structure.' USING ERRCODE = '23505';
  END;
  PERFORM public.delivery_notify(s.user_id, s.company_id, s.driver_id,
    CASE WHEN _status = 'active' THEN 'staff_reactivated' ELSE 'staff_deactivated' END,
    CASE WHEN _status = 'active' THEN 'success' ELSE 'warning' END,
    CASE WHEN _status = 'active' THEN 'Accès réactivé' ELSE 'Accès désactivé' END,
    'Votre accès à l''espace de la structure a été modifié par son responsable.', NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.delivery_staff_set_role(_staff_id uuid, _role text, _driver_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.delivery_company_staff%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.delivery_company_staff WHERE id = _staff_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Collaborateur introuvable.' USING ERRCODE = '42501'; END IF;
  PERFORM public.delivery_staff_assert_manage(s.company_id, s.role);
  PERFORM public.delivery_staff_assert_manage(s.company_id, _role);
  IF _role NOT IN ('admin', 'operations', 'reception', 'driver') THEN RAISE EXCEPTION 'Rôle inconnu.' USING ERRCODE = '22023'; END IF;
  IF _role = 'driver' THEN
    IF _driver_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.delivery_drivers d WHERE d.id = _driver_id AND d.company_id = s.company_id) THEN
      RAISE EXCEPTION 'Choisissez un livreur de votre structure.' USING ERRCODE = '22023';
    END IF;
  ELSE
    _driver_id := NULL;
  END IF;
  BEGIN
    UPDATE public.delivery_company_staff SET role = _role, driver_id = _driver_id WHERE id = _staff_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Ce livreur est déjà lié à un autre compte.' USING ERRCODE = '23505';
  END;
  PERFORM public.delivery_notify(s.user_id, s.company_id, _driver_id, 'staff_role_changed', 'info', 'Votre rôle a changé',
    format('Votre nouveau rôle dans la structure : %s.', _role), NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.delivery_staff_revoke_invite(_staff_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.delivery_company_staff%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.delivery_company_staff WHERE id = _staff_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Collaborateur introuvable.' USING ERRCODE = '42501'; END IF;
  PERFORM public.delivery_staff_assert_manage(s.company_id, s.role);
  IF s.status <> 'invited' THEN RAISE EXCEPTION 'Seule une invitation en attente se révoque.' USING ERRCODE = '22023'; END IF;
  DELETE FROM public.delivery_company_staff WHERE id = _staff_id;
END;
$$;

-- Tableau d'équipe (§8.3) : effectifs, courses attribuées / en cours / livrées, activité des 30 derniers jours.
CREATE OR REPLACE FUNCTION public.delivery_staff_list(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.delivery_company_can(_company_id, 'manage_team') THEN
    RAISE EXCEPTION 'Accès refusé.' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', s.id, 'invited_email', s.invited_email, 'role', s.role, 'status', s.status, 'driver_id', s.driver_id,
      'driver_name', dr.full_name,
      'invitation_token', CASE WHEN s.status = 'invited' THEN s.invitation_token END,
      'invited_at', s.invited_at, 'accepted_at', s.accepted_at,
      'assigned_total', COALESCE(st.assigned_total, 0), 'in_progress', COALESCE(st.in_progress, 0), 'delivered', COALESCE(st.delivered, 0),
      'actions_30d', COALESCE(ac.n, 0)
    ) ORDER BY s.created_at)
    FROM public.delivery_company_staff s
    LEFT JOIN public.delivery_drivers dr ON dr.id = s.driver_id
    LEFT JOIN LATERAL (
      SELECT count(*) AS assigned_total,
             count(*) FILTER (WHERE d.status::text IN ('assigned', 'picked_up', 'in_transit')) AS in_progress,
             count(*) FILTER (WHERE d.status::text IN ('delivered', 'cod_collected', 'deposit_pending', 'completed')) AS delivered
        FROM public.delivery_dispatches d WHERE s.driver_id IS NOT NULL AND d.assigned_driver_id = s.driver_id
    ) st ON true
    LEFT JOIN LATERAL (
      SELECT count(*) AS n FROM public.delivery_dispatch_history h
       WHERE s.user_id IS NOT NULL AND h.actor_id = s.user_id AND h.company_id = _company_id AND h.created_at > now() - interval '30 days'
    ) ac ON true
    WHERE s.company_id = _company_id
  ), '[]'::jsonb);
END;
$$;

-- Espace de travail du compte connecté : propriétaire ou collaborateur. Ne révèle rien du dossier KYC de la structure.
CREATE OR REPLACE FUNCTION public.delivery_my_workspace()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
  v_role text;
  c public.delivery_companies%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_company FROM public.delivery_companies WHERE user_id = auth.uid() LIMIT 1;
  IF v_company IS NULL THEN
    SELECT s.company_id INTO v_company FROM public.delivery_company_staff s WHERE s.user_id = auth.uid() AND s.status = 'active' LIMIT 1;
  END IF;
  IF v_company IS NULL THEN RETURN NULL; END IF;
  v_role := public.delivery_company_role(v_company);
  SELECT * INTO c FROM public.delivery_companies WHERE id = v_company;
  RETURN jsonb_build_object(
    'company_id', c.id, 'company_name', c.company_name, 'city', c.city, 'country', c.country,
    'verification_status', c.verification_status, 'trust_badge_active', c.trust_badge_active,
    'rating_score', c.rating_score, 'drivers_count', (SELECT count(*) FROM public.delivery_drivers d WHERE d.company_id = c.id),
    'role', v_role, 'perms', to_jsonb(public.delivery_role_perms(v_role)),
    'driver_id', public.delivery_staff_driver(v_company));
END;
$$;

-- Livreurs affectables (sans pièces d'identité) pour la personne qui affecte.
CREATE OR REPLACE FUNCTION public.delivery_company_drivers(_company_id uuid)
RETURNS TABLE (id uuid, full_name text, vehicle_type text, is_active boolean, verification_status text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.delivery_company_can(_company_id, 'assign') THEN
    RAISE EXCEPTION 'Accès refusé.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT d.id, d.full_name, d.vehicle_type::text, d.is_active, d.verification_status::text
      FROM public.delivery_drivers d WHERE d.company_id = _company_id ORDER BY d.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.delivery_staff_invite(uuid, text, text, uuid), public.delivery_staff_accept(text),
  public.delivery_staff_set_status(uuid, text), public.delivery_staff_set_role(uuid, text, uuid),
  public.delivery_staff_revoke_invite(uuid), public.delivery_staff_list(uuid), public.delivery_my_workspace(),
  public.delivery_company_drivers(uuid), public.delivery_dispatch_receive(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_staff_invite(uuid, text, text, uuid), public.delivery_staff_accept(text),
  public.delivery_staff_set_status(uuid, text), public.delivery_staff_set_role(uuid, text, uuid),
  public.delivery_staff_revoke_invite(uuid), public.delivery_staff_list(uuid), public.delivery_my_workspace(),
  public.delivery_company_drivers(uuid), public.delivery_dispatch_receive(uuid) TO authenticated, service_role;
