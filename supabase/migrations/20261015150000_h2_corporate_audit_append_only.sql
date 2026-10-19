-- H2 (suite) : journal d'audit et acceptations de documents en ajout seul, au nom de l'appelant.
--
-- Le hotfix 20261012120000 laissait deux failles résiduelles sur ces deux tables :
--   - tout utilisateur connecté pouvait insérer une ligne au nom de n'importe qui (WITH CHECK (true)) ;
--   - les fondateurs avaient « FOR ALL », donc pouvaient modifier ou effacer le journal qui les surveille.
--
-- Nouvelle règle (idempotente, à appliquer APRÈS 20261012120000) :
--   - lecture : is_corporate_reader(), inchangée ;
--   - insertion : un fondateur / cofondateur, ou un utilisateur connecté pour sa propre ligne
--     (user_id = auth.uid() et e-mail identique à celui du JWT) ;
--   - aucune politique UPDATE ni DELETE : ces lignes ne se modifient ni ne s'effacent par l'API.
--     service_role (RLS contournée) et les suppressions en cascade de auth.users restent possibles.

DO $$
DECLARE
  t text;
  pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY['corporate_audit_logs', 'corporate_document_acceptances'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;

    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_corporate_reader())',
      'Corporate read ' || t, t);
  END LOOP;

  IF to_regclass('public.corporate_audit_logs') IS NOT NULL THEN
    CREATE POLICY "Corporate append corporate_audit_logs" ON public.corporate_audit_logs
      FOR INSERT TO authenticated
      WITH CHECK (
        public.is_corporate_founder()
        OR (
          user_id = auth.uid()
          AND (user_email IS NULL OR lower(user_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
        )
      );
  END IF;

  IF to_regclass('public.corporate_document_acceptances') IS NOT NULL THEN
    CREATE POLICY "Corporate append corporate_document_acceptances" ON public.corporate_document_acceptances
      FOR INSERT TO authenticated
      WITH CHECK (
        public.is_corporate_founder()
        OR (
          user_id = auth.uid()
          AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
      );
  END IF;
END $$;
