import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { prepareImageForUpload } from "@/lib/imageCompress";
import {
  ConnectUsProfile,
  ConnectUsPost,
  ConnectUsComment,
  ConnectUsNotification,
  ConnectUsConversation,
  ConnectUsPrivateMessage,
  ConnectUsStory,
  ReactionType,
  AttachedProduct,
  VisibilityType,
} from "../types/connectus.types";
import type { LinkMetadata } from "../utils/linkScraper";

/**
 * ConnectUs : base de données uniquement.
 * Les tables connectus_* ne sont pas dans les types générés, d'où le client « lâche » ci-dessous ; chaque
 * résultat est typé par les interfaces de lignes qui suivent.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as SupabaseClient<any>;

export const CONNECTUS_BUCKET = "connectus-media";
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const PROFILE_TTL_MS = 60_000;

interface ProfileRow {
  user_id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  location: string | null;
  website_url: string | null;
  is_business: boolean | null;
  is_onboarded: boolean | null;
  show_shop_on_profile: boolean | null;
  shop_id: string | null;
  shop_name: string | null;
  shop_slug: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface BaseProfileRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  updated_at: string | null;
}

interface PostRow {
  id: string;
  user_id: string;
  content: string | null;
  media_urls: string[] | null;
  video_url: string | null;
  link_preview: LinkMetadata | null;
  attached_product: AttachedProduct | null;
  attached_shop_id: string | null;
  visibility: VisibilityType | null;
  likes_count: number | null;
  comments_count: number | null;
  shares_count: number | null;
  created_at: string;
}

interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  text: string;
  likes_count: number | null;
  created_at: string;
}

interface NotificationRow {
  id: string;
  recipient_id: string;
  actor_id: string;
  type: ConnectUsNotification["type"];
  post_id: string | null;
  post_summary: string | null;
  message: string | null;
  status: "pending" | "accepted" | "declined" | null;
  is_read: boolean | null;
  created_at: string;
}

interface ConversationRow {
  id: string;
  participant_ids: string[];
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  media_url: string | null;
  status: "sent" | "delivered" | "read" | null;
  is_read: boolean | null;
  created_at: string;
}

interface StoryRow {
  id: string;
  user_id: string;
  media_url: string;
  media_type: "image" | "video" | null;
  caption: string | null;
  expires_at: string;
  views_count: number | null;
  viewers: string[] | null;
  likes_count: number | null;
  created_at: string;
}

/** Un même nom de canal temps réel ne peut être abonné qu'une fois : chaque abonnement reçoit un suffixe unique. */
const channelSuffix = (): string => Math.random().toString(36).slice(2, 10);

const profileCache = new Map<string, { at: number; profile: ConnectUsProfile }>();

const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "Erreur inconnue";

const isUniqueViolation = (e: unknown): boolean =>
  typeof e === "object" && e !== null && (e as { code?: string }).code === "23505";

