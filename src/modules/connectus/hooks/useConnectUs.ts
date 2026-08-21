import { useState, useEffect, useCallback } from "react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { ConnectUsService } from "../services/connectus.service";
import {
  ConnectUsProfile,
  ConnectUsPost,
  AttachedProduct,
  VisibilityType,
  ReactionType
} from "../types/connectus.types";
import { LinkMetadata } from "../utils/linkScraper";
import { toast } from "@/hooks/use-toast";

export function useConnectUs() {
  const { session, user, isReady } = useAuthReady();
  const userId = session?.user?.id || user?.id || "";

  const [profile, setProfile] = useState<ConnectUsProfile | null>(null);
  const [posts, setPosts] = useState<ConnectUsPost[]>([]);
  const [merchantProducts, setMerchantProducts] = useState<AttachedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // 1. Initial Load & Ecomfy Account Auto-Binding
  const loadConnectUsData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [userProfile, feedPosts, products] = await Promise.all([
        ConnectUsService.getProfile(userId),
        ConnectUsService.getFeedPosts(userId),
        ConnectUsService.getMerchantProducts(userId),
      ]);

      setProfile(userProfile);
      setPosts(feedPosts);
      setMerchantProducts(products);

      if (!userProfile.is_onboarded) {
        setShowOnboarding(true);
      }
    } catch (e) {
      console.error("Failed to load ConnectUs data:", e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isReady && userId) {
      loadConnectUsData();
    }
  }, [isReady, userId, loadConnectUsData]);

  // 2. Persistent Profile Update Handler
  const handleUpdateProfile = (updatedData: Partial<ConnectUsProfile>) => {
    setProfile(prev => {
      if (!prev) return null;
      const merged = { ...prev, ...updatedData };
      ConnectUsService.saveProfile(merged);
      return merged;
    });
  };

  // 3. Create Post Handler
  const handleCreatePost = async (postData: {
    content: string;
    media_urls: string[];
    video_url?: string | null;
    link_preview?: LinkMetadata | null;
    attached_product?: AttachedProduct | null;
    visibility: VisibilityType;
  }) => {
    if (!userId) {
      toast({ title: "Connectez-vous d'abord à Ecomfy", variant: "destructive" });
      return null;
    }

    setSubmitting(true);
    try {
      const created = await ConnectUsService.createPost(userId, postData);
      setPosts(prev => [created, ...prev]);
      toast({
        title: "Publication publiée sur ConnectUs ! 🚀",
        description: "Votre contenu a été diffusé à la communauté.",
      });
      return created;
    } catch (e: any) {
      toast({
        title: "Erreur lors de la publication",
        description: e?.message || "Impossible de publier.",
        variant: "destructive",
      });
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Delete Post (Available within 24h of creation)
  const handleDeletePost = (postId: string) => {
    if (!userId) return false;
    const postToDelete = posts.find(p => p.id === postId);
    if (!postToDelete) return false;

    const ageInHours = (Date.now() - new Date(postToDelete.created_at).getTime()) / (1000 * 3600);
    if (ageInHours > 24) {
      toast({
        title: "Suppression non disponible",
        description: "Le délai autorisé de 24h après publication est dépassé.",
        variant: "destructive",
      });
      return false;
    }

    const success = ConnectUsService.deletePost(postId, userId);
    if (success) {
      setPosts(prev => prev.filter(p => p.id !== postId));
      toast({ title: "Publication supprimée avec succès ✓" });
      return true;
    } else {
      toast({ title: "Impossible de supprimer cette publication", variant: "destructive" });
      return false;
    }
  };

  // 5. Toggle Reaction
  const handleToggleReaction = async (postId: string, reactionType: ReactionType = "like") => {
    if (!userId) return;
    
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const isAlready = p.user_reaction === reactionType;
        return {
          ...p,
          user_reaction: isAlready ? null : reactionType,
          likes_count: Math.max(0, p.likes_count + (isAlready ? -1 : 1))
        };
      }
      return p;
    }));

    await ConnectUsService.toggleReaction(postId, userId, reactionType);
  };

  // 6. Toggle Follow
  const handleToggleFollow = (targetUserId: string) => {
    if (!userId) return false;
    const nowFollowing = ConnectUsService.toggleFollow(userId, targetUserId);
    
    toast({
      title: nowFollowing ? "Abonnement réussi ✓" : "Abonnement retiré",
      description: nowFollowing ? "Vous suivrez les actualités de ce membre." : undefined
    });

    return nowFollowing;
  };

  return {
    userId,
    profile,
    posts,
    merchantProducts,
    loading,
    submitting,
    showOnboarding,
    setShowOnboarding,
    updateProfile: handleUpdateProfile,
    createPost: handleCreatePost,
    deletePost: handleDeletePost,
    toggleReaction: handleToggleReaction,
    toggleFollow: handleToggleFollow,
    refresh: loadConnectUsData,
  };
}
