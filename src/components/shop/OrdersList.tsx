import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Phone, MessageCircle, MapPin, Mail, User, Copy, Check, Search, FileSpreadsheet, Printer, Truck, Send, Lock, CreditCard, CalendarDays, Clock, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { openDeliveryProof } from "@/lib/deliveryRpc";
import * as XLSX from "xlsx";
import { PushToDeliveryModal } from "./PushToDeliveryModal";
import DispatchOrderModal from "@/components/delivery/DispatchOrderModal";
import DispatchTrackingBoard, { DISPATCH_STATUS_LABELS } from "@/components/delivery/DispatchTrackingBoard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useShopDispatches } from "@/hooks/useShopDispatches";
import { activeDispatchByOrder } from "@/lib/shopDispatches";
import { StoreRestrictedLockScreen } from "./StoreRestrictedLockScreen";
import { ScheduleDeliveryModal } from "./ScheduleDeliveryModal";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: "Nouveau", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  pending: { label: "En attente", color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300" },
  confirmed: { label: "Confirmé", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  processing: { label: "En traitement", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  shipped: { label: "Expédié", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  delivered: { label: "Livré", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  cancelled: { label: "Annulé", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  returned: { label: "Retourné", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
};

// Une commande terminée ou annulée ne peut plus être confiée à un livreur.
const NOT_SHIPPABLE = new Set(["delivered", "cancelled", "returned"]);
// Une livraison déjà récupérée, en route ou terminée ne se relance pas (refusé par le serveur).
const DELIVERY_IN_PROGRESS = new Set(["picked_up", "in_transit", "delivered"]);

import { getOrderScheduleInfo } from "@/lib/utils";
import { cleanSelectedVariants } from "@/lib/productVariants";

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_address: string | null;
  customer_city: string | null;
  total: number;
  promo_code?: string | null;
  discount_amount?: number | null;
  payment_method: string;
  payment_status: string;
  order_status: string;
  is_read: boolean;
  created_at: string;
  products_summary?: string | null;
  scheduled_delivery_date?: string | null;
  internal_delivery_note?: string | null;
  notes?: string | null;
  order_items?: { id: string; product_name: string; quantity: number; unit_price: number; total_price: number; product_image_url: string | null; selected_variants?: Record<string, string> | null }[];
  order_deliveries?: {
    status: string;
    failure_reason?: string | null;
    pod_signature_url?: string | null;
    pod_photo_url?: string | null;
    payment?: { amount_collected: number; status: "collected_by_driver" | "remitted_to_company" | "remitted_to_shop" } | null;
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
  isRestricted?: boolean;
}

export function OrdersList({ orders, shopId, onUpdateStatus, onMarkRead, onOrderUpdated, isRestricted = false }: OrdersListProps) {
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [orderToPush, setOrderToPush] = useState<string | null>(null);
  const [orderToDispatch, setOrderToDispatch] = useState<Order | null>(null);
  const [tab, setTab] = useState("orders");
  const { dispatches, loading: dispatchesLoading, error: dispatchesError, revision: dispatchesRevision, reload: reloadDispatches } = useShopDispatches(shopId);
  const activeDispatches = useMemo(() => activeDispatchByOrder(dispatches), [dispatches]);
  
  // Delivery Schedule state & modals
  const [scheduleModalOrder, setScheduleModalOrder] = useState<Order | null>(null);
  const [deliveryFilter, setDeliveryFilter] = useState<string>("all");
  const [localOrdersState, setLocalOrdersState] = useState<Record<string, { date: string | null; note: string | null }>>({});

  useEffect(() => {
    // Sync local state when incoming orders prop updates from Supabase Realtime
    setLocalOrdersState((prev) => {
      let changed = false;
      const next = { ...prev };
      orders.forEach((o) => {
        if (next[o.id]) {
          const dbSchedule = getOrderScheduleInfo(o);
          if (dbSchedule.date === next[o.id].date && dbSchedule.note === next[o.id].note) {
            delete next[o.id];
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  }, [orders]);

  const formatISODate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // La date du jour est réévaluée chaque minute : un onglet laissé ouvert après minuit
  // ne doit pas continuer à afficher « aujourd'hui » pour la veille.
  const [todayISO, setTodayISO] = useState(() => formatISODate(new Date()));
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = formatISODate(new Date());
      setTodayISO((prev) => (prev === now ? prev : now));
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);
  const addDaysISO = (iso: string, days: number) => {
    const [y, m, d] = iso.split("-").map(Number);
    return formatISODate(new Date(y, m - 1, d + days));
  };
  const tomorrowISO = addDaysISO(todayISO, 1);
  const afterTomorrowISO = addDaysISO(todayISO, 2);

  const getDeliveryBadge = (scheduledDate?: string | null) => {
    if (!scheduledDate) {
      return {
        label: "Date de livraison non définie",
        className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700",
        icon: CalendarDays,
      };
    }

    if (scheduledDate === todayISO) {
      return {
        label: "Livraison prévue aujourd'hui !",
        className: "bg-rose-600 text-white font-black animate-pulse shadow-md border-0",
        icon: Clock,
      };
    }

    if (scheduledDate === tomorrowISO) {
      return {
        label: "Livraison prévue demain",
        className: "bg-amber-500 text-white font-bold shadow-sm border-0",
        icon: CalendarDays,
      };
    }

    if (scheduledDate === afterTomorrowISO) {
      return {
        label: "Livraison prévue après-demain",
        className: "bg-blue-600 text-white font-bold shadow-sm border-0",
        icon: CalendarDays,
      };
    }

    try {
      const parts = scheduledDate.split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const formatted = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
        return {
          label: `Livraison prévue le ${formatted}`,
          className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800",
          icon: CalendarDays,
        };
      }
    } catch (_) {}

    return {
      label: `Livraison prévue le ${scheduledDate}`,
      className: "bg-indigo-50 text-indigo-700 font-bold border border-indigo-200",
      icon: CalendarDays,
    };
  };

  const normalized = (v: string | null | undefined) =>
    (v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Compute counts for summary indicator cards
  const counts = useMemo(() => {
    let todayCount = 0;
    let tomorrowCount = 0;
    let scheduledCount = 0;
    let unscheduledCount = 0;

    orders.forEach((o) => {
      const override = localOrdersState[o.id];
      const schedule = override !== undefined ? override : getOrderScheduleInfo(o);
      const date = schedule.date;
      if (!date) {
        unscheduledCount++;
      } else {
        scheduledCount++;
        if (date === todayISO) todayCount++;
        if (date === tomorrowISO) tomorrowCount++;
      }
    });

    return { todayCount, tomorrowCount, scheduledCount, unscheduledCount };
  }, [orders, localOrdersState, todayISO, tomorrowISO]);

  const filteredOrders = useMemo(() => {
    let result = orders.map((o) => {
      const override = localOrdersState[o.id];
      const schedule = override !== undefined ? override : getOrderScheduleInfo(o);
      return {
        ...o,
        scheduled_delivery_date: schedule.date,
        internal_delivery_note: schedule.note,
      };
    });

    if (deliveryFilter !== "all") {
      if (deliveryFilter === "today") {
        result = result.filter((o) => o.scheduled_delivery_date === todayISO);
      } else if (deliveryFilter === "tomorrow") {
        result = result.filter((o) => o.scheduled_delivery_date === tomorrowISO);
      } else if (deliveryFilter === "scheduled") {
        result = result.filter((o) => !!o.scheduled_delivery_date);
      } else if (deliveryFilter === "unscheduled") {
        result = result.filter((o) => !o.scheduled_delivery_date);
      }
    }

    const q = normalized(search).trim();
    if (!q) return result;

    return result.filter((o) => {
      const hay = [
        o.order_number, o.customer_name, o.customer_phone, o.customer_email,
        o.customer_city, o.customer_address, o.internal_delivery_note, o.notes,
      ].map(normalized).join(" | ");
      return hay.includes(q);
    });
  }, [orders, search, deliveryFilter, localOrdersState, todayISO, tomorrowISO]);

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
          const variants = Object.entries(cleanSelectedVariants(item.selected_variants) || {}).map(([k, v]) => `${k}: ${v}`).join(", ");
          line += ` (${variants})`;
        }
        line += ` — ${fmt(item.total_price)} FCFA`;
        lines.push(line);
      });
    } else if (order.products_summary) {
      order.products_summary.split(" ; ").forEach((p) => lines.push(`• ${p}`));
    }
    lines.push("");
    if (order.promo_code && Number(order.discount_amount) > 0) {
      lines.push(`🎟️ Code ${order.promo_code} : -${fmt(Number(order.discount_amount))} FCFA`);
    }
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

  // Numérotation séquentielle : la plus ancienne = #1. Calculée sur TOUTES les commandes
  // (pas sur la liste filtrée) pour qu'un numéro ne change pas avec la recherche ou le filtre.
  const sequenceById = useMemo(() => {
    const map: Record<string, number> = {};
    [...orders]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .forEach((o, i) => { map[o.id] = i + 1; });
    return map;
  }, [orders]);

  const buildExportRows = () => {
    return filteredOrders.map((o) => {
      const items = o.order_items && o.order_items.length > 0
        ? o.order_items.map((it) => {
            const variants = it.selected_variants && Object.keys(it.selected_variants).length > 0
              ? ` (${Object.entries(cleanSelectedVariants(it.selected_variants) || {}).map(([k, v]) => `${k}: ${v}`).join(", ")})`
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
      <tbody>${rows.map(r => `<tr>${headers.map(h => `<td>${String((r as any)[h] ?? "").replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c] as string))}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
      <script>window.onload=()=>{setTimeout(()=>{window.print();},300)}<\/script>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Activez les pop-ups pour imprimer"); return; }
    w.document.write(html);
    w.document.close();
  };

  if (isRestricted) {
    return <StoreRestrictedLockScreen shopId={shopId} isRestricted={true} />;
  }

  return (
    <div className="space-y-4">
      {isRestricted && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-red-950 via-slate-900 to-red-950 border-2 border-red-500/60 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-500/20 text-red-400 shrink-0">
              <Lock className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-red-200">🔒 Coordonnées clients temporairement masquées</h4>
              <p className="text-xs text-slate-300">
                Seuil de facturation atteint. Les données personnelles des clients sont masquées jusqu'au règlement de votre solde en attente.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shrink-0 w-full sm:w-auto shadow-md"
            onClick={() => window.location.href = "/dashboard/billing"}
          >
            <CreditCard className="h-3.5 w-3.5 mr-1" /> RÉGLER LA FACTURE
          </Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="orders">Commandes ({orders.length})</TabsTrigger>
        <TabsTrigger value="deliveries">Livraisons ({dispatches.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="deliveries" className="mt-0">
        <DispatchTrackingBoard shopId={shopId} dispatches={dispatches} loading={dispatchesLoading} error={dispatchesError}
          revision={dispatchesRevision} onRefresh={reloadDispatches} />
      </TabsContent>

      <TabsContent value="orders" className="mt-0 space-y-4">
      {/* Delivery Schedule Indicator Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-2">
        <button
          type="button"
          onClick={() => setDeliveryFilter(deliveryFilter === "today" ? "all" : "today")}
          className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
            deliveryFilter === "today"
              ? "bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-500/30"
              : "bg-card border-border hover:border-rose-300 hover:bg-rose-50/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold opacity-90">Aujourd'hui</span>
            <Clock className="h-4 w-4 shrink-0" />
          </div>
          <div className="text-xl font-black mt-1">{counts.todayCount}</div>
        </button>

        <button
          type="button"
          onClick={() => setDeliveryFilter(deliveryFilter === "tomorrow" ? "all" : "tomorrow")}
          className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
            deliveryFilter === "tomorrow"
              ? "bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-500/30"
              : "bg-card border-border hover:border-amber-300 hover:bg-amber-50/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold opacity-90">Demain</span>
            <CalendarDays className="h-4 w-4 shrink-0" />
          </div>
          <div className="text-xl font-black mt-1">{counts.tomorrowCount}</div>
        </button>

        <button
          type="button"
          onClick={() => setDeliveryFilter(deliveryFilter === "scheduled" ? "all" : "scheduled")}
          className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
            deliveryFilter === "scheduled"
              ? "bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-500/30"
              : "bg-card border-border hover:border-indigo-300 hover:bg-indigo-50/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold opacity-90">Planifiées</span>
            <CalendarDays className="h-4 w-4 shrink-0" />
          </div>
          <div className="text-xl font-black mt-1">{counts.scheduledCount}</div>
        </button>

        <button
          type="button"
          onClick={() => setDeliveryFilter(deliveryFilter === "unscheduled" ? "all" : "unscheduled")}
          className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
            deliveryFilter === "unscheduled"
              ? "bg-slate-700 text-white border-slate-800 shadow-md ring-2 ring-slate-500/30"
              : "bg-card border-border hover:border-slate-300 hover:bg-slate-100/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold opacity-90">Non planifiées</span>
            <CalendarDays className="h-4 w-4 shrink-0 opacity-60" />
          </div>
          <div className="text-xl font-black mt-1">{counts.unscheduledCount}</div>
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-bold">Commandes ({filteredOrders.length}{search || deliveryFilter !== "all" ? ` / ${orders.length}` : ""})</h2>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <Select value={deliveryFilter} onValueChange={(v) => setDeliveryFilter(v)}>
            <SelectTrigger className="w-full sm:w-48 h-9 text-xs font-medium">
              <SelectValue placeholder="Filtre livraison" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les dates</SelectItem>
              <SelectItem value="today">🚨 Aujourd'hui ({counts.todayCount})</SelectItem>
              <SelectItem value="tomorrow">⏳ Demain ({counts.tomorrowCount})</SelectItem>
              <SelectItem value="scheduled">🗓️ Planifiées ({counts.scheduledCount})</SelectItem>
              <SelectItem value="unscheduled">❓ Non planifiées ({counts.unscheduledCount})</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (n°, nom, tél…)"
              className="pl-9 h-9 text-xs"
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
          <h3 className="font-semibold mb-1">{search || deliveryFilter !== "all" ? "Aucun résultat pour ce filtre" : "Aucune commande"}</h3>
          <p className="text-sm text-muted-foreground">
            {search || deliveryFilter !== "all" ? "Essayez de modifier les filtres ou la recherche." : "Les commandes apparaîtront ici en temps réel"}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 min-[1100px]:grid-cols-2">
          {filteredOrders.map((order) => {
            const badgeInfo = getDeliveryBadge(order.scheduled_delivery_date);
            const BadgeIcon = badgeInfo.icon;
            const dispatch = activeDispatches.get(order.id);
            // Tant que les courses ne sont pas chargées, aucun envoi n'est proposé : la commande est peut-être déjà confiée.
            const canSend = !dispatchesLoading && !dispatch && !NOT_SHIPPABLE.has(order.order_status)
              && !order.order_deliveries?.some((d) => DELIVERY_IN_PROGRESS.has(d.status));
            // « Expédier » reste disponible pour relancer sa propre livraison, mais elle exclut la transmission.
            const hasOwnDelivery = !!order.order_deliveries?.some((d) => d.status !== "failed" && d.status !== "returned");
            const items = order.order_items ?? [];
            const status = STATUS_MAP[order.order_status];
            const phoneDigits = order.customer_phone?.replace(/[^0-9+]/g, "") ?? "";
            const location = [order.customer_city, order.customer_address].filter(Boolean).join(" · ");
            return (
              <Card
                key={order.id}
                className={`flex min-w-0 flex-col overflow-hidden rounded-xl transition-shadow hover:shadow-md ${!order.is_read ? "border-l-4 border-l-primary" : ""}`}
                onClick={() => !order.is_read && onMarkRead(order.id)}
              >
                {/* En-tête : identité de la commande et montant */}
                <div className="flex items-start justify-between gap-3 border-b bg-muted/30 px-3 py-2 sm:px-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                    {!order.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary animate-pulse" aria-label="Non lue" />}
                    <span className="text-sm font-bold">Commande #{sequenceById[order.id]}</span>
                    <Badge className={`border-0 px-2 py-0 text-[10px] font-semibold ${status?.color ?? "bg-muted text-foreground"}`}>
                      {status?.label ?? order.order_status}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      <span className="font-mono">{order.order_number}</span>
                      {" · "}
                      {new Date(order.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-black">{fmt(order.total)} FCFA</p>
                    <p className="text-[10px] text-muted-foreground">
                      {order.payment_method === "mobile_money" ? "Mobile Money" : "À la livraison"}
                    </p>
                    {order.promo_code && Number(order.discount_amount) > 0 && (
                      <p className="text-[10px] font-medium text-emerald-700">
                        Code {order.promo_code} : -{fmt(Number(order.discount_amount))} FCFA
                      </p>
                    )}
                  </div>
                </div>

                {/* Client et articles */}
                <div className="flex-1 space-y-2 px-3 py-2 text-xs sm:px-4">
                  <div className="min-w-0 space-y-0.5 text-muted-foreground">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
                        <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{order.customer_name}</span>
                      </span>
                      <span className="flex items-center gap-1.5"><Phone className="h-3 w-3 shrink-0" /> {order.customer_phone}</span>
                    </p>
                    {location && (
                      <p className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> <span className="break-words">{location}</span>
                      </p>
                    )}
                    {order.customer_email && (
                      <p className="flex items-center gap-1.5">
                        <Mail className="h-3 w-3 shrink-0" /> <span className="truncate">{order.customer_email}</span>
                      </p>
                    )}
                  </div>

                  <div className="min-w-0">
                    {items.length > 0 ? (
                      <ul className="space-y-1">
                        {items.map((item) => {
                          const variants = Object.entries(cleanSelectedVariants(item.selected_variants) || {}).map(([k, v]) => `${k}: ${v}`).join(", ");
                          return (
                            <li key={item.id} className="flex items-center gap-2">
                              {item.product_image_url ? (
                                <img src={item.product_image_url} alt="" className="h-8 w-8 shrink-0 rounded-md border object-cover" />
                              ) : (
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted">
                                  <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                                </span>
                              )}
                              <p className="min-w-0 flex-1 truncate">
                                <span className="font-medium">{item.quantity}x {item.product_name}</span>
                                {variants && <span className="text-primary"> · {variants}</span>}
                              </p>
                              <span className="shrink-0 font-semibold">{fmt(item.total_price)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : order.products_summary ? (
                      <ul className="space-y-0.5">
                        {order.products_summary.split(" ; ").map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground">Aucun article détaillé</p>
                    )}
                  </div>
                </div>

                {/* Livraison : suivi, structure, date prévue */}
                <div className="divide-y border-t">
                  {order.order_deliveries && order.order_deliveries.length > 0 && (
                    <div className="space-y-1.5 bg-blue-50/50 px-3 py-2 dark:bg-blue-900/10 sm:px-4">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-300">Suivi Livraison</h4>
                      </div>
                      {order.order_deliveries.map((delivery, i) => (
                        <div key={i} className="flex flex-col justify-between gap-1.5 text-xs sm:flex-row sm:flex-wrap sm:items-center">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="bg-white dark:bg-background">
                              {delivery.status === "pending" ? (delivery.driver ? "Assigné au livreur" : "En attente d'assignation") :
                               delivery.status === "assigned" ? "Assigné au livreur" :
                               delivery.status === "picked_up" ? "Récupéré" :
                               delivery.status === "in_transit" ? "En route" :
                               delivery.status === "delivered" ? "Livré" :
                               delivery.status === "returned" ? "Retourné" :
                               delivery.status === "failed" ? "Échec" : delivery.status}
                            </Badge>
                            {delivery.provider && (
                              <span className="text-xs font-medium text-muted-foreground">via {delivery.provider.company_name}</span>
                            )}
                            {delivery.status === "failed" && delivery.failure_reason && (
                              <span className="text-xs font-medium text-red-600">{delivery.failure_reason}</span>
                            )}
                          </div>
                          {delivery.driver ? (
                            <div className="flex w-fit items-center gap-2 rounded-lg border bg-white px-2 py-1 text-xs font-medium dark:bg-background">
                              <User className="h-3.5 w-3.5 text-muted-foreground" />
                              <span>{delivery.driver.name}</span>
                              {delivery.driver.phone && (
                                <>
                                  <span className="text-muted-foreground">•</span>
                                  <a href={`tel:${delivery.driver.phone}`} className="flex items-center gap-1 text-primary hover:underline" onClick={e => e.stopPropagation()}>
                                    <Phone className="h-3 w-3" />
                                    {delivery.driver.phone}
                                  </a>
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs italic text-muted-foreground">Aucun livreur assigné</span>
                          )}
                          {delivery.payment && (
                            <span className="text-xs font-medium text-amber-700" data-testid="delivery-cash-line">
                              {Number(delivery.payment.amount_collected).toLocaleString("fr-FR")} FCFA encaissés ·{" "}
                              {delivery.payment.status === "remitted_to_shop" ? "reversés" :
                               delivery.payment.status === "remitted_to_company" ? "reçus par le prestataire" : "chez le livreur"}
                            </span>
                          )}
                          {delivery.status === "delivered" && (delivery.pod_signature_url || delivery.pod_photo_url) && (
                            <button
                              type="button"
                              className="w-fit text-xs text-primary hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeliveryProof((delivery.pod_signature_url || delivery.pod_photo_url) as string)
                                  .catch((err: Error) => toast.error(err.message));
                              }}
                            >
                              Voir la preuve de livraison
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {dispatch && (
                    <div className="flex items-center justify-between gap-2 bg-emerald-50/60 px-3 py-1.5 text-xs dark:bg-emerald-950/20 sm:px-4">
                      <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        Confiée à <span className="font-semibold">{dispatch.company?.company_name ?? "une structure"}</span>
                        <Badge variant="outline" className="border-emerald-300 bg-white px-2 py-0 text-[10px] text-emerald-700 dark:bg-background">
                          {DISPATCH_STATUS_LABELS[dispatch.status] ?? dispatch.status}
                        </Badge>
                      </span>
                      <button type="button" className="shrink-0 font-semibold text-primary underline-offset-2 hover:underline" onClick={(e) => { e.stopPropagation(); setTab("deliveries"); }}>
                        Voir le suivi
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1 sm:px-4">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Badge className={`gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${badgeInfo.className}`}>
                        <BadgeIcon className="h-3.5 w-3.5 shrink-0" />
                        <span>{badgeInfo.label}</span>
                      </Badge>
                      {order.internal_delivery_note && (
                        <span className="flex max-w-sm items-center gap-1 truncate rounded-lg border border-amber-300/60 bg-amber-100/70 px-2.5 py-1 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300" title={order.internal_delivery_note}>
                          <Phone className="h-3 w-3 shrink-0 text-amber-700 dark:text-amber-400" />
                          <span className="truncate">{order.internal_delivery_note}</span>
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1.5 px-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
                      onClick={(e) => {
                        e.stopPropagation();
                        setScheduleModalOrder(order);
                      }}
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span>{order.scheduled_delivery_date ? "Modifier la date" : "Planifier la livraison"}</span>
                    </Button>
                  </div>
                </div>

                {/* Actions : statut et contact à gauche, envoi à droite */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-3 py-2 sm:px-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={order.order_status} onValueChange={(v) => onUpdateStatus(order.id, v)}>
                      <SelectTrigger className="h-8 w-32 bg-background text-xs" aria-label="Statut de la commande"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_MAP).map(([key, val]) => (
                          <SelectItem key={key} value={key}>{val.label}</SelectItem>
                        ))}
                        {!STATUS_MAP[order.order_status] && (
                          <SelectItem value={order.order_status}>{order.order_status}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {order.customer_phone && (
                      <>
                        <Button asChild size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                          <a href={`tel:${phoneDigits}`} onClick={(e) => e.stopPropagation()}>
                            <Phone className="mr-1 h-3.5 w-3.5" /> Appeler
                          </a>
                        </Button>
                        <Button asChild size="sm" className="h-8 bg-green-600 px-2.5 text-xs text-white hover:bg-green-700">
                          <a
                            href={`https://wa.me/${phoneDigits.replace(/^\+/, "")}?text=${encodeURIComponent(`Bonjour ${order.customer_name}, je vous contacte au sujet de votre commande ${order.order_number}.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MessageCircle className="mr-1 h-3.5 w-3.5" /> WhatsApp
                          </a>
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      title="Copier les informations"
                      aria-label="Copier les informations"
                      onClick={(e) => { e.stopPropagation(); handleCopy(order, sequenceById[order.id]); }}
                    >
                      {copiedId === order.id ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  {canSend && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 flex-1 px-2.5 text-xs sm:flex-none"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOrderToPush(order.id);
                          setPushModalOpen(true);
                        }}
                      >
                        <Send className="mr-1 h-3.5 w-3.5" /> Expédier
                      </Button>
                      {!hasOwnDelivery && (
                        <Button
                          size="sm"
                          className="h-8 flex-1 px-2.5 text-xs sm:flex-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOrderToDispatch(order);
                          }}
                        >
                          <Truck className="mr-1 h-3.5 w-3.5" /> Transmettre à une structure
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      </TabsContent>
      </Tabs>

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

      {orderToDispatch && (
        <DispatchOrderModal
          isOpen
          onClose={() => setOrderToDispatch(null)}
          order={{
            id: orderToDispatch.id,
            shop_id: shopId,
            customer_name: orderToDispatch.customer_name,
            customer_phone: orderToDispatch.customer_phone,
            delivery_address: orderToDispatch.customer_address || "",
            city: orderToDispatch.customer_city || "",
            total_amount: orderToDispatch.total,
          }}
          onSuccess={() => {
            reloadDispatches();
            if (onOrderUpdated) onOrderUpdated();
          }}
        />
      )}

      {scheduleModalOrder && (
        <ScheduleDeliveryModal
          isOpen={!!scheduleModalOrder}
          onClose={() => setScheduleModalOrder(null)}
          order={scheduleModalOrder}
          onSaveSuccess={(orderId, deliveryDate, note) => {
            setLocalOrdersState((prev) => ({
              ...prev,
              [orderId]: { date: deliveryDate, note },
            }));
            if (onOrderUpdated) onOrderUpdated();
          }}
        />
      )}
    </div>
  );
}
