import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Phone, MessageCircle, MapPin, Mail, Home, User } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: "Nouveau", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  confirmed: { label: "Confirmé", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  processing: { label: "En traitement", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  shipped: { label: "Expédié", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  delivered: { label: "Livré", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  cancelled: { label: "Annulé", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_address: string | null;
  customer_city: string | null;
  total: number;
  payment_method: string;
  payment_status: string;
  order_status: string;
  is_read: boolean;
  created_at: string;
  order_items?: { id: string; product_name: string; quantity: number; unit_price: number; total_price: number; product_image_url: string | null; selected_variants?: Record<string, string> | null }[];
}

interface OrdersListProps {
  orders: Order[];
  onUpdateStatus: (orderId: string, status: string) => void;
  onMarkRead: (orderId: string) => void;
}

export function OrdersList({ orders, onUpdateStatus, onMarkRead }: OrdersListProps) {
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
  // Sequential numbering: oldest = #1, newest = #N (orders are passed in desc order)
  const sortedAsc = [...orders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const sequenceById: Record<string, number> = {};
  sortedAsc.forEach((o, i) => { sequenceById[o.id] = i + 1; });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Commandes ({orders.length})</h2>
      {orders.length === 0 ? (
        <Card className="p-12 text-center">
          <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-1">Aucune commande</h3>
          <p className="text-sm text-muted-foreground">Les commandes apparaîtront ici en temps réel</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id} className={`overflow-hidden ${!order.is_read ? 'ring-1 ring-primary' : ''}`} onClick={() => !order.is_read && onMarkRead(order.id)}>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {!order.is_read && <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />}
                     <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold">Commande #{sequenceById[order.id]}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{order.order_number}</span>
                      </div>
                      <div className="mt-1 grid gap-0.5 text-xs sm:text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 shrink-0" /> <span className="font-medium text-foreground">{order.customer_name}</span></span>
                        <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0" /> {order.customer_phone}</span>
                        {order.customer_city && (
                          <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" /> {order.customer_city}</span>
                        )}
                        {order.customer_address && (
                          <span className="flex items-center gap-1.5"><Home className="h-3.5 w-3.5 shrink-0" /> {order.customer_address}</span>
                        )}
                        {order.customer_email && (
                          <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 shrink-0" /> {order.customer_email}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{fmt(order.total)} FCFA</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
                {order.order_items && order.order_items.length > 0 && (
                  <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                    {order.order_items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5 text-xs whitespace-nowrap">
                        {item.product_image_url && <img src={item.product_image_url} alt="" className="h-6 w-6 rounded object-cover" />}
                        <span>{item.quantity}x {item.product_name}</span>
                        {item.selected_variants && Object.keys(item.selected_variants).length > 0 && (
                          <span className="text-primary font-medium">
                            ({Object.entries(item.selected_variants).map(([k, v]) => `${k}: ${v}`).join(", ")})
                          </span>
                        )}
                        <span className="text-muted-foreground">{fmt(item.total_price)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Select value={order.order_status} onValueChange={(v) => onUpdateStatus(order.id, v)}>
                    <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_MAP).map(([key, val]) => (
                        <SelectItem key={key} value={key}>{val.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Badge variant={order.payment_method === "mobile_money" ? "default" : "outline"} className="text-xs">
                    {order.payment_method === "mobile_money" ? "Mobile Money" : "À la livraison"}
                  </Badge>
                  {order.customer_phone && (
                    <div className="flex items-center gap-2 ml-auto">
                      <Button asChild size="sm" variant="outline" className="h-9">
                        <a href={`tel:${order.customer_phone.replace(/[^0-9+]/g, "")}`} onClick={(e) => e.stopPropagation()}>
                          <Phone className="h-4 w-4 mr-1" /> Appeler
                        </a>
                      </Button>
                      <Button asChild size="sm" className="h-9 bg-green-600 hover:bg-green-700 text-white">
                        <a
                          href={`https://wa.me/${order.customer_phone.replace(/[^0-9+]/g, "").replace(/^\+/, "")}?text=${encodeURIComponent(`Bonjour ${order.customer_name}, je vous contacte au sujet de votre commande ${order.order_number}.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
