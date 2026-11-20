-- Livraison réseau — vérification physique des structures (cahier §5).
--
--  - Agents terrain : comptes eComfy désignés par l'administration (table delivery_field_agents). Un agent ne lit AUCUNE
--    table : il passe par des fonctions qui ne renvoient que ses propres missions.
--  - Visites : delivery_field_visits (programmée → en cours → terminée | annulée), avec résultat (concluante, non
--    concluante, informations à compléter), contrôles cochés, observations, photos (bucket privé « delivery-visits ») et
--    date de vérification. Une seule visite ouverte par dossier.
--  - Statut de vérification (§5.3) : delivery_company_field_status() déduit des statuts existants + de la visite ;
--    aucun statut de l'ancien flux n'est modifié.
--  - Règle optionnelle (réglage « require_field_visit », désactivée par défaut) : une STRUCTURE ne peut être approuvée
--    que si une visite concluante a eu lieu depuis sa dernière demande de vérification. Le paiement ou la création d'un
--    compte ne remplacent jamais le contrôle physique (§4.2, §5).
--  - Tout est journalisé (delivery_verification_audit) et notifié (delivery_notifications).
--
-- Additive et rejouable : aucun objet existant n'est supprimé.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_field_agents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 120),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 40),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_field_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.delivery_companies(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.delivery_field_agents(user_id),
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  instructions text CHECK (instructions IS NULL OR char_length(instructions) <= 1000),
  started_at timestamptz,
  completed_at timestamptz,
  outcome text CHECK (outcome IN ('passed', 'failed', 'info_needed')),
  checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  observations text CHECK (observations IS NULL OR char_length(observations) <= 4000),
  photos text[] NOT NULL DEFAULT '{}',
  visited_on date,
  cancelled_reason text,
  scheduled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT delivery_field_visits_outcome_consistent CHECK ((status = 'completed') = (outcome IS NOT NULL)),
  CONSTRAINT delivery_field_visits_photos_max CHECK (cardinality(photos) <= 12)
);
CREATE INDEX IF NOT EXISTS idx_delivery_field_visits_company ON public.delivery_field_visits (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_field_visits_agent ON public.delivery_field_visits (agent_id, status);
-- Une seule visite ouverte (programmée ou en cours) par dossier.
CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_field_visits_open
  ON public.delivery_field_visits (company_id) WHERE status IN ('scheduled', 'in_progress');

CREATE TABLE IF NOT EXISTS public.delivery_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.delivery_settings (key, value) VALUES ('require_field_visit', 'false'::jsonb) ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.delivery_field_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_field_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_field_agents, public.delivery_field_visits, public.delivery_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.delivery_field_agents, public.delivery_field_visits, public.delivery_settings TO authenticated;
GRANT ALL ON public.delivery_field_agents, public.delivery_field_visits, public.delivery_settings TO service_role;

DROP POLICY IF EXISTS "Field agents admin read" ON public.delivery_field_agents;
CREATE POLICY "Field agents admin read" ON public.delivery_field_agents
  FOR SELECT TO authenticated USING (public.delivery_is_platform_admin());
DROP POLICY IF EXISTS "Field visits admin read" ON public.delivery_field_visits;
CREATE POLICY "Field visits admin read" ON public.delivery_field_visits
  FOR SELECT TO authenticated USING (public.delivery_is_platform_admin());
DROP POLICY IF EXISTS "Delivery settings admin read" ON public.delivery_settings;
CREATE POLICY "Delivery settings admin read" ON public.delivery_settings
  FOR SELECT TO authenticated USING (public.delivery_is_platform_admin());

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Aides internes
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_is_field_agent()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.delivery_field_agents a WHERE a.user_id = auth.uid() AND a.is_active);
$$;
REVOKE ALL ON FUNCTION public.delivery_is_field_agent() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_is_field_agent() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delivery_assert_admin()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.delivery_is_platform_admin() THEN
    RAISE EXCEPTION 'Accès réservé à l''administration.' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_assert_admin() FROM PUBLIC, anon, authenticated;

