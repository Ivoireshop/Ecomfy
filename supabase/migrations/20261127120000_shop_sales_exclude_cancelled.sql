-- Revenus d'une boutique : les commandes annulées ou retournées n'en font pas partie.
--
-- shops.total_sales (« Mes boutiques », tableau de bord fondateur, classement des vendeurs) additionnait TOUTES les
-- commandes, alors que le tableau de bord de la boutique exclut les annulées et retournées : deux montants différents
-- pour la même boutique.
--
-- La règle est posée sur la colonne elle-même : à chaque écriture de total_sales, la valeur est recalculée. La
-- fonction de facturation sync_shop_order_stats n'est pas réécrite (ses versions diffèrent selon les migrations déjà
-- appliquées) et total_orders, qui sert aux seuils de facturation, continue de compter toutes les commandes.
-- Le nom « zz_ » fait passer ce déclencheur après le garde des colonnes de facturation, qui voit la valeur envoyée.
--
-- Idempotente. À appliquer À LA MAIN (jamais `supabase db push`).
-- Tests : supabase/tests/shop_sales_exclude_cancelled.sql (base jetable).

CREATE OR REPLACE FUNCTION public.shop_sales_total(_shop_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(total), 0) FROM public.orders
   WHERE shop_id = _shop_id
     AND order_status IS DISTINCT FROM 'cancelled' AND order_status IS DISTINCT FROM 'returned';
$$;
REVOKE ALL ON FUNCTION public.shop_sales_total(uuid) FROM PUBLIC, anon, authenticated;

-- SECURITY DEFINER : le total doit être exact même quand celui qui écrit ne peut pas lire les commandes.
CREATE OR REPLACE FUNCTION public.shops_set_total_sales()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.total_sales := public.shop_sales_total(NEW.id);
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.shops_set_total_sales() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS zz_shops_set_total_sales ON public.shops;
CREATE TRIGGER zz_shops_set_total_sales
  BEFORE UPDATE OF total_sales ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.shops_set_total_sales();

-- Reprise des boutiques dont le montant enregistré diffère (le déclencheur ci-dessus calcule la nouvelle valeur).
UPDATE public.shops s
   SET total_sales = s.total_sales
 WHERE s.total_sales IS DISTINCT FROM public.shop_sales_total(s.id);
