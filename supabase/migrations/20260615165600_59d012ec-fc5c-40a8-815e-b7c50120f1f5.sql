
-- =========================================================
-- LOT 2 SECURITY: HTML sanitization, tracking validation,
-- and server-side order price enforcement
-- =========================================================

-- ---------- 1. HTML sanitization ----------
CREATE OR REPLACE FUNCTION public.sanitize_html_content(_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text := COALESCE(_input, '');
BEGIN
  IF v = '' THEN RETURN v; END IF;
  -- Remove <script>...</script>
  v := regexp_replace(v, '<\s*script\b[^>]*>.*?<\s*/\s*script\s*>', '', 'gis');
  v := regexp_replace(v, '<\s*script\b[^>]*/?>', '', 'gi');
  -- Remove <iframe>, <object>, <embed>, <link>, <meta>, <style>, <form>
  v := regexp_replace(v, '<\s*(iframe|object|embed|form|style|link|meta)\b[^>]*>.*?<\s*/\s*\1\s*>', '', 'gis');
  v := regexp_replace(v, '<\s*(iframe|object|embed|form|style|link|meta)\b[^>]*/?>', '', 'gi');
  -- Remove inline event handlers (onclick=, onerror=, ...)
  v := regexp_replace(v, '\son[a-z]+\s*=\s*"[^"]*"', '', 'gi');
  v := regexp_replace(v, E'\\son[a-z]+\\s*=\\s*\'[^\']*\'', '', 'gi');
  v := regexp_replace(v, '\son[a-z]+\s*=\s*[^\s>]+', '', 'gi');
  -- Neutralize javascript: and data:text/html URIs
  v := regexp_replace(v, '(href|src|action|formaction)\s*=\s*"\s*(javascript|data\s*:\s*text/html|vbscript)[^"]*"', '\1="#"', 'gi');
  v := regexp_replace(v, E'(href|src|action|formaction)\\s*=\\s*\'\\s*(javascript|data\\s*:\\s*text/html|vbscript)[^\']*\'', '\1=''#''', 'gi');
  RETURN v;
END;
$$;

-- Generic trigger factory: one function per column to keep things simple
CREATE OR REPLACE FUNCTION public.trg_sanitize_products()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.description := public.sanitize_html_content(NEW.description);
  NEW.short_description := public.sanitize_html_content(NEW.short_description);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.trg_sanitize_shops()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.business_description := public.sanitize_html_content(NEW.business_description);
  NEW.order_confirmation_message := public.sanitize_html_content(NEW.order_confirmation_message);
  NEW.chatbot_welcome_message := public.sanitize_html_content(NEW.chatbot_welcome_message);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.trg_sanitize_community_messages()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.body := public.sanitize_html_content(NEW.body);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.trg_sanitize_community_topics()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.title := public.sanitize_html_content(NEW.title);
  NEW.body := public.sanitize_html_content(NEW.body);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.trg_sanitize_community_replies()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.body := public.sanitize_html_content(NEW.body);
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.trg_sanitize_blog_posts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.title := public.sanitize_html_content(NEW.title);
  NEW.excerpt := public.sanitize_html_content(NEW.excerpt);
  NEW.content := public.sanitize_html_content(NEW.content);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS sanitize_products ON public.products;
CREATE TRIGGER sanitize_products
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.trg_sanitize_products();

DROP TRIGGER IF EXISTS sanitize_shops ON public.shops;
CREATE TRIGGER sanitize_shops
  BEFORE INSERT OR UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.trg_sanitize_shops();

DROP TRIGGER IF EXISTS sanitize_community_messages ON public.community_messages;
CREATE TRIGGER sanitize_community_messages
  BEFORE INSERT OR UPDATE ON public.community_messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_sanitize_community_messages();

DROP TRIGGER IF EXISTS sanitize_community_topics ON public.community_topics;
CREATE TRIGGER sanitize_community_topics
  BEFORE INSERT OR UPDATE ON public.community_topics
  FOR EACH ROW EXECUTE FUNCTION public.trg_sanitize_community_topics();

DROP TRIGGER IF EXISTS sanitize_community_replies ON public.community_replies;
CREATE TRIGGER sanitize_community_replies
  BEFORE INSERT OR UPDATE ON public.community_replies
  FOR EACH ROW EXECUTE FUNCTION public.trg_sanitize_community_replies();

DROP TRIGGER IF EXISTS sanitize_blog_posts ON public.blog_posts;
CREATE TRIGGER sanitize_blog_posts
  BEFORE INSERT OR UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.trg_sanitize_blog_posts();

-- ---------- 2. Tracking pixel validation ----------
CREATE OR REPLACE FUNCTION public.validate_shop_tracking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_clean text[];
  v_item text;
BEGIN
  -- Facebook / Meta pixel: 10-17 digit numeric id
  IF NEW.facebook_pixels IS NOT NULL THEN
    v_clean := '{}';
    FOREACH v_item IN ARRAY NEW.facebook_pixels LOOP
      v_item := btrim(COALESCE(v_item,''));
      IF v_item ~ '^[0-9]{10,17}$' THEN v_clean := array_append(v_clean, v_item); END IF;
    END LOOP;
    NEW.facebook_pixels := v_clean;
  END IF;

  -- TikTok pixel: alphanumeric 15-40 chars
  IF NEW.tiktok_pixels IS NOT NULL THEN
    v_clean := '{}';
    FOREACH v_item IN ARRAY NEW.tiktok_pixels LOOP
      v_item := btrim(COALESCE(v_item,''));
      IF v_item ~ '^[A-Za-z0-9]{15,40}$' THEN v_clean := array_append(v_clean, v_item); END IF;
    END LOOP;
    NEW.tiktok_pixels := v_clean;
  END IF;

  -- Snapchat pixel: UUID format
  IF NEW.snapchat_pixels IS NOT NULL THEN
    v_clean := '{}';
    FOREACH v_item IN ARRAY NEW.snapchat_pixels LOOP
      v_item := btrim(COALESCE(v_item,''));
      IF v_item ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        v_clean := array_append(v_clean, lower(v_item));
      END IF;
    END LOOP;
    NEW.snapchat_pixels := v_clean;
  END IF;

  -- Google Analytics: G-XXXXX or UA-XXXXX-X
  IF NEW.google_analytics_ids IS NOT NULL THEN
    v_clean := '{}';
    FOREACH v_item IN ARRAY NEW.google_analytics_ids LOOP
      v_item := btrim(COALESCE(v_item,''));
      IF v_item ~ '^(G-[A-Z0-9]{4,20}|UA-[0-9]{4,12}-[0-9]{1,4})$' THEN
        v_clean := array_append(v_clean, v_item);
      END IF;
    END LOOP;
    NEW.google_analytics_ids := v_clean;
  END IF;

  -- GA4 measurement id
  IF NEW.ga4_measurement_id IS NOT NULL AND NEW.ga4_measurement_id <> '' THEN
    IF NEW.ga4_measurement_id !~ '^G-[A-Z0-9]{4,20}$' THEN
      NEW.ga4_measurement_id := NULL;
    END IF;
  END IF;

  -- Legacy free-text GA snippet: never trust it
  NEW.google_analytics_code := '';

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS validate_shop_tracking ON public.shops;
CREATE TRIGGER validate_shop_tracking
  BEFORE INSERT OR UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.validate_shop_tracking();

-- Clean existing rows once
UPDATE public.shops SET google_analytics_code = '' WHERE google_analytics_code IS DISTINCT FROM '';

-- ---------- 3. Server-side order price enforcement ----------
CREATE OR REPLACE FUNCTION public.enforce_order_item_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_product record;
  v_order_shop uuid;
BEGIN
  SELECT shop_id INTO v_order_shop FROM public.orders WHERE id = NEW.order_id;
  IF v_order_shop IS NULL THEN
    RAISE EXCEPTION 'Commande introuvable';
  END IF;

  SELECT id, shop_id, price, name, is_published, COALESCE(stock_quantity, 0) AS stock_quantity
    INTO v_product
    FROM public.products
    WHERE id = NEW.product_id;

  IF v_product.id IS NULL OR v_product.shop_id <> v_order_shop OR v_product.is_published <> true THEN
    RAISE EXCEPTION 'Produit indisponible';
  END IF;

  IF NEW.quantity IS NULL OR NEW.quantity < 1 OR NEW.quantity > 999 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;

  -- Always trust the DB price, never the client
  NEW.unit_price := v_product.price;
  NEW.total_price := ROUND(v_product.price * NEW.quantity, 2);
  NEW.product_name := COALESCE(NULLIF(btrim(NEW.product_name), ''), v_product.name);

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS enforce_order_item_price ON public.order_items;
CREATE TRIGGER enforce_order_item_price
  BEFORE INSERT OR UPDATE OF product_id, quantity, unit_price, total_price ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_item_price();

-- Recompute order totals from authoritative item rows
CREATE OR REPLACE FUNCTION public.recompute_order_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order_id uuid;
  v_subtotal numeric;
  v_rate numeric;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);

  SELECT COALESCE(SUM(total_price), 0) INTO v_subtotal
    FROM public.order_items WHERE order_id = v_order_id;

  SELECT COALESCE(s.commission_rate, 0.025) INTO v_rate
    FROM public.orders o JOIN public.shops s ON s.id = o.shop_id
    WHERE o.id = v_order_id;

  UPDATE public.orders
    SET subtotal = v_subtotal,
        total = v_subtotal,
        commission_amount = ROUND(v_subtotal * COALESCE(v_rate, 0.025), 2),
        updated_at = now()
    WHERE id = v_order_id;

  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS recompute_order_totals ON public.order_items;
CREATE TRIGGER recompute_order_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.recompute_order_totals();