-- Écriture dans le journal avec un acteur choisi (l'agent terrain n'est ni propriétaire ni administrateur).
CREATE OR REPLACE FUNCTION public.delivery_visit_audit(
  _company_id uuid, _action text, _visibility text, _kind text, _details jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT company_name INTO v_name FROM public.delivery_companies WHERE id = _company_id;
  INSERT INTO public.delivery_verification_audit
    (company_id, company_name, subject, action, visibility, actor_id, actor_kind, details)
  VALUES (_company_id, v_name, 'company', _action, COALESCE(_visibility, 'internal'), auth.uid(), COALESCE(_kind, 'system'),
          COALESCE(_details, '{}'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_visit_audit(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delivery_notify_admins_to(
  _company uuid, _kind text, _tone text, _title text, _body text, _link text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT ur.user_id FROM public.user_roles ur
            WHERE ur.role IN ('admin'::app_role, 'founder'::app_role, 'co_founder'::app_role) LOOP
    PERFORM public.delivery_notify(r.user_id, _company, NULL, _kind, _tone, _title, _body, _link);
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_notify_admins_to(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- Chemin d'une photo : un fichier déposé par l'agent dans son propre dossier du bucket « delivery-visits ».
CREATE OR REPLACE FUNCTION public.delivery_assert_visit_photo(_path text)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF _path IS NULL OR btrim(_path) = ''
     OR left(_path, length(auth.uid()::text) + 1) <> auth.uid()::text || '/'
     OR position('..' IN _path) > 0 OR _path ~ '^[a-z]+:' THEN
    RAISE EXCEPTION 'Photo invalide : importez le fichier depuis l''application.' USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_assert_visit_photo(text) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Statut de vérification de la structure (cahier §5.3)
-- ---------------------------------------------------------------------------------------------------------------
-- not_verified | requested | info_requested | visit_scheduled | in_progress | verified | rejected | suspended
CREATE OR REPLACE FUNCTION public.delivery_company_field_status(_company_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN c.verification_status = 'approved' THEN 'verified'
    WHEN c.verification_status = 'rejected' THEN 'rejected'
    WHEN c.verification_status = 'suspended' THEN 'suspended'
    WHEN EXISTS (SELECT 1 FROM public.delivery_field_visits v WHERE v.company_id = c.id AND v.status = 'in_progress') THEN 'in_progress'
    WHEN EXISTS (SELECT 1 FROM public.delivery_field_visits v WHERE v.company_id = c.id AND v.status = 'scheduled') THEN 'visit_scheduled'
    WHEN c.verification_status = 'action_required' THEN 'info_requested'
    WHEN c.verification_status IN ('pending_verification', 'under_review') THEN 'requested'
    ELSE 'not_verified'
  END
  FROM public.delivery_companies c WHERE c.id = _company_id;
$$;
REVOKE ALL ON FUNCTION public.delivery_company_field_status(uuid) FROM PUBLIC, anon, authenticated;

-- Pour le propriétaire (et l'administration) : statut + visite en cours ou dernière visite, SANS observations ni photos.
CREATE OR REPLACE FUNCTION public.delivery_company_visit_summary(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v record;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.delivery_company_owner(_company_id) OR public.delivery_is_platform_admin()) THEN
    RAISE EXCEPTION 'Accès refusé.' USING ERRCODE = '42501';
  END IF;
  SELECT id, status, scheduled_for, visited_on INTO v
    FROM public.delivery_field_visits
   WHERE company_id = _company_id AND status <> 'cancelled'
   ORDER BY created_at DESC LIMIT 1;
  RETURN jsonb_build_object(
    'field_status', public.delivery_company_field_status(_company_id),
    'visit', CASE WHEN v.id IS NULL THEN NULL
                  ELSE jsonb_build_object('status', v.status, 'scheduled_for', v.scheduled_for, 'visited_on', v.visited_on) END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_company_visit_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_company_visit_summary(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Administration
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_admin_set_field_agent(
  _email text, _full_name text, _phone text DEFAULT NULL, _active boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
BEGIN
  PERFORM public.delivery_assert_admin();
  IF _email IS NULL OR btrim(_email) = '' THEN
    RAISE EXCEPTION 'L''e-mail du compte est obligatoire.' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = lower(btrim(_email)) LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Aucun compte eComfy n''existe avec cet e-mail : la personne doit d''abord créer son compte.' USING ERRCODE = 'P0002';
  END IF;
  INSERT INTO public.delivery_field_agents (user_id, full_name, phone, is_active, created_by)
  VALUES (v_user, btrim(_full_name), NULLIF(btrim(COALESCE(_phone, '')), ''), COALESCE(_active, true), auth.uid())
  ON CONFLICT (user_id) DO UPDATE
     SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, is_active = EXCLUDED.is_active, updated_at = now();
  IF NOT COALESCE(_active, true) THEN
    -- Les missions non commencées d'un agent désactivé sont annulées ; celles en cours restent à l'administration.
    UPDATE public.delivery_field_visits
       SET status = 'cancelled', cancelled_reason = 'Agent désactivé', updated_at = now()
     WHERE agent_id = v_user AND status = 'scheduled';
  ELSE
    PERFORM public.delivery_notify(v_user, NULL, NULL, 'field_agent_enabled', 'info', 'Vous êtes agent terrain eComfy',
      'Vos missions de vérification apparaissent dans « Missions terrain ».', '/delivery-agent');
  END IF;
  RETURN jsonb_build_object('user_id', v_user, 'active', COALESCE(_active, true));
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_set_field_agent(text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_set_field_agent(text, text, text, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delivery_admin_field_agents()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.delivery_assert_admin();
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'user_id', a.user_id, 'full_name', a.full_name, 'phone', a.phone, 'is_active', a.is_active,
      'email', (SELECT u.email FROM auth.users u WHERE u.id = a.user_id),
      'open_visits', (SELECT count(*) FROM public.delivery_field_visits v WHERE v.agent_id = a.user_id AND v.status IN ('scheduled', 'in_progress')),
      'completed_visits', (SELECT count(*) FROM public.delivery_field_visits v WHERE v.agent_id = a.user_id AND v.status = 'completed')
    ) ORDER BY a.is_active DESC, a.full_name) FROM public.delivery_field_agents a), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_field_agents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_field_agents() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delivery_admin_schedule_visit(
  _company_id uuid, _agent_id uuid, _scheduled_for timestamptz, _instructions text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company public.delivery_companies%ROWTYPE;
  v_id uuid;
  v_when text;
BEGIN
  PERFORM public.delivery_assert_admin();
  SELECT * INTO v_company FROM public.delivery_companies WHERE id = _company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dossier introuvable.' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.delivery_field_agents WHERE user_id = _agent_id AND is_active) THEN
    RAISE EXCEPTION 'Cet agent terrain n''existe pas ou est désactivé.' USING ERRCODE = '22023';
  END IF;
  IF _scheduled_for IS NULL OR _scheduled_for < now() - interval '1 hour' THEN
    RAISE EXCEPTION 'La date de la visite doit être à venir.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.delivery_field_visits WHERE company_id = _company_id AND status IN ('scheduled', 'in_progress')) THEN
    RAISE EXCEPTION 'Une visite est déjà ouverte pour ce dossier : annulez-la avant d''en programmer une autre.' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.delivery_field_visits (company_id, agent_id, scheduled_for, instructions, scheduled_by)
  VALUES (_company_id, _agent_id, _scheduled_for, NULLIF(btrim(COALESCE(_instructions, '')), ''), auth.uid())
  RETURNING id INTO v_id;

  v_when := to_char(_scheduled_for AT TIME ZONE 'UTC', 'DD/MM/YYYY "à" HH24:MI');
  PERFORM public.delivery_notify(_agent_id, _company_id, NULL, 'field_visit_assigned', 'info', 'Nouvelle mission de vérification',
    v_company.company_name || ' — ' || v_company.city || ', le ' || v_when, '/delivery-agent');
  PERFORM public.delivery_notify(v_company.user_id, _company_id, NULL, 'field_visit_scheduled', 'info', 'Visite de vérification programmée',
    'Un agent eComfy se rendra à votre adresse le ' || v_when || '. Merci de vous rendre disponible.', '/delivery/status');
  PERFORM public.delivery_visit_audit(_company_id, 'visit_scheduled', 'owner', 'admin',
    jsonb_build_object('visit_id', v_id, 'scheduled_for', _scheduled_for, 'agent_id', _agent_id));
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_schedule_visit(uuid, uuid, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_schedule_visit(uuid, uuid, timestamptz, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delivery_admin_cancel_visit(_visit_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.delivery_field_visits%ROWTYPE;
  v_company public.delivery_companies%ROWTYPE;
BEGIN
  PERFORM public.delivery_assert_admin();
  IF _reason IS NULL OR char_length(btrim(_reason)) < 3 THEN
    RAISE EXCEPTION 'Indiquez le motif de l''annulation.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v FROM public.delivery_field_visits WHERE id = _visit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Visite introuvable.' USING ERRCODE = 'P0002'; END IF;
  IF v.status NOT IN ('scheduled', 'in_progress') THEN
    RAISE EXCEPTION 'Seule une visite programmée ou en cours peut être annulée.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.delivery_field_visits
     SET status = 'cancelled', cancelled_reason = btrim(_reason), updated_at = now()
   WHERE id = _visit_id;
  SELECT * INTO v_company FROM public.delivery_companies WHERE id = v.company_id;
  PERFORM public.delivery_notify(v.agent_id, v.company_id, NULL, 'field_visit_cancelled', 'warning', 'Mission annulée',
    v_company.company_name || ' : ' || btrim(_reason), '/delivery-agent');
  PERFORM public.delivery_notify(v_company.user_id, v.company_id, NULL, 'field_visit_cancelled', 'warning', 'Visite de vérification annulée',
    'La visite prévue est annulée. L''équipe eComfy vous proposera une nouvelle date.', '/delivery/status');
  PERFORM public.delivery_visit_audit(v.company_id, 'visit_cancelled', 'owner', 'admin',
    jsonb_build_object('visit_id', v.id, 'reason', btrim(_reason)));
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_cancel_visit(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_cancel_visit(uuid, text) TO authenticated, service_role;

-- Liste complète pour l'administration (rapport, contrôles, chemins des photos pour liens signés).
CREATE OR REPLACE FUNCTION public.delivery_admin_field_visits(_status text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.delivery_assert_admin();
  RETURN COALESCE((
    SELECT jsonb_agg(row ORDER BY (row ->> 'created_at') DESC) FROM (
      SELECT jsonb_build_object(
        'id', v.id, 'company_id', v.company_id, 'company_name', c.company_name, 'company_city', c.city,
        'company_address', c.headquarters_address, 'profile_type', c.profile_type,
        'verification_status', c.verification_status, 'field_status', public.delivery_company_field_status(c.id),
        'agent_id', v.agent_id, 'agent_name', a.full_name,
        'scheduled_for', v.scheduled_for, 'status', v.status, 'instructions', v.instructions,
        'started_at', v.started_at, 'completed_at', v.completed_at, 'visited_on', v.visited_on,
        'outcome', v.outcome, 'checks', v.checks, 'observations', v.observations, 'photos', v.photos,
        'cancelled_reason', v.cancelled_reason, 'created_at', v.created_at) AS row
        FROM public.delivery_field_visits v
        JOIN public.delivery_companies c ON c.id = v.company_id
        JOIN public.delivery_field_agents a ON a.user_id = v.agent_id
       WHERE _status IS NULL OR v.status = _status
       ORDER BY v.created_at DESC LIMIT 300
    ) t), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_field_visits(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_field_visits(text) TO authenticated, service_role;

-- Dossiers en attente de visite (structures dont le statut est « demandée » ou « informations demandées », sans visite ouverte).
CREATE OR REPLACE FUNCTION public.delivery_admin_pending_verifications()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.delivery_assert_admin();
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', c.id, 'company_name', c.company_name, 'city', c.city, 'address', c.headquarters_address,
      'profile_type', c.profile_type, 'verification_status', c.verification_status,
      'field_status', public.delivery_company_field_status(c.id), 'requested_at', c.verification_requested_at,
      'last_visit_outcome', (SELECT v.outcome FROM public.delivery_field_visits v
                              WHERE v.company_id = c.id AND v.status = 'completed' ORDER BY v.completed_at DESC LIMIT 1)
    ) ORDER BY c.verification_requested_at NULLS LAST)
      FROM public.delivery_companies c
     WHERE c.verification_status IN ('pending_verification', 'under_review', 'action_required')
       AND NOT EXISTS (SELECT 1 FROM public.delivery_field_visits v WHERE v.company_id = c.id AND v.status IN ('scheduled', 'in_progress'))),
    '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_pending_verifications() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_pending_verifications() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delivery_admin_get_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.delivery_assert_admin();
  RETURN COALESCE((SELECT jsonb_object_agg(key, value) FROM public.delivery_settings), '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_get_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_get_settings() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delivery_admin_set_require_visit(_required boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.delivery_assert_admin();
  IF _required IS NULL THEN RAISE EXCEPTION 'Valeur requise.' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.delivery_settings (key, value, updated_by) VALUES ('require_field_visit', to_jsonb(_required), auth.uid())
  ON CONFLICT (key) DO UPDATE SET value = to_jsonb(_required), updated_by = auth.uid(), updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_admin_set_require_visit(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_admin_set_require_visit(boolean) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Agent terrain
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delivery_agent_my_visits()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.delivery_is_field_agent() THEN
    RAISE EXCEPTION 'Accès réservé aux agents terrain.' USING ERRCODE = '42501';
  END IF;
  -- Aucune pièce d'identité, aucun numéro fiscal : seulement ce qu'il faut pour se rendre sur place et contrôler.
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', v.id, 'status', v.status, 'scheduled_for', v.scheduled_for, 'instructions', v.instructions,
      'started_at', v.started_at, 'completed_at', v.completed_at, 'visited_on', v.visited_on,
      'outcome', v.outcome, 'checks', v.checks, 'observations', v.observations, 'photos', v.photos,
      'company', jsonb_build_object(
        'id', c.id, 'name', c.company_name, 'profile_type', c.profile_type, 'city', c.city,
        'address', c.headquarters_address, 'manager_name', c.manager_name, 'manager_phone', c.manager_phone,
        'covered_cities', c.covered_cities, 'description', c.description)
    ) ORDER BY (v.status IN ('scheduled', 'in_progress')) DESC, v.scheduled_for)
      FROM public.delivery_field_visits v
      JOIN public.delivery_companies c ON c.id = v.company_id
     WHERE v.agent_id = auth.uid()
       AND (v.status IN ('scheduled', 'in_progress') OR v.updated_at > now() - interval '30 days')),
    '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_agent_my_visits() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_agent_my_visits() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delivery_agent_start_visit(_visit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.delivery_field_visits%ROWTYPE;
BEGIN
  IF NOT public.delivery_is_field_agent() THEN
    RAISE EXCEPTION 'Accès réservé aux agents terrain.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.delivery_field_visits WHERE id = _visit_id AND agent_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mission introuvable.' USING ERRCODE = 'P0002'; END IF;
  IF v.status <> 'scheduled' THEN
    RAISE EXCEPTION 'Cette mission n''est plus à démarrer (statut : %).', v.status USING ERRCODE = '22023';
  END IF;
  UPDATE public.delivery_field_visits SET status = 'in_progress', started_at = now(), updated_at = now() WHERE id = _visit_id;
  PERFORM public.delivery_visit_audit(v.company_id, 'visit_started', 'internal', 'system',
    jsonb_build_object('visit_id', v.id, 'agent_id', auth.uid()));
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_agent_start_visit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_agent_start_visit(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delivery_agent_submit_visit(
  _visit_id uuid, _outcome text, _checks jsonb, _observations text, _photos text[], _visited_on date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.delivery_field_visits%ROWTYPE;
  v_company public.delivery_companies%ROWTYPE;
  v_photo text;
  v_key text;
  v_day date := COALESCE(_visited_on, (now() AT TIME ZONE 'UTC')::date);
  v_obs text := NULLIF(btrim(COALESCE(_observations, '')), '');
  v_photos text[] := COALESCE(_photos, '{}');
  v_checks jsonb := COALESCE(_checks, '{}'::jsonb);
  v_labels constant jsonb := jsonb_build_object(
    'premises_exist', 'l''existence des locaux', 'address_matches', 'l''adresse communiquée',
    'company_exists', 'l''existence effective de l''entreprise', 'delivery_activity', 'la présence d''une activité de livraison',
    'info_consistent', 'la cohérence des informations d''inscription');
  v_title text;
  v_tone text;
BEGIN
  IF NOT public.delivery_is_field_agent() THEN
    RAISE EXCEPTION 'Accès réservé aux agents terrain.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.delivery_field_visits WHERE id = _visit_id AND agent_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mission introuvable.' USING ERRCODE = 'P0002'; END IF;
  IF v.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Démarrez la visite avant d''enregistrer son résultat (statut : %).', v.status USING ERRCODE = '22023';
  END IF;
  IF _outcome IS NULL OR _outcome NOT IN ('passed', 'failed', 'info_needed') THEN
    RAISE EXCEPTION 'Résultat de visite inconnu.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_checks) <> 'object' THEN
    RAISE EXCEPTION 'Contrôles invalides.' USING ERRCODE = '22023';
  END IF;
  -- Seules les clés connues, avec des valeurs vrai / faux, sont conservées.
  FOR v_key IN SELECT jsonb_object_keys(v_checks) LOOP
    IF v_key NOT IN ('premises_exist', 'address_matches', 'company_exists', 'delivery_activity', 'equipment_adequate', 'info_consistent')
       OR jsonb_typeof(v_checks -> v_key) NOT IN ('boolean', 'null') THEN
      RAISE EXCEPTION 'Contrôle inconnu ou invalide : %.', v_key USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF v_day > (now() AT TIME ZONE 'UTC')::date OR v_day < (now() AT TIME ZONE 'UTC')::date - 30 THEN
    RAISE EXCEPTION 'La date de la visite est invalide (ni dans le futur, ni plus de 30 jours en arrière).' USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_photos) > 12 THEN
    RAISE EXCEPTION '12 photos au maximum.' USING ERRCODE = '22023';
  END IF;
  FOREACH v_photo IN ARRAY v_photos LOOP
    PERFORM public.delivery_assert_visit_photo(v_photo);
  END LOOP;

  IF _outcome = 'passed' THEN
    FOR v_key IN SELECT jsonb_object_keys(v_labels) LOOP
      IF COALESCE(v_checks ->> v_key, '') <> 'true' THEN
        RAISE EXCEPTION 'Une visite concluante exige de confirmer % (ou choisissez « non concluante » avec vos observations).', v_labels ->> v_key
          USING ERRCODE = '23514';
      END IF;
    END LOOP;
    IF cardinality(v_photos) < 1 THEN
      RAISE EXCEPTION 'Ajoutez au moins une photo des locaux.' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF v_obs IS NULL OR char_length(v_obs) < 10 THEN
      RAISE EXCEPTION 'Décrivez vos observations (10 caractères minimum) : elles justifient la décision.' USING ERRCODE = '23514';
    END IF;
  END IF;

  UPDATE public.delivery_field_visits
     SET status = 'completed', outcome = _outcome, checks = v_checks, observations = v_obs, photos = v_photos,
         visited_on = v_day, completed_at = now(), updated_at = now()
   WHERE id = _visit_id;

  SELECT * INTO v_company FROM public.delivery_companies WHERE id = v.company_id;
  v_title := CASE _outcome WHEN 'passed' THEN 'Visite concluante' WHEN 'failed' THEN 'Visite non concluante'
                           ELSE 'Visite : informations à compléter' END;
  v_tone := CASE _outcome WHEN 'passed' THEN 'success' WHEN 'failed' THEN 'error' ELSE 'warning' END;
  PERFORM public.delivery_notify_admins_to(v.company_id, 'field_visit_completed', v_tone, v_title,
    v_company.company_name || ' — décision à prendre dans le back-office.', '/delivery-admin/visits');
  -- Le propriétaire est seulement informé que la visite a eu lieu ; le rapport reste interne tant que l'administration n'a pas décidé.
  PERFORM public.delivery_notify(v_company.user_id, v.company_id, NULL, 'field_visit_done', 'info', 'Visite de vérification effectuée',
    'L''équipe eComfy examine le rapport et vous communiquera sa décision.', '/delivery/status');
  PERFORM public.delivery_visit_audit(v.company_id, 'visit_completed', 'internal', 'system',
    jsonb_build_object('visit_id', v.id, 'agent_id', auth.uid(), 'outcome', _outcome, 'photos', cardinality(v_photos), 'visited_on', v_day));
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_agent_submit_visit(uuid, text, jsonb, text, text[], date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_agent_submit_visit(uuid, text, jsonb, text, text[], date) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Règle d'approbation (désactivée par défaut)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_delivery_company_visit_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Migrations, maintenance et jobs système (pas d'utilisateur) ne sont pas concernés.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.verification_status = 'approved' AND OLD.verification_status IS DISTINCT FROM 'approved'
     AND NEW.profile_type = 'manager'
     AND COALESCE((SELECT s.value = 'true'::jsonb FROM public.delivery_settings s WHERE s.key = 'require_field_visit'), false)
     AND NOT EXISTS (
       SELECT 1 FROM public.delivery_field_visits v
        WHERE v.company_id = NEW.id AND v.status = 'completed' AND v.outcome = 'passed'
          AND v.completed_at >= COALESCE(NEW.verification_requested_at, '-infinity'::timestamptz)
     ) THEN
    RAISE EXCEPTION 'Approbation impossible : une visite terrain concluante est requise depuis la dernière demande de vérification (programmez-la dans « Visites terrain »).'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_delivery_company_visit_gate() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_guard_delivery_company_visit_gate ON public.delivery_companies;
CREATE TRIGGER trg_guard_delivery_company_visit_gate
  BEFORE UPDATE ON public.delivery_companies
  FOR EACH ROW EXECUTE FUNCTION public.guard_delivery_company_visit_gate();

-- ---------------------------------------------------------------------------------------------------------------
-- 7. Bucket privé des photos de visite
-- ---------------------------------------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('delivery-visits', 'delivery-visits', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
   SET public = false,
       file_size_limit = EXCLUDED.file_size_limit,
       allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "delivery_visits_agent_insert" ON storage.objects;
DROP POLICY IF EXISTS "delivery_visits_select" ON storage.objects;

-- Dépôt : un agent actif, dans son propre dossier. Lecture : son dossier ou un administrateur (liens signés).
CREATE POLICY "delivery_visits_agent_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'delivery-visits' AND (storage.foldername(name))[1] = auth.uid()::text
              AND public.delivery_is_field_agent());
CREATE POLICY "delivery_visits_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'delivery-visits'
         AND ((storage.foldername(name))[1] = auth.uid()::text OR public.delivery_is_platform_admin()));
