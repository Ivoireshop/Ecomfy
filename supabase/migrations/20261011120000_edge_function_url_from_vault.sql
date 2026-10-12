-- H11 : supprime les URL/clés de projet Supabase codées en dur dans les triggers pg_net et le cron.
--
-- L'URL de base du projet est lue dans Vault (secret `supabase_project_url`), à définir UNE fois par projet :
--   select vault.create_secret('https://<project-ref>.supabase.co', 'supabase_project_url');
-- (prod : yfggrceynzcwklbxhgix, dev : xfpbpxncserliskrbaim). Sans ce secret, les appels sont ignorés.
-- Les fonctions `send-push-notification` et `app-health-monitor` ont verify_jwt = false : aucune clé n'est transmise.

CREATE OR REPLACE FUNCTION public.invoke_edge_function(p_name text, p_body jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base text;
BEGIN
  SELECT decrypted_secret INTO v_base
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_project_url'
  LIMIT 1;

  IF v_base IS NULL OR v_base = '' THEN
    RAISE WARNING 'invoke_edge_function(%): secret Vault supabase_project_url manquant', p_name;
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := rtrim(v_base, '/') || '/functions/v1/' || p_name,
    headers := jsonb_build_object('Content-Type', 'application/json'),
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
