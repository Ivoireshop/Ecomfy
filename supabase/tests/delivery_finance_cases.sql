-- Cas de test de 20261121110000_delivery_finance.sql : gestion financière de l'administration (§11.3).
--
-- À jouer APRÈS delivery_premium_cases.sql (mêmes utilisateurs d1..d5, structures dA/dB/dG/dP/dD, aides t_*, résultats
-- cumulés t_res), sur la même base JETABLE, avec 20261121110000 jouée juste avant ce fichier.
-- Les paiements laissés par les tests précédents sont effacés : les chiffres attendus viennent des seules lignes ci-dessous.
\set ON_ERROR_STOP on

DELETE FROM public.delivery_company_payments;

-- dA : cotisation ancienne (échue), cotisation renouvelée (valable 20 jours), caution restituée, un Premium rejeté.
INSERT INTO public.delivery_company_payments (company_id, kind, amount, currency, method, status, source, period_start, period_end, decided_at, created_at)
SELECT v, 'membership', 15000, 'XOF', 'Wave', 'confirmed', 'declared', now() - interval '70 days', now() - interval '40 days', now() - interval '70 days', now() - interval '71 days' FROM t_ids WHERE k = 'dA';
INSERT INTO public.delivery_company_payments (company_id, kind, amount, currency, method, status, source, period_start, period_end, decided_at, created_at)
SELECT v, 'membership', 15000, 'XOF', 'Wave', 'confirmed', 'declared', now() - interval '5 days', now() + interval '20 days', now() - interval '5 days', now() - interval '6 days' FROM t_ids WHERE k = 'dA';
INSERT INTO public.delivery_company_payments (company_id, kind, amount, currency, method, status, source, decided_at, refunded_at, created_at)
SELECT v, 'deposit', 50000, 'XOF', 'Espèces', 'refunded', 'admin', now() - interval '70 days', now() - interval '2 days', now() - interval '71 days' FROM t_ids WHERE k = 'dA';
INSERT INTO public.delivery_company_payments (company_id, kind, amount, currency, method, status, source, plan_code, plan_label, period_months, decided_at, created_at)
SELECT v, 'premium', 3250, 'XOF', 'Wave', 'rejected', 'declared', 'monthly', 'Premium mensuel', 1, now() - interval '9 days', now() - interval '10 days' FROM t_ids WHERE k = 'dA';

-- dB : caution détenue, deux Premium confirmés (le second est un renouvellement, en cours), cotisation et Premium USD en attente.
INSERT INTO public.delivery_company_payments (company_id, kind, amount, currency, method, status, source, decided_at, created_at)
SELECT v, 'deposit', 50000, 'XOF', 'Wave', 'confirmed', 'declared', now() - interval '3 days', now() - interval '4 days' FROM t_ids WHERE k = 'dB';
INSERT INTO public.delivery_company_payments (company_id, kind, amount, currency, method, status, source, plan_code, plan_label, period_months, period_start, period_end, decided_at, created_at)
SELECT v, 'premium', 3250, 'XOF', 'Wave', 'confirmed', 'declared', 'monthly', 'Premium mensuel', 1, now() - interval '60 days', now() - interval '30 days', now() - interval '60 days', now() - interval '61 days' FROM t_ids WHERE k = 'dB';
INSERT INTO public.delivery_company_payments (company_id, kind, amount, currency, method, status, source, plan_code, plan_label, period_months, period_start, period_end, decided_at, created_at)
SELECT v, 'premium', 3250, 'XOF', 'Wave', 'confirmed', 'declared', 'monthly', 'Premium mensuel', 1, now() - interval '3 days', now() + interval '27 days', now() - interval '3 days', now() - interval '4 days' FROM t_ids WHERE k = 'dB';
INSERT INTO public.delivery_company_payments (company_id, kind, amount, currency, method, status, source, created_at)
SELECT v, 'membership', 15000, 'XOF', 'Wave', 'pending', 'declared', now() - interval '1 day' FROM t_ids WHERE k = 'dB';
INSERT INTO public.delivery_company_payments (company_id, kind, amount, currency, method, status, source, plan_code, plan_label, period_months, created_at)
SELECT v, 'premium', 5, 'USD', 'Virement', 'pending', 'declared', 'usd', 'Premium USD', 1, now() - interval '1 day' FROM t_ids WHERE k = 'dB';

