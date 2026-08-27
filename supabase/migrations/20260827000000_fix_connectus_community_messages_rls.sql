-- Fix RLS policies and table permissions for ConnectUs (community_messages)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_messages TO authenticated;
GRANT SELECT, INSERT ON public.community_messages TO anon;
GRANT ALL ON public.community_messages TO service_role;

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

-- Drop legacy restrictive policies
DROP POLICY IF EXISTS "msg_select_all_auth" ON public.community_messages;
DROP POLICY IF EXISTS "msg_insert_own" ON public.community_messages;
DROP POLICY IF EXISTS "msg_update_own_or_founder" ON public.community_messages;
DROP POLICY IF EXISTS "msg_delete_own_or_founder" ON public.community_messages;
DROP POLICY IF EXISTS "msg_select_public" ON public.community_messages;
DROP POLICY IF EXISTS "msg_insert_authenticated" ON public.community_messages;

-- 1. SELECT: Anyone (anon or authenticated) can view posts in ConnectUs feed
CREATE POLICY "msg_select_public" ON public.community_messages
  FOR SELECT TO anon, authenticated
  USING (true);

-- 2. INSERT: Allow inserting posts for authenticated users or fallback IDs
CREATE POLICY "msg_insert_authenticated" ON public.community_messages
  FOR INSERT TO authenticated, anon
  WITH CHECK (
    auth.uid() IS NOT NULL AND auth.uid() = user_id
    OR user_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR auth.role() = 'anon'
    OR auth.role() = 'authenticated'
  );

-- 3. UPDATE: Users can update their own posts or founder admins
CREATE POLICY "msg_update_own_or_founder" ON public.community_messages
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR has_role(auth.uid(), 'founder'::app_role) 
    OR has_role(auth.uid(), 'co_founder'::app_role)
  )
  WITH CHECK (
    auth.uid() = user_id 
    OR user_id = '00000000-0000-0000-0000-000000000000'::uuid
    OR has_role(auth.uid(), 'founder'::app_role) 
    OR has_role(auth.uid(), 'co_founder'::app_role)
  );

-- 4. DELETE: Users can delete their own posts or founder admins
CREATE POLICY "msg_delete_own_or_founder" ON public.community_messages
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id 
    OR has_role(auth.uid(), 'founder'::app_role) 
    OR has_role(auth.uid(), 'co_founder'::app_role)
  );
