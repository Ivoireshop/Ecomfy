CREATE OR REPLACE FUNCTION public.strip_base64_images(_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text := COALESCE(_input, '');
  message text := '[Image non ajoutée — Visual Pro accepte uniquement les images de moins de 2 Mo. Compressez votre image puis téléversez-la avec le bouton image.]';
BEGIN
  IF v = '' THEN RETURN v; END IF;
  -- Replace unsafe embedded base64 images with a clear size/action message.
  v := regexp_replace(v, '<img[^>]*src\s*=\s*"data:image/[^"]*"[^>]*/?>', message, 'gi');
  v := regexp_replace(v, E'<img[^>]*src\\s*=\\s*\'data:image/[^\']*\'[^>]*/?>', message, 'gi');
  v := regexp_replace(v, 'data:image/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]{40,}', '', 'gi');
  RETURN v;
END;
$$;

UPDATE public.products
SET description = replace(
    replace(
      description,
      '[Image retirée — merci de la téléverser à nouveau]',
      '[Image non ajoutée — Visual Pro accepte uniquement les images de moins de 2 Mo. Compressez votre image puis téléversez-la avec le bouton image.]'
    ),
    '<p style="color:#999;font-style:italic">[Image retirée — merci de la téléverser à nouveau dans l''éditeur. Évitez le copier-coller des images, utilisez le bouton image de l''éditeur.]</p>',
    '<p style="color:#999;font-style:italic">[Image non ajoutée — Visual Pro accepte uniquement les images de moins de 2 Mo. Compressez votre image puis téléversez-la avec le bouton image.]</p>'
  )
WHERE description LIKE '%Image retirée%';