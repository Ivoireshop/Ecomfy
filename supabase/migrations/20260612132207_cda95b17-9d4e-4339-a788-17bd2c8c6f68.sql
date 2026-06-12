-- 1) shop-images INSERT: enforce path ownership (first folder must be the uploader's uid)
DROP POLICY IF EXISTS "Authenticated users can upload shop images" ON storage.objects;
CREATE POLICY "Users can upload to their own shop-images folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'shop-images'
    AND auth.uid() IS NOT NULL
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 2) showcase_analytics INSERT: restrict to published sites only
DROP POLICY IF EXISTS "Anyone can insert analytics for valid sites" ON public.showcase_analytics;
CREATE POLICY "Anyone can insert analytics for published sites"
  ON public.showcase_analytics FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.showcase_sites
      WHERE showcase_sites.id = showcase_analytics.showcase_site_id
        AND showcase_sites.is_published = true
    )
  );