-- Test de supabase/migrations/20261023120000_billing_commission_payment_lock_and_invoices.sql (23/10/2026).
-- À lancer sur une base de dev : tout est créé dans une transaction qui se termine par une exception contenant le
-- rapport JSON (rien n'est conservé). Lancer :  npx supabase db query --linked -f supabase/tests/billing_commission_payment.sql
-- Attendu (tous les champs « ok » à true) :
--   active_partiel_25      : solde 9000, statut active
--   pending_partiel_50     : solde 6000, statut payment_pending, échéance renouvelée
--   locked_partiel_75      : solde 3000, TOUJOURS locked et suspendue (avant correctif : déverrouillée)
--   locked_solde_complet   : solde 0, active, non suspendue, échéances effacées
--   rejeu_meme_reference   : already_applied, solde inchangé
--   facture_reglee         : facture PAYMENT_CONFIRMED, montant conservé (12000), paid_at et référence renseignés
--   facture_annulee_intacte: une facture CANCELLED n'est pas rouverte
DO $$
DECLARE
  uid uuid := gen_random_uuid();
  s_active uuid := gen_random_uuid(); s_pending uuid := gen_random_uuid(); s_locked uuid := gen_random_uuid();
  rep jsonb := '{}'::jsonb; r jsonb; sh record; inv record;
  had_invoices boolean := to_regclass('public.shop_invoices') IS NOT NULL;
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
  VALUES (uid, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','bill1@example.test','x',now(),'{}','{}',now(),now(),'','','','');
  INSERT INTO public.shops (id, user_id, business_name, slug, is_activated, is_published, activation_fee_paid, commission_rate)
  VALUES (s_active,  uid, 'Facturation active',  'zz-bill-active',  true, true, true, 0.05),
         (s_pending, uid, 'Facturation pending', 'zz-bill-pending', true, true, true, 0.05),
         (s_locked,  uid, 'Facturation locked',  'zz-bill-locked',  true, true, true, 0.05);

  UPDATE public.shops SET commission_balance_due = 12000 WHERE id IN (s_active, s_pending, s_locked);
  UPDATE public.shops SET shop_payment_status = 'payment_pending', payment_deadline = now() + interval '1 day',
         first_deadline_at = now() + interval '1 day' WHERE id = s_pending;
  UPDATE public.shops SET shop_payment_status = 'locked', is_suspended = true, locked_at = now(),
         second_deadline_at = now() + interval '2 days', payment_deadline = now() - interval '1 day' WHERE id = s_locked;

  -- Système de factures : créé dans la transaction s'il est absent (annulé avec elle)
  IF NOT had_invoices THEN
    CREATE TABLE public.shop_invoices (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), shop_id uuid NOT NULL, invoice_number text, orders_threshold int DEFAULT 240,
      amount numeric NOT NULL DEFAULT 12000, status text NOT NULL DEFAULT 'PAYMENT_DUE', due_date timestamptz,
      paid_at timestamptz, payment_reference text, payment_method text, reactivated_at timestamptz
    );
  END IF;
  INSERT INTO public.shop_invoices (shop_id, invoice_number, orders_threshold, amount, status)
  VALUES (s_locked, 'BILL-TEST-1', 240, 12000, 'STORE_RESTRICTED'),
         (s_locked, 'BILL-TEST-2', 480, 12000, 'CANCELLED');

  -- 1. active, 25 % : le solde baisse, rien d'autre
  r := public.apply_commission_payment(s_active, 3000, 'TEST-BILL-A1', NULL, 'wave', 'test');
  SELECT * INTO sh FROM public.shops WHERE id = s_active;
  rep := rep || jsonb_build_object('active_partiel_25', jsonb_build_object('ok', sh.commission_balance_due = 9000 AND sh.shop_payment_status = 'active', 'balance', sh.commission_balance_due, 'status', sh.shop_payment_status, 'event', r->>'event'));

  -- 2. payment_pending, 50 % : nouveau délai de 3 jours
  r := public.apply_commission_payment(s_pending, 6000, 'TEST-BILL-P1', NULL, 'wave', 'test');
  SELECT * INTO sh FROM public.shops WHERE id = s_pending;
  rep := rep || jsonb_build_object('pending_partiel_50', jsonb_build_object('ok', sh.commission_balance_due = 6000 AND sh.shop_payment_status = 'payment_pending' AND sh.payment_deadline > now() + interval '2 days', 'balance', sh.commission_balance_due, 'status', sh.shop_payment_status, 'event', r->>'event'));

  -- 3. locked, 75 % : reste verrouillée
  r := public.apply_commission_payment(s_locked, 9000, 'TEST-BILL-L1', NULL, 'wave', 'test');
  SELECT * INTO sh FROM public.shops WHERE id = s_locked;
  rep := rep || jsonb_build_object('locked_partiel_75', jsonb_build_object('ok', sh.commission_balance_due = 3000 AND sh.shop_payment_status = 'locked' AND sh.is_suspended, 'balance', sh.commission_balance_due, 'status', sh.shop_payment_status, 'suspended', sh.is_suspended, 'event', r->>'event'));

  -- 4. rejeu de la même référence : sans effet
  r := public.apply_commission_payment(s_locked, 9000, 'TEST-BILL-L1', NULL, 'wave', 'test');
  SELECT * INTO sh FROM public.shops WHERE id = s_locked;
  rep := rep || jsonb_build_object('rejeu_meme_reference', jsonb_build_object('ok', (r->>'already_applied')::boolean AND sh.commission_balance_due = 3000, 'balance', sh.commission_balance_due));

  -- 5. locked, solde complet : déverrouillée, facture ouverte réglée, facture annulée intacte
  r := public.apply_commission_payment(s_locked, 3000, 'TEST-BILL-L2', NULL, 'wave', 'test');
  SELECT * INTO sh FROM public.shops WHERE id = s_locked;
  rep := rep || jsonb_build_object('locked_solde_complet', jsonb_build_object('ok', sh.commission_balance_due = 0 AND sh.shop_payment_status = 'active' AND NOT sh.is_suspended AND sh.locked_at IS NULL AND sh.second_deadline_at IS NULL AND sh.payment_deadline IS NULL, 'status', sh.shop_payment_status, 'event', r->>'event'));
  SELECT * INTO inv FROM public.shop_invoices WHERE invoice_number = 'BILL-TEST-1';
  rep := rep || jsonb_build_object('facture_reglee', jsonb_build_object('ok', inv.status = 'PAYMENT_CONFIRMED' AND inv.amount = 12000 AND inv.paid_at IS NOT NULL AND inv.payment_reference = 'TEST-BILL-L2', 'status', inv.status, 'amount', inv.amount, 'ref', inv.payment_reference, 'table_creee_par_le_test', NOT had_invoices));
  SELECT * INTO inv FROM public.shop_invoices WHERE invoice_number = 'BILL-TEST-2';
  rep := rep || jsonb_build_object('facture_annulee_intacte', jsonb_build_object('ok', inv.status = 'CANCELLED' AND inv.paid_at IS NULL, 'status', inv.status));

  RAISE EXCEPTION 'RAPPORT %', rep::text;
END $$;
