import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Image as ImageIcon, Loader2, Plus, X, ArrowUp, ArrowDown, Sparkles } from "lucide-react";
import { encode } from "modern-gif";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Frame {
  id: string;
  dataUrl: string;
  name: string;
}

type ShopInfo = {
  id: string;
  subscription_plan?: string | null;
  subscription_active_until?: string | null;
  gifs_generated_count?: number | null;
  gifs_period_start?: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onGenerated: (file: File) => void;
  shop?: ShopInfo;
}

const SIZE_OPTIONS = [
  { value: "480", label: "480 x 480 (carré, léger)" },
  { value: "640", label: "640 x 640 (carré, recommandé)" },
  { value: "800", label: "800 x 800 (carré, HD)" },
];

const MAX_FRAMES = 6;
const MIN_FRAMES = 2;

/**
 * Dialog letting the merchant import 2-6 product photos and assemble them
 * into an animated GIF, encoded fully in the browser via modern-gif.
 * The output GIF is delivered as a File via onGenerated, ready to be
 * dropped into the product gallery alongside regular images.
 */
function resolvePlan(shop?: ShopInfo): "free" | "starter" | "business" {
  if (!shop) return "free";
  const active = shop.subscription_active_until && new Date(shop.subscription_active_until).getTime() > Date.now();
  if (!active) return "free";
  const p = (shop.subscription_plan || "free").toLowerCase();
  if (p === "business" || p === "premium") return "business";
  if (p === "starter") return "starter";
  return "free";
}

const PLAN_LIMIT: Record<string, number> = { free: 10, starter: 30, business: Infinity };

