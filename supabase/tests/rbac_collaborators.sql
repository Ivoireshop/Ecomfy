-- Tests de 20261111100000_rbac_no_hardcoded_emails_collaborators.sql (M7, RBAC/RLS collaborateurs, invitations)
--
-- Base JETABLE uniquement (jamais dev ni prod). Trois fichiers, dans cet ordre, sur la même base :
--   1. ce fichier : rôles, tables et politiques D'AVANT la migration (copiées de la dev le 11/11/2026), aides de test,
--      puis le constat des failles AVANT correction (cas « avant ») ;
--   2. supabase/migrations/20261111100000_rbac_no_hardcoded_emails_collaborators.sql (à jouer DEUX fois : idempotence) ;
--   3. supabase/tests/rbac_collaborators_cases.sql : les cas APRÈS correction et le bilan.
-- Exemple (PostgreSQL 15, base vide) :
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/rbac_collaborators.sql \
--        -f supabase/migrations/20261111100000_rbac_no_hardcoded_emails_collaborators.sql \
--        -f supabase/migrations/20261111100000_rbac_no_hardcoded_emails_collaborators.sql \
--        -f supabase/tests/rbac_collaborators_cases.sql

\set ON_ERROR_STOP on

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text UNIQUE, email_confirmed_at timestamptz);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
  $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO anon, authenticated, service_role;

CREATE TYPE public.app_role AS ENUM ('admin', 'co_founder', 'delivery', 'founder', 'shareholder', 'user');
-- Même liste que la dev : l'enum ne contient PAS manage_catalog (la colonne roles est text[]).
CREATE TYPE public.shop_collab_role AS ENUM ('view_orders', 'edit_shop', 'manage_expenses', 'manage_delivered_orders');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, role public.app_role NOT NULL, UNIQUE (user_id, role)
);
CREATE TABLE public.shops (
  id uuid PRIMARY KEY, user_id uuid NOT NULL, business_name text, is_suspended boolean NOT NULL DEFAULT false
);
CREATE TABLE public.shop_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL, invited_email text NOT NULL, user_id uuid,
  roles text[] NOT NULL DEFAULT '{}', status text NOT NULL DEFAULT 'pending',
  invitation_token text, invited_by uuid, accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL, name text);
CREATE TABLE public.product_images (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL);
CREATE TABLE public.product_translations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL);
CREATE TABLE public.product_audios (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL, user_id uuid NOT NULL);
CREATE TABLE public.product_theme_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL, v text);
CREATE TABLE public.shop_installed_themes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL, v text);
CREATE TABLE public.shop_ai_assistants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL, v text);
CREATE TABLE public.shop_seo_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL, v text);

-- Fonctions d'aide (définitions de la dev)
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE FUNCTION public.is_shop_owner(_shop_id uuid, _user_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND user_id = _user_id) $$;
CREATE FUNCTION public.is_shop_collaborator(_shop_id uuid, _user_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT EXISTS (SELECT 1 FROM public.shop_collaborators WHERE shop_id = _shop_id AND user_id = _user_id AND status = 'active') $$;
CREATE FUNCTION public.has_shop_role(_shop_id uuid, _user_id uuid, _required_role text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT EXISTS (SELECT 1 FROM public.shops WHERE id = _shop_id AND user_id = _user_id)
        OR EXISTS (SELECT 1 FROM public.shop_collaborators WHERE shop_id = _shop_id AND user_id = _user_id
                   AND status = 'active' AND (_required_role = ANY(roles) OR 'full_admin' = ANY(roles))) $$;
CREATE FUNCTION public.has_shop_role(_shop_id uuid, _user_id uuid, _role public.shop_collab_role) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT public.has_shop_role(_shop_id, _user_id, _role::text) $$;

-- E-mails en dur d'avant (déclencheur et fonction)
CREATE FUNCTION public.assign_founder_role() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.email = 'djateulrich@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'founder') ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  IF NEW.email = 'regnis13@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'co_founder') ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER assign_founder_role_on_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.assign_founder_role();
CREATE TRIGGER on_auth_user_created_assign_role AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.assign_founder_role();

CREATE FUNCTION public.is_founder_or_master() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid()
    AND (LOWER(auth.users.email) = 'djateulrich@gmail.com'
         OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid()
                    AND user_roles.role::text IN ('founder', 'co_founder', 'shareholder', 'admin'))));
