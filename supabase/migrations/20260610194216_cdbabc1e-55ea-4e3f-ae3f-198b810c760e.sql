CREATE TABLE IF NOT EXISTS public.community_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.community_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS community_message_reactions_message_idx ON public.community_message_reactions(message_id);
GRANT SELECT, INSERT, DELETE ON public.community_message_reactions TO authenticated;
GRANT ALL ON public.community_message_reactions TO service_role;
ALTER TABLE public.community_message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions_select_auth" ON public.community_message_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "reactions_insert_own" ON public.community_message_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions_delete_own" ON public.community_message_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_message_reactions;