-- C6 (suite) : l'insertion publique des articles d'une commande était toujours refusée (42501).
--
-- La politique « Insert items only for fresh public orders » (20260514075432) testait la commande avec un
-- EXISTS (SELECT 1 FROM orders ...). Ce sous-select s'exécute avec les droits du visiteur, et orders n'a aucune
-- politique de lecture pour un visiteur (propriétaire, collaborateurs et livreurs seulement) : l'EXISTS était donc
-- toujours faux. Résultat : commande créée sans articles (paiement à la livraison) ou paiement en ligne impossible
-- (ecomfy-pay-initiate recalcule le total depuis order_items ; C6 fait échouer la commande si les articles manquent).
--
-- Même règle qu'avant (commande de moins de 15 minutes, boutique publiquement visible), évaluée par une fonction
-- SECURITY DEFINER qui ne renvoie qu'un booléen. Le prix reste imposé par le trigger enforce_order_item_price.
-- Idempotent.

CREATE OR REPLACE FUNCTION public.is_fresh_public_order(_order_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = _order_id
      AND o.created_at > now() - interval '15 minutes'
      AND public.is_shop_publicly_visible(o.shop_id)
  );
$$;

REVOKE ALL ON FUNCTION public.is_fresh_public_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_fresh_public_order(uuid) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Insert items only for fresh public orders" ON public.order_items;
CREATE POLICY "Insert items only for fresh public orders"
  ON public.order_items
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (public.is_fresh_public_order(order_id));
