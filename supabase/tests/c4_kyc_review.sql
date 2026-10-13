-- Vérification du correctif C4 : plus d'auto-validation KYC, revue manuelle, retraits suspendus.
-- Voir docs/VERIFICATION-CORRECTIFS-2026-10.md.
--
-- BASE JETABLE UNIQUEMENT (jamais dev ni production : ce script crée des utilisateurs et écrit dans les tables).
-- Prérequis : migrations 20260914190000 et 20260914200000 appliquées, plus auth.users / auth.uid() / auth.role(),
-- les rôles anon / authenticated / service_role, et public.is_corporate_founder() (hotfix 20261012120000).
-- Exécution : psql -U postgres -d <base jetable> -f supabase/tests/c4_kyc_review.sql
-- Chaque ligne affiche « expected » et « observed » ; elles doivent être égales (colonne ok).

\pset pager off
\set ON_ERROR_STOP off
create table if not exists zz_c4(n serial, test text, expected text, observed text);
create or replace function zz_c4_run(p_role text, p_uid uuid, p_sql text) returns text language plpgsql as $f$
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
create or replace function zz_c4_t(p_name text, p_exp text, p_role text, p_uid uuid, p_sql text) returns void language plpgsql as $f$
begin insert into zz_c4(test,expected,observed) values(p_name,p_exp,zz_c4_run(p_role,p_uid,p_sql)); end $f$;

-- Setup (en propriétaire)
insert into auth.users(id) values
 ('f0000000-0000-4000-8000-0000000000c4'),
 ('a0000000-0000-4000-8000-0000000000c4'),
 ('a0000000-0000-4000-8000-0000000000c5') on conflict do nothing;
insert into public.user_roles(user_id, role) values ('f0000000-0000-4000-8000-0000000000c4', 'founder');
insert into public.wallets(merchant_id, available_balance) values ('a0000000-0000-4000-8000-0000000000c4', 50000);

-- 1. La fonction d'auto-validation n'existe plus
select zz_c4_t('evaluate_merchant_kyc_security supprimée', 'ok: 0', 'postgres', null,
  $q$ select count(*)::text from pg_proc where proname = 'evaluate_merchant_kyc_security' $q$);

-- 2. Un marchand dépose un dossier en tentant de s'auto-valider : il reste PENDING
select zz_c4_t('INSERT avec VERIFIED => PENDING', 'ok: PENDING', 'authenticated', 'a0000000-0000-4000-8000-0000000000c4',
  $q$ with i as (
        insert into public.merchant_kyc(user_id, full_name, phone_number, document_type, document_number, document_front_url,
                                        verification_status, face_match_score, face_match_passed, doc_type_validated, verified_at)
        values ('a0000000-0000-4000-8000-0000000000c4', 'Marchand Test', '+2250700000000', 'cni', 'C123', 'https://x/recto.jpg',
                'VERIFIED', 95, true, true, now())
        returning verification_status)
      select verification_status from i $q$);

-- 3. UPDATE direct du statut : ignoré
select zz_c4_t('UPDATE statut => reste PENDING', 'ok: PENDING', 'authenticated', 'a0000000-0000-4000-8000-0000000000c4',
  $q$ with u as (update public.merchant_kyc set verification_status = 'VERIFIED', face_match_passed = true, verified_by = user_id
                 where user_id = 'a0000000-0000-4000-8000-0000000000c4' returning verification_status)
      select verification_status from u $q$);

-- 4. Retrait refusé : retraits suspendus (interrupteur global)
select zz_c4_t('retrait avec interrupteur coupé', 'ok: {"error": "Les retraits sont temporairement suspendus. Réessayez plus tard.", "success": false}',
  'authenticated', 'a0000000-0000-4000-8000-0000000000c4',
  $q$ select public.request_wallet_withdrawal_atomic(1000, 'mobile_money', '+2250700000000', 'Test')::text $q$);

-- 5. Le marchand ne peut pas lire ni écrire l'interrupteur
select zz_c4_t('authenticated lit ecomfy_pay_settings', 'ERR 42501', 'authenticated', 'a0000000-0000-4000-8000-0000000000c4',
  $q$ select count(*)::text from public.ecomfy_pay_settings $q$);
select zz_c4_t('authenticated écrit ecomfy_pay_settings', 'ERR 42501', 'authenticated', 'a0000000-0000-4000-8000-0000000000c4',
  $q$ update public.ecomfy_pay_settings set value = 'true'::jsonb returning 'x' $q$);

