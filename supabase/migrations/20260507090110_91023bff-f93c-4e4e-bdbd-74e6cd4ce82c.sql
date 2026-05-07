CREATE POLICY "Public can view published shops"
ON public.shops
FOR SELECT
TO anon, authenticated
USING (is_published = true AND is_activated = true AND is_suspended = false);