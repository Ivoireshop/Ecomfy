import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "./CUButton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ConnectUsProfile } from "../types/connectus.types";
import { ConnectUsService } from "../services/connectus.service";
import { Globe, Camera, ArrowRight, Upload, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface OnboardingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ConnectUsProfile;
  onComplete: (updatedData: Partial<ConnectUsProfile>, options?: { silent?: boolean }) => Promise<unknown>;
}

interface Picked {
  file: File;
  preview: string;
}

export function OnboardingModal({ open, onOpenChange, profile, onComplete }: OnboardingModalProps) {
  const [fullName, setFullName] = useState(profile.full_name || "");
  const [username, setUsername] = useState(profile.username || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [avatar, setAvatar] = useState<Picked | null>(null);
  const [cover, setCover] = useState<Picked | null>(null);
  const [saving, setSaving] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Le profil est chargé après le premier rendu : on recopie ses valeurs à l'ouverture.
  useEffect(() => {
    if (!open) return;
    setFullName(profile.full_name || "");
    setUsername(profile.username || "");
    setBio(profile.bio || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profile.user_id]);

  useEffect(
    () => () => {
      if (avatar) URL.revokeObjectURL(avatar.preview);
      if (cover) URL.revokeObjectURL(cover.preview);
    },
    [avatar, cover]
  );

  const pickImage = (setter: (p: Picked) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Choisissez une image (JPG, PNG ou WebP)", variant: "destructive" });
      return;
    }
    setter({ file, preview: URL.createObjectURL(file) });
  };

  const handleFinish = async () => {
    if (!fullName.trim()) {
      toast({ title: "Veuillez indiquer votre nom", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const [avatarUrl, coverUrl] = await Promise.all([
        avatar ? ConnectUsService.uploadMedia(profile.user_id, avatar.file) : Promise.resolve(profile.avatar_url),
        cover ? ConnectUsService.uploadMedia(profile.user_id, cover.file) : Promise.resolve(profile.cover_url),
      ]);
      const saved = await onComplete({
        full_name: fullName.trim(),
        username: (username || fullName).toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        avatar_url: avatarUrl,
        cover_url: coverUrl,
        bio: bio.trim(),
        is_onboarded: true,
      });
      if (saved) {
        toast({ title: "Bienvenue sur ConnectUs 🚀", description: "Votre profil est prêt." });
        onOpenChange(false);
      }
    } catch (e) {
      toast({ title: "Enregistrement impossible", description: e instanceof Error ? e.message : "Réessayez.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLater = async () => {
    // « Plus tard » : on ne redemande plus, les informations restent modifiables depuis le profil.
    await onComplete({ is_onboarded: true }, { silent: true });
    onOpenChange(false);
  };

  const coverSrc = cover?.preview || profile.cover_url;
  const avatarSrc = avatar?.preview || profile.avatar_url;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleLater())}>
      <DialogContent className="max-w-lg rounded-3xl p-6 max-h-[92vh] overflow-y-auto">
        <DialogHeader className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#0E7C66] to-emerald-400 text-white flex items-center justify-center shadow-md">
            <Globe className="h-6 w-6" />
          </div>
          <DialogTitle className="font-space text-xl font-bold text-slate-900">Bienvenue sur ConnectUs</DialogTitle>
          <DialogDescription className="text-xs text-slate-500">Personnalisez votre profil : photo, couverture, nom et présentation.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-gradient-to-r from-[#0E7C66] via-teal-600 to-emerald-700 h-36">
            {coverSrc && <img src={coverSrc} alt="" className="h-full w-full object-cover" />}
            <button type="button" onClick={() => coverInputRef.current?.click()} className="absolute top-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white font-bold text-[11px] px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <Upload className="h-3.5 w-3.5" /> Couverture
            </button>
            <input type="file" ref={coverInputRef} onChange={pickImage(setCover)} accept="image/*" className="hidden" />

            <div className="absolute bottom-2 left-4 flex items-center gap-3">
              <button type="button" onClick={() => avatarInputRef.current?.click()} aria-label="Choisir une photo de profil" className="relative h-16 w-16 rounded-2xl bg-white border-2 border-white overflow-hidden shadow-md">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="h-full w-full bg-[#0E7C66] text-white font-bold flex items-center justify-center text-xl">{(fullName || "U")[0]?.toUpperCase()}</span>
                )}
                <span className="absolute inset-0 bg-slate-900/50 text-white flex items-center justify-center">
                  <Camera className="h-5 w-5" />
                </span>
              </button>
              <input type="file" ref={avatarInputRef} onChange={pickImage(setAvatar)} accept="image/*" className="hidden" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="onb-name" className="text-xs font-bold text-slate-700">Nom complet</Label>
              <Input id="onb-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Votre nom" maxLength={80} className="text-xs rounded-xl h-10 mt-1" />
            </div>
            <div>
              <Label htmlFor="onb-username" className="text-xs font-bold text-slate-700">Identifiant (@)</Label>
              <Input id="onb-username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="votre_identifiant" maxLength={30} className="text-xs rounded-xl h-10 mt-1" />
            </div>
          </div>

          <div>
            <Label htmlFor="onb-bio" className="text-xs font-bold text-slate-700">Présentation</Label>
            <Textarea id="onb-bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Parlez de vous ou de votre activité…" maxLength={300} className="text-xs rounded-xl min-h-[64px] resize-none mt-1" />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button type="button" variant="ghost" onClick={handleLater} disabled={saving} className="rounded-full text-xs font-bold">
            Plus tard
          </Button>
          <Button onClick={handleFinish} disabled={saving} className="rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-extrabold text-xs h-10 px-6 gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>Entrer dans ConnectUs</span>
            {!saving && <ArrowRight className="h-4 w-4" />}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
