-- Cas de test de 20261022100000_delivery_rls_recursion_and_push_guard.sql (après le socle et la migration).
\set ON_ERROR_STOP on

DO $$
DECLARE
  o text := '11111111-0000-0000-0000-00000000000a';  -- propriétaire de la boutique
  p text := '22222222-0000-0000-0000-00000000000b';  -- propriétaire du prestataire connecté
  d text := '33333333-0000-0000-0000-00000000000d';  -- livreur assigné
  x text := '44444444-0000-0000-0000-000000000001';  -- tiers
  o1 uuid := 'd0000000-0000-0000-0000-000000000001'; -- new, pas de livraison
  o2 uuid := 'd0000000-0000-0000-0000-000000000002'; -- delivered
  o3 uuid := 'd0000000-0000-0000-0000-000000000003'; -- confirmed, livraison in_transit
  o4 uuid := 'd0000000-0000-0000-0000-000000000004'; -- new, livraison failed
  o5 uuid := 'd0000000-0000-0000-0000-000000000005'; -- cancelled
  pr1 uuid := 'b0000000-0000-0000-0000-000000000001'; -- connecté, actif
  pr2 uuid := 'b0000000-0000-0000-0000-000000000002'; -- actif, non connecté
  pr3 uuid := 'b0000000-0000-0000-0000-000000000003'; -- connecté mais inactif
BEGIN
  -- Lecture du suivi (récursion corrigée)
  PERFORM public.dr_track('01 propriétaire de boutique : 2 livraisons, 1 livreur embarqué', o, 'rows=2 drivers=1');
  PERFORM public.dr_track('02 prestataire (propriétaire) : voit ses 2 livraisons',        p, 'rows=2 drivers=1');
  PERFORM public.dr_track('03 livreur assigné : voit les livraisons de son prestataire',  d, 'rows=2 drivers=1');
  PERFORM public.dr_track('04 tiers : rien',                                              x, 'rows=0 drivers=0');
  -- Membres visibles
  PERFORM public.dr_members('05 propriétaire de boutique : voit SEULEMENT le livreur assigné', o, 'members=Livreur assigné');
  PERFORM public.dr_members('06 prestataire : voit tous ses membres',                           p, 'members=Livreur assigné,Livreur autre');
  PERFORM public.dr_members('07 livreur : se voit lui-même',                                    d, 'members=Livreur assigné');
  PERFORM public.dr_members('08 tiers : aucun membre',                                          x, 'members=-');

  -- Expédier : garde-fous
  PERFORM public.dr_push('09 tiers : Unauthorized',                              x, o1, pr1, 'refus Unauthorized');
  PERFORM public.dr_push('10 commande livrée : refusée',                         o, o2, pr1, 'refus Cette commande est déjà clôturée%');
  PERFORM public.dr_push('11 commande annulée : refusée',                        o, o5, pr1, 'refus Cette commande est déjà clôturée%');
  PERFORM public.dr_push('12 prestataire non connecté : refusé',                 o, o1, pr2, 'refus Ce partenaire de livraison n''est pas connecté%');
  PERFORM public.dr_push('13 prestataire connecté mais inactif : refusé',        o, o1, pr3, 'refus Ce partenaire de livraison n''est pas connecté%');
  PERFORM public.dr_push('14 livraison in_transit : non réinitialisée',          o, o3, pr1, 'refus La livraison de cette commande est déjà en cours%');
  PERFORM public.dr_push('15 commande inexistante',                              o, gen_random_uuid(), pr1, 'refus Order not found');
  PERFORM public.dr_push('16 commande normale vers prestataire connecté : ok',   o, o1, pr1, 'ok');
  PERFORM public.dr_push('17 relance après échec (failed) : autorisée',          o, o4, pr1, 'ok');
  PERFORM public.dr_push('18 nouvel envoi tant que en attente : autorisé',       o, o1, pr1, 'ok');
END $$;

