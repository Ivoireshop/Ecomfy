import { supabase } from "@/integrations/supabase/client";
import {
  ConnectUsProfile,
  ConnectUsPost,
  ConnectUsComment,
  ConnectUsNotification,
  ReactionType,
  AttachedProduct,
  VisibilityType
} from "../types/connectus.types";
import { safeLocalStorageSet } from "../utils/fileUploader";

const LOCAL_STORAGE_POSTS_KEY = "ecomfy_connectus_local_posts";
const LOCAL_STORAGE_FOLLOWS_KEY = "ecomfy_connectus_local_follows";
const LOCAL_STORAGE_PROFILE_KEY = "ecomfy_connectus_profile";

const INITIAL_DEMO_POSTS: ConnectUsPost[] = [
  {
    id: "demo-post-1",
    user_id: "demo-user-1",
    author: {
      id: "demo-user-1",
      user_id: "demo-user-1",
      username: "koffi_fashion",
      full_name: "Koffi Mensah",
      avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
      cover_url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&auto=format&fit=crop&q=80",
      bio: "Créateur de mode africaine moderne & E-commerçant Ecomfy 👗⚡",
      location: "Abidjan, Côte d'Ivoire",
      website_url: "https://ecomfy.cloud/shop/koffi-fashion",
      is_verified: true,
      is_business: true,
      followers_count: 1420,
      following_count: 180,
      posts_count: 42,
      shop_name: "Koffi Fashion Studio",
      created_at: new Date().toISOString(),
    },
    content: "Nouvelle collection d'ensembles en tissu Bazin de luxe disponible sur la boutique ! Livraison express à Abidjan et expédition sous 48h dans toute la sous-région 🚀🌍",
    media_urls: [
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80"
    ],
    attached_product: {
      id: "prod-demo-1",
      name: "Ensemble Bazin Riche Brodé VIP",
      price: 45000,
      compare_at_price: 55000,
      image_url: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80",
      category: "Mode & Vétements",
      shop_slug: "koffi-fashion"
    },
    visibility: "public",
    likes_count: 128,
    comments_count: 24,
    shares_count: 18,
    user_reaction: "love",
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "demo-post-2",
    user_id: "demo-user-2",
    author: {
      id: "demo-user-2",
      user_id: "demo-user-2",
      username: "aminata_beauty",
      full_name: "Aminata Diallo",
      avatar_url: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&auto=format&fit=crop&q=80",
      cover_url: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&auto=format&fit=crop&q=80",
      bio: "Cosmétiques 100% naturels & Beauté africaine ✨ Produits certifiés bio",
      location: "Dakar, Sénégal",
      website_url: "https://ecomfy.cloud/shop/aminata-beauty",
      is_verified: true,
      is_business: true,
      followers_count: 2890,
      following_count: 310,
      posts_count: 85,
      shop_name: "Aminata Bio Care",
      created_at: new Date().toISOString(),
    },
    content: "Retrouvez de l'éclat avec nos beurre de Karité brut pressé à froid et l'huile de Baobab bio 🌿 Testé & approuvé par plus de 500 clientes satisfaites ce mois-ci !",
    media_urls: [
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&auto=format&fit=crop&q=80"
    ],
    attached_product: {
      id: "prod-demo-2",
      name: "Coffret Sérum Éclat Karité & Baobab",
      price: 18500,
      compare_at_price: 24000,
      image_url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80",
      category: "Beauté & Soins",
      shop_slug: "aminata-beauty"
    },
    visibility: "public",
    likes_count: 215,
    comments_count: 42,
    shares_count: 35,
    user_reaction: "like",
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  }
];

