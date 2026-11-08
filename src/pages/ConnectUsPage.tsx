import { useState, useEffect, useMemo, useCallback } from "react";
import { Helmet } from "react-helmet";
import { useConnectUs } from "@/modules/connectus/hooks/useConnectUs";
import { ConnectUsHeader, ConnectUsTab } from "@/modules/connectus/components/ConnectUsHeader";
import { ConnectUsSidebar } from "@/modules/connectus/components/ConnectUsSidebar";
import { StoryBar } from "@/modules/connectus/components/StoryBar";
import { PostCard } from "@/modules/connectus/components/PostCard";
import { CreatePostModal } from "@/modules/connectus/components/CreatePostModal";
import { ConnectUsProfileView } from "@/modules/connectus/components/ConnectUsProfileView";
import { NotificationCenter } from "@/modules/connectus/components/NotificationCenter";
import { ConnectUsDirectMessages } from "@/modules/connectus/components/ConnectUsDirectMessages";
import { OnboardingModal } from "@/modules/connectus/components/OnboardingModal";
import { InviteUserModal } from "@/modules/connectus/components/InviteUserModal";
import { ConnectUsFeedSkeleton } from "@/modules/connectus/components/ConnectUsFeedSkeleton";
import { ConnectUsService } from "@/modules/connectus/services/connectus.service";
import { ConnectUsPost, ConnectUsProfile } from "@/modules/connectus/types/connectus.types";
import { Button } from "@/modules/connectus/components/CUButton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Globe, PlusCircle, Compass, Users, User, Store, Film, Radio, MessageCircle, Briefcase, ShoppingBag, RefreshCw,
  Heart, MessageSquare, TrendingUp, ExternalLink,
} from "lucide-react";

const PAGE_SIZE = 20;

