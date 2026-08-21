import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ConnectUsProfile } from "../types/connectus.types";
import { readFileAsDataUrl } from "../utils/fileUploader";
import { Globe, Sparkles, User, Image as ImageIcon, Camera, CheckCircle2, ArrowRight, Upload } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface OnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ConnectUsProfile;
  onComplete: (updatedData: Partial<ConnectUsProfile>) => void;
}

export function OnboardingModal({
  open,
  onOpenChange,
  profile,
  onComplete,
}: OnboardingModalProps) {
  const [fullName, setFullName] = useState(profile.full_name || "");
  const [username, setUsername] = useState(profile.username || "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || "");
  const [coverUrl, setCoverUrl] = useState(profile.cover_url || "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&auto=format&fit=crop&q=80");
  const [bio, setBio] = useState(profile.bio || "");
  const [uploading, setUploading] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAvatarUrl(dataUrl);
      toast({ title: "Photo de profil sélectionnée ✓" });
    } catch (err) {
      toast({ title: "Erreur lors de la lecture de l'image", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleCoverFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setCoverUrl(dataUrl);
      toast({ title: "Photo de couverture sélectionnée ✓" });
    } catch (err) {
      toast({ title: "Erreur lors de la lecture de l'image", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleFinish = () => {
    if (!fullName.trim()) {
      toast({ title: "Veuillez préciser votre nom", variant: "destructive" });
      return;
    }

    const cleanUsername = (username || fullName).toLowerCase().replace(/[^a-z0-9_]/g, "_");

    onComplete({
      full_name: fullName.trim(),
      username: cleanUsername,
      avatar_url: avatarUrl || null,
      cover_url: coverUrl || null,
      bio: bio.trim(),
      is_onboarded: true,
    });

    toast({
      title: "Bienvenue sur ConnectUs ! 🚀",
      description: "Votre profil social est prêt à l'emploi.",
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl p-6 overflow-hidden">
        <DialogHeader className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#0E7C66] to-emerald-400 text-white flex items-center justify-center shadow-md">
            <Globe className="h-6 w-6 animate-pulse" />
          </div>
          <DialogTitle className="font-space text-xl font-bold text-slate-900">
            Bienvenue sur ConnectUs ! 🌐
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Importez directement une photo de profil et de couverture depuis votre appareil.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Cover & Avatar Upload Preview Box */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 h-36">
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
            
            {/* Button to import cover from phone/PC */}
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="absolute top-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white font-bold text-[11px] px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md"
            >
              <Upload className="h-3.5 w-3.5" /> Importer Couverture
            </button>
            <input
              type="file"
              ref={coverInputRef}
              onChange={handleCoverFileSelect}
              accept="image/*"
              className="hidden"
            />

            {/* Avatar Circle with Upload Trigger */}
            <div className="absolute bottom-2 left-4 flex items-center gap-3">
              <div className="relative h-16 w-16 rounded-2xl bg-white border-2 border-white overflow-hidden shadow-md group">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-[#0E7C66] text-white font-bold flex items-center justify-center text-xl">
                    {(fullName || "U")[0]?.toUpperCase()}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Importer photo de profil"
                >
                  <Camera className="h-5 w-5" />
                </button>
              </div>
              <input
                type="file"
                ref={avatarInputRef}
                onChange={handleAvatarFileSelect}
                accept="image/*"
                className="hidden"
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => avatarInputRef.current?.click()}
                className="rounded-full bg-white/90 text-slate-800 text-xs font-bold h-8 px-3 gap-1 shadow-sm"
              >
                <Camera className="h-3.5 w-3.5" /> Importer Photo Profil
              </Button>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">Votre Nom Complet :</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Koffi Mensah"
                  className="text-xs rounded-xl h-9 mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Nom d'utilisateur (@handle) :</Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ex: koffi_fashion"
                  className="text-xs rounded-xl h-9 mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Biographie ConnectUs :</Label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Présentez-vous ou parlez de votre activité e-commerce..."
                className="text-xs rounded-xl min-h-[60px] resize-none mt-1"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleFinish}
            disabled={uploading}
            className="w-full rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-extrabold text-xs h-10 shadow-md gap-2"
          >
            <span>Explorer ConnectUs</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
