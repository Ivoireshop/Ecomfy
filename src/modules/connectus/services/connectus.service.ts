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
   * Persistent Fetch profile
   */
  static async getProfile(userId: string): Promise<ConnectUsProfile> {
    try {
      const savedProfileJson = localStorage.getItem(LOCAL_STORAGE_PROFILE_KEY);
      if (savedProfileJson) {
        try {
          const parsed = JSON.parse(savedProfileJson);
          if (parsed.user_id === userId) {
            return parsed;
          }
        } catch (e) {}
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, updated_at")
        .eq("id", userId)
        .maybeSingle();

      const { data: userShop } = await supabase
        .from("shops")
        .select("id, name, slug")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const username = profile?.full_name 
        ? profile.full_name.toLowerCase().replace(/[^a-z0-9]/g, "_")
        : `user_${userId.slice(0, 8)}`;

      const createdProfile: ConnectUsProfile = {
        id: userId,
        user_id: userId,
        username,
        full_name: profile?.full_name || "Membre Ecomfy",
        avatar_url: profile?.avatar_url || null,
        cover_url: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&auto=format&fit=crop&q=80",
        bio: userShop ? `Fondateur de ${userShop.name} sur Ecomfy 🚀` : "Membre passionné de la communauté ConnectUs",
        location: "Côte d'Ivoire",
        website_url: userShop?.slug ? `https://ecomfy.cloud/shop/${userShop.slug}` : null,
        is_verified: true,
        is_business: !!userShop,
        followers_count: 45,
        following_count: 12,
        posts_count: 5,
        shop_id: userShop?.id,
        shop_slug: userShop?.slug,
        shop_name: userShop?.name,
        created_at: profile?.updated_at || new Date().toISOString(),
      };

      safeLocalStorageSet(LOCAL_STORAGE_PROFILE_KEY, createdProfile);
      return createdProfile;
    } catch (e) {
      return {
        id: userId,
        user_id: userId,
        username: `user_${userId.slice(0, 6)}`,
        full_name: "Membre Ecomfy",
        avatar_url: null,
        cover_url: null,
        bio: "Bio ConnectUs",
        location: null,
        website_url: null,
        is_verified: false,
        is_business: false,
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
        created_at: new Date().toISOString(),
      };
    }
  }

  /**
   * Save persistent profile changes with quota safety
   */
  static saveProfile(profile: ConnectUsProfile) {
    try {
      safeLocalStorageSet(LOCAL_STORAGE_PROFILE_KEY, profile);
      if (profile.user_id && profile.avatar_url) {
        supabase.from("profiles").update({
          full_name: profile.full_name,
          avatar_url: profile.avatar_url
        }).eq("id", profile.user_id).then(() => {});
      }
    } catch (e) {}
  }

  /**
   * Fetch Feed Posts from Supabase cloud & local storage (Real user posts displayed first!)
   */
  static async getFeedPosts(currentUserId: string): Promise<ConnectUsPost[]> {
    let cloudPosts: ConnectUsPost[] = [];

    // 1. Query real posts from Supabase database so all members see each other's posts
    try {
      const { data: dbMessages } = await supabase
        .from("community_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (dbMessages && dbMessages.length > 0) {
        cloudPosts = dbMessages
          .map((msg: any) => {
            try {
              const parsed = JSON.parse(msg.body);
              if (parsed && parsed.connectus_type === "post") {
                return {
                  id: parsed.id || msg.id,
                  user_id: msg.user_id,
                  author: parsed.author,
                  content: parsed.content || "",
                  media_urls: parsed.media_urls || [],
                  video_url: parsed.video_url || null,
                  link_preview: parsed.link_preview || null,
                  attached_product: parsed.attached_product || null,
                  visibility: parsed.visibility || "public",
                  likes_count: parsed.likes_count || 0,
                  comments_count: parsed.comments_count || 0,
                  shares_count: parsed.shares_count || 0,
                  user_reaction: null,
                  created_at: parsed.created_at || msg.created_at,
                } as ConnectUsPost;
              }
            } catch (e) {
              return null;
            }
            return null;
          })
          .filter((p): p is ConnectUsPost => p !== null);
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

    // 4. REAL USER POSTS DISPLAYED AT THE VERY TOP FIRST!
    const finalFeed = [...realPosts];
    INITIAL_DEMO_POSTS.forEach((demo) => {
      if (!realPostsMap.has(demo.id)) {
        finalFeed.push(demo);
      }
    });

    return finalFeed;
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
   * Delete post (within 24 hours of creation)
   */
  static deletePost(postId: string, userId: string): boolean {
    try {
      const existingJson = localStorage.getItem(LOCAL_STORAGE_POSTS_KEY);
      if (!existingJson) return false;

      let posts: ConnectUsPost[] = JSON.parse(existingJson);
      const targetIndex = posts.findIndex(p => p.id === postId);

      if (targetIndex !== -1) {
        const post = posts[targetIndex];
        const ageInMs = Date.now() - new Date(post.created_at).getTime();
        const max24hMs = 24 * 60 * 60 * 1000;

        if (ageInMs <= max24hMs) {
          posts.splice(targetIndex, 1);
          safeLocalStorageSet(LOCAL_STORAGE_POSTS_KEY, posts);
          return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /**
   * Toggle reaction on a post
   */
  static async toggleReaction(
    postId: string,
    userId: string,
    reactionType: ReactionType = "like"
  ): Promise<{ likesCount: number; userReaction: ReactionType | null }> {
    const localStoredJson = localStorage.getItem(LOCAL_STORAGE_POSTS_KEY);
    let localPosts: ConnectUsPost[] = [];
    if (localStoredJson) {
      try {
        localPosts = JSON.parse(localStoredJson);
      } catch (e) {
        localPosts = [];
      }
    }

    const postIndex = localPosts.findIndex(p => p.id === postId);
    if (postIndex !== -1) {
      const post = localPosts[postIndex];
      const isAlreadyReacted = post.user_reaction === reactionType;
      
      post.user_reaction = isAlreadyReacted ? null : reactionType;
      post.likes_count = Math.max(0, post.likes_count + (isAlreadyReacted ? -1 : 1));

      safeLocalStorageSet(LOCAL_STORAGE_POSTS_KEY, localPosts);
      return { likesCount: post.likes_count, userReaction: post.user_reaction };
    }

    const demoPost = INITIAL_DEMO_POSTS.find(p => p.id === postId);
    if (demoPost) {
      const isAlreadyReacted = demoPost.user_reaction === reactionType;
      demoPost.user_reaction = isAlreadyReacted ? null : reactionType;
      demoPost.likes_count = Math.max(0, demoPost.likes_count + (isAlreadyReacted ? -1 : 1));
      return { likesCount: demoPost.likes_count, userReaction: demoPost.user_reaction };
    }

    return { likesCount: 1, userReaction: reactionType };
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
}
