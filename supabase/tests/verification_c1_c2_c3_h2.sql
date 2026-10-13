-- Vérification de bout en bout des correctifs C1, C2, C3, C7 (RLS) et H2 avec les vrais rôles Supabase.
-- Voir docs/VERIFICATION-CORRECTIFS-2026-10.md.
--
-- BASE JETABLE UNIQUEMENT (jamais dev ni production : ce script crée des utilisateurs et écrit dans les tables).
-- Mode d'emploi :
--   1. docker run -d --name pgtest -e POSTGRES_PASSWORD=test public.ecr.aws/supabase/postgres:17.6.1.155
--   2. appliquer toutes les migrations de supabase/migrations dans l'ordre (psql -d postgres, ON_ERROR_STOP=0 :
--      des erreurs d'environnement sont attendues, voir le document)
--   3. docker exec -i pgtest psql -U supabase_admin -h localhost -d postgres < supabase/tests/verification_c1_c2_c3_h2.sql
-- Les 46 résultats s'affichent dans deux tableaux (zz_results) ; comparer « expected » et « observed ».

\pset pager off
\set ON_ERROR_STOP off
create table if not exists zz_results(n serial, test text, expected text, observed text);
create or replace function zz_run(p_role text, p_uid uuid, p_sql text) returns text language plpgsql as $f$
declare res text;
begin
  begin
    execute 'set local role '||quote_ident(p_role);
    perform set_config('request.jwt.claims', json_build_object('sub',p_uid,'role',p_role)::text, true);
    perform set_config('request.jwt.claim.sub', coalesce(p_uid::text,''), true);
    perform set_config('request.jwt.claim.role', p_role, true);
    execute p_sql into res;
    reset role;
    return 'ok: '||coalesce(res,'null');
  exception when others then
    reset role;
    return 'ERR '||sqlstate||' '||sqlerrm;
  end;
end $f$;
create or replace function zz_t(p_name text, p_exp text, p_role text, p_uid uuid, p_sql text) returns void language plpgsql as $f$
declare r text := zz_run(p_role,p_uid,p_sql);
begin insert into zz_results(test,expected,observed) values(p_name,p_exp,r); end $f$;

