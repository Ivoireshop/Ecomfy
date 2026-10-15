-- Vérification du correctif H1 : bucket privé kyc-documents, politiques de stockage, chemins de pièces.
-- Voir docs/KYC-REVUE-ET-DEPLOIEMENT-C4.md (section 6).
--
-- BASE JETABLE UNIQUEMENT (jamais dev ni production : ce script crée des utilisateurs et écrit dans les tables).
-- Prérequis : migration 20261015140000 appliquée, plus merchant_kyc et son trigger merchant_kyc_guard_review_columns
-- (20260914190000 / 20260914200000), storage.buckets / storage.objects / storage.foldername(), auth.users / auth.uid(),
-- les rôles anon / authenticated / service_role, public.user_roles et public.is_corporate_founder().
-- Exécution : psql -U postgres -d <base jetable> -f supabase/tests/h1_kyc_private_bucket.sql
-- Chaque ligne affiche « expected » et « observed » ; elles doivent être égales (colonne ok).

\pset pager off
\set ON_ERROR_STOP off
create table if not exists zz_h1(n serial, test text, expected text, observed text);
create or replace function zz_h1_run(p_role text, p_uid uuid, p_sql text) returns text language plpgsql as $f$
declare res text;
begin
  begin
    execute 'set local role '||quote_ident(p_role);
    perform set_config('request.jwt.claim.sub', coalesce(p_uid::text,''), true);
    perform set_config('request.jwt.claim.role', p_role, true);
    execute p_sql into res;
    reset role;
    return 'ok: '||coalesce(res,'null');
  exception when others then
    reset role;
    return 'ERR '||sqlstate;
  end;
end $f$;
create or replace function zz_h1_t(p_name text, p_exp text, p_role text, p_uid uuid, p_sql text) returns void language plpgsql as $f$
begin insert into zz_h1(test,expected,observed) values(p_name,p_exp,zz_h1_run(p_role,p_uid,p_sql)); end $f$;

-- Setup (en propriétaire)
insert into auth.users(id) values
 ('f0000000-0000-4000-8000-0000000000a1'),
 ('a0000000-0000-4000-8000-0000000000a1'),
 ('b0000000-0000-4000-8000-0000000000a1'),
 ('c0000000-0000-4000-8000-0000000000a1') on conflict do nothing;
insert into public.user_roles(user_id, role) values ('f0000000-0000-4000-8000-0000000000a1', 'founder');
-- Ancien dossier hérité : URL publique (avant H1)
insert into public.merchant_kyc(user_id, full_name, document_front_url, selfie_url)
values ('c0000000-0000-4000-8000-0000000000a1', 'Marchand Hérité',
        'https://x.supabase.co/storage/v1/object/public/shop-images/kyc/front_1.jpg',
        'https://x.supabase.co/storage/v1/object/public/shop-images/kyc/selfie_1.jpg');

-- 1. Bucket
select zz_h1_t('bucket kyc-documents privé', 'ok: false', 'postgres', null, $q$ select public::text from storage.buckets where id = 'kyc-documents' $q$);
select zz_h1_t('bucket : images uniquement', 'ok: image/jpeg,image/png,image/webp', 'postgres', null,
  $q$ select array_to_string(allowed_mime_types, ',') from storage.buckets where id = 'kyc-documents' $q$);
select zz_h1_t('bucket : 5 Mo maximum', 'ok: 5242880', 'postgres', null, $q$ select file_size_limit::text from storage.buckets where id = 'kyc-documents' $q$);

-- 2. Dépôt
select zz_h1_t('A dépose dans son dossier', 'ok: 1', 'authenticated', 'a0000000-0000-4000-8000-0000000000a1',
  $q$ with i as (insert into storage.objects(bucket_id, name) values ('kyc-documents', 'a0000000-0000-4000-8000-0000000000a1/front_1.jpg') returning 1) select count(*)::text from i $q$);
select zz_h1_t('A dépose dans le dossier de B : refusé', 'ERR 42501', 'authenticated', 'a0000000-0000-4000-8000-0000000000a1',
  $q$ with i as (insert into storage.objects(bucket_id, name) values ('kyc-documents', 'b0000000-0000-4000-8000-0000000000a1/front_1.jpg') returning 1) select count(*)::text from i $q$);
