import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AttachedProduct, VisibilityType } from "../types/connectus.types";
import { parseUrlMetadata, extractUrlsFromText, LinkMetadata } from "../utils/linkScraper";
import { readFileAsDataUrl } from "../utils/fileUploader";
import {
  Image as ImageIcon, ShoppingBag, Globe, Users, Lock, X, Plus, Sparkles, Loader2, Check, Video, Link2, ExternalLink, Upload
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CreatePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (postData: {
    content: string;
    media_urls: string[];
    video_url?: string | null;
    link_preview?: LinkMetadata | null;
    attached_product?: AttachedProduct | null;
    visibility: VisibilityType;
  }) => Promise<any>;
  merchantProducts: AttachedProduct[];
  submitting?: boolean;
}

export function CreatePostModal({
  open,
  onOpenChange,
  onSubmit,
  merchantProducts,
  submitting = false,
}: CreatePostModalProps) {
  const [content, setContent] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<AttachedProduct | null>(null);
  const [linkPreview, setLinkPreview] = useState<LinkMetadata | null>(null);
  const [visibility, setVisibility] = useState<VisibilityType>("public");

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Auto detect links in content text
  useEffect(() => {
    const urls = extractUrlsFromText(content);
    if (urls.length > 0) {
      const extracted = parseUrlMetadata(urls[0], content);
      setLinkPreview(extracted);
    } else {
      setLinkPreview(null);
    }
  }, [content]);

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    try {
      for (const file of files) {
        const dataUrl = await readFileAsDataUrl(file);
        setMediaUrls(prev => [...prev, dataUrl]);
      }
      toast({ title: `${files.length} photo(s) ajoutée(s) ✓` });
    } catch (err) {
      toast({ title: "Erreur lors de l'importation", variant: "destructive" });
    }
  };

  const handleVideoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setVideoUrl(dataUrl);
      toast({ title: "Vidéo importée ✓" });
    } catch (err) {
      toast({ title: "Erreur lors de l'importation de la vidéo", variant: "destructive" });
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMediaUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!content.trim() && mediaUrls.length === 0 && !selectedProduct && !videoUrl && !linkPreview) return;
    const result = await onSubmit({
      content: content.trim(),
      media_urls: mediaUrls,
      video_url: videoUrl.trim() || null,
      link_preview: linkPreview,
      attached_product: selectedProduct,
      visibility,
    });
    if (result) {
      setContent("");
      setMediaUrls([]);
      setVideoUrl("");
      setSelectedProduct(null);
      setLinkPreview(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-space text-lg text-slate-900">
            <Sparkles className="h-5 w-5 text-[#0E7C66]" />
            Créer une publication ConnectUs
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Post Content Input */}
          <Textarea
            placeholder="Que voulez-vous partager ? (Textes, liens web, photos, vidéos, produits...)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[100px] rounded-2xl bg-slate-50 border-slate-200 text-xs focus:bg-white resize-none"
          />

          {/* Auto-detected Web Link Preview */}
          {linkPreview && (
            <div className="p-3 rounded-2xl bg-slate-100/90 border border-slate-200 space-y-1.5 relative">
              <button
                type="button"
                onClick={() => setLinkPreview(null)}
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
          {mediaUrls.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {mediaUrls.map((url, idx) => (
                <div key={idx} className="relative h-16 w-16 rounded-xl overflow-hidden border border-slate-200">
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => handleRemoveMedia(idx)}
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

          {videoUrl && (
            <div className="p-2 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-between text-xs">
              <span className="font-bold text-purple-900 flex items-center gap-1.5">
                <Video className="h-4 w-4" /> Vidéo sélectionnée
              </span>
              <Button size="sm" variant="ghost" onClick={() => setVideoUrl("")} className="h-6 text-[10px] text-rose-500">
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
          <Button variant="ghost" className="rounded-full text-xs font-bold" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || (!content.trim() && mediaUrls.length === 0 && !selectedProduct && !videoUrl && !linkPreview)}
            className="rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold px-6 text-xs shadow-md"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Publier sur ConnectUs"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
