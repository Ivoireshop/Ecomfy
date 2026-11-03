-- Alignement de l'historique des migrations de la PRODUCTION (projet yfggrceynzcwklbxhgix).
-- Établi le 03/11/2026 à partir d'un contrôle en lecture seule de la prod (306 objets testés dans 49 fichiers).
--
-- CE QUE FAIT CE SCRIPT : il ne modifie AUCUN objet métier (ni table, ni fonction, ni politique). Il inscrit
-- seulement, dans supabase_migrations.schema_migrations, des migrations déjà exécutées à la main le 27/10, pour
-- que le CLI cesse de les croire « non appliquées ». Rejouable (ON CONFLICT DO NOTHING).
--
-- CE QU'IL NE FAIT PAS : il ne rend pas `supabase db push` utilisable à lui seul. Voir la section « Reste bloquant »
-- en bas : des fichiers jamais appliqués en prod (livraison, facturation par seuil…) sont toujours dans
-- supabase/migrations/. Tant qu'ils y sont, `db push` tenterait de les lancer (ou refuserait, s'ils sont plus
-- anciens que la dernière migration de la prod). Rien n'est inscrit pour eux : ce serait mentir sur l'état de la base.
--
-- AVANT DE LANCER
--   1. Renommer le doublon de version 20261023100000 (deux fichiers portent cette version ; la clé primaire
--      de schema_migrations la refuse et le CLI s'arrête) :
--        git mv supabase/migrations/20261023100000_product_seo_fields.sql supabase/migrations/20261023100100_product_seo_fields.sql
--      Le bloc ci-dessous inscrit 20261023100100 en supposant ce renommage.
--   2. Appliquer d'abord 20261103100000_studio_ai_generation_log.sql (voir docs/DEPLOIEMENT-RESTE-A-FAIRE-2026-11.md §10),
--      PUIS décommenter sa ligne dans le bloc 1.
--   3. Éditeur SQL du dashboard prod, ou :
--        npx supabase@latest db query --remote=yfggrceynzcwklbxhgix -f supabase/maintenance/aligner_historique_migrations_prod.sql
--
-- Sauvegarde et retour arrière : voir la fin du fichier.

-- ═══ 0. Contrôle préalable (lecture seule) : ce qui est déjà inscrit parmi les versions ci-dessous ═══
select version, name from supabase_migrations.schema_migrations
where version in ('20261019120000','20261023100000','20261030100000','20261103100000') order by version;

begin;

-- Copie de l'historique avant modification (supprimable plus tard : drop table supabase_migrations.schema_migrations_backup_20261103;)
create table if not exists supabase_migrations.schema_migrations_backup_20261103 as
select * from supabase_migrations.schema_migrations;

-- ═══ 1. Migrations vérifiées en prod (tous les objets présents le 03/11/2026) ═══
-- Bloc A : plus récentes que 20261018130000 (celles que `db push` voudrait rejouer).
insert into supabase_migrations.schema_migrations (version, name)
values
  ('20261019120000', 'fix_subscription_activation_and_expiry'),
  ('20261020120000', 'affiliate_payout_and_legacy_referral_hardening'),
  ('20261020130000', 'top_sellers_skip_inline_avatars'),
  ('20261021120000', 'seo_intelligence_protect_tokens'),
  ('20261021130000', 'community_chat_hardening'),
  ('20261021140000', 'library_generated_images_update_policy'),
  ('20261021150000', 'restricted_shop_orders_server_masking'),
  ('20261022100000', 'delivery_rls_recursion_and_push_guard'),
  ('20261022110000', 'delivery_driver_contacts'),
  ('20261022120000', 'abandoned_carts_fixes'),
  ('20261022130000', 'shop_promo_codes'),
  ('20261022140000', 'ecomfy_pay_ledger_schema'),
  -- Partielle PAR CHOIX : sans shop_invoices, seule la partie « 3. Demande de retrait » a été appliquée (M17-2).
  ('20261022150000', 'references_non_devinables'),
  ('20261023100000', 'ecomfy_pay_confirm_transaction'),
  ('20261023100100', 'product_seo_fields'),                 -- après le renommage de l'étape 1 ci-dessus
  ('20261023110000', 'finance_weekly_summary_cron'),
  ('20261023120000', 'billing_commission_payment_lock_and_invoices'),
  -- Publication realtime : `shops` y est ; `shop_invoices` n'existe pas en prod (le fichier la saute alors).
  ('20261023130000', 'billing_realtime_publication'),
  ('20261023140000', 'billing_enforce_deadlines_cron'),
  ('20261023160000', 'product_reviews_hardening'),
  ('20261024100000', 'social_proof_real_orders'),
  ('20261025100000', 'shops_billing_columns_guard'),
  ('20261027120000', 'top_sellers_shop_logo_fallback'),
  ('20261030100000', 'delivery_providers_verification_guard')
  -- , ('20261103100000', 'studio_ai_generation_log')       -- À DÉCOMMENTER seulement après l'avoir appliquée (voir « avant de lancer » 2)
on conflict (version) do nothing;

-- Bloc B : plus anciennes que 20261018130000, objets tous présents (facultatif, mais évite l'erreur
-- « Found local migration files to be inserted before the last migration on remote database »).
insert into supabase_migrations.schema_migrations (version, name)
values
  ('20260916132500', 'aggregate_top_sellers_by_seller'),
  ('20260916193000', 'fix_collaborator_full_admin_has_shop_role'),
  ('20260916201500', 'fix_collaborator_permissions_and_enum'),
  ('20260918120000', 'add_scheduled_delivery_date_to_orders'),
  ('20260919173000', 'fix_shop_collab_role_enum_and_text_array'),
  ('20261003120000', 'fix_billing_partial_payments_sync'),
  -- Version corrigée à la main le 27/10 (M14) : tables shop_seo_* présentes, politiques « Tenant isolation … ».
  ('20260902120000', 'ecomfy_seo_intelligence')
on conflict (version) do nothing;

-- ═══ 2. Contrôle de fin, avant de valider ═══
select count(*) as inscrites_maintenant, count(*) - 221 as ajoutees
from supabase_migrations.schema_migrations;                      -- attendu : 221 + 31 = 252 (+ 1 avec 20261103100000)

commit;

-- ═══ Reste bloquant pour `supabase db push` (NON inscrit : jamais appliqué, ou seulement en partie, en prod) ═══
-- Ces fichiers sont dans supabase/migrations/ mais leurs objets sont absents ou incomplets en prod (contrôle du 03/11).
-- Ne rien inscrire pour eux. Pour utiliser `db push`, il faut les sortir du dossier (par exemple vers
-- supabase/migrations_non_appliquees/) tant que leur chantier n'est pas déployé, puis les y remettre.
--
--  Livraison (module `delivery_companies` absent, voir docs/H5-LIVRAISON-MISE-EN-PROD-2026-10.md) :
--    20260906010000_ecomfy_delivery_module            (0/31 objets ; BLOQUANTE telle quelle, ne jamais lancer)
--    20260907140000_fix_delivery_rls_and_submission   (0/4)
--    20261016120000_h5_delivery_verification_guard    (0/2 ; échouerait en 42P01)
--  Facturation par seuil (shop_invoices absente) :
--    20260909100000_ecomfy_billing_threshold_system   (1/9)
--    20260911120000_zero_commission_for_subscribed_shops          (2/3 : confirm_invoice_payment absente)
--    20260912000000_fix_subscription_plan_aliases_and_zero_commission (8/9 : check_and_trigger_billing_threshold absente)
--    20261023150000_billing_threshold_system_fixes    (0/4 ; « ne jamais appliquer » tant que la facturation par seuil n'est pas déployée)
--  Autres chantiers jamais déployés :
--    20260906000000_corporate_invitations_workflow    (0/3)
--    20260910131500_add_bundle_title_to_products      (colonne products.bundle_title absente)
--    20260912150000_create_connectus_social_schema    (0/32)
--    20260929120000_stock_traceability_system         (0/7)
--    20261005174500_profile_completion_google         (1/5 : colonnes profiles.first_name… absentes)
--  À examiner une par une avant de décider (objets partiellement présents, probablement remplacés par des
--  migrations ultérieures ou adaptés à la main ; ne pas inscrire sans les avoir relues) :
--    20260902140000_strict_multitenant_privacy        (7/18 : politiques « Strict read … » et is_authorized_corporate_member absentes)
--    20260908170000_ensure_avatars_and_shop_assets_buckets (politiques storage absentes ; buckets à vérifier, voir §14 du journal du 27/10)
--    20260911101000_update_shop_collab_roles_enum     (aucun objet testable)
--    20260918000000_audit_fix_collaborators_permissions (1/3 : 2 politiques « Collaborators manage … » absentes)
--    20261005160000_ecomfy_affiliate_system           (24/26 : 2 politiques d'insertion, sans doute retirées par 20261020120000)
--
-- Retour arrière de ce script : la table de sauvegarde contient l'historique d'origine :
--   begin;
--   delete from supabase_migrations.schema_migrations s
--    where not exists (select 1 from supabase_migrations.schema_migrations_backup_20261103 b where b.version = s.version);
--   commit;
