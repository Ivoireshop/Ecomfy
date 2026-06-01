import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Clipboard,
  Database,
  ExternalLink,
  Languages,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Wifi,
  XCircle,
  Activity,
  Mail,
  Wrench,
  Heart,
} from "lucide-react";

type CheckStatus = "ok" | "warn" | "error";

type DiagnosticCheck = {
  label: string;
  status: CheckStatus;
  detail: string;
};

type ShopRow = {
  id: string;
  business_name: string | null;
  slug: string | null;
  is_published: boolean | null;
  is_activated: boolean | null;
  total_orders: number | null;
  created_at: string;
};

type OrderRow = {
  id: string;
  order_number: string | null;
  payment_status: string | null;
  order_status: string | null;
  total: number | null;
  created_at: string;
};

type PaymentRow = {
  id: string;
  status: string | null;
  amount: number | null;
  payment_method: string | null;
  created_at: string;
};

type Incident = {
  id: string;
  dedupe_key: string;
  category: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string | null;
  status: "open" | "acknowledged" | "resolved";
  occurrence_count: number;
  detected_at: string;
  last_seen_at: string;
  resolved_at: string | null;
};

const CACHE_PREFIXES = ["vp_tr_"];
const APP_LANGUAGE_KEY = "visualpro_lang";

const statusConfig: Record<CheckStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  ok: { label: "OK", icon: CheckCircle2, className: "border-primary/30 bg-primary/10 text-primary" },
  warn: { label: "À surveiller", icon: AlertTriangle, className: "border-border bg-muted text-foreground" },
  error: { label: "Blocage", icon: XCircle, className: "border-destructive/30 bg-destructive/10 text-destructive" },
};

const formatDate = (iso?: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
};

const removeTranslationCache = () => {
  Object.keys(localStorage).forEach((key) => {
    if (CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) localStorage.removeItem(key);
  });
};