/** Retire les caractères qui casseraient un filtre PostgREST `or(...)` / `ilike`. */
const sanitizeSearch = (q: string): string => q.replace(/[,()%*\\"'`:;]/g, " ").replace(/\s+/g, " ").trim();

const slugifyUsername = (name: string): string => {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return base.length >= 3 ? base : `membre_${base}`.replace(/_$/, "");
};

const fallbackProfile = (userId: string): ConnectUsProfile => ({
  id: userId,
  user_id: userId,
  username: `membre_${userId.slice(0, 6)}`,
  full_name: "Membre Ecomfy",
  avatar_url: null,
  cover_url: null,
  bio: null,
  location: null,
  website_url: null,
  is_verified: false,
  is_business: false,
  is_onboarded: true,
  followers_count: 0,
  following_count: 0,
  posts_count: 0,
  created_at: new Date(0).toISOString(),
});

const toProfile = (userId: string, conn?: ProfileRow | null, base?: BaseProfileRow | null): ConnectUsProfile => {
  const isBusiness = Boolean(conn?.is_business);
  return {
    id: userId,
    user_id: userId,
    username: conn?.username || `membre_${userId.slice(0, 6)}`,
    full_name: conn?.full_name || base?.full_name || "Membre Ecomfy",
    avatar_url: conn?.avatar_url || base?.avatar_url || null,
    cover_url: conn?.cover_url || null,
    bio: conn?.bio || null,
    location: conn?.location || null,
    website_url: conn?.website_url || null,
    // « Vérifié » = compte marchand rattaché à une vraie boutique, jamais d'office.
    is_verified: isBusiness,
    is_business: isBusiness,
    is_onboarded: conn ? Boolean(conn.is_onboarded) : true,
    followers_count: 0,
    following_count: 0,
    posts_count: 0,
    shop_id: conn?.shop_id ?? null,
    shop_name: conn?.shop_name ?? null,
    shop_slug: conn?.shop_slug ?? null,
    show_shop_on_profile: Boolean(conn?.show_shop_on_profile),
    created_at: conn?.created_at || base?.updated_at || new Date().toISOString(),
  };
};

export class ConnectUsService {
  // ------------------------------------------------------------------------------------------------ MÉDIAS

  /** Envoie une image (compressée) ou une vidéo dans le bucket ConnectUs et renvoie son URL publique. */
  static async uploadMedia(userId: string, file: File): Promise<string> {
    let toUpload = file;
    if (file.type.startsWith("image/")) {
      if (file.size > MAX_IMAGE_BYTES * 2) throw new Error("Image trop lourde (30 Mo maximum avant compression).");
      const prepared = await prepareImageForUpload(file);
      if (prepared.ok === false) throw new Error(prepared.reason);
      toUpload = prepared.file;
    } else if (file.type.startsWith("video/")) {
      if (file.size > MAX_VIDEO_BYTES) throw new Error("Vidéo trop lourde (50 Mo maximum).");
    } else {
      throw new Error("Format non pris en charge : choisissez une image ou une vidéo.");
    }

    const ext = (toUpload.type.split("/")[1] || "bin").replace("jpeg", "jpg").replace("quicktime", "mov");
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(CONNECTUS_BUCKET).upload(path, toUpload, {
      cacheControl: "31536000",
      contentType: toUpload.type,
      upsert: false,
    });
    if (error) throw new Error(`Envoi du fichier impossible : ${error.message}`);
    return supabase.storage.from(CONNECTUS_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  /** Supprime (au mieux) les fichiers du bucket référencés par des URL publiques. */
  private static async removeMedia(urls: Array<string | null | undefined>): Promise<void> {
    const marker = `/${CONNECTUS_BUCKET}/`;
    const paths = urls
      .filter((u): u is string => Boolean(u) && u!.includes(marker))
      .map((u) => decodeURIComponent(u.split(marker)[1].split("?")[0]));
    if (paths.length === 0) return;
    try {
      await supabase.storage.from(CONNECTUS_BUCKET).remove(paths);
    } catch {
      /* fichier orphelin : sans conséquence pour l'affichage */
    }
  }

  // ------------------------------------------------------------------------------------------------ PROFILS

  /** Profils (avec repli sur le profil Ecomfy) pour une liste d'identifiants, en 2 requêtes au plus. */
  static async fetchProfiles(ids: string[]): Promise<Map<string, ConnectUsProfile>> {
    const result = new Map<string, ConnectUsProfile>();
    const now = Date.now();
    const missing: string[] = [];
    for (const id of new Set(ids.filter(Boolean))) {
      const cached = profileCache.get(id);
      if (cached && now - cached.at < PROFILE_TTL_MS) result.set(id, cached.profile);
      else missing.push(id);
    }
    if (missing.length === 0) return result;

    const [connRes, baseRes] = await Promise.all([
      db.from("connectus_profiles").select("*").in("user_id", missing),
      db.from("profiles").select("id, full_name, avatar_url, updated_at").in("id", missing),
    ]);
    const connMap = new Map<string, ProfileRow>(((connRes.data as ProfileRow[]) || []).map((r) => [r.user_id, r]));
    const baseMap = new Map<string, BaseProfileRow>(((baseRes.data as BaseProfileRow[]) || []).map((r) => [r.id, r]));

    for (const id of missing) {
      const profile = toProfile(id, connMap.get(id), baseMap.get(id));
      profileCache.set(id, { at: now, profile });
      result.set(id, profile);
    }
    return result;
  }

  /** Crée (ou met à jour la boutique de) la fiche ConnectUs du membre connecté, puis la renvoie avec ses compteurs. */
  static async getProfile(userId: string): Promise<ConnectUsProfile> {
    if (!userId) return fallbackProfile("anon");

    const [connRes, baseRes, shopRes, authRes] = await Promise.all([
      db.from("connectus_profiles").select("*").eq("user_id", userId).maybeSingle(),
      db.from("profiles").select("id, full_name, avatar_url, updated_at").eq("id", userId).maybeSingle(),
      db
        .from("shops")
        .select("id, business_name, slug")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.auth.getSession(),
    ]);

    let conn = connRes.data as ProfileRow | null;
    const base = baseRes.data as BaseProfileRow | null;
    const shop = shopRes.data as { id: string; business_name: string | null; slug: string | null } | null;
    const authUser = authRes.data.session?.user;
    const isSelf = authUser?.id === userId;

    if (isSelf) {
      const displayName =
        base?.full_name ||
        (authUser?.user_metadata?.full_name as string | undefined) ||
        authUser?.email?.split("@")[0] ||
        "Membre Ecomfy";

      if (!conn) {
        const baseUsername = slugifyUsername(displayName);
        for (const candidate of [baseUsername, `${baseUsername}_${userId.slice(0, 4)}`, `membre_${userId.slice(0, 8)}`]) {
          const { data, error } = await db
            .from("connectus_profiles")
            .insert({
              id: userId,
              user_id: userId,
              username: candidate,
              full_name: displayName,
              avatar_url: base?.avatar_url || null,
              is_business: Boolean(shop),
              show_shop_on_profile: Boolean(shop),
              shop_id: shop?.id ?? null,
              shop_name: shop?.business_name ?? null,
              shop_slug: shop?.slug ?? null,
              is_onboarded: false,
            })
            .select("*")
            .single();
          if (!error) {
            conn = data as ProfileRow;
            break;
          }
          if (!isUniqueViolation(error)) break;
        }
      } else if (
        shop &&
        (conn.shop_id !== shop.id || conn.shop_slug !== shop.slug || conn.shop_name !== shop.business_name || !conn.is_business)
      ) {
        const { data } = await db
          .from("connectus_profiles")
          .update({
            is_business: true,
            shop_id: shop.id,
            shop_name: shop.business_name,
            shop_slug: shop.slug,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .select("*")
          .single();
        if (data) conn = data as ProfileRow;
      }
    }

    const profile = toProfile(userId, conn, base);

    const [followers, following, posts] = await Promise.all([
      db.from("connectus_follows").select("id", { count: "exact", head: true }).eq("target_id", userId),
      db.from("connectus_follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
      db.from("connectus_posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);
    profile.followers_count = followers.count ?? 0;
    profile.following_count = following.count ?? 0;
    profile.posts_count = posts.count ?? 0;

    profileCache.set(userId, { at: Date.now(), profile });
    return profile;
  }

  /** Enregistre le profil. Renvoie un message d'erreur lisible en cas d'échec (ex. @identifiant déjà pris). */
  static async saveProfile(profile: ConnectUsProfile): Promise<{ ok: boolean; error?: string }> {
    if (!profile.user_id) return { ok: false, error: "Profil introuvable." };
    const username = profile.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      return { ok: false, error: "L'identifiant doit contenir 3 à 30 caractères : lettres minuscules, chiffres ou _." };
    }
    if (!profile.full_name?.trim()) return { ok: false, error: "Le nom est obligatoire." };

    const { error } = await db
      .from("connectus_profiles")
      .update({
        username,
        full_name: profile.full_name.trim(),
        avatar_url: profile.avatar_url || null,
        cover_url: profile.cover_url || null,
        bio: profile.bio?.trim() || null,
        location: profile.location?.trim() || null,
        website_url: profile.website_url?.trim() || null,
        show_shop_on_profile: Boolean(profile.show_shop_on_profile),
        is_onboarded: profile.is_onboarded !== false,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", profile.user_id);

    profileCache.delete(profile.user_id);
    if (error) {
      return {
        ok: false,
        error: isUniqueViolation(error) ? `L'identifiant @${username} est déjà pris.` : errorMessage(error),
      };
    }
    return { ok: true };
  }

  /** Marchands / membres à suivre : vrais profils uniquement. */
  static async getSuggestedMembers(userId: string, limit = 5): Promise<ConnectUsProfile[]> {
    const { data: followed } = await db.from("connectus_follows").select("target_id").eq("follower_id", userId);
    const exclude = [userId, ...((followed as Array<{ target_id: string }>) || []).map((f) => f.target_id)];

    const { data } = await db
      .from("connectus_profiles")
      .select("*")
      .not("user_id", "in", `(${exclude.join(",")})`)
      .eq("is_onboarded", true)
      .order("is_business", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    return ((data as ProfileRow[]) || []).map((r) => toProfile(r.user_id, r));
  }

  static async searchProfiles(query: string, excludeUserId?: string): Promise<ConnectUsProfile[]> {
    const clean = sanitizeSearch(query.replace(/^@/, ""));
    if (clean.length < 2) return [];

    // Seuls les membres ayant une fiche ConnectUs sont trouvables (la table `profiles` d'Ecomfy est privée).
    const { data, error } = await db
      .from("connectus_profiles")
      .select("*")
      .or(`full_name.ilike.%${clean}%,username.ilike.%${clean}%,shop_name.ilike.%${clean}%`)
      .limit(20);
    if (error) throw new Error(errorMessage(error));

    return ((data as ProfileRow[]) || [])
      .filter((r) => r.user_id !== excludeUserId)
      .map((r) => toProfile(r.user_id, r));
  }

  // ------------------------------------------------------------------------------------------------ PUBLICATIONS

  private static async hydratePosts(rows: PostRow[], userId?: string): Promise<ConnectUsPost[]> {
    if (rows.length === 0) return [];
    const authors = await this.fetchProfiles(rows.map((r) => r.user_id));

    const reactions = new Map<string, ReactionType>();
    if (userId) {
      const { data } = await db
        .from("connectus_post_likes")
        .select("post_id, reaction_type")
        .eq("user_id", userId)
        .in("post_id", rows.map((r) => r.id));
      for (const l of (data as Array<{ post_id: string; reaction_type: string | null }>) || []) {
        reactions.set(l.post_id, (l.reaction_type as ReactionType) || "like");
      }
    }

    return rows.map((p) => ({
      id: p.id,
      user_id: p.user_id,
      author: authors.get(p.user_id) || fallbackProfile(p.user_id),
      content: p.content || "",
      media_urls: p.media_urls || [],
      video_url: p.video_url,
      link_preview: p.link_preview,
      attached_product: p.attached_product,
      attached_shop_id: p.attached_shop_id,
      visibility: p.visibility || "public",
      likes_count: p.likes_count || 0,
      comments_count: p.comments_count || 0,
      shares_count: p.shares_count || 0,
      user_reaction: reactions.get(p.id) ?? null,
      created_at: p.created_at,
    }));
  }

  static async getFeedPosts(userId?: string): Promise<ConnectUsPost[]> {
    const { data, error } = await db
      .from("connectus_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(errorMessage(error));
    return this.hydratePosts((data as PostRow[]) || [], userId);
  }

  static async getUserPosts(targetUserId: string, viewerId?: string): Promise<ConnectUsPost[]> {
    const { data, error } = await db
      .from("connectus_posts")
      .select("*")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(errorMessage(error));
    return this.hydratePosts((data as PostRow[]) || [], viewerId);
  }

  static async getPostById(postId: string, viewerId?: string): Promise<ConnectUsPost | null> {
    const { data } = await db.from("connectus_posts").select("*").eq("id", postId).maybeSingle();
    if (!data) return null;
    const [post] = await this.hydratePosts([data as PostRow], viewerId);
    return post || null;
  }

  static async createPost(
    userId: string,
    postData: {
      content: string;
      media_urls: string[];
      video_url?: string | null;
      link_preview?: LinkMetadata | null;
      attached_product?: AttachedProduct | null;
      visibility: VisibilityType;
    }
  ): Promise<ConnectUsPost> {
    const author = await this.getProfile(userId);
    const { data, error } = await db
      .from("connectus_posts")
      .insert({
        user_id: userId,
        content: postData.content,
        media_urls: postData.media_urls,
        video_url: postData.video_url || null,
        link_preview: postData.link_preview || null,
        attached_product: postData.attached_product || null,
        attached_shop_id: author.shop_id || null,
        visibility: postData.visibility,
      })
      .select("*")
      .single();
    if (error) throw new Error(errorMessage(error));
    const [post] = await this.hydratePosts([data as PostRow], userId);
    return { ...post, author };
  }

  static async deletePost(postId: string, userId: string): Promise<boolean> {
    const { data: existing } = await db
      .from("connectus_posts")
      .select("media_urls, video_url")
      .eq("id", postId)
      .eq("user_id", userId)
      .maybeSingle();
    const { error } = await db.from("connectus_posts").delete().eq("id", postId).eq("user_id", userId);
    if (error) return false;
    const row = existing as { media_urls: string[] | null; video_url: string | null } | null;
    if (row) await this.removeMedia([...(row.media_urls || []), row.video_url]);
    return true;
  }

  /** Pose, change ou retire la réaction du membre. Renvoie le compteur réel (tenu par la base). */
  static async toggleReaction(
    postId: string,
    userId: string,
    reactionType: ReactionType = "like"
  ): Promise<{ likesCount: number; userReaction: ReactionType | null }> {
    const { data: existing } = await db
      .from("connectus_post_likes")
      .select("reaction_type")
      .eq("post_id", postId)
      .eq("user_id", userId)
      .maybeSingle();
    const current = (existing as { reaction_type: string | null } | null)?.reaction_type;

    let userReaction: ReactionType | null = reactionType;
    let error: unknown = null;
    if (existing && current === reactionType) {
      ({ error } = await db.from("connectus_post_likes").delete().eq("post_id", postId).eq("user_id", userId));
      userReaction = null;
    } else if (existing) {
      ({ error } = await db
        .from("connectus_post_likes")
        .update({ reaction_type: reactionType })
        .eq("post_id", postId)
        .eq("user_id", userId));
    } else {
      ({ error } = await db
        .from("connectus_post_likes")
        .insert({ post_id: postId, user_id: userId, reaction_type: reactionType }));
    }
    if (error) throw new Error(errorMessage(error));

    const { data: post } = await db.from("connectus_posts").select("likes_count").eq("id", postId).maybeSingle();
    return { likesCount: (post as { likes_count: number | null } | null)?.likes_count ?? 0, userReaction };
  }

  // ------------------------------------------------------------------------------------------------ COMMENTAIRES

  static async getComments(postId: string, userId?: string): Promise<ConnectUsComment[]> {
    const { data, error } = await db
      .from("connectus_comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(300);
    if (error) throw new Error(errorMessage(error));
    const rows = (data as CommentRow[]) || [];
    if (rows.length === 0) return [];

    const authors = await this.fetchProfiles(rows.map((r) => r.user_id));
    const liked = new Set<string>();
    if (userId) {
      const { data: likes } = await db
        .from("connectus_comment_likes")
        .select("comment_id")
        .eq("user_id", userId)
        .in("comment_id", rows.map((r) => r.id));
      for (const l of (likes as Array<{ comment_id: string }>) || []) liked.add(l.comment_id);
    }
    return rows.map((c) => this.toComment(c, authors.get(c.user_id), liked.has(c.id)));
  }

  private static toComment(c: CommentRow, author?: ConnectUsProfile, userLiked = false): ConnectUsComment {
    return {
      id: c.id,
      post_id: c.post_id,
      user_id: c.user_id,
      parent_id: c.parent_id,
      author,
      authorName: author?.full_name || "Membre",
      text: c.text,
      likes_count: c.likes_count || 0,
      user_liked: userLiked,
      created_at: c.created_at,
      date: c.created_at,
    };
  }

  static async addComment(postId: string, userId: string, text: string, parentId?: string | null): Promise<ConnectUsComment> {
    const clean = text.trim();
    if (!clean) throw new Error("Le commentaire est vide.");
    const { data, error } = await db
      .from("connectus_comments")
      .insert({ post_id: postId, user_id: userId, parent_id: parentId || null, text: clean })
      .select("*")
      .single();
    if (error) throw new Error(errorMessage(error));
    const authors = await this.fetchProfiles([userId]);
    return this.toComment(data as CommentRow, authors.get(userId));
  }

  static async deleteComment(commentId: string, userId: string): Promise<boolean> {
    const { error } = await db.from("connectus_comments").delete().eq("id", commentId).eq("user_id", userId);
    return !error;
  }

  static async toggleCommentLike(commentId: string, userId: string): Promise<{ likes_count: number; user_liked: boolean }> {
    const { data: existing } = await db
      .from("connectus_comment_likes")
      .select("comment_id")
      .eq("comment_id", commentId)
      .eq("user_id", userId)
      .maybeSingle();

    let error: unknown;
    if (existing) {
      ({ error } = await db.from("connectus_comment_likes").delete().eq("comment_id", commentId).eq("user_id", userId));
    } else {
      ({ error } = await db.from("connectus_comment_likes").insert({ comment_id: commentId, user_id: userId }));
    }
    if (error) throw new Error(errorMessage(error));

    const { data: c } = await db.from("connectus_comments").select("likes_count").eq("id", commentId).maybeSingle();
    return { likes_count: (c as { likes_count: number | null } | null)?.likes_count ?? 0, user_liked: !existing };
  }

  // ------------------------------------------------------------------------------------------------ ABONNEMENTS

  static async getFollowingIds(userId: string): Promise<string[]> {
    const { data } = await db.from("connectus_follows").select("target_id").eq("follower_id", userId);
    return ((data as Array<{ target_id: string }>) || []).map((f) => f.target_id);
  }

  static async follow(followerId: string, targetId: string): Promise<boolean> {
    if (!followerId || !targetId || followerId === targetId) return false;
    const { error } = await db
      .from("connectus_follows")
      .upsert({ follower_id: followerId, target_id: targetId }, { onConflict: "follower_id,target_id", ignoreDuplicates: true });
    if (error) throw new Error(errorMessage(error));
    return true;
  }

  static async unfollow(followerId: string, targetId: string): Promise<void> {
    const { error } = await db.from("connectus_follows").delete().eq("follower_id", followerId).eq("target_id", targetId);
    if (error) throw new Error(errorMessage(error));
  }

  /** Bascule l'abonnement et renvoie l'état final (true = abonné). */
  static async toggleFollow(followerId: string, targetId: string): Promise<boolean> {
    if (!followerId || !targetId || followerId === targetId) return false;
    const { data: existing } = await db
      .from("connectus_follows")
      .select("id")
      .eq("follower_id", followerId)
      .eq("target_id", targetId)
      .maybeSingle();
    if (existing) {
      await this.unfollow(followerId, targetId);
      return false;
    }
    await this.follow(followerId, targetId);
    return true;
  }

  // ------------------------------------------------------------------------------------------------ NOTIFICATIONS

  static async getNotifications(userId: string): Promise<ConnectUsNotification[]> {
    if (!userId) return [];
    const { data, error } = await db
      .from("connectus_notifications")
      .select("*")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(errorMessage(error));
    const rows = (data as NotificationRow[]) || [];
    const actors = await this.fetchProfiles(rows.map((r) => r.actor_id));
    return rows.map((n) => ({
      id: n.id,
      user_id: n.recipient_id,
      actor_id: n.actor_id,
      actor: actors.get(n.actor_id) || fallbackProfile(n.actor_id),
      type: n.type,
      post_id: n.post_id,
      post_summary: n.post_summary,
      message: n.message,
      status: n.status ?? undefined,
      read: Boolean(n.is_read),
      created_at: n.created_at,
    }));
  }

  static async markAllNotificationsRead(userId: string): Promise<void> {
    await db.from("connectus_notifications").update({ is_read: true }).eq("recipient_id", userId).eq("is_read", false);
  }

  /** Invitation = abonnement + message d'invitation (une seule en attente par destinataire). */
  static async sendInvitation(
    senderId: string,
    targetId: string,
    message: string
  ): Promise<{ ok: boolean; alreadySent?: boolean; error?: string }> {
    if (!senderId || !targetId || senderId === targetId) return { ok: false, error: "Invitation impossible." };
    try {
      await this.follow(senderId, targetId);
    } catch (e) {
      return { ok: false, error: errorMessage(e) };
    }
    const { error } = await db.from("connectus_notifications").insert({
      recipient_id: targetId,
      actor_id: senderId,
      type: "invite_request",
      status: "pending",
      message: message.trim().slice(0, 500),
    });
    if (error) {
      if (isUniqueViolation(error)) return { ok: true, alreadySent: true };
      return { ok: false, error: errorMessage(error) };
    }
    return { ok: true };
  }

  static async acceptFollowInvitation(userId: string, notifId: string, actorUserId: string): Promise<boolean> {
    try {
      await this.follow(userId, actorUserId);
      const { error } = await db
        .from("connectus_notifications")
        .update({ status: "accepted", is_read: true })
        .eq("id", notifId)
        .eq("recipient_id", userId);
      if (error) return false;
      const me = await this.fetchProfiles([userId]);
      await db.from("connectus_notifications").insert({
        recipient_id: actorUserId,
        actor_id: userId,
        type: "invite_accepted",
        message: `${me.get(userId)?.full_name || "Ce membre"} a accepté votre invitation et vous suit à présent.`,
      });
      return true;
    } catch {
      return false;
    }
  }

  static async declineFollowInvitation(userId: string, notifId: string): Promise<boolean> {
    const { error } = await db
      .from("connectus_notifications")
      .update({ status: "declined", is_read: true })
      .eq("id", notifId)
      .eq("recipient_id", userId);
    return !error;
  }

  static subscribeToNotifications(userId: string, onChange: () => void): () => void {
    const channel = supabase
      .channel(`connectus-notifs-${userId}-${channelSuffix()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "connectus_notifications", filter: `recipient_id=eq.${userId}` },
        onChange
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }

  static subscribeToPosts(onInsert: (postId: string, authorId: string) => void, onDelete: (postId: string) => void): () => void {
    const channel = supabase
      .channel(`connectus-posts-live-${channelSuffix()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "connectus_posts" }, (payload) => {
        const row = payload.new as { id?: string; user_id?: string };
        if (row?.id && row.user_id) onInsert(row.id, row.user_id);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "connectus_posts" }, (payload) => {
        const row = payload.old as { id?: string };
        if (row?.id) onDelete(row.id);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }

  // ------------------------------------------------------------------------------------------------ BOUTIQUE

  static async getMerchantProducts(userId: string): Promise<AttachedProduct[]> {
    const { data: shop } = await db
      .from("shops")
      .select("id, slug")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const userShop = shop as { id: string; slug: string | null } | null;
    if (!userShop) return [];

    const { data: products } = await db
      .from("products")
      .select("id, name, price, compare_at_price, category, product_images(image_url)")
      .eq("shop_id", userShop.id)
      .eq("is_published", true)
      .limit(30);

    return (
      (products as Array<{
        id: string;
        name: string;
        price: number;
        compare_at_price: number | null;
        category: string | null;
        product_images: Array<{ image_url: string }> | null;
      }>) || []
    ).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      compare_at_price: p.compare_at_price,
      image_url: p.product_images?.[0]?.image_url || null,
      category: p.category,
      shop_slug: userShop.slug,
    }));
  }

  // ------------------------------------------------------------------------------------------------ MESSAGERIE

  static conversationId(a: string, b: string): string {
    return `conv_${[a, b].sort().join("_")}`;
  }

  static async getConversations(userId: string): Promise<ConnectUsConversation[]> {
    if (!userId) return [];
    const [convRes, unreadRes] = await Promise.all([
      db
        .from("connectus_conversations")
        .select("*")
        .contains("participant_ids", [userId])
        .order("last_message_at", { ascending: false }),
      db.from("connectus_messages").select("conversation_id").eq("receiver_id", userId).eq("is_read", false),
    ]);
    if (convRes.error) throw new Error(errorMessage(convRes.error));

    const rows = ((convRes.data as ConversationRow[]) || []).filter((c) => c.last_message !== null);
    const unread = new Map<string, number>();
    for (const m of (unreadRes.data as Array<{ conversation_id: string }>) || []) {
      unread.set(m.conversation_id, (unread.get(m.conversation_id) || 0) + 1);
    }
    const others = rows.map((c) => c.participant_ids.find((id) => id !== userId) || userId);
    const profiles = await this.fetchProfiles(others);

    return rows.map((c, i) => ({
      id: c.id,
      participant_ids: c.participant_ids,
      other_user: profiles.get(others[i]) || fallbackProfile(others[i]),
      last_message: c.last_message || "",
      last_message_at: c.last_message_at || c.created_at,
      unread_count: unread.get(c.id) || 0,
    }));
  }

  static async getUnreadMessagesCount(userId: string): Promise<number> {
    const { count } = await db
      .from("connectus_messages")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", userId)
      .eq("is_read", false);
    return count ?? 0;
  }

  static async getMessages(conversationId: string): Promise<ConnectUsPrivateMessage[]> {
    if (!conversationId) return [];
    const { data, error } = await db
      .from("connectus_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(300);
    if (error) throw new Error(errorMessage(error));
    return ((data as MessageRow[]) || []).map((m) => this.toMessage(m));
  }

  private static toMessage(m: MessageRow): ConnectUsPrivateMessage {
    return {
      id: m.id,
      conversation_id: m.conversation_id,
      sender_id: m.sender_id,
      receiver_id: m.receiver_id,
      content: m.content,
      media_url: m.media_url,
      status: m.status || "sent",
      created_at: m.created_at,
    };
  }

  static async markConversationRead(conversationId: string): Promise<void> {
    await db.rpc("connectus_mark_conversation_read", { p_conversation_id: conversationId });
  }

  static async sendPrivateMessage(
    senderId: string,
    receiverId: string,
    content: string,
    mediaFile?: File | null
  ): Promise<ConnectUsPrivateMessage> {
    const text = content.trim();
    if (!text && !mediaFile) throw new Error("Message vide.");
    const conversationId = this.conversationId(senderId, receiverId);
    const mediaUrl = mediaFile ? await this.uploadMedia(senderId, mediaFile) : null;

    const { error: convError } = await db
      .from("connectus_conversations")
      .upsert({ id: conversationId, participant_ids: [senderId, receiverId] }, { onConflict: "id", ignoreDuplicates: true });
    if (convError) throw new Error(errorMessage(convError));

    const { data, error } = await db
      .from("connectus_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        receiver_id: receiverId,
        content: text || "📷 Photo",
        media_url: mediaUrl,
      })
      .select("*")
      .single();
    if (error) throw new Error(errorMessage(error));
    return this.toMessage(data as MessageRow);
  }

  static subscribeToMessages(userId: string, onMessage: (message: ConnectUsPrivateMessage) => void): () => void {
    const channel = supabase
      .channel(`connectus-messages-${userId}-${channelSuffix()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "connectus_messages", filter: `receiver_id=eq.${userId}` },
        (payload) => onMessage(this.toMessage(payload.new as MessageRow))
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }

  // ------------------------------------------------------------------------------------------------ STORIES

  static async getActiveStories(userId?: string): Promise<ConnectUsStory[]> {
    const { data, error } = await db
      .from("connectus_stories")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (error) throw new Error(errorMessage(error));
    const rows = (data as StoryRow[]) || [];
    if (rows.length === 0) return [];

    // Auteurs + (pour mes propres stories) la liste des spectateurs, en une seule passe.
    const ownViewerIds = rows.filter((s) => s.user_id === userId).flatMap((s) => s.viewers || []);
    const profiles = await this.fetchProfiles([...rows.map((s) => s.user_id), ...ownViewerIds]);

    const liked = new Set<string>();
    if (userId) {
      const { data: likes } = await db
        .from("connectus_story_likes")
        .select("story_id")
        .eq("user_id", userId)
        .in("story_id", rows.map((s) => s.id));
      for (const l of (likes as Array<{ story_id: string }>) || []) liked.add(l.story_id);
    }

    return rows.map((s) => ({
      id: s.id,
      user_id: s.user_id,
      author: profiles.get(s.user_id) || fallbackProfile(s.user_id),
      media_url: s.media_url,
      media_type: s.media_type || "image",
      caption: s.caption,
      created_at: s.created_at,
      expires_at: s.expires_at,
      views_count: s.views_count || 0,
      viewers: s.viewers || [],
      viewers_details:
        s.user_id === userId
          ? (s.viewers || []).map((id) => ({
              user: profiles.get(id) || fallbackProfile(id),
              viewed_at: s.created_at,
            }))
          : undefined,
      likes_count: s.likes_count || 0,
      user_liked: liked.has(s.id),
    }));
  }

  static async createStory(
    userId: string,
    file: File,
    mediaType: "image" | "video",
    caption?: string | null
  ): Promise<ConnectUsStory> {
    const mediaUrl = await this.uploadMedia(userId, file);
    const { data, error } = await db
      .from("connectus_stories")
      .insert({
        user_id: userId,
        media_url: mediaUrl,
        media_type: mediaType,
        caption: caption?.trim() || null,
      })
      .select("*")
      .single();
    if (error) {
      await this.removeMedia([mediaUrl]);
      throw new Error(errorMessage(error));
    }
    const row = data as StoryRow;
    const author = await this.getProfile(userId);
    return {
      id: row.id,
      user_id: row.user_id,
      author,
      media_url: row.media_url,
      media_type: row.media_type || mediaType,
      caption: row.caption,
      created_at: row.created_at,
      expires_at: row.expires_at,
      views_count: 0,
      viewers: [],
      viewers_details: [],
      likes_count: 0,
    };
  }

  static async deleteStory(storyId: string, userId: string): Promise<boolean> {
    const { data: row } = await db.from("connectus_stories").select("media_url").eq("id", storyId).eq("user_id", userId).maybeSingle();
    const { error } = await db.from("connectus_stories").delete().eq("id", storyId).eq("user_id", userId);
    if (error) return false;
    await this.removeMedia([(row as { media_url: string } | null)?.media_url]);
    return true;
  }

  /** Enregistre la vue (une seule par membre, jamais pour l'auteur) — fonction côté base. */
  static async viewStory(storyId: string): Promise<void> {
    await db.rpc("connectus_view_story", { p_story_id: storyId });
  }

  static async toggleStoryLike(storyId: string, userId: string): Promise<{ likes_count: number; user_liked: boolean }> {
    const { data: existing } = await db
      .from("connectus_story_likes")
      .select("story_id")
      .eq("story_id", storyId)
      .eq("user_id", userId)
      .maybeSingle();

    let error: unknown;
    if (existing) {
      ({ error } = await db.from("connectus_story_likes").delete().eq("story_id", storyId).eq("user_id", userId));
    } else {
      ({ error } = await db.from("connectus_story_likes").insert({ story_id: storyId, user_id: userId }));
    }
    if (error) throw new Error(errorMessage(error));

    const { data: s } = await db.from("connectus_stories").select("likes_count").eq("id", storyId).maybeSingle();
    return { likes_count: (s as { likes_count: number | null } | null)?.likes_count ?? 0, user_liked: !existing };
  }

  static async replyToStory(senderId: string, targetUserId: string, replyText: string): Promise<ConnectUsPrivateMessage> {
    return this.sendPrivateMessage(senderId, targetUserId, `↩️ Réponse à votre story : ${replyText.trim()}`);
  }
}
