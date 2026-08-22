import { useState, useRef, useEffect } from "react";
import { ConnectUsProfile, ConnectUsPost } from "../types/connectus.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { readFileAsDataUrl } from "../utils/fileUploader";
import { formatExternalUrl } from "../utils/linkScraper";
import {
  MapPin, Link2, Store, CheckCircle2, Users, Grid, ShoppingBag, Edit3, Save, X, Globe, ShieldCheck, Camera, MessageCircle, Upload
} from "lucide-react";
import { PostCard } from "./PostCard";
import { toast } from "@/hooks/use-toast";

interface ConnectUsProfileViewProps {
  profile: ConnectUsProfile;
  posts: ConnectUsPost[];
  currentUserId: string;
  onToggleFollow?: (targetUserId: string) => void;
  isFollowing?: boolean;
  onUpdateProfile?: (updatedData: Partial<ConnectUsProfile>) => void | Promise<any>;
  onDeletePost?: (postId: string) => void;
}

export function ConnectUsProfileView({
  profile,
  posts,
  currentUserId,
  onToggleFollow,
  isFollowing = false,
  onUpdateProfile,
  onDeletePost,
}: ConnectUsProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [location, setLocation] = useState(profile?.location || "");
  const [websiteUrl, setWebsiteUrl] = useState(profile?.website_url || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [coverUrl, setCoverUrl] = useState(profile?.cover_url || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&auto=format&fit=crop&q=80");
  const [showShopOnProfile, setShowShopOnProfile] = useState<boolean>(profile?.show_shop_on_profile || false);
  const [activeSubTab, setActiveSubTab] = useState<"posts" | "products">("posts");

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Sync edit form fields whenever profile prop updates
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setUsername(profile.username || "");
      setBio(profile.bio || "");
      setLocation(profile.location || "");
      setWebsiteUrl(profile.website_url || "");
      setAvatarUrl(profile.avatar_url || "");
      setCoverUrl(profile.cover_url || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&auto=format&fit=crop&q=80");
      setShowShopOnProfile(profile.show_shop_on_profile || false);
    }
  }, [profile]);

  const isOwnProfile = Boolean(
    !currentUserId ||
    currentUserId === profile.user_id ||
    currentUserId === profile.id ||
    profile.user_id === "guest_visitor" ||
    profile.id === "guest_visitor" ||
    currentUserId === "guest_visitor"
  );
  
  const userPosts = posts.filter(p => p.user_id === profile.user_id || p.author.id === profile.id);
  const productPosts = userPosts.filter(p => !!p.attached_product);

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAvatarUrl(dataUrl);
      if (onUpdateProfile) {
        await onUpdateProfile({ avatar_url: dataUrl });
      }
      toast({ title: "Photo de profil mise à jour et enregistrée ! ✓" });
    } catch (err) {
      toast({ title: "Erreur lors de l'importation de la photo", variant: "destructive" });
    }
  };

  const handleCoverFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setCoverUrl(dataUrl);
      if (onUpdateProfile) {
        await onUpdateProfile({ cover_url: dataUrl });
      }
      toast({ title: "Photo de couverture mise à jour et enregistrée ! ✓" });
    } catch (err) {
      toast({ title: "Erreur lors de l'importation de la couverture", variant: "destructive" });
    }
  };

  const handleSaveProfile = async () => {
    const updated: Partial<ConnectUsProfile> = {
      full_name: fullName.trim() || profile.full_name,
      username: username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_") || profile.username,
      bio: bio.trim(),
      location: location.trim(),
      website_url: websiteUrl.trim() || null,
      avatar_url: avatarUrl.trim() || null,
      cover_url: coverUrl.trim() || null,
      show_shop_on_profile: showShopOnProfile,
    };

    if (onUpdateProfile) {
      await onUpdateProfile(updated);
    } else {
      Object.assign(profile, updated);
    }

    setIsEditing(false);
    toast({ title: "Profil ConnectUs enregistré et conservé avec succès ✓" });
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Cover Banner & Avatar Header */}
      <Card className="rounded-3xl overflow-hidden border border-slate-200 shadow-sm bg-white">
        <div className="h-44 sm:h-56 w-full bg-gradient-to-r from-[#0E7C66] via-teal-600 to-emerald-700 relative">
          <img src={coverUrl} alt="" className="h-full w-full object-cover opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
          
          {isOwnProfile && (
            <>
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="absolute top-3 right-3 bg-slate-900/80 hover:bg-slate-900 text-white font-bold text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md transition-all"
              >
                <Camera className="h-3.5 w-3.5" /> Changer la couverture
              </button>
              <input
                type="file"
                ref={coverInputRef}
                onChange={handleCoverFileSelect}
                accept="image/*"
                className="hidden"
              />
            </>
          )}
        </div>

        {/* Profile Details Container */}
        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-16 sm:-mt-20 mb-4">
            {/* Large Avatar */}
            <div className="relative group">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName || ""}
                  className="h-28 w-28 sm:h-32 sm:w-32 rounded-3xl object-cover border-4 border-white shadow-md bg-white"
                />
              ) : (
                <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-3xl bg-gradient-to-tr from-[#0E7C66] to-emerald-400 text-white font-extrabold text-3xl flex items-center justify-center border-4 border-white shadow-md">
                  {(fullName || "U")[0]?.toUpperCase()}
                </div>
              )}

              {isOwnProfile && (
                <>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute inset-0 rounded-3xl bg-slate-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Changer la photo de profil depuis votre appareil"
                  >
                    <Camera className="h-7 w-7" />
                  </button>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={handleAvatarFileSelect}
                    accept="image/*"
                    className="hidden"
                  />
                </>
              )}

              {profile.is_business && (
                <span className="absolute bottom-1 right-1 bg-amber-400 text-slate-950 p-1.5 rounded-full ring-4 ring-white shadow-md" title="Compte Marchand Ecomfy">
                  <Store className="h-4 w-4" />
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {isOwnProfile ? (
                <>
                  <Button
                    onClick={() => avatarInputRef.current?.click()}
                    variant="outline"
                    className="rounded-full border-slate-300 font-bold text-xs h-10 px-4 gap-1.5"
                  >
                    <Upload className="h-4 w-4 text-[#0E7C66]" /> Importer Photo
                  </Button>
                  <Button
                    onClick={() => setIsEditing(!isEditing)}
                    variant="outline"
                    className="rounded-full border-slate-300 font-bold text-xs h-10 px-5 gap-1.5 flex-1 sm:flex-none"
                  >
                    <Edit3 className="h-4 w-4" /> Modifier le profil
                  </Button>
                </>
              ) : (
                <>
                  {onToggleFollow && (
                    <Button
                      onClick={() => onToggleFollow(profile.id)}
                      className={`rounded-full font-bold text-xs h-10 px-6 flex-1 sm:flex-none ${
                        isFollowing ? "bg-slate-200 text-slate-800 hover:bg-slate-300" : "bg-[#0E7C66] hover:bg-[#0A6352] text-white shadow-md"
                      }`}
                    >
                      {isFollowing ? "Abonné ✓" : "+ S'abonner"}
                    </Button>
                  )}
                  <Button
                    onClick={() => toast({ title: "Messenger Ecomfy 💬", description: "Envoi de message direct." })}
                    variant="outline"
                    className="rounded-full border-slate-300 text-slate-700 font-bold text-xs h-10 px-4 gap-1.5"
                  >
                    <MessageCircle className="h-4 w-4 text-blue-500" /> Message
                  </Button>
                </>
              )}

              {profile.shop_slug && (
                <Button
                  asChild
                  className="rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-10 px-5 gap-1.5 shadow-sm"
                >
                  <a href={`/shop/${profile.shop_slug}`} target="_blank" rel="noopener noreferrer">
                    <Store className="h-4 w-4 text-amber-400" />
                    <span>Visiter la boutique</span>
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* Name & Handles */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{profile.full_name}</h2>
              {profile.is_verified && <CheckCircle2 className="h-5 w-5 text-[#0E7C66]" />}
              {profile.is_business && (
                <Badge className="bg-amber-100 text-amber-900 border-0 text-xs font-extrabold uppercase tracking-wider">
                  MARCHAND VERIFIÉ
                </Badge>
              )}
            </div>

            <p className="text-xs text-slate-500 font-medium">@{profile.username}</p>

            {Boolean(profile.show_shop_on_profile) && profile.shop_name && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#0E7C66] mt-1 bg-emerald-50/80 w-fit px-3 py-1 rounded-full border border-emerald-200">
                <Store className="h-3.5 w-3.5" />
                <span>{profile.shop_name}</span>
              </div>
            )}

            {/* Profile Edit Drawer Form */}
            {isEditing ? (
              <div className="space-y-3 pt-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Edit3 className="h-4 w-4 text-[#0E7C66]" /> Modification du profil ConnectUs
                </h3>

                {profile.shop_name && (
                  <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Store className="h-4 w-4 text-[#0E7C66]" /> Afficher ma boutique sur mon profil
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Boutique associée : <span className="font-semibold text-slate-700">{profile.shop_name}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowShopOnProfile(!showShopOnProfile)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all shrink-0 ${
                        showShopOnProfile
                          ? "bg-[#0E7C66] text-white shadow-xs"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                    >
                      {showShopOnProfile ? "[ ON ]" : "[ OFF ]"}
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] font-bold text-slate-700">Nom Complet :</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="text-xs rounded-xl h-9 bg-white" />
                  </div>
                  <div>
                    <Label className="text-[11px] font-bold text-slate-700">Nom d'utilisateur (@username) :</Label>
                    <Input value={username} onChange={(e) => setUsername(e.target.value)} className="text-xs rounded-xl h-9 bg-white" />
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] font-bold text-slate-700">Biographie :</Label>
                  <Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="text-xs rounded-xl bg-white min-h-[60px]" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] font-bold text-slate-700">Localisation :</Label>
                    <Input value={location} onChange={(e) => setLocation(e.target.value)} className="text-xs rounded-xl h-9 bg-white" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-[11px] font-bold text-slate-700">Lien Web / Boutique / Produit :</Label>
                      {websiteUrl && (
                        <button
                          type="button"
                          onClick={() => setWebsiteUrl("")}
                          className="text-[10px] text-rose-600 font-bold hover:underline"
                        >
                          Supprimer le lien
                        </button>
                      )}
                    </div>
                    <Input
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://votre-boutique.ecomfy.cloud ou lien de produit"
                      className="text-xs rounded-xl h-9 bg-white"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      {profile.shop_slug && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setWebsiteUrl(`https://ecomfy.cloud/shop/${profile.shop_slug}`)}
                          className="h-7 text-[10px] font-bold rounded-lg border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 gap-1"
                        >
                          <Store className="h-3 w-3 text-amber-600" /> Insérer ma Boutique
                        </Button>
                      )}
                      {profile.shop_slug && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const prodUrl = prompt("Saisissez le nom ou lien direct de votre produit :");
                            if (prodUrl) {
                              setWebsiteUrl(prodUrl.startsWith("http") ? prodUrl : `https://ecomfy.cloud/shop/${profile.shop_slug}?product=${encodeURIComponent(prodUrl)}`);
                            }
                          }}
                          className="h-7 text-[10px] font-bold rounded-lg border-emerald-300 text-emerald-900 bg-emerald-50 hover:bg-emerald-100 gap-1"
                        >
                          <ShoppingBag className="h-3 w-3 text-emerald-600" /> Insérer Fiche Produit
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => avatarInputRef.current?.click()}
                    className="rounded-full text-xs font-bold gap-1"
                  >
                    <Camera className="h-3.5 w-3.5" /> Importer Photo de Profil
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => coverInputRef.current?.click()}
                    className="rounded-full text-xs font-bold gap-1"
                  >
                    <Upload className="h-3.5 w-3.5" /> Importer Photo Couverture
                  </Button>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={handleSaveProfile} className="rounded-full bg-[#0E7C66] text-white text-xs font-bold gap-1">
                    <Save className="h-3.5 w-3.5" /> Enregistrer les modifications
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="rounded-full text-xs font-bold">
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-700 font-inter max-w-2xl leading-relaxed">
                {profile.bio || "Aucune biographie rédigée pour l'instant."}
              </p>
            )}

            {/* Meta details */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1 font-medium">
              {profile.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" /> {profile.location}
                </span>
              )}
              {profile.website_url && (
                <a
                  href={formatExternalUrl(profile.website_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[#0E7C66] font-bold hover:underline"
                >
                  <Link2 className="h-3.5 w-3.5" /> {profile.website_url.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-6 pt-4 border-t border-slate-100 text-slate-900 font-space">
              <div>
                <span className="text-lg font-extrabold">{userPosts.length}</span>
                <span className="text-xs text-slate-500 block">Publications</span>
              </div>
              <div className="border-l border-slate-200 pl-6">
                <span className="text-lg font-extrabold">{profile.followers_count}</span>
                <span className="text-xs text-slate-500 block">Abonnés</span>
              </div>
              <div className="border-l border-slate-200 pl-6">
                <span className="text-lg font-extrabold">{profile.following_count}</span>
                <span className="text-xs text-slate-500 block">Abonnements</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Profile Content Sub-Tabs */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveSubTab("posts")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === "posts" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Grid className="h-4 w-4" /> Publications ({userPosts.length})
          </button>
          <button
            onClick={() => setActiveSubTab("products")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === "products" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <ShoppingBag className="h-4 w-4" /> Articles Social Commerce ({productPosts.length})
          </button>
        </div>

        {activeSubTab === "posts" ? (
          userPosts.length > 0 ? (
            <div className="space-y-4">
              {userPosts.map(p => (
                <PostCard
                  key={p.id}
                  post={p}
                  currentUserId={currentUserId}
                  onToggleReaction={() => {}}
                  onDeletePost={onDeletePost}
                />
              ))}
            </div>
          ) : (
            <Card className="p-10 text-center text-slate-500 text-xs">
              Aucune publication sur ce profil pour l'instant.
            </Card>
          )
        ) : (
          productPosts.length > 0 ? (
            <div className="space-y-4">
              {productPosts.map(p => (
                <PostCard
                  key={p.id}
                  post={p}
                  currentUserId={currentUserId}
                  onToggleReaction={() => {}}
                  onDeletePost={onDeletePost}
                />
              ))}
            </div>
          ) : (
            <Card className="p-10 text-center text-slate-500 text-xs">
              Aucun produit e-commerce rattaché dans les publications de ce profil.
            </Card>
          )
        )}
      </div>
    </div>
  );
}
