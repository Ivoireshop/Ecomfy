-- H11 : supprime les URL/clés de projet Supabase codées en dur dans les triggers pg_net et le cron.
--
-- L'URL de base du projet est lue dans Vault (secret `supabase_project_url`), à définir UNE fois par projet :
--   select vault.create_secret('https://<project-ref>.supabase.co', 'supabase_project_url');
-- (prod : yfggrceynzcwklbxhgix, dev : xfpbpxncserliskrbaim). Sans ce secret, les appels sont ignorés.
-- `send-push-notification` a verify_jwt = false et ne contrôle pas l'appelant : aucune clé n'est nécessaire.
-- `app-health-monitor` a verify_jwt = false mais appelle isAuthorizedCron() : sans en-tête x-cron-secret
-- valide elle répond 401. Le secret est lu dans Vault (`cron_secret`, même valeur que le secret d'Edge
-- Function CRON_SECRET) et transmis seulement s'il existe :
--   select vault.create_secret('<valeur aléatoire>', 'cron_secret');
--   supabase secrets set CRON_SECRET=<même valeur> --project-ref <ref>

CREATE OR REPLACE FUNCTION public.invoke_edge_function(p_name text, p_body jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base text;
  v_cron text;
  v_headers jsonb := jsonb_build_object('Content-Type', 'application/json');
BEGIN
  SELECT decrypted_secret INTO v_base
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_project_url'
  LIMIT 1;

  IF v_base IS NULL OR v_base = '' THEN
    RAISE WARNING 'invoke_edge_function(%): secret Vault supabase_project_url manquant', p_name;
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_cron
  FROM vault.decrypted_secrets
  WHERE name = 'cron_secret'
  LIMIT 1;

  IF v_cron IS NOT NULL AND v_cron <> '' THEN
    v_headers := v_headers || jsonb_build_object('x-cron-secret', v_cron);
  END IF;

  PERFORM net.http_post(
    url := rtrim(v_base, '/') || '/functions/v1/' || p_name,
    headers := v_headers,
    body := p_body
  );
END;
$$;

-- Fonction interne : ne doit pas être appelable via l'API REST.
REVOKE ALL ON FUNCTION public.invoke_edge_function(text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_new_order_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.invoke_edge_function(
    'send-push-notification',
    jsonb_build_object(
      'order_id', NEW.id,
      'shop_id', NEW.shop_id,
      'customer_name', NEW.customer_name,
      'total', NEW.total,
      'order_number', NEW.order_number
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- Replanifie le monitoring de santé (l'ancien job avait l'URL de l'ancien projet figée dans sa commande).
DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'app-health-monitor';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
  PERFORM cron.schedule(
    'app-health-monitor',
    '*/5 * * * *',
    $cmd$SELECT public.invoke_edge_function('app-health-monitor');$cmd$
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