-- 6. Rouvrir les retraits (action serveur) : KYC toujours PENDING => refus
update public.ecomfy_pay_settings set value = 'true'::jsonb where key = 'withdrawals_enabled';
select zz_c4_t('retrait, interrupteur ouvert, KYC PENDING', 'ok: {"error": "Votre compte d''identité (KYC) doit être vérifié avant de demander un retrait.", "success": false}',
  'authenticated', 'a0000000-0000-4000-8000-0000000000c4',
  $q$ select public.request_wallet_withdrawal_atomic(1000, 'mobile_money', '+2250700000000', 'Test')::text $q$);

-- 7. Revue : un marchand, anon ne peuvent pas ; le fondateur peut
select zz_c4_t('marchand appelle review_merchant_kyc', 'ERR 42501', 'authenticated', 'a0000000-0000-4000-8000-0000000000c4',
  $q$ select public.review_merchant_kyc('a0000000-0000-4000-8000-0000000000c4', 'VERIFIED')::text $q$);
select zz_c4_t('anon appelle review_merchant_kyc', 'ERR 42501', 'anon', null,
  $q$ select public.review_merchant_kyc('a0000000-0000-4000-8000-0000000000c4', 'VERIFIED')::text $q$);
select zz_c4_t('fondateur rejette sans motif', 'ERR 22023', 'authenticated', 'f0000000-0000-4000-8000-0000000000c4',
  $q$ select public.review_merchant_kyc('a0000000-0000-4000-8000-0000000000c4', 'REJECTED')::text $q$);
select zz_c4_t('fondateur valide', 'ok: VERIFIED', 'authenticated', 'f0000000-0000-4000-8000-0000000000c4',
  $q$ select (public.review_merchant_kyc('a0000000-0000-4000-8000-0000000000c4', 'VERIFIED')->>'status') $q$);

-- 8. Un fondateur ne valide pas son propre dossier
insert into public.merchant_kyc(user_id, full_name, phone_number, document_type, document_number, document_front_url)
  values ('f0000000-0000-4000-8000-0000000000c4', 'Fondateur', '+2250700000001', 'cni', 'C999', 'https://x/f.jpg');
select zz_c4_t('fondateur valide son propre dossier', 'ERR 42501', 'authenticated', 'f0000000-0000-4000-8000-0000000000c4',
  $q$ select public.review_merchant_kyc('f0000000-0000-4000-8000-0000000000c4', 'VERIFIED')::text $q$);

-- 9. Dossier VERIFIED : le retrait passe
select zz_c4_t('retrait après revue manuelle', 'ok: true', 'authenticated', 'a0000000-0000-4000-8000-0000000000c4',
  $q$ select (public.request_wallet_withdrawal_atomic(1000, 'mobile_money', '+2250700000000', 'Test')->>'success') $q$);

-- 10. Changer la pièce d'un dossier VERIFIED le repasse en PENDING
select zz_c4_t('changement de pièce => PENDING', 'ok: PENDING', 'authenticated', 'a0000000-0000-4000-8000-0000000000c4',
  $q$ with u as (update public.merchant_kyc set document_front_url = 'https://x/autre.jpg'
                 where user_id = 'a0000000-0000-4000-8000-0000000000c4' returning verification_status)
      select verification_status from u $q$);
select zz_c4_t('retrait après changement de pièce', 'ok: false', 'authenticated', 'a0000000-0000-4000-8000-0000000000c4',
  $q$ select (public.request_wallet_withdrawal_atomic(1000, 'mobile_money', '+2250700000000', 'Test')->>'success') $q$);

-- 11. Un marchand ne touche pas au dossier d'un autre
select zz_c4_t('UPDATE du dossier d''un autre', 'ok: 0', 'authenticated', 'a0000000-0000-4000-8000-0000000000c5',
  $q$ with u as (update public.merchant_kyc set full_name = 'Pirate' where user_id = 'a0000000-0000-4000-8000-0000000000c4' returning 1)
      select count(*)::text from u $q$);

-- 12. Lecture : le fondateur voit tous les dossiers (écran de revue), un autre marchand n'en voit aucun
select zz_c4_t('fondateur lit les dossiers', 'ok: 2', 'authenticated', 'f0000000-0000-4000-8000-0000000000c4',
  $q$ select count(*)::text from public.merchant_kyc $q$);
select zz_c4_t('marchand sans dossier lit les dossiers', 'ok: 0', 'authenticated', 'a0000000-0000-4000-8000-0000000000c5',
  $q$ select count(*)::text from public.merchant_kyc $q$);

select n, test, expected, observed, (expected = observed) as ok from zz_c4 order by n;
