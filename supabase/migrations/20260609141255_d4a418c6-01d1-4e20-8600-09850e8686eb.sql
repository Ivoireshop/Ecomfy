
-- TOPICS
CREATE TABLE public.community_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  is_pinned boolean NOT NULL DEFAULT false,
  is_closed boolean NOT NULL DEFAULT false,
  reply_count integer NOT NULL DEFAULT 0,
  like_count integer NOT NULL DEFAULT 0,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_topics TO authenticated;
GRANT ALL ON public.community_topics TO service_role;
ALTER TABLE public.community_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "topics_select_all_auth" ON public.community_topics
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "topics_insert_own" ON public.community_topics
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "topics_update_own_or_founder" ON public.community_topics
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder'));
CREATE POLICY "topics_delete_own_or_founder" ON public.community_topics
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder'));

CREATE INDEX community_topics_activity_idx ON public.community_topics (is_pinned DESC, last_activity_at DESC);

-- REPLIES
CREATE TABLE public.community_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.community_topics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  like_count integer NOT NULL DEFAULT 0,
  is_support boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_replies TO authenticated;
GRANT ALL ON public.community_replies TO service_role;
ALTER TABLE public.community_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "replies_select_all_auth" ON public.community_replies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "replies_insert_own" ON public.community_replies
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "replies_update_own_or_founder" ON public.community_replies
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder'));
CREATE POLICY "replies_delete_own_or_founder" ON public.community_replies
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder'));

CREATE INDEX community_replies_topic_idx ON public.community_replies (topic_id, created_at);

-- LIKES
CREATE TABLE public.community_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('topic','reply')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_id)
);
GRANT SELECT, INSERT, DELETE ON public.community_likes TO authenticated;
GRANT ALL ON public.community_likes TO service_role;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "likes_select_all_auth" ON public.community_likes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "likes_insert_own" ON public.community_likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete_own" ON public.community_likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TRIGGERS for counts + last_activity
CREATE OR REPLACE FUNCTION public.community_replies_after_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_topics
      SET reply_count = reply_count + 1, last_activity_at = now(), updated_at = now()
      WHERE id = NEW.topic_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_topics
      SET reply_count = GREATEST(reply_count - 1, 0), updated_at = now()
      WHERE id = OLD.topic_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER community_replies_count_trg
  AFTER INSERT OR DELETE ON public.community_replies
  FOR EACH ROW EXECUTE FUNCTION public.community_replies_after_change();

CREATE OR REPLACE FUNCTION public.community_likes_after_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.target_type = 'topic' THEN
      UPDATE public.community_topics SET like_count = like_count + 1 WHERE id = NEW.target_id;
    ELSE
      UPDATE public.community_replies SET like_count = like_count + 1 WHERE id = NEW.target_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.target_type = 'topic' THEN
      UPDATE public.community_topics SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.target_id;
    ELSE
      UPDATE public.community_replies SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.target_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER community_likes_count_trg
  AFTER INSERT OR DELETE ON public.community_likes
  FOR EACH ROW EXECUTE FUNCTION public.community_likes_after_change();

CREATE TRIGGER community_topics_updated_at
  BEFORE UPDATE ON public.community_topics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER community_replies_updated_at
  BEFORE UPDATE ON public.community_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
