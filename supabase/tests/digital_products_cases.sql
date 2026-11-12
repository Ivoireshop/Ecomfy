-- Cas de test de 20261112120000_digital_products.sql (voir l'en-tête de digital_products.sql pour la commande).
-- Tout est créé puis ANNULÉ : la fin du script lève une exception qui contient le rapport (rien n'est conservé).
-- Attendu : aucune ligne « FAIL » dans le rapport.
CREATE TEMP TABLE res (name text, ok boolean);
GRANT ALL ON res TO PUBLIC;

-- true si l'instruction échoue (erreur ou droit refusé) avec le rôle courant.
CREATE FUNCTION pg_temp.fails(stmt text) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE stmt;
  RETURN false;
EXCEPTION WHEN OTHERS THEN
  RETURN true;
END $$;

CREATE FUNCTION pg_temp.as_user(uid uuid) RETURNS void LANGUAGE sql AS
$$ SELECT set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true) $$;

DO $$
DECLARE
  owner_id uuid := gen_random_uuid(); other_id uuid := gen_random_uuid();
  collab_ok uuid := gen_random_uuid(); collab_ko uuid := gen_random_uuid();
  s1 uuid := gen_random_uuid(); s2 uuid := gen_random_uuid();
  pd uuid := gen_random_uuid(); pd2 uuid := gen_random_uuid(); pp uuid := gen_random_uuid(); p_other uuid := gen_random_uuid();
  o_noemail uuid := gen_random_uuid(); o_cod uuid := gen_random_uuid(); o_mm uuid := gen_random_uuid(); o_phys uuid := gen_random_uuid();
  f1 uuid := gen_random_uuid();
  n int; t text; b boolean; r record; rep text := '';
BEGIN
  INSERT INTO auth.users (id, email) VALUES (owner_id, 'o@x.test'), (other_id, 'p@x.test'), (collab_ok, 'c1@x.test'), (collab_ko, 'c2@x.test');
  INSERT INTO public.shops (id, user_id, business_name, slug) VALUES (s1, owner_id, 'Boutique 1', 'b1'), (s2, other_id, 'Boutique 2', 'b2');
  INSERT INTO public.shop_collaborators (shop_id, user_id, roles) VALUES (s1, collab_ok, ARRAY['manage_catalog']), (s1, collab_ko, ARRAY['view_orders']);
  INSERT INTO public.products (id, shop_id, name, is_digital, is_published) VALUES
    (pd, s1, 'E-book', true, true), (pd2, s1, 'Formation', true, true), (pp, s1, 'T-shirt', false, true), (p_other, s2, 'Autre', true, true);

  -- ---------- Bucket ----------
  SELECT public, file_size_limit INTO r FROM storage.buckets WHERE id = 'digital-products';
  INSERT INTO res VALUES ('bucket_prive', r.public = false), ('bucket_50mo', r.file_size_limit = 52428800);

  -- ---------- Colonne héritée digital_file_url ----------
  PERFORM pg_temp.as_user(owner_id);
  SET LOCAL ROLE authenticated;
  UPDATE public.products SET digital_file_url = 'https://exemple.test/secret.pdf' WHERE id = pd;
  RESET ROLE;
  SELECT digital_file_url INTO t FROM public.products WHERE id = pd;
  INSERT INTO res VALUES ('digital_file_url_force_null_authenticated', t IS NULL);
  UPDATE public.products SET digital_file_url = 'https://exemple.test/service.pdf' WHERE id = pd2;   -- rôle propriétaire de la base
  SELECT digital_file_url INTO t FROM public.products WHERE id = pd2;
  INSERT INTO res VALUES ('digital_file_url_intact_hors_api', t = 'https://exemple.test/service.pdf');

  -- ---------- product_digital_files ----------
  SET LOCAL ROLE authenticated;
  INSERT INTO public.product_digital_files (id, product_id, shop_id, storage_path, file_name, file_size)
    VALUES (f1, pd, s1, s1 || '/' || pd || '/a.pdf', 'a.pdf', 1000);
  RESET ROLE;
  INSERT INTO res VALUES ('proprietaire_ajoute_fichier', EXISTS (SELECT 1 FROM public.product_digital_files WHERE id = f1));

  SET LOCAL ROLE authenticated;
  b := pg_temp.fails(format($f$INSERT INTO public.product_digital_files (product_id, shop_id, storage_path, file_name) VALUES (%L, %L, %L, 'x.pdf')$f$, pd, s1, s1 || '/' || pd || '/../x.pdf'));
  RESET ROLE; INSERT INTO res VALUES ('chemin_avec_points_refuse', b);

  SET LOCAL ROLE authenticated;
  b := pg_temp.fails(format($f$INSERT INTO public.product_digital_files (product_id, shop_id, storage_path, file_name) VALUES (%L, %L, %L, 'x.pdf')$f$, pd, s1, s1 || '/' || pd2 || '/x.pdf'));
  RESET ROLE; INSERT INTO res VALUES ('chemin_autre_produit_refuse', b);

  SET LOCAL ROLE authenticated;
  b := pg_temp.fails(format($f$INSERT INTO public.product_digital_files (product_id, shop_id, storage_path, file_name) VALUES (%L, %L, %L, 'x.pdf')$f$, p_other, s1, s1 || '/' || p_other || '/x.pdf'));
  RESET ROLE; INSERT INTO res VALUES ('produit_dune_autre_boutique_refuse', b);

  -- Un autre marchand ne voit ni ne modifie ces fichiers.
  PERFORM pg_temp.as_user(other_id);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.product_digital_files;
  b := pg_temp.fails(format($f$INSERT INTO public.product_digital_files (product_id, shop_id, storage_path, file_name) VALUES (%L, %L, %L, 'x.pdf')$f$, pd, s1, s1 || '/' || pd || '/z.pdf'));
  RESET ROLE;
  INSERT INTO res VALUES ('autre_marchand_ne_voit_rien', n = 0), ('autre_marchand_ne_peut_pas_ajouter', b);

  -- Collaborateur catalogue : oui ; collaborateur sans droit catalogue : non.
  PERFORM pg_temp.as_user(collab_ok);
  SET LOCAL ROLE authenticated; SELECT count(*) INTO n FROM public.product_digital_files; RESET ROLE;
  INSERT INTO res VALUES ('collaborateur_catalogue_voit', n = 1);
  PERFORM pg_temp.as_user(collab_ko);
  SET LOCAL ROLE authenticated; SELECT count(*) INTO n FROM public.product_digital_files; RESET ROLE;
  INSERT INTO res VALUES ('collaborateur_sans_droit_ne_voit_pas', n = 0);

  -- Anonyme : aucun accès.
  SET LOCAL ROLE anon;
  b := pg_temp.fails('SELECT count(*) FROM public.product_digital_files');
  RESET ROLE; INSERT INTO res VALUES ('anon_ne_lit_pas_les_fichiers', b);

  -- 10 fichiers maximum (1 déjà présent).
  FOR i IN 2..10 LOOP
    INSERT INTO public.product_digital_files (product_id, shop_id, storage_path, file_name) VALUES (pd, s1, s1 || '/' || pd || '/f' || i || '.pdf', 'f' || i || '.pdf');
  END LOOP;
  b := pg_temp.fails(format($f$INSERT INTO public.product_digital_files (product_id, shop_id, storage_path, file_name) VALUES (%L, %L, %L, 'f11.pdf')$f$, pd, s1, s1 || '/' || pd || '/f11.pdf'));
  INSERT INTO res VALUES ('onzieme_fichier_refuse', b);

  -- ---------- Stockage : politiques du bucket ----------
  PERFORM pg_temp.as_user(owner_id);
  SET LOCAL ROLE authenticated;
  b := pg_temp.fails(format($f$INSERT INTO storage.objects (bucket_id, name) VALUES ('digital-products', %L)$f$, s1 || '/' || pd || '/a.pdf'));
  RESET ROLE; INSERT INTO res VALUES ('proprietaire_depose_dans_son_dossier', NOT b);

  SET LOCAL ROLE authenticated;
  b := pg_temp.fails(format($f$INSERT INTO storage.objects (bucket_id, name) VALUES ('digital-products', %L)$f$, s2 || '/' || p_other || '/a.pdf'));
  RESET ROLE; INSERT INTO res VALUES ('depot_dans_dossier_autre_boutique_refuse', b);

  PERFORM pg_temp.as_user(collab_ok);
  SET LOCAL ROLE authenticated;
  b := pg_temp.fails(format($f$INSERT INTO storage.objects (bucket_id, name) VALUES ('digital-products', %L)$f$, s1 || '/' || pd || '/c.pdf'));
  RESET ROLE; INSERT INTO res VALUES ('collaborateur_catalogue_depose', NOT b);

  PERFORM pg_temp.as_user(collab_ko);
  SET LOCAL ROLE authenticated;
  b := pg_temp.fails(format($f$INSERT INTO storage.objects (bucket_id, name) VALUES ('digital-products', %L)$f$, s1 || '/' || pd || '/d.pdf'));
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'digital-products';
  RESET ROLE; INSERT INTO res VALUES ('collaborateur_sans_droit_ne_depose_pas', b), ('collaborateur_sans_droit_ne_lit_pas', n = 0);

  PERFORM pg_temp.as_user(other_id);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'digital-products';
  b := pg_temp.fails(format($f$DELETE FROM storage.objects WHERE bucket_id = 'digital-products' AND name = %L$f$, s1 || '/' || pd || '/a.pdf'));
  RESET ROLE;
  SELECT count(*) INTO t FROM storage.objects WHERE bucket_id = 'digital-products' AND name = s1 || '/' || pd || '/a.pdf';
  INSERT INTO res VALUES ('autre_marchand_ne_lit_pas_le_bucket', n = 0), ('autre_marchand_ne_supprime_pas', t::int = 1);

  SET LOCAL ROLE anon;
  b := pg_temp.fails('SELECT count(*) FROM storage.objects') OR (SELECT count(*) FROM storage.objects WHERE bucket_id = 'digital-products') = 0;
  RESET ROLE; INSERT INTO res VALUES ('anon_ne_lit_pas_le_bucket', b);

  -- ---------- Commandes ----------
  INSERT INTO public.orders (id, shop_id, payment_method, payment_status, customer_email) VALUES
    (o_cod, s1, 'cash_on_delivery', 'pending', 'acheteur@x.test'), (o_mm, s1, 'mobile_money', 'pending', 'acheteur@x.test'),
    (o_phys, s1, 'cash_on_delivery', 'pending', NULL), (o_noemail, s1, 'mobile_money', 'pending', '  ');

  -- Sans e-mail : le lien ne pourrait pas être envoyé, la commande digitale est refusée.
  b := pg_temp.fails(format($f$INSERT INTO public.order_items (order_id, product_id) VALUES (%L, %L)$f$, o_noemail, pd));
  INSERT INTO res VALUES ('digital_sans_email_refuse', b);
  SELECT count(*) INTO n FROM public.digital_order_access WHERE order_id = o_noemail;
  INSERT INTO res VALUES ('digital_sans_email_ne_laisse_pas_dacces', n = 0);
  -- Un produit physique n'exige pas d'e-mail.
  INSERT INTO public.order_items (order_id, product_id) VALUES (o_noemail, pp);
  INSERT INTO res VALUES ('physique_sans_email_ok', true);

  b := pg_temp.fails(format($f$INSERT INTO public.order_items (order_id, product_id) VALUES (%L, %L)$f$, o_cod, pd));
  INSERT INTO res VALUES ('digital_plus_paiement_livraison_refuse', b);
  SELECT count(*) INTO n FROM public.digital_order_access WHERE order_id = o_cod;
  INSERT INTO res VALUES ('refus_ne_laisse_pas_dacces', n = 0);

  INSERT INTO public.order_items (order_id, product_id) VALUES (o_phys, pp);
  SELECT count(*) INTO n FROM public.digital_order_access WHERE order_id = o_phys;
  INSERT INTO res VALUES ('produit_physique_en_livraison_ok_sans_acces', n = 0);

  INSERT INTO public.order_items (order_id, product_id) VALUES (o_mm, pd), (o_mm, pd2), (o_mm, pp);
  SELECT count(*), max(token) INTO n, t FROM public.digital_order_access WHERE order_id = o_mm;
  INSERT INTO res VALUES ('un_seul_acces_par_commande', n = 1), ('jeton_64_hex', t ~ '^[a-f0-9]{64}$');

  -- Les rôles API ne lisent jamais les jetons ni le journal brut.
  PERFORM pg_temp.as_user(owner_id);
  SET LOCAL ROLE authenticated;
  b := pg_temp.fails('SELECT token FROM public.digital_order_access');
  RESET ROLE; INSERT INTO res VALUES ('authenticated_ne_lit_pas_les_jetons', b);
  SET LOCAL ROLE anon;
  b := pg_temp.fails('SELECT token FROM public.digital_order_access');
  RESET ROLE; INSERT INTO res VALUES ('anon_ne_lit_pas_les_jetons', b);

  -- Journal : le marchand compte les téléchargements de SES fichiers, un autre marchand non.
  INSERT INTO public.digital_download_log (order_id, file_id) VALUES (o_mm, f1), (o_mm, f1);
  PERFORM pg_temp.as_user(owner_id);
  SET LOCAL ROLE authenticated; SELECT count(*) INTO n FROM public.digital_download_log; RESET ROLE;
  INSERT INTO res VALUES ('marchand_compte_ses_telechargements', n = 2);
  PERFORM pg_temp.as_user(other_id);
  SET LOCAL ROLE authenticated; SELECT count(*) INTO n FROM public.digital_download_log; RESET ROLE;
  INSERT INTO res VALUES ('autre_marchand_ne_compte_pas', n = 0);
  PERFORM pg_temp.as_user(owner_id);
  SET LOCAL ROLE authenticated;
  b := pg_temp.fails(format($f$INSERT INTO public.digital_download_log (order_id, file_id) VALUES (%L, %L)$f$, o_mm, f1));
  RESET ROLE; INSERT INTO res VALUES ('marchand_ne_falsifie_pas_le_journal', b);

  -- Limite : contrainte 1..100 ou NULL.
  b := pg_temp.fails(format($f$UPDATE public.products SET digital_download_limit = 0 WHERE id = %L$f$, pd));
  INSERT INTO res VALUES ('limite_zero_refusee', b);
  b := pg_temp.fails(format($f$UPDATE public.products SET digital_download_limit = NULL WHERE id = %L$f$, pd));
  INSERT INTO res VALUES ('limite_illimitee_acceptee', NOT b);

  -- Suppression de la commande : accès et journal partent avec elle.
  DELETE FROM public.orders WHERE id = o_mm;
  SELECT count(*) INTO n FROM public.digital_order_access WHERE order_id = o_mm;
  INSERT INTO res VALUES ('suppression_commande_nettoie_acces', n = 0);

  -- ---------- Rapport ----------
  SELECT string_agg(CASE WHEN ok THEN 'PASS ' ELSE 'FAIL ' END || name, E'\n' ORDER BY ok, name) INTO rep FROM res;
  SELECT count(*) INTO n FROM res WHERE NOT ok;
  RAISE EXCEPTION E'RAPPORT : % cas, % en échec\n%', (SELECT count(*) FROM res), n, rep;
END $$;
