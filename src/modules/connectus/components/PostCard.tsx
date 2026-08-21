import { useState } from "react";
import { ConnectUsPost, ReactionType } from "../types/connectus.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Heart, Flame, PartyPopper, ThumbsUp, MessageSquare, Share2, ShoppingBag,
  ExternalLink, CheckCircle2, Store, MoreHorizontal, Send, ShieldCheck, Globe, Users, Video, Link2, Trash2, Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

interface PostCardProps {
  post: ConnectUsPost;
  currentUserId: string;
  onToggleReaction: (postId: string, reaction: ReactionType) => void;
  onToggleFollow?: (targetUserId: string) => void;
  onDeletePost?: (postId: string) => void;
  isFollowingAuthor?: boolean;
}

export function PostCard({
  post,
  currentUserId,
  onToggleReaction,
  onToggleFollow,
  onDeletePost,
  isFollowingAuthor = false,
}: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<{ id: string; authorName: string; text: string; date: string }[]>([
    { id: "c1", authorName: "Seydou Koné", text: "Superbe publication ! Très instructif pour la communauté.", date: "Il y a 10 min" }
  ]);

  const author = post.author;
  const isOwnPost = currentUserId === author.id || currentUserId === post.user_id;

  const ageInHours = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 3600);
  const isDeletable = ageInHours <= 24;

  const formattedDate = formatDistanceToNow(new Date(post.created_at), {
    addSuffix: true,
    locale: fr,
  });

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    setComments(prev => [
      ...prev,
      { id: `c-${Date.now()}`, authorName: "Vous", text: commentText.trim(), date: "À l'instant" }
    ]);
    setCommentText("");
    toast({ title: "Commentaire ajouté ✓" });
  };

  const handleShare = () => {
    const postUrl = window.location.href;
    navigator.clipboard.writeText(postUrl);
    toast({
      title: "Lien de la publication copié ! 🔗",
      description: "Vous pouvez le partager sur WhatsApp, Facebook ou Instagram."
    });
  };

  return (
    <Card className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs transition-all hover:shadow-sm space-y-4">
      {/* Header: Author Profile & Actions */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            {author.avatar_url ? (
              <img
                src={author.avatar_url}
                alt={author.full_name || ""}
                className="h-11 w-11 rounded-2xl object-cover border border-slate-100 shadow-2xs"
              />
            ) : (
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#0E7C66] to-emerald-400 text-white font-bold text-base flex items-center justify-center shadow-2xs">
                {(author.full_name || "U")[0]?.toUpperCase()}
              </div>
            )}
            {author.is_business && (
              <span className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 p-0.5 rounded-full ring-2 ring-white">
                <Store className="h-3 w-3" />
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm text-slate-900 truncate">{author.full_name}</span>
              {author.is_verified && (
                <CheckCircle2 className="h-4 w-4 text-[#0E7C66] shrink-0" />
              )}
              {author.shop_name && (
                <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 text-[10px] font-semibold">
                  {author.shop_name}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>@{author.username}</span>
              <span>•</span>
              <span>{formattedDate}</span>
              <span>•</span>
              {post.visibility === "public" ? <Globe className="h-3 w-3" /> : <Users className="h-3 w-3" />}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isOwnPost && onToggleFollow && (
            <Button
              variant={isFollowingAuthor ? "outline" : "default"}
              size="sm"
              onClick={() => onToggleFollow(author.id)}
              className={`rounded-full h-8 text-xs font-bold ${
                isFollowingAuthor
                  ? "border-slate-300 text-slate-700 hover:bg-slate-100"
                  : "bg-slate-900 hover:bg-slate-800 text-white"
              }`}
            >
              {isFollowingAuthor ? "Abonné ✓" : "+ Suivre"}
            </Button>
          )}

          {/* Own Post Options: 24h Deletion */}
          {isOwnPost && onDeletePost && (
            <div className="relative">
              {isDeletable ? (
                <button
                  onClick={() => onDeletePost(post.id)}
                  className="p-2 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                  title="Supprimer la publication (Disponible pendant 24h)"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : (
                <span
                  className="p-2 rounded-full text-slate-300 cursor-not-allowed flex items-center gap-1 text-[10px]"
                  title="Suppression verrouillée (délai de 24h expiré)"
                >
                  <Clock className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Post Text Content */}
      {post.content && (
        <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line font-inter">
          {post.content}
        </p>
      )}

      {/* Video Content Player */}
      {post.video_url && (
        <div className="rounded-2xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center relative">
          <video src={post.video_url} controls className="h-full w-full object-contain" />
        </div>
      )}

      {/* Web Link Preview Card / Ecomfy Link Card */}
      {post.link_preview && (
        <a
          href={post.link_preview.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 hover:bg-slate-100/80 transition-all p-3 space-y-2 group"
        >
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <Link2 className="h-3.5 w-3.5 text-[#0E7C66]" /> {post.link_preview.domain}
            </span>
            <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-[#0E7C66]" />
          </div>
          <div className="flex gap-3 items-center">
            {post.link_preview.image && (
              <img src={post.link_preview.image} alt="" className="h-16 w-20 rounded-xl object-cover shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-xs text-slate-900 group-hover:text-[#0E7C66] line-clamp-1">
                {post.link_preview.title}
              </p>
              {post.link_preview.description && (
                <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">
                  {post.link_preview.description}
                </p>
              )}
            </div>
          </div>
        </a>
      )}

      {/* Media Grid */}
      {post.media_urls && post.media_urls.length > 0 && (
        <div className={`grid gap-2 rounded-2xl overflow-hidden ${
          post.media_urls.length === 1 ? "grid-cols-1" : "grid-cols-2"
        }`}>
          {post.media_urls.map((url, idx) => (
            <div key={idx} className="relative aspect-4/3 bg-slate-100 overflow-hidden group">
              <img
                src={url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          ))}
        </div>
      )}

      {/* Ecomfy Social Commerce Attached Product Card */}
      {post.attached_product && (
        <div className="rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-r from-emerald-50/50 via-teal-50/30 to-white p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-2xs overflow-hidden max-w-full">
          <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-white overflow-hidden shrink-0 border border-emerald-100 shadow-2xs">
              {post.attached_product.image_url ? (
                <img src={post.attached_product.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-emerald-700 font-bold text-sm">
                  <ShoppingBag className="h-6 w-6" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <Badge className="bg-emerald-600 text-white text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider border-0 shrink-0">
                  🛒 PRODUIT ECOMFY
                </Badge>
                {post.attached_product.category && (
                  <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{post.attached_product.category}</span>
                )}
              </div>
              <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate max-w-full">
                {post.attached_product.name}
              </h4>
              <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                <span className="text-sm sm:text-base font-extrabold text-[#0E7C66]">
                  {post.attached_product.price.toLocaleString("fr-FR")} FCFA
                </span>
                {post.attached_product.compare_at_price && post.attached_product.compare_at_price > post.attached_product.price && (
                  <span className="text-[11px] text-slate-400 line-through">
                    {post.attached_product.compare_at_price.toLocaleString("fr-FR")} FCFA
                  </span>
                )}
              </div>
            </div>
          </div>

          <Button
            asChild
            className="w-full sm:w-auto rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs h-9 sm:h-10 px-4 sm:px-5 shadow-md shrink-0 gap-1.5"
          >
            <a
              href={
                post.attached_product.shop_slug
                  ? `/shop/${post.attached_product.shop_slug}/product?product=${post.attached_product.id}`
                  : `/product-view?id=${post.attached_product.id}`
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Acheter sur la boutique</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      )}

      {/* Interactions Bar: Reactions, Comments Count, Share */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
        {/* Reactions Picker */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggleReaction(post.id, "love")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold transition-all ${
              post.user_reaction === "love"
                ? "bg-rose-100 text-rose-600 shadow-2xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Flame className={`h-4 w-4 ${post.user_reaction === "love" ? "fill-rose-500 text-rose-500" : ""}`} />
            <span>{post.likes_count}</span>
          </button>

          <button
            onClick={() => onToggleReaction(post.id, "like")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full font-bold transition-all ${
              post.user_reaction === "like"
                ? "bg-emerald-100 text-[#0E7C66]"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Comments & Share */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-slate-600 hover:bg-slate-100 transition-all"
          >
            <MessageSquare className="h-4 w-4" />
            <span>{comments.length} commentaires</span>
          </button>

          <button
            onClick={handleShare}
            className="p-2 rounded-full text-slate-500 hover:bg-slate-100 transition-all"
            title="Partager la publication"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Comments Section Drawer */}
      {showComments && (
        <div className="pt-3 border-t border-slate-100 space-y-3">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Écrire un commentaire..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
              className="h-9 text-xs rounded-full bg-slate-100 border-transparent focus:bg-white focus:border-slate-300"
            />
            <Button
              size="sm"
              onClick={handleAddComment}
              disabled={!commentText.trim()}
              className="h-9 px-3 rounded-full bg-[#0E7C66] text-white"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {comments.map((c) => (
              <div key={c.id} className="bg-slate-50 p-2.5 rounded-2xl text-xs space-y-0.5">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>{c.authorName}</span>
                  <span className="text-[10px] text-slate-400 font-normal">{c.date}</span>
                </div>
                <p className="text-slate-700">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