INSERT INTO public.dr_results (test, expected, observed, pass)
SELECT '19 la livraison in_transit est intacte (statut et livreur)', 'in_transit / c...001',
       status || ' / ' || left(driver_id::text, 4) || '...' || right(driver_id::text, 3),
       status = 'in_transit' AND driver_id = 'c0000000-0000-0000-0000-000000000001'
  FROM public.order_deliveries WHERE order_id = 'd0000000-0000-0000-0000-000000000003';
INSERT INTO public.dr_results (test, expected, observed, pass)
SELECT '20 la livraison relancée (failed) est repassée en pending', 'pending', status, status = 'pending'
  FROM public.order_deliveries WHERE order_id = 'd0000000-0000-0000-0000-000000000004';
INSERT INTO public.dr_results (test, expected, observed, pass)
SELECT '21 EXECUTE anon = faux (push), faux (helper)', 'false/false',
       has_function_privilege('anon','public.push_order_to_delivery_provider(uuid,uuid)','EXECUTE')::text || '/' ||
       has_function_privilege('anon','public.shop_owner_can_see_delivery_member(uuid,uuid)','EXECUTE')::text,
       NOT has_function_privilege('anon','public.push_order_to_delivery_provider(uuid,uuid)','EXECUTE')
       AND NOT has_function_privilege('anon','public.shop_owner_can_see_delivery_member(uuid,uuid)','EXECUTE');

-- Coordonnées des livreurs (get_delivery_driver_contacts), sous une identité.
CREATE FUNCTION public.dr_contacts(p_test text, p_sub text, p_role text, p_ids uuid[], p_expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_obs text; v_list text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(p_sub, ''), true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
  BEGIN
    SELECT coalesce(string_agg(full_name || ' ' || phone, ',' ORDER BY full_name), '-') INTO v_list FROM public.get_delivery_driver_contacts(p_ids);
    v_obs := 'contacts=' || v_list;
  EXCEPTION WHEN OTHERS THEN v_obs := 'err ' || SQLERRM; END;
  RESET ROLE;
  INSERT INTO public.dr_results (test, expected, observed, pass) VALUES (p_test, p_expected, v_obs, v_obs LIKE p_expected);
END $$;

DO $$
DECLARE
  o text := '11111111-0000-0000-0000-00000000000a'; p text := '22222222-0000-0000-0000-00000000000b'; x text := '44444444-0000-0000-0000-000000000001';
  assigned uuid := 'c0000000-0000-0000-0000-000000000001'; other uuid := 'c0000000-0000-0000-0000-000000000002';
BEGIN
  PERFORM public.dr_contacts('22 propriétaire de boutique : le livreur affecté à ses commandes',     o, 'authenticated', ARRAY[assigned, other], 'contacts=Kouadio Livreur +2250100000001');
  PERFORM public.dr_contacts('23 prestataire : tous les membres de son équipe',                     p, 'authenticated', ARRAY[assigned, other], 'contacts=Autre Livreur +2250100000002,Kouadio Livreur +2250100000001');
  PERFORM public.dr_contacts('24 tiers : aucune coordonnée',                                         x, 'authenticated', ARRAY[assigned, other], 'contacts=-');
  PERFORM public.dr_contacts('25 anon : refusé',                                                     NULL, 'anon',        ARRAY[assigned],        'err permission denied%');
  PERFORM public.dr_contacts('26 liste vide et NULL : rien',                                         o, 'authenticated', ARRAY[]::uuid[],        'contacts=-');
  PERFORM public.dr_contacts('27 identifiant inconnu : ignoré',                                      o, 'authenticated', ARRAY[gen_random_uuid()], 'contacts=-');
END $$;

\pset format aligned
SELECT test, pass, observed FROM public.dr_results ORDER BY n;
SELECT count(*) FILTER (WHERE pass) AS reussis, count(*) FILTER (WHERE NOT pass) AS echecs FROM public.dr_results;
