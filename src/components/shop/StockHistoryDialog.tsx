import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchStockMovements, MOVEMENT_LABELS, PAGE_SIZE, type StockMovementRow } from "@/lib/stockQr";

interface StockHistoryDialogProps {
  open: boolean;
  shopId: string;
  /** Si fourni, l'historique est limité à ce produit. */
  product?: { id: string; name: string } | null;
  onClose: () => void;
}

const TYPE_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Tous les mouvements" },
  { value: "restock", label: MOVEMENT_LABELS.restock },
  { value: "adjustment", label: MOVEMENT_LABELS.adjustment },
  { value: "driver_handover", label: MOVEMENT_LABELS.driver_handover },
  { value: "return_restock", label: MOVEMENT_LABELS.return_restock },
  { value: "damaged", label: MOVEMENT_LABELS.damaged },
];

/** Journal des mouvements de stock (entrées, sorties, prises en charge livreur, retours). */
export function StockHistoryDialog({ open, shopId, product, onClose }: StockHistoryDialogProps) {
  const [rows, setRows] = useState<StockMovementRow[]>([]);
  const [type, setType] = useState("all");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (from: number) => {
    setLoading(true);
    const res = await fetchStockMovements({
      shopId, productId: product?.id, type: type === "all" ? undefined : type, from,
    });
    setLoading(false);
    setError(res.error);
    setRows((prev) => (from === 0 ? res.rows : [...prev, ...res.rows]));
    setHasMore(res.rows.length === PAGE_SIZE);
  }, [shopId, product?.id, type]);

  useEffect(() => {
    if (open) void load(0);
    else setType("all"); // le filtre ne doit pas survivre à la fermeture
  }, [open, load]);

  const fmt = (d: string) =>
    new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historique du stock{product ? ` — ${product.name}` : ""}</DialogTitle>
          <DialogDescription>Entrées, sorties, prises en charge par le livreur et retours, du plus récent au plus ancien.</DialogDescription>
        </DialogHeader>

        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TYPE_FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {error && <p className="text-sm text-destructive">Chargement impossible : {error}</p>}

        {!error && !loading && rows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun mouvement pour le moment.</p>
        )}

        <ul className="divide-y">
          {rows.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                {!product && <p className="truncate text-sm font-semibold">{m.products?.name ?? "Produit supprimé"}</p>}
                <p className="text-sm">{MOVEMENT_LABELS[m.movement_type] ?? m.movement_type}</p>
                <p className="text-xs text-muted-foreground">
                  {fmt(m.created_at)}
                  {m.orders?.order_number ? ` · commande ${m.orders.order_number}` : ""}
                  {m.notes ? ` · ${m.notes}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Badge variant={m.quantity > 0 ? "default" : "destructive"}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</Badge>
                <p className="mt-1 text-xs text-muted-foreground">{m.previous_stock} → {m.new_stock}</p>
              </div>
            </li>
          ))}
        </ul>

        {loading && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {hasMore && !loading && (
          <Button variant="outline" onClick={() => load(rows.length)}>Charger plus</Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
