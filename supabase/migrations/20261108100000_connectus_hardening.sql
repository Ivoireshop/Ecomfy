-- ConnectUs : fiabilisation de la base (compteurs, notifications, messagerie, stories, médias, confidentialité).
--
-- Constats à l'origine (recette du 08/11) :
--   * likes_count / comments_count d'un post n'étaient modifiables que par l'auteur du post (RLS) : aimer ou
--     commenter la publication d'un autre membre ne changeait aucun compteur en base.
--   * connectus_stories n'avait aucune politique UPDATE : vues et likes de story n'étaient jamais enregistrés.
--   * tout membre connecté pouvait créer une notification pour n'importe qui avec le texte de son choix (spam).
--   * un message pouvait être inséré dans la conversation de deux autres membres ; aucun moyen de marquer « lu ».
--   * les publications « abonnés » étaient lisibles par tous ; profils/posts lisibles sans connexion.
--   * photos/vidéos stockées en base64 dans les lignes (plusieurs Mo par ligne) faute de bucket dédié.
--   * deux lignes fictives dans community_messages (post de test du 27/08, notification vers « demo-user-1 »).
--
-- Idempotente (rejouable). Aucune donnée réelle supprimée : le nettoyage ne vise que les deux lignes fictives.

-- ---------------------------------------------------------------------------------------------------------------
-- 0. Données fictives
-- ---------------------------------------------------------------------------------------------------------------
DELETE FROM public.community_messages
WHERE left(body, 64) ~ '^\s*\{\s*"connectus_type"'
  AND (
    user_id = '00000000-0000-0000-0000-000000000000'
    OR body LIKE '%"recipient_id":"demo-%'
  );

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Profils : onboarding persistant, pas de « vérifié » d'office
-- ---------------------------------------------------------------------------------------------------------------
ALTER TABLE public.connectus_profiles ADD COLUMN IF NOT EXISTS is_onboarded boolean NOT NULL DEFAULT false;
ALTER TABLE public.connectus_profiles ALTER COLUMN is_verified SET DEFAULT false;

-- Contraintes sur les nouvelles lignes seulement (NOT VALID) : on ne touche pas à l'existant.
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.connectus_profiles ADD CONSTRAINT connectus_profiles_username_format
      CHECK (username ~ '^[a-z0-9_]{3,30}$') NOT VALID;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TABLE public.connectus_follows ADD CONSTRAINT connectus_follows_no_self
      CHECK (follower_id <> target_id) NOT VALID;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TABLE public.connectus_posts ADD CONSTRAINT connectus_posts_visibility_check
      CHECK (visibility IN ('public', 'followers', 'private')) NOT VALID;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TABLE public.connectus_posts ADD CONSTRAINT connectus_posts_content_len
      CHECK (content IS NULL OR length(content) <= 5000) NOT VALID;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TABLE public.connectus_comments ADD CONSTRAINT connectus_comments_text_len
      CHECK (length(btrim(text)) BETWEEN 1 AND 2000) NOT VALID;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER TABLE public.connectus_messages ADD CONSTRAINT connectus_messages_content_len
      CHECK (length(content) <= 4000) NOT VALID;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- Fiche publique pour les auteurs déjà présents : `profiles` n'est lisible que par son propriétaire (et les
-- fondateurs), sans fiche connectus_profiles leurs publications s'afficheraient sous « Membre Ecomfy ».
-- is_onboarded = false : ils compléteront leur profil à leur prochaine visite.
INSERT INTO public.connectus_profiles (id, user_id, username, full_name, avatar_url, is_onboarded)
SELECT p.id, p.id,
       left(coalesce(nullif(regexp_replace(lower(coalesce(p.full_name, '')), '[^a-z0-9]+', '_', 'g'), ''), 'membre'), 20)
         || '_' || left(replace(p.id::text, '-', ''), 4),
       coalesce(nullif(btrim(p.full_name), ''), 'Membre Ecomfy'),
       p.avatar_url,
       false
