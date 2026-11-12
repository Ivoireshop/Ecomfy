-- Cas APRÈS correction pour 20261111100000_rbac_no_hardcoded_emails_collaborators.sql.
-- À jouer après rbac_collaborators.sql (socle + constat « avant ») et après la migration (deux fois).

\set ON_ERROR_STOP on

\set owner      '''00000000-0000-0000-0000-000000000001'''
\set v_view     '''00000000-0000-0000-0000-000000000002'''
\set v_edit     '''00000000-0000-0000-0000-000000000003'''
\set v_catalog  '''00000000-0000-0000-0000-000000000004'''
\set v_full     '''00000000-0000-0000-0000-000000000005'''
\set stranger   '''00000000-0000-0000-0000-000000000006'''
\set admin      '''00000000-0000-0000-0000-000000000007'''
\set founder    '''00000000-0000-0000-0000-000000000008'''
\set shop1      '''0000000a-0000-0000-0000-000000000001'''

CREATE FUNCTION public.t_accept(uid uuid, tok text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE j jsonb; em text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', COALESCE(uid::text, ''), true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', uid, 'email', (SELECT email FROM auth.users WHERE id = uid))::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    SELECT public.accept_shop_invitation(tok) INTO j;
    RESET ROLE;
    RETURN COALESCE(j ->> 'error', 'success' || CASE WHEN j ? 'already_accepted' THEN ':again' ELSE '' END)
           || COALESCE(':' || (j ->> 'expected_email'), '');
  EXCEPTION WHEN OTHERS THEN
    em := SQLERRM; RESET ROLE; RETURN 'err:' || em;
  END;
END $$;

-- ====== 1. Droits par rôle (thèmes, assistant, SEO, audios, catalogue) ======
-- view_orders : rien en écriture
SELECT public.t_expect('01 view_orders : thèmes refusés',      public.t_run(:v_view, format($q$UPDATE public.shop_installed_themes SET v='x' WHERE shop_id=%L$q$, :shop1)), 'ok:0');
SELECT public.t_expect('02 view_orders : assistant refusé',    public.t_run(:v_view, format($q$UPDATE public.shop_ai_assistants SET v='x' WHERE shop_id=%L$q$, :shop1)), 'ok:0');
SELECT public.t_expect('03 view_orders : SEO refusé',          public.t_run(:v_view, format($q$UPDATE public.shop_seo_settings SET v='x' WHERE shop_id=%L$q$, :shop1)), 'ok:0');
SELECT public.t_expect('04 view_orders : réglages thème refusés', public.t_run(:v_view, format($q$INSERT INTO public.product_theme_settings (shop_id, v) VALUES (%L,'x')$q$, :shop1)), 'err:');
SELECT public.t_expect('05 view_orders : audio produit refusé', public.t_run(:v_view, format($q$INSERT INTO public.product_audios (shop_id, user_id) VALUES (%L,%L)$q$, :shop1, :v_view)), 'err:');
SELECT public.t_expect('06 view_orders : produit refusé',      public.t_run(:v_view, format($q$INSERT INTO public.products (shop_id, name) VALUES (%L,'x')$q$, :shop1)), 'err:');
SELECT public.t_expect('07 view_orders : ne lit pas les réglages de thème', public.t_run(:v_view, format($q$SELECT * FROM public.product_theme_settings WHERE shop_id=%L$q$, :shop1)), 'ok:0');

