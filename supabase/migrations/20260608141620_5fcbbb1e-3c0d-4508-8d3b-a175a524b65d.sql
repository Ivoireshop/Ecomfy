-- Restrict sensitive columns from anonymous (public) reads.
-- RLS still controls row visibility; column-level GRANTs now hide the
-- specific sensitive fields from unauthenticated visitors.

-- 1) courses.whatsapp_group_link — private invite URL, only enrolled/
--    authenticated students or the owner should read it.
REVOKE SELECT ON public.courses FROM anon;
GRANT SELECT (
  id, showcase_site_id, title, description, short_description,
  price, currency, image_url, category, duration, level,
  is_published, max_participants, created_at, updated_at, user_id
) ON public.courses TO anon;

-- 2) product_reviews.reviewer_email — PII, must never be readable by
--    unauthenticated visitors. Shop owners (authenticated) keep full
--    access through the existing RLS policy.
REVOKE SELECT ON public.product_reviews FROM anon;
GRANT SELECT (
  id, shop_id, product_id, reviewer_name, rating, comment,
  status, created_at, updated_at
) ON public.product_reviews TO anon;