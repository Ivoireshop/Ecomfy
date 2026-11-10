import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "./CUButton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AttachedProduct, VisibilityType } from "../types/connectus.types";
import { parseUrlMetadata, extractUrlsFromText, LinkMetadata } from "../utils/linkScraper";
import {
  Image as ImageIcon, ShoppingBag, Globe, Users, X, Sparkles, Loader2, Video, Link2,
} from "lucide-react";
import { ConnectUsService } from "../services/connectus.service";
import { toast } from "@/hooks/use-toast";

interface PickedFile {
  file: File;
  url: string;
}

const MAX_PHOTOS = 6;

interface CreatePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onSubmit: (postData: {
    content: string;
    media_urls: string[];
    video_url?: string | null;
    link_preview?: LinkMetadata | null;
    attached_product?: AttachedProduct | null;
    visibility: VisibilityType;
  }) => Promise<unknown>;
  merchantProducts: AttachedProduct[];
  submitting?: boolean;
}

export function CreatePostModal({
  open,
  onOpenChange,
  userId,
  onSubmit,
  merchantProducts,
  submitting = false,
}: CreatePostModalProps) {
  const [content, setContent] = useState("");
  const [images, setImages] = useState<PickedFile[]>([]);
  const [video, setVideo] = useState<PickedFile | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<AttachedProduct | null>(null);
  const [linkPreview, setLinkPreview] = useState<LinkMetadata | null>(null);
  const [dismissedLink, setDismissedLink] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<VisibilityType>("public");
  const [uploading, setUploading] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Aperçu automatique du premier lien saisi (sauf s'il a été écarté)
  useEffect(() => {
    const urls = extractUrlsFromText(content);
    if (urls.length > 0 && urls[0] !== dismissedLink) {
      setLinkPreview(parseUrlMetadata(urls[0]));
    } else {
      setLinkPreview(null);
    }
  }, [content, dismissedLink]);

  const resetForm = () => {
    images.forEach((i) => URL.revokeObjectURL(i.url));
    if (video) URL.revokeObjectURL(video.url);
    setContent("");
    setImages([]);
    setVideo(null);
    setSelectedProduct(null);
    setLinkPreview(null);
    setDismissedLink(null);
    setVisibility("public");
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    const valid = files.filter((f) => f.type.startsWith("image/"));
    if (valid.length < files.length) {
      toast({ title: "Certains fichiers ne sont pas des images", description: "Seuls les formats JPG, PNG, WebP ou GIF sont acceptés.", variant: "destructive" });
    }
    const room = MAX_PHOTOS - images.length;
    if (valid.length > room) {
      toast({ title: `${MAX_PHOTOS} photos maximum par publication`, variant: "destructive" });
    }
    setImages((prev) => [...prev, ...valid.slice(0, Math.max(0, room)).map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };

  const handleVideoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast({ title: "Ce fichier n'est pas une vidéo", variant: "destructive" });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "Vidéo trop lourde", description: "50 Mo maximum.", variant: "destructive" });
      return;
    }
    if (video) URL.revokeObjectURL(video.url);
    setVideo({ file, url: URL.createObjectURL(file) });
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const isEmpty = !content.trim() && images.length === 0 && !selectedProduct && !video && !linkPreview;
  const busy = submitting || uploading;

  const handleSubmit = async () => {
    if (isEmpty || busy) return;
    setUploading(true);
    let mediaUrls: string[] = [];
    let videoUrl: string | null = null;
    try {
      mediaUrls = await Promise.all(images.map((i) => ConnectUsService.uploadMedia(userId, i.file)));
      videoUrl = video ? await ConnectUsService.uploadMedia(userId, video.file) : null;
    } catch (err) {
      setUploading(false);
      toast({ title: "Envoi des fichiers impossible", description: err instanceof Error ? err.message : "Réessayez.", variant: "destructive" });
      return;
    }
    setUploading(false);

    const result = await onSubmit({
      content: content.trim(),
      media_urls: mediaUrls,
      video_url: videoUrl,
      link_preview: linkPreview,
      attached_product: selectedProduct,
      visibility,
    });
    if (result) {
      resetForm();
      onOpenChange(false);
    }
  };

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const EMOJI_LIST = [
    "😊", "😂", "❤️", "🔥", "👍", "🎉", "🚀", "😍", "🙏", "💰",
    "🛍️", "🛒", "🌟", "📦", "👏", "💪", "✨", "💯", "💡", "🙌",
    "⚡", "🤝", "💬", "📱", "📸", "🎥", "🏆", "🎯", "📌", "✅"
  ];

  const handleInsertBold = () => {
    if (!textareaRef.current) {
      setContent(prev => prev + " **texte en gras** ");
      return;
    }
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    if (selectedText) {
      const newText = content.substring(0, start) + `**${selectedText}**` + content.substring(end);
      setContent(newText);
    } else {
      const newText = content.substring(0, start) + " **texte en gras** " + content.substring(end);
      setContent(newText);
    }
  };

  const handleSelectEmoji = (emoji: string) => {
    setContent(prev => prev + emoji);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-space text-lg text-slate-900">
            <Sparkles className="h-5 w-5 text-[#0E7C66]" />
            Créer une publication ConnectUs
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">Texte, photos, vidéo, lien ou produit de votre boutique.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Rich Editing Toolbar (Bold & Emojis) */}
          <div className="flex items-center justify-between bg-slate-100/80 px-3 py-1.5 rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleInsertBold}
                className="h-7 px-2 font-black text-slate-700 hover:bg-slate-200 rounded-lg"
                title="Mettre en gras (**texte**)"
              >
                <span className="font-extrabold text-sm">B</span>
              </Button>

              <div className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="h-7 px-2 text-slate-700 hover:bg-slate-200 rounded-lg flex items-center gap-1 font-bold text-xs"
                >
                  <span>😊</span>
                  <span>Emojis</span>
                </Button>

                {/* Emojis Selector Grid Popover */}
                {showEmojiPicker && (
                  <div className="absolute top-9 left-0 z-50 p-2.5 bg-white rounded-2xl border border-slate-200 shadow-xl grid grid-cols-6 gap-1.5 w-64 animate-in fade-in zoom-in-95">
                    {EMOJI_LIST.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          handleSelectEmoji(emoji);
                        }}
                        className="h-8 w-8 text-base flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Unicode & Markdown pris en charge</span>
          </div>

          {/* Post Content Input */}
          <Textarea
            ref={textareaRef}
            placeholder="Que voulez-vous partager ? (Textes, liens web, photos, vidéos, produits...)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[110px] rounded-2xl bg-slate-50 border-slate-200 text-xs focus:bg-white resize-none"
          />

          {/* Auto-detected Web Link Preview */}
          {linkPreview && (
            <div className="p-3 rounded-2xl bg-slate-100/90 border border-slate-200 space-y-1.5 relative">
              <button
                type="button"
                onClick={() => setDismissedLink(linkPreview.url)}
                aria-label="Retirer l'aperçu du lien"
                className="absolute top-2 right-2 p-1 bg-slate-200 hover:bg-slate-300 rounded-full text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#0E7C66] uppercase tracking-wider">
                <Link2 className="h-3.5 w-3.5" /> Aperçu du lien ({linkPreview.domain})
              </div>
              <p className="font-bold text-xs text-slate-900">{linkPreview.title}</p>
              {linkPreview.description && (
                <p className="text-[11px] text-slate-600 line-clamp-2">{linkPreview.description}</p>
              )}
            </div>
          )}

          {/* Added Media Preview */}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {images.map((img, idx) => (
                <div key={img.url} className="relative h-16 w-16 rounded-xl overflow-hidden border border-slate-200">
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(idx)}
                    aria-label="Retirer la photo"
                    className="absolute top-1 right-1 bg-slate-900/80 text-white rounded-full p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Direct File Picker Buttons for Phone & PC */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => imageInputRef.current?.click()}
              className="rounded-xl text-xs font-bold gap-1.5 flex-1"
            >
              <ImageIcon className="h-4 w-4 text-[#0E7C66]" /> Importer Photo(s)
            </Button>
            <input
              type="file"
              ref={imageInputRef}
              onChange={handleImageFileSelect}
              accept="image/*"
              multiple
              className="hidden"
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => videoInputRef.current?.click()}
              className="rounded-xl text-xs font-bold gap-1.5 flex-1"
            >
              <Video className="h-4 w-4 text-purple-600" /> Importer Vidéo
            </Button>
            <input
              type="file"
              ref={videoInputRef}
              onChange={handleVideoFileSelect}
              accept="video/*"
              className="hidden"
            />
          </div>

          {video && (
            <div className="p-2 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-purple-900 flex items-center gap-1.5 min-w-0">
                <Video className="h-4 w-4 shrink-0" /> <span className="truncate">{video.file.name}</span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  URL.revokeObjectURL(video.url);
                  setVideo(null);
                }}
                className="h-6 text-[10px] text-rose-500 shrink-0"
              >
                Retirer
              </Button>
            </div>
          )}

          {/* Attached Ecomfy Product Selector */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ShoppingBag className="h-4 w-4 text-[#0E7C66]" />
                Attacher un produit Ecomfy (Social Commerce)
              </Label>
              {selectedProduct && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProduct(null)}
                  className="h-6 text-[10px] text-rose-500 px-2"
                >
                  Retirer
                </Button>
              )}
            </div>

            {selectedProduct ? (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                <div className="h-10 w-10 rounded-xl bg-white overflow-hidden shrink-0">
                  {selectedProduct.image_url && <img src={selectedProduct.image_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs text-slate-900 truncate">{selectedProduct.name}</p>
                  <p className="text-xs font-extrabold text-[#0E7C66]">
                    {selectedProduct.price.toLocaleString("fr-FR")} FCFA
                  </p>
                </div>
                <Badge className="bg-emerald-600 text-white text-[10px]">Attaché</Badge>
              </div>
            ) : merchantProducts.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-1">
                {merchantProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProduct(p)}
                    className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 hover:border-[#0E7C66] bg-white text-left transition-all"
                  >
                    <div className="h-8 w-8 rounded-lg bg-slate-100 overflow-hidden shrink-0">
                      {p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-slate-900 truncate">{p.name}</p>
                      <p className="text-[9px] text-slate-500">{p.price.toLocaleString("fr-FR")} FCFA</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-slate-400 italic">
                Aucun article publié sur votre boutique Ecomfy.
              </p>
            )}
          </div>

          {/* Visibility Controls */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="font-semibold text-slate-600">Visibilité :</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setVisibility("public")}
                className={`px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 transition-all ${
                  visibility === "public" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                <Globe className="h-3.5 w-3.5" /> Public
              </button>
              <button
                type="button"
                onClick={() => setVisibility("followers")}
                className={`px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 transition-all ${
                  visibility === "followers" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                <Users className="h-3.5 w-3.5" /> Abonnés
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" className="rounded-full text-xs font-bold" onClick={() => onOpenChange(false)} disabled={busy}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={busy || isEmpty}
            className="rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold px-6 text-xs shadow-md"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> {uploading ? "Envoi des fichiers…" : "Publication…"}
              </>
            ) : (
              "Publier sur ConnectUs"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
