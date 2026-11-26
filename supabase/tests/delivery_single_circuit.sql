-- Tests de 20261126120000_delivery_single_circuit.sql. Base JETABLE vide uniquement (schéma réduit au nécessaire).
-- Depuis la racine du dépôt : psql -v ON_ERROR_STOP=1 -f supabase/tests/delivery_single_circuit.sql
\set ON_ERROR_STOP on

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $$;

CREATE TABLE public.orders (id int PRIMARY KEY, shop_id int NOT NULL DEFAULT 1, order_status text NOT NULL DEFAULT 'new',
  customer_city text, delivery_provider_id uuid, delivery_transferred_at timestamptz);
CREATE TABLE public.delivery_providers (id uuid PRIMARY KEY, is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.shop_delivery_connections (shop_id int, delivery_provider_id uuid, status text, auto_transfer boolean, created_at timestamptz DEFAULT now());
CREATE TABLE public.order_deliveries (order_id int PRIMARY KEY, provider_id uuid, driver_id uuid, status text NOT NULL);
CREATE TABLE public.delivery_dispatches (id serial PRIMARY KEY, order_id int NOT NULL, status text NOT NULL);
CREATE FUNCTION public.pick_delivery_driver(_p uuid, _city text, OUT o_zone_id uuid, OUT o_driver_id uuid)
  LANGUAGE sql AS $f$ SELECT NULL::uuid, '00000000-0000-0000-0000-000000000007'::uuid $f$;

\ir ../migrations/20261126120000_delivery_single_circuit.sql
\ir ../migrations/20261126120000_delivery_single_circuit.sql

CREATE TRIGGER trg_auto BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.auto_transfer_order_to_delivery();
INSERT INTO public.orders (id) SELECT generate_series(1, 6);
INSERT INTO public.delivery_providers (id) VALUES ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
INSERT INTO public.shop_delivery_connections VALUES (1, '00000000-0000-0000-0000-000000000001', 'active', true);

CREATE TABLE t_res (n serial, test text, pass boolean, observed text);
CREATE FUNCTION t_run(p_test text, p_sql text, p_expect text DEFAULT 'ok') RETURNS void LANGUAGE plpgsql AS $$
DECLARE v text := 'ok';
BEGIN
  BEGIN EXECUTE p_sql; EXCEPTION WHEN OTHERS THEN v := 'err:' || SQLSTATE; END;
  INSERT INTO t_res (test, pass, observed) VALUES (p_test, v = p_expect, v);
END $$;

-- Commande 1 : confiée à une structure
SELECT t_run('transmission d''une commande libre', $q$INSERT INTO delivery_dispatches (order_id, status) VALUES (1, 'transmitted')$q$);
SELECT t_run('seconde transmission refusée', $q$INSERT INTO delivery_dispatches (order_id, status) VALUES (1, 'transmitted')$q$, 'err:23505');
SELECT t_run('expédition d''une commande transmise refusée', $q$INSERT INTO order_deliveries VALUES (1, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000007', 'pending')$q$, 'err:23505');
SELECT t_run('confirmation d''une commande transmise acceptée', $q$UPDATE orders SET order_status = 'confirmed' WHERE id = 1$q$);
SELECT t_run('aucun auto-transfert sur une commande transmise',
  $q$DO $d$ BEGIN IF EXISTS (SELECT 1 FROM order_deliveries WHERE order_id = 1) OR (SELECT delivery_provider_id FROM orders WHERE id = 1) IS NOT NULL THEN RAISE EXCEPTION 'transféré'; END IF; END $d$$q$);
SELECT t_run('la course avance', $q$UPDATE delivery_dispatches SET status = 'accepted' WHERE order_id = 1$q$);

-- Libération puis reprise
SELECT t_run('refus de la course', $q$UPDATE delivery_dispatches SET status = 'refused' WHERE order_id = 1$q$);
SELECT t_run('expédition après refus', $q$INSERT INTO order_deliveries VALUES (1, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000007', 'pending')$q$);
SELECT t_run('course refusée non réactivable si la commande est repartie', $q$UPDATE delivery_dispatches SET status = 'assigned' WHERE order_id = 1$q$, 'err:23505');

-- Commande 2 : expédiée
SELECT t_run('expédition d''une commande libre', $q$INSERT INTO order_deliveries VALUES (2, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000007', 'pending')$q$);
SELECT t_run('transmission d''une commande expédiée refusée', $q$INSERT INTO delivery_dispatches (order_id, status) VALUES (2, 'transmitted')$q$, 'err:23505');
SELECT t_run('relance chez un autre prestataire', $q$UPDATE order_deliveries SET provider_id = '00000000-0000-0000-0000-000000000002', status = 'pending' WHERE order_id = 2$q$);
SELECT t_run('échec de la livraison', $q$UPDATE order_deliveries SET status = 'failed' WHERE order_id = 2$q$);
SELECT t_run('transmission après échec', $q$INSERT INTO delivery_dispatches (order_id, status) VALUES (2, 'transmitted')$q$);
SELECT t_run('livraison échouée non réactivable ensuite', $q$UPDATE order_deliveries SET status = 'assigned' WHERE order_id = 2$q$, 'err:23505');

-- Commande 3 : course échouée, puis nouvelle structure, puis réaffectation de l'ancienne
SELECT t_run('course échouée', $q$INSERT INTO delivery_dispatches (order_id, status) VALUES (3, 'failed')$q$);
SELECT t_run('nouvelle transmission', $q$INSERT INTO delivery_dispatches (order_id, status) VALUES (3, 'transmitted')$q$);
SELECT t_run('réaffectation de l''ancienne course refusée', $q$UPDATE delivery_dispatches SET status = 'assigned' WHERE order_id = 3 AND status = 'failed'$q$, 'err:23505');

-- Commande 4 : auto-transfert inchangé sur une commande libre
SELECT t_run('confirmation d''une commande libre', $q$UPDATE orders SET order_status = 'confirmed' WHERE id = 4$q$);
SELECT t_run('auto-transfert effectué',
  $q$DO $d$ BEGIN IF NOT EXISTS (SELECT 1 FROM order_deliveries WHERE order_id = 4 AND driver_id = '00000000-0000-0000-0000-000000000007') THEN RAISE EXCEPTION 'absent'; END IF; END $d$$q$);

-- Doublon antérieur à la migration : il continue d'avancer
ALTER TABLE delivery_dispatches DISABLE TRIGGER trg_single_delivery_circuit;
INSERT INTO order_deliveries VALUES (5, '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000007', 'assigned');
INSERT INTO delivery_dispatches (order_id, status) VALUES (5, 'accepted');
ALTER TABLE delivery_dispatches ENABLE TRIGGER trg_single_delivery_circuit;
SELECT t_run('doublon existant : la livraison avance', $q$UPDATE order_deliveries SET status = 'picked_up' WHERE order_id = 5$q$);
SELECT t_run('doublon existant : la course avance', $q$UPDATE delivery_dispatches SET status = 'preparing' WHERE order_id = 5$q$);

SELECT n, test, observed, pass FROM t_res ORDER BY n;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM t_res WHERE NOT pass) THEN RAISE EXCEPTION 'ÉCHEC'; END IF;
END $$;
SELECT count(*) || ' cas réussis' AS bilan FROM t_res;
