-- Capture, en lecture seule, de la « logique » de la base avant un déploiement : fonctions (corps + droits), politiques RLS,
-- déclencheurs, tâches planifiées, publication temps réel et contraintes CHECK de public.
--
-- Pourquoi : presque toutes les migrations d'Ecomfy sont des CREATE OR REPLACE FUNCTION / DROP POLICY + CREATE POLICY.
-- Elles n'ont pas de « down » : le seul moyen fiable de revenir à l'état d'avant est de rejouer ce qui existait réellement
-- en base, pas ce que les fichiers du dépôt laissent supposer (la base réelle diverge des migrations, voir
-- docs/DEPLOIEMENT-COMPLET-2026-10.md, règle 1).
--
-- Usage (éditeur SQL du projet CONCERNÉ, production comprise) : coller le fichier en entier, exécuter, puis exporter le
-- résultat en CSV (bouton « Export » > CSV) vers un dossier HORS du dépôt, nommé avec la date et le projet.
-- Aucune écriture : seulement des SELECT. Ne contient aucune donnée de table, mais des définitions : à ranger comme du code.
-- Pour rejouer un objet : filtrer le CSV sur la colonne `object`, copier la colonne `ddl` dans l'éditeur SQL.
--
-- Colonnes : kind (function | function_acl | policy | trigger | cron | publication | check), object, ddl.

with fn as (
  select p.oid, p.oid::regprocedure::text as sig, n.nspname, p.proname, p.proacl
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    -- exclut les fonctions fournies par une extension (pg_trgm, etc.)
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
)
select 'function' as kind, fn.sig as object, pg_get_functiondef(fn.oid) || ';' as ddl
from fn

union all
-- Droits d'exécution : sans proacl, les droits par défaut (EXECUTE pour PUBLIC) s'appliquent et rien n'est à rejouer.
select 'function_acl', fn.sig,
       'REVOKE ALL ON FUNCTION ' || fn.sig || ' FROM PUBLIC;' ||
       coalesce((
         select string_agg(
                  ' GRANT EXECUTE ON FUNCTION ' || fn.sig || ' TO ' ||
                  case when a.grantee = 0 then 'PUBLIC' else quote_ident(r.rolname) end || ';', '')
         from aclexplode(fn.proacl) a
         left join pg_roles r on r.oid = a.grantee
         where a.privilege_type = 'EXECUTE'
       ), '')
from fn
where fn.proacl is not null

union all
select 'policy', pol.schemaname || '.' || pol.tablename || ' / ' || pol.policyname,
       'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON ' || quote_ident(pol.schemaname) || '.' || quote_ident(pol.tablename) || '; ' ||
       'CREATE POLICY ' || quote_ident(pol.policyname) || ' ON ' || quote_ident(pol.schemaname) || '.' || quote_ident(pol.tablename) ||
       ' AS ' || pol.permissive || ' FOR ' || pol.cmd ||
       ' TO ' || array_to_string(pol.roles, ', ') ||
       coalesce(' USING (' || pol.qual || ')', '') ||
       coalesce(' WITH CHECK (' || pol.with_check || ')', '') || ';'
from pg_policies pol
where pol.schemaname = 'public'

union all
select 'trigger', c.relname || ' / ' || t.tgname,
       'DROP TRIGGER IF EXISTS ' || quote_ident(t.tgname) || ' ON ' || c.oid::regclass::text || '; ' || pg_get_triggerdef(t.oid) || ';'
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not t.tgisinternal

union all
select 'check', c.conrelid::regclass::text || ' / ' || c.conname,
       'ALTER TABLE ' || c.conrelid::regclass::text || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(c.conname) || '; ' ||
       'ALTER TABLE ' || c.conrelid::regclass::text || ' ADD CONSTRAINT ' || quote_ident(c.conname) || ' ' ||
       pg_get_constraintdef(c.oid) || ';' || case when c.convalidated then '' else ' -- NOT VALID' end
from pg_constraint c
join pg_namespace n on n.oid = c.connamespace
where n.nspname = 'public' and c.contype = 'c'

union all
select 'publication', pt.pubname || ' / ' || pt.schemaname || '.' || pt.tablename,
       'ALTER PUBLICATION ' || quote_ident(pt.pubname) || ' ADD TABLE ' || quote_ident(pt.schemaname) || '.' || quote_ident(pt.tablename) || ';'
from pg_publication_tables pt
where pt.pubname = 'supabase_realtime' and pt.schemaname = 'public'

union all
-- pg_cron : si l'extension n'est pas installée sur le projet, supprimer ce bloc (la table cron.job n'existe pas).
select 'cron', j.jobname,
       'SELECT cron.schedule(' || quote_literal(j.jobname) || ', ' || quote_literal(j.schedule) || ', ' || quote_literal(j.command) || ');'
       || case when j.active then '' else ' -- INACTIF' end
from cron.job j

order by 1, 2;
