
CREATE TABLE public.community_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  body text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  reply_to_id uuid REFERENCES public.community_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_messages TO authenticated;
GRANT ALL ON public.community_messages TO service_role;

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "msg_select_all_auth" ON public.community_messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "msg_insert_own" ON public.community_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "msg_update_own_or_founder" ON public.community_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'founder'::app_role) OR has_role(auth.uid(), 'co_founder'::app_role))
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'founder'::app_role) OR has_role(auth.uid(), 'co_founder'::app_role));

CREATE POLICY "msg_delete_own_or_founder" ON public.community_messages
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'founder'::app_role) OR has_role(auth.uid(), 'co_founder'::app_role));

CREATE INDEX community_messages_created_idx ON public.community_messages (created_at DESC);
CREATE INDEX community_messages_pinned_idx ON public.community_messages (is_pinned) WHERE is_pinned = true;

CREATE TRIGGER community_messages_set_updated_at
  BEFORE UPDATE ON public.community_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;
ALTER TABLE public.community_messages REPLICA IDENTITY FULL;
