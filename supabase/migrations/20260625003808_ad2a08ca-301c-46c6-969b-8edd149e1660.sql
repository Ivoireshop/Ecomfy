
CREATE OR REPLACE FUNCTION public.strip_base64_images(_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text := COALESCE(_input, '');
BEGIN
  IF v = '' THEN RETURN v; END IF;
  -- Remove <img ... src="data:image/...;base64,..."> tags entirely
  v := regexp_replace(v, '<img[^>]*src\s*=\s*"data:image/[^"]*"[^>]*/?>', '[Image retirée — merci de la téléverser à nouveau]', 'gi');
  v := regexp_replace(v, E'<img[^>]*src\\s*=\\s*\'data:image/[^\']*\'[^>]*/?>', '[Image retirée — merci de la téléverser à nouveau]', 'gi');
  -- Strip any leftover raw data:image URIs in attributes or text
  v := regexp_replace(v, 'data:image/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]{40,}', '', 'gi');
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sanitize_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.description := public.strip_base64_images(public.sanitize_html_content(NEW.description));
  NEW.short_description := public.strip_base64_images(public.sanitize_html_content(NEW.short_description));
  RETURN NEW;
END $$;
