import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Mic, Trash2, Upload, ChevronUp, ChevronDown, RefreshCw } from "lucide-react";
import {
  fetchProductAudios,
  isAcceptedAudio,
  MAX_AUDIO_SIZE_BYTES,
  ProductAudio,
  uploadProductAudio,
} from "@/lib/productAppearance";

interface Props {
  productId: string;
  shopId: string;
}

export function ProductAudioManager({ productId, shopId }: Props) {
  const [audios, setAudios] = useState<ProductAudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const rows = await fetchProductAudios(productId);
    setAudios(rows);
    setLoading(false);
  };

  useEffect(() => {
    if (productId) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const handleNewFile = async (file: File) => {
    if (!isAcceptedAudio(file)) {
      toast.error("Format audio non accepté.");
      return;
    }
    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      toast.error("Votre fichier audio est trop lourd.");
      return;
    }
    setUploading(true);
    const pending = toast.loading("Veuillez patienter, l'audio est en cours d'envoi.");
    try {
      const { url, path } = await uploadProductAudio(file, shopId, productId);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Connexion requise");
      const nextOrder = (audios[audios.length - 1]?.sort_order ?? 0) + 1;
      const { error } = await supabase.from("product_audios" as any).insert({
        product_id: productId,
        shop_id: shopId,
        user_id: user.id,
        audio_url: url,
        storage_path: path,
        title: "Témoignage client satisfait",
        customer_name: "Client vérifié",
        file_type: file.type || null,
        file_size: file.size,
        sort_order: nextOrder,
        is_active: true,
      } as any);
      if (error) throw error;
      toast.dismiss(pending);
      toast.success("Audio ajouté avec succès.");
      await reload();
    } catch (e: any) {
      toast.dismiss(pending);
      toast.error("L'upload de l'audio a échoué. Veuillez réessayer.");
    } finally {
      setUploading(false);
    }
  };

  const handleReplaceFile = async (file: File, id: string) => {
    if (!isAcceptedAudio(file)) {
      toast.error("Format audio non accepté.");
      return;
    }
    if (file.size > MAX_AUDIO_SIZE_BYTES) {
      toast.error("Votre fichier audio est trop lourd.");
      return;
    }
    setUploading(true);
    const pending = toast.loading("Remplacement en cours…");
    try {
      const { url, path } = await uploadProductAudio(file, shopId, productId);
      const { error } = await supabase
        .from("product_audios" as any)
        .update({ audio_url: url, storage_path: path, file_type: file.type || null, file_size: file.size } as any)
        .eq("id", id);
      if (error) throw error;
      toast.dismiss(pending);
      toast.success("Audio remplacé avec succès.");
      await reload();
    } catch {
      toast.dismiss(pending);
      toast.error("L'upload de l'audio a échoué. Veuillez réessayer.");
    } finally {
      setUploading(false);
      setReplacingId(null);
    }
  };

  const patchAudio = async (id: string, patch: Partial<ProductAudio>) => {
    setAudios((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } as ProductAudio : a)));
    await supabase.from("product_audios" as any).update(patch as any).eq("id", id);
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer définitivement cet audio ?")) return;
    const { error } = await supabase.from("product_audios" as any).delete().eq("id", id);
    if (error) {
      toast.error("Suppression impossible");
      return;
    }
    toast.success("Audio supprimé avec succès.");
    setAudios((prev) => prev.filter((a) => a.id !== id));
  };

  const move = async (id: string, dir: -1 | 1) => {
    const idx = audios.findIndex((a) => a.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= audios.length) return;
    const a = audios[idx];
    const b = audios[swap];
    const reordered = [...audios];
    reordered[idx] = b;
    reordered[swap] = a;
    setAudios(reordered);
    await Promise.all([
      supabase.from("product_audios" as any).update({ sort_order: swap } as any).eq("id", a.id),
      supabase.from("product_audios" as any).update({ sort_order: idx } as any).eq("id", b.id),
    ]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Témoignages audio</h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="gap-1.5"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Ajouter un témoignage audio
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.opus,.m4a,.aac,.ogg,.wav,.mp3,.webm"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleNewFile(f);
            e.currentTarget.value = "";
          }}
        />
        <input
          ref={replaceRef}
          type="file"
          accept="audio/*,.opus,.m4a,.aac,.ogg,.wav,.mp3,.webm"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && replacingId) void handleReplaceFile(f, replacingId);
            e.currentTarget.value = "";
          }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Formats acceptés : MP3, WAV, M4A, AAC, OGG, OPUS, WEBM. Taille max : 8 Mo.
      </p>

      {loading ? (
        <div className="text-xs text-muted-foreground">Chargement…</div>
      ) : audios.length === 0 ? (
        <div className="text-xs text-muted-foreground border border-dashed rounded-md p-3 text-center">
          Aucun témoignage audio pour le moment.
        </div>
      ) : (
        <div className="space-y-2">
          {audios.map((a, i) => (
            <div key={a.id} className="border rounded-md p-2.5 space-y-2 bg-card">
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(a.id, -1)}
                    disabled={i === 0}
                    className="h-5 w-5 rounded hover:bg-muted disabled:opacity-30 flex items-center justify-center"
                    aria-label="Monter"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(a.id, 1)}
                    disabled={i === audios.length - 1}
                    className="h-5 w-5 rounded hover:bg-muted disabled:opacity-30 flex items-center justify-center"
                    aria-label="Descendre"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  <Input
                    value={a.title || ""}
                    onChange={(e) => patchAudio(a.id, { title: e.target.value })}
                    placeholder="Titre (ex : Témoignage client satisfait)"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={a.customer_name || ""}
                    onChange={(e) => patchAudio(a.id, { customer_name: e.target.value })}
                    placeholder="Nom du client (ou « Client vérifié »)"
                    className="h-8 text-xs"
                  />
                  <Textarea
                    value={a.description || ""}
                    onChange={(e) => patchAudio(a.id, { description: e.target.value })}
                    placeholder="Courte description du témoignage (optionnel)"
                    rows={2}
                    className="text-xs"
                  />
                  <audio src={a.audio_url} controls preload="none" className="w-full h-9" />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Switch
                    checked={a.is_active}
                    onCheckedChange={(v) => patchAudio(a.id, { is_active: v })}
                  />
                  <span>{a.is_active ? "Visible publiquement" : "Masqué"}</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => {
                      setReplacingId(a.id);
                      replaceRef.current?.click();
                    }}
                  >
                    <RefreshCw className="h-3 w-3" /> Remplacer
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-destructive gap-1"
                    onClick={() => void remove(a.id)}
                  >
                    <Trash2 className="h-3 w-3" /> Supprimer
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
