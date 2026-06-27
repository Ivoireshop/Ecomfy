import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Check, Upload, Image as ImageIcon, Loader2, Sparkles,
  Package, DollarSign, Tag, Rocket, X,
} from "lucide-react";

const CATEGORIES = [
  "Mode & Vêtements", "Électronique", "Beauté & Soins", "Maison & Déco",
  "Alimentation", "Sport", "Accessoires", "Digital", "Autre",
];

interface ProductLike {
  name: string;
  short_description: string;
  description: string;
  price: number;
  compare_at_price: number;
  stock_quantity: number;
  category: string;
  is_digital: boolean;
  is_published: boolean;
  [k: string]: any;
}

interface PendingImage { id: string; previewUrl: string; file: File }
interface ExistingImage { id: string; image_url: string; is_primary: boolean; display_order: number }

interface Props {
  product: ProductLike;
  setProduct: (p: ProductLike | ((prev: ProductLike) => ProductLike)) => void;
  newImages: PendingImage[];
  existingImages: ExistingImage[];
  onAddImages: (files: FileList | File[]) => Promise<void> | void;
  onRemovePending: (id: string) => void;
  onDeleteExisting?: (id: string) => void;
  onSwitchToExpert: () => void;
  onSave: () => Promise<void> | void;
  saving: boolean;
  currency: string;
  isEditing: boolean;
}

const STEPS = [
  { key: "name", label: "Nom", icon: Package },
  { key: "photos", label: "Photos", icon: ImageIcon },
  { key: "ai", label: "Description IA", icon: Sparkles },
  { key: "price", label: "Prix & stock", icon: DollarSign },
  { key: "category", label: "Catégorie", icon: Tag },
  { key: "publish", label: "Publication", icon: Rocket },
] as const;

