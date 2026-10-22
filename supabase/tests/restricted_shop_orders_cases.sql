-- Cas de test de 20261021150000_restricted_shop_orders_server_masking.sql (après le socle et la migration).
\set ON_ERROR_STOP on

DO $$
DECLARE
  sa uuid := 'aaaaaaaa-0000-0000-0000-00000000000a';  -- active
  ss uuid := '55555555-0000-0000-0000-00000000000a';  -- is_suspended
  so uuid := '00000000-0000-0000-0000-00000000000a';  -- PAYMENT_OVERDUE sans suspension
  sr uuid := 'cccccccc-0000-0000-0000-00000000000c';  -- STORE_RESTRICTED + suspendue
  sp uuid := 'dddddddd-0000-0000-0000-00000000000d';  -- payment_pending
  oa text := '11111111-0000-0000-0000-00000000000a';
  os text := '11111111-0000-0000-0000-00000000005a';
  oo text := '11111111-0000-0000-0000-00000000000b';
  orr text := '11111111-0000-0000-0000-00000000000c';
  op text := '11111111-0000-0000-0000-00000000000d';
  ca text := '22222222-0000-0000-0000-000000000001';  -- collaborateur de A
  co text := '22222222-0000-0000-0000-000000000002';  -- collaborateur de O
  f1 text := '33333333-0000-0000-0000-000000000001';
  x1 text := '44444444-0000-0000-0000-000000000001';
BEGIN
  -- Lecture directe (RLS)
  PERFORM public.rs_direct('01 propriétaire boutique active lit en direct',            'authenticated', oa, sa, 1);
  PERFORM public.rs_direct('02 propriétaire boutique payment_pending lit en direct',   'authenticated', op, sp, 1);
  PERFORM public.rs_direct('03 propriétaire boutique suspendue : refusé',               'authenticated', os, ss, 0);
  PERFORM public.rs_direct('04 propriétaire PAYMENT_OVERDUE sans suspension : refusé',  'authenticated', oo, so, 0);
  PERFORM public.rs_direct('05 propriétaire STORE_RESTRICTED : refusé',                 'authenticated', orr, sr, 0);
  PERFORM public.rs_direct('06 collaborateur boutique active lit en direct',            'authenticated', ca, sa, 1);
  PERFORM public.rs_direct('07 collaborateur PAYMENT_OVERDUE : refusé',                 'authenticated', co, so, 0);
  PERFORM public.rs_direct('08 tiers sur boutique active : refusé',                     'authenticated', x1, sa, 0);

  -- RPC
  PERFORM public.rs_rpc('09 propriétaire active : données en clair, notes visibles',   'authenticated', oa, sa, 'rows=1 restricted=f clear=t notes=t');
  PERFORM public.rs_rpc('10 propriétaire payment_pending : en clair',                   'authenticated', op, sp, 'rows=1 restricted=f clear=t notes=t');
  PERFORM public.rs_rpc('11 propriétaire suspendue : lignes masquées',                  'authenticated', os, ss, 'rows=1 restricted=t clear=f notes=f');
  PERFORM public.rs_rpc('12 propriétaire PAYMENT_OVERDUE : masqué',                     'authenticated', oo, so, 'rows=1 restricted=t clear=f notes=f');
  PERFORM public.rs_rpc('13 propriétaire STORE_RESTRICTED : masqué',                    'authenticated', orr, sr, 'rows=1 restricted=t clear=f notes=f');
  PERFORM public.rs_rpc('14 collaborateur PAYMENT_OVERDUE : masqué',                    'authenticated', co, so, 'rows=1 restricted=t clear=f notes=f');
  PERFORM public.rs_rpc('15 founder voit une boutique restreinte masquée',              'authenticated', f1, sr, 'rows=1 restricted=t clear=f notes=f');
  PERFORM public.rs_rpc('16 tiers : forbidden',                                         'authenticated', x1, sr, 'err forbidden');
  PERFORM public.rs_rpc('17 propriétaire d''une autre boutique : forbidden',            'authenticated', oa, sr, 'err forbidden');
  PERFORM public.rs_rpc('18 anon : refusé',                                             'anon', NULL, sa, 'err permission denied%');
END $$;

INSERT INTO public.rs_results (test, expected, observed, pass)
SELECT '19 is_shop_restricted : boutique inexistante = faux', 'false', public.is_shop_restricted(gen_random_uuid())::text, NOT public.is_shop_restricted(gen_random_uuid());
INSERT INTO public.rs_results (test, expected, observed, pass)
SELECT '20 EXECUTE is_shop_restricted anon = faux', 'false', has_function_privilege('anon','public.is_shop_restricted(uuid)','EXECUTE')::text,
       NOT has_function_privilege('anon','public.is_shop_restricted(uuid)','EXECUTE');
INSERT INTO public.rs_results (test, expected, observed, pass)
SELECT '21 EXECUTE get_shop_orders_secure authenticated = vrai, anon = faux', 'true/false',
       has_function_privilege('authenticated','public.get_shop_orders_secure(uuid)','EXECUTE')::text || '/' || has_function_privilege('anon','public.get_shop_orders_secure(uuid)','EXECUTE')::text,
       has_function_privilege('authenticated','public.get_shop_orders_secure(uuid)','EXECUTE') AND NOT has_function_privilege('anon','public.get_shop_orders_secure(uuid)','EXECUTE');

\pset format aligned
SELECT test, pass, observed FROM public.rs_results ORDER BY n;
SELECT count(*) FILTER (WHERE pass) AS reussis, count(*) FILTER (WHERE NOT pass) AS echecs FROM public.rs_results;