$$;

-- Acceptation d'invitation d'avant
CREATE FUNCTION public.accept_shop_invitation(_token text) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce((auth.jwt() ->> 'email'), ''));
  v_invite public.shop_collaborators%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_authenticated'); END IF;
  SELECT * INTO v_invite FROM public.shop_collaborators WHERE invitation_token = _token LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'invalid_token'); END IF;
  IF lower(v_invite.invited_email) <> v_email THEN
    RETURN jsonb_build_object('success', false, 'error', 'email_mismatch', 'expected_email', v_invite.invited_email);
  END IF;
  IF v_invite.status = 'revoked' THEN RETURN jsonb_build_object('success', false, 'error', 'revoked'); END IF;
  UPDATE public.shop_collaborators SET user_id = v_uid, status = 'active', accepted_at = now(), updated_at = now()
    WHERE id = v_invite.id;
  RETURN jsonb_build_object('success', true, 'shop_id', v_invite.shop_id);
END $$;

-- RLS et politiques d'avant
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_roles','shops','shop_collaborators','products','product_images','product_translations',
    'product_audios','product_theme_settings','shop_installed_themes','shop_ai_assistants','shop_seo_settings'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role', t);
  END LOOP;
END $$;
GRANT SELECT ON public.products TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can manage their own shops" ON public.shops FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Collaborators can view assigned shop" ON public.shops FOR SELECT USING (public.is_shop_collaborator(id, auth.uid()));
CREATE POLICY "Collaborators with edit_shop can update shop" ON public.shops FOR UPDATE
  USING (public.has_shop_role(id, auth.uid(), 'edit_shop'::public.shop_collab_role))
  WITH CHECK (public.has_shop_role(id, auth.uid(), 'edit_shop'::public.shop_collab_role));
CREATE POLICY "Founders read all shops" ON public.shops FOR SELECT TO authenticated USING (public.is_founder_or_master() OR user_id = auth.uid());

CREATE POLICY "Owners manage their collaborators" ON public.shop_collaborators FOR ALL
  USING (public.is_shop_owner(shop_id, auth.uid())) WITH CHECK (public.is_shop_owner(shop_id, auth.uid()));
CREATE POLICY "Collaborator can read own invite" ON public.shop_collaborators FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND (user_id = auth.uid()
    OR (COALESCE((auth.jwt() ->> 'email_verified')::boolean, false) = true
        AND lower(invited_email) = lower(COALESCE(auth.jwt() ->> 'email', '')))));

CREATE POLICY "Collaborators edit_shop can view products" ON public.products FOR SELECT USING (public.is_shop_collaborator(shop_id, auth.uid()));
CREATE POLICY "Collaborators edit_shop can write products" ON public.products FOR ALL
  USING (public.has_shop_role(shop_id, auth.uid(), 'edit_shop'::public.shop_collab_role))
  WITH CHECK (public.has_shop_role(shop_id, auth.uid(), 'edit_shop'::public.shop_collab_role));
CREATE POLICY "Collaborators edit_shop can manage product images" ON public.product_images FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_images.product_id AND public.has_shop_role(p.shop_id, auth.uid(), 'edit_shop'::public.shop_collab_role)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_images.product_id AND public.has_shop_role(p.shop_id, auth.uid(), 'edit_shop'::public.shop_collab_role)));
CREATE POLICY "Shop edit collaborators manage product translations" ON public.product_translations FOR ALL
  USING (public.has_shop_role(shop_id, auth.uid(), 'edit_shop'::public.shop_collab_role))
  WITH CHECK (public.has_shop_role(shop_id, auth.uid(), 'edit_shop'::public.shop_collab_role));