export default function FounderTroubleshooting() {
  const { user, session, isReady } = useAuthReady();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isFounder, setIsFounder] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentSession, setCurrentSession] = useState<Session | null>(session);
  const [checks, setChecks] = useState<DiagnosticCheck[]>([]);
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [linkSlug, setLinkSlug] = useState("");
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [runningAction, setRunningAction] = useState<string | null>(null);

  const publicShopUrl = useMemo(() => {
    const slug = linkSlug.trim().replace(/^https?:\/\//, "").replace(/\.visuelpro\.cloud\/?$/, "").replace(/\/$/, "");
    return slug ? `https://${slug}.visuelpro.cloud` : "";
  }, [linkSlug]);

  const runDiagnostics = useCallback(async () => {
    setRefreshing(true);
    try {
      const sessionRes = await supabase.auth.getSession();
      const verifiedUserRes = await supabase.auth.getUser();
      const nextSession = sessionRes.data.session;
      setCurrentSession(nextSession);

      const [shopsRes, ordersRes, paymentsRes] = await Promise.all([
        supabase
          .from("shops")
          .select("id, business_name, slug, is_published, is_activated, total_orders, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("orders")
          .select("id, order_number, payment_status, order_status, total, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("payments")
          .select("id, status, amount, payment_method, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (!shopsRes.error) setShops((shopsRes.data ?? []) as ShopRow[]);
      if (!ordersRes.error) setOrders((ordersRes.data ?? []) as OrderRow[]);
      if (!paymentsRes.error) setPayments((paymentsRes.data ?? []) as PaymentRow[]);

      const { data: incData } = await supabase
        .from("app_incidents" as any)
        .select("*")
        .order("status", { ascending: true })
        .order("last_seen_at", { ascending: false })
        .limit(50);
      setIncidents(((incData ?? []) as unknown) as Incident[]);

      const lang = localStorage.getItem(APP_LANGUAGE_KEY) || "fr";
      const translatedKeys = Object.keys(localStorage).filter((key) => key.startsWith("vp_tr_")).length;
      const expiresAt = nextSession?.expires_at ? nextSession.expires_at * 1000 : 0;
      const minutesLeft = expiresAt ? Math.round((expiresAt - Date.now()) / 60_000) : 0;
      const blockedOrders = (ordersRes.data ?? []).filter((order) => order.payment_status === "pending").length;

      setChecks([
        {
          label: "Connexion locale",
          status: nextSession && !verifiedUserRes.error ? "ok" : "error",
          detail: nextSession
            ? `Session active pour ${nextSession.user.email ?? "utilisateur"}. Expire dans ${Math.max(minutesLeft, 0)} min.`
            : "Aucune session active détectée sur ce navigateur.",
        },
        {
          label: "Réseau navigateur",
          status: navigator.onLine ? "ok" : "error",
          detail: navigator.onLine ? "Le navigateur indique que la connexion Internet est disponible." : "Le navigateur semble hors ligne.",
        },
        {
          label: "Langue / traduction automatique",
          status: lang === "fr" ? "ok" : translatedKeys > 120 ? "warn" : "ok",
          detail: lang === "fr"
            ? "Interface en français, traduction DOM désactivée."
            : `Langue ${lang.toUpperCase()} active avec ${translatedKeys} traductions en cache. Revenir au français peut corriger un écran figé.`,
        },
        {
          label: "Lecture boutiques",
          status: shopsRes.error ? "error" : "ok",
          detail: shopsRes.error ? shopsRes.error.message : `${shopsRes.data?.length ?? 0} boutique(s) accessibles sur les dernières entrées.`,
        },
        {
          label: "Lecture commandes",
          status: ordersRes.error ? "error" : blockedOrders > 0 ? "warn" : "ok",
          detail: ordersRes.error ? ordersRes.error.message : `${ordersRes.data?.length ?? 0} commande(s) récentes, ${blockedOrders} paiement(s) en attente.`,
        },
        {
          label: "Lecture paiements",
          status: paymentsRes.error ? "error" : "ok",
          detail: paymentsRes.error ? paymentsRes.error.message : `${paymentsRes.data?.length ?? 0} paiement(s) récents accessibles.`,
        },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (!user?.id) {
      setIsFounder(false);
      setLoading(false);
      return;
    }

    void supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      // @ts-ignore - app_role enum
      .in("role", ["founder", "co_founder"])
      .then(({ data }) => {
        const allowed = !!data?.length;
        setIsFounder(allowed);
        if (allowed) void runDiagnostics();
        else setLoading(false);
      });
  }, [isReady, runDiagnostics, user?.id]);

  const handleRefreshSession = async () => {
    setRefreshing(true);
    const { data, error } = await supabase.auth.refreshSession();
    setCurrentSession(data.session ?? null);
    setRefreshing(false);
    toast({
      title: error ? "Session non rafraîchie" : "Session rafraîchie",
      description: error?.message ?? "La session locale a été renouvelée.",
      variant: error ? "destructive" : "default",
    });
    await runDiagnostics();
  };

  const handleResetLanguage = () => {
    localStorage.setItem(APP_LANGUAGE_KEY, "fr");
    removeTranslationCache();
    toast({ title: "Langue réinitialisée", description: "L’interface repasse en français et le cache de traduction est vidé." });
    window.location.reload();
  };

  const handleLocalLogout = async () => {
    await supabase.auth.signOut({ scope: "local" });
    localStorage.removeItem(APP_LANGUAGE_KEY);
    removeTranslationCache();
    window.location.href = "/auth";
  };

  const copyDiagnostic = async () => {
    const payload = {
      time: new Date().toISOString(),
      user: currentSession?.user.email ?? null,
      checks,
      incidents: incidents.slice(0, 20),
      recentOrders: orders.slice(0, 5),
      recentPayments: payments.slice(0, 5),
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast({ title: "Diagnostic copié", description: "Le rapport local est prêt à être collé dans un ticket ou une note interne." });
  };

  const runRemediation = async (action: string, params?: Record<string, unknown>, successLabel = "Action exécutée") => {
    setRunningAction(action + (params?.incident_id ? `:${params.incident_id}` : ""));
    try {
      const { data, error } = await supabase.functions.invoke("app-remediation", { body: { action, params } });
      const ok = !error && (data as any)?.success !== false;
      toast({
        title: ok ? successLabel : "Action échouée",
        description: ok ? "Le serveur a confirmé l'opération." : (error?.message || (data as any)?.error || "Erreur inconnue"),
        variant: ok ? "default" : "destructive",
      });
      await runDiagnostics();
    } finally {
      setRunningAction(null);
    }
  };

  if (!isReady || loading || isFounder === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isFounder) return <Navigate to="/" replace />;

  const openIncidents = incidents.filter((i) => i.status !== "resolved");
  const criticalCount = openIncidents.filter((i) => i.severity === "critical").length;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-10">
      <div className="container mx-auto px-3 md:px-6 py-6 md:py-10 max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
          <div>
            <Badge variant="outline" className="mb-3 gap-2">
              <ShieldCheck className="h-3.5 w-3.5" /> Espace fondateur
            </Badge>
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight flex items-center gap-2">
              <Bug className="h-7 w-7 text-primary" /> Centre de dépannage local
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Vérifiez rapidement connexion, traduction, boutiques, commandes et paiements sans attendre une intervention externe.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={copyDiagnostic} className="gap-2">
              <Clipboard className="h-4 w-4" /> Copier le rapport
            </Button>
            <Button onClick={runDiagnostics} disabled={refreshing} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Relancer
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-6">
          <QuickAction
            icon={<RefreshCw className="h-5 w-5" />}
            title="Rafraîchir la session"
            description="Corrige souvent une connexion bloquée après veille mobile ou onglets multiples."
            action="Rafraîchir"
            onClick={handleRefreshSession}
          />
          <QuickAction
            icon={<Languages className="h-5 w-5" />}
            title="Réinitialiser la langue"
            description="Repasse en français et vide les traductions qui peuvent figer l’interface."
            action="Réinitialiser"
            onClick={handleResetLanguage}
          />
          <QuickAction
            icon={<LogOut className="h-5 w-5" />}
            title="Nettoyer la session locale"
            description="Déconnecte uniquement ce navigateur puis renvoie vers la connexion."
            action="Nettoyer"
            onClick={handleLocalLogout}
          />
        </div>

        <Tabs defaultValue="checks" className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl">
            <TabsTrigger value="global" className="gap-1">
              <Heart className="h-3.5 w-3.5" /> Santé globale
              {openIncidents.length > 0 && (
                <Badge variant={criticalCount > 0 ? "destructive" : "secondary"} className="ml-1 h-4 px-1 text-[10px]">
                  {openIncidents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="checks">État app</TabsTrigger>
            <TabsTrigger value="commerce">Commerce</TabsTrigger>
            <TabsTrigger value="links">Liens</TabsTrigger>
          </TabsList>

          <TabsContent value="global" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> Actions de remédiation globales</CardTitle>
                <CardDescription>Ces actions s'exécutent côté serveur et affectent tous les utilisateurs. À utiliser avec précaution.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <GlobalAction
                  title="Lancer un contrôle de santé maintenant"
                  description="Force une vérification complète : DB, auth, paiements, commandes, emails."
                  busy={runningAction === "run_health_check"}
                  onClick={() => runRemediation("run_health_check", {}, "Contrôle de santé lancé")}
                />
                <GlobalAction
                  title="Débloquer les paiements en attente (>1h)"
                  description="Marque les paiements pendants depuis plus d'1h comme échoués pour que les clients puissent réessayer."
                  busy={runningAction === "retry_stuck_payments"}
                  onClick={() => runRemediation("retry_stuck_payments", {}, "Paiements bloqués traités")}
                />
                <GlobalAction
                  title="Relancer la file de génération bloquée"
                  description="Remet en attente les générations IA coincées en 'processing' depuis >15 min."
                  busy={runningAction === "release_stuck_queue"}
                  onClick={() => runRemediation("release_stuck_queue", {}, "File de génération relancée")}
                />
                <GlobalAction
                  title="Envoyer un email de test"
                  description="Envoie une alerte de test à votre adresse pour vérifier les notifications."
                  busy={runningAction === "test_email_alert"}
                  onClick={() => runRemediation("test_email_alert", {}, "Email de test envoyé")}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" /> Incidents détectés
                  <Badge variant="outline" className="ml-auto">{openIncidents.length} ouvert(s)</Badge>
                </CardTitle>
                <CardDescription>
                  Le monitoring tourne automatiquement toutes les 5 minutes. Vous recevez un email à chaque nouvel incident critique.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {incidents.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-primary" />
                    <p className="font-medium">Aucun incident enregistré</p>
                    <p className="text-xs">L'application fonctionne normalement.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {incidents.map((inc) => (
                      <IncidentRow
                        key={inc.id}
                        incident={inc}
                        busy={runningAction === `resolve_incident:${inc.id}`}
                        onResolve={() => runRemediation("resolve_incident", { incident_id: inc.id }, "Incident résolu")}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="checks" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {checks.map((check) => <CheckCard key={check.label} check={check} />)}
            </div>
          </TabsContent>

          <TabsContent value="commerce" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <DataList title="Boutiques récentes" icon={<Database className="h-4 w-4" />} empty="Aucune boutique accessible">
                {shops.map((shop) => (
                  <div key={shop.id} className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{shop.business_name || "Sans nom"}</p>
                      <Badge variant={shop.is_published ? "default" : "secondary"}>{shop.is_published ? "Publiée" : "Brouillon"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{shop.slug ? `${shop.slug}.visuelpro.cloud` : "Slug absent"}</p>
                    <p className="text-xs text-muted-foreground">{shop.total_orders ?? 0} commande(s) · {formatDate(shop.created_at)}</p>
                  </div>
                ))}
              </DataList>
              <DataList title="Commandes récentes" icon={<Wifi className="h-4 w-4" />} empty="Aucune commande récente">
                {orders.map((order) => (
                  <div key={order.id} className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{order.order_number || order.id.slice(0, 8)}</p>
                      <Badge variant={order.payment_status === "paid" ? "default" : "secondary"}>{order.payment_status || "—"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{(order.total ?? 0).toLocaleString("fr-FR")} FCFA · {order.order_status || "—"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                  </div>
                ))}
              </DataList>
              <DataList title="Paiements récents" icon={<ShieldCheck className="h-4 w-4" />} empty="Aucun paiement récent">
                {payments.map((payment) => (
                  <div key={payment.id} className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{payment.payment_method || "Paiement"}</p>
                      <Badge variant={payment.status === "completed" ? "default" : "secondary"}>{payment.status || "—"}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{(payment.amount ?? 0).toLocaleString("fr-FR")} FCFA</p>
                    <p className="text-xs text-muted-foreground">{formatDate(payment.created_at)}</p>
                  </div>
                ))}
              </DataList>
            </div>
          </TabsContent>

          <TabsContent value="links" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Vérificateur de lien boutique</CardTitle>
                <CardDescription>Collez un slug ou un domaine pour générer le lien public canonique.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input value={linkSlug} onChange={(e) => setLinkSlug(e.target.value)} placeholder="ma-boutique ou ma-boutique.visuelpro.cloud" />
                  <Button asChild disabled={!publicShopUrl} className="gap-2">
                    <a href={publicShopUrl || "#"} target="_blank" rel="noreferrer">
                      Ouvrir <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
                {publicShopUrl && <p className="text-sm text-muted-foreground break-all">Lien généré : {publicShopUrl}</p>}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" asChild><Link to="/boutiques-ecommerce">Tester page e-commerce</Link></Button>
                  <Button variant="outline" asChild><Link to="/shop-manager">Tester espace boutiques</Link></Button>
                  <Button variant="outline" asChild><Link to="/orders-diagnostic">Diagnostic commandes avancé</Link></Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function QuickAction({ icon, title, description, action, onClick }: { icon: React.ReactNode; title: string; description: string; action: string; onClick: () => void }) {
  return (
    <Card>
      <CardContent className="p-4 flex flex-col gap-3 h-full">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 text-primary p-2">{icon}</div>
          <div className="min-w-0">
            <p className="font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onClick} className="mt-auto w-full">{action}</Button>
      </CardContent>
    </Card>
  );
}

function CheckCard({ check }: { check: DiagnosticCheck }) {
  const config = statusConfig[check.status];
  const Icon = config.icon;
  return (
    <Card className={config.className}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Icon className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold">{check.label}</p>
              <Badge variant="outline">{config.label}</Badge>
            </div>
            <p className="text-sm mt-1 opacity-90">{check.detail}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DataList({ title, icon, empty, children }: { title: string; icon: React.ReactNode; empty: string; children: React.ReactNode[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[520px] overflow-y-auto">
          {children.length ? children : <p className="text-sm text-muted-foreground text-center py-8">{empty}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function GlobalAction({ title, description, onClick, busy }: { title: string; description: string; onClick: () => void; busy: boolean }) {
  return (
    <div className="rounded-md border p-3 flex flex-col gap-2">
      <p className="font-medium text-sm">{title}</p>
      <p className="text-xs text-muted-foreground flex-1">{description}</p>
      <Button size="sm" variant="outline" onClick={onClick} disabled={busy} className="gap-2 mt-1">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
        Exécuter
      </Button>
    </div>
  );
}

function IncidentRow({ incident, onResolve, busy }: { incident: Incident; onResolve: () => void; busy: boolean }) {
  const sevClass = incident.severity === "critical"
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : incident.severity === "warning"
    ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
    : "border-primary/30 bg-primary/10 text-primary";
  const isResolved = incident.status === "resolved";
  return (
    <div className={`rounded-md border p-3 ${isResolved ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={sevClass + " uppercase text-[10px]"}>{incident.severity}</Badge>
            <Badge variant="outline" className="text-[10px]">{incident.category}</Badge>
            {isResolved && <Badge variant="secondary" className="text-[10px]">Résolu</Badge>}
            <p className="font-medium text-sm">{incident.title}</p>
          </div>
          {incident.description && <p className="text-xs text-muted-foreground mt-1">{incident.description}</p>}
          <p className="text-[11px] text-muted-foreground mt-1">
            {incident.occurrence_count} occurrence(s) · détecté {formatDate(incident.detected_at)} · vu {formatDate(incident.last_seen_at)}
          </p>
        </div>
        {!isResolved && (
          <Button size="sm" variant="outline" onClick={onResolve} disabled={busy} className="gap-1 shrink-0">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Résoudre
          </Button>
        )}
      </div>
    </div>
  );
}