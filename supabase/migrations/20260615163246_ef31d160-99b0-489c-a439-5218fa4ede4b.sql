
-- 1) product_reviews: stop exposing reviewer_email to the public.
-- Create a SECURITY DEFINER view returning only safe columns for approved reviews
-- of publicly visible shops, then remove the broad public SELECT policy.

CREATE OR REPLACE VIEW public.product_reviews_public
WITH (security_invoker = false) AS
SELECT
  pr.id,
  pr.shop_id,
  pr.product_id,
  pr.reviewer_name,
  pr.rating,
  pr.comment,
  pr.created_at
FROM public.product_reviews pr
WHERE pr.status = 'approved'
  AND public.is_shop_publicly_visible(pr.shop_id);

REVOKE ALL ON public.product_reviews_public FROM PUBLIC;
GRANT SELECT ON public.product_reviews_public TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can view approved reviews" ON public.product_reviews;

-- 2) showcase_sites: stop exposing domain_verification_code and related
-- domain/SSL metadata to the public. Mirror the shops_public pattern.

CREATE OR REPLACE VIEW public.showcase_sites_public
WITH (security_invoker = false) AS
SELECT
  s.id,
  s.user_id,
  s.subdomain,
  s.custom_domain,
  s.business_name,
  s.business_description,
  s.owner_name,
  s.owner_photo_url,
  s.whatsapp_number,
  s.phone_number,
  s.formation_title,
  s.formation_description,
  s.formation_price,
  s.formation_image_url,
  s.is_published,
  s.created_at,
  s.updated_at,
  s.hero_title,
  s.hero_subtitle,
  s.about_title,
  s.about_description,
  s.features,
  s.cta_title,
  s.cta_description,
  s.theme,
  s.primary_color,
  s.secondary_color,
  s.logo_url,
  s.hero_image_url,
  s.about_image_url,
  s.seo_title,
  s.seo_description,
  s.seo_keywords,
  s.og_image_url,
  s.og_type,
  s.twitter_card,
  s.text_color,
  s.about_layout,
  s.gallery_text_position,
  s.font_family,
  s.theme_mode,
  s.formations,
  s.formations_text_align,
  s.hero_video_url,
  s.about_video_url,
  s.hero_title_size,
  s.hero_title_color,
  s.biography_title,
  s.biography_content,
  s.biography_image_url,
  s.professional_experience,
  s.background_color,
  s.footer_color,
  s.biography_image_position,
  s.stats_years_experience,
  s.stats_satisfied_clients,
  s.stats_projects_completed,
  s.stats_show_section,
  s.navigation_text_color,
  s.navigation_bg_color,
  s.price_text_color,
  s.price_bg_color,
  s.stats_text_color,
  s.stats_bg_color
FROM public.showcase_sites s
WHERE s.is_published = true;

REVOKE ALL ON public.showcase_sites_public FROM PUBLIC;
GRANT SELECT ON public.showcase_sites_public TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can view published showcase sites" ON public.showcase_sites;
