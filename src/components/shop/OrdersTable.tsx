import { CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DISPATCH_STATUS_LABELS } from "@/components/delivery/DispatchTrackingBoard";
import { cleanSelectedVariants } from "@/lib/productVariants";
import type { ShopOrder } from "@/lib/shopOrders";
import type { ShopDispatchSummary } from "@/types/delivery";
import { deliveryStatusLabel, shippingOptions } from "./orderDisplay";
import { ContactButtons, OrderMoreMenu, OrderStatusSelect, ShipMenu } from "./OrderActions";

interface Props {
  orders: ShopOrder[];
  activeDispatches: Map<string, ShopDispatchSummary>;
  dispatchesLoading: boolean;
  /** Libellé court et couleur de la date de livraison prévue. */
  deliveryDate: (date?: string | null) => { short: string; className: string };
  copiedId: string | null;
  onMarkRead: (orderId: string) => void;
  onStatusChange: (orderId: string, status: string) => void;
  onCopy: (order: ShopOrder) => void;
  onSchedule: (order: ShopOrder) => void;
  onShip: (order: ShopOrder) => void;
  onTransmit: (order: ShopOrder) => void;
  onShowTracking: () => void;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

/** Articles d'une commande en texte ; à défaut, le résumé des anciennes commandes. */
function itemLines(order: ShopOrder): string[] {
  if (order.order_items?.length) {
    return order.order_items.map((item) => {
      const variants = Object.entries(cleanSelectedVariants(item.selected_variants) || {}).map(([k, v]) => `${k}: ${v}`).join(", ");
      return `${item.quantity}x ${item.product_name}${variants ? ` · ${variants}` : ""}`;
    });
  }
  return order.products_summary ? order.products_summary.split(" ; ") : [];
}

/** Vue en liste : une ligne par commande, avec les mêmes actions que les cartes. */
export function OrdersTable({
  orders, activeDispatches, dispatchesLoading, deliveryDate, copiedId,
  onMarkRead, onStatusChange, onCopy, onSchedule, onShip, onTransmit, onShowTracking,
}: Props) {
  return (
    <Card className="overflow-hidden rounded-xl">
      {/* Le tableau défile horizontalement sur les petits écrans. */}
      <Table className="min-w-[960px] text-xs [&_th]:h-9 [&_th]:px-2 [&_td]:px-2 [&_td]:py-2 [&_td]:align-top">
        <TableHeader>
          <TableRow>
            <TableHead>Commande</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Articles</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Livraison</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const dispatch = activeDispatches.get(order.id);
            const { canSend, canTransmit } = shippingOptions(order, dispatch, dispatchesLoading);
            const lines = itemLines(order);
            const due = deliveryDate(order.scheduled_delivery_date);
            const own = order.order_deliveries?.at(-1);
            const location = [order.customer_city, order.customer_address].filter(Boolean).join(" · ");
            return (
              <TableRow
                key={order.id}
                className={!order.is_read ? "bg-primary/5" : undefined}
                onClick={() => !order.is_read && onMarkRead(order.id)}
              >
                <TableCell className={`whitespace-nowrap ${!order.is_read ? "border-l-4 border-l-primary" : ""}`}>
                  <p className="flex items-center gap-1.5 font-bold">
                    {!order.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Non lue" />}
                    #{order.sequence}
                  </p>
                  <p className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">{order.order_number}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </TableCell>
                <TableCell className="max-w-[180px]">
                  <p className="truncate font-semibold" title={order.customer_name}>{order.customer_name}</p>
                  <p className="whitespace-nowrap text-muted-foreground">{order.customer_phone}</p>
                  {location && <p className="truncate text-muted-foreground" title={location}>{location}</p>}
                </TableCell>
                <TableCell className="max-w-[180px]">
                  {lines.length > 0 ? (
                    <div title={lines.join("\n")}>
                      <p className="line-clamp-2">{lines[0]}</p>
                      {lines.length > 1 && <p className="text-muted-foreground">+ {lines.length - 1} autre{lines.length > 2 ? "s" : ""}</p>}
                    </div>
                  ) : <p className="text-muted-foreground">Aucun article détaillé</p>}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <p className="whitespace-nowrap font-black">{fmt(order.total)} FCFA</p>
                  <p className="text-[10px] text-muted-foreground">{order.payment_method === "mobile_money" ? "Mobile Money" : "À la livraison"}</p>
                  {order.promo_code && Number(order.discount_amount) > 0 && (
                    <p className="text-[10px] font-medium text-emerald-700">{order.promo_code} : -{fmt(Number(order.discount_amount))}</p>
                  )}
                </TableCell>
                <TableCell>
                  <OrderStatusSelect order={order} onChange={(v) => onStatusChange(order.id, v)} className="w-[128px]" />
                </TableCell>
                <TableCell className="max-w-[170px] space-y-1">
                  <button
                    type="button"
                    className="flex max-w-full items-center gap-1 text-left"
                    title={order.internal_delivery_note ? `${order.internal_delivery_note} — modifier` : "Planifier la livraison"}
                    onClick={(e) => { e.stopPropagation(); onSchedule(order); }}
                  >
                    <Badge className={`gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[10px] font-semibold ${due.className}`}>
                      <CalendarDays className="h-3 w-3 shrink-0" /> {due.short}
                    </Badge>
                  </button>
                  {own && (
                    <p className="truncate text-[11px] text-blue-700 dark:text-blue-300" title={own.failure_reason ?? undefined}>
                      {deliveryStatusLabel(own.status, !!own.driver)}{own.driver ? ` · ${own.driver.name}` : ""}
                    </p>
                  )}
                  {dispatch && (
                    <button
                      type="button"
                      className="block max-w-full truncate text-left text-[11px] font-medium text-emerald-700 hover:underline dark:text-emerald-300"
                      title="Voir le suivi"
                      onClick={(e) => { e.stopPropagation(); onShowTracking(); }}
                    >
                      {dispatch.company?.company_name ?? "Structure"} · {DISPATCH_STATUS_LABELS[dispatch.status] ?? dispatch.status}
                    </button>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <ContactButtons order={order} compact />
                    <ShipMenu canSend={canSend} canTransmit={canTransmit} onShip={() => onShip(order)} onTransmit={() => onTransmit(order)} compact />
                    <OrderMoreMenu order={order} copied={copiedId === order.id} onCopy={() => onCopy(order)} onSchedule={() => onSchedule(order)}
                      onMarkRead={() => onMarkRead(order.id)} onShowTracking={dispatch ? onShowTracking : undefined} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