-- ===============================================================================================================
-- Droits
-- ===============================================================================================================
SELECT t_run('G01 propriétaire : le résumé financier est refusé', :d1, $$SELECT public.delivery_admin_finance_summary()$$, 'err:42501:%');
SELECT t_run('G02 anonyme : refusé', NULL, $$SELECT public.delivery_admin_finance_summary()$$, 'err:42501:%', 'anon');
SELECT t_run('G03 tiers sans structure : refusé', :s, $$SELECT public.delivery_admin_finance_summary()$$, 'err:42501:%');
SELECT t_run('G04 propriétaire : l''historique d''une structure est refusé (même la sienne)', :d1, $$SELECT public.delivery_admin_company_finance((SELECT v FROM t_ids WHERE k = 'dA'))$$, 'err:42501:%');
SELECT t_run('G05 anonyme : historique refusé', NULL, $$SELECT public.delivery_admin_company_finance((SELECT v FROM t_ids WHERE k = 'dA'))$$, 'err:42501:%', 'anon');
SELECT t_run('G06 admin : structure inconnue', :a, $$SELECT public.delivery_admin_company_finance('00000000-0000-0000-0000-0000000000ff')$$, 'err:P0002:%');
SELECT t_run('G07 admin : période inversée refusée', :a, $$SELECT public.delivery_admin_finance_summary(now(), now() - interval '1 day')$$, 'err:22023:%');

-- ===============================================================================================================
-- Résumé sur toute la période
-- ===============================================================================================================
SELECT t_val('G10 encaissé : cotisations 30000 XOF (2)', :a,
  $$SELECT (SELECT e->>'amount' || '/' || (e->>'count') FROM jsonb_array_elements((public.delivery_admin_finance_summary())->'collected') e WHERE e->>'kind' = 'membership' AND e->>'currency' = 'XOF')$$, '30000/2');
SELECT t_val('G11 encaissé : cautions 100000 XOF (2, restituée comprise)', :a,
  $$SELECT (SELECT e->>'amount' || '/' || (e->>'count') FROM jsonb_array_elements((public.delivery_admin_finance_summary())->'collected') e WHERE e->>'kind' = 'deposit' AND e->>'currency' = 'XOF')$$, '100000/2');
SELECT t_val('G12 encaissé : Premium 6500 XOF (2) — le rejeté et les attentes ne comptent pas', :a,
  $$SELECT (SELECT e->>'amount' || '/' || (e->>'count') FROM jsonb_array_elements((public.delivery_admin_finance_summary())->'collected') e WHERE e->>'kind' = 'premium' AND e->>'currency' = 'XOF')$$, '6500/2');
SELECT t_val('G13 encaissé : aucune ligne en USD (rien de confirmé dans cette devise)', :a,
  $$SELECT count(*)::text FROM jsonb_array_elements((public.delivery_admin_finance_summary())->'collected') e WHERE e->>'currency' = 'USD'$$, '0');
SELECT t_val('G14 renouvellements : cotisation 15000 (1), Premium 3250 (1)', :a,
  $$SELECT string_agg(e->>'kind' || '=' || (e->>'amount') || '/' || (e->>'count'), ',' ORDER BY e->>'kind') FROM jsonb_array_elements((public.delivery_admin_finance_summary())->'renewals') e$$, 'membership=15000/1,premium=3250/1');
SELECT t_val('G15 restitué : 50000 XOF (1)', :a,
  $$SELECT (public.delivery_admin_finance_summary())->'refunded'->0->>'amount' || '/' || ((public.delivery_admin_finance_summary())->'refunded'->0->>'count')$$, '50000/1');
SELECT t_val('G16 caution détenue : 50000 XOF (1) — la restituée n''y est plus', :a,
  $$SELECT (public.delivery_admin_finance_summary())->'deposits_held'->0->>'amount' || '/' || ((public.delivery_admin_finance_summary())->'deposits_held'->0->>'count')$$, '50000/1');
