-- Test de supabase/migrations/20261022130000_shop_promo_codes.sql (22/10/2026).
-- À lancer sur une base de dev : tout est créé dans une transaction qui se termine par une exception contenant le
-- rapport JSON (rien n'est conservé). Lancer :  npx supabase db query --linked -f supabase/tests/shop_promo_codes.sql
-- Attendu : owner_voit_ses_codes 7 ; doublon_casse / code_trop_court / autre_marchand_cree = refuse ; autre_marchand_voit 0 ;
-- cmd_pct20 total 36000 (remise 9000) ; cmd_fix 40000 ; cmd_min_refuse, cmd_cible_refuse : promo_applied false + message ;
-- cmd_cible_ok 22500 ; usages : PCT20/FIX5000/VIPAWA = 1, MIN60K/OFF/PAST = 0, FULL = 1 ; abonnement_voit_code_boutique false.
-- Test de bout en bout des codes promo de boutique. Tout est annulé : la fin lève une exception qui contient le rapport.
DO $$
DECLARE
  uid uuid := gen_random_uuid(); uid2 uuid := gen_random_uuid(); sid uuid := gen_random_uuid();
  p1 uuid := gen_random_uuid(); p2 uuid := gen_random_uuid();
  rep jsonb := '{}'::jsonb; r jsonb; n int; o record;
  items jsonb;
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
  VALUES (uid, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','t1@example.test','x',now(),'{}','{}',now(),now(),'','','',''),
         (uid2,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t2@example.test','x',now(),'{}','{}',now(),now(),'','','','');
  INSERT INTO public.shops (id, user_id, business_name, slug, is_activated, is_published, activation_fee_paid, commission_rate)
  VALUES (sid, uid, 'Boutique promo test', 'zz-promo-test', true, true, true, 0.05);
  INSERT INTO public.products (id, shop_id, name, price, is_published) VALUES (p1, sid, 'P1', 10000, true), (p2, sid, 'P2', 25000, true);
  items := jsonb_build_array(jsonb_build_object('product_id', p1, 'quantity', 2), jsonb_build_object('product_id', p2, 'quantity', 1)); -- sous-total 45000

  -- Codes (créés en tant que propriétaire, donc via les droits RLS)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.promo_codes (code, discount_type, discount_percentage, max_uses, expires_at, created_by, shop_id)
    VALUES ('pct20', 'percentage', 20, 5, now() + interval '7 days', uid, sid);
  INSERT INTO public.promo_codes (code, discount_type, discount_amount, max_uses, expires_at, created_by, shop_id)
    VALUES ('FIX5000', 'fixed_amount', 5000, 5, now() + interval '7 days', uid, sid);
  INSERT INTO public.promo_codes (code, discount_type, discount_percentage, max_uses, expires_at, created_by, shop_id, min_order_amount)
    VALUES ('MIN60K', 'percentage', 10, 5, now() + interval '7 days', uid, sid, 60000);
  INSERT INTO public.promo_codes (code, discount_type, discount_percentage, max_uses, expires_at, created_by, shop_id, target_user_phone)
    VALUES ('VIPAWA', 'percentage', 50, 5, now() + interval '7 days', uid, sid, '+225 07 11 11 11 11');
  INSERT INTO public.promo_codes (code, discount_type, discount_percentage, max_uses, expires_at, created_by, shop_id, is_active)
    VALUES ('OFF', 'percentage', 10, 5, now() + interval '7 days', uid, sid, false);
  INSERT INTO public.promo_codes (code, discount_type, discount_percentage, max_uses, expires_at, created_by, shop_id)
    VALUES ('PAST', 'percentage', 10, 5, now() - interval '1 day', uid, sid);
  INSERT INTO public.promo_codes (code, discount_type, discount_percentage, max_uses, current_uses, expires_at, created_by, shop_id)
    VALUES ('FULL', 'percentage', 10, 1, 1, now() + interval '7 days', uid, sid);
  SELECT count(*) INTO n FROM public.promo_codes WHERE shop_id = sid;
  rep := rep || jsonb_build_object('owner_voit_ses_codes', n);
  BEGIN
    INSERT INTO public.promo_codes (code, discount_type, discount_percentage, max_uses, expires_at, created_by, shop_id)
      VALUES ('PCT20', 'percentage', 20, 5, now() + interval '7 days', uid, sid);
    rep := rep || jsonb_build_object('doublon_casse', 'ACCEPTE (bug)');
  EXCEPTION WHEN unique_violation THEN rep := rep || jsonb_build_object('doublon_casse', 'refuse');
  END;
  BEGIN
    INSERT INTO public.promo_codes (code, discount_type, discount_percentage, max_uses, expires_at, created_by, shop_id)
      VALUES ('X', 'percentage', 20, 5, now() + interval '7 days', uid, sid);
    rep := rep || jsonb_build_object('code_trop_court', 'ACCEPTE (bug)');
  EXCEPTION WHEN OTHERS THEN rep := rep || jsonb_build_object('code_trop_court', 'refuse');
  END;
  RESET ROLE;

  -- Un autre marchand ne voit ni ne crée de codes pour cette boutique
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid2, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.promo_codes WHERE shop_id = sid;
  rep := rep || jsonb_build_object('autre_marchand_voit', n);
  BEGIN
    INSERT INTO public.promo_codes (code, discount_type, discount_percentage, max_uses, expires_at, created_by, shop_id)
      VALUES ('HACK', 'percentage', 90, 5, now() + interval '7 days', uid2, sid);
    rep := rep || jsonb_build_object('autre_marchand_cree', 'ACCEPTE (bug)');
  EXCEPTION WHEN OTHERS THEN rep := rep || jsonb_build_object('autre_marchand_cree', 'refuse');
  END;
  RESET ROLE;

  -- Anonyme : ne lit aucun code, mais l'aperçu fonctionne
  SET LOCAL ROLE anon;
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    SELECT count(*) INTO n FROM public.promo_codes;
    rep := rep || jsonb_build_object('anon_voit', n);
  EXCEPTION WHEN insufficient_privilege THEN rep := rep || jsonb_build_object('anon_voit', 'refuse (droits)');
  END;
  rep := rep || jsonb_build_object('apercu_pct20', public.preview_shop_promo_code(sid, ' pct20 ', 45000));
  rep := rep || jsonb_build_object('apercu_fix', public.preview_shop_promo_code(sid, 'FIX5000', 45000) -> 'discount');
  rep := rep || jsonb_build_object('apercu_min', public.preview_shop_promo_code(sid, 'MIN60K', 45000) ->> 'message');
  rep := rep || jsonb_build_object('apercu_cible_sans_tel', public.preview_shop_promo_code(sid, 'VIPAWA', 45000) ->> 'message');
  rep := rep || jsonb_build_object('apercu_cible_ok', public.preview_shop_promo_code(sid, 'VIPAWA', 45000, '0711111111') -> 'discount');
  rep := rep || jsonb_build_object('apercu_off', public.preview_shop_promo_code(sid, 'OFF', 45000) ->> 'message');
  rep := rep || jsonb_build_object('apercu_past', public.preview_shop_promo_code(sid, 'PAST', 45000) ->> 'message');
  rep := rep || jsonb_build_object('apercu_full', public.preview_shop_promo_code(sid, 'FULL', 45000) ->> 'message');
  rep := rep || jsonb_build_object('apercu_inconnu', public.preview_shop_promo_code(sid, 'NOPE', 45000) ->> 'message');

  -- Commandes via la RPC publique
  r := public.create_public_order(sid, 'Client A', '+22507000001', items, NULL, NULL, NULL, NULL, 'cash_on_delivery', 'new', 'pct20');
  rep := rep || jsonb_build_object('cmd_pct20', r);
  r := public.create_public_order(sid, 'Client B', '+22507000002', items, NULL, NULL, NULL, NULL, 'cash_on_delivery', 'new', 'FIX5000');
  rep := rep || jsonb_build_object('cmd_fix', r);
  r := public.create_public_order(sid, 'Client C', '+22507000003', items, NULL, NULL, NULL, NULL, 'cash_on_delivery', 'new', 'MIN60K');
  rep := rep || jsonb_build_object('cmd_min_refuse', r);
  r := public.create_public_order(sid, 'Client D', '+22507000004', items, NULL, NULL, NULL, NULL, 'cash_on_delivery', 'new', 'VIPAWA');
  rep := rep || jsonb_build_object('cmd_cible_refuse', r);
  r := public.create_public_order(sid, 'Awa', '+225 07 11 11 11 11', items, NULL, NULL, NULL, NULL, 'cash_on_delivery', 'new', 'vipawa');
  rep := rep || jsonb_build_object('cmd_cible_ok', r);
  r := public.create_public_order(sid, 'Client E', '+22507000005', items);
  rep := rep || jsonb_build_object('cmd_sans_code', r);
  RESET ROLE;

  FOR o IN SELECT order_number, customer_name, subtotal, discount_amount, total, commission_amount, promo_code FROM public.orders WHERE shop_id = sid ORDER BY customer_name LOOP
    rep := rep || jsonb_build_object('db_' || o.customer_name, jsonb_build_object('sub', o.subtotal, 'rem', o.discount_amount, 'total', o.total, 'comm', o.commission_amount, 'code', o.promo_code));
  END LOOP;
  SELECT jsonb_object_agg(code, current_uses) INTO r FROM public.promo_codes WHERE shop_id = sid;
  rep := rep || jsonb_build_object('usages', r);

  -- Les codes d'abonnement ne voient pas les codes de boutique
  rep := rep || jsonb_build_object('abonnement_voit_code_boutique', (SELECT is_valid FROM public.validate_promo_code('PCT20')));

  RAISE EXCEPTION 'RAPPORT %', rep::text;
END $$;
