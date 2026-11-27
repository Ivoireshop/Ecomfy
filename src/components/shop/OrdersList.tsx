import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Phone, MapPin, Mail, User, Search, FileSpreadsheet, Printer, Truck, Lock, CreditCard, CalendarDays, Clock, Loader2, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemo, useState, useEffect, useRef } from "react";
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
import { ListPagination } from "@/components/ListPagination";
import { usePagedList } from "@/hooks/usePagedList";
import {
  fetchAllShopOrders, fetchShopOrdersPage, type DeliveryDateCounts, type DeliveryDateFilter, type ShopOrder as Order,
} from "@/lib/shopOrders";
import { OrdersTable } from "./OrdersTable";
import { deliveryStatusLabel, shippingOptions, STATUS_MAP } from "./orderDisplay";
import { ContactButtons, OrderMoreMenu, OrderStatusSelect, ShipMenu } from "./OrderActions";

import { getOrderScheduleInfo } from "@/lib/utils";
import { cleanSelectedVariants } from "@/lib/productVariants";

const ORDERS_PAGE_SIZE = 20;

type OrdersView = "cards" | "list";
const VIEW_KEY = "ecomfy_orders_view";
const savedView = (): OrdersView => {
  try { return window.localStorage.getItem(VIEW_KEY) === "list" ? "list" : "cards"; } catch { return "cards"; }
};

interface OrdersListProps {
  shopId: string;
  /** Change quand les commandes de la boutique changent : la page affichée est relue. */
  revision: number;
  /** Renvoie false si le statut n'a pas changé. */
  onUpdateStatus: (orderId: string, status: string) => Promise<boolean>;
  /** Renvoie false si la commande n'a pas été marquée comme lue. */
  onMarkRead: (orderId: string) => Promise<boolean>;
  onOrderUpdated?: () => void;
  isRestricted?: boolean;
}

