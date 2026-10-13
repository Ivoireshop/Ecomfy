-- ============================================================================
-- Déploiement DEV (étape 1/2) : correctifs C2 et C3
-- Fichier généré à partir de :
--   20261012130000_c2_reserve_billing_rpc_to_service_role.sql
--   20261012140000_reserve_shop_activation_rpc_to_service_role.sql
--   20261012150000_reserve_server_only_rpc_to_service_role.sql
--   get_shop_orders_secure de 20260909100000_ecomfy_billing_threshold_system.sql (seule la fonction :
--   le reste de cette migration, dont confirm_invoice_payment (C4), n'est PAS déployé)
-- Prérequis : le hotfix 20261012120000 est déjà appliqué (vérifié sur dev le 12/10/2026).
-- Idempotent. À lancer en UNE SEULE fois : dans l'éditeur SQL de Supabase, un script collé en entier
-- s'exécute dans une seule transaction (tout ou rien) ; avec psql, utiliser --single-transaction.
-- Ordre : déployer d'abord les Edge Functions founder-* (voir docs/DEPLOIEMENT-DEV-2026-10.md).
-- ============================================================================

-- ---------- C2 (a) : 20261012130000 ----------
-- Audit C2 : les fonctions de facturation ne sont exécutables que par service_role.
-- Idempotent, appliquable seul sur la production (confirm_invoice_payment peut ne pas y exister).
--
-- Les appelants légitimes passent désormais par une edge function :
--   * webhooks / verify-payment / reconcile-pending-payments : clé service_role
--   * écrans fondateur (paiement manuel) : edge function founder-record-commission-payment,
--     qui vérifie le rôle founder / co_founder puis appelle la RPC avec service_role.
-- Un utilisateur connecté, fondateur compris, ne peut donc plus appeler ces RPC directement.

REVOKE ALL ON FUNCTION public.apply_commission_payment(uuid, numeric, text, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_commission_payment(uuid, numeric, text, uuid, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.apply_shop_subscription(uuid, uuid, text, numeric, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_shop_subscription(uuid, uuid, text, numeric, text, text)
  TO service_role;

-- confirm_invoice_payment (migration 20260909100000, pas encore déployée en production)
DO $$
BEGIN
  IF to_regprocedure('public.confirm_invoice_payment(uuid, uuid, text, text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.confirm_invoice_payment(uuid, uuid, text, text)
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.confirm_invoice_payment(uuid, uuid, text, text)
      TO service_role;
  END IF;
END $$;

-- ---------- C2 (b) : 20261012140000 ----------
-- Audit C2 (suite) : apply_shop_activation et prepare_shop_activation_payment ne sont exécutables
-- que par service_role.
--
-- Les migrations d'origine (20260516133834, 20260516161922) font seulement
-- REVOKE ... FROM PUBLIC. Sur Supabase, anon et authenticated reçoivent EXECUTE directement
-- (privilèges par défaut du schéma public) : ce REVOKE ne les retire pas.
-- Appelants légitimes : edge functions (service_role). L'activation manuelle d'un fondateur passe
-- par l'edge function founder-activate-shop.
-- Idempotent ; chaque fonction est protégée par to_regprocedure.

DO $$
BEGIN
  IF to_regprocedure('public.apply_shop_activation(uuid, uuid, numeric, text, text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.apply_shop_activation(uuid, uuid, numeric, text, text)
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.apply_shop_activation(uuid, uuid, numeric, text, text)
      TO service_role;
  END IF;

  IF to_regprocedure('public.prepare_shop_activation_payment(uuid, uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.prepare_shop_activation_payment(uuid, uuid)
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.prepare_shop_activation_payment(uuid, uuid)
      TO service_role;
  END IF;
END $$;

-- ---------- C2 (c) : 20261012150000 ----------
-- Audit C2 (suite) : fonctions SECURITY DEFINER réservées au serveur, restées exécutables par
-- anon / authenticated.
--
-- Les migrations d'origine font REVOKE ... FROM PUBLIC seulement. Sur Supabase, anon et authenticated
-- gardent EXECUTE (privilèges par défaut du schéma public). Ces fonctions n'ont aucun appelant
-- navigateur : elles sont appelées par des edge functions (client service_role), par pg_cron
-- (rôle postgres) ou ne sont pas appelées.
--   * files d'e-mails (read_email_batch, enqueue_email, delete_email, move_to_dlq) : lecture et
--     suppression des e-mails en attente par n'importe qui
--   * tâches de maintenance (cleanup_*, expire_*, enforce_shop_payment_state) : déclenchables à volonté
--   * quotas, incidents, codes promo (check_rate_limit, record_app_incident, increment_promo_usage) :
--     falsification du compteur de limitation, du journal d'incidents, de l'usage des codes
--   * file de génération IA (get_next_queue_item, count_processing_generations)
--
-- Toutes les surcharges de chaque nom sont traitées. Idempotent ; les fonctions absentes sont ignorées.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'read_email_batch', 'enqueue_email', 'delete_email', 'move_to_dlq',
        'cleanup_expired_trash', 'cleanup_old_generated_media', 'cleanup_old_image_cache',
        'expire_stale_pending_payments', 'expire_subscriptions', 'enforce_shop_payment_state',
        'check_rate_limit', 'record_app_incident', 'increment_promo_usage',
        'get_next_queue_item', 'count_processing_generations',
        'get_or_create_affiliate'
      ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- ---------- C3 : get_shop_orders_secure (contrôle de propriété) ----------
CREATE OR REPLACE FUNCTION public.get_shop_orders_secure(_shop_id uuid)
RETURNS TABLE (
  id uuid,
  order_number text,
  shop_id uuid,
  customer_name text,
  customer_phone text,
  customer_email text,
  customer_address text,
  customer_city text,
  customer_country text,
  subtotal numeric,
  total numeric,
  commission_amount numeric,
  payment_method text,
  payment_status text,
  order_status text,
  products_summary text,
  received_during_lock boolean,
  is_read boolean,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  is_restricted boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status text;
  v_is_restricted boolean;
BEGIN
  -- Contrôle de propriété : propriétaire, collaborateur actif ou fondateur uniquement.
  -- On n'utilise pas can_manage_shop() : il exclut les boutiques restreintes, or ce sont
  -- justement elles qui doivent recevoir les données masquées.
  IF auth.uid() IS NULL
     OR NOT (
       public.is_shop_owner(_shop_id, auth.uid())
       OR public.is_shop_collaborator(_shop_id, auth.uid())
       OR public.has_role(auth.uid(), 'founder')
       OR public.has_role(auth.uid(), 'co_founder')
     )
  THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- Determine shop status
  SELECT shop_payment_status INTO v_status
    FROM public.shops
   WHERE shops.id = _shop_id;

  v_is_restricted := v_status IN ('STORE_RESTRICTED', 'locked', 'PAYMENT_OVERDUE', 'final_suspension');

  IF v_is_restricted THEN
    -- Return MASKED customer data
    RETURN QUERY
    SELECT 
      o.id,
      o.order_number,
      o.shop_id,
      '••••••••'::text AS customer_name,
      '••••••••'::text AS customer_phone,
      '••••••••'::text AS customer_email,
      '••••••••'::text AS customer_address,
      '••••••••'::text AS customer_city,
      o.customer_country,
      o.subtotal,
      o.total,
      o.commission_amount,
      o.payment_method,
      o.payment_status,
      o.order_status,
      o.products_summary,
      o.received_during_lock,
      o.is_read,
      o.notes,
      o.created_at,
      o.updated_at,
      true AS is_restricted
    FROM public.orders o
   WHERE o.shop_id = _shop_id
   ORDER BY o.created_at DESC;
  ELSE
    -- Return UNMASKED customer data
    RETURN QUERY
    SELECT 
      o.id,
      o.order_number,
      o.shop_id,
      o.customer_name,
      o.customer_phone,
      o.customer_email,
      o.customer_address,
      o.customer_city,
      o.customer_country,
      o.subtotal,
      o.total,
      o.commission_amount,
      o.payment_method,
      o.payment_status,
      o.order_status,
      o.products_summary,
      o.received_during_lock,
      o.is_read,
      o.notes,
      o.created_at,
      o.updated_at,
      false AS is_restricted
    FROM public.orders o
   WHERE o.shop_id = _shop_id
   ORDER BY o.created_at DESC;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_shop_orders_secure(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shop_orders_secure(uuid) TO authenticated;
