-- Test de supabase/migrations/20261023160000_product_reviews_hardening.sql (23/10/2026).
-- À lancer sur une base de dev : tout est créé dans une transaction qui se termine par une exception contenant le
-- rapport JSON (rien n'est conservé). Lancer :  npx supabase db query --linked -f supabase/tests/product_reviews.sql
-- Attendu : visiteur_approved_devient_pending = pending ; nom_trim = Awa ; email_vide_devient_null = true ;
-- produit_autre_boutique / commentaire_trop_long / nom_vide / email_invalide = refuse ; avant_moderation = 0 ;
-- autre_marchand_modere = 0 ; proprietaire_approuve = approved ; modifier_contenu = refuse ;
-- doublon = refuse ; plafond_refuse_au_rang = 10 (le 1er avis de p3 compte déjà) ;
-- apres_moderation = 2 avis, moyenne 4 ; vue_publique = 2 ; stats_boutique_cachee = 0 ; produit_supprime_avis_restants = 1.
DO $$
DECLARE
  uid uuid := gen_random_uuid(); uid2 uuid := gen_random_uuid();
  sid uuid := gen_random_uuid(); sid2 uuid := gen_random_uuid();
  p1 uuid := gen_random_uuid(); pb uuid := gen_random_uuid(); p3 uuid := gen_random_uuid();
  rep jsonb := '{}'::jsonb; n int; st text; s record; rid1 uuid; rid2 uuid; rid3 uuid; rid4 uuid;
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
  VALUES (uid, '00000000-0000-0000-0000-000000000000','authenticated','authenticated','r1@example.test','x',now(),'{}','{}',now(),now(),'','','',''),
         (uid2,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','r2@example.test','x',now(),'{}','{}',now(),now(),'','','','');
  INSERT INTO public.shops (id, user_id, business_name, slug, is_activated, is_published, activation_fee_paid, commission_rate)
  VALUES (sid, uid, 'Boutique avis test', 'zz-avis-test', true, true, true, 0.05),
         (sid2, uid2, 'Autre boutique avis', 'zz-avis-test2', true, true, true, 0.05);
  INSERT INTO public.products (id, shop_id, name, price, is_published)
  VALUES (p1, sid, 'P1', 10000, true), (p3, sid, 'P3', 5000, true), (pb, sid2, 'PB', 5000, true);

  -- Visiteur anonyme : tente de se publier lui-même (PostgREST pose la revendication role=anon)
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  rid1 := gen_random_uuid();
  INSERT INTO public.product_reviews (id, shop_id, product_id, reviewer_name, rating, comment, status)
    VALUES (rid1, sid, p1, '  Awa  ', 5, 'Super produit', 'approved');
  RESET ROLE;
  SELECT status, reviewer_name INTO s FROM public.product_reviews WHERE id = rid1;
  rep := rep || jsonb_build_object('visiteur_approved_devient_pending', s.status, 'nom_trim', s.reviewer_name);

  SET LOCAL ROLE anon;
  BEGIN
    INSERT INTO public.product_reviews (shop_id, product_id, reviewer_name, rating, comment) VALUES (sid, pb, 'X', 5, 'ok');
    rep := rep || jsonb_build_object('produit_autre_boutique', 'ACCEPTE');
  EXCEPTION WHEN OTHERS THEN rep := rep || jsonb_build_object('produit_autre_boutique', 'refuse: ' || SQLERRM); END;
  BEGIN
    INSERT INTO public.product_reviews (shop_id, product_id, reviewer_name, rating, comment) VALUES (sid, p1, 'X', 5, repeat('x', 2001));
    rep := rep || jsonb_build_object('commentaire_trop_long', 'ACCEPTE');
  EXCEPTION WHEN OTHERS THEN rep := rep || jsonb_build_object('commentaire_trop_long', 'refuse: ' || SQLERRM); END;
  BEGIN
    INSERT INTO public.product_reviews (shop_id, product_id, reviewer_name, rating, comment) VALUES (sid, p1, '   ', 5, 'ok');
    rep := rep || jsonb_build_object('nom_vide', 'ACCEPTE');
  EXCEPTION WHEN OTHERS THEN rep := rep || jsonb_build_object('nom_vide', 'refuse: ' || SQLERRM); END;
  BEGIN
    INSERT INTO public.product_reviews (shop_id, product_id, reviewer_name, rating, comment, reviewer_email) VALUES (sid, p1, 'X', 5, 'ok', 'pas-un-mail');
    rep := rep || jsonb_build_object('email_invalide', 'ACCEPTE');
  EXCEPTION WHEN OTHERS THEN rep := rep || jsonb_build_object('email_invalide', 'refuse: ' || SQLERRM); END;
  BEGIN
    INSERT INTO public.product_reviews (shop_id, product_id, reviewer_name, rating, comment) VALUES (sid, p1, 'awa', 5, 'Super produit');
    rep := rep || jsonb_build_object('doublon', 'ACCEPTE');
  EXCEPTION WHEN OTHERS THEN rep := rep || jsonb_build_object('doublon', 'refuse: ' || SQLERRM); END;
  rid2 := gen_random_uuid(); rid3 := gen_random_uuid(); rid4 := gen_random_uuid();
  INSERT INTO public.product_reviews (id, shop_id, product_id, reviewer_name, rating, comment, reviewer_email) VALUES (rid2, sid, p1, 'Koffi', 3, 'Moyen', '');
  INSERT INTO public.product_reviews (id, shop_id, product_id, reviewer_name, rating, comment) VALUES (rid3, sid, p1, 'Fatou', 3, 'Correct');
  INSERT INTO public.product_reviews (id, shop_id, product_id, reviewer_name, rating, comment) VALUES (rid4, sid, p3, 'Yao', 5, 'Autre produit');
  SELECT review_count INTO n FROM public.get_product_review_stats(sid, p1);
  rep := rep || jsonb_build_object('avant_moderation', n);
  RESET ROLE;
  SELECT (reviewer_email IS NULL) AS vide INTO s FROM public.product_reviews WHERE id = rid2;
  rep := rep || jsonb_build_object('email_vide_devient_null', s.vide);

  -- Autre marchand : ne peut pas modérer
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid2, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE public.product_reviews SET status = 'approved' WHERE id = rid1;
  GET DIAGNOSTICS n = ROW_COUNT;
  rep := rep || jsonb_build_object('autre_marchand_modere', n);
  RESET ROLE;

  -- Propriétaire : approuve 2 avis (note 5 et 3), rejette le 3e ; ne peut pas réécrire le contenu
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE public.product_reviews SET status = 'approved' WHERE id IN (rid1, rid2, rid4);
  UPDATE public.product_reviews SET status = 'rejected' WHERE id = rid3;
  SELECT status INTO st FROM public.product_reviews WHERE id = rid1;
  rep := rep || jsonb_build_object('proprietaire_approuve', st);
  BEGIN
    UPDATE public.product_reviews SET comment = 'réécrit' WHERE id = rid1;
    rep := rep || jsonb_build_object('modifier_contenu', 'ACCEPTE');
  EXCEPTION WHEN OTHERS THEN rep := rep || jsonb_build_object('modifier_contenu', 'refuse: ' || SQLERRM); END;
  RESET ROLE;

  -- Public : statistiques et vue sur tous les avis approuvés du produit
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  SELECT review_count, average_rating INTO s FROM public.get_product_review_stats(sid, p1);
  rep := rep || jsonb_build_object('apres_moderation', jsonb_build_object('n', s.review_count, 'moyenne', s.average_rating));
  SELECT count(*) INTO n FROM public.product_reviews_public WHERE shop_id = sid AND product_id = p1;
  rep := rep || jsonb_build_object('vue_publique', n);
  RESET ROLE;

  -- Boutique non visible : pas de statistiques
  UPDATE public.shops SET is_published = false WHERE id = sid;
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  SELECT review_count INTO n FROM public.get_product_review_stats(sid, p1);
  rep := rep || jsonb_build_object('stats_boutique_cachee', n);
  RESET ROLE;
  UPDATE public.shops SET is_published = true WHERE id = sid;

  -- Suppression du produit P1 : ses avis (3) partent avec lui, celui de P3 reste
  DELETE FROM public.products WHERE id = p1;
  SELECT count(*) INTO n FROM public.product_reviews WHERE shop_id = sid;
  rep := rep || jsonb_build_object('produit_supprime_avis_restants', n);

  -- Plafond : 10 avis par produit sur 10 minutes (p3 en a déjà 1)
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
  SET LOCAL ROLE anon;
  FOR n IN 1..12 LOOP
    BEGIN
      INSERT INTO public.product_reviews (shop_id, product_id, reviewer_name, rating, comment) VALUES (sid, p3, 'V' || n, 4, 'Avis ' || n);
    EXCEPTION WHEN OTHERS THEN
      rep := rep || jsonb_build_object('plafond_refuse_au_rang', n, 'plafond_message', SQLERRM);
      EXIT;
    END;
  END LOOP;
  RESET ROLE;

  RAISE EXCEPTION 'RAPPORT %', rep::text;
END $$;
