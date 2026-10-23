-- Test de supabase/migrations/20261023140000_billing_enforce_deadlines_cron.sql (23/10/2026).
-- Dev : tout est annulé (la fin lève une exception qui contient le rapport).
--   npx supabase db query --linked -f supabase/tests/billing_enforce_deadlines.sql
-- Attendu : tous les champs « ok » à true.
DO $$
DECLARE
  uid uuid := gen_random_uuid(); rep jsonb := '{}'::jsonb; n int; sh record;
  s_late uuid := gen_random_uuid(); s_future uuid := gen_random_uuid(); s_zero uuid := gen_random_uuid();
  s_locked uuid := gen_random_uuid(); s_extra uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
  VALUES (uid, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','bill2@example.test','x',now(),'{}','{}',now(),now(),'','','','');
  INSERT INTO public.shops (id, user_id, business_name, slug, is_activated, is_published, activation_fee_paid, commission_rate)
  VALUES (s_late, uid, 'Retard', 'zz-enf-late', true, true, true, 0.05), (s_future, uid, 'Futur', 'zz-enf-future', true, true, true, 0.05),
         (s_zero, uid, 'Zero', 'zz-enf-zero', true, true, true, 0.05), (s_locked, uid, 'Locked', 'zz-enf-locked', true, true, true, 0.05),
         (s_extra, uid, 'Extra', 'zz-enf-extra', true, true, true, 0.05);
  UPDATE public.shops SET commission_balance_due = 12000, shop_payment_status = 'payment_pending', first_deadline_at = now() - interval '1 hour', payment_deadline = now() - interval '1 hour' WHERE id = s_late;
  UPDATE public.shops SET commission_balance_due = 12000, shop_payment_status = 'payment_pending', first_deadline_at = now() + interval '1 day' WHERE id = s_future;
  UPDATE public.shops SET commission_balance_due = 0, shop_payment_status = 'payment_pending', first_deadline_at = now() - interval '1 hour' WHERE id = s_zero;
  UPDATE public.shops SET commission_balance_due = 12000, shop_payment_status = 'locked', is_suspended = true, locked_at = now() - interval '4 days', second_deadline_at = now() - interval '1 hour' WHERE id = s_locked;
  UPDATE public.shops SET commission_balance_due = 12000, shop_payment_status = 'locked', is_suspended = true, locked_at = now() - interval '4 days', second_deadline_at = now() - interval '1 hour', extra_deadline_active = true, extra_deadline_ends_at = now() + interval '1 day' WHERE id = s_extra;

  n := public.enforce_all_shop_payment_states();
  FOR sh IN SELECT slug, shop_payment_status st, is_suspended su FROM public.shops WHERE slug LIKE 'zz-enf-%' LOOP
    rep := rep || jsonb_build_object(sh.slug, sh.st || CASE WHEN sh.su THEN ' (suspendue)' ELSE '' END);
  END LOOP;
  rep := rep || jsonb_build_object('transitions_comptees_ge_2', n >= 2,
    'ok_late_verrouillee', (SELECT shop_payment_status = 'locked' AND is_suspended AND second_deadline_at > now() FROM public.shops WHERE id = s_late),
    'ok_future_intacte', (SELECT shop_payment_status = 'payment_pending' FROM public.shops WHERE id = s_future),
    'ok_solde_zero_intacte', (SELECT shop_payment_status = 'payment_pending' FROM public.shops WHERE id = s_zero),
    'ok_locked_fermee', (SELECT shop_payment_status = 'final_suspension' FROM public.shops WHERE id = s_locked),
    'ok_delai_supplementaire_respecte', (SELECT shop_payment_status = 'locked' FROM public.shops WHERE id = s_extra));
  -- 2e passage : la boutique tout juste verrouillée n'est pas refermée aussitôt
  PERFORM public.enforce_all_shop_payment_states();
  rep := rep || jsonb_build_object('ok_pas_de_double_escalade', (SELECT shop_payment_status = 'locked' FROM public.shops WHERE id = s_late));
  RAISE EXCEPTION 'RAPPORT %', rep::text;
END $$;
