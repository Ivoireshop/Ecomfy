-- Livraison réseau — canal e-mail des notifications (cahier §12 : « architecture permettant l'ajout de notifications par
-- e-mail ou d'autres canaux »).
--
-- Principe : les notifications restent écrites UNE fois dans `delivery_notifications` (source de vérité, consultable dans
-- l'application). Chaque nouvelle notification crée une ligne dans une file d'envoi par canal (`delivery_notification_outbox`).
-- Un envoyeur (Edge Function planifiée) réserve les lignes en attente, envoie, puis les marque. Un nouveau canal (SMS,
-- WhatsApp…) = une valeur de plus dans `channel` et un autre envoyeur ; aucune règle métier n'est à toucher.
--
--  * L'utilisateur peut couper l'e-mail (préférence `delivery_notification_prefs`, activé par défaut). L'application reste inchangée.
--  * Une écriture de notification ne peut jamais échouer à cause de la file (le déclencheur avale ses erreurs).
--  * Reprises : 3 essais ; une réservation restée plus de 10 minutes sans réponse est reprise ; passé 48 h, l'envoi est abandonné
--    (un e-mail de plusieurs jours n'a plus d'intérêt). Les lignes envoyées ou abandonnées sont purgées après 90 jours.
--  * Aucune table n'est lisible ni modifiable par l'API : tout passe par des fonctions réservées au service ou à l'utilisateur lui-même.
--
-- Prérequis : 20261106110000 (notifications). Planification : invoke_edge_function (20261011120000) et secrets Vault
-- `supabase_project_url` / `cron_secret` (voir docs/DEPLOIEMENT-LIVRAISON-EMAIL-2026-11.md).

CREATE TABLE IF NOT EXISTS public.delivery_notification_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.delivery_notification_prefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_notification_prefs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.delivery_notification_prefs TO service_role;

CREATE TABLE IF NOT EXISTS public.delivery_notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.delivery_notifications(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'skipped', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notification_id, channel)
);
CREATE INDEX IF NOT EXISTS idx_delivery_outbox_todo ON public.delivery_notification_outbox (created_at)
  WHERE status IN ('pending', 'sending');
ALTER TABLE public.delivery_notification_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.delivery_notification_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.delivery_notification_outbox TO service_role;

-- Chaque notification crée sa ligne d'envoi e-mail, sauf si son destinataire a coupé l'e-mail.
CREATE OR REPLACE FUNCTION public.delivery_outbox_enqueue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE((SELECT p.email_enabled FROM public.delivery_notification_prefs p WHERE p.user_id = NEW.user_id), true) THEN
    INSERT INTO public.delivery_notification_outbox (notification_id, channel) VALUES (NEW.id, 'email')
    ON CONFLICT (notification_id, channel) DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'delivery_outbox_enqueue: %', SQLERRM;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_outbox_enqueue() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_delivery_outbox_enqueue ON public.delivery_notifications;
CREATE TRIGGER trg_delivery_outbox_enqueue
  AFTER INSERT ON public.delivery_notifications
  FOR EACH ROW EXECUTE FUNCTION public.delivery_outbox_enqueue();

-- Préférence de l'utilisateur connecté.
CREATE OR REPLACE FUNCTION public.delivery_get_email_pref()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501'; END IF;
  RETURN COALESCE((SELECT p.email_enabled FROM public.delivery_notification_prefs p WHERE p.user_id = auth.uid()), true);
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_get_email_pref() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_get_email_pref() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delivery_set_email_pref(_enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise.' USING ERRCODE = '42501'; END IF;
  IF _enabled IS NULL THEN RAISE EXCEPTION 'Valeur manquante.' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.delivery_notification_prefs (user_id, email_enabled, updated_at)
  VALUES (auth.uid(), _enabled, now())
  ON CONFLICT (user_id) DO UPDATE SET email_enabled = EXCLUDED.email_enabled, updated_at = now();
  -- Couper l'e-mail annule aussi ce qui n'est pas encore parti.
  IF NOT _enabled THEN
    UPDATE public.delivery_notification_outbox o
       SET status = 'skipped', last_error = 'e-mail désactivé par l''utilisateur'
      FROM public.delivery_notifications n
     WHERE o.notification_id = n.id AND n.user_id = auth.uid() AND o.status IN ('pending', 'sending');
  END IF;
  RETURN _enabled;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_set_email_pref(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delivery_set_email_pref(boolean) TO authenticated, service_role;

-- Réservation des envois à faire (service seulement). Retourne l'adresse du destinataire et le contenu.
CREATE OR REPLACE FUNCTION public.delivery_email_claim(_limit integer DEFAULT 50)
RETURNS TABLE (id uuid, email text, kind text, tone text, title text, body text, link text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Abandon des envois trop anciens et purge de l'historique.
  UPDATE public.delivery_notification_outbox o
     SET status = 'skipped', last_error = 'expiré (plus de 48 h)'
   WHERE o.status IN ('pending', 'sending') AND o.created_at < now() - interval '48 hours';
  UPDATE public.delivery_notification_outbox o
     SET status = 'failed', last_error = COALESCE(o.last_error, 'sans réponse après 3 essais')
   WHERE o.status = 'sending' AND o.attempts >= 3 AND o.claimed_at < now() - interval '10 minutes';
  DELETE FROM public.delivery_notification_outbox o
   WHERE o.status IN ('sent', 'skipped', 'failed') AND o.created_at < now() - interval '90 days';

  RETURN QUERY
  WITH todo AS (
    SELECT o.id
      FROM public.delivery_notification_outbox o
     WHERE o.attempts < 3
       AND (o.status = 'pending' OR (o.status = 'sending' AND o.claimed_at < now() - interval '10 minutes'))
     ORDER BY o.created_at
     LIMIT GREATEST(1, LEAST(COALESCE(_limit, 50), 200))
       FOR UPDATE SKIP LOCKED
  ), upd AS (
    UPDATE public.delivery_notification_outbox o
       SET status = 'sending', attempts = o.attempts + 1, claimed_at = now()
      FROM todo WHERE o.id = todo.id
    RETURNING o.id, o.notification_id
  )
  SELECT upd.id, u.email::text, n.kind, n.tone, n.title, n.body, n.link, n.created_at
    FROM upd
    JOIN public.delivery_notifications n ON n.id = upd.notification_id
    LEFT JOIN auth.users u ON u.id = n.user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_email_claim(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_email_claim(integer) TO service_role;

-- Résultat d'un envoi : sent | skipped (adresse absente ou désinscrite) | retry (à reprendre) | failed (définitif).
CREATE OR REPLACE FUNCTION public.delivery_email_mark(_id uuid, _outcome text, _error text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _outcome NOT IN ('sent', 'skipped', 'retry', 'failed') THEN
    RAISE EXCEPTION 'Résultat inconnu : %.', _outcome USING ERRCODE = '22023';
  END IF;
  UPDATE public.delivery_notification_outbox o
     SET status = CASE _outcome
                    WHEN 'sent' THEN 'sent'
                    WHEN 'skipped' THEN 'skipped'
                    WHEN 'failed' THEN 'failed'
                    WHEN 'retry' THEN CASE WHEN o.attempts >= 3 THEN 'failed' ELSE 'pending' END
                  END,
         sent_at = CASE WHEN _outcome = 'sent' THEN now() ELSE o.sent_at END,
         last_error = left(_error, 500)
   WHERE o.id = _id AND o.status = 'sending';
END;
$$;
REVOKE ALL ON FUNCTION public.delivery_email_mark(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delivery_email_mark(uuid, text, text) TO service_role;

-- Planification : toutes les 2 minutes (l'envoyeur ne fait rien s'il n'y a rien à envoyer).
DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF to_regprocedure('public.invoke_edge_function(text,jsonb)') IS NULL THEN
    RAISE WARNING 'invoke_edge_function absente : appliquer d''abord 20261011120000_edge_function_url_from_vault.sql';
    RETURN;
  END IF;
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'delivery-notification-emails';
  IF v_job_id IS NOT NULL THEN PERFORM cron.unschedule(v_job_id); END IF;
  PERFORM cron.schedule('delivery-notification-emails', '*/2 * * * *',
    $cmd$ SELECT public.invoke_edge_function('send-delivery-notification-emails'); $cmd$);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'delivery-notification-emails non planifié : %', SQLERRM;
END $$;
