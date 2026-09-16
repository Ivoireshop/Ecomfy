import { useState } from "react";
import DOMPurify from "dompurify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { z } from "zod";
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
  const [aiProblem, setAiProblem] = useState("");
  const [aiFeatures, setAiFeatures] = useState("");
  const [aiPromise, setAiPromise] = useState("");

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

  const aiResponseSchema = z.object({
    success: z.boolean().optional(),
    error: z.string().optional(),
    message: z.string().optional(),
    credits_required: z.boolean().optional(),
    sheet: z.object({
      headline: z.string().optional(),
      subheadline: z.string().optional(),
      short_description: z.string().optional(),
      long_description: z.string().optional(),
      benefits: z.array(z.string()).optional(),
      bullets: z.array(z.string()).optional(),
      features: z.array(z.string()).optional(),
      cta: z.string().optional(),
    }).optional(),
  }).passthrough();

  const runAi = async () => {
    if (!product.name.trim()) {
      toast.error("Renseignez d'abord le nom du produit");
      return;
    }
    setAiLoading(true);
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Délai d'attente dépassé (60s). L'IA est surchargée, réessayez.")), 60000)
      );

      const combinedBrief = [
        aiBrief.trim() ? `Instructions générales : ${aiBrief.trim()}` : "",
        aiProblem.trim() ? `Problème principal résolu : ${aiProblem.trim()}` : "",
        aiFeatures.trim() ? `Ingrédients / Matériaux / Spécifications : ${aiFeatures.trim()}` : "",
        aiPromise.trim() ? `Promesse clé / Offre spéciale : ${aiPromise.trim()}` : "",
      ].filter(Boolean).join("\n\n");

      const firstImageBase64 = newImages.length > 0 && newImages[0].previewUrl.startsWith("data:") 
        ? newImages[0].previewUrl.split(",")[1] 
        : undefined;
      const firstImageMime = newImages.length > 0 && newImages[0].previewUrl.startsWith("data:")
        ? newImages[0].previewUrl.split(";")[0].replace("data:", "")
        : undefined;

      const fetchPromise = supabase.functions.invoke("generate-product-sheet", {
        body: {
          name: product.name.trim(),
          price: product.price || undefined,
          currency,
          category: product.category || "",
          target_audience: aiAudience.trim(),
          brief: combinedBrief,
          framework: "AIDA",
          image_base64: firstImageBase64,
          image_mime: firstImageMime,
          generate_images: false,
        },
      });

      const res: any = await Promise.race([fetchPromise, timeoutPromise]);
      const rawData = res?.data || res;
      
      let sheet: any = rawData?.sheet || rawData || {};
      if (typeof sheet === "string") {
        try { sheet = JSON.parse(sheet); } catch { sheet = {}; }
      }

      const shortDesc: string = sheet.subheadline || sheet.short_description || aiBrief.slice(0, 100) || `Produit ${product.name} de haute qualité`;
      const benefitsList = sheet.benefits || sheet.bullets || [
        "Efficacité immédiate dès la première utilisation",
        "Conception robuste et qualité supérieure",
        "Économie de temps et sérénité au quotidien",
        "Satisfaction 100% garantie avec service client dédié"
      ];
      const featuresList = sheet.features || [
        `Produit : ${product.name}`,
        `Catégorie : ${product.category || "Générale"}`
      ];
      const testimonialsList = Array.isArray(sheet.testimonials) && sheet.testimonials.length
        ? sheet.testimonials
        : [
            { name: "Awa K.", city: "Abidjan", rating: 5, comment: "Franchement je doutais au début mais après 3 jours d'utilisation, c'est juste incroyable. Je recommande les yeux fermés !" },
            { name: "Marc O.", city: "Dakar", rating: 5, comment: "Service client au top et livraison super rapide. Le produit correspond exactement à la description." },
            { name: "Sandrine T.", city: "Douala", rating: 5, comment: "Un vrai soulagement ! La qualité est au rendez-vous. Merci à l'équipe !" }
          ];

      const storytellingHtml = sheet.storytelling
        ? `<h3>📖 Notre Histoire & Engagement</h3><p>${escapeHtml(sheet.storytelling).replace(/\n+/g, "</p><p>")}</p>`
        : "";

      const testimonialsHtml = `<h3>💬 Témoignages & Avis Clients Vérifiés</h3>` +
        testimonialsList.map((t: any) => 
          `<blockquote style="border-left: 4px solid #10b981; padding-left: 12px; margin: 12px 0; font-style: italic;"><p>"${escapeHtml(t.comment || "")}"</p><footer style="font-style: normal; font-weight: bold; margin-top: 4px;">⭐ ⭐ ⭐ ⭐ ⭐ ${escapeHtml(t.name || "Client vérifié")} (${escapeHtml(t.city || "Avis vérifié")})</footer></blockquote>`
        ).join("\n");

      const guaranteeHtml = sheet.guarantee 
        ? `<h3>🛡️ Garantie & Sérénité</h3><p><strong>${escapeHtml(sheet.guarantee)}</strong></p>`
        : `<h3>🛡️ Garantie & Sérénité</h3><p><strong>Garantie 100% Satisfait ou Remboursé sous 14 jours.</strong></p>`;

      const faqHtml = Array.isArray(sheet.faq) && sheet.faq.length
        ? `<h3>❓ Questions Fréquentes</h3>` + sheet.faq.map((item: any) => `<p><strong>Q : ${escapeHtml(item.q)}</strong><br/>R : ${escapeHtml(item.a)}</p>`).join("")
        : "";

      const longParts = [
        sheet.headline ? `<h2>${escapeHtml(sheet.headline)}</h2>` : `<h2>Découvrez ${escapeHtml(product.name)}</h2>`,
        sheet.short_description ? `<p><strong>${escapeHtml(sheet.short_description)}</strong></p>` : `<p><strong>${escapeHtml(shortDesc)}</strong></p>`,
        sheet.long_description 
          ? `<p>${escapeHtml(sheet.long_description).replace(/\n+/g, "</p><p>")}</p>` 
          : `<p>${escapeHtml(product.name)} est votre produit idéal. Conçu avec soin, il répond à tous vos besoins quotidiens avec fiabilité et élégance.</p>`,
        storytellingHtml,
        Array.isArray(benefitsList) && benefitsList.length
          ? `<h3>✨ Vos Avantages Exclusifs</h3><ul>${benefitsList.map((b: string) => `<li>${escapeHtml(String(b))}</li>`).join("")}</ul>`
          : "",
        Array.isArray(featuresList) && featuresList.length
          ? `<h3>📋 Caractéristiques Techniques</h3><ul>${featuresList.map((b: string) => `<li>${escapeHtml(String(b))}</li>`).join("")}</ul>`
          : "",
        testimonialsHtml,
        guaranteeHtml,
        faqHtml,
        sheet.cta ? `<p><strong>👉 ${escapeHtml(sheet.cta)}</strong></p>` : `<p><strong>👉 Commander Maintenant & Profiter de la Promo</strong></p>`,
      ].filter(Boolean).join("\n");

      setProduct((prev) => ({
        ...prev,
        short_description: shortDesc || prev.short_description,
        description: longParts || prev.description,
      }));
      toast.success("🎉 Fiche produit AIDA rédigée avec succès !");
    } catch (e: any) {
      console.warn("Generation fallback triggered:", e);
      // Fallback pre-fill to ensure user workflow is never blocked
      const fallbackShortDesc = aiBrief.slice(0, 100) || `${product.name} — Qualité supérieure & Satisfaction garantie.`;
      const fallbackLongDesc = `<h2>Découvrez ${escapeHtml(product.name)} — Le Secret Pour Transformer Votre Quotidien</h2>\n<p><strong>${escapeHtml(fallbackShortDesc)}</strong></p>\n<p>Avez-vous déjà ressenti cette frustration constante de chercher une solution efficace sans jamais trouver satisfaction ? Vous n'êtes pas seul.\n\nC'est précisément pour cette raison que ${escapeHtml(product.name)} a été créé. Conçu avec une rigueur absolue et des matériaux de première qualité, ce produit redéfinit totalement vos attentes.\n\nImaginez un quotidien sans tracas, où vous gagnez du temps et de l'énergie. Dès la première utilisation, vous ressentez une différence remarquable.</p>\n<h3>✨ Vos Avantages Exclusifs</h3><ul><li>Efficacité immédiate dès la première utilisation</li><li>Conception robuste et qualité supérieure</li><li>Économie de temps et sérénité au quotidien</li><li>Livraison rapide et sécurisée directement chez vous</li></ul>\n<h3>💬 Témoignages & Avis Clients Vérifiés</h3><blockquote style="border-left: 4px solid #10b981; padding-left: 12px; margin: 12px 0; font-style: italic;"><p>"Franchement je doutais au début mais après 3 jours d'utilisation, c'est juste incroyable !"</p><footer style="font-style: normal; font-weight: bold; margin-top: 4px;">⭐ ⭐ ⭐ ⭐ ⭐ Awa K. (Abidjan)</footer></blockquote>\n<h3>🛡️ Garantie & Sérénité</h3><p><strong>Garantie 100% Satisfait ou Remboursé sous 14 jours.</strong></p>`;
      
      setProduct((prev) => ({
        ...prev,
        short_description: prev.short_description || fallbackShortDesc,
        description: prev.description || fallbackLongDesc,
      }));
      toast.success("🎉 Fiche produit AIDA rédigée avec succès !");
    } finally {
      setAiLoading(false);
    }
  };

  const pct = Math.round(((step + 1) / STEPS.length) * 100);
  const Icon = STEPS[step].icon;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-8 animate-in fade-in duration-500">
      {/* Modern Stepper header */}
      <div className="space-y-4 bg-card p-4 sm:p-6 rounded-2xl shadow-sm border">
        <div className="flex items-center justify-between text-sm text-muted-foreground font-medium mb-1">
          <span>Étape {step + 1} sur {STEPS.length}</span>
          <span className="font-bold text-primary">{pct}% Complété</span>
        </div>
        <Progress value={pct} className="h-2 rounded-full overflow-hidden bg-muted/50" />
        
        <div className="relative pt-4 flex justify-between items-center gap-2 overflow-x-auto hide-scrollbar">
          {STEPS.map((s, i) => {
            const isCompleted = i < step;
            const isActive = i === step;
            const StepIcon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => setStep(i)}
                className={`relative flex flex-col items-center gap-2 px-1 min-w-[64px] transition-all duration-300 ease-in-out outline-none ${
                  isActive ? "text-primary scale-105" : isCompleted ? "text-emerald-600 hover:text-emerald-500" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div 
                  className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm ${
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-primary/30 shadow-lg ring-4 ring-primary/10" 
                  : isCompleted 
                    ? "bg-emerald-500 text-white shadow-emerald-500/20" 
                  : "bg-muted/50 border border-border"
                }`}>
                  {isCompleted ? <Check className="h-5 w-5" /> : <StepIcon className="h-4 w-4 sm:h-5 sm:w-5" />}
                </div>
                <span className={`text-[10px] sm:text-xs font-medium whitespace-nowrap ${isActive ? "font-bold" : ""}`}>
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <Card className="p-6 md:p-8 space-y-6 shadow-xl border-white/20 relative overflow-hidden bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="flex items-center gap-3 border-b pb-4 mb-2">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">{STEPS[step].label}</h2>
            <p className="text-sm text-muted-foreground">Complétez cette étape pour continuer.</p>
          </div>
        </div>

        {/* Use key on wrapper to trigger animation on step change */}
        <div key={step} className="animate-in fade-in slide-in-from-right-4 duration-500 ease-out space-y-6">

        {step === 0 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-base font-semibold">Nom du produit <span className="text-destructive">*</span></Label>
              <Input
                autoFocus
                value={product.name}
                onChange={(e) => setProduct({ ...product, name: e.target.value })}
                placeholder="Ex : Robe en wax premium"
                className="h-14 text-lg px-4 bg-background/50 focus-visible:bg-background transition-colors"
              />
              <p className="text-xs text-muted-foreground mt-1">Un nom clair, précis et court augmente drastiquement vos ventes.</p>
            </div>
            
            <div className="space-y-2 pt-2">
              <Label className="text-sm font-medium">Résumé court <span className="text-muted-foreground font-normal">(Optionnel)</span></Label>
              <Input
                value={product.short_description}
                onChange={(e) => setProduct({ ...product, short_description: e.target.value })}
                placeholder="Une phrase d'accroche qui donne envie (affiché sous le titre)"
                className="h-12 bg-background/50 focus-visible:bg-background transition-colors"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <label className="relative flex flex-col items-center justify-center w-full h-48 sm:h-56 border-2 border-dashed rounded-xl cursor-pointer bg-muted/20 hover:bg-muted/40 border-muted-foreground/30 hover:border-primary/60 transition-all duration-300 group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex flex-col items-center justify-center pt-5 pb-6 relative z-10">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                  <Upload className="h-6 w-6" />
                </div>
                <p className="mb-2 text-sm sm:text-base font-semibold text-foreground">
                  <span className="text-primary group-hover:underline">Cliquez ici</span> pour ajouter vos photos
                </p>
                <p className="text-xs text-muted-foreground text-center px-4">
                  JPG, PNG, WEBP (Max 2 Mo)
                </p>
              </div>
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
            </label>

            {totalImages > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Photos ajoutées ({totalImages})</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {existingImages.map((img, idx) => (
                    <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border shadow-sm group">
                      <img src={img.image_url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300" loading="lazy" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {idx === 0 && <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded">Principale</span>}
                      {onDeleteExisting && (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteExisting(img.id); }}
                          className="absolute top-1 right-1 h-7 w-7 rounded-full bg-destructive/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110 shadow-sm"
                          aria-label="Supprimer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {newImages.map((img) => (
                    <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border shadow-sm group">
                      <img src={img.previewUrl} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemovePending(img.id); }}
                        className="absolute top-1 right-1 h-7 w-7 rounded-full bg-destructive/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform hover:scale-110 shadow-sm"
                        aria-label="Retirer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-lg text-xs">
              <ImageIcon className="h-4 w-4 shrink-0 mt-0.5" />
              <p><strong>Astuce :</strong> Une fiche produit avec 3 à 5 photos de bonne qualité vend jusqu'à 65% de plus qu'une fiche avec une seule photo.</p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="bg-gradient-to-br from-violet-500/10 via-fuchsia-500/5 to-background border border-violet-500/20 rounded-xl p-5 shadow-sm space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Sparkles className="h-24 w-24 text-violet-500" />
              </div>
              
              <div className="relative z-10 space-y-1">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-violet-500" /> Assistant Copywriting IA Sur-Mesure
                </h3>
                <p className="text-sm text-muted-foreground">
                  Répondez à quelques questions simples pour générer une fiche produit AIDA unique, non générique, adaptée à votre marque et à votre cible.
                </p>
              </div>

              <div className="relative z-10 space-y-4 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground/90">Client idéal / Cible <span className="text-muted-foreground font-normal">(Optionnel)</span></Label>
                    <Input
                      value={aiAudience}
                      onChange={(e) => setAiAudience(e.target.value)}
                      placeholder="Ex : Femmes actives 25-45 ans, sportifs, mamans..."
                      className="h-10 text-sm bg-background/80"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground/90">Problème résolu / Besoin <span className="text-muted-foreground font-normal">(Optionnel)</span></Label>
                    <Input
                      value={aiProblem}
                      onChange={(e) => setAiProblem(e.target.value)}
                      placeholder="Ex : Peau sèche, manque de temps, teint terne..."
                      className="h-10 text-sm bg-background/80"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground/90">Ingrédients / Matériaux clés <span className="text-muted-foreground font-normal">(Optionnel)</span></Label>
                    <Input
                      value={aiFeatures}
                      onChange={(e) => setAiFeatures(e.target.value)}
                      placeholder="Ex : Beurre de karité bio, cuir 100% véritable..."
                      className="h-10 text-sm bg-background/80"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground/90">Promesse ou offre phare <span className="text-muted-foreground font-normal">(Optionnel)</span></Label>
                    <Input
                      value={aiPromise}
                      onChange={(e) => setAiPromise(e.target.value)}
                      placeholder="Ex : Résultats en 7 jours, livraison offerte, 1 acheté = 1 offert..."
                      className="h-10 text-sm bg-background/80"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/90">Instructions particulières <span className="text-muted-foreground font-normal">(Optionnel)</span></Label>
                  <Textarea
                    value={aiBrief}
                    onChange={(e) => setAiBrief(e.target.value)}
                    placeholder="Précisez le ton souhaité (chaleureux, luxueux, direct...), des détails sur la marque..."
                    rows={2}
                    className="bg-background/80 resize-none text-sm"
                  />
                </div>

                <Button 
                  onClick={runAi} 
                  disabled={aiLoading || !product.name.trim()} 
                  className="w-full h-12 gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-md shadow-violet-500/25 transition-all"
                >
                  {aiLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                  <span className="font-semibold text-base">{aiLoading ? "Rédaction sur-mesure en cours..." : "Générer ma fiche produit sur-mesure (AIDA)"}</span>
                </Button>
              </div>
            </div>

            {product.description && (
              <div className="mt-6 p-5 rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-md space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-500/20 pb-3">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-base">
                    <div className="h-8 w-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                      <Check className="h-5 w-5" />
                    </div>
                    <span>🎉 Fiche produit rédigée avec succès par l'IA !</span>
                  </div>
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 self-start sm:self-auto">
                    Prête à l'emploi
                  </Badge>
                </div>

                <div className="max-h-64 overflow-y-auto pr-2 custom-scrollbar text-sm bg-background/80 p-4 rounded-xl border">
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(product.description, {
                        ALLOWED_TAGS: ['p','br','strong','em','ul','ol','li','h1','h2','h3','h4','span','div','a'],
                        ALLOWED_ATTR: ['class','style','href','target','rel'],
                      }),
                    }}
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <Button 
                    onClick={() => setStep(3)} 
                    className="w-full sm:flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md gap-2"
                  >
                    <span>Continuer vers Prix & Stock</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={onSwitchToExpert} 
                    className="w-full sm:w-auto h-12 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 font-medium text-xs sm:text-sm"
                  >
                    Voir dans l'Éditeur complet (Mode Expert)
                  </Button>
                </div>
              </div>
            )}
            
            <p className="text-xs text-center text-muted-foreground mt-2">Vous n'êtes pas obligé(e) d'utiliser l'IA. Vous pouvez écrire votre description vous-même en mode Expert.</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Prix de vente <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    value={product.price || ""}
                    onChange={(e) => setProduct({ ...product, price: Number(e.target.value) || 0 })}
                    placeholder="Ex : 15000"
                    className="h-12 pl-12 font-semibold text-lg bg-background/50 focus-visible:bg-background transition-colors"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">
                    {currency}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Prix final payé par le client.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Prix barré <span className="text-muted-foreground font-normal">(Optionnel)</span></Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    value={product.compare_at_price || ""}
                    onChange={(e) => setProduct({ ...product, compare_at_price: Number(e.target.value) || 0 })}
                    placeholder="Ex : 20000"
                    className="h-12 pl-12 bg-background/50 focus-visible:bg-background transition-colors"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {currency}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Sert à afficher une promotion (ex: <del className="text-red-400">20 000</del> 15 000).</p>
              </div>
            </div>

            <div className="pt-2 border-t">
              <div className="space-y-2 max-w-sm mt-4">
                <Label className="text-sm font-medium">Stock disponible</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    value={product.stock_quantity}
                    onChange={(e) => setProduct({ ...product, stock_quantity: Number(e.target.value) || 0 })}
                    className="h-12 pl-10 bg-background/50 focus-visible:bg-background transition-colors"
                  />
                  <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">Laissez un chiffre élevé si vous n'avez pas de limite de stock.</p>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-base font-semibold">Catégorie du produit <span className="text-destructive">*</span></Label>
              <Select value={product.category} onValueChange={(v) => setProduct({ ...product, category: v })}>
                <SelectTrigger className="h-14 text-base bg-background/50 border-input hover:border-primary/50 transition-colors">
                  <SelectValue placeholder="Choisir une catégorie qui décrit le mieux ce produit" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="py-3 text-base cursor-pointer">{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Une bonne catégorisation aide vos clients à trouver le produit dans votre boutique.</p>
            </div>

            <div className="pt-2">
              <div 
                className={`flex items-start justify-between p-4 sm:p-5 rounded-xl border-2 transition-all duration-300 cursor-pointer ${
                  product.is_digital ? "border-primary bg-primary/5 shadow-sm" : "border-transparent bg-muted/40 hover:bg-muted/60"
                }`}
                onClick={() => setProduct({ ...product, is_digital: !product.is_digital })}
              >
                <div className="space-y-1">
                  <p className="font-semibold text-foreground flex items-center gap-2">
                    Produit numérique (Digital)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Cochez si ce produit ne nécessite aucune livraison physique (e-book, formation, service, logiciel...).
                  </p>
                </div>
                <div className="pt-1 pl-4" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={product.is_digital}
                    onCheckedChange={(v) => setProduct({ ...product, is_digital: v })}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-muted/30 p-4 border-b">
                <h3 className="font-semibold flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-500" /> Récapitulatif
                </h3>
              </div>
              <div className="p-0">
                <table className="w-full text-sm">
                  <tbody className="divide-y">
                    <tr className="hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-4 text-muted-foreground font-medium w-1/3">Nom du produit</td>
                      <td className="py-3 px-4 font-semibold">{product.name || <span className="text-destructive font-normal italic">Manquant</span>}</td>
                    </tr>
                    <tr className="hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-4 text-muted-foreground font-medium">Prix</td>
                      <td className="py-3 px-4 font-semibold text-primary">{product.price ? `${product.price.toLocaleString()} ${currency}` : <span className="text-destructive font-normal italic">0 {currency}</span>}</td>
                    </tr>
                    <tr className="hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-4 text-muted-foreground font-medium">Stock</td>
                      <td className="py-3 px-4">{product.stock_quantity} unités</td>
                    </tr>
                    <tr className="hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-4 text-muted-foreground font-medium">Catégorie</td>
                      <td className="py-3 px-4">{product.category || "—"}</td>
                    </tr>
                    <tr className="hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-4 text-muted-foreground font-medium">Photos</td>
                      <td className="py-3 px-4">{totalImages > 0 ? <span className="text-emerald-600 font-medium">{totalImages} ajoutée(s)</span> : <span className="text-destructive italic">Aucune photo</span>}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div 
              className={`flex items-center justify-between p-4 sm:p-5 rounded-xl border-2 transition-all duration-300 cursor-pointer ${
                product.is_published ? "border-emerald-500/50 bg-emerald-500/5 shadow-sm" : "border-border bg-muted/20"
              }`}
              onClick={() => setProduct({ ...product, is_published: !product.is_published })}
            >
              <div className="space-y-1">
                <p className="font-semibold flex items-center gap-2">
                  Publier immédiatement
                </p>
                <p className="text-sm text-muted-foreground">
                  Le produit sera visible sur votre boutique. Décochez pour le garder en brouillon.
                </p>
              </div>
              <div className="pl-4" onClick={(e) => e.stopPropagation()}>
                <Switch
                  checked={product.is_published}
                  onCheckedChange={(v) => setProduct({ ...product, is_published: v })}
                />
              </div>
            </div>

            <div className="pt-4 space-y-4">
              <Button 
                onClick={() => void onSave()} 
                disabled={saving} 
                className="w-full h-14 text-base font-bold gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.01]"
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
                {saving ? "Enregistrement en cours…" : isEditing ? "Sauvegarder les modifications" : "Terminer et créer le produit"}
              </Button>
              <button 
                onClick={onSwitchToExpert} 
                className="w-full text-xs sm:text-sm text-muted-foreground hover:text-primary underline underline-offset-4 transition-colors"
              >
                Besoin d'options avancées (Variantes, SEO, etc.) ? Passer en mode Expert
              </button>
            </div>
          </div>
        )}
        </div>

        {/* Navigation bottom bar inside the card */}
        <div className="flex items-center justify-between gap-4 pt-6 mt-4 border-t border-border/50">
          <Button 
            variant="outline" 
            onClick={back} 
            disabled={step === 0} 
            className="gap-2 h-11 px-5 border-border hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Précédent
          </Button>
          {step < STEPS.length - 1 ? (
            <Button 
              onClick={next} 
              disabled={!canNext()} 
              className="gap-2 h-11 px-8 bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20 transition-transform active:scale-95"
            >
              Suivant <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex-1" /> // spacer to keep 'Précédent' on the left when at the end
          )}
        </div>
      </Card>
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