\set ON_ERROR_STOP on
CREATE TABLE public.r (n text, ok boolean);
GRANT ALL ON public.r TO authenticated;
CREATE FUNCTION public.chk(n text, ok boolean) RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ INSERT INTO public.r VALUES (n, coalesce(ok, false)) $$;
GRANT EXECUTE ON FUNCTION public.chk(text, boolean) TO authenticated;

INSERT INTO public.profiles VALUES ('d0000000-0000-0000-0000-000000000001'), ('d0000000-0000-0000-0000-000000000002');
INSERT INTO public.shops VALUES ('a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001', true),
                                ('a0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002', false);
INSERT INTO public.products (id, shop_id, name, stock_quantity, stock_qr_code) VALUES
 ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Robe',10,'ECP-AAAAAAAAAAAA'),
 ('c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','Sac',1,'ECP-BBBBBBBBBBBB'),
 ('c0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001','Hors commande',5,'ECP-CCCCCCCCCCCC'),
 ('c0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000002','Autre boutique',5,'ECP-DDDDDDDDDDDD');
INSERT INTO public.orders VALUES ('e0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001'),
                                 ('e0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002');
INSERT INTO public.order_items (order_id, product_id, quantity) VALUES
 ('e0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001',3),
 ('e0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002',2),
 ('e0000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000004',1);
INSERT INTO public.delivery_company_members VALUES ('f0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','driver',true),
                                                   ('f0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000002','driver',true);
INSERT INTO public.order_deliveries (id, order_id, driver_id) VALUES
 ('11000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001'),
 ('11000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000002','f0000000-0000-0000-0000-000000000001');

SET ROLE authenticated;
SET request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000001';

SELECT public.chk('statut : 2 produits, aucun scanné',
  jsonb_array_length(public.get_delivery_scan_status('11000000-0000-0000-0000-000000000001')->'items') = 2
  AND NOT (public.get_delivery_scan_status('11000000-0000-0000-0000-000000000001')->'items'->0->>'scanned')::boolean);
SELECT public.chk('scan Robe (code en minuscules)', (public.driver_scan_product('11000000-0000-0000-0000-000000000001','ecp-aaaaaaaaaaaa')->>'success')::boolean);
RESET ROLE;
SELECT public.chk('stock Robe = 7', (SELECT stock_quantity = 7 FROM public.products WHERE id='c0000000-0000-0000-0000-000000000001'));
SET ROLE authenticated; SET request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000001';
SELECT public.chk('double scan : déjà scanné',
  (public.driver_scan_product('11000000-0000-0000-0000-000000000001','ECP-AAAAAAAAAAAA')->>'already_scanned')::boolean);
RESET ROLE;
SELECT public.chk('stock Robe toujours 7', (SELECT stock_quantity = 7 FROM public.products WHERE id='c0000000-0000-0000-0000-000000000001'));
SET ROLE authenticated; SET request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000001';
SELECT public.chk('scan Sac (stock 1 < 2) : alerte stock insuffisant',
  (public.driver_scan_product('11000000-0000-0000-0000-000000000001','ECP-BBBBBBBBBBBB')->>'insufficient_stock')::boolean);
SELECT public.chk('produit hors commande refusé', NOT (public.driver_scan_product('11000000-0000-0000-0000-000000000001','ECP-CCCCCCCCCCCC')->>'success')::boolean);
SELECT public.chk('produit d une autre boutique refusé', NOT (public.driver_scan_product('11000000-0000-0000-0000-000000000001','ECP-DDDDDDDDDDDD')->>'success')::boolean);
SELECT public.chk('statut : tout scanné',
  (SELECT bool_and((i->>'scanned')::boolean) FROM jsonb_array_elements(public.get_delivery_scan_status('11000000-0000-0000-0000-000000000001')->'items') i));
SELECT public.chk('boutique sans la fonction : désactivé',
  (public.get_delivery_scan_status('11000000-0000-0000-0000-000000000002')->>'enabled')::boolean = false);
SELECT public.chk('scan refusé si fonction désactivée', NOT (public.driver_scan_product('11000000-0000-0000-0000-000000000002','ECP-DDDDDDDDDDDD')->>'success')::boolean);

-- Autre livreur : accès refusé
SET request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000002';
DO $$ BEGIN
  BEGIN PERFORM public.driver_scan_product('11000000-0000-0000-0000-000000000001','ECP-AAAAAAAAAAAA'); INSERT INTO public.r VALUES ('autre livreur refusé', false);
  EXCEPTION WHEN insufficient_privilege THEN INSERT INTO public.r VALUES ('autre livreur refusé', true); END;
  BEGIN PERFORM public.get_delivery_scan_status('11000000-0000-0000-0000-000000000001'); INSERT INTO public.r VALUES ('autre livreur : statut refusé', false);
  EXCEPTION WHEN insufficient_privilege THEN INSERT INTO public.r VALUES ('autre livreur : statut refusé', true); END;
END $$;
-- Sans session : refusé
RESET request.jwt.claim.sub;
DO $$ BEGIN
  BEGIN PERFORM public.driver_scan_product('11000000-0000-0000-0000-000000000001','ECP-AAAAAAAAAAAA'); INSERT INTO public.r VALUES ('sans session refusé', false);
  EXCEPTION WHEN insufficient_privilege THEN INSERT INTO public.r VALUES ('sans session refusé', true); END;
END $$;

RESET ROLE;
-- Course terminée : scan refusé
UPDATE public.order_deliveries SET status='delivered' WHERE id='11000000-0000-0000-0000-000000000001';
SET ROLE authenticated; SET request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000001';
SELECT public.chk('scan refusé après livraison', NOT (public.driver_scan_product('11000000-0000-0000-0000-000000000001','ECP-AAAAAAAAAAAA')->>'success')::boolean);
RESET ROLE;

-- Retour à la boutique : remise en stock, une seule fois
UPDATE public.order_deliveries SET status='returned' WHERE id='11000000-0000-0000-0000-000000000001';
SELECT public.chk('retour : Robe 10, Sac 2',
  (SELECT stock_quantity FROM public.products WHERE id='c0000000-0000-0000-0000-000000000001') = 10
  AND (SELECT stock_quantity FROM public.products WHERE id='c0000000-0000-0000-0000-000000000002') = 2);
UPDATE public.order_deliveries SET status='returned' WHERE id='11000000-0000-0000-0000-000000000001';
SELECT public.chk('retour rejoué : pas de double remise', (SELECT stock_quantity = 10 FROM public.products WHERE id='c0000000-0000-0000-0000-000000000001'));
SELECT public.chk('journal : 2 prises + 2 remises', (SELECT count(*) = 4 FROM public.stock_movements WHERE reference_order_id='e0000000-0000-0000-0000-000000000001'));

-- Nouvelle tournée après retour : on peut rescanner
UPDATE public.order_deliveries SET status='pending' WHERE id='11000000-0000-0000-0000-000000000001';
SET ROLE authenticated; SET request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000001';
SELECT public.chk('rescan après retour : retrait de nouveau', NOT (public.driver_scan_product('11000000-0000-0000-0000-000000000001','ECP-AAAAAAAAAAAA')->>'already_scanned')::boolean);
RESET ROLE;
SELECT public.chk('stock Robe = 7 après rescan', (SELECT stock_quantity = 7 FROM public.products WHERE id='c0000000-0000-0000-0000-000000000001'));

SELECT n, CASE WHEN ok THEN 'OK' ELSE 'ECHEC' END AS res FROM public.r;
SELECT format('%s/%s OK', count(*) FILTER (WHERE ok), count(*)) AS bilan FROM public.r;