CREATE POLICY "product_audios owner select" ON public.product_audios FOR SELECT TO authenticated USING (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid()));
CREATE POLICY "product_audios owner insert" ON public.product_audios FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid())));
CREATE POLICY "product_audios owner update" ON public.product_audios FOR UPDATE TO authenticated USING (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid())) WITH CHECK (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid()));
CREATE POLICY "product_audios owner delete" ON public.product_audios FOR DELETE TO authenticated USING (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid()));

CREATE POLICY "product_theme_settings owner select" ON public.product_theme_settings FOR SELECT TO authenticated USING (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid()));
CREATE POLICY "product_theme_settings owner upsert" ON public.product_theme_settings FOR INSERT TO authenticated WITH CHECK (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid()));
CREATE POLICY "product_theme_settings owner update" ON public.product_theme_settings FOR UPDATE TO authenticated USING (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid())) WITH CHECK (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid()));
CREATE POLICY "product_theme_settings owner delete" ON public.product_theme_settings FOR DELETE TO authenticated USING (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid()));
CREATE POLICY "installed_themes_owner_manage" ON public.shop_installed_themes FOR ALL USING (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid())) WITH CHECK (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid()));
CREATE POLICY "Owners and collaborators can view shop assistant" ON public.shop_ai_assistants FOR SELECT USING (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid()));
CREATE POLICY "Owners and collaborators can update shop assistant" ON public.shop_ai_assistants FOR UPDATE USING (public.is_shop_owner(shop_id, auth.uid()) OR public.is_shop_collaborator(shop_id, auth.uid()));

CREATE FUNCTION public.is_shop_owner_or_collaborator(target_shop_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = target_shop_id AND s.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.shop_collaborators sc WHERE sc.shop_id = target_shop_id AND sc.user_id = auth.uid() AND sc.status = 'active')
      OR public.has_role(auth.uid(), 'admin') $$;
CREATE POLICY "Tenant isolation shop_seo_settings" ON public.shop_seo_settings FOR ALL USING (public.is_shop_owner_or_collaborator(shop_id));

-- Données
\set owner      '''00000000-0000-0000-0000-000000000001'''
\set v_view     '''00000000-0000-0000-0000-000000000002'''
\set v_edit     '''00000000-0000-0000-0000-000000000003'''
\set v_catalog  '''00000000-0000-0000-0000-000000000004'''
\set v_full     '''00000000-0000-0000-0000-000000000005'''
\set stranger   '''00000000-0000-0000-0000-000000000006'''
\set admin      '''00000000-0000-0000-0000-000000000007'''
\set founder    '''00000000-0000-0000-0000-000000000008'''
\set shop1      '''0000000a-0000-0000-0000-000000000001'''

INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
  (:owner, 'owner@example.com', now()), (:v_view, 'view@example.com', now()), (:v_edit, 'edit@example.com', now()),
  (:v_catalog, 'catalog@example.com', now()), (:v_full, 'full@example.com', now()), (:stranger, 'stranger@example.com', now()),
  (:admin, 'admin@example.com', now()), (:founder, 'founder@example.com', now());
INSERT INTO public.user_roles (user_id, role) VALUES (:admin, 'admin'), (:founder, 'founder');
INSERT INTO public.shops (id, user_id, business_name) VALUES (:shop1, :owner, 'Boutique 1');
INSERT INTO public.shop_collaborators (shop_id, invited_email, user_id, roles, status, invitation_token) VALUES
  (:shop1, 'view@example.com', :v_view, '{view_orders}', 'active', 'tok-view-000000000000000'),
  (:shop1, 'edit@example.com', :v_edit, '{edit_shop}', 'active', 'tok-edit-000000000000000'),
  (:shop1, 'catalog@example.com', :v_catalog, '{manage_catalog}', 'active', 'tok-catalog-0000000000'),
  (:shop1, 'full@example.com', :v_full, '{full_admin}', 'active', 'tok-full-000000000000000');
