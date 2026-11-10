import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { ConnectUsService } from "../services/connectus.service";
import {
  ConnectUsProfile,
  ConnectUsPost,
  ConnectUsNotification,
  ConnectUsComment,
  AttachedProduct,
  VisibilityType,
  ReactionType,
} from "../types/connectus.types";
import { LinkMetadata } from "../utils/linkScraper";
import { toast } from "@/hooks/use-toast";

const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

export function useConnectUs() {
  const { session, user, isReady } = useAuthReady();
  const userId = session?.user?.id || user?.id || "";

  const [profile, setProfile] = useState<ConnectUsProfile | null>(null);
  const [posts, setPosts] = useState<ConnectUsPost[]>([]);
  const [merchantProducts, setMerchantProducts] = useState<AttachedProduct[]>([]);
  const [notifications, setNotifications] = useState<ConnectUsNotification[]>([]);
  const [suggestions, setSuggestions] = useState<ConnectUsProfile[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const postsRef = useRef<ConnectUsPost[]>([]);
  postsRef.current = posts;

  const loadConnectUsData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const userProfile = await ConnectUsService.getProfile(userId);
      setProfile(userProfile);
      setShowOnboarding(userProfile.is_onboarded === false);

      const [feed, products, notifs, following, suggested, unread] = await Promise.allSettled([
        ConnectUsService.getFeedPosts(userId),
        ConnectUsService.getMerchantProducts(userId),
        ConnectUsService.getNotifications(userId),
        ConnectUsService.getFollowingIds(userId),
        ConnectUsService.getSuggestedMembers(userId),
        ConnectUsService.getUnreadMessagesCount(userId),
      ]);

      if (feed.status === "fulfilled") setPosts(feed.value);
      else setLoadError(errorText(feed.reason, "Impossible de charger le fil d'actualité."));
      if (products.status === "fulfilled") setMerchantProducts(products.value);
      if (notifs.status === "fulfilled") setNotifications(notifs.value);
      if (following.status === "fulfilled") {
        setFollowingMap(Object.fromEntries(following.value.map((id) => [id, true])));
      }
      if (suggested.status === "fulfilled") setSuggestions(suggested.value);
      if (unread.status === "fulfilled") setUnreadMessages(unread.value);
    } catch (e) {
      console.error("Chargement ConnectUs impossible :", e);
      setLoadError(errorText(e, "Impossible de charger ConnectUs."));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isReady && userId) loadConnectUsData();
    else if (isReady) setLoading(false);
  }, [isReady, userId, loadConnectUsData]);

  // Temps réel : nouvelles publications des autres membres, notifications reçues, messages reçus
  useEffect(() => {
    if (!isReady || !userId) return;

    const stopPosts = ConnectUsService.subscribeToPosts(
      async (postId, authorId) => {
        if (authorId === userId || postsRef.current.some((p) => p.id === postId)) return;
        const post = await ConnectUsService.getPostById(postId, userId);
        if (post) setPosts((prev) => (prev.some((p) => p.id === post.id) ? prev : [post, ...prev]));
      },
      (postId) => setPosts((prev) => prev.filter((p) => p.id !== postId))
    );
    const stopNotifs = ConnectUsService.subscribeToNotifications(userId, async () => {
      try {
        setNotifications(await ConnectUsService.getNotifications(userId));
      } catch {
        /* le prochain rechargement corrigera */
      }
    });
    const stopMessages = ConnectUsService.subscribeToMessages(userId, () => setUnreadMessages((n) => n + 1));

    return () => {
      stopPosts();
      stopNotifs();
      stopMessages();
    };
  }, [isReady, userId]);

  const refreshNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      setNotifications(await ConnectUsService.getNotifications(userId));
    } catch {
      /* conservé tel quel */
    }
  }, [userId]);

  // ---- Profil ---------------------------------------------------------------------------------------------
  const updateProfile = async (updatedData: Partial<ConnectUsProfile>, options?: { silent?: boolean }) => {
    if (!profile) return null;
    const merged = { ...profile, ...updatedData };
    const result = await ConnectUsService.saveProfile(merged);
    if (!result.ok) {
      toast({ title: "Profil non enregistré", description: result.error, variant: "destructive" });
      return null;
    }
    setProfile(merged);
    setShowOnboarding(merged.is_onboarded === false);
    setPosts((prev) => prev.map((p) => (p.user_id === merged.user_id ? { ...p, author: { ...p.author, ...merged } } : p)));
    if (!options?.silent) toast({ title: "Profil enregistré ✓" });
    return merged;
  };

  // ---- Publications ---------------------------------------------------------------------------------------
  const createPost = async (postData: {
    content: string;
    media_urls: string[];
    video_url?: string | null;
    link_preview?: LinkMetadata | null;
    attached_product?: AttachedProduct | null;
    visibility: VisibilityType;
  }) => {
    if (!userId) return null;
    setSubmitting(true);
    try {
      const created = await ConnectUsService.createPost(userId, postData);
      setPosts((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      setProfile((prev) => (prev ? { ...prev, posts_count: prev.posts_count + 1 } : prev));
      toast({ title: "Publication en ligne 🚀", description: "Elle est visible par la communauté." });
      return created;
    } catch (e) {
      toast({ title: "Publication impossible", description: errorText(e, "Réessayez dans un instant."), variant: "destructive" });
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const deletePost = async (postId: string) => {
    if (!userId) return false;
    const target = postsRef.current.find((p) => p.id === postId);
    if (target && target.user_id !== userId) {
      toast({ title: "Suppression non autorisée", description: "Vous ne pouvez supprimer que vos publications.", variant: "destructive" });
      return false;
    }
    const ok = await ConnectUsService.deletePost(postId, userId);
    if (ok) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setProfile((prev) => (prev ? { ...prev, posts_count: Math.max(0, prev.posts_count - 1) } : prev));
      toast({ title: "Publication supprimée ✓" });
    } else {
      toast({ title: "Suppression impossible", description: "Réessayez dans un instant.", variant: "destructive" });
    }
    return ok;
  };

  const toggleReaction = async (postId: string, reactionType: ReactionType = "like") => {
    if (!userId) return;
    const before = postsRef.current.find((p) => p.id === postId);
    if (!before) return;

    // Affichage immédiat : poser = +1, changer de réaction = 0, retirer = -1
    const removing = before.user_reaction === reactionType;
    const adding = !before.user_reaction;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, user_reaction: removing ? null : reactionType, likes_count: Math.max(0, p.likes_count + (removing ? -1 : adding ? 1 : 0)) }
          : p
      )
    );
    try {
      const { likesCount, userReaction } = await ConnectUsService.toggleReaction(postId, userId, reactionType);
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes_count: likesCount, user_reaction: userReaction } : p)));
    } catch (e) {
      setPosts((prev) => prev.map((p) => (p.id === postId ? before : p)));
      toast({ title: "Réaction non enregistrée", description: errorText(e, "Réessayez."), variant: "destructive" });
    }
  };

  // ---- Commentaires ---------------------------------------------------------------------------------------
  const loadComments = (postId: string): Promise<ConnectUsComment[]> => ConnectUsService.getComments(postId, userId);

  const addComment = async (postId: string, text: string, parentId?: string | null) => {
    if (!userId || !text.trim()) return null;
    try {
      const comment = await ConnectUsService.addComment(postId, userId, text, parentId);
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p)));
      return comment;
    } catch (e) {
      toast({ title: "Commentaire non envoyé", description: errorText(e, "Réessayez."), variant: "destructive" });
      return null;
    }
  };

  const deleteComment = async (postId: string, commentId: string, removedCount = 1) => {
    if (!userId) return false;
    const ok = await ConnectUsService.deleteComment(commentId, userId);
    if (ok) {
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments_count: Math.max(0, p.comments_count - removedCount) } : p)));
    } else {
      toast({ title: "Suppression impossible", variant: "destructive" });
    }
    return ok;
  };

  const toggleCommentLike = async (commentId: string) => {
    if (!userId) return null;
    try {
      return await ConnectUsService.toggleCommentLike(commentId, userId);
    } catch (e) {
      toast({ title: "J'aime non enregistré", description: errorText(e, "Réessayez."), variant: "destructive" });
      return null;
    }
  };

  // ---- Abonnements ----------------------------------------------------------------------------------------
  const toggleFollow = async (targetUserId: string) => {
    if (!userId || targetUserId === userId) return false;
    const wasFollowing = Boolean(followingMap[targetUserId]);
    setFollowingMap((prev) => ({ ...prev, [targetUserId]: !wasFollowing }));
    try {
      const nowFollowing = await ConnectUsService.toggleFollow(userId, targetUserId);
      setFollowingMap((prev) => ({ ...prev, [targetUserId]: nowFollowing }));
      setProfile((prev) => (prev ? { ...prev, following_count: Math.max(0, prev.following_count + (nowFollowing ? 1 : -1)) } : prev));
      if (nowFollowing) setSuggestions((prev) => prev.filter((s) => s.user_id !== targetUserId));
      toast({ title: nowFollowing ? "Abonnement ajouté ✓" : "Abonnement retiré" });
      return nowFollowing;
    } catch (e) {
      setFollowingMap((prev) => ({ ...prev, [targetUserId]: wasFollowing }));
      toast({ title: "Abonnement impossible", description: errorText(e, "Réessayez."), variant: "destructive" });
      return wasFollowing;
    }
  };

  const sendInvitation = async (targetId: string, message: string) => {
    if (!userId) return false;
    const result = await ConnectUsService.sendInvitation(userId, targetId, message);
    if (!result.ok) {
      toast({ title: "Invitation non envoyée", description: result.error, variant: "destructive" });
      return false;
    }
    setFollowingMap((prev) => ({ ...prev, [targetId]: true }));
    toast(
      result.alreadySent
        ? { title: "Invitation déjà envoyée", description: "Ce membre doit d'abord y répondre." }
        : { title: "Invitation envoyée 🎉", description: "Vous suivez ce membre et il en a été informé." }
    );
    return true;
  };

  const acceptInvitation = async (notifId: string, actorUserId: string) => {
    if (!userId) return false;
    const ok = await ConnectUsService.acceptFollowInvitation(userId, notifId, actorUserId);
    if (ok) {
      setFollowingMap((prev) => ({ ...prev, [actorUserId]: true }));
      toast({ title: "Invitation acceptée ✓", description: "Vous vous suivez mutuellement." });
      await refreshNotifications();
    } else {
      toast({ title: "Impossible d'accepter l'invitation", variant: "destructive" });
    }
    return ok;
  };

  const declineInvitation = async (notifId: string) => {
    if (!userId) return false;
    const ok = await ConnectUsService.declineFollowInvitation(userId, notifId);
    if (ok) {
      toast({ title: "Invitation refusée" });
      await refreshNotifications();
    }
    return ok;
  };

  const markAllNotificationsRead = async () => {
    if (!userId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await ConnectUsService.markAllNotificationsRead(userId);
  };

  // ---- Messagerie -----------------------------------------------------------------------------------------
  const sendDirectMessage = async (receiverId: string, content: string, mediaFile?: File | null) => {
    if (!userId) return null;
    try {
      return await ConnectUsService.sendPrivateMessage(userId, receiverId, content, mediaFile);
    } catch (e) {
      toast({ title: "Message non envoyé", description: errorText(e, "Réessayez."), variant: "destructive" });
      return null;
    }
  };

  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  return {
    userId,
    profile,
    posts,
    merchantProducts,
    notifications,
    suggestions,
    followingMap,
    unreadNotifCount,
    unreadMessages,
    setUnreadMessages,
    loading,
    loadError,
    submitting,
    showOnboarding,
    setShowOnboarding,
    updateProfile,
    createPost,
    deletePost,
    toggleReaction,
    loadComments,
    addComment,
    deleteComment,
    toggleCommentLike,
    toggleFollow,
    sendInvitation,
    sendDirectMessage,
    acceptInvitation,
    declineInvitation,
    markAllNotificationsRead,
    refresh: loadConnectUsData,
  };
}
