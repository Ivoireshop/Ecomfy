import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "./CUButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Image as ImageIcon, Video, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CreateStoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitStory: (file: File, mediaType: "image" | "video", caption?: string) => Promise<boolean>;
}

const MAX_IMAGE = 15 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;

export function CreateStoryModal({ open, onOpenChange, onSubmitStory }: CreateStoryModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setCaption("");
  };

  const pick = (kind: "image" | "video") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (!picked.type.startsWith(`${kind}/`)) {
      toast({ title: "Format non pris en charge", description: kind === "image" ? "Choisissez une photo JPG, PNG ou WebP." : "Choisissez une vidéo MP4 ou WebM.", variant: "destructive" });
      return;
    }
    const max = kind === "image" ? MAX_IMAGE : MAX_VIDEO;
    if (picked.size > max) {
      toast({ title: "Fichier trop lourd", description: `${kind === "image" ? "La photo" : "La vidéo"} ne doit pas dépasser ${max / 1024 / 1024} Mo.`, variant: "destructive" });
      return;
    }
    setFile(picked);
    setMediaType(kind);
    setPreviewUrl(URL.createObjectURL(picked));
  };

  const handleSubmit = async () => {
    if (!file) return;
    setSubmitting(true);
    const ok = await onSubmitStory(file, mediaType, caption.trim() || undefined);
    setSubmitting(false);
    if (ok) {
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-space text-lg text-slate-900">
            <Sparkles className="h-5 w-5 text-[#0E7C66]" /> Créer une story (24 h)
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">Une photo ou une vidéo, visible 24 heures par la communauté.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!previewUrl ? (
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => imageInputRef.current?.click()} className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-[#0E7C66] transition-all gap-2 text-center">
                <span className="h-10 w-10 rounded-full bg-[#0E7C66] text-white flex items-center justify-center"><ImageIcon className="h-5 w-5" /></span>
                <span className="text-xs font-bold text-slate-900">Ajouter une photo</span>
                <span className="text-[10px] text-slate-500">JPG, PNG, WebP</span>
              </button>
              <input type="file" ref={imageInputRef} onChange={pick("image")} accept="image/*" className="hidden" />

              <button type="button" onClick={() => videoInputRef.current?.click()} className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50/50 hover:bg-purple-50 hover:border-purple-600 transition-all gap-2 text-center">
                <span className="h-10 w-10 rounded-full bg-purple-600 text-white flex items-center justify-center"><Video className="h-5 w-5" /></span>
                <span className="text-xs font-bold text-slate-900">Ajouter une vidéo</span>
                <span className="text-[10px] text-slate-500">MP4, WebM (50 Mo max)</span>
              </button>
              <input type="file" ref={videoInputRef} onChange={pick("video")} accept="video/*" className="hidden" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge className="bg-[#0E7C66] text-white text-[10px] uppercase font-bold tracking-wider">Aperçu</Badge>
                <Button size="sm" variant="ghost" onClick={reset} className="h-7 text-xs font-bold text-rose-600 hover:bg-rose-50">Changer de fichier</Button>
              </div>
              <div className="rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center max-h-[380px] border border-slate-800">
                {mediaType === "image" ? (
                  <img src={previewUrl} alt="Aperçu de la story" className="max-h-[380px] w-full object-contain" />
                ) : (
                  <video src={previewUrl} controls muted playsInline className="max-h-[380px] w-full object-contain" />
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="story-caption" className="text-xs font-bold text-slate-700">Légende (facultative)</Label>
                <Input id="story-caption" type="text" maxLength={140} placeholder="Un mot sur votre story…" value={caption} onChange={(e) => setCaption(e.target.value)} className="h-10 text-xs rounded-xl bg-slate-50 border-slate-200 focus:bg-white" />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t border-slate-100">
          <Button variant="ghost" className="rounded-full text-xs font-bold" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={!file || submitting} className="rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold px-6 text-xs">
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Envoi…</> : "Publier la story"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