export function OrdersList({ shopId, revision, onUpdateStatus, onMarkRead, onOrderUpdated, isRestricted = false }: OrdersListProps) {
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
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryDateFilter>("all");
  // Null tant qu'aucune lecture n'a réussi : on n'affiche pas « 0 » pour un nombre inconnu.
  const [summary, setSummary] = useState<{ shopTotal: number; counts: DeliveryDateCounts; restricted: boolean } | null>(null);
  const [exporting, setExporting] = useState(false);
  const listTop = useRef<HTMLDivElement>(null);
  // Cartes ou liste : le choix est retenu sur cet appareil.
  const [view, setView] = useState<OrdersView>(savedView);
  const chooseView = (next: OrdersView) => {
    setView(next);
    try { window.localStorage.setItem(VIEW_KEY, next); } catch { /* stockage indisponible : choix non retenu */ }
  };

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

  const list = usePagedList<Order>({
    pageSize: ORDERS_PAGE_SIZE,
    search,
    filterKey: JSON.stringify([shopId, deliveryFilter]),
    // Les changements de commande et le passage à un nouveau jour relisent la page affichée.
    refreshKey: `${revision}|${todayISO}`,
    enabled: !isRestricted,
    fetchPage: async ({ page, pageSize, search: query }) => {
      const result = await fetchShopOrdersPage({ shopId, search: query, delivery: deliveryFilter, today: todayISO }, page, pageSize);
      setSummary({ shopTotal: result.shopTotal, counts: result.counts, restricted: result.restricted });
      return result;
    },
  });
  const counts: Record<keyof DeliveryDateCounts, number | string> = summary?.counts ?? { today: "–", tomorrow: "–", scheduled: "–", unscheduled: "–" };
  const shopTotal = summary?.shopTotal ?? "–";
  const filtering = !!list.search || deliveryFilter !== "all";

  // Statut, lecture et date prévue affichés dès l'action, avant la réponse du serveur ; oubliés à la relecture.
  const [pending, setPending] = useState<Record<string, Partial<Order>>>({});
  const [pendingSchedule, setPendingSchedule] = useState<Record<string, { date: string | null; note: string | null }>>({});
  useEffect(() => { setPending({}); setPendingSchedule({}); }, [list.rows]);

  const rows = list.rows.map((o) => {
    const merged = { ...o, ...pending[o.id] };
    const schedule = pendingSchedule[o.id] ?? getOrderScheduleInfo(merged);
    return { ...merged, scheduled_delivery_date: schedule.date, internal_delivery_note: schedule.note };
  });

  const applyChange = async (orderId: string, change: Partial<Order>, save: () => Promise<boolean>) => {
    setPending((prev) => ({ ...prev, [orderId]: { ...prev[orderId], ...change } }));
    if (!(await save())) {
      setPending((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    }
  };
  const changeStatus = (orderId: string, status: string) =>
    applyChange(orderId, { order_status: status, is_read: true }, () => onUpdateStatus(orderId, status));
  const markRead = (orderId: string) => applyChange(orderId, { is_read: true }, () => onMarkRead(orderId));

  // Date de livraison en court, pour la vue en liste.
  const shortDelivery = (date?: string | null) => {
    const badge = getDeliveryBadge(date);
    const text = date ? badge.label.replace(/^Livraison prévue (le )?/, "").replace(/ !$/, "") : "Non définie";
    return { short: text.charAt(0).toUpperCase() + text.slice(1), className: badge.className };
  };

  const changePage = (page: number) => {
    list.setPage(page);
    listTop.current?.scrollIntoView({ block: "start" });
  };

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

  const buildExportRows = (orders: Order[]) => {
    return orders.map((order) => {
      const schedule = getOrderScheduleInfo(order);
      const o = { ...order, scheduled_delivery_date: schedule.date, internal_delivery_note: schedule.note };
      const items = o.order_items && o.order_items.length > 0
        ? o.order_items.map((it) => {
            const variants = it.selected_variants && Object.keys(it.selected_variants).length > 0
              ? ` (${Object.entries(cleanSelectedVariants(it.selected_variants) || {}).map(([k, v]) => `${k}: ${v}`).join(", ")})`
              : "";
            return `${it.quantity}x ${it.product_name}${variants}`;
          }).join(" ; ")
        : (o.products_summary || "");
      return {
        "N°": o.sequence,
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

  // Toutes les commandes correspondant à la recherche et au filtre, pas seulement la page affichée.
  const readExportOrders = () =>
    fetchAllShopOrders({ shopId, search: search.trim(), delivery: deliveryFilter, today: todayISO });

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const orders = await readExportOrders();
      if (orders.length === 0) { toast.error("Aucune commande à exporter"); return; }
      const rows = buildExportRows(orders);
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Commandes");
      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `commandes-${stamp}.xlsx`);
      toast.success("Export Excel téléchargé");
    } catch (error) {
      console.error("Failed to export orders", error);
      toast.error("Erreur lors de l'export Excel");
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = async () => {
    // La fenêtre doit s'ouvrir pendant le clic : après la lecture, le navigateur la bloquerait.
    const w = window.open("", "_blank");
    if (!w) { toast.error("Activez les pop-ups pour imprimer"); return; }
    w.document.write("<p style=\"font-family:Arial,sans-serif\">Préparation des commandes…</p>");
    setExporting(true);
    let orders: Order[];
    try {
      orders = await readExportOrders();
    } catch (error) {
      console.error("Failed to print orders", error);
      w.close();
      toast.error("Impossible de préparer l'impression");
      return;
    } finally {
      setExporting(false);
    }
    if (orders.length === 0) { w.close(); toast.error("Aucune commande à imprimer"); return; }
    const rows = buildExportRows(orders);
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
      <div class="meta">${orders.length} commande(s) · Généré le ${now}</div>
      <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.map(r => `<tr>${headers.map(h => `<td>${String((r as any)[h] ?? "").replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c] as string))}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
      <script>window.onload=()=>{setTimeout(()=>{window.print();},300)}<\/script>
      </body></html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  if (isRestricted || summary?.restricted) {
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
        <TabsTrigger value="orders">Commandes ({shopTotal})</TabsTrigger>
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
          <div className="text-xl font-black mt-1">{counts.today}</div>
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
          <div className="text-xl font-black mt-1">{counts.tomorrow}</div>
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
          <div className="text-xl font-black mt-1">{counts.scheduled}</div>
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
          <div className="text-xl font-black mt-1">{counts.unscheduled}</div>
        </button>
      </div>

      <div ref={listTop} className="flex items-center justify-between gap-3 flex-wrap scroll-mt-4">
        <h2 className="text-xl font-bold">Commandes ({list.loading || list.error ? "–" : list.total}{filtering ? ` / ${shopTotal}` : ""})</h2>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <Select value={deliveryFilter} onValueChange={(v) => setDeliveryFilter(v as DeliveryDateFilter)}>
            <SelectTrigger className="w-full sm:w-48 h-9 text-xs font-medium">
              <SelectValue placeholder="Filtre livraison" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les dates</SelectItem>
              <SelectItem value="today">🚨 Aujourd'hui ({counts.today})</SelectItem>
              <SelectItem value="tomorrow">⏳ Demain ({counts.tomorrow})</SelectItem>
              <SelectItem value="scheduled">🗓️ Planifiées ({counts.scheduled})</SelectItem>
              <SelectItem value="unscheduled">❓ Non planifiées ({counts.unscheduled})</SelectItem>
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
          <div role="group" aria-label="Affichage des commandes" className="flex h-9 items-center gap-0.5 rounded-md border bg-background p-0.5">
            <Button size="icon" variant={view === "cards" ? "secondary" : "ghost"} className="h-8 w-8" aria-pressed={view === "cards"}
              title="Affichage en cartes" aria-label="Affichage en cartes" onClick={() => chooseView("cards")}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button size="icon" variant={view === "list" ? "secondary" : "ghost"} className="h-8 w-8" aria-pressed={view === "list"}
              title="Affichage en liste" aria-label="Affichage en liste" onClick={() => chooseView("list")}>
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" className="h-9 bg-emerald-600 text-white hover:bg-emerald-700" onClick={handleExportExcel} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />} Excel
          </Button>
          <Button size="sm" className="h-9 bg-slate-800 text-white hover:bg-slate-900" onClick={handlePrint} disabled={exporting}>
            <Printer className="h-4 w-4 mr-1" /> Imprimer
          </Button>
        </div>
      </div>
      {list.loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Chargement des commandes" />
        </div>
      ) : list.error ? (
        <Card className="p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Les commandes n'ont pas pu être chargées.</p>
          <Button variant="outline" size="sm" onClick={list.reload}>Réessayer</Button>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center">
          <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-1">{filtering ? "Aucun résultat pour ce filtre" : "Aucune commande"}</h3>
          <p className="text-sm text-muted-foreground">
            {filtering ? "Essayez de modifier les filtres ou la recherche." : "Les commandes apparaîtront ici en temps réel"}
          </p>
        </Card>
      ) : view === "list" ? (
        <OrdersTable
          orders={rows}
          activeDispatches={activeDispatches}
          dispatchesLoading={dispatchesLoading}
          deliveryDate={shortDelivery}
          copiedId={copiedId}
          onMarkRead={markRead}
          onStatusChange={changeStatus}
          onCopy={(order) => handleCopy(order, order.sequence)}
          onSchedule={setScheduleModalOrder}
          onShip={(order) => { setOrderToPush(order.id); setPushModalOpen(true); }}
          onTransmit={setOrderToDispatch}
          onShowTracking={() => setTab("deliveries")}
        />
      ) : (
        <div className="grid gap-3 min-[1100px]:grid-cols-2">
          {rows.map((order) => {
            const badgeInfo = getDeliveryBadge(order.scheduled_delivery_date);
            const BadgeIcon = badgeInfo.icon;
            const dispatch = activeDispatches.get(order.id);
            const { canSend, canTransmit } = shippingOptions(order, dispatch, dispatchesLoading);
            const items = order.order_items ?? [];
            const status = STATUS_MAP[order.order_status];
            const location = [order.customer_city, order.customer_address].filter(Boolean).join(" · ");
            return (
              <Card
                key={order.id}
                className={`flex min-w-0 flex-col overflow-hidden rounded-xl transition-shadow hover:shadow-md ${!order.is_read ? "border-l-4 border-l-primary" : ""}`}
                onClick={() => !order.is_read && markRead(order.id)}
              >
                {/* En-tête : identité de la commande et montant */}
                <div className="flex items-start justify-between gap-3 border-b bg-muted/30 px-3 py-2 sm:px-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                    {!order.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary animate-pulse" aria-label="Non lue" />}
                    <span className="text-sm font-bold">Commande #{order.sequence}</span>
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
                              {deliveryStatusLabel(delivery.status, !!delivery.driver)}
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
                <div className="flex items-center justify-between gap-1 border-t bg-muted/30 px-3 py-2 [container-type:inline-size] sm:px-4">
                  <div className="flex min-w-0 items-center gap-1">
                    <OrderStatusSelect order={order} onChange={(v) => changeStatus(order.id, v)} className="w-[112px] shrink" />
                    <ContactButtons order={order} />
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <ShipMenu canSend={canSend} canTransmit={canTransmit}
                      onShip={() => { setOrderToPush(order.id); setPushModalOpen(true); }} onTransmit={() => setOrderToDispatch(order)} />
                    <OrderMoreMenu order={order} copied={copiedId === order.id} onCopy={() => handleCopy(order, order.sequence)}
                      onSchedule={() => setScheduleModalOrder(order)} onMarkRead={() => markRead(order.id)}
                      onShowTracking={dispatch ? () => setTab("deliveries") : undefined} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {!list.loading && !list.error && (
        <ListPagination page={list.page} pageSize={list.pageSize} total={list.total} onPageChange={changePage} />
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
            setPendingSchedule((prev) => ({
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
