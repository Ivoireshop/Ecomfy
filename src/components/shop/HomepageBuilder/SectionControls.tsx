import React, { useState } from "react";
import { HomepageSection, SectionType } from "./types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { prepareImageForUpload } from "@/lib/imageCompress";
import { toast } from "@/hooks/use-toast";
import {
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  Upload,
  Loader2,
  Image as ImageIcon,
  CheckCircle2,
  X,
  Palette,
  Type,
  LayoutGrid,
  Video,
  ShoppingBag,
  Mic,
} from "lucide-react";

interface SectionControlsProps {
  section: HomepageSection;
  onChange: (updatedSection: HomepageSection) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  categories?: string[];
  products?: any[];
  shopId?: string;
}

const ImageUploadField: React.FC<{
  label: string;
  value?: string;
  onChange: (url: string) => void;
  shopId?: string;
}> = ({ label, value, onChange, shopId }) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await prepareImageForUpload(file);
      if (!res.ok) {
        toast({
          title: "Format non supporté",
          description: res.reason,
          variant: "destructive",
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      const userFolder = user?.id || shopId || "common";
      const fileToUpload = res.file;
      const ext = fileToUpload.name.split(".").pop() || "jpg";
      const path = `${userFolder}/homepage/${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 7)}.${ext}`;

      const { error } = await supabase.storage
        .from("shop-images")
        .upload(path, fileToUpload, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage.from("shop-images").getPublicUrl(path);
      if (data?.publicUrl) {
        onChange(data.publicUrl);
        toast({ title: "Image téléversée ✓", description: "L'image a été importée et ajoutée." });
      }
    } catch (err: any) {
      console.error("Image upload failed", err);
      toast({
        title: "Échec du téléversement",
        description: err.message || "Vérifiez votre fichier image puis réessayez.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-slate-700">{label}</Label>

      {value ? (
        <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50 p-2 flex items-center gap-3">
          <img src={value} alt="" className="w-14 h-14 rounded-lg object-cover border shrink-0 bg-white" />
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-medium text-slate-600 block truncate">Image configurée</span>
            <span className="text-[10px] text-slate-400 block truncate">{value}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded-lg shrink-0"
            onClick={() => onChange("")}
            title="Supprimer l'image"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 border-dashed border-2 border-slate-300 hover:border-[#0E7C66] text-slate-700 bg-slate-50 hover:bg-[#0E7C66]/5 rounded-xl font-medium text-xs gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#0E7C66]" />
                <span>Importation depuis l'appareil...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 text-[#0E7C66]" />
                <span>Importer une image (Galerie / PC)</span>
              </>
            )}
          </Button>

          <Input
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ou coller une URL d'image (ex: https://...)"
            className="text-xs h-8 font-mono bg-white"
          />
        </div>
      )}
    </div>
  );
};

const VideoUploadField: React.FC<{
  label: string;
  value?: string;
  onChange: (url: string) => void;
  shopId?: string;
}> = ({ label, value, onChange, shopId }) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/") && !/\.(mp4|webm|mov|m4v)$/i.test(file.name)) {
      toast({ title: "Fichier invalide", description: "Veuillez sélectionner un fichier vidéo (MP4, WEBM).", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userFolder = user?.id || shopId || "common";
      const ext = file.name.split(".").pop() || "mp4";
      const path = `${userFolder}/homepage/videos/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;

      const { error } = await supabase.storage
        .from("shop-images")
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage.from("shop-images").getPublicUrl(path);
      if (data?.publicUrl) {
        onChange(data.publicUrl);
        toast({ title: "Vidéo téléversée ✓", description: "La vidéo a été ajoutée avec succès." });
      }
    } catch (err: any) {
      console.error("Video upload failed", err);
      toast({ title: "Échec du téléversement", description: err.message || "Impossible d'importer la vidéo.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-slate-700">{label}</Label>
      {value ? (
        <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-900 p-2 flex items-center gap-3 text-white">
          <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
            <Video className="w-5 h-5 text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-medium text-slate-200 block truncate">Vidéo configurée</span>
            <span className="text-[10px] text-slate-400 block truncate">{value}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-rose-400 hover:bg-rose-900/50 rounded-lg shrink-0"
            onClick={() => onChange("")}
            title="Supprimer la vidéo"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={handleVideoChange}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 border-dashed border-2 border-slate-300 hover:border-[#0E7C66] text-slate-700 bg-slate-50 hover:bg-[#0E7C66]/5 rounded-xl font-medium text-xs gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#0E7C66]" />
                <span>Importation de la vidéo...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 text-[#0E7C66]" />
                <span>Importer une vidéo (30s max MP4)</span>
              </>
            )}
          </Button>
          <Input
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ou coller une URL vidéo (MP4, YouTube, Vimeo)"
            className="text-xs h-8 font-mono bg-white"
          />
        </div>
      )}
    </div>
  );
};

const AudioUploadField: React.FC<{
  label: string;
  value?: string;
  onChange: (url: string) => void;
  shopId?: string;
}> = ({ label, value, onChange, shopId }) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleAudioChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userFolder = user?.id || shopId || "common";
      const ext = file.name.split(".").pop() || "mp3";
      const path = `${userFolder}/homepage/audios/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;

      const { error } = await supabase.storage
        .from("shop-images")
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage.from("shop-images").getPublicUrl(path);
      if (data?.publicUrl) {
        onChange(data.publicUrl);
        toast({ title: "Audio téléversé ✓", description: "Le fichier audio a été ajouté avec succès." });
      }
    } catch (err: any) {
      console.error("Audio upload failed", err);
      toast({ title: "Échec du téléversement", description: err.message || "Impossible d'importer le fichier audio.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-slate-700">{label}</Label>
      {value ? (
        <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-emerald-950 p-2 flex items-center gap-3 text-white">
          <div className="w-10 h-10 rounded-lg bg-emerald-800 flex items-center justify-center shrink-0 border border-emerald-700">
            <Mic className="w-5 h-5 text-emerald-300" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-medium text-emerald-200 block truncate">Vocal / Audio configuré</span>
            <span className="text-[10px] text-emerald-400 block truncate">{value}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-rose-400 hover:bg-rose-900/50 rounded-lg shrink-0"
            onClick={() => onChange("")}
            title="Supprimer l'audio"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.ogg"
            className="hidden"
            onChange={handleAudioChange}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full h-11 border-dashed border-2 border-slate-300 hover:border-[#0E7C66] text-slate-700 bg-slate-50 hover:bg-[#0E7C66]/5 rounded-xl font-medium text-xs gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#0E7C66]" />
                <span>Importation du vocal...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 text-[#0E7C66]" />
                <span>Importer un vocal audio (MP3 / M4A)</span>
              </>
            )}
          </Button>
          <Input
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ou coller une URL d'un fichier MP3/Vocal"
            className="text-xs h-8 font-mono bg-white"
          />
        </div>
      )}
    </div>
  );
};

export const SectionControls: React.FC<SectionControlsProps> = ({
  section,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  categories = [],
  products = [],
  shopId,
}) => {
  const updateSettings = (key: string, value: any) => {
    onChange({
      ...section,
      settings: {
        ...section.settings,
        [key]: value,
      },
    });
  };

  const settings: any = section.settings || {};

  return (
    <div className="space-y-5 text-sm">
      {/* Header bar controls */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Switch
            checked={section.enabled}
            onCheckedChange={(val) => onChange({ ...section, enabled: val })}
          />
          <span className="font-semibold text-slate-800 text-xs">
            {section.enabled ? "Section Activée" : "Section Masquée"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onMoveUp && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-500 hover:text-slate-900"
              onClick={onMoveUp}
              title="Monter la section"
            >
              <ArrowUp className="w-4 h-4" />
            </Button>
          )}
          {onMoveDown && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-500 hover:text-slate-900"
              onClick={onMoveDown}
              title="Descendre la section"
            >
              <ArrowDown className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-rose-600 hover:bg-rose-50"
            onClick={onDelete}
            title="Supprimer la section"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Hero Section Controls */}
      {section.type === "hero" && (
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700">Titre Principal</Label>
            <Input
              value={settings.title || ""}
              onChange={(e) => updateSettings("title", e.target.value)}
              placeholder="Bienvenue dans notre boutique"
              className="mt-1 font-semibold"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">Sous-titre / Slogan</Label>
            <Input
              value={settings.subtitle || ""}
              onChange={(e) => updateSettings("subtitle", e.target.value)}
              placeholder="Des produits exceptionnels au meilleur prix"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">Texte de description</Label>
            <Textarea
              value={settings.description || ""}
              onChange={(e) => updateSettings("description", e.target.value)}
              rows={2}
              placeholder="Explication synthétique..."
              className="mt-1 text-xs"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">Badge d'accroche</Label>
            <Input
              value={settings.badge || ""}
              onChange={(e) => updateSettings("badge", e.target.value)}
              placeholder="ex: NOUVEAUTÉ / OFFRE LIMITÉE"
              className="mt-1"
            />
          </div>

          <ImageUploadField
            label="Image de fond (Optionnel)"
            value={settings.bg_image_url || ""}
            onChange={(url) => {
              updateSettings("bg_image_url", url);
              if (url) updateSettings("bg_type", "image");
            }}
            shopId={shopId}
          />

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Bouton Principal</Label>
              <Input
                value={settings.primary_button_text || ""}
                onChange={(e) => updateSettings("primary_button_text", e.target.value)}
                placeholder="Acheter maintenant"
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Alignement</Label>
              <Select
                value={settings.content_alignment || "center"}
                onValueChange={(val) => updateSettings("content_alignment", val)}
              >
                <SelectTrigger className="h-9 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Gauche</SelectItem>
                  <SelectItem value="center">Centré</SelectItem>
                  <SelectItem value="right">Droite</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Single Product Direct Checkout Controls */}
      {section.type === "single_product_checkout" && (
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700">Produit à mettre en avant (Checkout Direct)</Label>
            <Select
              value={settings.product_id || ""}
              onValueChange={(val) => updateSettings("product_id", val)}
            >
              <SelectTrigger className="h-9 text-xs mt-1">
                <SelectValue placeholder="Choisir un produit" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.price?.toLocaleString("fr-FR")} FCFA)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">Titre d'Accroche</Label>
            <Input
              value={settings.title || ""}
              onChange={(e) => updateSettings("title", e.target.value)}
              placeholder="Offre Spéciale - Commander en 1 Clic"
              className="mt-1 font-semibold text-xs"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">Badge Promo</Label>
            <Input
              value={settings.badge || ""}
              onChange={(e) => updateSettings("badge", e.target.value)}
              placeholder="ex: -30% AUJOURD'HUI SEULEMENT"
              className="mt-1 text-xs"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">Texte du Bouton Valider</Label>
            <Input
              value={settings.button_text || ""}
              onChange={(e) => updateSettings("button_text", e.target.value)}
              placeholder="Valider ma commande maintenant"
              className="mt-1 text-xs"
            />
          </div>
        </div>
      )}

      {/* Products Grid Controls */}
      {section.type === "products_grid" && (
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700">Titre de la section</Label>
            <Input
              value={settings.title || ""}
              onChange={(e) => updateSettings("title", e.target.value)}
              placeholder="Nos Produits Vedettes"
              className="mt-1 font-semibold"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">Règle de sélection des produits</Label>
            <Select
              value={settings.selection_rule || "all"}
              onValueChange={(val) => updateSettings("selection_rule", val)}
            >
              <SelectTrigger className="h-9 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les produits du catalogue</SelectItem>
                <SelectItem value="featured">Uniquement les produits vedettes</SelectItem>
                <SelectItem value="category">Filtrer par catégorie</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {settings.selection_rule === "category" && (
            <div>
              <Label className="text-xs font-semibold text-slate-700">Catégorie cible</Label>
              <Select
                value={settings.selected_category || ""}
                onValueChange={(val) => updateSettings("selected_category", val)}
              >
                <SelectTrigger className="h-9 text-xs mt-1">
                  <SelectValue placeholder="Choisir une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Produits à afficher</Label>
              <Input
                type="number"
                value={settings.limit || 8}
                onChange={(e) => updateSettings("limit", parseInt(e.target.value) || 8)}
                min={1}
                max={24}
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Colonnes Desktop</Label>
              <Select
                value={String(settings.columns_desktop || 4)}
                onValueChange={(val) => updateSettings("columns_desktop", parseInt(val))}
              >
                <SelectTrigger className="h-9 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 Colonnes</SelectItem>
                  <SelectItem value="3">3 Colonnes</SelectItem>
                  <SelectItem value="4">4 Colonnes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-slate-700">Texte du Bouton Carte</Label>
            <Input
              value={settings.button_text || ""}
              onChange={(e) => updateSettings("button_text", e.target.value)}
              placeholder="Commander"
              className="mt-1 text-xs"
            />
          </div>
        </div>
      )}

      {/* Featured Products Controls */}
      {section.type === "featured_products" && (
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700">Titre de la section</Label>
            <Input
              value={settings.title || ""}
              onChange={(e) => updateSettings("title", e.target.value)}
              placeholder="Nos Produits Vedettes"
              className="mt-1 font-semibold"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Texte du Badge</Label>
            <Input
              value={settings.badge_text || ""}
              onChange={(e) => updateSettings("badge_text", e.target.value)}
              placeholder="Sélection Vedette"
              className="mt-1 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Texte du Bouton</Label>
            <Input
              value={settings.button_text || ""}
              onChange={(e) => updateSettings("button_text", e.target.value)}
              placeholder="Commander"
              className="mt-1 text-xs"
            />
          </div>
        </div>
      )}

      {/* Text Image Controls */}
      {section.type === "text_image" && (
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700">Titre Principal</Label>
            <Input
              value={settings.title || ""}
              onChange={(e) => updateSettings("title", e.target.value)}
              className="mt-1 font-semibold"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Sous-titre / Sur-titre</Label>
            <Input
              value={settings.subtitle || ""}
              onChange={(e) => updateSettings("subtitle", e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Contenu texte</Label>
            <Textarea
              value={settings.description || ""}
              onChange={(e) => updateSettings("description", e.target.value)}
              rows={3}
              className="mt-1 text-xs"
            />
          </div>

          <ImageUploadField
            label="Visuel d'illustration"
            value={settings.image_url || ""}
            onChange={(url) => updateSettings("image_url", url)}
            shopId={shopId}
          />
        </div>
      )}

      {/* Video Shorts Controls (30s max) */}
      {section.type === "video_shorts" && (
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700">Titre des Vidéos Shorts</Label>
            <Input
              value={settings.title || ""}
              onChange={(e) => updateSettings("title", e.target.value)}
              placeholder="Vidéos Shorts & Démonstrations"
              className="mt-1 font-semibold text-xs"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Sous-titre</Label>
            <Input
              value={settings.subtitle || ""}
              onChange={(e) => updateSettings("subtitle", e.target.value)}
              placeholder="Découvrez le produit en action (30s max)"
              className="mt-1 text-xs"
            />
          </div>

          <div className="space-y-3 pt-2">
            <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Liste des Vidéos Shorts ({(settings.items || []).length})
            </Label>
            {(settings.items || []).map((vid: any, i: number) => (
              <div key={vid.id || i} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-700">Vidéo #{i + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-rose-500 hover:bg-rose-100 rounded-lg"
                    onClick={() => {
                      const nextItems = (settings.items || []).filter((_: any, idx: number) => idx !== i);
                      updateSettings("items", nextItems);
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <Input
                  value={vid.title || ""}
                  onChange={(e) => {
                    const nextItems = [...(settings.items || [])];
                    nextItems[i] = { ...nextItems[i], title: e.target.value };
                    updateSettings("items", nextItems);
                  }}
                  placeholder="Titre de la vidéo short"
                  className="text-xs h-8"
                />

                <VideoUploadField
                  label="Fichier vidéo MP4 (30s max)"
                  value={vid.video_url || ""}
                  onChange={(url) => {
                    const nextItems = [...(settings.items || [])];
                    nextItems[i] = { ...nextItems[i], video_url: url };
                    updateSettings("items", nextItems);
                  }}
                  shopId={shopId}
                />
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-9 border-dashed text-xs font-semibold gap-1.5 rounded-xl border-slate-300"
              onClick={() => {
                const newItem = {
                  id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  title: "Nouveau Short 30s",
                  video_url: "",
                };
                updateSettings("items", [...(settings.items || []), newItem]);
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter une vidéo short
            </Button>
          </div>
        </div>
      )}

      {/* Audio Testimonials Controls */}
      {section.type === "audio_testimonials" && (
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700">Titre des Témoignages Audio</Label>
            <Input
              value={settings.title || ""}
              onChange={(e) => updateSettings("title", e.target.value)}
              placeholder="Témoignages Audio de nos Clients"
              className="mt-1 font-semibold text-xs"
            />
          </div>

          <div className="space-y-3 pt-2">
            <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Liste des Audio Vocaux ({(settings.items || []).length})
            </Label>
            {(settings.items || []).map((item: any, i: number) => (
              <div key={item.id || i} className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-emerald-900">Vocal #{i + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-rose-500 hover:bg-rose-100 rounded-lg"
                    onClick={() => {
                      const nextItems = (settings.items || []).filter((_: any, idx: number) => idx !== i);
                      updateSettings("items", nextItems);
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={item.author_name || ""}
                    onChange={(e) => {
                      const nextItems = [...(settings.items || [])];
                      nextItems[i] = { ...nextItems[i], author_name: e.target.value };
                      updateSettings("items", nextItems);
                    }}
                    placeholder="Nom du client"
                    className="text-xs h-8"
                  />
                  <Input
                    value={item.author_role || ""}
                    onChange={(e) => {
                      const nextItems = [...(settings.items || [])];
                      nextItems[i] = { ...nextItems[i], author_role: e.target.value };
                      updateSettings("items", nextItems);
                    }}
                    placeholder="Ex: Cliente d'Abidjan"
                    className="text-xs h-8"
                  />
                </div>

                <AudioUploadField
                  label="Fichier Audio MP3 / Vocal"
                  value={item.audio_url || ""}
                  onChange={(url) => {
                    const nextItems = [...(settings.items || [])];
                    nextItems[i] = { ...nextItems[i], audio_url: url };
                    updateSettings("items", nextItems);
                  }}
                  shopId={shopId}
                />
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-9 border-dashed text-xs font-semibold gap-1.5 rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-50"
              onClick={() => {
                const newItem = {
                  id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  author_name: "Mariam K.",
                  author_role: "Cliente Vérifiée",
                  audio_url: "",
                };
                updateSettings("items", [...(settings.items || []), newItem]);
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter un témoignage audio
            </Button>
          </div>
        </div>
      )}

      {/* Video Section Controls */}
      {section.type === "video" && (
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700">Titre de la section</Label>
            <Input
              value={settings.title || ""}
              onChange={(e) => updateSettings("title", e.target.value)}
              placeholder="Découvrez notre boutique en vidéo"
              className="mt-1 font-semibold text-xs"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Texte de description</Label>
            <Textarea
              value={settings.description || ""}
              onChange={(e) => updateSettings("description", e.target.value)}
              rows={2}
              className="mt-1 text-xs"
            />
          </div>

          <VideoUploadField
            label="Vidéo (MP4 ou URL YouTube/Vimeo)"
            value={settings.video_url || ""}
            onChange={(url) => updateSettings("video_url", url)}
            shopId={shopId}
          />

          <ImageUploadField
            label="Image de couverture (Miniature)"
            value={settings.cover_image_url || ""}
            onChange={(url) => updateSettings("cover_image_url", url)}
            shopId={shopId}
          />
        </div>
      )}

      {/* Banner CTA Controls */}
      {section.type === "banner_cta" && (
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700">Titre de l'offre</Label>
            <Input
              value={settings.title || ""}
              onChange={(e) => updateSettings("title", e.target.value)}
              placeholder="Vente Flash — Offre Spéciale"
              className="mt-1 font-semibold"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Texte d'explication</Label>
            <Input
              value={settings.description || ""}
              onChange={(e) => updateSettings("description", e.target.value)}
              placeholder="Remise exceptionnelle valable aujourd'hui uniquement."
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Texte du Bouton</Label>
            <Input
              value={settings.button_text || ""}
              onChange={(e) => updateSettings("button_text", e.target.value)}
              placeholder="Commander maintenant"
              className="mt-1"
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <Label className="text-xs font-semibold text-slate-700">Afficher le compte à rebours</Label>
            <Switch
              checked={!!settings.show_countdown}
              onCheckedChange={(val) => updateSettings("show_countdown", val)}
            />
          </div>
        </div>
      )}

      {/* Contact Form Controls */}
      {section.type === "contact_form" && (
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-700">Titre du Formulaire</Label>
            <Input
              value={settings.title || ""}
              onChange={(e) => updateSettings("title", e.target.value)}
              placeholder="Contactez-nous"
              className="mt-1 font-semibold text-xs"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Sous-titre</Label>
            <Input
              value={settings.subtitle || ""}
              onChange={(e) => updateSettings("subtitle", e.target.value)}
              placeholder="Une question ? Écrivez-nous directement."
              className="mt-1 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-700">Numéro WhatsApp Réception</Label>
            <Input
              value={settings.whatsapp_number || ""}
              onChange={(e) => updateSettings("whatsapp_number", e.target.value)}
              placeholder="ex: +2250700000000"
              className="mt-1 text-xs"
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <Label className="text-xs font-semibold text-slate-700">Champ Téléphone</Label>
            <Switch
              checked={!!settings.show_phone}
              onCheckedChange={(val) => updateSettings("show_phone", val)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
