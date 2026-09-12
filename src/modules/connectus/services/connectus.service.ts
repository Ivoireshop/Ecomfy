import { supabase } from "@/integrations/supabase/client";
import {
  ConnectUsProfile,
  ConnectUsPost,
  ConnectUsComment,
  ConnectUsNotification,
  ConnectUsConversation,
  ConnectUsPrivateMessage,
  ConnectUsStory,
  ConnectUsStoryViewer,
  ReactionType,
  AttachedProduct,
  VisibilityType
} from "../types/connectus.types";
import { safeLocalStorageSet } from "../utils/fileUploader";

const LOCAL_STORAGE_POSTS_KEY = "ecomfy_connectus_local_posts";
const LOCAL_STORAGE_FOLLOWS_KEY = "ecomfy_connectus_local_follows";
const LOCAL_STORAGE_PROFILE_KEY = "ecomfy_connectus_profile";

export class ConnectUsService {
  /**
   * Safe insertion into Supabase community_messages table (backwards compatibility fallback)
   */
  static async insertCommunityMessage(userId: string | undefined, payloadObj: any): Promise<boolean> {
    try {
      const bodyStr = typeof payloadObj === "string" ? payloadObj : JSON.stringify(payloadObj);
      let activeAuthId = userId;
      if (!activeAuthId || activeAuthId.startsWith("guest_") || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeAuthId)) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          activeAuthId = session.user.id;
        }
      }

      const isValidUUID = Boolean(activeAuthId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeAuthId));
      const targetUserId = isValidUUID && activeAuthId ? activeAuthId : "00000000-0000-0000-0000-000000000000";

      const { error } = await supabase.from("community_messages").insert([
        {
          user_id: targetUserId,
          body: bodyStr,
        },
      ]);

      if (error) {
        console.warn("Supabase community message insert info:", error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.warn("Community message insert exception:", e);
      return false;
    }
  }

  /**
   * Persistent Fetch profile with Supabase DB sync & user-scoped storage
   */
  static async getProfile(userId: string): Promise<ConnectUsProfile> {
    if (!userId) {
      return {
        id: "anon",
        user_id: "anon",
        username: "invite",
        full_name: "Membre Ecomfy",
        avatar_url: null,
        cover_url: null,
        bio: "Membre de la communauté ConnectUs",
        location: "Côte d'Ivoire",
        website_url: null,
        is_verified: true,
        is_business: false,
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
        created_at: new Date().toISOString(),
      };
    }

    const userStorageKey = `${LOCAL_STORAGE_PROFILE_KEY}_${userId}`;
    let savedProfile: Partial<ConnectUsProfile> | null = null;

    try {
      const userJson = localStorage.getItem(userStorageKey);
      const generalJson = localStorage.getItem(LOCAL_STORAGE_PROFILE_KEY);
      if (userJson) {
        savedProfile = JSON.parse(userJson);
      } else if (generalJson) {
        savedProfile = JSON.parse(generalJson);
      }
    } catch (e) {}

    try {
      // 1. Check connectus_profiles table first
      // @ts-ignore - DB types regenerate after migration
      const { data: connProfile } = await supabase
        .from("connectus_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      // 2. Fetch standard profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, updated_at")
        .eq("id", userId)
        .maybeSingle();

      // 3. Fetch user shop
      const { data: userShop } = await supabase
        .from("shops")
        .select("id, business_name, slug")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 4. Fetch counts from DB
      let followersCount = connProfile?.followers_count || 0;
      let followingCount = connProfile?.following_count || 0;
      let postsCount = connProfile?.posts_count || 0;

      if (!userId.startsWith("guest_")) {
        try {
          // @ts-ignore
          const { count: fCount } = await supabase.from("connectus_follows").select("*", { count: "exact", head: true }).eq("target_id", userId);
          // @ts-ignore
          const { count: fgCount } = await supabase.from("connectus_follows").select("*", { count: "exact", head: true }).eq("follower_id", userId);
          // @ts-ignore
          const { count: pCount } = await supabase.from("connectus_posts").select("*", { count: "exact", head: true }).eq("user_id", userId);

          if (fCount !== null) followersCount = fCount;
          if (fgCount !== null) followingCount = fgCount;
          if (pCount !== null) postsCount = pCount;
        } catch (e) {}
      }

      const defaultFullName = connProfile?.full_name || profile?.full_name || savedProfile?.full_name || "Membre Ecomfy";
      const savedCustomUsername = localStorage.getItem(`ecomfy_connectus_custom_username_${userId}`);
      const username = connProfile?.username || savedCustomUsername || savedProfile?.username || (
        (profile?.full_name || defaultFullName)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_")
      );

      const createdProfile: ConnectUsProfile = {
        id: userId,
        user_id: userId,
        username,
        full_name: connProfile?.full_name || savedProfile?.full_name || defaultFullName,
        avatar_url: connProfile?.avatar_url || savedProfile?.avatar_url || profile?.avatar_url || null,
        cover_url: connProfile?.cover_url || savedProfile?.cover_url || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&auto=format&fit=crop&q=80",
        bio: connProfile?.bio || savedProfile?.bio || (userShop ? `Fondateur de ${userShop.business_name} sur Ecomfy 🚀` : "Membre passionné de la communauté ConnectUs"),
        location: connProfile?.location || savedProfile?.location || "Côte d'Ivoire",
        website_url: connProfile?.website_url || savedProfile?.website_url || null,
        is_verified: true,
        is_business: connProfile?.is_business ?? savedProfile?.is_business ?? Boolean(userShop),
        followers_count: followersCount,
        following_count: followingCount,
        posts_count: postsCount,
        shop_id: userShop?.id || connProfile?.shop_id || savedProfile?.shop_id,
        shop_slug: userShop?.slug || connProfile?.shop_slug || savedProfile?.shop_slug,
        shop_name: userShop?.business_name || connProfile?.shop_name || savedProfile?.shop_name,
        show_shop_on_profile: connProfile?.show_shop_on_profile ?? savedProfile?.show_shop_on_profile ?? Boolean(userShop),
        created_at: profile?.updated_at || savedProfile?.created_at || new Date().toISOString(),
      };

      safeLocalStorageSet(LOCAL_STORAGE_PROFILE_KEY, createdProfile);
      safeLocalStorageSet(userStorageKey, createdProfile);
      return createdProfile;
    } catch (e) {
      if (savedProfile) return { ...savedProfile, id: userId, user_id: userId } as ConnectUsProfile;
      return {
        id: userId,
        user_id: userId,
        username: `user_${userId.slice(0, 6)}`,
        full_name: "Membre Ecomfy",
        avatar_url: null,
        cover_url: null,
        bio: "Membre passionné de la communauté ConnectUs",
        location: "Côte d'Ivoire",
        website_url: null,
        is_verified: true,
        is_business: false,
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
        created_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Save persistent profile changes with Supabase DB sync & LocalStorage fallback
   */
  static async saveProfile(profile: ConnectUsProfile): Promise<boolean> {
    try {
      safeLocalStorageSet(LOCAL_STORAGE_PROFILE_KEY, profile);
      if (profile.user_id) {
        safeLocalStorageSet(`${LOCAL_STORAGE_PROFILE_KEY}_${profile.user_id}`, profile);
        if (profile.username) {
          try {
            localStorage.setItem(`ecomfy_connectus_custom_username_${profile.user_id}`, profile.username);
          } catch (e) {}
        }
      }

      if (profile.user_id && !profile.user_id.startsWith("guest_")) {
        // Sync to standard profiles table
        await supabase.from("profiles").update({
          full_name: profile.full_name,
          avatar_url: profile.avatar_url || null,
          updated_at: new Date().toISOString(),
        }).eq("id", profile.user_id);

        // Sync to connectus_profiles table
        try {
          // @ts-ignore
          await supabase.from("connectus_profiles").upsert({
            id: profile.user_id,
            user_id: profile.user_id,
            username: profile.username,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url || null,
            cover_url: profile.cover_url || null,
            bio: profile.bio || null,
            location: profile.location || null,
            website_url: profile.website_url || null,
            is_verified: profile.is_verified,
            is_business: profile.is_business,
            show_shop_on_profile: Boolean(profile.show_shop_on_profile),
            shop_id: profile.shop_id || null,
            shop_name: profile.shop_name || null,
            shop_slug: profile.shop_slug || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
        } catch (e) {
          console.warn("connectus_profiles upsert fallback warning:", e);
        }
      }
      return true;
    } catch (e) {
      console.error("Failed to save profile:", e);
      return false;
    }
  }

  /**
   * Fetch all feed posts (Cloud DB + Local cache + Aggregated Likes & Comments)
   */
  static async getFeedPosts(userId?: string): Promise<ConnectUsPost[]> {
    let cloudPosts: ConnectUsPost[] = [];

    // 1. Attempt to fetch real posts from connectus_posts SQL table
    try {
      // @ts-ignore
      const { data: dbPosts, error: postsErr } = await supabase
        .from("connectus_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!postsErr && dbPosts && dbPosts.length > 0) {
        for (const p of dbPosts) {
          const author = await this.getProfile(p.user_id);
          cloudPosts.push({
            id: p.id,
            user_id: p.user_id,
            author,
            content: p.content || "",
            media_urls: p.media_urls || [],
            video_url: p.video_url || null,
            link_preview: p.link_preview || null,
            attached_product: p.attached_product || null,
            attached_shop_id: p.attached_shop_id || null,
            visibility: p.visibility || "public",
            likes_count: p.likes_count || 0,
            comments_count: p.comments_count || 0,
            shares_count: p.shares_count || 0,
            user_reaction: null,
            created_at: p.created_at || new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      console.warn("connectus_posts table query fallback:", e);
    }

    // 2. Fallback to community_messages if connectus_posts is empty
    if (cloudPosts.length === 0) {
      try {
        const { data: dbMessages } = await supabase
          .from("community_messages")
          .select("id, user_id, body, created_at")
          .order("created_at", { ascending: false })
          .limit(200);

        if (dbMessages && dbMessages.length > 0) {
          for (const msg of dbMessages) {
            if (!msg || !msg.body) continue;
            let parsed: any;
            try {
              parsed = typeof msg.body === "string" ? JSON.parse(msg.body) : msg.body;
            } catch (e) {
              parsed = { connectus_type: "post", content: msg.body };
            }

            if (parsed?.connectus_type === "post" || (!parsed?.connectus_type && parsed?.content)) {
              const author = await this.getProfile(msg.user_id);
              cloudPosts.push({
                id: parsed.id || msg.id,
                user_id: msg.user_id,
                author,
                content: parsed.content || parsed.text || "",
                media_urls: Array.isArray(parsed.media_urls) ? parsed.media_urls : [],
                video_url: parsed.video_url || null,
                link_preview: parsed.link_preview || null,
                attached_product: parsed.attached_product || null,
                visibility: parsed.visibility || "public",
                likes_count: Number(parsed.likes_count) || 0,
                comments_count: Number(parsed.comments_count) || 0,
                shares_count: Number(parsed.shares_count) || 0,
                created_at: parsed.created_at || msg.created_at || new Date().toISOString(),
              });
            }
          }
        }
      } catch (e) {}
    }

    // 3. Load local posts cache
    let localPosts: ConnectUsPost[] = [];
    try {
      const localStoredJson = localStorage.getItem(LOCAL_STORAGE_POSTS_KEY);
      if (localStoredJson) localPosts = JSON.parse(localStoredJson);
    } catch (e) {}

    // Load deleted post IDs
    let deletedPostIds: string[] = [];
    try {
      const deletedJson = localStorage.getItem("ecomfy_connectus_deleted_posts");
      if (deletedJson) deletedPostIds = JSON.parse(deletedJson);
    } catch (e) {}
    const deletedSet = new Set(deletedPostIds);

    // Merge and deduplicate
    const realPostsMap = new Map<string, ConnectUsPost>();
    [...localPosts, ...cloudPosts].forEach((p) => {
      if (p && p.id && !deletedSet.has(p.id)) {
        realPostsMap.set(p.id, p);
      }
    });

    const finalFeed = Array.from(realPostsMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // 4. Attach user reactions & comments
    for (const post of finalFeed) {
      if (userId && !userId.startsWith("guest_")) {
        try {
          // @ts-ignore
          const { data: myLike } = await supabase.from("connectus_post_likes").select("reaction_type").eq("post_id", post.id).eq("user_id", userId).maybeSingle();
          if (myLike) {
            post.user_reaction = (myLike.reaction_type as ReactionType) || "like";
          }

          // @ts-ignore
          const { count: likesCount } = await supabase.from("connectus_post_likes").select("*", { count: "exact", head: true }).eq("post_id", post.id);
          if (likesCount !== null && likesCount > 0) {
            post.likes_count = likesCount;
          }

          // @ts-ignore
          const { data: commentsData } = await supabase.from("connectus_comments").select("*").eq("post_id", post.id).order("created_at", { ascending: true });
          if (commentsData && commentsData.length > 0) {
            post.comments_count = commentsData.length;
            post.comments = commentsData.map((c: any) => ({
              id: c.id,
              post_id: c.post_id,
              user_id: c.user_id,
              authorName: c.authorName || "Membre",
              text: c.text,
              likes_count: c.likes_count || 0,
              created_at: c.created_at,
              date: c.created_at,
            }));
          }
        } catch (e) {}
      }
    }

    return finalFeed;
  }

  /**
   * Create a new post in ConnectUs with Cloud database sync
   */
  static async createPost(
    userId: string,
    postData: {
      content: string;
      media_urls: string[];
      video_url?: string | null;
      link_preview?: any;
      attached_product?: AttachedProduct | null;
      visibility: VisibilityType;
    }
  ): Promise<ConnectUsPost> {
    let activeUserId = userId;
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      activeUserId = session.user.id;
    }

    const authorProfile = await this.getProfile(activeUserId);
    const postId = `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const newPost: ConnectUsPost = {
      id: postId,
      user_id: activeUserId,
      author: authorProfile,
      content: postData.content,
      media_urls: postData.media_urls,
      video_url: postData.video_url || null,
      link_preview: postData.link_preview || null,
      attached_product: postData.attached_product || null,
      attached_shop_id: authorProfile.shop_id || null,
      visibility: postData.visibility,
      likes_count: 0,
      comments_count: 0,
      shares_count: 0,
      user_reaction: null,
      created_at: new Date().toISOString(),
    };

    // 1. Insert into connectus_posts SQL table
    if (!activeUserId.startsWith("guest_")) {
      try {
        // @ts-ignore
        await supabase.from("connectus_posts").insert([
          {
            id: newPost.id,
            user_id: activeUserId,
            content: newPost.content,
            media_urls: newPost.media_urls,
            video_url: newPost.video_url,
            link_preview: newPost.link_preview,
            attached_product: newPost.attached_product,
            attached_shop_id: newPost.attached_shop_id,
            visibility: newPost.visibility,
            created_at: newPost.created_at,
          },
        ]);
      } catch (e) {
        console.warn("connectus_posts insert fallback:", e);
      }
    }

    // 2. Also insert JSON payload into community_messages as fallback
    const postPayload = JSON.stringify({
      connectus_type: "post",
      id: newPost.id,
      user_id: activeUserId,
      author: newPost.author,
      content: newPost.content,
      media_urls: newPost.media_urls,
      video_url: newPost.video_url,
      link_preview: newPost.link_preview,
      attached_product: newPost.attached_product,
      visibility: newPost.visibility,
      created_at: newPost.created_at,
    });
    await this.insertCommunityMessage(activeUserId, postPayload);

    // 3. Save locally as secondary cache
    const existingJson = localStorage.getItem(LOCAL_STORAGE_POSTS_KEY);
    let existingPosts: ConnectUsPost[] = existingJson ? JSON.parse(existingJson) : [];
    existingPosts.unshift(newPost);
    safeLocalStorageSet(LOCAL_STORAGE_POSTS_KEY, existingPosts);

    return newPost;
  }

  /**
   * Delete post permanently from Supabase cloud database & local storage
   */
  static async deletePost(postId: string, userId: string): Promise<boolean> {
    try {
      try {
        const deletedJson = localStorage.getItem("ecomfy_connectus_deleted_posts");
        let deletedPostIds: string[] = deletedJson ? JSON.parse(deletedJson) : [];
        if (!deletedPostIds.includes(postId)) {
          deletedPostIds.push(postId);
          localStorage.setItem("ecomfy_connectus_deleted_posts", JSON.stringify(deletedPostIds));
        }
      } catch (e) {}

      if (userId && !userId.startsWith("guest_")) {
        try {
          // @ts-ignore
          await supabase.from("connectus_posts").delete().eq("id", postId).eq("user_id", userId);
        } catch (e) {}

        try {
          await supabase.from("community_messages").delete().eq("user_id", userId).eq("id", postId);
        } catch (e) {}
      }

      const existingJson = localStorage.getItem(LOCAL_STORAGE_POSTS_KEY);
      if (existingJson) {
        let posts: ConnectUsPost[] = JSON.parse(existingJson);
        const filtered = posts.filter(p => p.id !== postId);
        safeLocalStorageSet(LOCAL_STORAGE_POSTS_KEY, filtered);
      }

      return true;
    } catch (e) {
      console.error("Error in deletePost:", e);
      return false;
    }
  }

  /**
   * Toggle reaction on a post with Cloud DB sync
   */
  static async toggleReaction(
    postId: string,
    userId: string,
    reactionType: ReactionType = "like"
  ): Promise<{ likesCount: number; userReaction: ReactionType | null }> {
    let userReaction: ReactionType | null = reactionType;
    let likesCount = 1;

    if (userId && !userId.startsWith("guest_")) {
      try {
        // @ts-ignore
        const { data: existingLike } = await supabase.from("connectus_post_likes").select("*").eq("post_id", postId).eq("user_id", userId).maybeSingle();
        if (existingLike) {
          // @ts-ignore
          await supabase.from("connectus_post_likes").delete().eq("post_id", postId).eq("user_id", userId);
          userReaction = null;
        } else {
          // @ts-ignore
          await supabase.from("connectus_post_likes").insert([{ post_id: postId, user_id: userId, reaction_type: reactionType }]);
          userReaction = reactionType;
        }

        // @ts-ignore
        const { count } = await supabase.from("connectus_post_likes").select("*", { count: "exact", head: true }).eq("post_id", postId);
        if (count !== null) likesCount = count;

        // Update post likes_count in connectus_posts
        // @ts-ignore
        await supabase.from("connectus_posts").update({ likes_count: likesCount }).eq("id", postId);
      } catch (e) {
        console.warn("connectus_post_likes fallback:", e);
      }
    }

    // Local fallback update
    const localStoredJson = localStorage.getItem(LOCAL_STORAGE_POSTS_KEY);
    if (localStoredJson) {
      try {
        let localPosts: ConnectUsPost[] = JSON.parse(localStoredJson);
        const postIndex = localPosts.findIndex(p => p.id === postId);
        if (postIndex !== -1) {
          localPosts[postIndex].user_reaction = userReaction;
          localPosts[postIndex].likes_count = likesCount;
          safeLocalStorageSet(LOCAL_STORAGE_POSTS_KEY, localPosts);
        }
      } catch (e) {}
    }

    return { likesCount, userReaction };
  }

  /**
   * Add a comment to a post with Cloud DB sync & Notification trigger
   */
  static async addComment(
    postId: string,
    userId: string,
    author: Partial<ConnectUsProfile>,
    text: string
  ): Promise<any> {
    const commentId = `comment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const commentObj = {
      id: commentId,
      post_id: postId,
      user_id: userId,
      authorName: author.full_name || "Membre",
      text: text.trim(),
      date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    if (userId && !userId.startsWith("guest_")) {
      try {
        // @ts-ignore
        await supabase.from("connectus_comments").insert([
          {
            id: commentId,
            post_id: postId,
            user_id: userId,
            text: commentObj.text,
            created_at: commentObj.created_at,
          },
        ]);
      } catch (e) {
        console.warn("connectus_comments insert fallback:", e);
      }
    }

    return commentObj;
  }

  /**
   * Send real-time notification to a target user
   */
  static async sendNotification(
    recipientUserId: string,
    actorUserId: string,
    type: ConnectUsNotification["type"],
    text: string,
    options?: { postId?: string; postSummary?: string; message?: string }
  ): Promise<boolean> {
    if (!recipientUserId || recipientUserId === actorUserId) return false;

    try {
      const actorProfile = await this.getProfile(actorUserId);
      const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newNotif: ConnectUsNotification = {
        id: notifId,
        user_id: recipientUserId,
        actor_id: actorUserId,
        actor: actorProfile,
        type,
        post_id: options?.postId || null,
        post_summary: options?.postSummary || null,
        message: options?.message || text,
        status: type === "invite_request" ? "pending" : undefined,
        read: false,
        created_at: new Date().toISOString(),
      };

      if (!actorUserId.startsWith("guest_")) {
        try {
          // @ts-ignore
          await supabase.from("connectus_notifications").insert([
            {
              id: notifId,
              recipient_id: recipientUserId,
              actor_id: actorUserId,
              type,
              post_id: options?.postId || null,
              post_summary: options?.postSummary || null,
              message: options?.message || text,
              status: newNotif.status || null,
              is_read: false,
              created_at: newNotif.created_at,
            },
          ]);
        } catch (e) {
          console.warn("connectus_notifications insert fallback:", e);
        }
      }

      const storageKey = `ecomfy_connectus_notifs_${recipientUserId}`;
      const existingJson = localStorage.getItem(storageKey);
      let notifs: ConnectUsNotification[] = existingJson ? JSON.parse(existingJson) : [];
      notifs.unshift(newNotif);
      safeLocalStorageSet(storageKey, notifs);

      return true;
    } catch (e) {
      console.error("Error sending notification:", e);
      return false;
    }
  }

  /**
   * Fetch real notifications for a user (Cloud + Local)
   */
  static async getNotifications(userId: string): Promise<ConnectUsNotification[]> {
    if (!userId) return [];

    let notifs: ConnectUsNotification[] = [];

    if (!userId.startsWith("guest_")) {
      try {
        // @ts-ignore
        const { data: dbNotifs } = await supabase
          .from("connectus_notifications")
          .select("*")
          .eq("recipient_id", userId)
          .order("created_at", { ascending: false })
          .limit(100);

        if (dbNotifs && dbNotifs.length > 0) {
          for (const n of dbNotifs) {
            const actor = await this.getProfile(n.actor_id);
            notifs.push({
              id: n.id,
              user_id: n.recipient_id,
              actor_id: n.actor_id,
              actor,
              type: n.type as any,
              post_id: n.post_id || null,
              post_summary: n.post_summary || null,
              message: n.message || null,
              status: n.status as any,
              read: n.is_read || false,
              created_at: n.created_at || new Date().toISOString(),
            });
          }
        }
      } catch (e) {}
    }

    const storageKey = `ecomfy_connectus_notifs_${userId}`;
    const localJson = localStorage.getItem(storageKey);
    let localNotifs: ConnectUsNotification[] = localJson ? JSON.parse(localJson) : [];

    const mergedMap = new Map<string, ConnectUsNotification>();
    [...localNotifs, ...notifs].forEach((n) => mergedMap.set(n.id, n));
    const result = Array.from(mergedMap.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    safeLocalStorageSet(storageKey, result);
    return result;
  }

  /**
   * Accept follow invitation
   */
  static async acceptFollowInvitation(userId: string, notifId: string, actorUserId: string): Promise<boolean> {
    try {
      await this.toggleFollow(userId, actorUserId);
      await this.toggleFollow(actorUserId, userId);

      const storageKey = `ecomfy_connectus_notifs_${userId}`;
      const localJson = localStorage.getItem(storageKey);
      if (localJson) {
        let notifs: ConnectUsNotification[] = JSON.parse(localJson);
        notifs = notifs.map(n => n.id === notifId ? { ...n, status: "accepted", read: true } : n);
        safeLocalStorageSet(storageKey, notifs);
      }

      if (!userId.startsWith("guest_")) {
        try {
          // @ts-ignore
          await supabase.from("connectus_notifications").update({ status: "accepted", is_read: true }).eq("id", notifId);
        } catch (e) {}
      }

      const userProfile = await this.getProfile(userId);
      await this.sendNotification(
        actorUserId,
        userId,
        "invite_accepted",
        `${userProfile.full_name} a accepté votre invitation et vous suit à présent !`
      );

      return true;
    } catch (e) {
      console.error("Error accepting follow invitation:", e);
      return false;
    }
  }

  /**
   * Decline follow invitation
   */
  static async declineFollowInvitation(userId: string, notifId: string): Promise<boolean> {
    try {
      const storageKey = `ecomfy_connectus_notifs_${userId}`;
      const localJson = localStorage.getItem(storageKey);
      if (localJson) {
        let notifs: ConnectUsNotification[] = JSON.parse(localJson);
        notifs = notifs.map(n => n.id === notifId ? { ...n, status: "declined", read: true } : n);
        safeLocalStorageSet(storageKey, notifs);
      }

      if (!userId.startsWith("guest_")) {
        try {
          // @ts-ignore
          await supabase.from("connectus_notifications").update({ status: "declined", is_read: true }).eq("id", notifId);
        } catch (e) {}
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Fetch products for merchant shop
   */
  static async getMerchantProducts(userId: string): Promise<AttachedProduct[]> {
    try {
      const { data: userShop } = await supabase
        .from("shops")
        .select("id, slug")
        .eq("user_id", userId)
        .maybeSingle();

      if (!userShop) return [];

      const { data: products } = await supabase
        .from("products")
        .select("id, name, price, compare_at_price, category, product_images(image_url)")
        .eq("shop_id", userShop.id)
        .eq("is_published", true)
        .limit(20);

      return (products || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        compare_at_price: p.compare_at_price,
        image_url: p.product_images?.[0]?.image_url || null,
        category: p.category,
        shop_slug: userShop.slug,
      }));
    } catch (e) {
      return [];
    }
  }

  /**
   * Toggle Follow / Unfollow
   */
  static async toggleFollow(followerId: string, targetUserId: string): Promise<boolean> {
    if (!followerId || !targetUserId || followerId === targetUserId) return false;
    let nowFollowing = false;

    if (!followerId.startsWith("guest_")) {
      try {
        // @ts-ignore
        const { data: existing } = await supabase.from("connectus_follows").select("*").eq("follower_id", followerId).eq("target_id", targetUserId).maybeSingle();
        if (existing) {
          // @ts-ignore
          await supabase.from("connectus_follows").delete().eq("follower_id", followerId).eq("target_id", targetUserId);
          nowFollowing = false;
        } else {
          // @ts-ignore
          await supabase.from("connectus_follows").insert([{ follower_id: followerId, target_id: targetUserId }]);
          nowFollowing = true;
          // Send notification
          const followerProfile = await this.getProfile(followerId);
          await this.sendNotification(
            targetUserId,
            followerId,
            "follow",
            `${followerProfile.full_name} a commencé à vous suivre sur ConnectUs !`
          );
        }
      } catch (e) {
        console.warn("connectus_follows fallback:", e);
      }
    }

    try {
      const followsJson = localStorage.getItem(LOCAL_STORAGE_FOLLOWS_KEY);
      let follows: string[] = followsJson ? JSON.parse(followsJson) : [];
      const index = follows.indexOf(targetUserId);
      if (index >= 0) {
        follows.splice(index, 1);
        if (followerId.startsWith("guest_")) nowFollowing = false;
      } else {
        follows.push(targetUserId);
        if (followerId.startsWith("guest_")) nowFollowing = true;
      }
      safeLocalStorageSet(LOCAL_STORAGE_FOLLOWS_KEY, follows);
    } catch (e) {}

    return nowFollowing;
  }

  /**
   * Search registered profiles by name, username, shop name or partial match
   */
  static async searchProfiles(query: string): Promise<ConnectUsProfile[]> {
    if (!query || query.trim().length === 0) return [];
    const cleanQ = query.trim().replace(/^@/, "").toLowerCase();
    if (!cleanQ) return [];

    const realResults: ConnectUsProfile[] = [];

    // 1. Search in connectus_profiles SQL table
    try {
      // @ts-ignore
      const { data: connProfiles } = await supabase
        .from("connectus_profiles")
        .select("*")
        .or(`full_name.ilike.%${cleanQ}%,username.ilike.%${cleanQ}%,shop_name.ilike.%${cleanQ}%`)
        .limit(20);

      if (connProfiles && connProfiles.length > 0) {
        for (const p of connProfiles) {
          realResults.push({
            id: p.user_id,
            user_id: p.user_id,
            username: p.username,
            full_name: p.full_name,
            avatar_url: p.avatar_url || null,
            cover_url: p.cover_url || null,
            bio: p.bio || null,
            location: p.location || "Côte d'Ivoire",
            website_url: p.website_url || null,
            is_verified: true,
            is_business: p.is_business,
            show_shop_on_profile: Boolean(p.show_shop_on_profile),
            followers_count: p.followers_count || 0,
            following_count: p.following_count || 0,
            posts_count: p.posts_count || 0,
            created_at: p.updated_at || new Date().toISOString(),
          });
        }
      }
    } catch (e) {}

    // 2. Search in standard profiles table
    try {
      const { data: dbProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, updated_at")
        .or(`full_name.ilike.%${cleanQ}%`)
        .limit(20);

      if (dbProfiles && dbProfiles.length > 0) {
        for (const p of dbProfiles) {
          if (!realResults.some(r => r.id === p.id)) {
            const profile = await this.getProfile(p.id);
            realResults.push(profile);
          }
        }
      }
    } catch (e) {}

    return realResults;
  }

  /**
   * Add a reply to a parent comment & send notification to parent comment author
   */
  static async addCommentReply(
    postId: string,
    parentCommentId: string,
    userId: string,
    author: Partial<ConnectUsProfile>,
    text: string,
    parentAuthorId?: string
  ): Promise<any> {
    const replyId = `reply-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const replyObj: ConnectUsComment = {
      id: replyId,
      post_id: postId,
      user_id: userId,
      parent_id: parentCommentId,
      authorName: author.full_name || "Membre",
      text: text.trim(),
      date: new Date().toISOString(),
      likes_count: 0,
      user_liked: false,
      created_at: new Date().toISOString(),
    };

    if (userId && !userId.startsWith("guest_")) {
      try {
        // @ts-ignore
        await supabase.from("connectus_comments").insert([
          {
            id: replyId,
            post_id: postId,
            user_id: userId,
            parent_id: parentCommentId,
            text: replyObj.text,
            created_at: replyObj.created_at,
          },
        ]);
      } catch (e) {}
    }

    if (parentAuthorId && parentAuthorId !== userId) {
      await this.sendNotification(
        parentAuthorId,
        userId,
        "comment_reply",
        `a répondu à votre commentaire : "${text.slice(0, 35)}${text.length > 35 ? '...' : ''}"`,
        { postId }
      );
    }

    return replyObj;
  }

  /**
   * Toggle Like on a comment
   */
  static async toggleCommentLike(
    postId: string,
    commentId: string,
    userId: string
  ): Promise<{ likes_count: number; user_liked: boolean }> {
    const storageKey = `ecomfy_comment_likes_${commentId}`;
    const isLiked = localStorage.getItem(storageKey) === "true";
    const newLiked = !isLiked;

    localStorage.setItem(storageKey, newLiked ? "true" : "false");
    const countKey = `ecomfy_comment_likes_count_${commentId}`;
    const currentCount = parseInt(localStorage.getItem(countKey) || "0", 10);
    const newCount = Math.max(0, currentCount + (newLiked ? 1 : -1));
    localStorage.setItem(countKey, newCount.toString());

    return { likes_count: newCount, user_liked: newLiked };
  }

  /**
   * Check if User A and User B follow each other mutually
   */
  static isMutualFollow(userAId: string, userBId: string): boolean {
    if (!userAId || !userBId || userAId === userBId) return false;
    try {
      const followsJson = localStorage.getItem(LOCAL_STORAGE_FOLLOWS_KEY);
      const follows: string[] = followsJson ? JSON.parse(followsJson) : [];
      return follows.includes(userBId);
    } catch (e) {
      return false;
    }
  }

  /**
   * Get list of private conversations for a user
   */
  static async getConversations(userId: string): Promise<ConnectUsConversation[]> {
    if (!userId) return [];
    let conversations: ConnectUsConversation[] = [];

    if (!userId.startsWith("guest_")) {
      try {
        // @ts-ignore
        const { data: dbConvs } = await supabase
          .from("connectus_conversations")
          .select("*")
          .contains("participant_ids", [userId])
          .order("last_message_at", { ascending: false });

        if (dbConvs && dbConvs.length > 0) {
          for (const c of dbConvs) {
            const otherUserId = c.participant_ids.find((id: string) => id !== userId) || userId;
            const otherProfile = await this.getProfile(otherUserId);
            conversations.push({
              id: c.id,
              participant_ids: c.participant_ids,
              other_user: otherProfile,
              last_message: c.last_message || "",
              last_message_at: c.last_message_at || c.created_at,
              unread_count: 0,
            });
          }
        }
      } catch (e) {}
    }

    const storageKey = `ecomfy_connectus_conversations_${userId}`;
    const localJson = localStorage.getItem(storageKey);
    let localConvs: ConnectUsConversation[] = localJson ? JSON.parse(localJson) : [];

    const mergedMap = new Map<string, ConnectUsConversation>();
    [...localConvs, ...conversations].forEach(c => mergedMap.set(c.id, c));
    const result = Array.from(mergedMap.values());
    safeLocalStorageSet(storageKey, result);

    return result;
  }

  /**
   * Get private messages for a conversation
   */
  static async getMessages(conversationId: string): Promise<ConnectUsPrivateMessage[]> {
    if (!conversationId) return [];
    let messages: ConnectUsPrivateMessage[] = [];

    try {
      // @ts-ignore
      const { data: dbMsgs } = await supabase
        .from("connectus_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (dbMsgs && dbMsgs.length > 0) {
        for (const m of dbMsgs) {
          const senderProfile = await this.getProfile(m.sender_id);
          messages.push({
            id: m.id,
            conversation_id: m.conversation_id,
            sender_id: m.sender_id,
            receiver_id: m.receiver_id,
            sender: senderProfile,
            content: m.content,
            media_url: m.media_url || null,
            status: (m.status as any) || "sent",
            created_at: m.created_at || new Date().toISOString(),
          });
        }
      }
    } catch (e) {}

    const storageKey = `ecomfy_connectus_messages_${conversationId}`;
    const localJson = localStorage.getItem(storageKey);
    let localMsgs: ConnectUsPrivateMessage[] = localJson ? JSON.parse(localJson) : [];

    const mergedMap = new Map<string, ConnectUsPrivateMessage>();
    [...localMsgs, ...messages].forEach(m => mergedMap.set(m.id, m));
    const result = Array.from(mergedMap.values()).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    safeLocalStorageSet(storageKey, result);
    return result;
  }

  /**
   * Send private message with text and high-quality image attachment
   */
  static async sendPrivateMessage(
    senderId: string,
    receiverId: string,
    content: string,
    mediaUrl?: string | null
  ): Promise<ConnectUsPrivateMessage> {
    const senderProfile = await this.getProfile(senderId);
    const conversationId = `conv_${[senderId, receiverId].sort().join("_")}`;
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const newMsg: ConnectUsPrivateMessage = {
      id: msgId,
      conversation_id: conversationId,
      sender_id: senderId,
      receiver_id: receiverId,
      sender: senderProfile,
      content: content.trim(),
      media_url: mediaUrl || null,
      status: "sent",
      created_at: new Date().toISOString(),
    };

    if (!senderId.startsWith("guest_")) {
      try {
        // Upsert conversation row
        // @ts-ignore
        await supabase.from("connectus_conversations").upsert({
          id: conversationId,
          participant_ids: [senderId, receiverId],
          last_message: mediaUrl ? "📷 Image partagée" : content,
          last_message_at: newMsg.created_at,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });

        // Insert message
        // @ts-ignore
        await supabase.from("connectus_messages").insert([
          {
            id: msgId,
            conversation_id: conversationId,
            sender_id: senderId,
            receiver_id: receiverId,
            content: newMsg.content,
            media_url: newMsg.media_url,
            status: "sent",
            created_at: newMsg.created_at,
          },
        ]);
      } catch (e) {
        console.warn("connectus_messages insert fallback:", e);
      }
    }

    // Save locally
    const storageKey = `ecomfy_connectus_messages_${conversationId}`;
    const existingJson = localStorage.getItem(storageKey);
    let messages: ConnectUsPrivateMessage[] = existingJson ? JSON.parse(existingJson) : [];
    messages.push(newMsg);
    safeLocalStorageSet(storageKey, messages);

    // Trigger Notification to Receiver
    await this.sendNotification(
      receiverId,
      senderId,
      "private_message",
      mediaUrl ? "vous a envoyé une image par message privé 📷" : `vous a envoyé un message : "${content.slice(0, 30)}..."`,
      { message: content }
    );

    return newMsg;
  }

  /**
   * Send invitation & auto-follow user & trigger notification
   */
  static async sendInvitation(senderUserId: string, targetUserId: string, message: string): Promise<boolean> {
    await this.toggleFollow(senderUserId, targetUserId);
    await this.sendNotification(
      targetUserId,
      senderUserId,
      "invite_request",
      message || "vous invite à vous abonner et le suivre sur ConnectUs !",
      { message }
    );
    return true;
  }

  /**
   * Get active stories (expires_at > now)
   */
  static async getActiveStories(): Promise<ConnectUsStory[]> {
    let stories: ConnectUsStory[] = [];

    try {
      // @ts-ignore
      const { data: dbStories } = await supabase
        .from("connectus_stories")
        .select("*")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (dbStories && dbStories.length > 0) {
        for (const s of dbStories) {
          const author = await this.getProfile(s.user_id);
          stories.push({
            id: s.id,
            user_id: s.user_id,
            author,
            media_url: s.media_url,
            media_type: s.media_type || "image",
            caption: s.caption || null,
            created_at: s.created_at,
            expires_at: s.expires_at,
            views_count: s.views_count || 0,
            viewers: s.viewers || [],
            likes_count: s.likes_count || 0,
          });
        }
      }
    } catch (e) {}

    const LOCAL_STORAGE_STORIES_KEY = "ecomfy_connectus_stories";
    let localStories: ConnectUsStory[] = [];
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_STORIES_KEY);
      if (stored) localStories = JSON.parse(stored);
    } catch (e) {}

    const now = Date.now();
    const activeLocal = localStories.filter((s) => new Date(s.expires_at).getTime() > now);

    const mergedMap = new Map<string, ConnectUsStory>();
    [...activeLocal, ...stories].forEach(s => mergedMap.set(s.id, s));
    const result = Array.from(mergedMap.values());

    safeLocalStorageSet(LOCAL_STORAGE_STORIES_KEY, result);
    return result;
  }

  /**
   * Create a new story (photo or video) with 24h expiration
   */
  static async createStory(
    userId: string,
    author: Partial<ConnectUsProfile>,
    mediaUrl: string,
    mediaType: "image" | "video",
    caption?: string | null
  ): Promise<ConnectUsStory> {
    const LOCAL_STORAGE_STORIES_KEY = "ecomfy_connectus_stories";
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
    const authorProfile = await this.getProfile(userId);
    const storyId = `story-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const newStory: ConnectUsStory = {
      id: storyId,
      user_id: userId,
      author: authorProfile,
      media_url: mediaUrl,
      media_type: mediaType,
      caption: caption || null,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      views_count: 0,
      viewers: [],
    };

    if (!userId.startsWith("guest_")) {
      try {
        // @ts-ignore
        await supabase.from("connectus_stories").insert([
          {
            id: storyId,
            user_id: userId,
            media_url: mediaUrl,
            media_type: mediaType,
            caption: caption || null,
            expires_at: expiresAt.toISOString(),
            created_at: now.toISOString(),
          },
        ]);
      } catch (e) {
        console.warn("connectus_stories insert fallback:", e);
      }
    }

    const currentStories = await this.getActiveStories();
    currentStories.unshift(newStory);
    safeLocalStorageSet(LOCAL_STORAGE_STORIES_KEY, currentStories);

    return newStory;
  }

  /**
   * View a story & record unique viewer
   */
  static async viewStory(storyId: string, viewerUserId: string, viewerProfile?: ConnectUsProfile | null): Promise<ConnectUsStory | null> {
    const LOCAL_STORAGE_STORIES_KEY = "ecomfy_connectus_stories";
    const stories = await this.getActiveStories();
    const index = stories.findIndex((s) => s.id === storyId);
    if (index === -1) return null;

    const story = stories[index];
    const viewers = story.viewers || [];

    if (!viewers.includes(viewerUserId)) {
      viewers.push(viewerUserId);
      story.views_count = viewers.length;
      story.viewers = viewers;

      if (!viewerUserId.startsWith("guest_")) {
        try {
          // @ts-ignore
          await supabase.from("connectus_stories").update({ views_count: viewers.length, viewers }).eq("id", storyId);
        } catch (e) {}
      }

      stories[index] = story;
      safeLocalStorageSet(LOCAL_STORAGE_STORIES_KEY, stories);

      if (story.user_id && story.user_id !== viewerUserId) {
        await this.sendNotification(
          story.user_id,
          viewerUserId,
          "like",
          `a vu votre Story 👁️`,
          { message: "Story vue" }
        );
      }
    }
    return story;
  }

  /**
   * Toggle Like on a Story
   */
  static async toggleStoryLike(storyId: string, userId: string): Promise<{ likes_count: number; user_liked: boolean }> {
    const stories = await this.getActiveStories();
    const index = stories.findIndex((s) => s.id === storyId);

    const likeKey = `ecomfy_story_like_${storyId}_${userId}`;
    const currentlyLiked = localStorage.getItem(likeKey) === "true";
    const newLiked = !currentlyLiked;

    localStorage.setItem(likeKey, newLiked ? "true" : "false");

    if (index !== -1) {
      const story = stories[index];
      const currentCount = story.likes_count || 0;
      const newCount = Math.max(0, currentCount + (newLiked ? 1 : -1));

      story.likes_count = newCount;
      story.user_liked = newLiked;
      stories[index] = story;
      safeLocalStorageSet("ecomfy_connectus_stories", stories);

      if (!userId.startsWith("guest_")) {
        try {
          // @ts-ignore
          await supabase.from("connectus_stories").update({ likes_count: newCount }).eq("id", storyId);
        } catch (e) {}
      }

      if (newLiked && story.user_id && story.user_id !== userId) {
        await this.sendNotification(
          story.user_id,
          userId,
          "like",
          `a aimé votre Story ❤️`,
          { message: "Story aimée" }
        );
      }

      return { likes_count: newCount, user_liked: newLiked };
    }

    return { likes_count: newLiked ? 1 : 0, user_liked: newLiked };
  }

  /**
   * Reply to a Story via Private Message
   */
  static async replyToStory(
    storyId: string,
    senderUserId: string,
    targetUserId: string,
    replyText: string,
    storyMediaUrl?: string
  ): Promise<ConnectUsPrivateMessage | null> {
    const contextualMessage = `[Réponse à la Story] 🎬 ${replyText.trim()}`;
    const createdMsg = await this.sendPrivateMessage(
      senderUserId,
      targetUserId,
      contextualMessage,
      storyMediaUrl || null
    );

    if (createdMsg && targetUserId && targetUserId !== senderUserId) {
      await this.sendNotification(
        targetUserId,
        senderUserId,
        "private_message",
        `a répondu à votre Story : "${replyText.slice(0, 30)}..." 💬`,
        { message: replyText }
      );
    }

    return createdMsg;
  }
}