export default function ConnectUsPage() {
  const connect = useConnectUs();
  const {
    userId, profile, posts, merchantProducts, notifications, suggestions, followingMap, unreadNotifCount, unreadMessages,
    loading, loadError, submitting, showOnboarding, setShowOnboarding, setUnreadMessages,
    updateProfile, createPost, deletePost, toggleReaction, loadComments, addComment, deleteComment, toggleCommentLike,
    toggleFollow, sendInvitation, sendDirectMessage, acceptInvitation, declineInvitation, markAllNotificationsRead, refresh,
  } = connect;

  const [activeTab, setActiveTab] = useState<ConnectUsTab>("feed");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ConnectUsProfile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<ConnectUsProfile | null>(null);
  const [directMessageTarget, setDirectMessageTarget] = useState<ConnectUsProfile | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Profil affiché dans l'onglet « Profil » : le mien, ou celui d'un autre membre
  const [viewedUserId, setViewedUserId] = useState<string | null>(null);
  const [viewedProfile, setViewedProfile] = useState<ConnectUsProfile | null>(null);
  const [profilePosts, setProfilePosts] = useState<ConnectUsPost[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const goToTab = (tab: ConnectUsTab) => {
    if (tab === "profile") setViewedUserId(null);
    if (tab !== "messages") setDirectMessageTarget(null);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openProfile = useCallback(
    (targetId: string) => {
      setViewedUserId(targetId === userId ? null : targetId);
      setDirectMessageTarget(null);
      setActiveTab("profile");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [userId]
  );

  const openDirectMessage = (target: ConnectUsProfile) => {
    setDirectMessageTarget(target);
    setSearchQuery("");
    setActiveTab("messages");
  };

  // Recherche de membres (avec délai pour ne pas interroger la base à chaque lettre)
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    let active = true;
    setSearchLoading(true);
    const timer = setTimeout(() => {
      ConnectUsService.searchProfiles(q, userId)
        .then((res) => active && setSearchResults(res))
        .catch(() => active && setSearchResults([]))
        .finally(() => active && setSearchLoading(false));
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, userId]);

  // Chargement du profil consulté et de ses publications
  const postsCount = posts.length;
  useEffect(() => {
    if (activeTab !== "profile" || !userId) return;
    let active = true;
    const targetId = viewedUserId || userId;
    setLoadingProfile(true);
    Promise.all([
      viewedUserId ? ConnectUsService.getProfile(viewedUserId) : Promise.resolve(null),
      ConnectUsService.getUserPosts(targetId, userId),
    ])
      .then(([p, userPosts]) => {
        if (!active) return;
        setViewedProfile(p);
        setProfilePosts(userPosts);
      })
      .catch(() => active && setProfilePosts([]))
      .finally(() => active && setLoadingProfile(false));
    return () => {
      active = false;
    };
  }, [activeTab, viewedUserId, userId, postsCount]);

  useEffect(() => setVisibleCount(PAGE_SIZE), [searchQuery, activeTab]);

  const handleToggleReaction = async (postId: string, reaction: "like" | "love") => {
    await toggleReaction(postId, reaction);
    // Publication ancienne affichée sur un profil mais absente du fil : on la relit pour afficher le vrai compteur
    if (profilePosts.some((p) => p.id === postId)) {
      const fresh = await ConnectUsService.getPostById(postId, userId);
      if (fresh) setProfilePosts((prev) => prev.map((p) => (p.id === postId ? fresh : p)));
    }
  };

  const postsById = useMemo(() => new Map(posts.map((p) => [p.id, p])), [posts]);

  const renderPost = (post: ConnectUsPost) => {
    const current = postsById.get(post.id) ?? post;
    return (
      <PostCard
        key={post.id}
        post={current}
        currentUserId={userId}
        onToggleReaction={handleToggleReaction}
        onToggleFollow={toggleFollow}
        onDeletePost={async (id) => {
          const ok = await deletePost(id);
          if (ok) setProfilePosts((prev) => prev.filter((p) => p.id !== id));
        }}
        onOpenProfile={openProfile}
        onLoadComments={loadComments}
        onAddComment={addComment}
        onDeleteComment={deleteComment}
        onToggleCommentLike={toggleCommentLike}
        isFollowingAuthor={Boolean(followingMap[post.user_id])}
      />
    );
  };

  const matchesSearch = (p: ConnectUsPost) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return [p.content, p.author.full_name, p.author.username, p.attached_product?.name, p.link_preview?.domain].some((v) =>
      (v || "").toLowerCase().includes(q)
    );
  };

  const filteredPosts = posts.filter(matchesSearch);
  const followedPosts = posts.filter((p) => followingMap[p.user_id]);
  const productPosts = posts.filter((p) => p.attached_product);
  const trendingPosts = [...posts].sort((a, b) => b.likes_count + b.comments_count * 2 - (a.likes_count + a.comments_count * 2));

  const stats = useMemo(() => {
    const mine = posts.filter((p) => p.user_id === userId);
    return {
      likes: mine.reduce((n, p) => n + p.likes_count, 0),
      comments: mine.reduce((n, p) => n + p.comments_count, 0),
      products: mine.filter((p) => p.attached_product).length,
      top: [...mine].sort((a, b) => b.likes_count + b.comments_count - (a.likes_count + a.comments_count))[0],
    };
  }, [posts, userId]);

  const emptyCard = (icon: React.ReactNode, title: string, text: string, action?: React.ReactNode) => (
    <Card className="p-10 text-center rounded-3xl space-y-3 bg-white border border-slate-200">
      <div className="mx-auto w-fit text-slate-300">{icon}</div>
      <h3 className="font-bold text-base text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm mx-auto">{text}</p>
      {action}
    </Card>
  );

  const postList = (list: ConnectUsPost[], empty: React.ReactNode) =>
    list.length > 0 ? (
      <div className="space-y-4">
        {list.slice(0, visibleCount).map(renderPost)}
        {visibleCount < list.length && (
          <div className="py-2 text-center">
            <Button variant="outline" onClick={() => setVisibleCount((n) => n + PAGE_SIZE)} className="rounded-full text-xs font-bold border-slate-300 text-slate-700">
              Voir plus de publications ({list.length - visibleCount})
            </Button>
          </div>
        )}
      </div>
    ) : (
      empty
    );

  const pageTitle = (icon: React.ReactNode, title: string, subtitle: string) => (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 space-y-1">
      <h2 className="text-lg sm:text-xl font-bold font-space text-slate-900 flex items-center gap-2">
        {icon} {title}
      </h2>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );

  const displayedProfile = viewedUserId ? viewedProfile : profile;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Helmet>
        <title>ConnectUs • Réseau social & social commerce Ecomfy</title>
        <meta name="description" content="ConnectUs est le réseau social d'Ecomfy : publiez, suivez des membres, échangez en privé et vendez vos produits." />
      </Helmet>

      <ConnectUsHeader
        activeTab={activeTab}
        unreadNotificationsCount={unreadNotifCount}
        unreadMessagesCount={unreadMessages}
        onTabChange={goToTab}
        onCreatePostClick={() => setShowCreateModal(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchLoading={searchLoading}
        searchResults={searchResults}
        onSelectUserForInvite={setInviteTarget}
        onToggleFollowUser={toggleFollow}
        onOpenDirectMessage={openDirectMessage}
        onOpenProfile={(id) => {
          openProfile(id);
          setSearchQuery("");
        }}
        followingMap={followingMap}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-28 md:pb-8 flex gap-6 items-start">
        <ConnectUsSidebar
          activeTab={activeTab}
          onTabChange={goToTab}
          profile={profile}
          onCreatePostClick={() => setShowCreateModal(true)}
          unreadNotificationsCount={unreadNotifCount}
          unreadMessagesCount={unreadMessages}
        />

        <div className="flex-1 min-w-0">
          {loading ? (
            <ConnectUsFeedSkeleton />
          ) : loadError && posts.length === 0 && activeTab === "feed" ? (
            emptyCard(
              <RefreshCw className="h-12 w-12" />,
              "Le fil d'actualité ne se charge pas",
              loadError,
              <Button onClick={refresh} className="rounded-full bg-[#0E7C66] text-white text-xs font-bold gap-2">
                <RefreshCw className="h-4 w-4" /> Réessayer
              </Button>
            )
          ) : (
            <>
              {activeTab === "feed" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  <div className="lg:col-span-2 space-y-5 min-w-0">
                    <StoryBar currentUserId={userId} currentProfile={profile} />

                    <Card
                      role="button"
                      tabIndex={0}
                      onClick={() => setShowCreateModal(true)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setShowCreateModal(true)}
                      className="p-3 sm:p-4 rounded-3xl border border-slate-200/80 bg-white hover:border-[#0E7C66] cursor-pointer transition-all flex items-center gap-3"
                    >
                      <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-[#0E7C66] to-emerald-400 text-white font-bold flex items-center justify-center shrink-0 overflow-hidden">
                        {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : (profile?.full_name || "U")[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0 bg-slate-100/80 rounded-2xl px-4 py-2.5 text-xs text-slate-500 font-medium truncate">
                        Exprimez-vous, collez un lien ou attachez un produit…
                      </div>
                      <Button size="sm" className="rounded-2xl bg-[#0E7C66] text-white font-bold text-xs gap-1.5 shrink-0 hidden sm:flex">
                        <PlusCircle className="h-4 w-4" /> Publier
                      </Button>
                    </Card>

                    {postList(
                      filteredPosts,
                      emptyCard(
                        <Globe className="h-12 w-12" />,
                        searchQuery.trim() ? `Aucune publication ne correspond à « ${searchQuery.trim()} »` : "Aucune publication pour le moment",
                        searchQuery.trim() ? "Essayez un autre mot-clé." : "Soyez le premier à publier sur ConnectUs aujourd'hui !",
                        searchQuery.trim() ? (
                          <Button onClick={() => setSearchQuery("")} variant="outline" className="rounded-full text-xs font-bold border-slate-300">
                            Effacer la recherche
                          </Button>
                        ) : (
                          <Button onClick={() => setShowCreateModal(true)} className="rounded-full bg-[#0E7C66] text-white font-bold text-xs">
                            Créer une publication
                          </Button>
                        )
                      )
                    )}
                  </div>

                  <aside className="space-y-5 hidden lg:block" aria-label="Suggestions">
                    {suggestions.length > 0 && (
                      <Card className="rounded-3xl p-5 border border-slate-200 bg-white space-y-4 shadow-xs">
                        <h3 className="font-space font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Users className="h-4 w-4 text-[#0E7C66]" /> Membres à suivre
                        </h3>
                        <ul className="space-y-3 text-xs">
                          {suggestions.map((m) => (
                            <li key={m.user_id} className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-slate-50 border border-slate-100">
                              <button type="button" onClick={() => openProfile(m.user_id)} className="flex items-center gap-2.5 min-w-0 text-left">
                                {m.avatar_url ? (
                                  <img src={m.avatar_url} alt="" className="h-9 w-9 rounded-xl object-cover" />
                                ) : (
                                  <span className="h-9 w-9 rounded-xl bg-[#0E7C66] text-white font-bold flex items-center justify-center">{(m.full_name || "M")[0]?.toUpperCase()}</span>
                                )}
                                <span className="min-w-0">
                                  <span className="block font-bold text-slate-900 truncate">{m.full_name}</span>
                                  <span className="block text-[10px] text-slate-500 truncate">{m.is_business && m.shop_name ? `🏪 ${m.shop_name}` : `@${m.username}`}</span>
                                </span>
                              </button>
                              <Button size="sm" onClick={() => toggleFollow(m.user_id)} className="rounded-full h-8 px-3 text-[10px] font-bold bg-slate-900 text-white shrink-0">
                                + Suivre
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </Card>
                    )}

                    <Card className="rounded-3xl p-5 border border-emerald-200 bg-gradient-to-br from-[#0E7C66] to-emerald-700 text-white space-y-3 shadow-md">
                      <h3 className="font-space font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                        <ShoppingBag className="h-4 w-4 text-amber-300" /> Vendez avec ConnectUs
                      </h3>
                      <p className="text-xs text-emerald-100 leading-relaxed">
                        {merchantProducts.length > 0
                          ? "Attachez un produit de votre boutique à une publication : vos abonnés peuvent l'acheter en un clic."
                          : "Publiez des produits dans votre boutique Ecomfy pour les présenter à la communauté."}
                      </p>
                      {merchantProducts.length > 0 ? (
                        <Button onClick={() => setShowCreateModal(true)} className="w-full rounded-full bg-white text-slate-950 hover:bg-emerald-50 font-extrabold text-xs h-9">
                          Publier un produit
                        </Button>
                      ) : (
                        <Button asChild className="w-full rounded-full bg-white text-slate-950 hover:bg-emerald-50 font-extrabold text-xs h-9">
                          <a href="/shop-manager">Gérer ma boutique</a>
                        </Button>
                      )}
                    </Card>
                  </aside>
                </div>
              )}

              {activeTab === "explore" && (
                <div className="space-y-5">
                  {pageTitle(<Compass className="h-5 w-5 text-[#0E7C66]" />, "Explorer", "Les publications qui font le plus réagir en ce moment.")}
                  {postList(trendingPosts, emptyCard(<Compass className="h-12 w-12" />, "Rien à explorer pour l'instant", "Les publications de la communauté apparaîtront ici."))}
                </div>
              )}

              {activeTab === "following" && (
                <div className="space-y-5">
                  {pageTitle(<Users className="h-5 w-5 text-[#0E7C66]" />, "Abonnements", "Les publications des membres que vous suivez.")}
                  {postList(
                    followedPosts,
                    emptyCard(
                      <Users className="h-12 w-12" />,
                      Object.values(followingMap).some(Boolean) ? "Pas encore de publication" : "Vous ne suivez encore personne",
                      Object.values(followingMap).some(Boolean)
                        ? "Les membres que vous suivez n'ont rien publié récemment."
                        : "Recherchez un membre en haut de la page et suivez-le pour voir ses publications ici.",
                      <Button onClick={() => goToTab("feed")} variant="outline" className="rounded-full text-xs font-bold border-slate-300">
                        Retour au fil d'actualité
                      </Button>
                    )
                  )}
                </div>
              )}

              {activeTab === "stories" && (
                <div className="space-y-5">
                  {pageTitle(<Film className="h-5 w-5 text-amber-500" />, "Stories (24 h)", "Photos et vidéos éphémères, visibles 24 heures.")}
                  <StoryBar currentUserId={userId} currentProfile={profile} hideHeader />
                </div>
              )}

              {activeTab === "messages" && (
                <ConnectUsDirectMessages
                  currentUserId={userId}
                  targetUser={directMessageTarget}
                  onSendMessage={sendDirectMessage}
                  onUnreadChange={setUnreadMessages}
                  onOpenProfile={openProfile}
                />
              )}

              {activeTab === "notifications" && (
                <NotificationCenter
                  notifications={notifications}
                  onAcceptInvitation={acceptInvitation}
                  onDeclineInvitation={declineInvitation}
                  onMarkAllRead={markAllNotificationsRead}
                  onToggleFollow={toggleFollow}
                  onOpenProfile={openProfile}
                  followingMap={followingMap}
                />
              )}

              {activeTab === "marketplace" && (
                <div className="space-y-5">
                  <div className="rounded-3xl p-5 sm:p-6 border border-emerald-200 bg-gradient-to-r from-emerald-50/60 via-teal-50/30 to-white space-y-1">
                    <Badge className="bg-[#0E7C66] text-white">Social commerce</Badge>
                    <h2 className="text-lg sm:text-xl font-bold font-space text-slate-900 flex items-center gap-2">
                      <ShoppingBag className="h-5 w-5 text-[#0E7C66]" /> Produits en vedette
                    </h2>
                    <p className="text-xs text-slate-500">Les articles présentés dans les publications des vendeurs, achetables directement.</p>
                  </div>
                  {postList(
                    productPosts,
                    emptyCard(
                      <ShoppingBag className="h-12 w-12" />,
                      "Aucun produit présenté pour le moment",
                      "Les vendeurs peuvent attacher un produit de leur boutique à une publication.",
                      merchantProducts.length > 0 ? (
                        <Button onClick={() => setShowCreateModal(true)} className="rounded-full bg-[#0E7C66] text-white font-bold text-xs">
                          Présenter un de mes produits
                        </Button>
                      ) : undefined
                    )
                  )}
                </div>
              )}

              {activeTab === "live" &&
                emptyCard(
                  <Radio className="h-12 w-12" />,
                  "Live commerce : bientôt disponible",
                  "Les directs vidéo avec ajout au panier pendant la diffusion arrivent prochainement.",
                  <Button onClick={() => goToTab("feed")} variant="outline" className="rounded-full text-xs font-bold border-slate-300">
                    Retour au fil d'actualité
                  </Button>
                )}

              {activeTab === "profile" &&
                (displayedProfile ? (
                  <div className="space-y-3">
                    {viewedUserId && (
                      <Button variant="ghost" size="sm" onClick={() => goToTab("profile")} className="rounded-full text-xs font-bold text-slate-600 gap-1.5">
                        <User className="h-3.5 w-3.5" /> Voir mon profil
                      </Button>
                    )}
                    <ConnectUsProfileView
                      profile={displayedProfile}
                      posts={profilePosts}
                      loadingPosts={loadingProfile}
                      currentUserId={userId}
                      onToggleFollow={toggleFollow}
                      isFollowing={Boolean(followingMap[displayedProfile.user_id])}
                      onOpenDirectMessage={openDirectMessage}
                      onUpdateProfile={updateProfile}
                      renderPost={renderPost}
                    />
                  </div>
                ) : (
                  <ConnectUsFeedSkeleton />
                ))}

              {activeTab === "business" && (
                <div className="space-y-5">
                  {pageTitle(<Briefcase className="h-5 w-5 text-[#0E7C66]" />, "Mes statistiques", "Ce que vos publications produisent sur ConnectUs.")}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: "Publications", value: profile?.posts_count ?? 0, icon: Globe },
                      { label: "Abonnés", value: profile?.followers_count ?? 0, icon: Users },
                      { label: "J'aime reçus", value: stats.likes, icon: Heart },
                      { label: "Commentaires reçus", value: stats.comments, icon: MessageSquare },
                    ].map(({ label, value, icon: Icon }) => (
                      <Card key={label} className="p-4 rounded-2xl border border-slate-200 bg-white">
                        <Icon className="h-4 w-4 text-[#0E7C66]" />
                        <p className="text-2xl font-extrabold text-slate-900 mt-2 font-space">{value.toLocaleString("fr-FR")}</p>
                        <p className="text-[11px] text-slate-500">{label}</p>
                      </Card>
                    ))}
                  </div>
                  <Card className="p-5 rounded-3xl border border-slate-200 bg-white space-y-3">
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-[#0E7C66]" /> Publication la plus populaire
                    </h3>
                    {stats.top ? (
                      <div className="text-xs text-slate-700 space-y-1">
                        <p className="line-clamp-2">{stats.top.content.replace(/\*\*/g, "") || "Publication sans texte"}</p>
                        <p className="text-slate-500">
                          {stats.top.likes_count} j'aime · {stats.top.comments_count} commentaire{stats.top.comments_count > 1 ? "s" : ""}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">Publiez pour voir apparaître vos statistiques.</p>
                    )}
                  </Card>
                  <Card className="p-5 rounded-3xl border border-slate-200 bg-white space-y-3">
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <Store className="h-4 w-4 text-amber-500" /> Ma boutique
                    </h3>
                    {profile?.shop_slug ? (
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span>{profile.shop_name} · {stats.products} publication{stats.products > 1 ? "s" : ""} avec produit</span>
                        <Button asChild size="sm" variant="outline" className="rounded-full text-xs font-bold gap-1.5">
                          <a href={`/shop/${profile.shop_slug}`} target="_blank" rel="noopener noreferrer">
                            Voir la boutique <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">Vous n'avez pas encore de boutique Ecomfy associée à ce compte.</p>
                    )}
                  </Card>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {profile && <OnboardingModal open={showOnboarding} onOpenChange={setShowOnboarding} profile={profile} onComplete={updateProfile} />}

      <CreatePostModal open={showCreateModal} onOpenChange={setShowCreateModal} userId={userId} onSubmit={createPost} merchantProducts={merchantProducts} submitting={submitting} />

      <InviteUserModal open={Boolean(inviteTarget)} onOpenChange={(open) => !open && setInviteTarget(null)} targetUser={inviteTarget} onSendInvite={sendInvitation} />

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2 flex items-center justify-around shadow-lg" aria-label="Navigation ConnectUs">
        {[
          { tab: "feed" as const, label: "Accueil", icon: Globe },
          { tab: "explore" as const, label: "Explorer", icon: Compass },
        ].map(({ tab, label, icon: Icon }) => (
          <button key={tab} type="button" onClick={() => goToTab(tab)} aria-current={activeTab === tab ? "page" : undefined} className={`flex flex-col items-center gap-0.5 text-[10px] font-bold min-w-[48px] ${activeTab === tab ? "text-[#0E7C66]" : "text-slate-500"}`}>
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </button>
        ))}

        <button type="button" onClick={() => setShowCreateModal(true)} className="flex items-center justify-center h-12 w-12 rounded-full bg-[#0E7C66] text-white shadow-md -mt-6 active:scale-95 transition-transform border-2 border-white" aria-label="Créer une publication">
          <PlusCircle className="h-6 w-6" />
        </button>

        <button type="button" onClick={() => goToTab("messages")} aria-current={activeTab === "messages" ? "page" : undefined} className={`relative flex flex-col items-center gap-0.5 text-[10px] font-bold min-w-[48px] ${activeTab === "messages" ? "text-[#0E7C66]" : "text-slate-500"}`}>
          <MessageCircle className="h-5 w-5" />
          {unreadMessages > 0 && <span className="absolute -top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-extrabold flex items-center justify-center">{unreadMessages}</span>}
          <span>Messages</span>
        </button>

        <button type="button" onClick={() => goToTab("profile")} aria-current={activeTab === "profile" ? "page" : undefined} className={`flex flex-col items-center gap-0.5 text-[10px] font-bold min-w-[48px] ${activeTab === "profile" ? "text-[#0E7C66]" : "text-slate-500"}`}>
          <User className="h-5 w-5" />
          <span>Profil</span>
        </button>
      </nav>
    </div>
  );
}