select zz_h1_t('A dépose à la racine : refusé', 'ERR 42501', 'authenticated', 'a0000000-0000-4000-8000-0000000000a1',
  $q$ with i as (insert into storage.objects(bucket_id, name) values ('kyc-documents', 'kyc/front_1.jpg') returning 1) select count(*)::text from i $q$);
select zz_h1_t('anon dépose : refusé', 'ERR 42501', 'anon', null,
  $q$ with i as (insert into storage.objects(bucket_id, name) values ('kyc-documents', 'a0000000-0000-4000-8000-0000000000a1/x.jpg') returning 1) select count(*)::text from i $q$);
insert into storage.objects(bucket_id, name) values ('kyc-documents', 'b0000000-0000-4000-8000-0000000000a1/front_1.jpg');

-- 3. Lecture
select zz_h1_t('A lit son fichier', 'ok: 1', 'authenticated', 'a0000000-0000-4000-8000-0000000000a1',
  $q$ select count(*)::text from storage.objects where bucket_id = 'kyc-documents' and name like 'a0000000%' $q$);
select zz_h1_t('A ne lit pas le fichier de B', 'ok: 0', 'authenticated', 'a0000000-0000-4000-8000-0000000000a1',
  $q$ select count(*)::text from storage.objects where bucket_id = 'kyc-documents' and name like 'b0000000%' $q$);
select zz_h1_t('C (sans fichier) ne lit rien', 'ok: 0', 'authenticated', 'c0000000-0000-4000-8000-0000000000a1',
  $q$ select count(*)::text from storage.objects where bucket_id = 'kyc-documents' $q$);
select zz_h1_t('anon ne lit rien', 'ok: 0', 'anon', null, $q$ select count(*)::text from storage.objects where bucket_id = 'kyc-documents' $q$);
select zz_h1_t('fondateur lit tout', 'ok: 2', 'authenticated', 'f0000000-0000-4000-8000-0000000000a1',
  $q$ select count(*)::text from storage.objects where bucket_id = 'kyc-documents' $q$);

-- 4. Pas de modification ni de suppression par les rôles API
select zz_h1_t('A ne modifie pas son fichier', 'ok: 0', 'authenticated', 'a0000000-0000-4000-8000-0000000000a1',
  $q$ with u as (update storage.objects set name = 'a0000000-0000-4000-8000-0000000000a1/autre.jpg' where bucket_id = 'kyc-documents' and name like 'a0000000%' returning 1) select count(*)::text from u $q$);
select zz_h1_t('A ne supprime pas son fichier', 'ok: 0', 'authenticated', 'a0000000-0000-4000-8000-0000000000a1',
  $q$ with d as (delete from storage.objects where bucket_id = 'kyc-documents' and name like 'a0000000%' returning 1) select count(*)::text from d $q$);
select zz_h1_t('fondateur ne supprime rien', 'ok: 0', 'authenticated', 'f0000000-0000-4000-8000-0000000000a1',
  $q$ with d as (delete from storage.objects where bucket_id = 'kyc-documents' returning 1) select count(*)::text from d $q$);

-- 5. Chemins dans merchant_kyc
select zz_h1_t('dossier avec chemins propres', 'ok: PENDING', 'authenticated', 'a0000000-0000-4000-8000-0000000000a1',
  $q$ with i as (insert into public.merchant_kyc(user_id, full_name, document_front_url, document_back_url, selfie_url)
        values ('a0000000-0000-4000-8000-0000000000a1', 'A', 'a0000000-0000-4000-8000-0000000000a1/front_1.jpg',
                'a0000000-0000-4000-8000-0000000000a1/back_1.jpg', 'a0000000-0000-4000-8000-0000000000a1/selfie_1.jpg')
        returning verification_status) select verification_status from i $q$);
select zz_h1_t('URL externe refusée (INSERT)', 'ERR 22023', 'authenticated', 'b0000000-0000-4000-8000-0000000000a1',
  $q$ with i as (insert into public.merchant_kyc(user_id, full_name, document_front_url)
        values ('b0000000-0000-4000-8000-0000000000a1', 'B', 'https://evil.example/pixel.gif') returning 1) select count(*)::text from i $q$);
