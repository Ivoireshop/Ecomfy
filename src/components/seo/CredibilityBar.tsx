import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Stat = { key: string; value: number; label: string; sort_order: number };

const FALLBACK: Stat[] = [
  { key: "visuals_generated", value: 979, label: "Visuels générés", sort_order: 1 },
  { key: "shops_created", value: 120, label: "Boutiques créées", sort_order: 2 },
  { key: "entrepreneurs_supported", value: 350, label: "Entrepreneurs accompagnés", sort_order: 3 },
  { key: "videos_created", value: 45, label: "Vidéos publicitaires créées", sort_order: 4 },
];

const fmt = (n: number) => {
  if (n >= 1000) return `${Math.floor(n / 100) / 10}k+`;
  return `${n}+`;
};

export function CredibilityBar() {
  const [stats, setStats] = useState<Stat[]>(FALLBACK);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("platform_stats" as any)
        .select("key,value,label,sort_order")
        .order("sort_order", { ascending: true });
      if (alive && Array.isArray(data) && data.length) setStats(data as unknown as Stat[]);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section
      aria-label="VisualPro en chiffres"
      className="border-y bg-muted/30"
    >
      <div className="container mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 py-6 px-4">
        {stats.map((s) => (
          <div key={s.key} className="text-center">
            <div className="text-2xl md:text-3xl font-bold text-primary">{fmt(s.value)}</div>
            <div className="text-xs md:text-sm text-muted-foreground mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}