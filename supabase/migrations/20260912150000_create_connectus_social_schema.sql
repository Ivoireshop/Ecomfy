-- Migration: Connect Us Social Network Database Schema
-- Dedicated, non-destructive relational tables for Connect Us with RLS and high-performance indexes.

-- 1. CONNECTUS PROFILES
CREATE TABLE IF NOT EXISTS public.connectus_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  full_name text NOT NULL,
  avatar_url text,
  cover_url text,
  bio text,
  location text DEFAULT 'Côte d''Ivoire',
  website_url text,
  is_verified boolean DEFAULT true,
  is_business boolean DEFAULT false,
  show_shop_on_profile boolean DEFAULT false,
  shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  shop_name text,
  shop_slug text,
  followers_count integer DEFAULT 0,
  following_count integer DEFAULT 0,
  posts_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. CONNECTUS POSTS
CREATE TABLE IF NOT EXISTS public.connectus_posts (
  id text PRIMARY KEY DEFAULT ('post-' || gen_random_uuid()::text),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  media_urls text[] DEFAULT '{}',
  video_url text,
  link_preview jsonb,
  attached_product jsonb,
  attached_shop_id uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  visibility text DEFAULT 'public',
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. CONNECTUS POST LIKES / REACTIONS
CREATE TABLE IF NOT EXISTS public.connectus_post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id text NOT NULL REFERENCES public.connectus_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type text DEFAULT 'like',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT connectus_post_likes_unique UNIQUE(post_id, user_id)
);

-- 4. CONNECTUS COMMENTS
CREATE TABLE IF NOT EXISTS public.connectus_comments (
  id text PRIMARY KEY DEFAULT ('comment-' || gen_random_uuid()::text),
  post_id text NOT NULL REFERENCES public.connectus_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id text REFERENCES public.connectus_comments(id) ON DELETE CASCADE,
  text text NOT NULL,
  likes_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 5. CONNECTUS FOLLOWS
CREATE TABLE IF NOT EXISTS public.connectus_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT connectus_follows_unique UNIQUE(follower_id, target_id)
);

-- 6. CONNECTUS STORIES
CREATE TABLE IF NOT EXISTS public.connectus_stories (
  id text PRIMARY KEY DEFAULT ('story-' || gen_random_uuid()::text),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text DEFAULT 'image',
  caption text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  views_count integer DEFAULT 0,
  viewers uuid[] DEFAULT '{}',
  likes_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 7. CONNECTUS NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.connectus_notifications (
  id text PRIMARY KEY DEFAULT ('notif-' || gen_random_uuid()::text),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  post_id text,
  post_summary text,
  message text,
  status text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 8. CONNECTUS CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.connectus_conversations (
  id text PRIMARY KEY,
  participant_ids uuid[] NOT NULL,
  last_message text,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 9. CONNECTUS MESSAGES
CREATE TABLE IF NOT EXISTS public.connectus_messages (
  id text PRIMARY KEY DEFAULT ('msg-' || gen_random_uuid()::text),
  conversation_id text NOT NULL REFERENCES public.connectus_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  media_url text,
  status text DEFAULT 'sent',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_connectus_posts_created ON public.connectus_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_connectus_posts_user ON public.connectus_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_connectus_likes_post ON public.connectus_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_connectus_comments_post ON public.connectus_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_connectus_follows_follower ON public.connectus_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_connectus_follows_target ON public.connectus_follows(target_id);
CREATE INDEX IF NOT EXISTS idx_connectus_stories_expires ON public.connectus_stories(expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_connectus_notifs_recipient ON public.connectus_notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_connectus_messages_conv ON public.connectus_messages(conversation_id, created_at ASC);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.connectus_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connectus_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connectus_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connectus_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connectus_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connectus_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connectus_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connectus_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connectus_messages ENABLE ROW LEVEL SECURITY;

-- POLICIES
-- Profiles
DROP POLICY IF EXISTS "Public profiles read" ON public.connectus_profiles;
CREATE POLICY "Public profiles read" ON public.connectus_profiles FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Users write own profile" ON public.connectus_profiles;
CREATE POLICY "Users write own profile" ON public.connectus_profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Posts
DROP POLICY IF EXISTS "Public posts read" ON public.connectus_posts;
CREATE POLICY "Public posts read" ON public.connectus_posts FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Users insert own posts" ON public.connectus_posts;
CREATE POLICY "Users insert own posts" ON public.connectus_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own posts" ON public.connectus_posts;
CREATE POLICY "Users update own posts" ON public.connectus_posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own posts" ON public.connectus_posts;
CREATE POLICY "Users delete own posts" ON public.connectus_posts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Post Likes
DROP POLICY IF EXISTS "Public likes read" ON public.connectus_post_likes;
CREATE POLICY "Public likes read" ON public.connectus_post_likes FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Users manage own likes" ON public.connectus_post_likes;
CREATE POLICY "Users manage own likes" ON public.connectus_post_likes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Comments
DROP POLICY IF EXISTS "Public comments read" ON public.connectus_comments;
CREATE POLICY "Public comments read" ON public.connectus_comments FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Users insert comments" ON public.connectus_comments;
CREATE POLICY "Users insert comments" ON public.connectus_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own comments" ON public.connectus_comments;
CREATE POLICY "Users delete own comments" ON public.connectus_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Follows
DROP POLICY IF EXISTS "Public follows read" ON public.connectus_follows;
CREATE POLICY "Public follows read" ON public.connectus_follows FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Users manage own follows" ON public.connectus_follows;
CREATE POLICY "Users manage own follows" ON public.connectus_follows FOR ALL TO authenticated USING (auth.uid() = follower_id) WITH CHECK (auth.uid() = follower_id);

-- Stories
DROP POLICY IF EXISTS "Active stories read" ON public.connectus_stories;
CREATE POLICY "Active stories read" ON public.connectus_stories FOR SELECT TO authenticated, anon USING (expires_at > now());

DROP POLICY IF EXISTS "Users insert own stories" ON public.connectus_stories;
CREATE POLICY "Users insert own stories" ON public.connectus_stories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own stories" ON public.connectus_stories;
CREATE POLICY "Users delete own stories" ON public.connectus_stories FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Notifications
DROP POLICY IF EXISTS "Users read own notifications" ON public.connectus_notifications;
CREATE POLICY "Users read own notifications" ON public.connectus_notifications FOR SELECT TO authenticated USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Authenticated users insert notifications" ON public.connectus_notifications;
CREATE POLICY "Authenticated users insert notifications" ON public.connectus_notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);

DROP POLICY IF EXISTS "Users update own notifications" ON public.connectus_notifications;
CREATE POLICY "Users update own notifications" ON public.connectus_notifications FOR UPDATE TO authenticated USING (auth.uid() = recipient_id);

-- Conversations & Messages
DROP POLICY IF EXISTS "Participants read conversations" ON public.connectus_conversations;
CREATE POLICY "Participants read conversations" ON public.connectus_conversations FOR SELECT TO authenticated USING (auth.uid() = ANY(participant_ids));

DROP POLICY IF EXISTS "Participants write conversations" ON public.connectus_conversations;
CREATE POLICY "Participants write conversations" ON public.connectus_conversations FOR ALL TO authenticated USING (auth.uid() = ANY(participant_ids)) WITH CHECK (auth.uid() = ANY(participant_ids));

DROP POLICY IF EXISTS "Participants read messages" ON public.connectus_messages;
CREATE POLICY "Participants read messages" ON public.connectus_messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Senders insert messages" ON public.connectus_messages;
CREATE POLICY "Senders insert messages" ON public.connectus_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

-- Grant access to authenticated and service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
