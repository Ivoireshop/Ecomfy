CREATE OR REPLACE VIEW public.shops_public AS
SELECT id, business_name, business_description, slug, logo_url, banner_url,
  primary_color, secondary_color, theme, whatsapp_number, phone_number, email,
  address, city, country, currency, is_activated, is_published, seo_title,
  seo_description, chatbot_enabled, chatbot_welcome_message, payment_methods,
  favicon_url, facebook_pixels, tiktok_pixels, snapchat_pixels,
  google_analytics_ids, checkout_fields, cod_delivery_rate, theme_config,
  social_proof_enabled, tracking_enabled, is_suspended, delivery_advisor_phone,
  order_confirmation_message, custom_domain, created_at, updated_at
FROM public.shops
WHERE is_published = true AND is_activated = true;

CREATE OR REPLACE FUNCTION public.is_shop_publicly_visible(_shop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.shops
    WHERE id = _shop_id AND is_published = true AND is_activated = true
  );
$function$;