export function ProductWizard({
  product, setProduct, newImages, existingImages,
  onAddImages, onRemovePending, onDeleteExisting,
  onSwitchToExpert, onSave, saving, currency, isEditing,
}: Props) {
  const [step, setStep] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAudience, setAiAudience] = useState("");
  const [aiBrief, setAiBrief] = useState("");

  const totalImages = newImages.length + existingImages.length;
  const canNext = () => {
    if (step === 0) return product.name.trim().length >= 2;
    if (step === 1) return totalImages > 0;
    if (step === 3) return product.price > 0;
    if (step === 4) return !!product.category;
    return true;
  };

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const runAi = async () => {
    if (!product.name.trim()) {
      toast.error("Renseignez d'abord le nom du produit");
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-product-sheet", {
        body: {
          name: product.name.trim(),
          price: product.price || undefined,
          currency,
          category: product.category || "",
          target_audience: aiAudience.trim(),
          brief: aiBrief.trim(),
          framework: "AIDA",
          generate_images: false,
        },
      });
      if (error) throw error;
      if (!data?.success) {
        if (data?.error === "credits_required" || data?.credits_required) {
          toast.error("Crédits IA insuffisants. Achetez un pack pour continuer.");
          return;
        }
        throw new Error(data?.message || data?.error || "Erreur");
      }
      const sheet = data.sheet || {};
      const shortDesc: string = sheet.subheadline || sheet.short_description || "";
      const longParts = [
        sheet.headline && `<h2>${escapeHtml(sheet.headline)}</h2>`,
        sheet.short_description && `<p><strong>${escapeHtml(sheet.short_description)}</strong></p>`,
        sheet.long_description && `<p>${escapeHtml(sheet.long_description).replace(/\n+/g, "</p><p>")}</p>`,
        Array.isArray(sheet.benefits) && sheet.benefits.length
          ? `<h3>Bénéfices</h3><ul>${sheet.benefits.map((b: string) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
          : "",
        Array.isArray(sheet.features) && sheet.features.length
          ? `<h3>Caractéristiques</h3><ul>${sheet.features.map((b: string) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
          : "",
        sheet.cta && `<p><strong>${escapeHtml(sheet.cta)}</strong></p>`,
      ].filter(Boolean).join("\n");
      setProduct((prev) => ({
        ...prev,
        short_description: shortDesc || prev.short_description,
        description: longParts || prev.description,
      }));
      toast.success("Description et SEO générés avec succès");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la génération");
    } finally {
      setAiLoading(false);
    }
  };

  const pct = Math.round(((step + 1) / STEPS.length) * 100);
  const Icon = STEPS[step].icon;

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      {/* Stepper header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Étape {step + 1} sur {STEPS.length}</span>
          <span className="font-semibold text-primary">{pct}%</span>
        </div>
        <Progress value={pct} className="h-1.5" />
        <div className="flex items-center justify-between gap-1 overflow-x-auto">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setStep(i)}
              className={`flex flex-col items-center gap-1 px-2 py-1 rounded-md transition-colors shrink-0 ${
                i === step ? "text-primary" : i < step ? "text-emerald-600" : "text-muted-foreground"
              }`}
            >
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                i === step ? "bg-primary text-primary-foreground"
                : i < step ? "bg-emerald-500 text-white"
                : "bg-muted"
              }`}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className="text-[10px] hidden sm:block">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Step content */}
      <Card className="p-5 md:p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">{STEPS[step].label}</h2>
        </div>

        {step === 0 && (
          <div className="space-y-3">
            <Label className="text-sm">Nom du produit</Label>
            <Input
              autoFocus
              value={product.name}
              onChange={(e) => setProduct({ ...product, name: e.target.value })}
              placeholder="Ex : Robe en wax premium"
              className="h-11"
            />
            <Label className="text-sm">Résumé court (optionnel)</Label>
            <Input
              value={product.short_description}
              onChange={(e) => setProduct({ ...product, short_description: e.target.value })}
              placeholder="Une phrase qui donne envie"
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">Un nom clair augmente vos chances de vente.</p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <label className="block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors">
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void onAddImages(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Cliquez pour ajouter des photos</p>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP – moins de 2 Mo</p>
            </label>
            {totalImages > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {existingImages.map((img) => (
                  <div key={img.id} className="relative aspect-square rounded-md overflow-hidden border group">
                    <img src={img.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    {onDeleteExisting && (
                      <button
                        onClick={() => onDeleteExisting(img.id)}
                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"
                        aria-label="Supprimer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {newImages.map((img) => (
                  <div key={img.id} className="relative aspect-square rounded-md overflow-hidden border group">
                    <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => onRemovePending(img.id)}
                      className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100"
                      aria-label="Retirer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Astuce : 3 à 5 photos sous différents angles convertissent mieux.</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Laissez l'IA rédiger une description vendeuse et optimisée SEO. Vous pourrez l'éditer ensuite en mode Expert.
            </p>
            <Label className="text-sm">Public cible (optionnel)</Label>
            <Input
              value={aiAudience}
              onChange={(e) => setAiAudience(e.target.value)}
              placeholder="Ex : femmes 25-40 ans, occasions spéciales"
              className="h-11"
            />
            <Label className="text-sm">Brief / points clés (optionnel)</Label>
            <Textarea
              value={aiBrief}
              onChange={(e) => setAiBrief(e.target.value)}
              placeholder="Bénéfices, matières, livraison rapide…"
              rows={3}
            />
            <Button onClick={runAi} disabled={aiLoading} className="w-full gap-2">
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {aiLoading ? "Génération en cours…" : "Générer description + SEO avec l'IA"}
            </Button>
            {product.description && (
              <div className="mt-2 p-3 rounded-md bg-muted/40 max-h-48 overflow-y-auto text-sm">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Aperçu généré :</p>
                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: product.description }} />
              </div>
            )}
            <p className="text-xs text-muted-foreground">Vous pouvez passer cette étape et écrire votre description manuellement plus tard.</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Label className="text-sm">Prix de vente ({currency})</Label>
            <Input
              type="number"
              min={0}
              value={product.price || ""}
              onChange={(e) => setProduct({ ...product, price: Number(e.target.value) || 0 })}
              placeholder="Ex : 15000"
              className="h-11"
            />
            <Label className="text-sm">Prix barré (optionnel)</Label>
            <Input
              type="number"
              min={0}
              value={product.compare_at_price || ""}
              onChange={(e) => setProduct({ ...product, compare_at_price: Number(e.target.value) || 0 })}
              placeholder="Ex : 20000"
              className="h-11"
            />
            <Label className="text-sm">Stock disponible</Label>
            <Input
              type="number"
              min={0}
              value={product.stock_quantity}
              onChange={(e) => setProduct({ ...product, stock_quantity: Number(e.target.value) || 0 })}
              className="h-11"
            />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <Label className="text-sm">Catégorie</Label>
            <Select value={product.category} onValueChange={(v) => setProduct({ ...product, category: v })}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Choisir une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between p-3 rounded-md border">
              <div>
                <p className="text-sm font-medium">Produit digital</p>
                <p className="text-xs text-muted-foreground">Pas de livraison physique</p>
              </div>
              <Switch
                checked={product.is_digital}
                onCheckedChange={(v) => setProduct({ ...product, is_digital: v })}
              />
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/30 border space-y-2">
              <p className="text-sm"><span className="text-muted-foreground">Nom :</span> <strong>{product.name || "—"}</strong></p>
              <p className="text-sm"><span className="text-muted-foreground">Prix :</span> <strong>{product.price ? `${product.price.toLocaleString()} ${currency}` : "—"}</strong></p>
              <p className="text-sm"><span className="text-muted-foreground">Stock :</span> <strong>{product.stock_quantity}</strong></p>
              <p className="text-sm"><span className="text-muted-foreground">Catégorie :</span> <strong>{product.category}</strong></p>
              <p className="text-sm"><span className="text-muted-foreground">Photos :</span> <strong>{totalImages}</strong></p>
            </div>
            <div className="flex items-center justify-between p-3 rounded-md border">
              <div>
                <p className="text-sm font-medium">Publier le produit</p>
                <p className="text-xs text-muted-foreground">Visible dans votre boutique</p>
              </div>
              <Switch
                checked={product.is_published}
                onCheckedChange={(v) => setProduct({ ...product, is_published: v })}
              />
            </div>
            <Button onClick={() => void onSave()} disabled={saving} className="w-full h-12 gap-2 bg-pink-500 hover:bg-pink-600 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              {saving ? "Enregistrement…" : isEditing ? "Tout enregistrer" : "Créer le produit"}
            </Button>
            <button onClick={onSwitchToExpert} className="w-full text-xs text-muted-foreground hover:text-foreground underline">
              Besoin d'options avancées ? Passer en mode Expert
            </button>
          </div>
        )}
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={back} disabled={step === 0} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Précédent
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next} disabled={!canNext()} className="gap-1.5">
            Suivant <ArrowRight className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}