select zz_h1_t('fichier d''autrui refusé (INSERT)', 'ERR 22023', 'authenticated', 'b0000000-0000-4000-8000-0000000000a1',
  $q$ with i as (insert into public.merchant_kyc(user_id, full_name, document_front_url)
        values ('b0000000-0000-4000-8000-0000000000a1', 'B', 'a0000000-0000-4000-8000-0000000000a1/front_1.jpg') returning 1) select count(*)::text from i $q$);
select zz_h1_t('remontée de dossier refusée', 'ERR 22023', 'authenticated', 'b0000000-0000-4000-8000-0000000000a1',
  $q$ with i as (insert into public.merchant_kyc(user_id, full_name, document_front_url)
        values ('b0000000-0000-4000-8000-0000000000a1', 'B', 'b0000000-0000-4000-8000-0000000000a1/../a0000000-0000-4000-8000-0000000000a1/front_1.jpg') returning 1) select count(*)::text from i $q$);
select zz_h1_t('A met un chemin de B (UPDATE) : refusé', 'ERR 22023', 'authenticated', 'a0000000-0000-4000-8000-0000000000a1',
  $q$ with u as (update public.merchant_kyc set selfie_url = 'b0000000-0000-4000-8000-0000000000a1/front_1.jpg' where user_id = 'a0000000-0000-4000-8000-0000000000a1' returning 1) select count(*)::text from u $q$);
select zz_h1_t('A remplace par une URL (UPDATE) : refusé', 'ERR 22023', 'authenticated', 'a0000000-0000-4000-8000-0000000000a1',
  $q$ with u as (update public.merchant_kyc set document_front_url = 'https://evil.example/pixel.gif' where user_id = 'a0000000-0000-4000-8000-0000000000a1' returning 1) select count(*)::text from u $q$);
select zz_h1_t('A remplace par un nouveau chemin propre', 'ok: 1', 'authenticated', 'a0000000-0000-4000-8000-0000000000a1',
  $q$ with u as (update public.merchant_kyc set document_front_url = 'a0000000-0000-4000-8000-0000000000a1/front_2.jpg' where user_id = 'a0000000-0000-4000-8000-0000000000a1' returning 1) select count(*)::text from u $q$);
select zz_h1_t('dossier hérité : modifier le téléphone reste possible', 'ok: 1', 'authenticated', 'c0000000-0000-4000-8000-0000000000a1',
  $q$ with u as (update public.merchant_kyc set phone_number = '+2250700000000' where user_id = 'c0000000-0000-4000-8000-0000000000a1' returning 1) select count(*)::text from u $q$);
select zz_h1_t('dossier hérité : renvoyer une URL publique refusé', 'ERR 22023', 'authenticated', 'c0000000-0000-4000-8000-0000000000a1',
  $q$ with u as (update public.merchant_kyc set document_front_url = 'https://x.supabase.co/storage/v1/object/public/shop-images/kyc/front_9.jpg' where user_id = 'c0000000-0000-4000-8000-0000000000a1' returning 1) select count(*)::text from u $q$);
select zz_h1_t('dossier hérité : migration par le propriétaire (chemin)', 'ok: 1', 'postgres', null,
  $q$ with u as (update public.merchant_kyc set document_front_url = 'c0000000-0000-4000-8000-0000000000a1/front_1.jpg' where user_id = 'c0000000-0000-4000-8000-0000000000a1' returning 1) select count(*)::text from u $q$);
select zz_h1_t('service_role n''est pas bridé', 'ok: 1', 'service_role', null,
  $q$ with u as (update public.merchant_kyc set selfie_url = 'c0000000-0000-4000-8000-0000000000a1/selfie_1.jpg' where user_id = 'c0000000-0000-4000-8000-0000000000a1' returning 1) select count(*)::text from u $q$);

-- Résultat
select n, test, expected, observed, (expected = observed) as ok from zz_h1 order by n;
select count(*) filter (where expected = observed) as reussis, count(*) as total from zz_h1;
