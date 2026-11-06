-- Bucket public `avatars` : fin du dépôt et de la mise à jour ouverts à tout le monde.
--
-- Même défaut que `shop-assets` (voir 20261106120000). 20260908170000 a ajouté, en plus des bonnes politiques de
-- 20260609133332 (dossier = id de l'utilisateur), deux politiques « Public Upload/Update for avatars » sans aucune
-- condition : sans compte, on dépose n'importe quoi et on écrase l'avatar de n'importe qui. Les politiques
-- permissives s'additionnent : les bonnes ne protégeaient donc rien tant que celles-ci existaient.
--
-- Usage dans le code : repli de src/pages/Profile.tsx, chemin `<user_id>/avatar-<ts>.jpg` (upsert).
--
-- Règle après cette migration : un utilisateur connecté dépose, remplace et supprime seulement dans son propre
-- dossier `<son id>/`. Lecture publique inchangée (les URL existantes fonctionnent). Images seulement, 10 Mo.
--
-- Idempotente ; ne crée aucun bucket. Toutes les politiques d'écriture du bucket sont remplacées (quel que soit
-- leur nom), le SELECT public n'est pas touché.

DO $$
DECLARE
  pol text;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      AND (coalesce(qual, '') LIKE '%bucket_id = ''avatars''%' OR coalesce(with_check, '') LIKE '%bucket_id = ''avatars''%')
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', pol);
  END LOOP;
END $$;

CREATE POLICY "avatars_insert_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_update_own_folder" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_delete_own_folder" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'avatars';
