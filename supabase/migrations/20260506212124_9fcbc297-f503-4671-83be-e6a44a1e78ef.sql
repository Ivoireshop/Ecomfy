
-- Rollback: garder le bucket public pour préserver l'affichage actuel
UPDATE storage.buckets SET public = true WHERE id = 'generated-content';

DROP POLICY IF EXISTS "Users view their own generated content" ON storage.objects;
DROP POLICY IF EXISTS "Users upload their own generated content" ON storage.objects;
DROP POLICY IF EXISTS "Users delete their own generated content" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access generated content" ON storage.objects;

-- Restaurer la lecture publique
CREATE POLICY "Public can view generated content"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'generated-content');

-- Mais restreindre l'écriture/suppression au propriétaire (folder = user_id)
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

CREATE POLICY "Users update their own generated content"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'generated-content'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