SELECT t_val('G17 en attente : cotisation 15000 XOF et Premium 5 USD, chacun séparé par devise', :a,
  $$SELECT string_agg(e->>'kind' || '=' || (e->>'amount') || ' ' || (e->>'currency'), ',' ORDER BY e->>'kind') FROM jsonb_array_elements((public.delivery_admin_finance_summary())->'pending') e$$, 'membership=15000 XOF,premium=5 USD');
SELECT t_val('G18 Premium actifs : 1', :a, $$SELECT (public.delivery_admin_finance_summary())->>'premium_active'$$, '1');
SELECT t_val('G19 Premium arrivant à échéance sous 30 jours : 1', :a, $$SELECT (public.delivery_admin_finance_summary())->>'premium_expiring_30d'$$, '1');
SELECT t_val('G20 cotisations arrivant à échéance sous 30 jours : 1 (dA ; l''échue ne compte pas)', :a, $$SELECT (public.delivery_admin_finance_summary())->>'membership_expiring_30d'$$, '1');

-- ===============================================================================================================
-- Période
-- ===============================================================================================================
SELECT t_val('G30 7 derniers jours : cotisation 15000 (1)', :a,
  $$SELECT (SELECT e->>'amount' || '/' || (e->>'count') FROM jsonb_array_elements((public.delivery_admin_finance_summary(now() - interval '7 days')) ->'collected') e WHERE e->>'kind' = 'membership')$$, '15000/1');
SELECT t_val('G31 7 derniers jours : caution 50000 (1, celle de dB), Premium 3250 (1)', :a,
  $$SELECT string_agg(e->>'kind' || '=' || (e->>'amount') || '/' || (e->>'count'), ',' ORDER BY e->>'kind') FROM jsonb_array_elements((public.delivery_admin_finance_summary(now() - interval '7 days'))->'collected') e WHERE e->>'kind' <> 'membership'$$, 'deposit=50000/1,premium=3250/1');
SELECT t_val('G32 7 derniers jours : restitution comptée (faite il y a 2 jours)', :a,
  $$SELECT (public.delivery_admin_finance_summary(now() - interval '7 days'))->'refunded'->0->>'amount'$$, '50000');
SELECT t_val('G33 1 jour : aucun encaissement, aucune restitution', :a,
  $$SELECT jsonb_array_length((public.delivery_admin_finance_summary(now() - interval '1 day'))->'collected')::text || '/' || jsonb_array_length((public.delivery_admin_finance_summary(now() - interval '1 day'))->'refunded')::text$$, '0/0');
SELECT t_val('G34 renouvellement hors période : celui de dB (Premium, il y a 3 jours) compte sur 7 jours, pas sur 1 jour', :a,
  $$SELECT jsonb_array_length((public.delivery_admin_finance_summary(now() - interval '7 days'))->'renewals')::text || '/' || jsonb_array_length((public.delivery_admin_finance_summary(now() - interval '1 day'))->'renewals')::text$$, '2/0');
SELECT t_val('G35 la caution détenue et les attentes ne dépendent pas de la période', :a,
  $$SELECT jsonb_array_length((public.delivery_admin_finance_summary(now() - interval '1 day'))->'deposits_held')::text || '/' || jsonb_array_length((public.delivery_admin_finance_summary(now() - interval '1 day'))->'pending')::text$$, '1/2');

-- ===============================================================================================================
-- Par structure
-- ===============================================================================================================
SELECT t_val('G40 dA (XOF) : cotisations 30000, caution restituée 50000, aucune caution détenue, rien en attente', :a,
  $$SELECT (e->>'membership') || '/' || (e->>'deposit_refunded') || '/' || (e->>'deposit_held') || '/' || (e->>'pending')
      FROM jsonb_array_elements((public.delivery_admin_finance_summary())->'by_company') e WHERE e->>'company_name' = 'Dir Alpha' AND e->>'currency' = 'XOF'$$, '30000/50000/0/0');
SELECT t_val('G41 dB (XOF) : Premium 6500, caution détenue 50000, en attente 15000', :a,
  $$SELECT (e->>'premium') || '/' || (e->>'deposit_held') || '/' || (e->>'pending')
      FROM jsonb_array_elements((public.delivery_admin_finance_summary())->'by_company') e WHERE e->>'company_name' = 'Dir Beta' AND e->>'currency' = 'XOF'$$, '6500/50000/15000');