-- edit_shop : thèmes, assistant, SEO, catalogue, boutique
SELECT public.t_expect('08 edit_shop : thèmes',    public.t_run(:v_edit, format($q$UPDATE public.shop_installed_themes SET v='e' WHERE shop_id=%L$q$, :shop1)), 'ok:1');
SELECT public.t_expect('09 edit_shop : assistant', public.t_run(:v_edit, format($q$UPDATE public.shop_ai_assistants SET v='e' WHERE shop_id=%L$q$, :shop1)), 'ok:1');
SELECT public.t_expect('10 edit_shop : SEO',       public.t_run(:v_edit, format($q$UPDATE public.shop_seo_settings SET v='e' WHERE shop_id=%L$q$, :shop1)), 'ok:1');
SELECT public.t_expect('11 edit_shop : produit',   public.t_run(:v_edit, format($q$INSERT INTO public.products (shop_id, name) VALUES (%L,'edit-prod')$q$, :shop1)), 'ok:1');
SELECT public.t_expect('12 edit_shop : modifie le nom de la boutique', public.t_run(:v_edit, format($q$UPDATE public.shops SET business_name='Renommée' WHERE id=%L$q$, :shop1)), 'ok:1');
SELECT public.t_expect('13 edit_shop : audio produit', public.t_run(:v_edit, format($q$INSERT INTO public.product_audios (shop_id, user_id) VALUES (%L,%L)$q$, :shop1, :v_edit)), 'ok:1');

-- manage_catalog : catalogue (désormais), pas l'apparence ni le SEO
SELECT public.t_expect('14 manage_catalog : produit',       public.t_run(:v_catalog, format($q$INSERT INTO public.products (shop_id, name) VALUES (%L,'cat-prod')$q$, :shop1)), 'ok:1');
SELECT public.t_expect('15 manage_catalog : modifie un produit', public.t_run(:v_catalog, format($q$UPDATE public.products SET name='cat-prod2' WHERE shop_id=%L AND name='cat-prod'$q$, :shop1)), 'ok:1');
SELECT public.t_expect('16 manage_catalog : image produit', public.t_run(:v_catalog, $q$INSERT INTO public.product_images (product_id) VALUES ('0000000b-0000-0000-0000-000000000001')$q$), 'ok:1');
SELECT public.t_expect('17 manage_catalog : traduction produit', public.t_run(:v_catalog, format($q$INSERT INTO public.product_translations (shop_id) VALUES (%L)$q$, :shop1)), 'ok:1');
SELECT public.t_expect('18 manage_catalog : audio produit', public.t_run(:v_catalog, format($q$INSERT INTO public.product_audios (shop_id, user_id) VALUES (%L,%L)$q$, :shop1, :v_catalog)), 'ok:1');
SELECT public.t_expect('19 manage_catalog : thèmes refusés', public.t_run(:v_catalog, format($q$UPDATE public.shop_installed_themes SET v='x' WHERE shop_id=%L$q$, :shop1)), 'ok:0');
SELECT public.t_expect('20 manage_catalog : SEO refusé',    public.t_run(:v_catalog, format($q$UPDATE public.shop_seo_settings SET v='x' WHERE shop_id=%L$q$, :shop1)), 'ok:0');
SELECT public.t_expect('21 manage_catalog : boutique refusée', public.t_run(:v_catalog, format($q$UPDATE public.shops SET business_name='x' WHERE id=%L$q$, :shop1)), 'ok:0');
SELECT public.t_expect('22 view_orders : image produit refusée', public.t_run(:v_view, $q$INSERT INTO public.product_images (product_id) VALUES ('0000000b-0000-0000-0000-000000000001')$q$), 'err:');

-- full_admin : tout le périmètre boutique
SELECT public.t_expect('23 full_admin : thèmes',  public.t_run(:v_full, format($q$UPDATE public.shop_installed_themes SET v='f' WHERE shop_id=%L$q$, :shop1)), 'ok:1');
SELECT public.t_expect('24 full_admin : produit', public.t_run(:v_full, format($q$INSERT INTO public.products (shop_id, name) VALUES (%L,'full-prod')$q$, :shop1)), 'ok:1');

