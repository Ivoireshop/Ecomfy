-- M7 + RBAC/RLS collaborateurs + invitations (11/11/2026)
--
-- 1. Plus aucun e-mail codé en dur dans la base : le rôle `founder` / `co_founder` de public.user_roles est la
--    seule source de vérité (attribution par la fonction manage-founder-roles, jamais par une adresse).
-- 2. Un collaborateur n'a que les droits de SES rôles : avant, tout collaborateur actif (même « view_orders »)
--    pouvait écrire les thèmes, l'assistant IA, les audios produit et le SEO ; « manage_catalog » n'ouvrait rien.
-- 3. Un collaborateur `edit_shop` ne peut plus s'approprier la boutique (UPDATE shops SET user_id = soi-même).
-- 4. Un `admin` ne peut plus s'attribuer `founder` en écrivant dans user_roles.
-- 5. Acceptation d'invitation : e-mail confirmé exigé, invitation expirée au bout de 14 jours, jeton à usage unique.
--
-- Idempotente. Ne dépend d'aucune colonne absente (toute table optionnelle est protégée par to_regclass).
-- À appliquer À LA MAIN (jamais `supabase db push`). Guide : docs/DEPLOIEMENT-RBAC-COLLABORATEURS-2026-11.md

-- ====================================================================
-- 1. E-mails en dur : déclencheur d'inscription et is_founder_or_master
-- ====================================================================

-- Garde-fou : ne pas supprimer l'attribution automatique si la base n'a aucun fondateur (verrouillage définitif
-- du tableau de bord). Une base vide (nouvel environnement) n'est pas concernée.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users)
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role::text = 'founder') THEN
    RAISE EXCEPTION 'Aucun compte founder dans public.user_roles : insérez-le avant cette migration (voir le guide, section « Amorçage »).';
  END IF;
END $$;

DROP TRIGGER IF EXISTS assign_founder_role_on_signup ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;
DROP FUNCTION IF EXISTS public.assign_founder_role();

-- Mêmes rôles qu'avant (founder, co_founder, shareholder, admin) : seul le raccourci par e-mail disparaît.
CREATE OR REPLACE FUNCTION public.is_founder_or_master()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role::text IN ('founder', 'co_founder', 'shareholder', 'admin')
  );
$$;

-- ====================================================================
-- 2. Droits d'un collaborateur : par rôle, pas « collaborateur = tout »
-- ====================================================================

-- Vrai si l'appelant est propriétaire de la boutique, ou collaborateur actif avec l'un des rôles demandés
-- (ou « full_admin »). Compare roles en text[] : valable que la colonne soit text[] ou enum[].
-- Exécutable par PUBLIC : les politiques des tables lisibles par anon l'évaluent ; elle ne répond que pour auth.uid().
CREATE OR REPLACE FUNCTION public.has_shop_permission(_shop_id uuid, _permissions text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops s WHERE s.id = _shop_id AND s.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.shop_collaborators sc
    WHERE sc.shop_id = _shop_id
      AND sc.user_id = auth.uid()
      AND sc.status = 'active'
      AND (sc.roles::text[] && _permissions OR 'full_admin' = ANY (sc.roles::text[]))
  );
$$;
GRANT EXECUTE ON FUNCTION public.has_shop_permission(uuid, text[]) TO PUBLIC;

DO $$
DECLARE
  t text;
  cond constant text := $c$public.has_shop_permission(shop_id, ARRAY['edit_shop'])$c$;
  catalog constant text := $c$public.has_shop_permission(shop_id, ARRAY['edit_shop','manage_catalog'])$c$;
