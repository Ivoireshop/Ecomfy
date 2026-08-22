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
        .select("id, business_name, slug")
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
        bio: userShop ? `Fondateur de ${userShop.business_name} sur Ecomfy 🚀` : "Membre passionné de la communauté ConnectUs",
        location: "Côte d'Ivoire",
        website_url: userShop?.slug ? `https://ecomfy.cloud/shop/${userShop.slug}` : null,
        is_verified: true,
        is_business: !!userShop,
        followers_count: 45,
        following_count: 12,
        posts_count: 5,
        shop_id: userShop?.id,
        shop_slug: userShop?.slug,
        shop_name: userShop?.business_name,
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
   * Save persistent profile changes with quota safety and Supabase DB sync
   */
  static async saveProfile(profile: ConnectUsProfile): Promise<boolean> {
    try {
      safeLocalStorageSet(LOCAL_STORAGE_PROFILE_KEY, profile);

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
   * Delete post permanently from Supabase cloud database & local storage
   */
  static async deletePost(postId: string, userId: string): Promise<boolean> {
    try {
      let deletedCount = 0;

      // 1. Delete from Supabase cloud table (community_messages)
      if (userId && !userId.startsWith("guest_")) {
        const { error } = await supabase
          .from("community_messages")
          .delete()
          .eq("user_id", userId)
          .or(`id.eq.${postId}`);

        if (error) {
          console.warn("Could not delete cloud message directly:", error);
        }

        // Search messages containing the post payload ID
        try {
          const { data: userMsgs } = await supabase
            .from("community_messages")
            .select("id, body")
            .eq("user_id", userId);

          if (userMsgs && userMsgs.length > 0) {
            for (const msg of userMsgs) {
              if (msg.body && typeof msg.body === "string" && msg.body.includes(postId)) {
                await supabase.from("community_messages").delete().eq("id", msg.id);
                deletedCount++;
              }
            }
          }
        } catch (e) {}
      }

      // 2. Delete from local storage cache
      const existingJson = localStorage.getItem(LOCAL_STORAGE_POSTS_KEY);
      if (existingJson) {
        let posts: ConnectUsPost[] = JSON.parse(existingJson);
        const filtered = posts.filter(p => p.id !== postId);
        if (filtered.length !== posts.length) {
          safeLocalStorageSet(LOCAL_STORAGE_POSTS_KEY, filtered);
          deletedCount++;
        }
      }

      return true;
    } catch (e) {
      console.error("Error in deletePost:", e);
      return false;
    }
  }

  /**
   * Search registered profiles by name, username, shop name or partial match (Ulrich Djaté, @ulrichdjate, Ulri, djate)
   */
  static async searchProfiles(query: string): Promise<ConnectUsProfile[]> {
    if (!query || query.trim().length === 0) return [];
    const cleanQ = query.trim().replace(/^@/, "").toLowerCase();
    if (!cleanQ) return [];

    const results: ConnectUsProfile[] = [];
    const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const targetNorm = normalize(cleanQ);

    // 1. Query real profiles from Supabase DB
    try {
      const { data: dbProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, updated_at")
        .or(`full_name.ilike.%${cleanQ}%`)
        .limit(20);

      if (dbProfiles && dbProfiles.length > 0) {
        for (const p of dbProfiles) {
          const username = (p.full_name || "user").toLowerCase().replace(/[^a-z0-9]/g, "_");
          results.push({
            id: p.id,
            user_id: p.id,
            username,
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

    // 2. Search Demo & Featured Community Members (including Ulrich Djaté, Désirée Kouadio, Aminata Diallo, Koffi Mensah, etc.)
    const demoUsers: ConnectUsProfile[] = [
      {
        id: "demo-user-ulrich",
        user_id: "demo-user-ulrich",
        username: "ulrichdjate",
        full_name: "Ulrich Djaté",
        avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
        cover_url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&auto=format&fit=crop&q=80",
        bio: "Entrepreneur Ecomfy & Créateur de solutions E-commerce 🚀",
        location: "Abidjan, Côte d'Ivoire",
        website_url: "https://ecomfy.cloud",
        is_verified: true,
        is_business: true,
        followers_count: 3450,
        following_count: 240,
        posts_count: 58,
        shop_name: "Ulrich Tech Studio",
        created_at: new Date().toISOString(),
      },
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
      },
      {
        id: "demo-user-5",
        user_id: "demo-user-5",
        username: "ulrich_epices",
        full_name: "Ulrich Dossou",
        avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80",
        cover_url: null,
        bio: "Épices fines & Saveurs d'Afrique de l'Ouest 🌶️🍲",
        location: "Cotonou, Bénin",
        website_url: null,
        is_verified: true,
        is_business: true,
        followers_count: 1850,
        following_count: 210,
        posts_count: 31,
        shop_name: "Ulrich Épices Bio",
        created_at: new Date().toISOString(),
      }
    ];

    demoUsers.forEach((du) => {
      const matchName = normalize(du.full_name).includes(targetNorm);
      const matchUsername = normalize(du.username).includes(targetNorm);
      const matchShop = normalize(du.shop_name || "").includes(targetNorm);
      const matchBio = normalize(du.bio || "").includes(targetNorm);

      if (matchName || matchUsername || matchShop || matchBio) {
        if (!results.some((r) => r.id === du.id)) {
          results.push(du);
        }
      }
    });

    return results;
  }

  /**
   * Send invitation & auto-follow user
   */
  static sendInvitation(senderUserId: string, targetUserId: string, message: string): boolean {
    this.toggleFollow(senderUserId, targetUserId);
    return true;
  }
}
