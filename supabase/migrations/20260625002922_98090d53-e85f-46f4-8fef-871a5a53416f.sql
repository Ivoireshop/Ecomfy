UPDATE public.products
SET description = regexp_replace(description, '<img[^>]*src="data:image[^"]*"[^>]*/?>(\s*</img>)?', '<p style="color:#999;font-style:italic">[Image retirée — merci de la téléverser à nouveau dans l''éditeur. Évitez le copier-coller des images, utilisez le bouton image de l''éditeur.]</p>', 'gi')
WHERE description ~* 'src="data:image'