-- Fix 1: Restrict image_cache shared rows to service role only
DROP POLICY IF EXISTS "Users can read their own cache entries" ON public.image_cache;
CREATE POLICY "Users can read their own cache entries"
  ON public.image_cache
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix 2: Restrict realtime.messages to per-topic ownership for ALL extensions
DROP POLICY IF EXISTS "Shop owners receive their order changes" ON realtime.messages;

CREATE POLICY "Authenticated users access only their own realtime channels"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    -- Users may only subscribe to their own user channel
    (realtime.messages.topic = ('user:' || auth.uid()::text))
    OR
    -- Shop owners may subscribe to their shop channel
    (EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.user_id = auth.uid()
        AND realtime.messages.topic = ('shop:' || s.id::text)
    ))
    OR
    -- Active collaborators may subscribe to the shop channel
    (EXISTS (
      SELECT 1 FROM public.shop_collaborators c
      WHERE c.user_id = auth.uid()
        AND c.status = 'active'
        AND realtime.messages.topic = ('shop:' || c.shop_id::text)
    ))
  );