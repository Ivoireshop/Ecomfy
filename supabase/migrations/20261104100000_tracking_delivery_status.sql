-- ========================================================
-- SUIVI DE SANTÉ DES ENVOIS PUBLICITAIRES (Meta CAPI, TikTok, Snapchat, GA4)
-- ========================================================
-- Avant : track-conversion ne gardait que le code HTTP et le jetait. Un jeton Meta expiré ou un pixel refusé
-- ne se voyait que dans le Gestionnaire d'événements de Meta.
-- Maintenant : une ligne par boutique / plateforme / pixel, mise à jour à chaque envoi, lisible par le propriétaire.
-- Écriture réservée au serveur (fonction record_tracking_delivery, service_role).
--
-- Rejouable : peut être appliqué plusieurs fois.

CREATE TABLE IF NOT EXISTS public.tracking_delivery_status (
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('meta', 'tiktok', 'snapchat', 'ga4')),
  pixel_id text NOT NULL,
  last_ok boolean NOT NULL,
  last_http_status integer,
  last_event text,
  last_error text,
  last_error_code text,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_id, provider, pixel_id)
);

ALTER TABLE public.tracking_delivery_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop owners can view their tracking delivery status" ON public.tracking_delivery_status;
CREATE POLICY "Shop owners can view their tracking delivery status"
  ON public.tracking_delivery_status FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = tracking_delivery_status.shop_id AND s.user_id = auth.uid()));

-- Lecture seule pour les utilisateurs connectés ; aucune écriture directe.
REVOKE ALL ON public.tracking_delivery_status FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tracking_delivery_status TO authenticated;

CREATE OR REPLACE FUNCTION public.record_tracking_delivery(
  p_shop_id uuid,
  p_provider text,
  p_pixel_id text,
  p_ok boolean,
  p_http_status integer DEFAULT NULL,
  p_error text DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_event text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_provider NOT IN ('meta', 'tiktok', 'snapchat', 'ga4') OR p_pixel_id IS NULL OR length(p_pixel_id) > 64 THEN
    RETURN;
  END IF;

  IF p_ok THEN
    -- Une écriture par minute au plus tant que tout va bien (évite une mise à jour par PageView) ;
    -- le retour au vert après une panne est toujours enregistré.
    INSERT INTO public.tracking_delivery_status AS t
      (shop_id, provider, pixel_id, last_ok, last_http_status, last_event, last_success_at, consecutive_failures, updated_at)
    VALUES
      (p_shop_id, p_provider, p_pixel_id, true, p_http_status, p_event, now(), 0, now())
    ON CONFLICT (shop_id, provider, pixel_id) DO UPDATE
      SET last_ok = true,
          last_http_status = EXCLUDED.last_http_status,
          last_event = EXCLUDED.last_event,
          last_success_at = now(),
          consecutive_failures = 0,
          updated_at = now()
      WHERE t.last_ok = false OR t.last_success_at IS NULL OR t.last_success_at < now() - interval '1 minute';
  ELSE
    INSERT INTO public.tracking_delivery_status AS t
      (shop_id, provider, pixel_id, last_ok, last_http_status, last_event, last_error, last_error_code, last_failure_at, consecutive_failures, updated_at)
    VALUES
      (p_shop_id, p_provider, p_pixel_id, false, p_http_status, p_event, left(p_error, 500), left(p_error_code, 40), now(), 1, now())
    ON CONFLICT (shop_id, provider, pixel_id) DO UPDATE
      SET last_ok = false,
          last_http_status = EXCLUDED.last_http_status,
          last_event = EXCLUDED.last_event,
          last_error = EXCLUDED.last_error,
          last_error_code = EXCLUDED.last_error_code,
          last_failure_at = now(),
          consecutive_failures = t.consecutive_failures + 1,
          updated_at = now();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_tracking_delivery(uuid, text, text, boolean, integer, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_tracking_delivery(uuid, text, text, boolean, integer, text, text, text) TO service_role;
