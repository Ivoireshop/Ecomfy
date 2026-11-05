-- ========================================================
-- PURCHASE PUBLICITAIRE FIABLE : un seul envoi par commande, reprise des échecs, retour de paiement
-- ========================================================
-- Avant : track-conversion envoyait tout ce qu'on lui donnait. Un même Purchase pouvait partir plusieurs fois
-- (identifiant d'événement choisi par le navigateur, nouvelle livraison du webhook), et un envoi raté
-- (Meta indisponible, jeton expiré) était perdu : rien ne le rejouait.
-- Maintenant :
--   * tracking_purchase_log : une ligne par commande, avec l'état de l'envoi et la liste des destinations déjà servies ;
--   * claim_purchase_send / finish_purchase_send : réservation atomique de l'envoi (deux appels simultanés ne partent pas deux fois) ;
--   * list_purchases_to_resend : paiements encaissés dont le Purchase n'est pas parti, pour le balayage ecomfy-pay-settlement ;
--   * get_payment_return_status : de quoi permettre à la page de retour de paiement d'envoyer le Purchase du navigateur
--     avec le même event_id que le serveur (déduplication Meta).
-- Écriture réservée au serveur (service_role). Rejouable : peut être appliqué plusieurs fois.

CREATE TABLE IF NOT EXISTS public.tracking_purchase_log (
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('sending', 'sent', 'failed', 'skipped')),
  -- destinations déjà servies (« meta:<pixel> », « tiktok:<pixel> », « snapchat:<pixel> », « ga4 ») : une reprise n'y renvoie rien.
  delivered text[] NOT NULL DEFAULT '{}',
  attempts integer NOT NULL DEFAULT 1,
  source text,
  last_error text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_id, order_id)
);

CREATE INDEX IF NOT EXISTS tracking_purchase_log_retry_idx
  ON public.tracking_purchase_log (status, claimed_at) WHERE status IN ('sending', 'failed');

ALTER TABLE public.tracking_purchase_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop owners can view their purchase tracking log" ON public.tracking_purchase_log;
CREATE POLICY "Shop owners can view their purchase tracking log"
  ON public.tracking_purchase_log FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shops s WHERE s.id = tracking_purchase_log.shop_id AND s.user_id = auth.uid()));

REVOKE ALL ON public.tracking_purchase_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tracking_purchase_log TO authenticated;

