import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Brain, Loader2, Sparkles, TrendingUp, Users, ShoppingCart, AlertTriangle, CheckCircle2, Copy } from "lucide-react";

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
  const [enabled, setEnabled] = useState<boolean>(!!shop.ai_optimizer_enabled);
  const [savingToggle, setSavingToggle] = useState(false);
  const [productId, setProductId] = useState<string>(products[0]?.id ?? "");
  const [framework, setFramework] = useState<string>("hormozi");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [history, setHistory] = useState<Analysis[]>([]);

  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId]);

  useEffect(() => { setEnabled(!!shop.ai_optimizer_enabled); }, [shop.ai_optimizer_enabled]);

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

  const toggleEnabled = async (v: boolean) => {
    setSavingToggle(true);
    const { error } = await supabase.from("shops").update({ ai_optimizer_enabled: v }).eq("id", shop.id);
    setSavingToggle(false);
    if (error) { toast.error("Erreur de sauvegarde"); return; }
    setEnabled(v);
    onShopUpdate?.({ ai_optimizer_enabled: v });
    toast.success(v ? "Équipe IA activée" : "Équipe IA désactivée");
  };

  const runAnalysis = async () => {
    if (!productId) { toast.error("Choisissez un produit"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("product-ai-optimizer", {
        body: { shop_id: shop.id, product_id: productId, framework },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erreur");
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
          Une équipe d'agents IA analyse votre fiche produit, le trafic et les commandes pour vous proposer un plan d'action concret (méthodes Alex Hormozi, PAS, AIDA).
        </p>
      </div>

      {/* Activation */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-base font-semibold">Activer l'équipe d'agents IA</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Analyse automatique du trafic vs commandes, détection des freins à l'achat et propositions d'amélioration.
            </p>
          </div>
          <Switch checked={enabled} disabled={savingToggle} onCheckedChange={toggleEnabled} />
        </div>
      </Card>

      {enabled && (
        <>
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
        </>
      )}
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