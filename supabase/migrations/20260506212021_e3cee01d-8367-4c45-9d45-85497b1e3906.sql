
-- Vague 3 — Sécurisation finale

-- 1. Bucket generated-content devient privé + RLS scope par user (folder = user_id)
UPDATE storage.buckets SET public = false WHERE id = 'generated-content';

DROP POLICY IF EXISTS "Public can view generated content" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view generated content" ON storage.objects;

CREATE POLICY "Users view their own generated content"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'generated-content'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users upload their own generated content"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'generated-content'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users delete their own generated content"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'generated-content'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Service role full access generated content"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'generated-content')
WITH CHECK (bucket_id = 'generated-content');

-- 2. Realtime RLS — restreindre subscriptions aux propriétaires
-- realtime.messages = canal de broadcast Postgres Changes
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop owners receive their order changes" ON realtime.messages;
CREATE POLICY "Shop owners receive their order changes"
ON realtime.messages FOR SELECT
TO authenticated
USING (
  -- topic format attendu: "shop:<shop_id>"
  (
    extension = 'postgres_changes'
    AND (
      -- Restreint l'écoute aux topics commençant par shop:<id> dont l'utilisateur est propriétaire
      EXISTS (
        SELECT 1 FROM public.shops s
        WHERE s.user_id = auth.uid()
          AND topic = 'shop:' || s.id::text
      )
      OR EXISTS (
        SELECT 1 FROM public.generated_videos v
        WHERE v.user_id = auth.uid()
          AND topic = 'user:' || v.user_id::text
      )
      OR EXISTS (
        SELECT 1 FROM public.generation_queue q
        WHERE q.user_id = auth.uid()
          AND topic = 'user:' || q.user_id::text
      )
    )
  )
  OR extension <> 'postgres_changes'
);

-- 3. Search path mutable — sécuriser fonctions restantes
ALTER FUNCTION public.update_bookings_updated_at() SET search_path = public;

-- 4. Extension pg_net hors public si présente (tentative douce; ignore si inexistante)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    -- ne rien faire automatiquement: le déplacement peut casser des triggers existants
    RAISE NOTICE 'pg_net présent dans public; déplacement manuel recommandé';
  END IF;
END $$;
