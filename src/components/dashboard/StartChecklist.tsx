import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Check, ChevronRight, Store, Package, Palette, ShoppingBag, X } from "lucide-react";

type Step = {
  key: string;
  label: string;
  desc: string;
  icon: typeof Store;
  route: string;
  done: boolean;
};

const DISMISS_KEY = "vp_start_checklist_dismissed";

export function StartChecklist({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(
    typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1"
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const shopsRes: any = await supabase.from("shops").select("id, logo_url, primary_color").eq("user_id", userId).limit(1);
      const productsRes: any = await supabase.from("products").select("id").eq("user_id", userId).limit(1);
      const ordersRes: any = await supabase.from("orders").select("id").eq("user_id", userId).limit(1);
      const shops = shopsRes.data as Array<{ id: string; logo_url: string | null; primary_color: string | null }> | null;
      const products = productsRes.data as Array<{ id: string }> | null;
      const orders = ordersRes.data as Array<{ id: string }> | null;
      if (cancelled) return;
      const shop = shops?.[0];
      const customized = !!(shop?.logo_url || shop?.primary_color);
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
          route: shop ? `/shop-editor/${shop.id}` : "/shop-manager",
          done: !!(products && products.length > 0),
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
          route: shop ? `/shop-editor/${shop.id}` : "/shop-manager",
          done: !!(orders && orders.length > 0),
        },
      ]);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (dismissed || !steps) return null;
  const done = steps.filter((s) => s.done).length;
  const total = steps.length;
  if (done === total) return null;
  const pct = Math.round((done / total) * 100);

  return (
    <Card className="relative overflow-hidden border-2 border-primary/10 bg-gradient-to-br from-primary/5 via-background to-secondary/5 mb-8 animate-fade-in">
      <button
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
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
                onClick={() => navigate(s.route)}
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
    </Card>
  );
}