SELECT t_val('G42 dB (USD) : seulement 5 en attente', :a,
  $$SELECT (e->>'premium') || '/' || (e->>'pending')
      FROM jsonb_array_elements((public.delivery_admin_finance_summary())->'by_company') e WHERE e->>'company_name' = 'Dir Beta' AND e->>'currency' = 'USD'$$, '0/5');
SELECT t_val('G43 le livreur indépendant sans paiement n''apparaît pas', :a,
  $$SELECT count(*)::text FROM jsonb_array_elements((public.delivery_admin_finance_summary())->'by_company') e WHERE e->>'company_name' = 'Dir Gamma'$$, '0');

-- ===============================================================================================================
-- Historique d'une structure
-- ===============================================================================================================
SELECT t_val('G50 historique de dA : 4 lignes (rejetée comprise), de la plus récente à la plus ancienne', :a,
  $$SELECT jsonb_array_length((public.delivery_admin_company_finance((SELECT v FROM t_ids WHERE k = 'dA')))->'payments')::text$$, '4');
SELECT t_val('G51 historique de dA : la plus récente (par création) est la cotisation renouvelée', :a,
  $$SELECT (public.delivery_admin_company_finance((SELECT v FROM t_ids WHERE k = 'dA')))->'payments'->0->>'kind' || '/' || ((public.delivery_admin_company_finance((SELECT v FROM t_ids WHERE k = 'dA')))->'payments'->0->>'status')$$, 'membership/confirmed');
SELECT t_val('G52 totaux de dA : le rejeté n''y est pas (cotisations 30000, caution 50000)', :a,
  $$SELECT string_agg(e->>'kind' || '=' || (e->>'amount'), ',' ORDER BY e->>'kind') FROM jsonb_array_elements((public.delivery_admin_company_finance((SELECT v FROM t_ids WHERE k = 'dA')))->'totals') e$$, 'deposit=50000,membership=30000');
SELECT t_val('G53 historique de dB : 5 lignes', :a,
  $$SELECT jsonb_array_length((public.delivery_admin_company_finance((SELECT v FROM t_ids WHERE k = 'dB')))->'payments')::text$$, '5');
SELECT t_val('G54 historique de dB : état Premium actif et formule', :a,
  $$SELECT (public.delivery_admin_company_finance((SELECT v FROM t_ids WHERE k = 'dB')))->'premium'->>'active' || '/' || ((public.delivery_admin_company_finance((SELECT v FROM t_ids WHERE k = 'dB')))->'premium'->>'plan_code')$$, 'true/monthly');
SELECT t_val('G55 livreur indépendant : historique vide, pas d''état de cotisation', :a,
  $$SELECT jsonb_array_length((public.delivery_admin_company_finance((SELECT v FROM t_ids WHERE k = 'dG')))->'payments')::text || '/' || ((public.delivery_admin_company_finance((SELECT v FROM t_ids WHERE k = 'dG')))->'fees' = 'null'::jsonb)::text$$, '0/true');

-- ===============================================================================================================
-- Lecture seule et droits d'exécution
-- ===============================================================================================================
SELECT t_admin('G60 la lecture ne modifie rien', $$SELECT count(*)::text FROM public.delivery_company_payments$$, '9');
SELECT t_admin('G61 droits d''exécution',
  $$SELECT (NOT has_function_privilege('anon', 'public.delivery_admin_finance_summary(timestamptz,timestamptz)', 'EXECUTE')
        AND NOT has_function_privilege('anon', 'public.delivery_admin_company_finance(uuid)', 'EXECUTE'))::text$$, 'true');

-- ===============================================================================================================
-- Bilan
-- ===============================================================================================================
SELECT n, CASE WHEN pass THEN 'OK  ' ELSE 'FAIL' END AS r, test, CASE WHEN pass THEN '' ELSE 'attendu: ' || expected || ' | observé: ' || observed END AS detail
  FROM t_res WHERE NOT pass ORDER BY n;
SELECT count(*) FILTER (WHERE pass) AS reussis, count(*) FILTER (WHERE NOT pass) AS echecs, count(*) AS total FROM t_res;
