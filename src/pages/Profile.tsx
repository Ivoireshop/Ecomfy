import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, ArrowLeft, X } from "lucide-react";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

const getInitials = (name: string | null | undefined, email: string | null | undefined) => {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
};

const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      setUserId(user.id);
      setEmail(user.email ?? null);
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setFullName(data.full_name ?? "");
        setAvatarUrl(data.avatar_url ?? null);
      }
      setLoading(false);
    })();
  }, [navigate]);

  useEffect(() => {
    if (!pendingFile) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toast({ title: "Format non supporté", description: "Utilisez JPG, PNG ou WEBP.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_SIZE) {
      toast({ title: "Image trop lourde", description: "Maximum 5 Mo.", variant: "destructive" });
      return;
    }
    setPendingFile(file);
  };

  const clearPending = () => {
    setPendingFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      let nextAvatarUrl = avatarUrl;
      if (pendingFile) {
        const ext = pendingFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `avatars/${userId}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("shop-images")
          .upload(path, pendingFile, { upsert: true, contentType: pendingFile.type });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("shop-images").getPublicUrl(path);
        nextAvatarUrl = urlData.publicUrl;
      }
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() || null, avatar_url: nextAvatarUrl })
        .eq("id", userId);
      if (error) throw error;
      setAvatarUrl(nextAvatarUrl);
      clearPending();
      toast({ title: "Profil mis à jour" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message ?? "Impossible d'enregistrer.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const displayUrl = previewUrl ?? avatarUrl ?? undefined;

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Enregistrer
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Mon profil</CardTitle>
            <CardDescription>
              Votre photo apparaît dans le classement des meilleurs vendeurs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-32 w-32 ring-2 ring-border">
                <AvatarImage src={displayUrl} alt={fullName || email || "Avatar"} />
                <AvatarFallback className="text-2xl font-semibold">
                  {getInitials(fullName, email)}
                </AvatarFallback>
              </Avatar>

              {pendingFile && (
                <p className="text-xs text-muted-foreground">
                  Aperçu — non enregistré
                </p>
              )}

              <div className="flex gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePick}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {avatarUrl || pendingFile ? "Changer la photo" : "Téléverser une photo"}
                </Button>
                {pendingFile && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearPending}>
                    <X className="h-4 w-4 mr-2" /> Annuler
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                JPG, PNG ou WEBP — 5 Mo maximum.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Nom complet</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Votre nom"
                maxLength={80}
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email ?? ""} disabled />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;