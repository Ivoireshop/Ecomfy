
-- Prevent anonymous visitors from reading owner identity columns on public course tables.
-- Authenticated roles retain full access; RLS policies remain unchanged.

REVOKE SELECT ON public.courses FROM anon;
GRANT SELECT (
  id, showcase_site_id, title, description, short_description,
  price, currency, image_url, category, duration, level,
  is_published, max_participants, whatsapp_group_link,
  created_at, updated_at
) ON public.courses TO anon;

REVOKE SELECT ON public.academy_courses FROM anon;
GRANT SELECT (
  id, title, description, category, level, duration,
  thumbnail_url, video_url, is_published, order_index,
  created_at, updated_at
) ON public.academy_courses TO anon;
