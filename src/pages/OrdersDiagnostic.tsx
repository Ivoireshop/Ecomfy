import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw, XCircle,
} from "lucide-react";

type OrderRow = {
  id: string;
  order_number: string;
  shop_id: string;
  customer_name: string;
  customer_city: string | null;
  total: number;
  order_status: string;
  payment_status: string;
  payment_method: string;
  created_at: string;
  updated_at: string;
};

type PaymentRow = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  transaction_id: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
};

const REFRESH_MS = 30_000;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const formatDuration = (ms: number) => {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs}s`;
};

const fmtFCFA = (n: number) =>
  `${Math.round(n).toLocaleString("fr-FR")} FCFA`;

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function OrdersDiagnostic() {
  const { user, isReady } = useAuthReady();
  const [isFounder, setIsFounder] = useState<boolean | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    if (!user?.id) { setIsFounder(false); return; }
    void supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      // @ts-ignore - app_role enum
      .in("role", ["founder", "co_founder"])
      .then(({ data }) => setIsFounder(!!data?.length));
  }, [isReady, user?.id]);

  const fetchAll = useCallback(async () => {
    const since = startOfToday();
    const [ordersRes, paymentsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, order_number, shop_id, customer_name, customer_city, total, order_status, payment_status, payment_method, created_at, updated_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("payments")
        .select("id, amount, currency, status, payment_method, transaction_id, metadata, created_at, updated_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    setOrders((ordersRes.data as OrderRow[]) ?? []);
    setPayments((paymentsRes.data as PaymentRow[]) ?? []);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isFounder) return;
    void fetchAll();
    const t = window.setInterval(() => { void fetchAll(); }, REFRESH_MS);
    return () => window.clearInterval(t);
  }, [isFounder, fetchAll]);

  const stats = useMemo(() => {
    const total = orders.length;
    const paid = orders.filter(o => o.payment_status === "paid").length;
    const pending = orders.filter(o => o.payment_status === "pending").length;
    const failed = orders.filter(o => ["failed", "cancelled", "canceled"].includes(o.payment_status)).length;
    const failRate = total ? (failed / total) * 100 : 0;
    const paidWithTime = orders.filter(o => o.payment_status === "paid");
    const avgMs = paidWithTime.length
      ? paidWithTime.reduce((acc, o) => acc + (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()), 0) / paidWithTime.length
      : 0;
    const revenue = orders.filter(o => o.payment_status === "paid").reduce((a, o) => a + Number(o.total || 0), 0);
    return { total, paid, pending, failed, failRate, avgMs, revenue };
  }, [orders]);

  const paymentStats = useMemo(() => {
    const total = payments.length;
    const completed = payments.filter(p => p.status === "completed").length;
    const failed = payments.filter(p => ["failed", "cancelled", "canceled", "error"].includes(p.status)).length;
    const pending = payments.filter(p => p.status === "pending").length;
    return { total, completed, failed, pending, failRate: total ? (failed / total) * 100 : 0 };
  }, [payments]);

  const blockedOrders = useMemo(
    () => orders
      .filter(o => o.payment_status === "pending" && (Date.now() - new Date(o.created_at).getTime()) > 10 * 60_000)
      .slice(0, 50),
    [orders],
  );

  if (!isReady || isFounder === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isFounder) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-10">
      <div className="container mx-auto px-3 md:px-6 py-6 md:py-10 max-w-7xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="h-7 w-7 text-primary" />
              Diagnostic Commandes & Paiements
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Données du jour — actualisation auto toutes les 30 s.
              {lastRefresh && <> Dernière mise à jour : {fmtTime(lastRefresh.toISOString())}</>}
            </p>
          </div>
          <Button onClick={() => { setLoading(true); void fetchAll(); }} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <KPI label="Commandes" value={stats.total.toString()} icon={<Activity className="h-4 w-4" />} />
          <KPI label="Payées" value={stats.paid.toString()} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} />
          <KPI label="En attente" value={stats.pending.toString()} tone="warn" icon={<Clock className="h-4 w-4" />} />
          <KPI label="Échouées" value={stats.failed.toString()} tone="danger" icon={<XCircle className="h-4 w-4" />} />
          <KPI label="Taux d'échec" value={`${stats.failRate.toFixed(1)}%`} tone={stats.failRate > 15 ? "danger" : stats.failRate > 5 ? "warn" : "success"} icon={<AlertTriangle className="h-4 w-4" />} />
          <KPI label="Temps traitement moy." value={formatDuration(stats.avgMs)} icon={<Clock className="h-4 w-4" />} />
          <KPI label="CA encaissé" value={fmtFCFA(stats.revenue)} tone="success" />
          <KPI label="Bloquées >10 min" value={blockedOrders.length.toString()} tone={blockedOrders.length > 0 ? "danger" : "success"} icon={<AlertTriangle className="h-4 w-4" />} />
        </div>

        <Tabs defaultValue="blocked" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="blocked">Bloquées</TabsTrigger>
            <TabsTrigger value="orders">Commandes</TabsTrigger>
            <TabsTrigger value="payments">Paiements</TabsTrigger>
          </TabsList>

          <TabsContent value="blocked" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Commandes en attente depuis &gt; 10 min</CardTitle>
                <CardDescription>
                  Probables blocages de paiement à investiguer (callback GeniusPay, webhook, ou client qui n'a pas finalisé).
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 md:px-6">
                <OrdersTable rows={blockedOrders} emptyLabel="Aucune commande bloquée 🎉" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Toutes les commandes du jour</CardTitle>
                <CardDescription>{orders.length} commande(s)</CardDescription>
              </CardHeader>
              <CardContent className="px-0 md:px-6">
                <OrdersTable rows={orders.slice(0, 100)} emptyLabel="Aucune commande aujourd'hui" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Journal des paiements</CardTitle>
                <CardDescription>
                  {paymentStats.total} tentatives · {paymentStats.completed} OK · {paymentStats.failed} échecs · {paymentStats.pending} en attente
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0 md:px-6">
                <PaymentsTable rows={payments.slice(0, 100)} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function KPI({ label, value, icon, tone }: { label: string; value: string; icon?: React.ReactNode; tone?: "success" | "warn" | "danger" }) {
  const toneClass =
    tone === "danger" ? "text-red-600 dark:text-red-400"
    : tone === "warn" ? "text-amber-600 dark:text-amber-400"
    : tone === "success" ? "text-emerald-600 dark:text-emerald-400"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="p-3 md:p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          {icon}
          <span className="truncate">{label}</span>
        </div>
        <div className={`text-lg md:text-2xl font-bold ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    paid:      { label: "Payée",     cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    completed: { label: "OK",        cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    pending:   { label: "En attente",cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
    failed:    { label: "Échec",     cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
    cancelled: { label: "Annulée",   cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
    canceled:  { label: "Annulée",   cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
    error:     { label: "Erreur",    cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  };
  const m = map[status] ?? { label: status, cls: "bg-muted text-foreground" };
  return <Badge variant="outline" className={`border-0 ${m.cls}`}>{m.label}</Badge>;
};

function OrdersTable({ rows, emptyLabel }: { rows: OrderRow[]; emptyLabel: string }) {
  if (!rows.length) {
    return <div className="text-sm text-muted-foreground py-10 text-center">{emptyLabel}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>N°</TableHead>
            <TableHead>Client</TableHead>
            <TableHead className="hidden md:table-cell">Ville</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Paiement</TableHead>
            <TableHead className="hidden md:table-cell">Méthode</TableHead>
            <TableHead className="hidden md:table-cell">Délai</TableHead>
            <TableHead>Créée</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(o => {
            const elapsed = Date.now() - new Date(o.created_at).getTime();
            const processed = new Date(o.updated_at).getTime() - new Date(o.created_at).getTime();
            return (
              <TableRow key={o.id}>
                <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                <TableCell className="max-w-[140px] truncate">{o.customer_name}</TableCell>
                <TableCell className="hidden md:table-cell">{o.customer_city || "—"}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{fmtFCFA(Number(o.total))}</TableCell>
                <TableCell>{statusBadge(o.payment_status)}</TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{o.payment_method}</TableCell>
                <TableCell className="hidden md:table-cell text-xs">
                  {o.payment_status === "paid" ? formatDuration(processed) : formatDuration(elapsed)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtTime(o.created_at)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  if (!rows.length) {
    return <div className="text-sm text-muted-foreground py-10 text-center">Aucun paiement aujourd'hui</div>;
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Heure</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Méthode</TableHead>
            <TableHead className="hidden md:table-cell">Type</TableHead>
            <TableHead className="hidden md:table-cell">Référence</TableHead>
            <TableHead className="hidden lg:table-cell">Erreur</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(p => {
            const m = p.metadata || {};
            const type = m.payment_type || m.type || "—";
            const err = m.error || m.error_message || m.failure_reason || null;
            return (
              <TableRow key={p.id}>
                <TableCell className="text-xs whitespace-nowrap">{fmtTime(p.created_at)}</TableCell>
                <TableCell>{statusBadge(p.status)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{Math.round(p.amount).toLocaleString("fr-FR")} {p.currency || "XOF"}</TableCell>
                <TableCell className="text-xs">{p.payment_method}</TableCell>
                <TableCell className="hidden md:table-cell text-xs">{type}</TableCell>
                <TableCell className="hidden md:table-cell text-xs font-mono truncate max-w-[160px]">{p.transaction_id || "—"}</TableCell>
                <TableCell className="hidden lg:table-cell text-xs text-red-600 dark:text-red-400 truncate max-w-[260px]">{err || ""}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}