-- Réserve l'envoi du Purchase d'une commande.
-- claimed = true  : l'appelant envoie (première fois, reprise après échec, ou réservation précédente abandonnée depuis > 2 min).
-- claimed = false : déjà envoyé, ignoré, ou en cours chez un autre appel : l'appelant n'envoie rien.
CREATE OR REPLACE FUNCTION public.claim_purchase_send(
  p_shop_id uuid,
  p_order_id uuid,
  p_event_id text,
  p_source text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.tracking_purchase_log;
BEGIN
  INSERT INTO public.tracking_purchase_log AS t (shop_id, order_id, event_id, status, source)
  VALUES (p_shop_id, p_order_id, p_event_id, 'sending', left(p_source, 40))
  ON CONFLICT (shop_id, order_id) DO UPDATE
    SET status = 'sending',
        attempts = t.attempts + 1,
        claimed_at = now(),
        updated_at = now(),
        source = COALESCE(left(p_source, 40), t.source)
    WHERE t.status = 'failed'
       OR (t.status = 'sending' AND t.claimed_at < now() - interval '2 minutes')
  RETURNING t.* INTO v_row;

  IF FOUND THEN
    RETURN jsonb_build_object('claimed', true, 'delivered', to_jsonb(v_row.delivered), 'attempts', v_row.attempts);
  END IF;

  SELECT * INTO v_row FROM public.tracking_purchase_log WHERE shop_id = p_shop_id AND order_id = p_order_id;
  RETURN jsonb_build_object('claimed', false, 'status', v_row.status, 'attempts', v_row.attempts);
END;
$$;

-- Clôt une réservation : 'sent' (toutes les destinations servies), 'failed' (à reprendre), 'skipped' (aucune destination serveur).
CREATE OR REPLACE FUNCTION public.finish_purchase_send(
  p_shop_id uuid,
  p_order_id uuid,
  p_status text,
  p_delivered text[] DEFAULT '{}',
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('sent', 'failed', 'skipped') THEN
    RAISE EXCEPTION 'statut invalide : %', p_status;
  END IF;

  UPDATE public.tracking_purchase_log t
  SET status = p_status,
      delivered = COALESCE((SELECT array_agg(DISTINCT d) FROM unnest(t.delivered || COALESCE(p_delivered, '{}')) AS d), '{}'),
      last_error = CASE WHEN p_status = 'sent' THEN NULL ELSE left(p_error, 500) END,
      sent_at = CASE WHEN p_status = 'sent' THEN now() ELSE t.sent_at END,
      updated_at = now()
  WHERE t.shop_id = p_shop_id AND t.order_id = p_order_id AND t.status = 'sending';
END;
$$;

-- Paiements encaissés dont le Purchase n'est pas (ou pas entièrement) parti : webhook tombé, Meta indisponible,
-- commande marquée payée par le balayage de règlement. Fenêtre de 72 h (Meta refuse les événements de plus de 7 jours),
-- 5 tentatives au plus, délai de grâce de 2 min pour ne pas doubler le webhook qui vient de passer.
CREATE OR REPLACE FUNCTION public.list_purchases_to_resend(p_limit integer DEFAULT 25, p_max_age_hours integer DEFAULT 72)
RETURNS TABLE (payment_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.ecomfy_payments p
  JOIN public.orders o ON o.id = p.order_id
  LEFT JOIN public.tracking_purchase_log l ON l.order_id = o.id AND l.shop_id = p.shop_id
  WHERE p.status = 'SUCCEEDED'
    AND p.shop_id IS NOT NULL
    AND p.updated_at > now() - make_interval(hours => GREATEST(COALESCE(p_max_age_hours, 72), 1))
    AND p.updated_at < now() - interval '2 minutes'
    AND LOWER(COALESCE(o.payment_status, '')) = 'paid'
    AND COALESCE(o.order_status, '') <> 'cancelled'
    AND (
      l.order_id IS NULL
      OR (l.status = 'failed' AND l.attempts < 5)
      OR (l.status = 'sending' AND l.claimed_at < now() - interval '10 minutes' AND l.attempts < 5)
    )
  ORDER BY p.updated_at
  LIMIT GREATEST(COALESCE(p_limit, 25), 1);
$$;

REVOKE ALL ON FUNCTION public.claim_purchase_send(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_purchase_send(uuid, uuid, text, text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_purchases_to_resend(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_purchase_send(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_purchase_send(uuid, uuid, text, text[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_purchases_to_resend(integer, integer) TO service_role;

-- Page de retour du prestataire (/order-confirmed?payment_ref=ECM-PAY-…) : le client revient sans état.
-- Cette fonction dit si le paiement est encaissé et donne le numéro de commande, pour que le navigateur envoie
-- son Purchase avec le même event_id que le serveur. N'expose que : statut, montant, devise, numéro de commande, slug.
-- La référence (12 caractères hexadécimaux aléatoires) n'est connue que du client et du marchand.
CREATE OR REPLACE FUNCTION public.get_payment_return_status(p_reference text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  IF p_reference IS NULL OR p_reference !~ '^ECM-PAY-[A-F0-9]{12}$' THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT p.status, p.amount, p.currency, o.order_number, s.slug
    INTO r
  FROM public.ecomfy_payments p
  LEFT JOIN public.orders o ON o.id = p.order_id
  LEFT JOIN public.shops s ON s.id = p.shop_id
  WHERE p.internal_reference = p_reference;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'status', r.status,
    'paid', r.status = 'SUCCEEDED',
    'order_number', r.order_number,
    'amount', r.amount,
    'currency', r.currency,
    'shop_slug', r.slug
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_payment_return_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_payment_return_status(text) TO anon, authenticated, service_role;