-- propriétaire : inchangé
SELECT public.t_expect('25 propriétaire : thèmes',     public.t_run(:owner, format($q$UPDATE public.shop_installed_themes SET v='o' WHERE shop_id=%L$q$, :shop1)), 'ok:1');
SELECT public.t_expect('26 propriétaire : SEO',        public.t_run(:owner, format($q$UPDATE public.shop_seo_settings SET v='o' WHERE shop_id=%L$q$, :shop1)), 'ok:1');
SELECT public.t_expect('27 propriétaire : réglages thème', public.t_run(:owner, format($q$INSERT INTO public.product_theme_settings (shop_id, v) VALUES (%L,'o')$q$, :shop1)), 'ok:1');
SELECT public.t_expect('28 propriétaire : audio',      public.t_run(:owner, format($q$INSERT INTO public.product_audios (shop_id, user_id) VALUES (%L,%L)$q$, :shop1, :owner)), 'ok:1');
SELECT public.t_expect('29 propriétaire : assistant',  public.t_run(:owner, format($q$UPDATE public.shop_ai_assistants SET v='o' WHERE shop_id=%L$q$, :shop1)), 'ok:1');

-- tiers
SELECT public.t_expect('30 tiers : thèmes',    public.t_run(:stranger, format($q$UPDATE public.shop_installed_themes SET v='s' WHERE shop_id=%L$q$, :shop1)), 'ok:0');
SELECT public.t_expect('31 tiers : produit',   public.t_run(:stranger, format($q$INSERT INTO public.products (shop_id, name) VALUES (%L,'s')$q$, :shop1)), 'err:');
SELECT public.t_expect('32 tiers : SEO',       public.t_run(:stranger, format($q$UPDATE public.shop_seo_settings SET v='s' WHERE shop_id=%L$q$, :shop1)), 'ok:0');
-- admin plateforme : SEO conservé
SELECT public.t_expect('33 admin plateforme : SEO', public.t_run(:admin, format($q$UPDATE public.shop_seo_settings SET v='a' WHERE shop_id=%L$q$, :shop1)), 'ok:1');

-- ====== 2. Appropriation de la boutique et rôles ======
SELECT public.t_expect('40 edit_shop ne peut plus changer le propriétaire',
  public.t_run(:v_edit, format($q$UPDATE public.shops SET user_id=%L WHERE id=%L$q$, :v_edit, :shop1)), 'err:shop_owner_protected');
SELECT public.t_expect('41 full_admin non plus',
  public.t_run(:v_full, format($q$UPDATE public.shops SET user_id=%L WHERE id=%L$q$, :v_full, :shop1)), 'err:shop_owner_protected');
SELECT public.t_expect('42 le propriétaire ne peut pas non plus (transfert hors plateforme)',
  public.t_run(:owner, format($q$UPDATE public.shops SET user_id=%L WHERE id=%L$q$, :stranger, :shop1)), 'err:shop_owner_protected');
SELECT public.t_expect('43 propriétaire inchangé en base', (SELECT user_id::text FROM public.shops WHERE id = :shop1), '00000000-0000-0000-0000-000000000001');
SELECT public.t_expect('44 l''UPDATE du propriétaire sans toucher user_id passe',
  public.t_run(:owner, format($q$UPDATE public.shops SET business_name='Boutique 1' WHERE id=%L$q$, :shop1)), 'ok:1');
SELECT public.t_expect('46 un admin ne s''attribue plus founder',
  public.t_run(:admin, format($q$INSERT INTO public.user_roles (user_id, role) VALUES (%L,'founder')$q$, :admin)), 'err:');
SELECT public.t_expect('47 un admin ne modifie plus les rôles',
  public.t_run(:admin, format($q$UPDATE public.user_roles SET role='founder' WHERE user_id=%L$q$, :admin)), 'ok:0');
SELECT public.t_expect('48 chacun lit encore ses rôles',
  public.t_run(:founder, format($q$SELECT * FROM public.user_roles WHERE user_id=%L$q$, :founder)), 'ok:1');

-- ====== 3. E-mails en dur ======
SELECT public.t_expect('50 plus de fonction assign_founder_role', (to_regproc('public.assign_founder_role') IS NULL)::text, 'true');
SELECT public.t_expect('51 plus de déclencheur d''attribution par e-mail',
  (SELECT count(*)::text FROM pg_trigger WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal), '0');
INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
  ('00000000-0000-0000-0000-0000000000f1', 'djateulrich@gmail.com', now()),
  ('00000000-0000-0000-0000-0000000000f2', 'regnis13@gmail.com', now());
SELECT public.t_expect('52 inscription avec l''ancien e-mail fondateur : aucun rôle',
  (SELECT count(*)::text FROM public.user_roles WHERE user_id IN ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000f2')), '0');
SELECT public.t_expect('53 is_founder_or_master faux pour cet e-mail sans rôle',
  (SELECT public.is_founder_or_master()::text FROM (SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000f1', true)) s), 'false');
SELECT public.t_expect('54 is_founder_or_master vrai pour founder',
  (SELECT public.is_founder_or_master()::text FROM (SELECT set_config('request.jwt.claim.sub', :founder, true)) s), 'true');
SELECT public.t_expect('55 is_founder_or_master vrai pour admin (périmètre inchangé)',
  (SELECT public.is_founder_or_master()::text FROM (SELECT set_config('request.jwt.claim.sub', :admin, true)) s), 'true');
SELECT public.t_expect('56 is_founder_or_master faux pour un tiers',
  (SELECT public.is_founder_or_master()::text FROM (SELECT set_config('request.jwt.claim.sub', :stranger, true)) s), 'false');
SELECT public.t_expect('57 is_founder_or_master faux sans session',
  (SELECT public.is_founder_or_master()::text FROM (SELECT set_config('request.jwt.claim.sub', '', true)) s), 'false');
DELETE FROM auth.users WHERE id IN ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000f2');
-- La politique « Founders read all shops » suit le rôle, plus l'adresse
SELECT public.t_expect('58 founder lit toutes les boutiques',
  public.t_run(:founder, 'SELECT * FROM public.shops'), 'ok:1');
SELECT public.t_expect('59 tiers sans rôle ne lit aucune boutique',
  public.t_run(:stranger, 'SELECT * FROM public.shops'), 'ok:0');

-- ====== 4. Invitations ======
INSERT INTO auth.users (id, email, email_confirmed_at) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'unconfirmed@example.com', NULL),
  ('00000000-0000-0000-0000-0000000000a2', 'confirmed@example.com', now()),
  ('00000000-0000-0000-0000-0000000000a3', 'expired@example.com', now()),
  ('00000000-0000-0000-0000-0000000000a4', 'revoked@example.com', now()),
  ('00000000-0000-0000-0000-0000000000a5', 'used@example.com', now()),
  ('00000000-0000-0000-0000-0000000000a6', 'other@example.com', now());
INSERT INTO public.shop_collaborators (shop_id, invited_email, roles, status, invitation_token, updated_at) VALUES
  (:shop1, 'unconfirmed@example.com', '{view_orders}', 'pending', 'tok-unconfirmed-00000000', now()),
  (:shop1, 'confirmed@example.com',   '{view_orders}', 'pending', 'tok-confirmed-000000000', now()),
  (:shop1, 'expired@example.com',     '{view_orders}', 'pending', 'tok-expired-0000000000', now() - interval '15 days'),
  (:shop1, 'revoked@example.com',     '{view_orders}', 'revoked', 'tok-revoked-0000000000', now()),
  (:shop1, 'used@example.com',        '{view_orders}', 'pending', 'tok-used-000000000000', now());
UPDATE public.shop_collaborators SET status = 'active', user_id = '00000000-0000-0000-0000-0000000000a6' WHERE invitation_token = 'tok-used-000000000000';

SELECT public.t_expect('60 invité non confirmé : refusé',  public.t_accept('00000000-0000-0000-0000-0000000000a1', 'tok-unconfirmed-00000000'), 'email_not_confirmed');
SELECT public.t_expect('61 mauvais compte : refusé, adresse masquée',
  public.t_accept('00000000-0000-0000-0000-0000000000a6', 'tok-confirmed-000000000'), 'email_mismatch:co***@example.com');
SELECT public.t_expect('62 invitation expirée (15 jours)', public.t_accept('00000000-0000-0000-0000-0000000000a3', 'tok-expired-0000000000'), 'expired');
SELECT public.t_expect('63 invitation révoquée',           public.t_accept('00000000-0000-0000-0000-0000000000a4', 'tok-revoked-0000000000'), 'revoked');
SELECT public.t_expect('64 jeton déjà pris par un autre compte', public.t_accept('00000000-0000-0000-0000-0000000000a5', 'tok-used-000000000000'), 'already_used');
SELECT public.t_expect('65 jeton trop court / inconnu',    public.t_accept('00000000-0000-0000-0000-0000000000a2', 'abc'), 'invalid_token');
SELECT public.t_expect('66 jeton inconnu',                 public.t_accept('00000000-0000-0000-0000-0000000000a2', 'tok-unknown-000000000000'), 'invalid_token');
SELECT public.t_expect('67 sans session', public.t_accept(NULL, 'tok-confirmed-000000000'), 'not_authenticated');
SELECT public.t_expect('68 invité confirmé : accepté',     public.t_accept('00000000-0000-0000-0000-0000000000a2', 'tok-confirmed-000000000'), 'success');
SELECT public.t_expect('69 statut actif + user_id posé',
  (SELECT status || ':' || (user_id = '00000000-0000-0000-0000-0000000000a2')::text FROM public.shop_collaborators WHERE invitation_token = 'tok-confirmed-000000000'), 'active:true');
SELECT public.t_expect('70 rejouer le lien : idempotent',  public.t_accept('00000000-0000-0000-0000-0000000000a2', 'tok-confirmed-000000000'), 'success:again');
SELECT public.t_expect('71 le compte expiré reste sans accès',
  (SELECT count(*)::text FROM public.shop_collaborators WHERE invited_email = 'expired@example.com' AND status = 'active'), '0');
-- Lecture de sa propre invitation
SELECT public.t_expect('72 invité confirmé lit son invitation en attente',
  public.t_run('00000000-0000-0000-0000-0000000000a3', $q$SELECT * FROM public.shop_collaborators WHERE invited_email='expired@example.com'$q$), 'ok:1');
SELECT public.t_expect('73 invité non confirmé ne lit rien',
  public.t_run('00000000-0000-0000-0000-0000000000a1', $q$SELECT * FROM public.shop_collaborators WHERE invited_email='unconfirmed@example.com'$q$), 'ok:0');
SELECT public.t_expect('74 un tiers ne lit pas l''invitation d''autrui',
  public.t_run(:stranger, $q$SELECT * FROM public.shop_collaborators WHERE invited_email='unconfirmed@example.com'$q$), 'ok:0');
SELECT public.t_expect('75 le propriétaire gère toujours ses collaborateurs',
  public.t_run(:owner, format($q$SELECT * FROM public.shop_collaborators WHERE shop_id=%L$q$, :shop1)), 'ok:9');
SELECT public.t_expect('76 un collaborateur ne s''élève pas lui-même (UPDATE roles)',
  public.t_run(:v_view, format($q$UPDATE public.shop_collaborators SET roles='{full_admin}' WHERE user_id=%L$q$, :v_view)), 'ok:0');
-- Droits d'exécution
SELECT public.t_expect('77 accept_shop_invitation interdit à anon',
  (SELECT NOT has_function_privilege('anon', 'public.accept_shop_invitation(text)', 'EXECUTE'))::text, 'true');

-- ====== Bilan ======
SELECT name, got, want, CASE WHEN pass THEN 'OK' ELSE 'ÉCHEC' END AS verdict FROM public.t_results ORDER BY name;
DO $$
DECLARE bad int; total int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT pass), count(*) INTO bad, total FROM public.t_results;
  RAISE NOTICE 'Bilan : % réussis, % échec(s) sur %', total - bad, bad, total;
  IF bad > 0 THEN RAISE EXCEPTION '% cas en échec', bad; END IF;
END $$;