BEGIN
  -- Catalogue : « edit_shop » OU « manage_catalog » (ce dernier n'ouvrait rien jusqu'ici).
  IF to_regclass('public.products') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Collaborators edit_shop can write products" ON public.products;
    DROP POLICY IF EXISTS "Collaborators catalog roles can write products" ON public.products;
    EXECUTE format('CREATE POLICY "Collaborators catalog roles can write products" ON public.products FOR ALL USING (%s) WITH CHECK (%s)', catalog, catalog);
  END IF;

  IF to_regclass('public.product_translations') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Shop edit collaborators manage product translations" ON public.product_translations;
    DROP POLICY IF EXISTS "Collaborators catalog roles manage product translations" ON public.product_translations;
    EXECUTE format('CREATE POLICY "Collaborators catalog roles manage product translations" ON public.product_translations FOR ALL USING (%s) WITH CHECK (%s)', catalog, catalog);
  END IF;

  IF to_regclass('public.product_images') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Collaborators edit_shop can manage product images" ON public.product_images;
    DROP POLICY IF EXISTS "Collaborators catalog roles can manage product images" ON public.product_images;
    CREATE POLICY "Collaborators catalog roles can manage product images" ON public.product_images
      FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_images.product_id
                     AND public.has_shop_permission(p.shop_id, ARRAY['edit_shop','manage_catalog'])))
      WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_images.product_id
                     AND public.has_shop_permission(p.shop_id, ARRAY['edit_shop','manage_catalog'])));
  END IF;

  IF to_regclass('public.product_audios') IS NOT NULL THEN
    DROP POLICY IF EXISTS "product_audios owner select" ON public.product_audios;
    DROP POLICY IF EXISTS "product_audios owner insert" ON public.product_audios;
    DROP POLICY IF EXISTS "product_audios owner update" ON public.product_audios;
    DROP POLICY IF EXISTS "product_audios owner delete" ON public.product_audios;
    EXECUTE format('CREATE POLICY "product_audios owner select" ON public.product_audios FOR SELECT TO authenticated USING (%s)', catalog);
    EXECUTE format('CREATE POLICY "product_audios owner insert" ON public.product_audios FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND %s)', catalog);
    EXECUTE format('CREATE POLICY "product_audios owner update" ON public.product_audios FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', catalog, catalog);
    EXECUTE format('CREATE POLICY "product_audios owner delete" ON public.product_audios FOR DELETE TO authenticated USING (%s)', catalog);
  END IF;

  -- Apparence et assistant : « edit_shop » seulement.
  IF to_regclass('public.product_theme_settings') IS NOT NULL THEN
    DROP POLICY IF EXISTS "product_theme_settings owner select" ON public.product_theme_settings;
    DROP POLICY IF EXISTS "product_theme_settings owner upsert" ON public.product_theme_settings;
    DROP POLICY IF EXISTS "product_theme_settings owner update" ON public.product_theme_settings;
    DROP POLICY IF EXISTS "product_theme_settings owner delete" ON public.product_theme_settings;
    EXECUTE format('CREATE POLICY "product_theme_settings owner select" ON public.product_theme_settings FOR SELECT TO authenticated USING (%s)', cond);
    EXECUTE format('CREATE POLICY "product_theme_settings owner upsert" ON public.product_theme_settings FOR INSERT TO authenticated WITH CHECK (%s)', cond);
    EXECUTE format('CREATE POLICY "product_theme_settings owner update" ON public.product_theme_settings FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', cond, cond);
    EXECUTE format('CREATE POLICY "product_theme_settings owner delete" ON public.product_theme_settings FOR DELETE TO authenticated USING (%s)', cond);
  END IF;

  IF to_regclass('public.shop_installed_themes') IS NOT NULL THEN
    DROP POLICY IF EXISTS "installed_themes_owner_manage" ON public.shop_installed_themes;
    EXECUTE format('CREATE POLICY "installed_themes_owner_manage" ON public.shop_installed_themes FOR ALL USING (%s) WITH CHECK (%s)', cond, cond);
  END IF;

  IF to_regclass('public.shop_ai_assistants') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Owners and collaborators can view shop assistant" ON public.shop_ai_assistants;
    DROP POLICY IF EXISTS "Owners and collaborators can update shop assistant" ON public.shop_ai_assistants;
    EXECUTE format('CREATE POLICY "Owners and collaborators can view shop assistant" ON public.shop_ai_assistants FOR SELECT USING (%s)', cond);
    EXECUTE format('CREATE POLICY "Owners and collaborators can update shop assistant" ON public.shop_ai_assistants FOR UPDATE USING (%s)', cond);
  END IF;

  -- SEO Intelligence : « edit_shop » ou administrateur plateforme (user_roles). Les jetons Google restent
  -- illisibles depuis le navigateur (20261021120000).
  FOREACH t IN ARRAY ARRAY['shop_seo_settings', 'shop_seo_connections', 'shop_seo_audits',
                           'shop_seo_queries_cache', 'shop_seo_pages_cache', 'shop_seo_history'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Tenant isolation ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (%s OR public.has_role(auth.uid(), ''admin'')) WITH CHECK (%s OR public.has_role(auth.uid(), ''admin''))',
                   'Tenant isolation ' || t, t, cond, cond);
  END LOOP;