-- Setup
insert into auth.users(id,email,instance_id,aud,role) values
 ('f0000000-0000-4000-8000-000000000001','founder@x.test','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('a0000000-0000-4000-8000-000000000001','m1@x.test','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('a0000000-0000-4000-8000-000000000002','m2@x.test','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('c0000000-0000-4000-8000-000000000001','sh@x.test','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
 ('d0000000-0000-4000-8000-000000000001','co@x.test','00000000-0000-0000-0000-000000000000','authenticated','authenticated')
on conflict do nothing;
delete from public.user_roles where user_id in ('f0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001');
insert into public.user_roles(user_id,role) values ('f0000000-0000-4000-8000-000000000001','founder'),('c0000000-0000-4000-8000-000000000001','shareholder'),('d0000000-0000-4000-8000-000000000001','co_founder');
insert into public.shops(id,user_id,business_name,slug) values ('b0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','Shop1','shop1'),('b0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002','Shop2','shop2');
insert into public.corporate_companies default values;
insert into public.corporate_shareholders(email,full_name) values('s@x.test','S');
insert into public.merchant_kyc(user_id,full_name,phone_number,document_type,document_number,document_front_url,verification_status) values('a0000000-0000-4000-8000-000000000001','M1','070','CNI','1','u','VERIFIED');
insert into public.wallets(merchant_id) values('a0000000-0000-4000-8000-000000000001'),('a0000000-0000-4000-8000-000000000002');
update public.wallets set available_balance=10000 where merchant_id='a0000000-0000-4000-8000-000000000001';
\pset pager off
\set ON_ERROR_STOP off
\pset pager off
\set ON_ERROR_STOP off
truncate zz_results;

-- UUIDs: F=f0..01 fondateur, M1=a0..01, M2=a0..02, SH=c0..01 actionnaire, CO=d0..01 co-fondateur
-- shop1 (de M1)=b0..01 ; FAKE=eeeeeeee-0000-4000-8000-00000000000e

-- C2 : fonctions de facturation
select zz_t('C2 apply_commission_payment anon','42501','anon',null,$q$select apply_commission_payment('eeeeeeee-0000-4000-8000-00000000000e'::uuid,1,'t',null,null,null)::text$q$);
select zz_t('C2 apply_commission_payment marchand','42501','authenticated','a0000000-0000-4000-8000-000000000001',$q$select apply_commission_payment('eeeeeeee-0000-4000-8000-00000000000e'::uuid,1,'t',null,null,null)::text$q$);
select zz_t('C2 apply_commission_payment FONDATEUR direct','42501 (reserve service_role)','authenticated','f0000000-0000-4000-8000-000000000001',$q$select apply_commission_payment('eeeeeeee-0000-4000-8000-00000000000e'::uuid,1,'t',null,null,null)::text$q$);
select zz_t('C2 apply_commission_payment service_role','shop_not_found','service_role',null,$q$select apply_commission_payment('eeeeeeee-0000-4000-8000-00000000000e'::uuid,1,'t',null,null,null)::text$q$);
select zz_t('C2 apply_shop_subscription anon','42501','anon',null,$q$select apply_shop_subscription('eeeeeeee-0000-4000-8000-00000000000e'::uuid,'eeeeeeee-0000-4000-8000-00000000000e'::uuid,'starter',0,'t',null)::text$q$);
select zz_t('C2 apply_shop_subscription marchand','42501','authenticated','a0000000-0000-4000-8000-000000000001',$q$select apply_shop_subscription('eeeeeeee-0000-4000-8000-00000000000e'::uuid,'eeeeeeee-0000-4000-8000-00000000000e'::uuid,'starter',0,'t',null)::text$q$);
select zz_t('C2 confirm_invoice_payment marchand','42501','authenticated','a0000000-0000-4000-8000-000000000001',$q$select confirm_invoice_payment('eeeeeeee-0000-4000-8000-00000000000e'::uuid,'eeeeeeee-0000-4000-8000-00000000000e'::uuid,'t',null)::text$q$);
select zz_t('C2 confirm_invoice_payment anon','42501','anon',null,$q$select confirm_invoice_payment('eeeeeeee-0000-4000-8000-00000000000e'::uuid,'eeeeeeee-0000-4000-8000-00000000000e'::uuid,'t',null)::text$q$);
select zz_t('C2 apply_shop_activation marchand','42501','authenticated','a0000000-0000-4000-8000-000000000001',$q$select apply_shop_activation('eeeeeeee-0000-4000-8000-00000000000e'::uuid,'eeeeeeee-0000-4000-8000-00000000000e'::uuid,1,'t',null)::text$q$);
select zz_t('C2 prepare_shop_activation_payment anon','42501','anon',null,$q$select prepare_shop_activation_payment('eeeeeeee-0000-4000-8000-00000000000e'::uuid,'eeeeeeee-0000-4000-8000-00000000000e'::uuid)::text$q$);

-- C1 : portefeuille
select zz_t('C1 get_or_create_merchant_wallet marchand','42501','authenticated','a0000000-0000-4000-8000-000000000001',$q$select get_or_create_merchant_wallet('a0000000-0000-4000-8000-000000000001')::text$q$);
select zz_t('C1 credit_merchant_wallet_pending marchand sur lui-meme','42501','authenticated','a0000000-0000-4000-8000-000000000001',$q$select credit_merchant_wallet_pending('a0000000-0000-4000-8000-000000000001',gen_random_uuid(),1000,1000,'XOF',24,'x')::text$q$);
select zz_t('C1 credit_merchant_wallet_pending anon','42501','anon',null,$q$select credit_merchant_wallet_pending('a0000000-0000-4000-8000-000000000001',gen_random_uuid(),1000,1000,'XOF',24,'x')::text$q$);
select zz_t('C1 process_wallet_settlements marchand','42501','authenticated','a0000000-0000-4000-8000-000000000001',$q$select process_wallet_settlements()::text$q$);
select zz_t('C1 retrait anon','42501','anon',null,$q$select request_wallet_withdrawal_atomic(1,'mobile')::text$q$);
select zz_t('C1 retrait M1 (KYC ok) 4000','success','authenticated','a0000000-0000-4000-8000-000000000001',$q$select request_wallet_withdrawal_atomic(4000,'mobile','0700000001','M1')::text$q$);
select zz_t('C1 retrait M1 montant negatif','refus','authenticated','a0000000-0000-4000-8000-000000000001',$q$select request_wallet_withdrawal_atomic(-500,'mobile','0700000001','M1')::text$q$);
select zz_t('C1 retrait M1 superieur au solde','refus','authenticated','a0000000-0000-4000-8000-000000000001',$q$select request_wallet_withdrawal_atomic(999999,'mobile','0700000001','M1')::text$q$);
select zz_t('C1 retrait M2 (sans KYC)','refus KYC','authenticated','a0000000-0000-4000-8000-000000000002',$q$select request_wallet_withdrawal_atomic(100,'mobile','0700000002','M2')::text$q$);
select zz_t('C1 retrait ancienne signature avec p_merchant_id=M1 depuis M2','fonction inexistante','authenticated','a0000000-0000-4000-8000-000000000002',$q$select request_wallet_withdrawal_atomic('a0000000-0000-4000-8000-000000000001'::uuid,100,'mobile')::text$q$);
select zz_t('C1 retrait service_role (sans auth.uid)','forbidden','service_role',null,$q$select request_wallet_withdrawal_atomic(1,'mobile')::text$q$);

-- C3 : commandes
select zz_t('C3 anon','42501','anon',null,$q$select count(*)::text from get_shop_orders_secure('b0000000-0000-4000-8000-000000000001'::uuid)$q$);
select zz_t('C3 M2 lit shop de M1','forbidden','authenticated','a0000000-0000-4000-8000-000000000002',$q$select count(*)::text from get_shop_orders_secure('b0000000-0000-4000-8000-000000000001'::uuid)$q$);
select zz_t('C3 M1 lit son shop','ok','authenticated','a0000000-0000-4000-8000-000000000001',$q$select count(*)::text from get_shop_orders_secure('b0000000-0000-4000-8000-000000000001'::uuid)$q$);
select zz_t('C3 founder lit shop de M1','ok','authenticated','f0000000-0000-4000-8000-000000000001',$q$select count(*)::text from get_shop_orders_secure('b0000000-0000-4000-8000-000000000001'::uuid)$q$);

-- H2 : gouvernance
select zz_t('H2 corporate_companies lecture anon','0','anon',null,$q$select count(*)::text from corporate_companies$q$);
select zz_t('H2 corporate_companies lecture marchand','0','authenticated','a0000000-0000-4000-8000-000000000001',$q$select count(*)::text from corporate_companies$q$);
select zz_t('H2 corporate_companies lecture fondateur','1','authenticated','f0000000-0000-4000-8000-000000000001',$q$select count(*)::text from corporate_companies$q$);
select zz_t('H2 corporate_shareholders lecture actionnaire','>=1','authenticated','c0000000-0000-4000-8000-000000000001',$q$select count(*)::text from corporate_shareholders$q$);
select zz_t('H2 corporate_shareholders lecture marchand','0','authenticated','a0000000-0000-4000-8000-000000000001',$q$select count(*)::text from corporate_shareholders$q$);
select zz_t('H2 corporate_companies UPDATE marchand','0','authenticated','a0000000-0000-4000-8000-000000000001',$q$with u as (update corporate_companies set name='HACKED' returning 1) select count(*)::text from u$q$);
select zz_t('H2 corporate_companies UPDATE actionnaire','0','authenticated','c0000000-0000-4000-8000-000000000001',$q$with u as (update corporate_companies set name='HACKED' returning 1) select count(*)::text from u$q$);
select zz_t('H2 corporate_companies UPDATE fondateur','1','authenticated','f0000000-0000-4000-8000-000000000001',$q$with u as (update corporate_companies set name=name returning 1) select count(*)::text from u$q$);
select zz_t('H2 corporate_shareholders DELETE marchand','0','authenticated','a0000000-0000-4000-8000-000000000001',$q$with d as (delete from corporate_shareholders returning 1) select count(*)::text from d$q$);

-- C7 : ecriture directe de user_roles via PostgREST (RLS)
select zz_t('C7 marchand s octroie founder (INSERT)','refus RLS','authenticated','a0000000-0000-4000-8000-000000000001',$q$with i as (insert into user_roles(user_id,role) values('a0000000-0000-4000-8000-000000000001','founder') returning 1) select count(*)::text from i$q$);
select zz_t('C7 marchand s octroie admin (INSERT)','refus RLS','authenticated','a0000000-0000-4000-8000-000000000001',$q$with i as (insert into user_roles(user_id,role) values('a0000000-0000-4000-8000-000000000001','admin') returning 1) select count(*)::text from i$q$);
select zz_t('C7 CO-FONDATEUR s octroie founder (INSERT)','refus RLS (doc: reste ouvert)','authenticated','d0000000-0000-4000-8000-000000000001',$q$with i as (insert into user_roles(user_id,role) values('d0000000-0000-4000-8000-000000000001','founder') returning 1) select count(*)::text from i$q$);
select zz_t('C7 anon lit user_roles','0','anon',null,$q$select count(*)::text from user_roles$q$);

select n, test, expected, observed from zz_results order by n;
truncate zz_results;
\pset pager off
select zz_t('getWallet repli: M1 lit son wallet','1','authenticated','a0000000-0000-4000-8000-000000000001',$q$select count(*)::text from wallets where merchant_id='a0000000-0000-4000-8000-000000000001'$q$);
select zz_t('wallets: M1 lit le wallet de M2','0','authenticated','a0000000-0000-4000-8000-000000000001',$q$select count(*)::text from wallets where merchant_id='a0000000-0000-4000-8000-000000000002'$q$);
select zz_t('wallets: M1 modifie son solde (UPDATE direct)','0 ou refus','authenticated','a0000000-0000-4000-8000-000000000001',$q$with u as (update wallets set available_balance=999999 where merchant_id='a0000000-0000-4000-8000-000000000001' returning 1) select count(*)::text from u$q$);
select zz_t('wallets: M1 insere un wallet pour lui (INSERT direct)','refus','authenticated','a0000000-0000-4000-8000-000000000001',$q$with i as (insert into wallets(merchant_id,available_balance) values(gen_random_uuid(),5) returning 1) select count(*)::text from i$q$);
select zz_t('withdrawal_requests: M1 insere un retrait direct','refus','authenticated','a0000000-0000-4000-8000-000000000001',$q$with i as (insert into withdrawal_requests(merchant_id,amount) values('a0000000-0000-4000-8000-000000000001',1) returning 1) select count(*)::text from i$q$);
select zz_t('save_merchant_payout_config M1','ok','authenticated','a0000000-0000-4000-8000-000000000001',$q$select save_merchant_payout_config('0799999999','M1','wave')::text$q$);
select zz_t('save_merchant_payout_config anon','42501','anon',null,$q$select save_merchant_payout_config('0799999999','X','wave')::text$q$);
select zz_t('evaluate_merchant_kyc_security anon (C4, non traite)','ouvert = faille C4','anon',null,$q$select evaluate_merchant_kyc_security('a0000000-0000-4000-8000-000000000002','CNI','1','x','u','s')::text$q$);
select n, test, expected, observed from zz_results order by n;
