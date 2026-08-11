import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Phone, MessageCircle, MapPin, Mail, Home, User, Copy, Check, Search, FileSpreadsheet, Printer, Truck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { PushToDeliveryModal } from "./PushToDeliveryModal";

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
  products_summary?: string | null;
  order_items?: { id: string; product_name: string; quantity: number; unit_price: number; total_price: number; product_image_url: string | null; selected_variants?: Record<string, string> | null }[];
  order_deliveries?: {
    status: string;
    driver?: {
      name: string;
      phone: string;
    } | null;
    provider?: {
      company_name: string;
    } | null;
  }[] | null;
}
interface OrdersListProps {
  orders: Order[];
  shopId: string;
  onUpdateStatus: (orderId: string, status: string) => void;
  onMarkRead: (orderId: string) => void;
  onOrderUpdated?: () => void;
}

export function OrdersList({ orders, shopId, onUpdateStatus, onMarkRead, onOrderUpdated }: OrdersListProps) {
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [orderToPush, setOrderToPush] = useState<string | null>(null);

  const normalized = (v: string | null | undefined) =>
    (v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const filteredOrders = useMemo(() => {
    const q = normalized(search).trim();
    if (!q) return orders;
    return orders.filter((o) => {
      const hay = [
        o.order_number, o.customer_name, o.customer_phone, o.customer_email,
        o.customer_city, o.customer_address,
      ].map(normalized).join(" | ");
      return hay.includes(q);
    });
  }, [orders, search]);

  const buildOrderText = (order: Order, sequence: number) => {
    const lines: string[] = [];
    lines.push(`🛒 Commande #${sequence} (${order.order_number})`);
    lines.push(`📅 ${new Date(order.created_at).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`);
    lines.push("");
    lines.push("👤 CLIENT");
    lines.push(`Nom : ${order.customer_name}`);
    lines.push(`Téléphone : ${order.customer_phone}`);
    if (order.customer_email) lines.push(`Email : ${order.customer_email}`);
    if (order.customer_city) lines.push(`Ville : ${order.customer_city}`);
    if (order.customer_address) lines.push(`Adresse : ${order.customer_address}`);
    lines.push("");
    lines.push("📦 PRODUITS");
    if (order.order_items && order.order_items.length > 0) {
      order.order_items.forEach((item) => {
        let line = `• ${item.quantity}x ${item.product_name}`;
        if (item.selected_variants && Object.keys(item.selected_variants).length > 0) {
          const variants = Object.entries(item.selected_variants).map(([k, v]) => `${k}: ${v}`).join(", ");
          line += ` (${variants})`;
        }
        line += ` — ${fmt(item.total_price)} FCFA`;
        lines.push(line);
      });
    } else if (order.products_summary) {
      order.products_summary.split(" ; ").forEach((p) => lines.push(`• ${p}`));
    }
    lines.push("");
    lines.push(`💰 TOTAL : ${fmt(order.total)} FCFA`);
    lines.push(`💳 Paiement : ${order.payment_method === "mobile_money" ? "Mobile Money" : "À la livraison"}`);
    return lines.join("\n");
  };

  const handleCopy = async (order: Order, sequence: number) => {
    const text = buildOrderText(order, sequence);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedId(order.id);
      toast.success("Informations copiées", { description: "Vous pouvez maintenant les coller où vous voulez." });
      setTimeout(() => setCopiedId((c) => (c === order.id ? null : c)), 2000);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  // Sequential numbering: oldest = #1, newest = #N (orders are passed in desc order)
  const sortedAsc = [...filteredOrders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const sequenceById: Record<string, number> = {};
  sortedAsc.forEach((o, i) => { sequenceById[o.id] = i + 1; });

  const buildExportRows = () => {
    return filteredOrders.map((o) => {
      const items = o.order_items && o.order_items.length > 0
        ? o.order_items.map((it) => {
            const variants = it.selected_variants && Object.keys(it.selected_variants).length > 0
              ? ` (${Object.entries(it.selected_variants).map(([k, v]) => `${k}: ${v}`).join(", ")})`
              : "";
            return `${it.quantity}x ${it.product_name}${variants}`;
          }).join(" ; ")
        : (o.products_summary || "");
      return {
        "N°": sequenceById[o.id],
        "Référence": o.order_number,
        "Date": new Date(o.created_at).toLocaleString("fr-FR"),
        "Client": o.customer_name,
        "Téléphone": o.customer_phone,
        "Email": o.customer_email || "",
        "Ville": o.customer_city || "",
        "Adresse": o.customer_address || "",
        "Produits": items,
        "Total (FCFA)": o.total,
        "Paiement": o.payment_method === "mobile_money" ? "Mobile Money" : "À la livraison",
        "Statut paiement": o.payment_status,
        "Statut commande": STATUS_MAP[o.order_status]?.label || o.order_status,
      };
    });
  };

  const handleExportExcel = () => {
    if (filteredOrders.length === 0) { toast.error("Aucune commande à exporter"); return; }
    try {
      const rows = buildExportRows();
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Commandes");
      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `commandes-${stamp}.xlsx`);
      toast.success("Export Excel téléchargé");
    } catch {
      toast.error("Erreur lors de l'export Excel");
    }
  };

  const handlePrint = () => {
    if (filteredOrders.length === 0) { toast.error("Aucune commande à imprimer"); return; }
    const rows = buildExportRows();
    const headers = Object.keys(rows[0]);
    const now = new Date().toLocaleString("fr-FR");
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Commandes</title>
      <style>
        *{box-sizing:border-box} body{font-family:Arial,sans-serif;color:#111;margin:24px}
        h1{font-size:20px;margin:0 0 4px} .meta{color:#555;font-size:12px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
        th{background:#f3f4f6} tr:nth-child(even) td{background:#fafafa}
        @media print{ @page{ size:A4 landscape; margin:12mm } }
      </style></head><body>
      <h1>Fiche des commandes</h1>
      <div class="meta">${filteredOrders.length} commande(s) · Généré le ${now}</div>
      <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r => `<tr>${headers.map(h => `<td>${String((r as any)[h] ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string))}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
      <script>window.onload=()=>{setTimeout(()=>{window.print();},300)}<\/script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Activez les pop-ups pour imprimer"); return; }
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-bold">Commandes ({filteredOrders.length}{search ? ` / ${orders.length}` : ""})</h2>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (n°, nom, téléphone, ville…)"
              className="pl-9 h-9"
            />
          </div>
          <Button size="sm" variant="outline" className="h-9" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
          <Button size="sm" variant="outline" className="h-9" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Imprimer
          </Button>
        </div>
      </div>
      {filteredOrders.length === 0 ? (
        <Card className="p-12 text-center">
          <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-1">{search ? "Aucun résultat" : "Aucune commande"}</h3>
          <p className="text-sm text-muted-foreground">
            {search ? "Essayez d'autres mots-clés (commune, ville, numéro…)." : "Les commandes apparaîtront ici en temps réel"}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <Card key={order.id} className={`overflow-hidden ${!order.is_read ? 'ring-1 ring-primary' : ''}`} onClick={() => !order.is_read && onMarkRead(order.id)}>
              <div className="p-3 sm:p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
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
                {order.order_items && order.order_items.length > 0 ? (
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
                ) : order.products_summary ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {order.products_summary.split(" ; ").map((p, i) => (
                      <div key={i} className="bg-muted/50 rounded-lg px-3 py-1.5 text-xs font-medium">
                        {p}
                      </div>
                    ))}
                  </div>
                ) : null}
                
                {order.order_deliveries && order.order_deliveries.length > 0 && (
                  <div className="mb-4 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-300">Suivi Livraison</h4>
                    </div>
                    {order.order_deliveries.map((delivery, i) => (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-white dark:bg-background">
                            {delivery.status === "pending" ? "En attente d'assignation" :
                             delivery.status === "assigned" ? "Assigné au livreur" :
                             delivery.status === "picked_up" ? "Récupéré" :
                             delivery.status === "in_transit" ? "En route" :
                             delivery.status === "delivered" ? "Livré" :
                             delivery.status === "returned" ? "Retourné" :
                             delivery.status === "failed" ? "Échec" : delivery.status}
                          </Badge>
                          {delivery.provider && (
                            <span className="text-muted-foreground text-xs font-medium">via {delivery.provider.company_name}</span>
                          )}
                        </div>
                        {delivery.driver ? (
                          <div className="flex items-center gap-2 text-xs font-medium bg-white dark:bg-background px-3 py-1.5 rounded-lg border shadow-sm w-fit">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{delivery.driver.name}</span>
                            <span className="text-muted-foreground">•</span>
                            <a href={`tel:${delivery.driver.phone}`} className="text-primary hover:underline flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <Phone className="h-3 w-3" />
                              {delivery.driver.phone}
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Aucun livreur assigné</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <Select value={order.order_status} onValueChange={(v) => onUpdateStatus(order.id, v)}>
                    <SelectTrigger className="w-full sm:w-44 h-10 min-h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_MAP).map(([key, val]) => (
                        <SelectItem key={key} value={key}>{val.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Badge variant={order.payment_method === "mobile_money" ? "default" : "outline"} className="text-xs">
                    {order.payment_method === "mobile_money" ? "Mobile Money" : "À la livraison"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 min-h-10 flex-1 sm:flex-none"
                    onClick={(e) => { e.stopPropagation(); handleCopy(order, sequenceById[order.id]); }}
                  >
                    {copiedId === order.id ? (
                      <><Check className="h-4 w-4 mr-1" /> Copié</>
                    ) : (
                      <><Copy className="h-4 w-4 mr-1" /> Copier</>
                    )}
                  </Button>
                  {order.customer_phone && (
                    <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-10 min-h-10 flex-1 sm:flex-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOrderToPush(order.id);
                          setPushModalOpen(true);
                        }}
                      >
                        <Send className="h-4 w-4 mr-1" /> Expédier
                      </Button>
                      <Button asChild size="sm" variant="outline" className="h-10 min-h-10 flex-1 sm:flex-none">
                        <a href={`tel:${order.customer_phone.replace(/[^0-9+]/g, "")}`} onClick={(e) => e.stopPropagation()}>
                          <Phone className="h-4 w-4 mr-1" /> Appeler
                        </a>
                      </Button>
                      <Button asChild size="sm" className="h-10 min-h-10 flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white">
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
      
      {pushModalOpen && orderToPush && (
        <PushToDeliveryModal
          isOpen={pushModalOpen}
          onClose={() => {
            setPushModalOpen(false);
            setOrderToPush(null);
          }}
          orderId={orderToPush}
          shopId={shopId}
          onSuccess={() => {
            if (onOrderUpdated) onOrderUpdated();
          }}
        />
      )}
    </div>
  );
}
