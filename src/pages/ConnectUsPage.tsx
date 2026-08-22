import { useState, useEffect } from "react";
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
import { ConnectUsService } from "@/modules/connectus/services/connectus.service";
import { ConnectUsProfile } from "@/modules/connectus/types/connectus.types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Globe, PlusCircle, Compass, Users, User, Store, Loader2, Sparkles, TrendingUp, ShoppingBag, CheckCircle2,
  MessageCircle, Film, Radio, Briefcase, ExternalLink, ArrowRight, UserPlus
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function ConnectUsPage() {
  const {
    userId,
    profile,
    posts,
    merchantProducts,
    notifications,
    unreadNotifCount,
    loading,
    submitting,
    showOnboarding,
    setShowOnboarding,
    updateProfile,
    createPost,
    deletePost,
    toggleReaction,
    addComment,
    addCommentReply,
    toggleCommentLike,
    toggleFollow,
    isMutualFollow,
    sendDirectMessage,
    getConversations,
    getMessages,
    acceptInvitation,
    declineInvitation,
  } = useConnectUs();

  const [activeTab, setActiveTab] = useState<ConnectUsTab>("feed");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [searchResults, setSearchResults] = useState<ConnectUsProfile[]>([]);
  const [selectedUserForInvite, setSelectedUserForInvite] = useState<ConnectUsProfile | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [directMessageTargetUser, setDirectMessageTargetUser] = useState<ConnectUsProfile | null>(null);

  const handleOpenDirectMessage = (targetUser: ConnectUsProfile) => {
    setDirectMessageTargetUser(targetUser);
    setActiveTab("messages");
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    let active = true;
    ConnectUsService.searchProfiles(searchQuery).then((res) => {
      if (active) setSearchResults(res);
    });
    return () => {
      active = false;
    };
  }, [searchQuery]);

  const handleToggleFollowUser = (targetId: string) => {
    const isNowFollowing = toggleFollow(targetId);
    setFollowingMap(prev => ({ ...prev, [targetId]: isNowFollowing }));
  };

  const handleOpenInviteModal = (targetUser: ConnectUsProfile) => {
    setSelectedUserForInvite(targetUser);
    setShowInviteModal(true);
  };

  const handleSendInviteMessage = (targetId: string, message: string) => {
    ConnectUsService.sendInvitation(userId, targetId, message);
    handleToggleFollowUser(targetId);
  };

  const filteredPosts = posts.filter((p) => {
    if (!p) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const contentMatch = (p.content || "").toLowerCase().includes(q);
    const nameMatch = (p.author?.full_name || "").toLowerCase().includes(q);
    const usernameMatch = (p.author?.username || "").toLowerCase().includes(q);
    const productMatch = (p.attached_product?.name || "").toLowerCase().includes(q);
    const linkMatch = (p.link_preview?.domain || "").toLowerCase().includes(q);
    return contentMatch || nameMatch || usernameMatch || productMatch || linkMatch;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Helmet>
        <title>ConnectUs • Réseau Social & Social Commerce Ecomfy</title>
        <meta
          name="description"
          content="ConnectUs est l'écosystème social natif d'Ecomfy. Partagez des photos, vidéos, liens, suivez des membres et vendez vos produits en direct."
        />
      </Helmet>

      {/* Top Header avec recherche de membres en temps réel */}
      <ConnectUsHeader
        profile={profile}
        activeTab={activeTab}
        unreadNotificationsCount={unreadNotifCount}
        onTabChange={(tab) => {
          if (tab === "live") {
            toast({
              title: "Live Commerce ConnectUs 📺",
              description: "Démarrez un direct vidéo avec sélection de produits de votre boutique Ecomfy !",
            });
          }
          setActiveTab(tab);
        }}
        onCreatePostClick={() => setShowCreateModal(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchResults={searchResults}
        onSelectUserForInvite={handleOpenInviteModal}
        onToggleFollowUser={handleToggleFollowUser}
        onOpenDirectMessage={handleOpenDirectMessage}
        followingMap={followingMap}
      />

      {/* Main Layout Container: Left Dedicated Sidebar + Central Content + Right Suggestions */}
      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6 items-start">
        {/* Dedicated Left ConnectUs Vertical Menu */}
        <ConnectUsSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          profile={profile}
          onCreatePostClick={() => setShowCreateModal(true)}
          unreadNotificationsCount={unreadNotifCount}
        />

        {/* Central Content Area */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3 bg-white rounded-3xl border border-slate-200">
              <Loader2 className="h-8 w-8 animate-spin text-[#0E7C66]" />
              <p className="text-xs font-semibold text-slate-500">Chargement de votre réseau ConnectUs...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: FEED ACCUEIL */}
              {activeTab === "feed" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  <div className="lg:col-span-2 space-y-5">
                    <StoryBar
                      currentAvatarUrl={profile?.avatar_url}
                      currentUserId={userId}
                      currentProfile={profile}
                      onOpenDirectMessage={handleOpenDirectMessage}
                    />

                    {/* Section de résultats de recherche de membres */}
                    {searchQuery.trim().length > 0 && searchResults.length > 0 && (
                      <Card className="p-4 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 via-teal-50/30 to-white shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-space font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                            <Users className="h-4 w-4 text-[#0E7C66]" /> Membres ConnectUs trouvés ({searchResults.length})
                          </h3>
                          <Badge className="bg-[#0E7C66] text-white text-[9px] font-bold">Recherche</Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {searchResults.map((user) => (
                            <div key={user.id} className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#0E7C66] to-teal-400 text-white font-bold flex items-center justify-center shrink-0 overflow-hidden text-xs">
                                  {user.avatar_url ? (
                                    <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    (user.full_name || "U")[0]?.toUpperCase()
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-xs text-slate-900 truncate">{user.full_name}</p>
                                  <p className="text-[10px] text-slate-500 truncate">@{user.username}</p>
                                  {Boolean(user.show_shop_on_profile) && user.shop_name && (
                                    <p className="text-[9px] text-[#0E7C66] font-semibold truncate mt-0.5">
                                      🏪 {user.shop_name}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  onClick={() => handleToggleFollowUser(user.id)}
                                  className={`rounded-full h-7 px-2.5 text-[10px] font-bold ${
                                    followingMap[user.id]
                                      ? "bg-emerald-100 text-emerald-800 border-0"
                                      : "bg-slate-900 text-white hover:bg-slate-800"
                                  }`}
                                >
                                  {followingMap[user.id] ? "Abonné" : "+ Suivre"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenInviteModal(user)}
                                  className="rounded-full h-7 px-2 text-[10px] font-bold border-emerald-300 text-[#0E7C66] hover:bg-emerald-50"
                                  title="Envoyer un message d'invitation"
                                >
                                  Inviter ✉️
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}

                    {/* Quick Post Creator Card */}
                    <Card
                      onClick={() => setShowCreateModal(true)}
                      className="p-4 rounded-3xl border border-slate-200/80 bg-white shadow-xs hover:border-[#0E7C66] cursor-pointer transition-all flex items-center gap-3"
                    >
                      <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-[#0E7C66] to-emerald-400 text-white font-bold flex items-center justify-center shrink-0">
                        {profile?.avatar_url ? (
                          <img src={profile.avatar_url} alt="" className="h-full w-full object-cover rounded-2xl" />
                        ) : (
                          (profile?.full_name || "U")[0]?.toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 bg-slate-100/80 rounded-2xl px-4 py-2.5 text-xs text-slate-400 font-medium">
                        Exprimez-vous, coller un lien ou attacher un produit Ecomfy...
                      </div>
                      <Button size="sm" className="rounded-2xl bg-[#0E7C66] text-white font-bold text-xs gap-1.5 shrink-0">
                        <PlusCircle className="h-4 w-4" /> Publier
                      </Button>
                    </Card>

                    {/* Feed Posts List */}
                    {filteredPosts.length > 0 ? (
                      <div className="space-y-4">
                        {filteredPosts.map((post) => (
                          <PostCard
                            key={post.id}
                            post={post}
                            currentUserId={userId}
                            onToggleReaction={toggleReaction}
                            onToggleFollow={handleToggleFollowUser}
                            onDeletePost={deletePost}
                            onAddComment={addComment}
                            onAddCommentReply={addCommentReply}
                            onToggleCommentLike={toggleCommentLike}
                            isFollowingAuthor={Boolean(post.author?.id && followingMap[post.author.id])}
                          />
                        ))}
                      </div>
                    ) : (
                      <Card className="p-12 text-center rounded-3xl">
                        <Globe className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                        <h3 className="font-bold text-base text-slate-900 mb-1">Aucune publication trouvée</h3>
                        <p className="text-xs text-slate-500 mb-4">Soyez le premier à publier sur ConnectUs aujourd'hui !</p>
                        <Button onClick={() => setShowCreateModal(true)} className="rounded-full bg-[#0E7C66] text-white font-bold text-xs">
                          Créer une publication
                        </Button>
                      </Card>
                    )}
                  </div>

                  {/* Right Column: Recommendations & Spotlight */}
                  <div className="space-y-5 hidden lg:block">
                    <Card className="rounded-3xl p-5 border border-slate-200 bg-white space-y-4 shadow-xs">
                      <div className="flex items-center justify-between">
                        <h3 className="font-space font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Store className="h-4 w-4 text-amber-500" /> Marchands Recommandés
                        </h3>
                        <Badge className="bg-amber-100 text-amber-900 border-0 text-[9px] font-bold">Top Vendeurs</Badge>
                      </div>

                      <div className="space-y-3 text-xs">
                        {[
                          {
                            id: "demo-user-1",
                            name: "Koffi Mensah",
                            shop: "Koffi Fashion",
                            avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
                            followers: "1 420 abonnés",
                          },
                          {
                            id: "demo-user-2",
                            name: "Aminata Diallo",
                            shop: "Aminata Bio Care",
                            avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&auto=format&fit=crop&q=80",
                            followers: "2 890 abonnés",
                          }
                        ].map((merchant) => (
                          <div key={merchant.id} className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-slate-50 border border-slate-100">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img src={merchant.avatar} alt="" className="h-9 w-9 rounded-xl object-cover" />
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 truncate">{merchant.name}</p>
                                <p className="text-[10px] text-slate-500 truncate">{merchant.shop}</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleToggleFollowUser(merchant.id)}
                              className="rounded-full h-7 px-3 text-[10px] font-bold bg-slate-900 text-white"
                            >
                              {followingMap[merchant.id] ? "Abonné" : "+ Suivre"}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card className="rounded-3xl p-5 border border-emerald-200 bg-gradient-to-br from-[#0E7C66] to-emerald-700 text-white space-y-3 shadow-md">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-300" />
                        <span className="font-space font-bold text-xs uppercase tracking-wider">ConnectUs Business & Ads</span>
                      </div>
                      <p className="text-xs text-emerald-100 leading-relaxed font-inter">
                        Boostez vos publications et créez des campagnes de Social Commerce ciblées vers vos boutiques Ecomfy.
                      </p>
                      <Button
                        onClick={() => setActiveTab("business")}
                        className="w-full rounded-full bg-white text-slate-950 hover:bg-emerald-50 font-extrabold text-xs h-9"
                      >
                        Business Manager
                      </Button>
                    </Card>
                  </div>
                </div>
              )}

              {/* TAB 2: EXPLORE */}
              {activeTab === "explore" && (
                <div className="space-y-6">
                  <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-2">
                    <h2 className="text-xl font-bold font-space text-slate-900 flex items-center gap-2">
                      <Compass className="h-5 w-5 text-[#0E7C66]" /> Explorer ConnectUs
                    </h2>
                    <p className="text-xs text-slate-500">Découvrez du contenu populaire, des vidéos et des marchands en vogue.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {posts.map(post => (
                      <PostCard
                        key={post.id}
                        post={post}
                        currentUserId={userId}
                        onToggleReaction={toggleReaction}
                        onToggleFollow={handleToggleFollowUser}
                        onDeletePost={deletePost}
                        isFollowingAuthor={!!followingMap[post.author.id]}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: ABONNEMENTS */}
              {activeTab === "following" && (
                <div className="space-y-6">
                  <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-2">
                    <h2 className="text-xl font-bold font-space text-slate-900 flex items-center gap-2">
                      <Users className="h-5 w-5 text-[#0E7C66]" /> Vos Abonnements & Membres Suivis
                    </h2>
                    <p className="text-xs text-slate-500">Retrouvez les publications exclusives des personnes que vous suivez.</p>
                  </div>
                  <div className="space-y-4">
                    {posts.length > 0 ? (
                      (posts.filter(p => p.author?.id && followingMap[p.author.id]).length > 0
                        ? posts.filter(p => p.author?.id && followingMap[p.author.id])
                        : posts
                      ).map(post => (
                        <PostCard
                          key={post.id}
                          post={post}
                          currentUserId={userId}
                          onToggleReaction={toggleReaction}
                          onToggleFollow={handleToggleFollowUser}
                          onDeletePost={deletePost}
                          onAddComment={addComment}
                          onAddCommentReply={addCommentReply}
                          onToggleCommentLike={toggleCommentLike}
                          isFollowingAuthor={Boolean(post.author?.id && followingMap[post.author.id])}
                        />
                      ))
                    ) : (
                      <Card className="p-8 text-center rounded-3xl">
                        <Users className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                        <p className="text-xs text-slate-500">Aucune publication d'abonnement pour le moment.</p>
                      </Card>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: STORIES */}
              {activeTab === "stories" && (
                <div className="space-y-6">
                  <div className="bg-white rounded-3xl p-6 border border-slate-200 space-y-2">
                    <h2 className="text-xl font-bold font-space text-slate-900 flex items-center gap-2">
                      <Film className="h-5 w-5 text-amber-500" /> Stories ConnectUs (24h)
                    </h2>
                    <p className="text-xs text-slate-500">Partagez des aperçus rapides de vos produits ou de votre quotidien.</p>
                  </div>
                  <StoryBar
                    currentAvatarUrl={profile?.avatar_url}
                    currentUserId={userId}
                    currentProfile={profile}
                    onOpenDirectMessage={handleOpenDirectMessage}
                  />
                </div>
              )}

              {/* TAB 5: MESSAGES (Messenger Ecomfy) */}
              {activeTab === "messages" && (
                <ConnectUsDirectMessages
                  currentUserId={userId}
                  targetUser={directMessageTargetUser}
                  onSendMessage={sendDirectMessage}
                  onFetchMessages={getMessages}
                  onClose={() => setDirectMessageTargetUser(null)}
                />
              )}

              {/* TAB 6: NOTIFICATIONS */}
              {activeTab === "notifications" && (
                <NotificationCenter
                  notifications={notifications}
                  onAcceptInvitation={acceptInvitation}
                  onDeclineInvitation={declineInvitation}
                  onToggleFollow={handleToggleFollowUser}
                />
              )}

              {/* TAB 7: MARKETPLACE / SOCIAL COMMERCE */}
              {activeTab === "marketplace" && (
                <div className="space-y-6">
                  <div className="bg-white rounded-3xl p-6 border border-emerald-200 bg-gradient-to-r from-emerald-50/50 via-teal-50/30 to-white space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-[#0E7C66] text-white">Social Commerce</Badge>
                    </div>
                    <h2 className="text-xl font-bold font-space text-slate-900 flex items-center gap-2">
                      <ShoppingBag className="h-5 w-5 text-[#0E7C66]" /> Produits & Boutiques Ecomfy en Vedette
                    </h2>
                    <p className="text-xs text-slate-500">Achetez directement les articles présentés dans les publications des vendeurs.</p>
                  </div>
                  <div className="space-y-4">
                    {posts.filter(p => !!p.attached_product).length > 0 ? (
                      posts.filter(p => !!p.attached_product).map(post => (
                        <PostCard
                          key={post.id}
                          post={post}
                          currentUserId={userId}
                          onToggleReaction={toggleReaction}
                          onToggleFollow={handleToggleFollowUser}
                          onDeletePost={deletePost}
                          onAddComment={addComment}
                          onAddCommentReply={addCommentReply}
                          onToggleCommentLike={toggleCommentLike}
                          isFollowingAuthor={Boolean(post.author?.id && followingMap[post.author.id])}
                        />
                      ))
                    ) : (
                      posts.map(post => (
                        <PostCard
                          key={post.id}
                          post={post}
                          currentUserId={userId}
                          onToggleReaction={toggleReaction}
                          onToggleFollow={handleToggleFollowUser}
                          onDeletePost={deletePost}
                          onAddComment={addComment}
                          onAddCommentReply={addCommentReply}
                          onToggleCommentLike={toggleCommentLike}
                          isFollowingAuthor={Boolean(post.author?.id && followingMap[post.author.id])}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 8: LIVE */}
              {activeTab === "live" && (
                <Card className="p-10 text-center rounded-3xl space-y-3 bg-gradient-to-br from-amber-500/10 via-rose-500/10 to-white border border-amber-200">
                  <Radio className="h-12 w-12 mx-auto text-rose-500 animate-pulse" />
                  <h3 className="font-bold text-lg text-slate-900">Live Commerce ConnectUs</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Présentez vos produits en direct vidéo à vos abonnés et permettez-leur d'ajouter vos articles au panier pendant la diffusion !
                  </p>
                </Card>
              )}

              {/* TAB 9: PROFIL */}
              {activeTab === "profile" && profile && (
                <ConnectUsProfileView
                  profile={profile}
                  posts={posts}
                  currentUserId={userId}
                  onToggleFollow={handleToggleFollowUser}
                  isFollowing={!!followingMap[profile.id]}
                  onOpenDirectMessage={handleOpenDirectMessage}
                  onUpdateProfile={updateProfile}
                  onDeletePost={deletePost}
                />
              )}

              {/* TAB 10: BUSINESS MANAGER */}
              {activeTab === "business" && (
                <div className="space-y-6">
                  <div className="bg-slate-900 text-white rounded-3xl p-6 space-y-3 shadow-md">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-indigo-400" />
                      <span className="font-space font-bold text-sm uppercase tracking-wider">ConnectUs Business Manager</span>
                    </div>
                    <h2 className="text-xl font-bold">Gérez vos pages business et vos campagnes de Social Commerce</h2>
                    <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                      Espace professionnel dédié aux créateurs d'entreprises, marques et marchands Ecomfy pour suivre leurs performances de ventes sociales.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Onboarding Wizard Modal */}
      {profile && (
        <OnboardingModal
          open={showOnboarding}
          onOpenChange={setShowOnboarding}
          profile={profile}
          onComplete={updateProfile}
        />
      )}

      {/* Create Post Modal */}
      <CreatePostModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSubmit={createPost}
        merchantProducts={merchantProducts}
        submitting={submitting}
      />

      {/* Invite User Modal */}
      <InviteUserModal
        open={showInviteModal}
        onOpenChange={setShowInviteModal}
        targetUser={selectedUserForInvite}
        onSendInvite={handleSendInviteMessage}
        isFollowing={Boolean(selectedUserForInvite && followingMap[selectedUserForInvite.id])}
      />

      {/* Mobile Navigation Sticky Bottom Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2 flex items-center justify-around shadow-lg pb-safe">
        <button
          onClick={() => setActiveTab("feed")}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold transition-all ${
            activeTab === "feed" ? "text-[#0E7C66] scale-105" : "text-slate-500"
          }`}
        >
          <Globe className="h-5 w-5" />
          <span>Accueil</span>
        </button>

        <button
          onClick={() => setActiveTab("explore")}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold transition-all ${
            activeTab === "explore" ? "text-[#0E7C66] scale-105" : "text-slate-500"
          }`}
        >
          <Compass className="h-5 w-5" />
          <span>Explorer</span>
        </button>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex flex-col items-center justify-center h-11 w-11 rounded-full bg-[#0E7C66] text-white shadow-md -mt-5 active:scale-95 transition-transform border-2 border-white"
          title="Créer une publication"
        >
          <PlusCircle className="h-6 w-6" />
        </button>

        <button
          onClick={() => setActiveTab("stories")}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold transition-all ${
            activeTab === "stories" ? "text-[#0E7C66] scale-105" : "text-slate-500"
          }`}
        >
          <Film className="h-5 w-5 text-amber-500" />
          <span>Stories</span>
        </button>

        <button
          onClick={() => setActiveTab("profile")}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold transition-all ${
            activeTab === "profile" ? "text-[#0E7C66] scale-105" : "text-slate-500"
          }`}
        >
          <User className="h-5 w-5" />
          <span>Profil</span>
        </button>
      </div>
    </div>
  );
}