INSERT INTO public.products (id, shop_id, name) VALUES ('0000000b-0000-0000-0000-000000000001', :shop1, 'P1');
INSERT INTO public.product_theme_settings (shop_id, v) VALUES (:shop1, 'orig');
INSERT INTO public.shop_installed_themes (shop_id, v) VALUES (:shop1, 'orig');
INSERT INTO public.shop_ai_assistants (shop_id, v) VALUES (:shop1, 'orig');
INSERT INTO public.shop_seo_settings (shop_id, v) VALUES (:shop1, 'orig');

-- Aides de test : t_run(uid, sql) exécute en tant qu'utilisateur authentifié et rend « ok:<lignes> » ou « err:<message> ».
CREATE TABLE public.t_results (name text PRIMARY KEY, got text, want text, pass boolean);
CREATE FUNCTION public.t_run(uid uuid, stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint; em text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(uid::text, ''), true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', uid, 'email', (SELECT email FROM auth.users WHERE id = uid))::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    EXECUTE stmt;
    GET DIAGNOSTICS n = ROW_COUNT;
    RESET ROLE;
    RETURN 'ok:' || n;
  EXCEPTION WHEN OTHERS THEN
    em := SQLERRM;
    RESET ROLE;
    RETURN 'err:' || em;
  END;
END $$;
-- t_expect : « want » est un préfixe (ex. « ok:1 », « err: »)
CREATE FUNCTION public.t_expect(p_name text, p_got text, p_want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.t_results VALUES (p_name, p_got, p_want, left(p_got, length(p_want)) = p_want);
END $$;

-- ====== CONSTAT AVANT CORRECTION (chaque cas décrit la FAILLE : il doit « réussir » à mal faire) ======
SELECT public.t_expect('00a avant : collaborateur view_orders écrit les thèmes',
  public.t_run(:v_view, format($q$UPDATE public.shop_installed_themes SET v='hack' WHERE shop_id=%L$q$, :shop1)), 'ok:1');
SELECT public.t_expect('00b avant : collaborateur view_orders écrit l''assistant IA',
  public.t_run(:v_view, format($q$UPDATE public.shop_ai_assistants SET v='hack' WHERE shop_id=%L$q$, :shop1)), 'ok:1');
SELECT public.t_expect('00c avant : collaborateur view_orders écrit le SEO',
  public.t_run(:v_view, format($q$UPDATE public.shop_seo_settings SET v='hack' WHERE shop_id=%L$q$, :shop1)), 'ok:1');
SELECT public.t_expect('00d avant : manage_catalog n''ouvre pas le catalogue',
  public.t_run(:v_catalog, format($q$INSERT INTO public.products (shop_id, name) VALUES (%L,'X')$q$, :shop1)), 'err:');
SELECT public.t_expect('00e avant : edit_shop s''approprie la boutique',
  public.t_run(:v_edit, format($q$UPDATE public.shops SET user_id=%L WHERE id=%L$q$, :v_edit, :shop1)), 'ok:1');
UPDATE public.shops SET user_id = :owner WHERE id = :shop1;  -- on rend la boutique au propriétaire
SELECT public.t_expect('00f avant : un admin s''attribue founder',
  public.t_run(:admin, format($q$INSERT INTO public.user_roles (user_id, role) VALUES (%L,'founder')$q$, :admin)), 'ok:1');
DELETE FROM public.user_roles WHERE user_id = :admin AND role = 'founder';
INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ('00000000-0000-0000-0000-0000000000f1', 'djateulrich@gmail.com', now());
SELECT public.t_expect('00g avant : l''inscription avec l''e-mail en dur donne founder',
  (SELECT count(*)::text FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-0000000000f1' AND role = 'founder'), '1');
SELECT public.t_expect('00h avant : is_founder_or_master vrai par e-mail seul',
  (SELECT public.is_founder_or_master()::text FROM (SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f1', true)) s), 'true');
-- reset des effets du constat
DELETE FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-0000000000f1';
DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-0000000000f1';
UPDATE public.shop_installed_themes SET v = 'orig';
UPDATE public.shop_ai_assistants SET v = 'orig';
UPDATE public.shop_seo_settings SET v = 'orig';