FROM public.profiles p
WHERE p.id IN (
        SELECT user_id FROM public.connectus_posts
        UNION SELECT user_id FROM public.connectus_comments
        UNION SELECT user_id FROM public.connectus_stories
      )
  AND NOT EXISTS (SELECT 1 FROM public.connectus_profiles c WHERE c.user_id = p.id)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Likes de commentaires et de stories (étaient stockés dans le navigateur)
-- ---------------------------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.connectus_comment_likes (
  comment_id text NOT NULL REFERENCES public.connectus_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.connectus_story_likes (
  story_id text NOT NULL REFERENCES public.connectus_stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);

ALTER TABLE public.connectus_comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connectus_story_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members read comment likes" ON public.connectus_comment_likes;
CREATE POLICY "Members read comment likes" ON public.connectus_comment_likes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Members like comments" ON public.connectus_comment_likes;
CREATE POLICY "Members like comments" ON public.connectus_comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Members unlike comments" ON public.connectus_comment_likes;
CREATE POLICY "Members unlike comments" ON public.connectus_comment_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Members read story likes" ON public.connectus_story_likes;
CREATE POLICY "Members read story likes" ON public.connectus_story_likes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Members like stories" ON public.connectus_story_likes;
CREATE POLICY "Members like stories" ON public.connectus_story_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Members unlike stories" ON public.connectus_story_likes;
CREATE POLICY "Members unlike stories" ON public.connectus_story_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON public.connectus_comment_likes, public.connectus_story_likes FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.connectus_comment_likes, public.connectus_story_likes TO authenticated;
GRANT ALL ON public.connectus_comment_likes, public.connectus_story_likes TO service_role;

CREATE INDEX IF NOT EXISTS idx_connectus_comment_likes_user ON public.connectus_comment_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_connectus_story_likes_user ON public.connectus_story_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_connectus_comments_parent ON public.connectus_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_connectus_messages_receiver_unread ON public.connectus_messages(receiver_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_connectus_conversations_participants ON public.connectus_conversations USING gin (participant_ids);

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Notifications créées par le serveur (plus de texte libre envoyé par le client)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.connectus_notify(
  p_recipient uuid, p_actor uuid, p_type text, p_post_id text, p_summary text, p_message text, p_dedupe interval
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_recipient IS NULL OR p_actor IS NULL OR p_recipient = p_actor THEN
    RETURN;
  END IF;
  -- Anti-répétition : aimer/retirer/aimer ne doit pas inonder le destinataire.
  IF EXISTS (
    SELECT 1 FROM public.connectus_notifications n
    WHERE n.recipient_id = p_recipient AND n.actor_id = p_actor AND n.type = p_type
      AND n.post_id IS NOT DISTINCT FROM p_post_id
      AND n.created_at > now() - p_dedupe
  ) THEN
    RETURN;
  END IF;
  INSERT INTO public.connectus_notifications (recipient_id, actor_id, type, post_id, post_summary, message)
  VALUES (p_recipient, p_actor, p_type, p_post_id, left(p_summary, 160), left(p_message, 300));
END $$;
REVOKE ALL ON FUNCTION public.connectus_notify(uuid, uuid, text, text, text, text, interval) FROM PUBLIC, anon, authenticated;

-- Likes d'une publication : compteur + notification
CREATE OR REPLACE FUNCTION public.connectus_on_post_like() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_post_id text := COALESCE(NEW.post_id, OLD.post_id);
  v_owner uuid;
  v_content text;
BEGIN
  UPDATE public.connectus_posts
  SET likes_count = (SELECT count(*) FROM public.connectus_post_likes WHERE post_id = v_post_id)
  WHERE id = v_post_id
  RETURNING user_id, content INTO v_owner, v_content;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.connectus_notify(v_owner, NEW.user_id, 'like', v_post_id, v_content, 'a aimé votre publication.', interval '1 day');
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS connectus_post_likes_aiud ON public.connectus_post_likes;
CREATE TRIGGER connectus_post_likes_aiud AFTER INSERT OR DELETE ON public.connectus_post_likes
  FOR EACH ROW EXECUTE FUNCTION public.connectus_on_post_like();

-- Commentaires : compteur + notification (auteur du post, ou auteur du commentaire parent pour une réponse)
CREATE OR REPLACE FUNCTION public.connectus_on_comment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_post_id text := COALESCE(NEW.post_id, OLD.post_id);
  v_owner uuid;
  v_content text;
  v_parent_author uuid;
BEGIN
  UPDATE public.connectus_posts
  SET comments_count = (SELECT count(*) FROM public.connectus_comments WHERE post_id = v_post_id)
  WHERE id = v_post_id
  RETURNING user_id, content INTO v_owner, v_content;

  IF TG_OP = 'INSERT' THEN
    IF NEW.parent_id IS NULL THEN
      PERFORM public.connectus_notify(v_owner, NEW.user_id, 'comment', v_post_id, v_content,
        'a commenté votre publication : « ' || left(NEW.text, 80) || ' »', interval '1 minute');
    ELSE
      SELECT user_id INTO v_parent_author FROM public.connectus_comments WHERE id = NEW.parent_id;
      PERFORM public.connectus_notify(v_parent_author, NEW.user_id, 'comment_reply', v_post_id, v_content,
        'a répondu à votre commentaire : « ' || left(NEW.text, 80) || ' »', interval '1 minute');
    END IF;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS connectus_comments_aiud ON public.connectus_comments;
CREATE TRIGGER connectus_comments_aiud AFTER INSERT OR DELETE ON public.connectus_comments
  FOR EACH ROW EXECUTE FUNCTION public.connectus_on_comment();

-- Likes de commentaires : compteur
CREATE OR REPLACE FUNCTION public.connectus_on_comment_like() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_comment_id text := COALESCE(NEW.comment_id, OLD.comment_id);
BEGIN
  UPDATE public.connectus_comments
  SET likes_count = (SELECT count(*) FROM public.connectus_comment_likes WHERE comment_id = v_comment_id)
  WHERE id = v_comment_id;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS connectus_comment_likes_aiud ON public.connectus_comment_likes;
CREATE TRIGGER connectus_comment_likes_aiud AFTER INSERT OR DELETE ON public.connectus_comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.connectus_on_comment_like();

-- Likes de stories : compteur + notification
CREATE OR REPLACE FUNCTION public.connectus_on_story_like() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_story_id text := COALESCE(NEW.story_id, OLD.story_id);
  v_owner uuid;
BEGIN
  UPDATE public.connectus_stories
  SET likes_count = (SELECT count(*) FROM public.connectus_story_likes WHERE story_id = v_story_id)
  WHERE id = v_story_id
  RETURNING user_id INTO v_owner;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.connectus_notify(v_owner, NEW.user_id, 'like', NULL, NULL, 'a aimé votre story.', interval '1 day');
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS connectus_story_likes_aiud ON public.connectus_story_likes;
CREATE TRIGGER connectus_story_likes_aiud AFTER INSERT OR DELETE ON public.connectus_story_likes
  FOR EACH ROW EXECUTE FUNCTION public.connectus_on_story_like();

-- Abonnements : notification au suivi
CREATE OR REPLACE FUNCTION public.connectus_on_follow() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.connectus_notify(NEW.target_id, NEW.follower_id, 'follow', NULL, NULL, 'a commencé à vous suivre.', interval '1 day');
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS connectus_follows_ai ON public.connectus_follows;
CREATE TRIGGER connectus_follows_ai AFTER INSERT ON public.connectus_follows
  FOR EACH ROW EXECUTE FUNCTION public.connectus_on_follow();

-- Messages privés : aperçu de la conversation + notification (au plus une toutes les 10 min par expéditeur)
CREATE OR REPLACE FUNCTION public.connectus_on_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.connectus_conversations
  SET last_message = CASE WHEN NEW.media_url IS NOT NULL AND btrim(NEW.content) IN ('', '📷 Image') THEN '📷 Photo' ELSE left(NEW.content, 200) END,
      last_message_at = NEW.created_at,
      updated_at = now()
  WHERE id = NEW.conversation_id;

  PERFORM public.connectus_notify(NEW.receiver_id, NEW.sender_id, 'private_message', NULL, NULL,
    CASE WHEN NEW.media_url IS NOT NULL THEN 'vous a envoyé une photo.' ELSE 'vous a envoyé un message : « ' || left(NEW.content, 60) || ' »' END,
    interval '10 minutes');
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS connectus_messages_ai ON public.connectus_messages;
CREATE TRIGGER connectus_messages_ai AFTER INSERT ON public.connectus_messages
  FOR EACH ROW EXECUTE FUNCTION public.connectus_on_message();

-- Remise à niveau des compteurs existants
UPDATE public.connectus_posts p SET
  likes_count = (SELECT count(*) FROM public.connectus_post_likes l WHERE l.post_id = p.id),
  comments_count = (SELECT count(*) FROM public.connectus_comments c WHERE c.post_id = p.id);

-- Le client ne peut plus fabriquer que des invitations (le reste vient des triggers ci-dessus).
DROP POLICY IF EXISTS "Authenticated users insert notifications" ON public.connectus_notifications;
DROP POLICY IF EXISTS "Members send invitations" ON public.connectus_notifications;
CREATE POLICY "Members send invitations" ON public.connectus_notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND recipient_id <> auth.uid()
    AND type IN ('invite_request', 'invite_accepted')
    AND coalesce(length(message), 0) <= 500
    AND coalesce(length(post_summary), 0) <= 200
  );

-- Une seule invitation en attente par couple expéditeur → destinataire
CREATE UNIQUE INDEX IF NOT EXISTS connectus_notif_one_pending_invite
  ON public.connectus_notifications (actor_id, recipient_id)
  WHERE type = 'invite_request' AND status = 'pending';

DROP POLICY IF EXISTS "Users delete own notifications" ON public.connectus_notifications;
CREATE POLICY "Users delete own notifications" ON public.connectus_notifications
  FOR DELETE TO authenticated USING (auth.uid() = recipient_id);

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Stories : vues enregistrées par une fonction (pas de UPDATE ouvert sur la table)
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.connectus_view_story(p_story_id text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  UPDATE public.connectus_stories s
  SET viewers = array_append(coalesce(s.viewers, '{}'), v_uid),
      views_count = coalesce(array_length(s.viewers, 1), 0) + 1
  WHERE s.id = p_story_id
    AND s.expires_at > now()
    AND s.user_id <> v_uid
    AND NOT (v_uid = ANY (coalesce(s.viewers, '{}')))
  RETURNING s.views_count INTO v_count;
  RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.connectus_view_story(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.connectus_view_story(text) TO authenticated;

-- Le propriétaire voit aussi ses stories expirées (suppression), les autres seulement les actives.
DROP POLICY IF EXISTS "Active stories read" ON public.connectus_stories;
CREATE POLICY "Active stories read" ON public.connectus_stories
  FOR SELECT TO authenticated USING (expires_at > now() OR user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Messagerie : conversation entre deux membres, messages réservés à ses participants, « lu » par fonction
-- ---------------------------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants write conversations" ON public.connectus_conversations;
DROP POLICY IF EXISTS "Members start conversations" ON public.connectus_conversations;
CREATE POLICY "Members start conversations" ON public.connectus_conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = ANY (participant_ids)
    AND array_length(participant_ids, 1) = 2
    AND participant_ids[1] <> participant_ids[2]
  );

DROP POLICY IF EXISTS "Participants update conversations" ON public.connectus_conversations;
CREATE POLICY "Participants update conversations" ON public.connectus_conversations
  FOR UPDATE TO authenticated
  USING (auth.uid() = ANY (participant_ids))
  WITH CHECK (auth.uid() = ANY (participant_ids) AND array_length(participant_ids, 1) = 2);

DROP POLICY IF EXISTS "Senders insert messages" ON public.connectus_messages;
CREATE POLICY "Senders insert messages" ON public.connectus_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND sender_id <> receiver_id
    AND EXISTS (
      SELECT 1 FROM public.connectus_conversations c
      WHERE c.id = conversation_id
        AND sender_id = ANY (c.participant_ids)
        AND receiver_id = ANY (c.participant_ids)
    )
  );

CREATE OR REPLACE FUNCTION public.connectus_mark_conversation_read(p_conversation_id text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_n integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  UPDATE public.connectus_messages
  SET is_read = true, status = 'read'
  WHERE conversation_id = p_conversation_id AND receiver_id = v_uid AND is_read = false;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.connectus_mark_conversation_read(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.connectus_mark_conversation_read(text) TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Confidentialité : tout est réservé aux membres connectés ; « abonnés » réellement respecté
-- ---------------------------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public profiles read" ON public.connectus_profiles;
DROP POLICY IF EXISTS "Members read profiles" ON public.connectus_profiles;
CREATE POLICY "Members read profiles" ON public.connectus_profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public posts read" ON public.connectus_posts;
DROP POLICY IF EXISTS "Members read visible posts" ON public.connectus_posts;
CREATE POLICY "Members read visible posts" ON public.connectus_posts
  FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    OR user_id = auth.uid()
    OR (
      visibility = 'followers'
      AND EXISTS (
        SELECT 1 FROM public.connectus_follows f
        WHERE f.follower_id = auth.uid() AND f.target_id = connectus_posts.user_id
      )
    )
  );

DROP POLICY IF EXISTS "Users update own posts" ON public.connectus_posts;
CREATE POLICY "Users update own posts" ON public.connectus_posts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public likes read" ON public.connectus_post_likes;
DROP POLICY IF EXISTS "Members read likes" ON public.connectus_post_likes;
CREATE POLICY "Members read likes" ON public.connectus_post_likes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public comments read" ON public.connectus_comments;
DROP POLICY IF EXISTS "Members read comments" ON public.connectus_comments;
CREATE POLICY "Members read comments" ON public.connectus_comments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public follows read" ON public.connectus_follows;
DROP POLICY IF EXISTS "Members read follows" ON public.connectus_follows;
CREATE POLICY "Members read follows" ON public.connectus_follows FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------------------------------------------
-- 7. Médias : bucket dédié (au lieu de base64 dans les lignes)
-- ---------------------------------------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'connectus-media', 'connectus-media', true, 52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "connectus_media_insert_own_folder" ON storage.objects;
CREATE POLICY "connectus_media_insert_own_folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'connectus-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "connectus_media_update_own_folder" ON storage.objects;
CREATE POLICY "connectus_media_update_own_folder" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'connectus-media' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'connectus-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- L'API de suppression lit d'abord l'objet : sans SELECT sur son propre dossier, remove() ne supprime rien.
-- Les URL publiques (bucket public) fonctionnent sans politique ; celle-ci ne donne aucune lecture des autres dossiers.
DROP POLICY IF EXISTS "connectus_media_select_own_folder" ON storage.objects;
CREATE POLICY "connectus_media_select_own_folder" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'connectus-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "connectus_media_delete_own_folder" ON storage.objects;
CREATE POLICY "connectus_media_delete_own_folder" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'connectus-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------------------------------------------
-- 8. Temps réel (publications, notifications, messages) — respecte la RLS
-- ---------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['connectus_posts', 'connectus_notifications', 'connectus_messages']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN undefined_object THEN NULL;
    END;
  END LOOP;
END $$;
