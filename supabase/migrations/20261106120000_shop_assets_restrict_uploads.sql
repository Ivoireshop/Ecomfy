-- Bucket public `shop-assets` : fin du dépôt ouvert à tout le monde.
--
-- Constat (revue du module Livraison, 06/11/2026) : 20260907140000 et 20260908170000 créent `shop-assets` avec
--   INSERT  WITH CHECK (bucket_id = 'shop-assets')   → n'importe qui, même sans compte, dépose n'importe quoi ;
--   UPDATE  USING      (bucket_id = 'shop-assets')   → n'importe qui peut écraser n'importe quel fichier, donc remplacer
--                                                      l'avatar d'un autre utilisateur par une image de son choix.
-- Le bucket étant public en lecture, c'est un hébergement d'images anonyme sous le domaine du projet.
--
-- Usages réels dans le code (seuls deux) :
--   * src/pages/Profile.tsx                          → avatars/<user_id>/avatar-<ts>.jpg   (upsert)
--   * src/components/delivery/CustomerParcelPhotoModal → parcel-photos/<fichier>           (envoi simple)
--
-- Nouvelle règle : seul un utilisateur connecté dépose, et seulement
--   * dans son propre dossier `avatars/<son id>/` (dépôt + remplacement) ;
--   * ou dans `parcel-photos/` (dépôt seul, pas d'écrasement ni de suppression).
-- La lecture reste publique (les URL d'images existantes continuent de fonctionner). Les pièces d'identité des
-- livreurs ne passent PAS par ce bucket : elles sont dans le bucket privé `delivery-kyc`.
--
-- Hors périmètre, à traiter séparément : le bucket `avatars` créé par 20260908170000 a la même faiblesse
-- (dépôt et mise à jour ouverts) ; il n'est utilisé qu'en repli par Profile.tsx.
--
-- Migration idempotente ; ne crée aucun bucket (elle ne fait que durcir celui qui existe).

DO $$
DECLARE
  pol text;
BEGIN
  -- Supprime TOUTES les politiques d'écriture existantes de ce bucket (quel que soit leur nom), pas seulement celles
  -- connues : une politique oubliée suffirait à garder le dépôt ouvert.
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      AND (coalesce(qual, '') LIKE '%shop-assets%' OR coalesce(with_check, '') LIKE '%shop-assets%')
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', pol);
  END LOOP;
END $$;

CREATE POLICY "shop_assets_insert_own_avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'shop-assets'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "shop_assets_update_own_avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'shop-assets'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'shop-assets'
    AND (storage.foldername(name))[1] = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "shop_assets_insert_parcel_photo" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'shop-assets'
    AND (storage.foldername(name))[1] = 'parcel-photos'
  );

-- Plafonds de taille et de type (le bucket créé par 20260907140000 n'en avait aucun).
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'shop-assets';
