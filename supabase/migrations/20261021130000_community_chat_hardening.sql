-- Communauté (salon /community) : sécurité et séparation des messages ConnectUs
--
-- Constats sur dev (21/10/2026) :
--  * 86 messages sur 86 du salon sont des blobs JSON ConnectUs (réactions, notifications, publications),
--    dont un de 14 Mo : ils s'affichaient en clair dans le salon et gonflaient le compteur de non lus.
--  * La migration 20260827000000 avait ouvert la table aux anonymes (lecture + écriture) et permettait
--    d'insérer un message au nom de n'importe quel membre (`OR auth.role() = 'authenticated'`).
--  * Un auteur pouvait épingler son propre message (UPDATE sur sa ligne, sans limite de colonnes).
--  * `anon` et `authenticated` avaient tous les privilèges (TRUNCATE compris) sur les 5 tables community_*.
--  * `get_community_profiles` / `search_community_profiles` étaient exécutables par `anon`.
-- Idempotente.

-- 1. Distinguer les messages du salon des blobs ConnectUs (colonne calculée : non falsifiable, sans UPDATE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'community_messages' AND column_name = 'kind'
  ) THEN
    ALTER TABLE public.community_messages
      ADD COLUMN kind text GENERATED ALWAYS AS (
        CASE WHEN left(body, 64) ~ '^\s*\{\s*"connectus_type"' THEN 'connectus' ELSE 'chat' END
      ) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS community_messages_chat_created_idx
  ON public.community_messages (created_at DESC) WHERE kind = 'chat';

-- 2. Longueur d'un message de salon (les blobs ConnectUs ne sont pas concernés ; NOT VALID : ne contrôle que les nouvelles lignes)
ALTER TABLE public.community_messages DROP CONSTRAINT IF EXISTS community_messages_chat_body_len;
ALTER TABLE public.community_messages
  ADD CONSTRAINT community_messages_chat_body_len
  CHECK (kind <> 'chat' OR (char_length(btrim(body)) BETWEEN 1 AND 2000)) NOT VALID;

ALTER TABLE public.community_message_reactions DROP CONSTRAINT IF EXISTS community_message_reactions_emoji_len;
ALTER TABLE public.community_message_reactions
  ADD CONSTRAINT community_message_reactions_emoji_len
  CHECK (char_length(emoji) BETWEEN 1 AND 16) NOT VALID;

-- 3. Privilèges : plus rien pour anon, pas de TRUNCATE/REFERENCES/TRIGGER pour les membres
REVOKE ALL ON public.community_messages, public.community_message_reactions,
              public.community_topics, public.community_replies, public.community_likes FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.community_messages, public.community_message_reactions,
              public.community_topics, public.community_replies, public.community_likes FROM authenticated;

-- 4. Politiques de community_messages
DROP POLICY IF EXISTS "msg_select_all_auth" ON public.community_messages;
DROP POLICY IF EXISTS "msg_select_public" ON public.community_messages;
DROP POLICY IF EXISTS "msg_insert_own" ON public.community_messages;
DROP POLICY IF EXISTS "msg_insert_authenticated" ON public.community_messages;
DROP POLICY IF EXISTS "msg_update_own_or_founder" ON public.community_messages;
DROP POLICY IF EXISTS "msg_update_founder" ON public.community_messages;
DROP POLICY IF EXISTS "msg_delete_own_or_founder" ON public.community_messages;

CREATE POLICY "msg_select_all_auth" ON public.community_messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "msg_insert_own" ON public.community_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_pinned = false);

-- Seuls les fondateurs modifient une ligne (épinglage) ; le salon n'a pas d'édition de message
CREATE POLICY "msg_update_founder" ON public.community_messages
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'founder'::app_role) OR has_role(auth.uid(), 'co_founder'::app_role))
  WITH CHECK (has_role(auth.uid(), 'founder'::app_role) OR has_role(auth.uid(), 'co_founder'::app_role));

CREATE POLICY "msg_delete_own_or_founder" ON public.community_messages
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'founder'::app_role)
    OR has_role(auth.uid(), 'co_founder'::app_role)
  );

-- 5. Profils du salon : réservés aux membres connectés ; indique les fondateurs (pastille « Fondateur »)
DROP FUNCTION IF EXISTS public.get_community_profiles(uuid[]);
CREATE FUNCTION public.get_community_profiles(_ids uuid[])
RETURNS TABLE(id uuid, full_name text, avatar_url text, is_founder boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url,
         EXISTS (
           SELECT 1 FROM public.user_roles ur
           WHERE ur.user_id = p.id AND ur.role IN ('founder'::app_role, 'co_founder'::app_role)
         ) AS is_founder
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.id = ANY(_ids[1:200]);
$$;

CREATE OR REPLACE FUNCTION public.search_community_profiles(_query text, _limit int DEFAULT 6)
RETURNS TABLE(id uuid, full_name text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.full_name IS NOT NULL
    AND (
      _query IS NULL OR _query = ''
      OR p.full_name ILIKE '%' || replace(replace(replace(left(_query, 50), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  ORDER BY p.full_name ASC
  LIMIT LEAST(GREATEST(_limit, 1), 20);
$$;

REVOKE ALL ON FUNCTION public.get_community_profiles(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_community_profiles(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_community_profiles(uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_community_profiles(text, int) TO authenticated, service_role;
