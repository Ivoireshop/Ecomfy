-- Cas du test de 20261106120000_shop_assets_restrict_uploads.sql (voir l'en-tête de shop_assets_policies.sql).
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned

CREATE TEMP TABLE results (n int, label text, ok boolean);
GRANT ALL ON results TO anon, authenticated;

-- try(n, label, role, uid, sql, attendu) : attendu = 'ok' ou 'denied'
CREATE FUNCTION pg_temp.try(n int, label text, role_name text, uid text, stmt text, expected text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  affected int := 0;
  outcome text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  EXECUTE format('SET LOCAL ROLE %I', role_name);
  BEGIN
    EXECUTE stmt;
    GET DIAGNOSTICS affected = ROW_COUNT;
    outcome := CASE WHEN affected > 0 THEN 'ok' ELSE 'denied' END;
  EXCEPTION WHEN insufficient_privilege OR others THEN
    outcome := 'denied';
  END;
  RESET ROLE;
  INSERT INTO results VALUES (n, label, outcome = expected);
END $$;

DO $$
DECLARE
  a text := '00000000-0000-0000-0000-00000000000a';
  b text := '00000000-0000-0000-0000-00000000000b';
BEGIN
  -- Anonyme : plus rien
  PERFORM pg_temp.try(1, 'anon ne dépose pas dans avatars/', 'anon', null,
    format($q$INSERT INTO storage.objects (bucket_id,name) VALUES ('shop-assets','avatars/%s/x.jpg')$q$, a), 'denied');
  PERFORM pg_temp.try(2, 'anon ne dépose pas dans parcel-photos/', 'anon', null,
    $q$INSERT INTO storage.objects (bucket_id,name) VALUES ('shop-assets','parcel-photos/y.jpg')$q$, 'denied');
  PERFORM pg_temp.try(3, 'anon n''écrase rien', 'anon', null,
    $q$UPDATE storage.objects SET name = name WHERE bucket_id='shop-assets'$q$, 'denied');

  -- Connecté A : son dossier oui, celui de B non
  PERFORM pg_temp.try(5, 'A dépose son avatar', 'authenticated', a,
    format($q$INSERT INTO storage.objects (bucket_id,name) VALUES ('shop-assets','avatars/%s/avatar-2.jpg')$q$, a), 'ok');
  PERFORM pg_temp.try(6, 'A ne dépose pas dans le dossier de B', 'authenticated', a,
    format($q$INSERT INTO storage.objects (bucket_id,name) VALUES ('shop-assets','avatars/%s/evil.jpg')$q$, b), 'denied');
  PERFORM pg_temp.try(7, 'A remplace son propre avatar', 'authenticated', a,
    format($q$UPDATE storage.objects SET name = name WHERE bucket_id='shop-assets' AND name LIKE 'avatars/%s/%%'$q$, a), 'ok');
  PERFORM pg_temp.try(8, 'A n''écrase pas l''avatar de B', 'authenticated', a,
    format($q$UPDATE storage.objects SET name = name WHERE bucket_id='shop-assets' AND name LIKE 'avatars/%s/%%'$q$, b), 'denied');
  PERFORM pg_temp.try(9, 'A ne peut pas déplacer un fichier vers le dossier de B', 'authenticated', a,
    format($q$UPDATE storage.objects SET name = 'avatars/%s/stolen.jpg' WHERE bucket_id='shop-assets' AND name LIKE 'avatars/%s/%%'$q$, b, a), 'denied');
  PERFORM pg_temp.try(10, 'A dépose une photo de colis', 'authenticated', a,
    $q$INSERT INTO storage.objects (bucket_id,name) VALUES ('shop-assets','parcel-photos/parcel_2.jpg')$q$, 'ok');
  PERFORM pg_temp.try(11, 'A n''écrase pas une photo de colis', 'authenticated', a,
    $q$UPDATE storage.objects SET name = name WHERE bucket_id='shop-assets' AND name LIKE 'parcel-photos/%'$q$, 'denied');
  PERFORM pg_temp.try(12, 'A ne supprime rien', 'authenticated', a,
    $q$DELETE FROM storage.objects WHERE bucket_id='shop-assets'$q$, 'denied');
  PERFORM pg_temp.try(13, 'chemin hors avatars/ et parcel-photos/ refusé', 'authenticated', a,
    $q$INSERT INTO storage.objects (bucket_id,name) VALUES ('shop-assets','random/file.jpg')$q$, 'denied');
  PERFORM pg_temp.try(14, 'fichier à la racine du bucket refusé', 'authenticated', a,
    $q$INSERT INTO storage.objects (bucket_id,name) VALUES ('shop-assets','root.jpg')$q$, 'denied');
  PERFORM pg_temp.try(15, 'dossier « avatars/ » sans id refusé', 'authenticated', a,
    $q$INSERT INTO storage.objects (bucket_id,name) VALUES ('shop-assets','avatars/noid.jpg')$q$, 'denied');
  PERFORM pg_temp.try(16, 'A ne dépose pas dans un autre bucket via cette règle', 'authenticated', a,
    $q$INSERT INTO storage.objects (bucket_id,name) VALUES ('delivery-kyc','whatever.jpg')$q$, 'denied');

  -- Bucket avatars (dossier = id de l'utilisateur)
  PERFORM pg_temp.try(17, 'avatars : anon ne dépose pas', 'anon', null,
    format($q$INSERT INTO storage.objects (bucket_id,name) VALUES ('avatars','%s/x.jpg')$q$, a), 'denied');
  PERFORM pg_temp.try(18, 'avatars : anon n''écrase rien', 'anon', null,
    $q$UPDATE storage.objects SET name = name WHERE bucket_id='avatars'$q$, 'denied');
  PERFORM pg_temp.try(19, 'avatars : A dépose dans son dossier', 'authenticated', a,
    format($q$INSERT INTO storage.objects (bucket_id,name) VALUES ('avatars','%s/avatar-2.jpg')$q$, a), 'ok');
  PERFORM pg_temp.try(20, 'avatars : A ne dépose pas dans le dossier de B', 'authenticated', a,
    format($q$INSERT INTO storage.objects (bucket_id,name) VALUES ('avatars','%s/evil.jpg')$q$, b), 'denied');
  PERFORM pg_temp.try(21, 'avatars : A remplace son avatar', 'authenticated', a,
    format($q$UPDATE storage.objects SET name = name WHERE bucket_id='avatars' AND name LIKE '%s/%%'$q$, a), 'ok');
  PERFORM pg_temp.try(22, 'avatars : A n''écrase pas l''avatar de B', 'authenticated', a,
    format($q$UPDATE storage.objects SET name = name WHERE bucket_id='avatars' AND name LIKE '%s/%%'$q$, b), 'denied');
  PERFORM pg_temp.try(23, 'avatars : A ne déplace pas un fichier vers B', 'authenticated', a,
    format($q$UPDATE storage.objects SET name = '%s/stolen.jpg' WHERE bucket_id='avatars' AND name LIKE '%s/%%'$q$, b, a), 'denied');
  PERFORM pg_temp.try(24, 'avatars : A ne supprime pas l''avatar de B', 'authenticated', a,
    format($q$DELETE FROM storage.objects WHERE bucket_id='avatars' AND name LIKE '%s/%%'$q$, b), 'denied');
  PERFORM pg_temp.try(25, 'avatars : A supprime son propre avatar', 'authenticated', a,
    format($q$DELETE FROM storage.objects WHERE bucket_id='avatars' AND name LIKE '%s/%%'$q$, a), 'ok');
  PERFORM pg_temp.try(26, 'avatars : fichier à la racine refusé', 'authenticated', a,
    $q$INSERT INTO storage.objects (bucket_id,name) VALUES ('avatars','root.jpg')$q$, 'denied');
END $$;

-- Cas 4 : lecture publique (hors fonction : SELECT simple en rôle anon)
SET ROLE anon;
SELECT count(*) AS lisibles_par_anon FROM storage.objects WHERE bucket_id = 'shop-assets' \gset
RESET ROLE;
INSERT INTO results VALUES (4, 'anon lit toujours (bucket public)', :lisibles_par_anon >= 2);
SET ROLE anon;
SELECT count(*) AS avatars_lisibles FROM storage.objects WHERE bucket_id = 'avatars' \gset
RESET ROLE;
INSERT INTO results VALUES (27, 'avatars : anon lit toujours', :avatars_lisibles >= 1);

-- Politiques restantes sur le bucket
SELECT 'POLITIQUES shop-assets restantes : ' || string_agg(policyname || ' (' || cmd || ')', ', ' ORDER BY policyname)
FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
  AND (coalesce(qual,'') LIKE '%shop-assets%' OR coalesce(with_check,'') LIKE '%shop-assets%');
SELECT 'POLITIQUES avatars restantes : ' || string_agg(policyname || ' (' || cmd || ')', ', ' ORDER BY policyname)
FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
  AND (coalesce(qual,'') LIKE '%bucket_id = ''avatars''%' OR coalesce(with_check,'') LIKE '%bucket_id = ''avatars''%');
SELECT 'politique de l''autre bucket conservée : ' || count(*) FROM pg_policies WHERE policyname = 'delivery_kyc_select_stub';
SELECT 'limites du bucket : ' || file_size_limit || ' octets, ' || array_to_string(allowed_mime_types, ',') FROM storage.buckets WHERE id='shop-assets';

SELECT CASE WHEN ok THEN 'OK   ' ELSE 'ECHEC' END || ' ' || lpad(n::text, 2) || ' ' || label FROM results ORDER BY n, ok;
SELECT count(*) FILTER (WHERE ok) || ' / ' || count(*) || ' cas réussis' FROM results;