END $$;

-- ====================================================================
-- 3. Un collaborateur ne peut pas s'approprier la boutique
-- ====================================================================
-- Avant : « Collaborators with edit_shop can update shop » + garde de facturation qui ne protégeait pas user_id
-- => UPDATE shops SET user_id = <soi> passait (USING et WITH CHECK évalués avec le nouveau propriétaire).
CREATE OR REPLACE FUNCTION public.guard_shop_owner_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     AND current_user IN ('authenticated', 'anon')
     AND NOT (public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder')) THEN
    RAISE EXCEPTION 'shop_owner_protected' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_shop_owner ON public.shops;
CREATE TRIGGER trg_guard_shop_owner
  BEFORE UPDATE OF user_id ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.guard_shop_owner_immutable();

-- ====================================================================
-- 4. Un admin ne s'attribue plus de rôle
-- ====================================================================
-- « Admins can manage all roles » (FOR ALL) laissait un admin s'insérer `founder`. Aucun code navigateur n'écrit
-- dans user_roles : les rôles se gèrent par l'Edge Function manage-founder-roles (service_role, fondateur seul).
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- ====================================================================
-- 5. Invitations collaborateur
-- ====================================================================

-- E-mail du compte confirmé ? Lu dans auth.users (le JWT n'a pas de champ « email_verified » de premier niveau).
CREATE OR REPLACE FUNCTION public.current_user_email_confirmed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
  );
$$;
REVOKE ALL ON FUNCTION public.current_user_email_confirmed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_email_confirmed() TO authenticated;

DROP POLICY IF EXISTS "Collaborator can read own invite" ON public.shop_collaborators;
CREATE POLICY "Collaborator can read own invite" ON public.shop_collaborators
  FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND (
      user_id = auth.uid()
      OR (public.current_user_email_confirmed()
          AND lower(invited_email) = lower(COALESCE(auth.jwt() ->> 'email', '')))
    )
  );

CREATE OR REPLACE FUNCTION public.accept_shop_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed boolean;
  v_invite public.shop_collaborators%ROWTYPE;
  v_masked text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  SELECT lower(COALESCE(u.email, '')), u.email_confirmed_at IS NOT NULL
    INTO v_email, v_confirmed
    FROM auth.users u WHERE u.id = v_uid;

  SELECT * INTO v_invite FROM public.shop_collaborators
    WHERE invitation_token = _token LIMIT 1
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  IF lower(v_invite.invited_email) <> COALESCE(v_email, '') THEN
    -- Adresse partiellement masquée : le porteur du lien sait quel compte utiliser sans qu'on la lui livre en entier.
    v_masked := regexp_replace(v_invite.invited_email, '^(.{1,2}).*(@.*)$', '\1***\2');
    RETURN jsonb_build_object('success', false, 'error', 'email_mismatch', 'expected_email', v_masked);
  END IF;

  IF NOT COALESCE(v_confirmed, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'email_not_confirmed');
  END IF;

  IF v_invite.status = 'revoked' THEN
    RETURN jsonb_build_object('success', false, 'error', 'revoked');
  END IF;

  IF v_invite.status = 'active' THEN
    IF v_invite.user_id = v_uid THEN
      RETURN jsonb_build_object('success', true, 'shop_id', v_invite.shop_id, 'already_accepted', true);
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'already_used');
  END IF;

  -- updated_at est renouvelé à chaque renvoi de l'invitation par le propriétaire.
  IF COALESCE(v_invite.updated_at, v_invite.created_at) < now() - interval '14 days' THEN
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  UPDATE public.shop_collaborators
     SET user_id = v_uid, status = 'active', accepted_at = now(), updated_at = now()
   WHERE id = v_invite.id;

  RETURN jsonb_build_object('success', true, 'shop_id', v_invite.shop_id);
END;
$$;
REVOKE ALL ON FUNCTION public.accept_shop_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_shop_invitation(text) TO authenticated, service_role;
