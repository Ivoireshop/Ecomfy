import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Image as ImageIcon, Video, X, Upload, Loader2, Check } from "lucide-react";
import { readFileAsDataUrl } from "../utils/fileUploader";
import { toast } from "@/hooks/use-toast";

interface CreateStoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitStory: (mediaUrl: string, mediaType: "image" | "video", caption?: string) => Promise<boolean>;
}

export function CreateStoryModal({
  open,
  onOpenChange,
  onSubmitStory,
}: CreateStoryModalProps) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast({ title: "Fichier trop lourd", description: "L'image ne doit pas dépasser 15 Mo", variant: "destructive" });
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setMediaUrl(dataUrl);
      setMediaType("image");
      toast({ title: "Photo sélectionnée ✓", description: "Vérifiez l'aperçu avant de publier." });
    } catch (err) {
      toast({ title: "Erreur lors du chargement de l'image", variant: "destructive" });
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 30 * 1024 * 1024) {
      toast({ title: "Vidéo trop lourde", description: "La vidéo ne doit pas dépasser 30 Mo", variant: "destructive" });
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setMediaUrl(dataUrl);
      setMediaType("video");
      toast({ title: "Vidéo sélectionnée ✓", description: "Vérifiez l'aperçu avant de publier." });
    } catch (err) {
      toast({ title: "Erreur lors du chargement de la vidéo", variant: "destructive" });
    }
  };

  const handleSubmit = async () => {
    if (!mediaUrl) return;
    setSubmitting(true);
    const success = await onSubmitStory(mediaUrl, mediaType, caption.trim() || undefined);
    setSubmitting(false);
    if (success) {
      setMediaUrl(null);
      setCaption("");
      onOpenChange(false);
      toast({
        title: "Story publiée avec succès ! 🎉",
        description: "Elle sera disponible pendant 24 heures sur votre profil ConnectUs.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-space text-lg text-slate-900">
            <Sparkles className="h-5 w-5 text-[#0E7C66]" />
            Créer une Story ConnectUs (24h)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File Picker Selection Buttons */}
          {!mediaUrl ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Choisissez une photo ou une vidéo depuis votre appareil (ordinateur ou smartphone). Elle restera visible 24 heures.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:border-[#0E7C66] transition-all gap-2 text-center"
                >
                  <div className="h-10 w-10 rounded-full bg-[#0E7C66] text-white flex items-center justify-center shadow-xs">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">Ajouter Photo</span>
                  <span className="text-[10px] text-slate-500">JPG, PNG, WebP</span>
                </button>
                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-5 rounded-2xl border-2 border-dashed border-purple-200 bg-purple-50/50 hover:bg-purple-50 hover:border-purple-600 transition-all gap-2 text-center"
                >
                  <div className="h-10 w-10 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xs">
                    <Video className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">Ajouter Vidéo</span>
                  <span className="text-[10px] text-slate-500">MP4, WebM (Max 30Mo)</span>
                </button>
                <input
                  type="file"
                  ref={videoInputRef}
                  onChange={handleVideoSelect}
                  accept="video/*"
                  className="hidden"
                />
              </div>
            </div>
          ) : (
            /* Story Preview Before Publication */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge className="bg-[#0E7C66] text-white text-[10px] uppercase font-bold tracking-wider">
                  Aperçu de votre Story
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setMediaUrl(null)}
                  className="h-7 text-xs font-bold text-rose-600 hover:bg-rose-50"
                >
                  Changer de fichier
                </Button>
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-[9/14] flex items-center justify-center max-h-[380px] shadow-md border border-slate-800">
                {mediaType === "image" ? (
                  <img src={mediaUrl} alt="Aperçu Story" className="h-full w-full object-contain" />
                ) : (
                  <video src={mediaUrl} controls autoPlay loop className="h-full w-full object-contain" />
                )}

                {caption && (
                  <div className="absolute bottom-3 left-3 right-3 bg-black/70 backdrop-blur-xs text-white p-2.5 rounded-xl text-xs font-semibold text-center border border-white/10">
                    {caption}
                  </div>
                )}
              </div>

              {/* Optional Caption Input */}
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700">Légende (optionnelle)</Label>
                <Input
                  type="text"
                  placeholder="Écrire un message court sur votre story..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="h-9 text-xs rounded-xl bg-slate-50 border-slate-200 focus:bg-white"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t border-slate-100">
          <Button variant="ghost" className="rounded-full text-xs font-bold" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!mediaUrl || submitting}
            className="rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold px-6 text-xs shadow-md"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Publier la Story 🚀"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
