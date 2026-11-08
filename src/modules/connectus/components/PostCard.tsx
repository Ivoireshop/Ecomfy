import { useState } from "react";
import { ConnectUsComment, ConnectUsPost, ReactionType } from "../types/connectus.types";
import { Button } from "./CUButton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Heart, Flame, ThumbsUp, MessageSquare, Share2, ShoppingBag, ExternalLink, CheckCircle2, Store, Send, Globe,
  Users, Link2, Trash2, Loader2, X,
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
  onOpenProfile?: (userId: string) => void;
  onLoadComments?: (postId: string) => Promise<ConnectUsComment[]>;
  onAddComment?: (postId: string, text: string, parentId?: string | null) => Promise<ConnectUsComment | null>;
  onDeleteComment?: (postId: string, commentId: string, removedCount: number) => Promise<boolean>;
  onToggleCommentLike?: (commentId: string) => Promise<{ likes_count: number; user_liked: boolean } | null>;
  isFollowingAuthor?: boolean;
}

const timeAgo = (iso?: string): string => {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  return formatDistanceToNow(new Date(t), { addSuffix: true, locale: fr });
};

const COMMENT_EMOJIS = ["😀", "😍", "🔥", "❤️", "👏", "🚀", "💯", "🙌"];

export function PostCard({
  post,
  currentUserId,
  onToggleReaction,
  onToggleFollow,
  onDeletePost,
  onOpenProfile,
  onLoadComments,
  onAddComment,
  onDeleteComment,
  onToggleCommentLike,
  isFollowingAuthor = false,
}: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<ConnectUsComment[] | null>(null);
  const [commentsError, setCommentsError] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [videoError, setVideoError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const author = post.author;
  const isOwnPost = Boolean(currentUserId && currentUserId === post.user_id);
  const canComment = Boolean(onAddComment);

  const renderFormattedContent = (contentString: string) =>
    contentString.split(/(\*\*.*?\*\*)/g).map((part, idx) =>
      part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
        <strong key={idx} className="font-extrabold text-slate-900">{part.slice(2, -2)}</strong>
      ) : (
        <span key={idx}>{part}</span>
      )
    );

  const toggleComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next && comments === null && onLoadComments) {
      try {
        setCommentsError(false);
        setComments(await onLoadComments(post.id));
      } catch {
        setCommentsError(true);
        setComments([]);
      }
    }
  };

  const submitComment = async (text: string, parentId: string | null) => {
    if (!onAddComment || !text.trim() || sending) return;
    setSending(true);
    const created = await onAddComment(post.id, text, parentId);
    setSending(false);
    if (!created) return;
    setComments((prev) => [...(prev || []), created]);
    if (parentId) {
      setReplyText("");
      setReplyingTo(null);
    } else {
      setCommentText("");
    }
  };

  const likeComment = async (commentId: string) => {
    if (!onToggleCommentLike) return;
    const res = await onToggleCommentLike(commentId);
    if (!res) return;
    setComments((prev) => (prev || []).map((c) => (c.id === commentId ? { ...c, likes_count: res.likes_count, user_liked: res.user_liked } : c)));
  };

  const removeComment = async (comment: ConnectUsComment) => {
    if (!onDeleteComment) return;
    const replies = (comments || []).filter((c) => c.parent_id === comment.id).length;
    const ok = await onDeleteComment(post.id, comment.id, 1 + replies);
    if (ok) setComments((prev) => (prev || []).filter((c) => c.id !== comment.id && c.parent_id !== comment.id));
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/connectus`;
    const text = post.content ? post.content.slice(0, 100) : `Publication de ${author.full_name}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "ConnectUs", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} — ${url}`);
      toast({ title: "Lien copié 🔗", description: "Collez-le dans WhatsApp, Facebook ou Instagram." });
    } catch {
      /* partage annulé par le membre */
    }
  };

  const topLevel = (comments || []).filter((c) => !c.parent_id);
  const repliesOf = (id: string) => (comments || []).filter((c) => c.parent_id === id);

  const openAuthor = () => onOpenProfile?.(post.user_id);

  return (
    <Card className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs transition-all hover:shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={openAuthor} className="flex items-center gap-3 min-w-0 text-left" aria-label={`Voir le profil de ${author.full_name}`}>
          <div className="relative shrink-0">
            {author.avatar_url ? (
              <img src={author.avatar_url} alt="" className="h-11 w-11 rounded-2xl object-cover border border-slate-100" />
            ) : (
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#0E7C66] to-emerald-400 text-white font-bold text-base flex items-center justify-center">
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
              <span className="font-bold text-sm text-slate-900 truncate hover:underline">{author.full_name}</span>
              {author.is_verified && <CheckCircle2 className="h-4 w-4 text-[#0E7C66] shrink-0" aria-label="Marchand vérifié" />}
              {Boolean(author.show_shop_on_profile) && author.shop_name && (
                <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-0 text-[10px] font-semibold">🏪 {author.shop_name}</Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
              <span>@{author.username}</span>
              <span aria-hidden>•</span>
              <span>{timeAgo(post.created_at)}</span>
              <span aria-hidden>•</span>
              {post.visibility === "public" ? (
                <Globe className="h-3 w-3" aria-label="Public" />
              ) : (
                <Users className="h-3 w-3" aria-label="Réservé aux abonnés" />
              )}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {!isOwnPost && onToggleFollow && (
            <Button
              variant={isFollowingAuthor ? "outline" : "default"}
              size="sm"
              onClick={() => onToggleFollow(post.user_id)}
              className={`rounded-full h-8 text-xs font-bold ${
                isFollowingAuthor ? "border-slate-300 text-slate-700 hover:bg-slate-100" : "bg-slate-900 hover:bg-slate-800 text-white"
              }`}
            >
              {isFollowingAuthor ? "Abonné ✓" : "+ Suivre"}
            </Button>
          )}
          {isOwnPost && onDeletePost && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="p-2 rounded-full hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors"
              aria-label="Supprimer ma publication"
              title="Supprimer ma publication"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {post.content && (
        <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line break-words">{renderFormattedContent(post.content)}</p>
      )}

      {post.video_url && (
        <div className="rounded-2xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center">
          {videoError ? (
            <div className="p-6 text-center space-y-2 text-white">
              <p className="text-xs font-semibold text-slate-300">Cette vidéo ne peut pas être lue ici.</p>
              <a
                href={post.video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all"
              >
                Ouvrir la vidéo
              </a>
            </div>
          ) : (
            <video src={post.video_url} controls preload="metadata" playsInline onError={() => setVideoError(true)} className="h-full w-full object-contain" />
          )}
        </div>
      )}

      {post.link_preview && (
        <a
          href={post.link_preview.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 hover:bg-slate-100/80 transition-all p-3 space-y-1.5 group"
        >
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <span className="flex items-center gap-1"><Link2 className="h-3.5 w-3.5 text-[#0E7C66]" /> {post.link_preview.domain}</span>
            <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-[#0E7C66]" />
          </div>
          <p className="font-bold text-xs text-slate-900 group-hover:text-[#0E7C66] line-clamp-1">{post.link_preview.title}</p>
          {post.link_preview.description && <p className="text-[11px] text-slate-600 line-clamp-2">{post.link_preview.description}</p>}
        </a>
      )}

      {post.media_urls.length > 0 && (
        <div className={`grid gap-2 rounded-2xl overflow-hidden ${post.media_urls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {post.media_urls.map((url, idx) => (
            <button
              type="button"
              key={`${url}-${idx}`}
              onClick={() => setLightbox(url)}
              className="relative aspect-[4/3] bg-slate-100 overflow-hidden group"
              aria-label="Agrandir la photo"
            >
              <img src={url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            </button>
          ))}
        </div>
      )}

      {post.attached_product && (
        <div className="rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-r from-emerald-50/50 via-teal-50/30 to-white p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 overflow-hidden max-w-full">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-white overflow-hidden shrink-0 border border-emerald-100">
              {post.attached_product.image_url ? (
                <img src={post.attached_product.image_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-emerald-700"><ShoppingBag className="h-6 w-6" /></div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <Badge className="bg-emerald-600 text-white text-[9px] font-extrabold uppercase tracking-wider border-0 shrink-0">Produit Ecomfy</Badge>
                {post.attached_product.category && <span className="text-[10px] text-slate-500 truncate max-w-[120px]">{post.attached_product.category}</span>}
              </div>
              <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">{post.attached_product.name}</h4>
              <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                <span className="text-sm sm:text-base font-extrabold text-[#0E7C66]">{post.attached_product.price.toLocaleString("fr-FR")} FCFA</span>
                {post.attached_product.compare_at_price && post.attached_product.compare_at_price > post.attached_product.price && (
                  <span className="text-[11px] text-slate-400 line-through">{post.attached_product.compare_at_price.toLocaleString("fr-FR")} FCFA</span>
                )}
              </div>
            </div>
          </div>
          <Button asChild className="w-full sm:w-auto rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs h-10 px-5 shrink-0 gap-1.5">
            <a
              href={post.attached_product.shop_slug ? `/shop/${post.attached_product.shop_slug}/product?product=${post.attached_product.id}` : `/product-view?id=${post.attached_product.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>Acheter sur la boutique</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onToggleReaction(post.id, "like")}
            aria-pressed={post.user_reaction === "like"}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full font-bold transition-all ${
              post.user_reaction === "like" ? "bg-emerald-100 text-[#0E7C66]" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <ThumbsUp className={`h-4 w-4 ${post.user_reaction === "like" ? "fill-[#0E7C66]/20" : ""}`} />
            <span>{post.likes_count}</span>
            <span className="hidden sm:inline">J'aime</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleReaction(post.id, "love")}
            aria-pressed={post.user_reaction === "love"}
            aria-label="Réagir avec une flamme"
            className={`flex items-center px-2.5 py-2 rounded-full transition-all ${
              post.user_reaction === "love" ? "bg-rose-100 text-rose-600" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            <Flame className={`h-4 w-4 ${post.user_reaction === "love" ? "fill-rose-500 text-rose-500" : ""}`} />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleComments}
            aria-expanded={showComments}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full font-semibold text-slate-600 hover:bg-slate-100 transition-all"
          >
            <MessageSquare className="h-4 w-4" />
            <span>
              {post.comments_count} commentaire{post.comments_count > 1 ? "s" : ""}
            </span>
          </button>
          <button type="button" onClick={handleShare} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 transition-all" aria-label="Partager la publication">
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showComments && (
        <div className="pt-3 border-t border-slate-100 space-y-3">
          {canComment && (
            <>
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-base" aria-label="Émojis">
                {COMMENT_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setCommentText((prev) => prev + emoji)}
                    className="hover:scale-125 transition-transform p-1 rounded-md hover:bg-slate-100 shrink-0 text-sm"
                    aria-label={`Insérer ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Écrire un commentaire..."
                  value={commentText}
                  maxLength={2000}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitComment(commentText, null)}
                  className="h-10 text-xs rounded-full bg-slate-100 border-transparent focus:bg-white focus:border-slate-300"
                />
                <Button
                  size="sm"
                  onClick={() => submitComment(commentText, null)}
                  disabled={!commentText.trim() || sending}
                  className="h-10 px-4 rounded-full bg-[#0E7C66] text-white"
                  aria-label="Envoyer le commentaire"
                >
                  {sending && !replyingTo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </>
          )}

          {comments === null ? (
            <p className="text-center text-xs text-slate-400 py-3">Chargement…</p>
          ) : commentsError ? (
            <p className="text-center text-xs text-rose-500 py-3">Impossible de charger les commentaires.</p>
          ) : topLevel.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-3">Aucun commentaire pour le moment. Soyez le premier !</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {topLevel.map((c) => {
                const name = c.author?.full_name || c.authorName || "Membre";
                return (
                  <div key={c.id} className="space-y-2">
                    <div className="bg-slate-50 p-3 rounded-2xl text-xs space-y-1.5 border border-slate-100">
                      <div className="flex items-center justify-between gap-2 font-bold text-slate-900">
                        <button type="button" onClick={() => onOpenProfile?.(c.user_id)} className="hover:underline truncate text-left">{name}</button>
                        <span className="text-[10px] text-slate-400 font-normal shrink-0">{timeAgo(c.created_at)}</span>
                      </div>
                      <p className="text-slate-700 break-words">{c.text}</p>
                      <div className="flex items-center gap-4 pt-1 text-[11px] font-bold text-slate-500">
                        <button
                          type="button"
                          onClick={() => likeComment(c.id)}
                          aria-pressed={Boolean(c.user_liked)}
                          className={`flex items-center gap-1 transition-colors ${c.user_liked ? "text-rose-600" : "hover:text-rose-600"}`}
                        >
                          <Heart className={`h-3 w-3 ${c.user_liked ? "fill-rose-500" : ""}`} />
                          <span>J'aime{c.likes_count > 0 ? ` (${c.likes_count})` : ""}</span>
                        </button>
                        {canComment && (
                          <button type="button" onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)} className="hover:text-[#0E7C66] flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" /> Répondre
                          </button>
                        )}
                        {c.user_id === currentUserId && onDeleteComment && (
                          <button type="button" onClick={() => removeComment(c)} className="hover:text-rose-600 flex items-center gap-1">
                            <X className="h-3 w-3" /> Supprimer
                          </button>
                        )}
                      </div>
                    </div>

                    {replyingTo === c.id && (
                      <div className="pl-6 flex gap-2">
                        <Input
                          type="text"
                          autoFocus
                          placeholder={`Répondre à ${name}...`}
                          value={replyText}
                          maxLength={2000}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && submitComment(replyText, c.id)}
                          className="h-9 text-[11px] rounded-full bg-emerald-50/60 border-emerald-200 focus:bg-white"
                        />
                        <Button size="sm" onClick={() => submitComment(replyText, c.id)} disabled={!replyText.trim() || sending} className="h-9 px-3 rounded-full bg-[#0E7C66] text-white text-xs font-bold">
                          Répondre
                        </Button>
                      </div>
                    )}

                    {repliesOf(c.id).length > 0 && (
                      <div className="pl-6 space-y-2 border-l-2 border-emerald-100 ml-3">
                        {repliesOf(c.id).map((r) => (
                          <div key={r.id} className="bg-emerald-50/40 p-2.5 rounded-xl text-xs space-y-1 border border-emerald-100/60">
                            <div className="flex items-center justify-between gap-2 font-bold text-slate-900">
                              <button type="button" onClick={() => onOpenProfile?.(r.user_id)} className="hover:underline truncate text-left">
                                {r.author?.full_name || r.authorName || "Membre"}
                              </button>
                              <span className="text-[10px] text-slate-400 font-normal shrink-0">{timeAgo(r.created_at)}</span>
                            </div>
                            <p className="text-slate-700 break-words">{r.text}</p>
                            <div className="flex items-center gap-4 text-[11px] font-bold text-slate-500">
                              <button type="button" onClick={() => likeComment(r.id)} aria-pressed={Boolean(r.user_liked)} className={`flex items-center gap-1 ${r.user_liked ? "text-rose-600" : "hover:text-rose-600"}`}>
                                <Heart className={`h-3 w-3 ${r.user_liked ? "fill-rose-500" : ""}`} />
                                <span>J'aime{r.likes_count > 0 ? ` (${r.likes_count})` : ""}</span>
                              </button>
                              {r.user_id === currentUserId && onDeleteComment && (
                                <button type="button" onClick={() => removeComment(r)} className="hover:text-rose-600 flex items-center gap-1">
                                  <X className="h-3 w-3" /> Supprimer
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette publication ?</AlertDialogTitle>
            <AlertDialogDescription>Elle disparaîtra pour tout le monde, avec ses commentaires et ses j'aime. Cette action est définitive.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Annuler</AlertDialogCancel>
            <AlertDialogAction className="rounded-full bg-rose-600 hover:bg-rose-700" onClick={() => onDeletePost?.(post.id)}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {lightbox && (
        <div role="dialog" aria-label="Photo agrandie" onClick={() => setLightbox(null)} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <button type="button" onClick={() => setLightbox(null)} className="absolute top-4 right-4 bg-white text-slate-900 p-2 rounded-full shadow-lg" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
          <img src={lightbox} alt="" className="max-w-full max-h-[90vh] object-contain rounded-2xl" />
        </div>
      )}
    </Card>
  );
}
