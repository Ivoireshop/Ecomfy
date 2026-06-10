import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Brain, Loader2, Sparkles, TrendingUp, Users, ShoppingCart, AlertTriangle, CheckCircle2, Copy, Upload, Download, ImageIcon, Wand2, Trash2 } from "lucide-react";
import { handleCreditsRequired } from "@/lib/creditsDialog";

type Product = { id: string; name: string; price: number; is_published: boolean };
type Shop = { id: string; ai_optimizer_enabled?: boolean; currency?: string };

interface Props {
  shop: Shop;
  products: Product[];
  onShopUpdate?: (patch: Partial<Shop>) => void;
}

type Recommendation = {
  title: string;
  category: string;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  action: string;
};

type Analysis = {
  id: string;
  product_id: string | null;
  framework: string;
  visitors_count: number;
  orders_count: number;
  conversion_rate: number;
  diagnosis: string | null;
  recommendations: Recommendation[];
  rewritten_copy: any;
  created_at: string;
};

const IMPACT_COLORS: Record<string, string> = {
  high: "bg-red-500/10 text-red-600 border-red-200",
  medium: "bg-orange-500/10 text-orange-600 border-orange-200",
  low: "bg-blue-500/10 text-blue-600 border-blue-200",
};

export function ProductAIOptimizer({ shop, products, onShopUpdate }: Props) {
  const [productId, setProductId] = useState<string>(products[0]?.id ?? "");
  const [framework, setFramework] = useState<string>("hormozi");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [history, setHistory] = useState<Analysis[]>([]);

  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId]);

  useEffect(() => {
    if (!productId) return;
    (async () => {
      const { data } = await supabase
        .from("product_ai_analyses")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(5);
      setHistory((data as any) || []);
      setAnalysis(((data as any) || [])[0] ?? null);
    })();
  }, [productId]);

  const runAnalysis = async () => {
    if (!productId) { toast.error("Choisissez un produit"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("product-ai-optimizer", {
        body: { shop_id: shop.id, product_id: productId, framework },
      });
      if (error) throw error;
      if (!data?.success) {
        if (handleCreditsRequired(data)) return;
        throw new Error(data?.message || data?.error || "Erreur");
      }
      const a = { ...data.analysis, ...data.parsed } as Analysis;
      setAnalysis(a);
      setHistory((h) => [a, ...h].slice(0, 5));
      toast.success("Analyse terminée");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de l'analyse");
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié");
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          Équipe d'agents IA – Optimisation des conversions
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Optimisez une fiche existante ou créez une fiche complète à partir de zéro avec images générées (méthodes Alex Hormozi, PAS, AIDA).
        </p>
      </div>

      <Tabs defaultValue="optimize" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="optimize" className="gap-1.5"><Brain className="h-3.5 w-3.5" />Optimiser</TabsTrigger>
          <TabsTrigger value="create" className="gap-1.5"><Wand2 className="h-3.5 w-3.5" />Créer une fiche</TabsTrigger>
        </TabsList>

        <TabsContent value="optimize" className="space-y-6 mt-6">
          {/* Controls */}
          <Card className="p-5 space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Label>Produit à analyser</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Choisir un produit" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Framework</Label>
                <Select value={framework} onValueChange={setFramework}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hormozi">Alex Hormozi (Grand Slam Offer)</SelectItem>
                    <SelectItem value="pas">PAS (Problème · Agitation · Solution)</SelectItem>
                    <SelectItem value="aida">AIDA (Attention · Intérêt · Désir · Action)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={runAnalysis} disabled={loading || !productId} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Analyse en cours..." : "Lancer l'analyse"}
            </Button>
          </Card>

          {analysis && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs"><Users className="h-3.5 w-3.5" /> Visiteurs (30j)</div>
                  <div className="text-2xl font-bold mt-1">{analysis.visitors_count}</div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs"><ShoppingCart className="h-3.5 w-3.5" /> Commandes</div>
                  <div className="text-2xl font-bold mt-1">{analysis.orders_count}</div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs"><TrendingUp className="h-3.5 w-3.5" /> Conversion</div>
                  <div className="text-2xl font-bold mt-1">{analysis.conversion_rate}%</div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs"><AlertTriangle className="h-3.5 w-3.5" /> Benchmark</div>
                  <div className="text-sm font-semibold mt-1">
                    {analysis.conversion_rate < 1 ? "Faible" : analysis.conversion_rate < 3 ? "À améliorer" : analysis.conversion_rate < 5 ? "Correct" : "Excellent"}
                  </div>
                </Card>
              </div>

              {/* Diagnosis */}
              {analysis.diagnosis && (
                <Card className="p-5 border-l-4 border-l-primary">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">Diagnostic</h3>
                  </div>
                  <p className="text-sm leading-relaxed">{analysis.diagnosis}</p>
                </Card>
              )}

              {/* Recommendations */}
              {analysis.recommendations?.length > 0 && (
                <Card className="p-5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Plan d'action priorisé
                  </h3>
                  <div className="space-y-3">
                    {analysis.recommendations.map((r, i) => (
                      <div key={i} className="border rounded-lg p-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{i + 1}. {r.title}</div>
                            <div className="text-sm text-muted-foreground mt-1">{r.action}</div>
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-xs">{r.category}</Badge>
                            <Badge className={`text-xs border ${IMPACT_COLORS[r.impact] || ""}`}>Impact {r.impact}</Badge>
                            <Badge variant="secondary" className="text-xs">Effort {r.effort}</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Rewritten copy */}
              {analysis.rewritten_copy && (
                <Card className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Fiche produit réécrite</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    {analysis.rewritten_copy.headline && (
                      <Block label="Titre" value={analysis.rewritten_copy.headline} onCopy={copy} />
                    )}
                    {analysis.rewritten_copy.subheadline && (
                      <Block label="Sous-titre" value={analysis.rewritten_copy.subheadline} onCopy={copy} />
                    )}
                    {Array.isArray(analysis.rewritten_copy.bullets) && analysis.rewritten_copy.bullets.length > 0 && (
                      <Block label="Bénéfices" value={analysis.rewritten_copy.bullets.map((b: string) => `• ${b}`).join("\n")} onCopy={copy} multiline />
                    )}
                    {analysis.rewritten_copy.guarantee && (
                      <Block label="Garantie" value={analysis.rewritten_copy.guarantee} onCopy={copy} />
                    )}
                    {analysis.rewritten_copy.urgency && (
                      <Block label="Urgence / Rareté" value={analysis.rewritten_copy.urgency} onCopy={copy} />
                    )}
                    {analysis.rewritten_copy.cta && (
                      <Block label="Bouton d'action" value={analysis.rewritten_copy.cta} onCopy={copy} />
                    )}
                  </div>
                </Card>
              )}

              {history.length > 1 && (
                <Card className="p-5">
                  <h3 className="font-semibold mb-3">Historique récent</h3>
                  <div className="space-y-2">
                    {history.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => setAnalysis(h)}
                        className="w-full text-left text-sm p-2 hover:bg-muted/50 rounded flex items-center justify-between"
                      >
                        <span>{new Date(h.created_at).toLocaleString("fr-FR")} · {h.framework}</span>
                        <span className="text-muted-foreground">{h.conversion_rate}% conversion</span>
                      </button>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="create" className="mt-6">
          <CreateSheetPanel shop={shop} onCopy={copy} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Block({ label, value, onCopy, multiline }: { label: string; value: string; onCopy: (s: string) => void; multiline?: boolean }) {
  return (
    <div className="border rounded-lg p-3 bg-muted/30">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
        <Button variant="ghost" size="sm" onClick={() => onCopy(value)} className="h-7 gap-1">
          <Copy className="h-3 w-3" /> Copier
        </Button>
      </div>
      <div className={multiline ? "whitespace-pre-line" : ""}>{value}</div>
    </div>
  );
}

// ===============================================================
// Nouveau panneau : création d'une fiche produit complète
// ===============================================================

type GeneratedSheet = {
  headline?: string;
  subheadline?: string;
  short_description?: string;
  long_description?: string;
  bullets?: string[];
  features?: string[];
  guarantee?: string;
  urgency?: string;
  cta?: string;
  faq?: Array<{ q: string; a: string }>;
  seo_title?: string;
  seo_description?: string;
};

type GeneratedImage = { title: string; url: string | null; prompt: string; why?: string; error?: string };

function CreateSheetPanel({ shop, onCopy }: { shop: Shop; onCopy: (s: string) => void }) {
  const STORAGE_KEY = `vp_product_sheet_draft_${shop.id}`;

  // Restaure le brouillon depuis localStorage à l'initialisation
  const restored = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  const [name, setName] = useState<string>(restored?.name ?? "");
  const [price, setPrice] = useState<string>(restored?.price ?? "");
  const [category, setCategory] = useState<string>(restored?.category ?? "");
  const [audience, setAudience] = useState<string>(restored?.audience ?? "");
  const [brief, setBrief] = useState<string>(restored?.brief ?? "");
  const [framework, setFramework] = useState<string>(restored?.framework ?? "hormozi");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(restored?.imagePreview ?? null);
  const [generateImages, setGenerateImages] = useState(true);
  const [imageCount, setImageCount] = useState<number>(restored?.imageCount ?? 5);
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState<GeneratedSheet | null>(restored?.sheet ?? null);
  const [images, setImages] = useState<GeneratedImage[]>(restored?.images ?? []);

  // Sauvegarde automatique du brouillon à chaque modification
  useEffect(() => {
    try {
      const payload = { name, price, category, audience, brief, framework, imageCount, imagePreview, sheet, images };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }, [STORAGE_KEY, name, price, category, audience, brief, framework, imageCount, imagePreview, sheet, images]);

  const resetDraft = () => {
    if (!confirm("Effacer la fiche produit générée et tout recommencer ?")) return;
    setName(""); setPrice(""); setCategory(""); setAudience(""); setBrief("");
    setFramework("hormozi"); setImageCount(5);
    setImageFile(null); setImagePreview(null);
    setSheet(null); setImages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    toast.success("Fiche réinitialisée");
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve((r.result as string).split(",")[1] || "");
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const onPickImage = (f: File | null) => {
    setImageFile(f);
    if (!f) { setImagePreview(null); return; }
    const r = new FileReader();
    r.onload = () => setImagePreview(r.result as string);
    r.readAsDataURL(f);
  };

  const generate = async () => {
    if (!name.trim()) { toast.error("Renseignez au moins le nom du produit"); return; }
    setLoading(true);
    setSheet(null);
    setImages([]);
    try {
      let image_base64: string | undefined;
      let image_mime: string | undefined;
      if (imageFile) {
        image_base64 = await fileToBase64(imageFile);
        image_mime = imageFile.type;
      }
      const { data, error } = await supabase.functions.invoke("generate-product-sheet", {
        body: {
          name: name.trim(),
          price: price ? Number(price) : undefined,
          currency: shop.currency || "FCFA",
          category: category.trim(),
          target_audience: audience.trim(),
          brief: brief.trim(),
          framework,
          image_base64,
          image_mime,
          generate_images: generateImages,
          image_count: imageCount,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || data?.error || "Erreur");
      setSheet(data.sheet || {});
      setImages(Array.isArray(data.images) ? data.images : []);
      toast.success("Fiche produit générée");
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la génération");
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = async (url: string, title: string) => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${title.replace(/[^\w\-]+/g, "-").toLowerCase()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error("Téléchargement impossible");
    }
  };

  const copyAll = () => {
    if (!sheet) return;
    const parts = [
      sheet.headline && `# ${sheet.headline}`,
      sheet.subheadline,
      "",
      sheet.short_description,
      "",
      sheet.bullets?.length ? sheet.bullets.map((b) => `• ${b}`).join("\n") : "",
      "",
      sheet.long_description?.replace(/<[^>]+>/g, ""),
      "",
      sheet.guarantee && `✓ ${sheet.guarantee}`,
      sheet.urgency && `⏰ ${sheet.urgency}`,
      sheet.cta && `→ ${sheet.cta}`,
    ].filter(Boolean);
    onCopy(parts.join("\n"));
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Informations produit</h3>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Renseignez votre produit, l'IA rédige une fiche complète et génère des photos professionnelles que vous pourrez copier-coller dans votre boutique.
        </p>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Nom du produit *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Sérum éclat anti-tâches 30ml" className="mt-1.5" />
          </div>
          <div>
            <Label>Prix (FCFA)</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="15000" className="mt-1.5" />
          </div>
          <div>
            <Label>Catégorie</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Cosmétique, Mode, Tech…" className="mt-1.5" />
          </div>
          <div>
            <Label>Cible / clientèle</Label>
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Femmes 25-40 ans urbaines" className="mt-1.5" />
          </div>
        </div>

        <div>
          <Label>Brief / caractéristiques (optionnel)</Label>
          <Textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Décrivez le produit : composition, bénéfices, mode d'emploi, points forts vs concurrence…"
            className="mt-1.5 min-h-[100px]"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Image de référence (optionnelle)</Label>
            <label className="mt-1.5 flex items-center gap-2 px-3 py-2 border-2 border-dashed border-border rounded-md cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground truncate">
                {imageFile ? imageFile.name : "Charger une photo du produit"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickImage(e.target.files?.[0] || null)}
              />
            </label>
            {imagePreview && (
              <div className="mt-2 flex items-center gap-2">
                <img src={imagePreview} alt="" className="h-16 w-16 object-cover rounded border" />
                <Button variant="ghost" size="sm" onClick={() => onPickImage(null)}>Retirer</Button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div>
              <Label>Framework copywriting</Label>
              <Select value={framework} onValueChange={setFramework}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hormozi">Alex Hormozi (Grand Slam Offer)</SelectItem>
                  <SelectItem value="pas">PAS</SelectItem>
                  <SelectItem value="aida">AIDA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nombre d'images à générer</Label>
              <Select value={String(imageCount)} onValueChange={(v) => setImageCount(Number(v))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Aucune (texte seulement)</SelectItem>
                  <SelectItem value="3">3 images</SelectItem>
                  <SelectItem value="4">4 images</SelectItem>
                  <SelectItem value="5">5 images (recommandé)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => { setGenerateImages(imageCount > 0); generate(); }} disabled={loading || !name.trim()} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Génération en cours… (30-60s)" : (sheet ? "Régénérer la fiche" : "Générer la fiche produit")}
          </Button>
          {(sheet || images.length > 0) && (
            <Button type="button" variant="outline" onClick={resetDraft} className="gap-2">
              <Trash2 className="h-4 w-4" /> Réinitialiser
            </Button>
          )}
          {sheet && (
            <span className="text-xs text-muted-foreground">
              ✓ Fiche sauvegardée localement — elle restera ici même si vous quittez la page.
            </span>
          )}
        </div>
      </Card>

      {sheet && (
        <>
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Fiche produit générée</h3>
              <Button variant="outline" size="sm" onClick={copyAll} className="gap-1"><Copy className="h-3.5 w-3.5" /> Tout copier</Button>
            </div>
            <div className="space-y-3 text-sm">
              {sheet.headline && <Block label="Titre" value={sheet.headline} onCopy={onCopy} />}
              {sheet.subheadline && <Block label="Sous-titre" value={sheet.subheadline} onCopy={onCopy} />}
              {sheet.short_description && <Block label="Description courte" value={sheet.short_description} onCopy={onCopy} multiline />}
              {sheet.long_description && (
                <Block
                  label="Description longue (texte à copier-coller)"
                  value={sheet.long_description.replace(/<[^>]+>/g, "")}
                  onCopy={onCopy}
                  multiline
                />
              )}
              {Array.isArray(sheet.bullets) && sheet.bullets.length > 0 && (
                <Block label="Bénéfices" value={sheet.bullets.map((b) => `• ${b}`).join("\n")} onCopy={onCopy} multiline />
              )}
              {Array.isArray(sheet.features) && sheet.features.length > 0 && (
                <Block label="Caractéristiques" value={sheet.features.map((b) => `• ${b}`).join("\n")} onCopy={onCopy} multiline />
              )}
              {sheet.guarantee && <Block label="Garantie" value={sheet.guarantee} onCopy={onCopy} />}
              {sheet.urgency && <Block label="Urgence / Rareté" value={sheet.urgency} onCopy={onCopy} />}
              {sheet.cta && <Block label="Bouton d'action" value={sheet.cta} onCopy={onCopy} />}
              {Array.isArray(sheet.faq) && sheet.faq.length > 0 && (
                <Block
                  label="FAQ"
                  value={sheet.faq.map((f) => `Q: ${f.q}\nR: ${f.a}`).join("\n\n")}
                  onCopy={onCopy}
                  multiline
                />
              )}
              {sheet.seo_title && <Block label="SEO – Titre" value={sheet.seo_title} onCopy={onCopy} />}
              {sheet.seo_description && <Block label="SEO – Meta description" value={sheet.seo_description} onCopy={onCopy} />}
            </div>
          </Card>

          {images.length > 0 && (
            <Card className="p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-3"><ImageIcon className="h-4 w-4 text-primary" /> Visuels générés</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {images.map((img, i) => (
                  <div key={i} className="border rounded-lg overflow-hidden bg-muted/20">
                    {img.url ? (
                      <img src={img.url} alt={img.title} className="w-full aspect-square object-cover" />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center text-xs text-muted-foreground p-4 text-center">
                        Image non disponible{img.error ? ` (${img.error})` : ""}
                      </div>
                    )}
                    <div className="p-3 space-y-2">
                      <div className="font-medium text-sm">{img.title}</div>
                      {img.why && <div className="text-xs text-muted-foreground">{img.why}</div>}
                      <div className="flex gap-2">
                        {img.url && (
                          <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => downloadImage(img.url!, img.title)}>
                            <Download className="h-3.5 w-3.5" /> Télécharger
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="gap-1 h-8" onClick={() => onCopy(img.prompt)}>
                          <Copy className="h-3.5 w-3.5" /> Prompt
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Faites un clic droit sur l'image pour la copier, ou utilisez « Télécharger » puis importez-la dans votre fiche produit.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}