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
    setLoading(true);
    try {
      const activeId = userId || "guest_visitor";
      const [userProfile, feedPosts, products] = await Promise.all([
        ConnectUsService.getProfile(activeId),
        ConnectUsService.getFeedPosts(activeId),
        ConnectUsService.getMerchantProducts(activeId),
      ]);

      setProfile(userProfile);
      setPosts(feedPosts || []);
      setMerchantProducts(products || []);

      if (userProfile && !userProfile.is_onboarded && userId) {
        setShowOnboarding(true);
      }
    } catch (e) {
      console.error("Failed to load ConnectUs data:", e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isReady) {
      loadConnectUsData();
    }
  }, [isReady, loadConnectUsData]);

  // 2. Persistent Profile Update Handler with Supabase DB Sync & Live Feed Update
  const handleUpdateProfile = async (updatedData: Partial<ConnectUsProfile>) => {
    if (!profile) return null;
    const merged = { ...profile, ...updatedData };
    setProfile(merged);

    // Update posts authored by this profile in state
    setPosts(prev => prev.map(p => {
      if (p.user_id === merged.user_id || p.author.id === merged.id || p.author.user_id === merged.user_id) {
        return { ...p, author: { ...p.author, ...merged } };
      }
      return p;
    }));

    const success = await ConnectUsService.saveProfile(merged);
    if (success) {
      toast({ title: "Profil ConnectUs enregistré avec succès ✓" });
    } else {
      toast({
        title: "Erreur de sauvegarde",
        description: "Impossible d'enregistrer les modifications. Veuillez réessayer.",
        variant: "destructive",
      });
    }
    return merged;
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

  // 4. Delete Post (With Authorization Verification & Persistent DB Removal)
  const handleDeletePost = async (postId: string) => {
    if (!userId) {
      toast({ title: "Veuillez vous connecter pour supprimer", variant: "destructive" });
      return false;
    }

    const postToDelete = posts.find(p => p.id === postId);
    if (postToDelete) {
      const authorId = postToDelete.user_id || postToDelete.author?.id;
      if (authorId && authorId !== userId && !userId.startsWith("guest_")) {
        toast({
          title: "Suppression non autorisée",
          description: "Vous ne pouvez supprimer que vos propres publications.",
          variant: "destructive",
        });
        return false;
      }
    }

    // Optimistic UI state update
    setPosts(prev => prev.filter(p => p.id !== postId));

    const success = await ConnectUsService.deletePost(postId, userId);
    if (success) {
      toast({ title: "Publication supprimée avec succès ✓" });
      return true;
    } else {
      toast({ title: "Erreur lors de la suppression en base de données", variant: "destructive" });
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

  // 6. Add Comment Handler
  const handleAddComment = async (postId: string, text: string) => {
    if (!userId || !text.trim()) return null;
    const authorData = profile || { full_name: "Membre Ecomfy", avatar_url: null, username: "membre" };
    const newComment = await ConnectUsService.addComment(postId, userId, authorData, text);

    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const currentComments = p.comments || [];
        return {
          ...p,
          comments_count: (p.comments_count || 0) + 1,
          comments: [...currentComments, newComment],
        };
      }
      return p;
    }));

    return newComment;
  };

  // 7. Toggle Follow
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
    addComment: handleAddComment,
    toggleFollow: handleToggleFollow,
    refresh: loadConnectUsData,
  };
}
