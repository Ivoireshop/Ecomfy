-- Complément LECTURE SEULE du pré-contrôle (docs/DEPLOIEMENT-JEANMARC-VERS-MAIN-2026-10.md, section 4).
-- Un seul SELECT : coller en entier dans l'éditeur SQL de la PRODUCTION. Aucune valeur secrète n'est lue
-- (noms des secrets Vault seulement). Les tables absentes donnent « absente » au lieu d'une erreur.
WITH q(ordre, element, valeur) AS (
  SELECT 1, 'fonctions MANQUANTES parmi les 12 de la migration codes promo',
    COALESCE((SELECT string_agg(n, ', ') FROM unnest(ARRAY['create_public_order','guard_public_order_insert','enforce_order_item_price',
      'recompute_order_totals','is_shop_owner','is_shop_owner_or_collaborator','is_shop_publicly_visible','check_rate_limit','has_role',
      'generate_order_number','validate_promo_code','increment_promo_usage']) AS n
      WHERE NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = n)), '(aucune)')
  UNION ALL SELECT 2, 'secrets Vault présents (noms seulement)',
    COALESCE((SELECT string_agg(name, ', ' ORDER BY name) FROM vault.secrets), '(aucun)')
  UNION ALL SELECT 3, 'tâches pg_cron existantes',
    COALESCE((SELECT string_agg(jobname || ' [' || schedule || ']', ' ; ' ORDER BY jobname) FROM cron.job), '(aucune)')
  UNION ALL SELECT 4, 'boutiques en retard de paiement',
    COALESCE((SELECT string_agg(s.id || ' | ' || COALESCE(s.business_name,'?') || ' | ' || s.shop_payment_status || ' | dû ' || COALESCE(s.commission_balance_due,0)
              || ' | éch1 ' || COALESCE(x.j->>'first_deadline_at','-') || ' | éch2 ' || COALESCE(x.j->>'second_deadline_at','-'), E'\n')
      FROM public.shops s, LATERAL (SELECT to_jsonb(s) AS j) x
      WHERE COALESCE(s.commission_balance_due,0) > 0
        AND ((s.shop_payment_status = 'payment_pending' AND (x.j->>'first_deadline_at')::timestamptz < now())
          OR (s.shop_payment_status = 'locked' AND (x.j->>'second_deadline_at')::timestamptz < now()
              AND NOT (COALESCE((x.j->>'extra_deadline_active')::boolean,false) AND (x.j->>'extra_deadline_ends_at')::timestamptz > now()))) ), '(aucune)')
  UNION ALL SELECT 5, 'Ecomfy Pay : lignes wallets / wallet_ledger / ecomfy_payments / settlements / withdrawal_requests / merchant_kyc / ecomfy_payment_links',
    (SELECT string_agg(t || '=' || CASE WHEN to_regclass('public.' || t) IS NULL THEN 'absente'
              ELSE (xpath('/row/c/text()', query_to_xml('select count(*) c from public.' || t, false, true, '')))[1]::text END, ' ; ' ORDER BY t)
       FROM unnest(ARRAY['wallets','wallet_ledger','ecomfy_payments','settlements','withdrawal_requests','merchant_kyc','ecomfy_payment_links','payment_events']) t)
  UNION ALL SELECT 6, 'Ecomfy Pay : paiements par statut',
    CASE WHEN to_regclass('public.ecomfy_payments') IS NULL THEN 'absente'
         ELSE COALESCE((xpath('/row/c/text()', query_to_xml('select string_agg(status || '':'' || n, '', '') c from (select status, count(*) n from public.ecomfy_payments group by 1) z', false, true, '')))[1]::text, '(aucun)') END
  UNION ALL SELECT 7, 'Ecomfy Pay : retraits ouverts (withdrawals_enabled)',
    CASE WHEN to_regclass('public.ecomfy_pay_settings') IS NULL THEN 'table ecomfy_pay_settings absente'
         ELSE COALESCE((xpath('/row/c/text()', query_to_xml('select value::text c from public.ecomfy_pay_settings where key = ''withdrawals_enabled''', false, true, '')))[1]::text, '(clé absente)') END
  UNION ALL SELECT 8, 'Ecomfy Pay : dossiers KYC par statut',
    CASE WHEN to_regclass('public.merchant_kyc') IS NULL THEN 'absente'
         ELSE COALESCE((xpath('/row/c/text()', query_to_xml('select string_agg(verification_status || '':'' || n, '', '') c from (select verification_status, count(*) n from public.merchant_kyc group by 1) z', false, true, '')))[1]::text, '(aucun)') END
  UNION ALL SELECT 9, 'Ecomfy Pay : encaissés sans règlement / commandes PAID en majuscules (guide ledger §10.1, 0 et 0 attendus)',
    CASE WHEN to_regclass('public.ecomfy_payments') IS NULL OR to_regclass('public.settlements') IS NULL THEN 'absente'
         ELSE (xpath('/row/c/text()', query_to_xml('select (count(*) filter (where p.status=''SUCCEEDED'' and s.id is null))::text || '' / '' || (count(*) filter (where o.payment_status = ''PAID''))::text c from public.ecomfy_payments p left join public.settlements s on s.payment_id = p.id left join public.orders o on o.id = p.order_id', false, true, '')))[1]::text END
  UNION ALL SELECT 10, 'colonne ecomfy_payments.order_id et settlements.payment_id présentes',
    ((SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='ecomfy_payments' AND column_name='order_id')
     + (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='settlements' AND column_name='payment_id'))::text || ' sur 2'
)
SELECT ordre, element, valeur FROM q ORDER BY ordre;
