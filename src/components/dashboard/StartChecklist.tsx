import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Check, ChevronRight, Store, Package, Palette, ShoppingBag, X, Search, Share2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Step = {
  key: string;
  label: string;
  desc: string;
  icon: typeof Store;
  route?: string;
  action?: () => void;
  done: boolean;
};

const DISMISS_KEY = "vp_start_checklist_dismissed_v2";
const LEGACY_DISMISS_KEY = "vp_start_checklist_dismissed";

if (typeof window !== "undefined") {
  // One-time reset: anciens utilisateurs qui avaient fermé la checklist
  // la retrouvent automatiquement (dismiss devient session-only).
  try {
    window.localStorage.removeItem(LEGACY_DISMISS_KEY);
    window.localStorage.removeItem(DISMISS_KEY);
  } catch {}
}

export function StartChecklist({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState<null | "share" | "product">(null);
  const [products, setProducts] = useState<Array<{ id: string; name: string; shop_id: string; shop_subdomain: string | null }>>([]);
  const [shopForCreate, setShopForCreate] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dismissed, setDismissed] = useState<boolean>(
    typeof window !== "undefined" && sessionStorage.getItem(DISMISS_KEY) === "1"
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sb: any = supabase;
      const shopsRes = await sb
        .from("shops")
        .select("id, subdomain, logo_url, primary_color")
        .eq("user_id", userId);
      const shops = shopsRes.data as Array<{ id: string; subdomain: string | null; logo_url: string | null; primary_color: string | null }> | null;
      const shopIds = (shops ?? []).map((s) => s.id);
      let productsData: Array<{ id: string; name: string; shop_id: string }> = [];
      let ordersCount = 0;
      if (shopIds.length > 0) {
        const [prodRes, ordRes] = await Promise.all([
          sb.from("products").select("id, name, shop_id").in("shop_id", shopIds).order("created_at", { ascending: false }),
          sb.from("orders").select("id", { count: "exact", head: true }).in("shop_id", shopIds),
        ]);
        productsData = (prodRes.data as Array<{ id: string; name: string; shop_id: string }> | null) ?? [];
        ordersCount = (ordRes as any).count ?? 0;
      }
      if (cancelled) return;
      const shop = shops?.[0];
      const customized = !!(shop?.logo_url || shop?.primary_color);
      const subdomainById = new Map((shops ?? []).map((s) => [s.id, s.subdomain] as const));
      setProducts(
        productsData.map((p) => ({ ...p, shop_subdomain: subdomainById.get(p.shop_id) ?? null }))
      );
      setShopForCreate(shop?.id ?? null);
      setSteps([
        {
          key: "shop",
          label: "Créez votre boutique",
          desc: "Configurez nom, contact et description",
          icon: Store,
          route: shop ? `/shop-editor/${shop.id}` : "/shop-manager",
          done: !!shop,
        },
        {
          key: "product",
          label: "Ajoutez votre premier produit",
          desc: "Photos, prix et description en quelques clics",
          icon: Package,
          action: () => {
            if (!shop) {
              navigate("/shop-manager");
              return;
            }
            navigate(`/shop-editor/${shop.id}?new=product`);
          },
          done: productsData.length > 0,
        },
        {
          key: "brand",
          label: "Personnalisez votre identité",
          desc: "Logo et couleurs de votre boutique",
          icon: Palette,
          route: shop ? `/shop-editor/${shop.id}` : "/shop-manager",
          done: customized,
        },
        {
          key: "order",
          label: "Recevez votre première commande",
          desc: "Partagez votre lien sur WhatsApp et réseaux sociaux",
          icon: ShoppingBag,
          action: () => {
            if (productsData.length === 0) {
              if (!shop) navigate("/shop-manager");
              else navigate(`/shop-editor/${shop.id}?new=product`);
              return;
            }
            setQuery("");
            setPickerOpen("share");
          },
          done: ordersCount > 0,
        },
      ]);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, query]);

  if (dismissed || !steps) return null;
  const done = steps.filter((s) => s.done).length;
  const total = steps.length;
  if (done === total) return null;
  const pct = Math.round((done / total) * 100);

  const buildProductUrl = (p: { id: string; shop_subdomain: string | null }) => {
    const base = `${window.location.origin}`;
    if (p.shop_subdomain) return `${base}/shop/${p.shop_subdomain}/product/${p.id}`;
    return `${base}/product/${p.id}`;
  };

  const handleShare = async (p: { id: string; name: string; shop_subdomain: string | null }) => {
    const url = buildProductUrl(p);
    try {
      if (navigator.share) {
        await navigator.share({ title: p.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Lien copié", { description: url });
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Lien copié", { description: url });
      } catch {
        toast.error("Impossible de partager", { description: url });
      }
    }
  };

  return (
    <Card className="relative overflow-hidden border-2 border-primary/10 bg-gradient-to-br from-primary/5 via-background to-secondary/5 mb-8 animate-fade-in">
      <button
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
        className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors"
        aria-label="Fermer"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
      <div className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4 mb-4 pr-6">
          <div>
            <h2 className="text-lg md:text-xl font-bold text-foreground">Commencez dès maintenant</h2>
            <p className="text-sm text-muted-foreground">
              {done} sur {total} étapes complétées
            </p>
          </div>
          <div className="text-2xl font-bold text-primary tabular-nums">{pct}%</div>
        </div>
        <Progress value={pct} className="h-2 mb-5" />
        <ul className="space-y-2">
          {steps.map((s) => (
            <li key={s.key}>
              <button
                onClick={() => {
                  if (s.action) s.action();
                  else if (s.route) navigate(s.route);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                  s.done
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40"
                    : "bg-card border-border hover:border-primary/40 hover:bg-muted/40"
                }`}
              >
                <div
                  className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                    s.done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.done ? <Check className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-sm ${s.done ? "text-emerald-700 dark:text-emerald-300 line-through" : "text-foreground"}`}>
                    {s.label}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{s.desc}</div>
                </div>
                {!s.done && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <Dialog open={pickerOpen === "share"} onOpenChange={(o) => !o && setPickerOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Choisissez un produit à partager</DialogTitle>
            <DialogDescription>
              Sélectionnez le produit dont vous voulez copier le lien à diffuser sur WhatsApp et vos réseaux.
            </DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un produit..."
              className="pl-9"
            />
          </div>
          <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1 space-y-1">
            {filteredProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucun produit trouvé
              </p>
            ) : (
              filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleShare(p)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/40 transition-colors text-left"
                >
                  <div className="shrink-0 w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {buildProductUrl(p).replace(/^https?:\/\//, "")}
                    </div>
                  </div>
                  <Share2 className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}