export class ConnectUsService {
  /**
   * Fetch all feed posts (Cloud DB + Local cache + Demo posts + Aggregated Likes & Comments)
   */
  static async getFeedPosts(userId?: string): Promise<ConnectUsPost[]> {
    let cloudPosts: ConnectUsPost[] = [];
    const cloudReactionsMap = new Map<string, Map<string, ReactionType>>();
    const cloudCommentsMap = new Map<string, any[]>();

    // 1. Fetch posts, reactions, and comments from Supabase cloud community_messages table
    try {
      const { data: dbMessages } = await supabase
        .from("community_messages")
        .select("id, user_id, body, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (dbMessages && dbMessages.length > 0) {
        dbMessages.forEach((msg: any) => {
          try {
            if (!msg || !msg.body) return;
            let parsed: any = typeof msg.body === "string" ? JSON.parse(msg.body) : msg.body;

            // Extract Reactions (Likes)
            if (parsed.connectus_type === "reaction" && parsed.post_id) {
              if (!cloudReactionsMap.has(parsed.post_id)) {
                cloudReactionsMap.set(parsed.post_id, new Map());
              }
              if (parsed.reaction) {
                cloudReactionsMap.get(parsed.post_id)!.set(msg.user_id || parsed.user_id, parsed.reaction);
              } else {
                cloudReactionsMap.get(parsed.post_id)!.delete(msg.user_id || parsed.user_id);
              }
            }

            // Extract Comments
            if (parsed.connectus_type === "comment" && parsed.post_id) {
              if (!cloudCommentsMap.has(parsed.post_id)) {
                cloudCommentsMap.set(parsed.post_id, []);
              }
              cloudCommentsMap.get(parsed.post_id)!.push({
                id: msg.id || `c-${Math.random()}`,
                authorName: parsed.author?.full_name || "Membre",
                text: parsed.text || parsed.content || "",
                date: parsed.created_at || msg.created_at || new Date().toISOString(),
              });
            }

            // Extract Posts
            if (parsed.connectus_type === "post" || (parsed.content && !parsed.connectus_type)) {
              const rawDate = parsed.created_at || msg.created_at;
              const validDate = rawDate && !isNaN(new Date(rawDate).getTime())
                ? new Date(rawDate).toISOString()
                : new Date().toISOString();

              const fallbackAuthor: ConnectUsProfile = {
                id: msg.user_id || "user-anon",
                user_id: msg.user_id || "user-anon",
                username: parsed.author?.username || `user_${(msg.user_id || "").slice(0, 6)}`,
                full_name: parsed.author?.full_name || "Membre Ecomfy",
                avatar_url: parsed.author?.avatar_url || null,
                cover_url: parsed.author?.cover_url || null,
                bio: parsed.author?.bio || "Membre de la communauté ConnectUs",
                location: parsed.author?.location || null,
                website_url: parsed.author?.website_url || null,
                is_verified: true,
                is_business: !!parsed.author?.is_business,
                followers_count: parsed.author?.followers_count || 10,
                following_count: parsed.author?.following_count || 5,
                posts_count: parsed.author?.posts_count || 1,
                created_at: validDate,
              };

              cloudPosts.push({
                id: parsed.id || msg.id || `post-${Math.random()}`,
                user_id: msg.user_id || fallbackAuthor.id,
                author: parsed.author && parsed.author.id ? { ...fallbackAuthor, ...parsed.author } : fallbackAuthor,
                content: parsed.content || "",
                media_urls: Array.isArray(parsed.media_urls) ? parsed.media_urls : [],
                video_url: parsed.video_url || null,
                link_preview: parsed.link_preview || null,
                attached_product: parsed.attached_product || null,
                visibility: parsed.visibility || "public",
                likes_count: Number(parsed.likes_count) || 0,
                comments_count: Number(parsed.comments_count) || 0,
                shares_count: Number(parsed.shares_count) || 0,
                user_reaction: null,
                created_at: validDate,
              } as ConnectUsPost);
            }
          } catch (e) {}
        });
      }
    } catch (e) {
      console.warn("Could not load cloud community posts:", e);
    }

    // 2. Load local posts
    let localPosts: ConnectUsPost[] = [];
    try {
      const localStoredJson = localStorage.getItem(LOCAL_STORAGE_POSTS_KEY);
      if (localStoredJson) {
        localPosts = JSON.parse(localStoredJson);
      }
    } catch (e) {}

    // 3. Merge real user posts (cloud + local) removing duplicates
    const realPostsMap = new Map<string, ConnectUsPost>();
    [...localPosts, ...cloudPosts].forEach((p) => realPostsMap.set(p.id, p));

    const realPosts = Array.from(realPostsMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // 4. Combine real user posts with demo posts
    const finalFeed = [...realPosts];
    INITIAL_DEMO_POSTS.forEach((demo) => {
      if (!realPostsMap.has(demo.id)) {
        finalFeed.push(demo);
      }
    });

    // 5. Aggregate Cloud Reactions & Cloud Comments on EVERY Post
    finalFeed.forEach((post) => {
      const postReactions = cloudReactionsMap.get(post.id);
      if (postReactions) {
        post.likes_count = (post.likes_count || 0) + postReactions.size;
        if (userId && postReactions.has(userId)) {
          post.user_reaction = postReactions.get(userId) || "like";
        }
      }

      const postComments = cloudCommentsMap.get(post.id);
      if (postComments && postComments.length > 0) {
        post.comments_count = (post.comments_count || 0) + postComments.length;
        post.comments = [...(post.comments || []), ...postComments];
      }
    });

    return finalFeed;
  }

  /**
   * Persistent Fetch profile with user-scoped storage & Supabase DB sync
   */
  static async getProfile(userId: string): Promise<ConnectUsProfile> {
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
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, updated_at")
        .eq("id", userId)
        .maybeSingle();

      const { data: userShop } = await supabase
        .from("shops")
        .select("id, business_name, slug")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const defaultFullName = savedProfile?.full_name || profile?.full_name || "Membre Ecomfy";
      const savedCustomUsername = localStorage.getItem(`ecomfy_connectus_custom_username_${userId}`);
      const username = savedCustomUsername || savedProfile?.username || (
        (profile?.full_name || defaultFullName)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_")
      );

      const createdProfile: ConnectUsProfile = {
        id: userId,
        user_id: userId,
        username,
        full_name: defaultFullName,
        avatar_url: savedProfile?.avatar_url || profile?.avatar_url || null,
        cover_url: savedProfile?.cover_url || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&auto=format&fit=crop&q=80",
        bio: savedProfile?.bio || (userShop ? `Fondateur de ${userShop.business_name} sur Ecomfy 🚀` : "Membre passionné de la communauté ConnectUs"),
        location: savedProfile?.location || "Côte d'Ivoire",
        website_url: savedProfile?.website_url || null,
        is_verified: true,
        is_business: !!userShop || !!savedProfile?.is_business,
        followers_count: savedProfile?.followers_count || 45,
        following_count: savedProfile?.following_count || 12,
        posts_count: savedProfile?.posts_count || 5,
        shop_id: userShop?.id || savedProfile?.shop_id,
        shop_slug: userShop?.slug || savedProfile?.shop_slug,
        shop_name: userShop?.business_name || savedProfile?.shop_name,
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
   * Save persistent profile changes with quota safety and Supabase DB sync
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
      if (profile.id && profile.id !== profile.user_id) {
        safeLocalStorageSet(`${LOCAL_STORAGE_PROFILE_KEY}_${profile.id}`, profile);
        if (profile.username) {
          try {
            localStorage.setItem(`ecomfy_connectus_custom_username_${profile.id}`, profile.username);
          } catch (e) {}
        }
      }

      if (profile.user_id && !profile.user_id.startsWith("guest_")) {
        const { error } = await supabase.from("profiles").update({
          full_name: profile.full_name,
          avatar_url: profile.avatar_url || null,
          updated_at: new Date().toISOString(),
        }).eq("id", profile.user_id);

        if (error) {
          console.warn("Supabase profile sync warning:", error);
        }
      }
      return true;
    } catch (e) {
      console.error("Failed to save profile:", e);
      return false;
    }
  }

  /**
   * Create a new post in ConnectUs with Cloud database sync & Quota protection
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
    const authorProfile = await this.getProfile(userId);

    const newPost: ConnectUsPost = {
      id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      user_id: userId,
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

    // Save locally
    const existingJson = localStorage.getItem(LOCAL_STORAGE_POSTS_KEY);
    let existingPosts: ConnectUsPost[] = [];
    if (existingJson) {
      try {
        existingPosts = JSON.parse(existingJson);
      } catch (e) {
        existingPosts = [];
      }
    }

    existingPosts.unshift(newPost);
    safeLocalStorageSet(LOCAL_STORAGE_POSTS_KEY, existingPosts);

    // Sync globally to Supabase cloud so all real users see this post immediately!
    try {
      const postPayload = JSON.stringify({
        connectus_type: "post",
        id: newPost.id,
        author: newPost.author,
        content: newPost.content,
        media_urls: newPost.media_urls,
        video_url: newPost.video_url,
        link_preview: newPost.link_preview,
        attached_product: newPost.attached_product,
        visibility: newPost.visibility,
        created_at: newPost.created_at,
      });

      await supabase.from("community_messages").insert([
        {
          user_id: userId,
          body: postPayload,
        },
      ]);
    } catch (e) {
      console.warn("Post created locally, cloud sync pending:", e);
    }

    return newPost;
  }

  /**
   * Delete post permanently from Supabase cloud database & local storage
   */
  static async deletePost(postId: string, userId: string): Promise<boolean> {
    try {
      if (userId && !userId.startsWith("guest_")) {
        try {
          await supabase
            .from("community_messages")
            .delete()
            .eq("user_id", userId)
            .eq("id", postId);
        } catch (e) {}

        try {
          const { data: userMsgs } = await supabase
            .from("community_messages")
            .select("id, body")
            .eq("user_id", userId);

          if (userMsgs && userMsgs.length > 0) {
            for (const msg of userMsgs) {
              if (msg.body && typeof msg.body === "string" && msg.body.includes(postId)) {
                await supabase.from("community_messages").delete().eq("id", msg.id);
              }
            }
          }
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

    const localStoredJson = localStorage.getItem(LOCAL_STORAGE_POSTS_KEY);
    let localPosts: ConnectUsPost[] = localStoredJson ? JSON.parse(localStoredJson) : [];
    const postIndex = localPosts.findIndex(p => p.id === postId);

    if (postIndex !== -1) {
      const post = localPosts[postIndex];
      const isAlreadyReacted = post.user_reaction === reactionType;
      
      post.user_reaction = isAlreadyReacted ? null : reactionType;
      post.likes_count = Math.max(0, post.likes_count + (isAlreadyReacted ? -1 : 1));

      safeLocalStorageSet(LOCAL_STORAGE_POSTS_KEY, localPosts);
      userReaction = post.user_reaction;
      likesCount = post.likes_count;
    } else {
      const demoPost = INITIAL_DEMO_POSTS.find(p => p.id === postId);
      if (demoPost) {
        const isAlreadyReacted = demoPost.user_reaction === reactionType;
        demoPost.user_reaction = isAlreadyReacted ? null : reactionType;
        demoPost.likes_count = Math.max(0, demoPost.likes_count + (isAlreadyReacted ? -1 : 1));
        userReaction = demoPost.user_reaction;
        likesCount = demoPost.likes_count;
      }
    }

    // Sync reaction to Supabase Cloud DB
    if (userId && !userId.startsWith("guest_")) {
      try {
        const payload = JSON.stringify({
          connectus_type: "reaction",
          post_id: postId,
          user_id: userId,
          reaction: userReaction,
          created_at: new Date().toISOString(),
        });
        await supabase.from("community_messages").insert([
          {
            user_id: userId,
            body: payload,
          },
        ]);
      } catch (e) {
        console.warn("Reaction cloud sync warning:", e);
      }
    }

    // Trigger real-time notification to post author if reacted
    if (userReaction === reactionType && postIndex !== -1) {
      const targetPost = localPosts[postIndex];
      if (targetPost && targetPost.user_id && targetPost.user_id !== userId) {
        this.sendNotification(
          targetPost.user_id,
          userId,
          "like",
          `a aimé votre publication : "${targetPost.content ? targetPost.content.slice(0, 35) + '...' : 'Media'}"`,
          { postId, postSummary: targetPost.content }
        );
      }
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
    const commentObj = {
      id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      authorName: author.full_name || "Membre",
      text: text.trim(),
      date: new Date().toISOString(),
    };

    if (userId && !userId.startsWith("guest_")) {
      try {
        const payload = JSON.stringify({
          connectus_type: "comment",
          post_id: postId,
          user_id: userId,
          author: {
            full_name: author.full_name,
            avatar_url: author.avatar_url,
            username: author.username,
          },
          text: commentObj.text,
          created_at: commentObj.date,
        });
        await supabase.from("community_messages").insert([
          {
            user_id: userId,
            body: payload,
          },
        ]);
      } catch (e) {
        console.warn("Comment cloud sync warning:", e);
      }
    }

    // Trigger real-time notification to post author
    const localPostsJson = localStorage.getItem(LOCAL_STORAGE_POSTS_KEY);
    if (localPostsJson) {
      try {
        const postsList: ConnectUsPost[] = JSON.parse(localPostsJson);
        const targetPost = postsList.find(p => p.id === postId);
        if (targetPost && targetPost.user_id && targetPost.user_id !== userId) {
          this.sendNotification(
            targetPost.user_id,
            userId,
            "comment",
            `a commenté votre publication : "${text.slice(0, 40)}${text.length > 40 ? '...' : ''}"`,
            { postId, postSummary: targetPost.content }
          );
        }
      } catch (e) {}
    }

    return commentObj;
  }

  /**
   * Send real-time notification to a target user
   */
  static async sendNotification(
    recipientUserId: string,
    actorUserId: string,
    type: "follow" | "like" | "comment" | "invite_request" | "invite_accepted",
    text: string,
    options?: { postId?: string; postSummary?: string; message?: string }
  ): Promise<boolean> {
    if (!recipientUserId || recipientUserId === actorUserId) return false;

    try {
      const actorProfile = await this.getProfile(actorUserId);
      const newNotif: ConnectUsNotification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

      const storageKey = `ecomfy_connectus_notifs_${recipientUserId}`;
      const existingJson = localStorage.getItem(storageKey);
      let notifs: ConnectUsNotification[] = existingJson ? JSON.parse(existingJson) : [];
      notifs.unshift(newNotif);
      safeLocalStorageSet(storageKey, notifs);

      if (!actorUserId.startsWith("guest_")) {
        try {
          const payload = JSON.stringify({
            connectus_type: "notification",
            recipient_id: recipientUserId,
            notif: newNotif,
          });
          await supabase.from("community_messages").insert([
            {
              user_id: actorUserId,
              body: payload,
            },
          ]);
        } catch (e) {
          console.warn("Notification cloud sync warning:", e);
        }
      }

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

    const storageKey = `ecomfy_connectus_notifs_${userId}`;
    const localJson = localStorage.getItem(storageKey);
    let localNotifs: ConnectUsNotification[] = localJson ? JSON.parse(localJson) : [];

    try {
      const { data: cloudMsgs } = await supabase
        .from("community_messages")
        .select("id, body")
        .limit(50);

      if (cloudMsgs && cloudMsgs.length > 0) {
        for (const msg of cloudMsgs) {
          if (msg.body && typeof msg.body === "string" && msg.body.includes("connectus_type\":\"notification")) {
            try {
              const parsed = JSON.parse(msg.body);
              if (parsed?.recipient_id === userId && parsed?.notif) {
                if (!localNotifs.some(n => n.id === parsed.notif.id)) {
                  localNotifs.unshift(parsed.notif);
                }
              }
            } catch (e) {}
          }
        }
      }
    } catch (e) {}

    localNotifs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    safeLocalStorageSet(storageKey, localNotifs);

    return localNotifs;
  }

  /**
   * Accept follow invitation & send Return Notification ("Ulrich Djaté a accepté votre invitation...")
   */
  static async acceptFollowInvitation(userId: string, notifId: string, actorUserId: string): Promise<boolean> {
    try {
      this.toggleFollow(userId, actorUserId);
      this.toggleFollow(actorUserId, userId);

      const storageKey = `ecomfy_connectus_notifs_${userId}`;
      const localJson = localStorage.getItem(storageKey);
      if (localJson) {
        let notifs: ConnectUsNotification[] = JSON.parse(localJson);
        notifs = notifs.map(n => n.id === notifId ? { ...n, status: "accepted", read: true } : n);
        safeLocalStorageSet(storageKey, notifs);
      }

      const userProfile = await this.getProfile(userId);
      await this.sendNotification(
        actorUserId,
        userId,
        "invite_accepted",
        `${userProfile.full_name} a accepté votre invitation et vous suit à présent ! Suivez-le en retour.`
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
  static toggleFollow(followerId: string, targetUserId: string): boolean {
    try {
      const followsJson = localStorage.getItem(LOCAL_STORAGE_FOLLOWS_KEY);
      let follows: string[] = followsJson ? JSON.parse(followsJson) : [];

      const index = follows.indexOf(targetUserId);
      let nowFollowing = false;
      if (index >= 0) {
        follows.splice(index, 1);
        nowFollowing = false;
      } else {
        follows.push(targetUserId);
        nowFollowing = true;
      }

      safeLocalStorageSet(LOCAL_STORAGE_FOLLOWS_KEY, follows);
      return nowFollowing;
    } catch (e) {
      return false;
    }
  }

  /**
   * Search registered profiles by name, username, shop name or partial match
   */
  /**
   * Search registered profiles by name, username, shop name or partial match
   * Prioritizes REAL created accounts from Supabase DB & LocalStorage.
   */
  static async searchProfiles(query: string): Promise<ConnectUsProfile[]> {
    if (!query || query.trim().length === 0) return [];
    const cleanQ = query.trim().replace(/^@/, "").toLowerCase();
    if (!cleanQ) return [];

    const realResults: ConnectUsProfile[] = [];
    const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const targetNorm = normalize(cleanQ);

    // 1. Search Real Profiles in Supabase Database
    try {
      const { data: dbProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, updated_at")
        .or(`full_name.ilike.%${cleanQ}%`)
        .limit(20);

      if (dbProfiles && dbProfiles.length > 0) {
        for (const p of dbProfiles) {
          const username = (p.full_name || "user").toLowerCase().replace(/[^a-z0-9]/g, "_");
          const customUsername = localStorage.getItem(`ecomfy_connectus_custom_username_${p.id}`);
          
          realResults.push({
            id: p.id,
            user_id: p.id,
            username: customUsername || username,
            full_name: p.full_name || "Membre ConnectUs",
            avatar_url: p.avatar_url || null,
            cover_url: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&auto=format&fit=crop&q=80",
            bio: `Membre de la communauté ConnectUs`,
            location: "Côte d'Ivoire",
            website_url: null,
            is_verified: true,
            is_business: false,
            followers_count: 120,
            following_count: 45,
            posts_count: 8,
            created_at: p.updated_at || new Date().toISOString(),
          });
        }
      }
    } catch (e) {}

    // 2. Search Real Profiles saved in LocalStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith(LOCAL_STORAGE_PROFILE_KEY) || key.startsWith("ecomfy_connectus_profile"))) {
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed: ConnectUsProfile = JSON.parse(raw);
              if (parsed && parsed.full_name) {
                const normName = normalize(parsed.full_name);
                const normUser = normalize(parsed.username || "");
                if (normName.includes(targetNorm) || normUser.includes(targetNorm)) {
                  if (!realResults.some(r => r.id === parsed.id || r.user_id === parsed.user_id)) {
                    realResults.push(parsed);
                  }
                }
              }
            }
          } catch (e) {}
        }
      }
    } catch (e) {}

    // If REAL profiles matching the search query are found, return ONLY the real accounts!
    if (realResults.length > 0) {
      return realResults;
    }

    // 3. Fallback Demo Users (Only shown if NO real matching profiles exist for demo keywords)
    const demoUsers: ConnectUsProfile[] = [
      {
        id: "demo-user-1",
        user_id: "demo-user-1",
        username: "koffi_fashion",
        full_name: "Koffi Mensah",
        avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
        cover_url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&auto=format&fit=crop&q=80",
        bio: "Créateur de mode africaine moderne & E-commerçant Ecomfy 👗⚡",
        location: "Abidjan, Côte d'Ivoire",
        website_url: "https://ecomfy.cloud/shop/koffi-fashion",
        is_verified: true,
        is_business: true,
        followers_count: 1420,
        following_count: 180,
        posts_count: 42,
        shop_name: "Koffi Fashion Studio",
        created_at: new Date().toISOString(),
      },
      {
        id: "demo-user-2",
        user_id: "demo-user-2",
        username: "aminata_beauty",
        full_name: "Aminata Diallo",
        avatar_url: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&auto=format&fit=crop&q=80",
        cover_url: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&auto=format&fit=crop&q=80",
        bio: "Cosmétiques 100% naturels & Beauté africaine ✨ Produits certifiés bio",
        location: "Dakar, Sénégal",
        website_url: "https://ecomfy.cloud/shop/aminata-beauty",
        is_verified: true,
        is_business: true,
        followers_count: 2890,
        following_count: 310,
        posts_count: 85,
        shop_name: "Aminata Bio Care",
        created_at: new Date().toISOString(),
      },
      {
        id: "demo-user-3",
        user_id: "demo-user-3",
        username: "ousmane_tech",
        full_name: "Ousmane Traoré",
        avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
        cover_url: null,
        bio: "Gadgets high-tech & Accessoires smartphones 📱⚡",
        location: "Bamako, Mali",
        website_url: null,
        is_verified: true,
        is_business: true,
        followers_count: 980,
        following_count: 150,
        posts_count: 19,
        shop_name: "Ousmane Tech Store",
        created_at: new Date().toISOString(),
      },
      {
        id: "demo-user-4",
        user_id: "demo-user-4",
        username: "desiree_decor",
        full_name: "Désirée Kouadio",
        avatar_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80",
        cover_url: null,
        bio: "Décoration d'intérieur & Artisanat fait main 🏺✨",
        location: "Abidjan, Côte d'Ivoire",
        website_url: null,
        is_verified: true,
        is_business: true,
        followers_count: 3200,
        following_count: 420,
        posts_count: 64,
        shop_name: "Désirée Déco & Home",
        created_at: new Date().toISOString(),
      }
    ];

    const demoResults: ConnectUsProfile[] = [];
    demoUsers.forEach((du) => {
      const matchName = normalize(du.full_name).includes(targetNorm);
      const matchUsername = normalize(du.username).includes(targetNorm);
      const matchShop = normalize(du.shop_name || "").includes(targetNorm);

      if (matchName || matchUsername || matchShop) {
        demoResults.push(du);
      }
    });

    return demoResults;
  }

  /**
   * Send invitation & auto-follow user & trigger notification
   */
  static sendInvitation(senderUserId: string, targetUserId: string, message: string): boolean {
    this.toggleFollow(senderUserId, targetUserId);
    this.sendNotification(
      targetUserId,
      senderUserId,
      "invite_request",
      message || "vous invite à vous abonner et le suivre sur ConnectUs !",
      { message }
    );
    return true;
  }
}
