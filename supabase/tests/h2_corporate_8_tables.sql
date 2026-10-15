-- Vérification du correctif H2 : les 8 tables de gouvernance restées ouvertes, avec les vrais rôles Postgres.
-- Voir AUDIT-PROJET-2026-10.md (H2) et docs/SECURITY-HOTFIX-2026-10.md.
--
-- BASE JETABLE UNIQUEMENT (jamais dev ni production : ce script crée des utilisateurs et écrit dans les tables).
-- Prérequis : migrations 20260901000000, puis 20261012120000 (section 2, politiques corporate_*), puis
-- 20261015150000 (journal d'audit et acceptations en ajout seul) ; auth.users(id, email), auth.uid(), auth.jwt() ;
-- les rôles anon / authenticated / service_role ; public.user_roles.
-- Exécution : psql -U postgres -d <base jetable> -f supabase/tests/h2_corporate_8_tables.sql
-- Chaque ligne affiche « expected » et « observed » ; la colonne ok doit être vraie partout.

\pset pager off
\set ON_ERROR_STOP off
drop table if exists zz_h2;
create table zz_h2(n serial, test text, expected text, observed text);

create or replace function zz_h2_run(p_role text, p_uid uuid, p_sql text) returns text language plpgsql as $f$
declare res text; v_email text;
begin
  select email into v_email from auth.users where id = p_uid;
  begin
    execute 'set local role '||quote_ident(p_role);
    perform set_config('request.jwt.claims', json_build_object('sub',p_uid,'role',p_role,'email',v_email)::text, true);
    perform set_config('request.jwt.claim.sub', coalesce(p_uid::text,''), true);
    perform set_config('request.jwt.claim.role', p_role, true);
    execute p_sql into res;
    reset role;
    return res;
  exception when others then
    reset role;
    return 'ERR '||sqlstate;
  end;
end $f$;
create or replace function zz_h2_t(p_name text, p_exp text, p_role text, p_uid uuid, p_sql text) returns void language plpgsql as $f$
begin insert into zz_h2(test,expected,observed) values(p_name,p_exp,zz_h2_run(p_role,p_uid,p_sql)); end $f$;

-- UUIDs : F = fondateur, CO = cofondateur, SH = actionnaire, M1 / M2 = marchands sans rôle de gouvernance
insert into auth.users(id,email) values
 ('f0000000-0000-4000-8000-000000000001','founder@x.test'),
 ('d0000000-0000-4000-8000-000000000001','co@x.test'),
 ('c0000000-0000-4000-8000-000000000001','sh@x.test'),
 ('a0000000-0000-4000-8000-000000000001','m1@x.test'),
 ('a0000000-0000-4000-8000-000000000002','m2@x.test')
on conflict do nothing;
delete from public.user_roles where user_id in ('f0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002');
insert into public.user_roles(user_id,role) values
 ('f0000000-0000-4000-8000-000000000001','founder'),
 ('d0000000-0000-4000-8000-000000000001','co_founder'),
 ('c0000000-0000-4000-8000-000000000001','shareholder');

-- Lignes de départ dans les 8 tables (et leurs parents)
insert into public.corporate_shareholders(id,email,full_name) values ('11000000-0000-4000-8000-000000000001','s@x.test','S');
insert into public.corporate_documents(id,category,title) values ('12000000-0000-4000-8000-000000000001','legal','Statuts');
insert into public.corporate_vesting_plans(id,shareholder_id,start_date,cliff_date,end_date,target_percentage,target_shares)
  values ('13000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001','2026-01-01','2027-01-01','2030-01-01',10,100);
insert into public.corporate_proposals(id,title,rationale,proposed_by,current_shares,current_percentage,proposed_shares,proposed_percentage)
  values ('14000000-0000-4000-8000-000000000001','P','R','f0000000-0000-4000-8000-000000000001',0,0,10,10);
insert into public.corporate_vesting_milestones(vesting_plan_id,milestone_date,percentage_eligible,shares_eligible) values ('13000000-0000-4000-8000-000000000001','2027-01-01',25,25);
insert into public.corporate_document_versions(document_id,version) values ('12000000-0000-4000-8000-000000000001','1.0');
insert into public.corporate_document_acceptances(document_id,version,user_id,email,action,legal_statement) values ('12000000-0000-4000-8000-000000000001','1.0','c0000000-0000-4000-8000-000000000001','sh@x.test','approved','ok');
insert into public.corporate_proposal_approvals(proposal_id,user_id,decision) values ('14000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','approved');
insert into public.corporate_cap_table_snapshots(reason,snapshot_data,total_shares) values ('init','{}',100);
insert into public.corporate_intellectual_property(asset_name,asset_type,creator_name) values ('Marque','trademark','F');
insert into public.corporate_offboarding_cases(departure_date,reason,shareholder_id) values ('2026-12-31','test','11000000-0000-4000-8000-000000000001');
insert into public.corporate_audit_logs(action,target_entity,user_id,user_email) values ('SEED','test','f0000000-0000-4000-8000-000000000001','founder@x.test');

-- 1. Les 8 tables : lecture et écriture selon le rôle
do $$
declare
  t text; cnt text;
  tables text[] := array['corporate_vesting_milestones','corporate_document_versions','corporate_document_acceptances',
    'corporate_proposal_approvals','corporate_cap_table_snapshots','corporate_intellectual_property',
    'corporate_offboarding_cases','corporate_audit_logs'];
  append_only text[] := array['corporate_document_acceptances','corporate_audit_logs'];
  upd text; del text; sel text;
begin
  foreach t in array tables loop
    sel := format('select count(*)::text from public.%I', t);
    upd := format('with u as (update public.%I set id=id returning 1) select count(*)::text from u', t);
    del := format('with d as (delete from public.%I returning 1) select count(*)::text from d', t);

    perform zz_h2_t(t||' lecture anon','0','anon',null,sel);
    perform zz_h2_t(t||' lecture marchand','0','authenticated','a0000000-0000-4000-8000-000000000001',sel);
    perform zz_h2_t(t||' lecture actionnaire','>=1','authenticated','c0000000-0000-4000-8000-000000000001',sel);
    perform zz_h2_t(t||' lecture fondateur','>=1','authenticated','f0000000-0000-4000-8000-000000000001',sel);
    perform zz_h2_t(t||' lecture cofondateur','>=1','authenticated','d0000000-0000-4000-8000-000000000001',sel);

    perform zz_h2_t(t||' UPDATE anon','0 ou ERR 42501','anon',null,upd);
    perform zz_h2_t(t||' UPDATE marchand','0','authenticated','a0000000-0000-4000-8000-000000000001',upd);
    perform zz_h2_t(t||' UPDATE actionnaire','0','authenticated','c0000000-0000-4000-8000-000000000001',upd);
    perform zz_h2_t(t||' DELETE marchand','0','authenticated','a0000000-0000-4000-8000-000000000001',del);
    perform zz_h2_t(t||' DELETE actionnaire','0','authenticated','c0000000-0000-4000-8000-000000000001',del);

    if t = any(append_only) then
      perform zz_h2_t(t||' UPDATE fondateur (ajout seul)','0','authenticated','f0000000-0000-4000-8000-000000000001',upd);
      perform zz_h2_t(t||' DELETE fondateur (ajout seul)','0','authenticated','f0000000-0000-4000-8000-000000000001',del);
    else
      perform zz_h2_t(t||' UPDATE fondateur','>=1','authenticated','f0000000-0000-4000-8000-000000000001',upd);
      perform zz_h2_t(t||' UPDATE cofondateur','>=1','authenticated','d0000000-0000-4000-8000-000000000001',upd);
    end if;
  end loop;
end $$;

-- 2. Insertion sur les 6 tables à écriture réservée aux fondateurs
select zz_h2_t('vesting_milestones INSERT marchand','ERR 42501','authenticated','a0000000-0000-4000-8000-000000000001',$q$with i as (insert into public.corporate_vesting_milestones(vesting_plan_id,milestone_date,percentage_eligible,shares_eligible) values ('13000000-0000-4000-8000-000000000001','2028-01-01',1,1) returning 1) select count(*)::text from i$q$);
select zz_h2_t('vesting_milestones INSERT actionnaire','ERR 42501','authenticated','c0000000-0000-4000-8000-000000000001',$q$with i as (insert into public.corporate_vesting_milestones(vesting_plan_id,milestone_date,percentage_eligible,shares_eligible) values ('13000000-0000-4000-8000-000000000001','2028-01-01',1,1) returning 1) select count(*)::text from i$q$);
select zz_h2_t('vesting_milestones INSERT fondateur','1','authenticated','f0000000-0000-4000-8000-000000000001',$q$with i as (insert into public.corporate_vesting_milestones(vesting_plan_id,milestone_date,percentage_eligible,shares_eligible) values ('13000000-0000-4000-8000-000000000001','2028-01-01',1,1) returning 1) select count(*)::text from i$q$);
select zz_h2_t('document_versions INSERT marchand','ERR 42501','authenticated','a0000000-0000-4000-8000-000000000001',$q$with i as (insert into public.corporate_document_versions(document_id,version) values ('12000000-0000-4000-8000-000000000001','9.9') returning 1) select count(*)::text from i$q$);
select zz_h2_t('proposal_approvals INSERT marchand','ERR 42501','authenticated','a0000000-0000-4000-8000-000000000001',$q$with i as (insert into public.corporate_proposal_approvals(proposal_id,user_id,decision) values ('14000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','approved') returning 1) select count(*)::text from i$q$);
select zz_h2_t('cap_table_snapshots INSERT marchand','ERR 42501','authenticated','a0000000-0000-4000-8000-000000000001',$q$with i as (insert into public.corporate_cap_table_snapshots(reason,snapshot_data,total_shares) values ('x','{}',1) returning 1) select count(*)::text from i$q$);
select zz_h2_t('intellectual_property INSERT marchand','ERR 42501','authenticated','a0000000-0000-4000-8000-000000000001',$q$with i as (insert into public.corporate_intellectual_property(asset_name,asset_type,creator_name) values ('x','x','x') returning 1) select count(*)::text from i$q$);
select zz_h2_t('offboarding_cases INSERT marchand','ERR 42501','authenticated','a0000000-0000-4000-8000-000000000001',$q$with i as (insert into public.corporate_offboarding_cases(departure_date,reason,shareholder_id) values ('2026-12-31','x','11000000-0000-4000-8000-000000000001') returning 1) select count(*)::text from i$q$);

-- 3. Journal d'audit : ajout seul, au nom de l'appelant
select zz_h2_t('audit_logs INSERT anon','ERR 42501','anon',null,$q$with i as (insert into public.corporate_audit_logs(action,target_entity,user_id,user_email) values ('X','t',null,null) returning 1) select count(*)::text from i$q$);
select zz_h2_t('audit_logs INSERT marchand, sa propre ligne','1','authenticated','a0000000-0000-4000-8000-000000000001',$q$with i as (insert into public.corporate_audit_logs(action,target_entity,user_id,user_email) values ('LOGIN','t','a0000000-0000-4000-8000-000000000001','m1@x.test') returning 1) select count(*)::text from i$q$);
select zz_h2_t('audit_logs INSERT marchand, e-mail du JWT en majuscules','1','authenticated','a0000000-0000-4000-8000-000000000001',$q$with i as (insert into public.corporate_audit_logs(action,target_entity,user_id,user_email) values ('LOGIN','t','a0000000-0000-4000-8000-000000000001','M1@X.TEST') returning 1) select count(*)::text from i$q$);
select zz_h2_t('audit_logs INSERT marchand, user_id d''un autre','ERR 42501','authenticated','a0000000-0000-4000-8000-000000000001',$q$with i as (insert into public.corporate_audit_logs(action,target_entity,user_id,user_email) values ('FORGED','t','f0000000-0000-4000-8000-000000000001','founder@x.test') returning 1) select count(*)::text from i$q$);
select zz_h2_t('audit_logs INSERT marchand, user_id NULL','ERR 42501','authenticated','a0000000-0000-4000-8000-000000000001',$q$with i as (insert into public.corporate_audit_logs(action,target_entity,user_id,user_email) values ('FORGED','t',null,'m1@x.test') returning 1) select count(*)::text from i$q$);
select zz_h2_t('audit_logs INSERT marchand, son id mais e-mail d''un autre','ERR 42501','authenticated','a0000000-0000-4000-8000-000000000001',$q$with i as (insert into public.corporate_audit_logs(action,target_entity,user_id,user_email) values ('FORGED','t','a0000000-0000-4000-8000-000000000001','founder@x.test') returning 1) select count(*)::text from i$q$);
select zz_h2_t('audit_logs INSERT fondateur','1','authenticated','f0000000-0000-4000-8000-000000000001',$q$with i as (insert into public.corporate_audit_logs(action,target_entity,user_id,user_email) values ('FOUNDER_ACTION','t','f0000000-0000-4000-8000-000000000001','founder@x.test') returning 1) select count(*)::text from i$q$);
select zz_h2_t('audit_logs lecture marchand après ses insertions','0','authenticated','a0000000-0000-4000-8000-000000000001',$q$select count(*)::text from public.corporate_audit_logs$q$);

-- 4. Acceptations de documents : signature en son propre nom uniquement
select zz_h2_t('acceptances INSERT anon','ERR 42501','anon',null,$q$with i as (insert into public.corporate_document_acceptances(document_id,version,user_id,email,action,legal_statement) values ('12000000-0000-4000-8000-000000000001','1.0','a0000000-0000-4000-8000-000000000001','m1@x.test','approved','x') returning 1) select count(*)::text from i$q$);
select zz_h2_t('acceptances INSERT marchand en son nom','1','authenticated','a0000000-0000-4000-8000-000000000001',$q$with i as (insert into public.corporate_document_acceptances(document_id,version,user_id,email,action,legal_statement) values ('12000000-0000-4000-8000-000000000001','1.0','a0000000-0000-4000-8000-000000000001','m1@x.test','approved','x') returning 1) select count(*)::text from i$q$);
select zz_h2_t('acceptances INSERT marchand au nom de l''actionnaire','ERR 42501','authenticated','a0000000-0000-4000-8000-000000000001',$q$with i as (insert into public.corporate_document_acceptances(document_id,version,user_id,email,action,legal_statement) values ('12000000-0000-4000-8000-000000000001','1.0','c0000000-0000-4000-8000-000000000001','sh@x.test','approved','x') returning 1) select count(*)::text from i$q$);
select zz_h2_t('acceptances INSERT marchand, son id mais e-mail d''un autre','ERR 42501','authenticated','a0000000-0000-4000-8000-000000000001',$q$with i as (insert into public.corporate_document_acceptances(document_id,version,user_id,email,action,legal_statement) values ('12000000-0000-4000-8000-000000000001','1.0','a0000000-0000-4000-8000-000000000001','sh@x.test','approved','x') returning 1) select count(*)::text from i$q$);
select zz_h2_t('acceptances INSERT actionnaire en son nom','1','authenticated','c0000000-0000-4000-8000-000000000001',$q$with i as (insert into public.corporate_document_acceptances(document_id,version,user_id,email,action,legal_statement) values ('12000000-0000-4000-8000-000000000001','2.0','c0000000-0000-4000-8000-000000000001','sh@x.test','approved','x') returning 1) select count(*)::text from i$q$);

-- 5. service_role : RLS contournée (Edge Functions)
select zz_h2_t('audit_logs lecture service_role','true','service_role',null,$q$select (count(*) >= 1)::text from public.corporate_audit_logs$q$);

-- 6. État des politiques
select zz_h2_t('aucune politique ouverte sur corporate_*','0','postgres',null,$q$select count(*)::text from pg_policies where tablename like 'corporate\_%' and (qual = 'true' or with_check = 'true')$q$);
select zz_h2_t('RLS active sur les 8 tables','8','postgres',null,$q$select count(*)::text from pg_class where relrowsecurity and relname in ('corporate_vesting_milestones','corporate_document_versions','corporate_document_acceptances','corporate_proposal_approvals','corporate_cap_table_snapshots','corporate_intellectual_property','corporate_offboarding_cases','corporate_audit_logs')$q$);
select zz_h2_t('politiques UPDATE/DELETE sur audit_logs et acceptances','0','postgres',null,$q$select count(*)::text from pg_policies where tablename in ('corporate_audit_logs','corporate_document_acceptances') and cmd in ('UPDATE','DELETE','ALL')$q$);

select n, test, expected, observed,
  (observed = expected
   or (expected = '>=1' and observed ~ '^[1-9]')
   or (expected = '0 ou ERR 42501' and observed in ('0','ERR 42501'))) as ok
from zz_h2 order by n;
select count(*) filter (where not (observed = expected or (expected = '>=1' and observed ~ '^[1-9]') or (expected = '0 ou ERR 42501' and observed in ('0','ERR 42501')))) as echecs, count(*) as total from zz_h2;