export function ProductGifGenerator({ open, onOpenChange, onGenerated, shop }: Props) {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [delayMs, setDelayMs] = useState(700);
  const [size, setSize] = useState("640");
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fenêtre 30j : reset visuel si la période a expiré
  const plan = resolvePlan(shop);
  const limit = PLAN_LIMIT[plan];
  const periodStart = shop?.gifs_period_start ? new Date(shop.gifs_period_start).getTime() : 0;
  const periodValid = periodStart > Date.now() - 30 * 24 * 3600 * 1000;
  const baseUsed = periodValid ? Number(shop?.gifs_generated_count || 0) : 0;
  const [usedLocal, setUsedLocal] = useState(0);
  const used = baseUsed + usedLocal;
  const quotaReached = used >= limit;

  const reset = () => {
    setFrames([]);
    setDelayMs(700);
    setSize("640");
    setFit("cover");
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    const remaining = MAX_FRAMES - frames.length;
    if (remaining <= 0) {
      toast({ title: "Limite atteinte", description: `Maximum ${MAX_FRAMES} images.`, variant: "destructive" });
      return;
    }
    const list = Array.from(files).slice(0, remaining);
    list.forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "Image trop lourde", description: `${file.name} dépasse 10MB.`, variant: "destructive" });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setFrames((prev) => [
          ...prev,
          { id: `${Date.now()}-${Math.random()}`, dataUrl: reader.result as string, name: file.name },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const move = (idx: number, dir: -1 | 1) => {
    setFrames((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const remove = (id: string) => setFrames((prev) => prev.filter((f) => f.id !== id));

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Image illisible"));
      img.src = src;
    });

  const drawFrame = (img: HTMLImageElement, dim: number): HTMLCanvasElement => {
    const canvas = document.createElement("canvas");
    canvas.width = dim;
    canvas.height = dim;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, dim, dim);
    const ratio = img.width / img.height;
    let dw = dim;
    let dh = dim;
    if (fit === "contain") {
      if (ratio > 1) dh = dim / ratio;
      else dw = dim * ratio;
    } else {
      if (ratio > 1) dw = dim * ratio;
      else dh = dim / ratio;
    }
    const dx = (dim - dw) / 2;
    const dy = (dim - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
    return canvas;
  };

  const handleGenerate = async () => {
    if (frames.length < MIN_FRAMES) {
      toast({ title: "Trop peu d'images", description: `Importez au moins ${MIN_FRAMES} images.`, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const dim = parseInt(size, 10);
      const imgs = await Promise.all(frames.map((f) => loadImage(f.dataUrl)));
      const gifFrames = imgs.map((img) => ({
        data: drawFrame(img, dim),
        delay: delayMs,
      }));
      const output = await encode({
        width: dim,
        height: dim,
        frames: gifFrames,
      });
      const blob = new Blob([output], { type: "image/gif" });
      const file = new File([blob], `produit-anime-${Date.now()}.gif`, { type: "image/gif" });
      // Incrémente le compteur côté DB (sauf plan illimité)
      if (shop?.id && Number.isFinite(limit)) {
        try {
          await supabase.rpc("increment_shop_gif_count" as any, { _shop_id: shop.id });
          setUsedLocal((n) => n + 1);
        } catch (err) {
          console.warn("increment_shop_gif_count failed", err);
        }
      }
      onGenerated(file);
      toast({ title: "✓ GIF créé", description: "Ajouté à la galerie. Pensez à enregistrer." });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erreur", description: e?.message || "Création du GIF impossible", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Créer un GIF animé du produit
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Importez 2 à {MAX_FRAMES} photos de votre produit (différents angles, couleurs ou usages). Notre moteur les assemble en un GIF prêt pour votre fiche produit.
          </p>
          {/* Quota par plan */}
          <div className={`text-[12px] rounded-md px-3 py-2 border ${quotaReached ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-muted/40 border-border text-muted-foreground"}`}>
            {plan === "business" ? (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">✓ Plan Business — GIFs illimités</span>
            ) : (
              <>
                <span className="font-semibold">{used} / {limit}</span> GIFs générés ces 30 derniers jours
                {plan === "free" && <> · <button type="button" className="underline" onClick={() => { onOpenChange(false); navigate("/shop-manager"); }}>Passer au plan Starter</button> pour 30 GIFs/mois</>}
                {plan === "starter" && quotaReached && <> · Passez au plan Business pour des GIFs illimités</>}
              </>
            )}
          </div>

          {/* Frames list */}
          {frames.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">Images ({frames.length}/{MAX_FRAMES})</Label>
              <div className="space-y-2">
                {frames.map((f, idx) => (
                  <div key={f.id} className="flex items-center gap-2 p-2 border rounded-md bg-muted/20">
                    <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}</span>
                    <img src={f.dataUrl} alt="" className="h-12 w-12 object-cover rounded border" />
                    <span className="text-xs truncate flex-1">{f.name}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(idx, -1)} disabled={idx === 0 || loading}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(idx, 1)} disabled={idx === frames.length - 1 || loading}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(f.id)} disabled={loading}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add files */}
          {frames.length < MAX_FRAMES && (
            <label className="flex flex-col items-center justify-center gap-1 cursor-pointer rounded-md border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors px-3 py-5 text-center">
              <Plus className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs font-medium">Ajouter des images depuis votre ordinateur</span>
              <span className="text-[10px] text-muted-foreground">PNG, JPG, WEBP · max 10MB par image</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
                disabled={loading}
              />
            </label>
          )}

          {/* Settings */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Format</Label>
              <Select value={size} onValueChange={setSize} disabled={loading}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SIZE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cadrage</Label>
              <Select value={fit} onValueChange={(v) => setFit(v as any)} disabled={loading}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover" className="text-xs">Remplir (recadré)</SelectItem>
                  <SelectItem value="contain" className="text-xs">Entier (avec marge)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Vitesse de défilement</Label>
              <span className="text-xs text-muted-foreground">{delayMs} ms / image</span>
            </div>
            <Slider
              value={[delayMs]}
              min={200}
              max={2000}
              step={100}
              onValueChange={(v) => setDelayMs(v[0])}
              disabled={loading}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Rapide</span><span>Lent</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
          <Button onClick={handleGenerate} disabled={loading || frames.length < MIN_FRAMES || quotaReached} className="gap-2">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Création…</> : <><ImageIcon className="h-4 w-4" /> Générer le GIF</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}