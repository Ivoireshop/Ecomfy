-- Performance Indexes for ConnectUs community_messages table to eliminate statement timeouts
CREATE INDEX IF NOT EXISTS community_messages_created_at_desc_idx 
  ON public.community_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS community_messages_user_id_idx 
  ON public.community_messages (user_id);
