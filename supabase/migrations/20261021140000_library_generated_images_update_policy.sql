-- Bibliothèque : « Éditer le texte » met à jour generated_images.image_url, mais la table n'avait
-- aucune politique UPDATE. La RLS ignorait donc la requête sans erreur : l'image modifiée était
-- envoyée dans le stockage, le message de succès s'affichait, et la Bibliothèque montrait toujours
-- l'ancienne image.

DROP POLICY IF EXISTS "Users can update their own images" ON public.generated_images;
CREATE POLICY "Users can update their own images"
ON public.generated_images
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
