import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, TrendingUp, TrendingDown, Wallet, Megaphone, Package, Truck, Users, Sparkles, MessageCircle, Mail, Send, Activity, BrainCircuit, Receipt, ArrowRight, Download, CreditCard, Bell } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { AdAccountsManager } from "@/components/shop/AdAccountsManager";
import { XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ComposedChart, Area, Bar } from "recharts";
import {
  type FinancePeriod, VALIDATED_STATUSES, csvCell, dayOf, isCashedIn, isInPeriod, isValidEmail,
  localDayKey, periodStartKey, toFcfa, whatsappDigits,
} from "@/lib/shopFinance";

interface Order { id: string; order_number?: string; total: number; order_status: string; payment_status: string; created_at: string; }
interface Expense { id: string; shop_id: string; category: string; amount: number; description: string | null; expense_date: string; created_at: string; }

const CATEGORIES: { value: string; label: string; icon: any; color: string }[] = [
  { value: "ads", label: "Publicité", icon: Megaphone, color: "text-pink-600 bg-pink-100" },
  { value: "stock", label: "Achat de stock", icon: Package, color: "text-blue-600 bg-blue-100" },
  { value: "shipping", label: "Livraison", icon: Truck, color: "text-orange-600 bg-orange-100" },
  { value: "salary", label: "Salaires / Personnel", icon: Users, color: "text-purple-600 bg-purple-100" },
  { value: "other", label: "Autres dépenses", icon: Wallet, color: "text-gray-600 bg-gray-100" },
];

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));

interface Props {
  shopId: string;
  shop: any;
  orders: Order[];
}

export function ShopFinances({ shopId, shop, orders }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [adSpend, setAdSpend] = useState<{ spend_date: string; amount: number; currency: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [period, setPeriod] = useState<FinancePeriod>("month");
  
  // Modals state
  const [addOpen, setAddOpen] = useState(false);
  const [adsOpen, setAdsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ category: "ads", amount: "", description: "", expense_date: localDayKey(new Date()) });
  const [aiAdvice, setAiAdvice] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  
  const [autoEmail, setAutoEmail] = useState<boolean>(!!shop?.weekly_finance_email_enabled);
  const [emailRecipient, setEmailRecipient] = useState<string>(shop?.weekly_finance_email || "");
  const savedRecipient = useRef<string>((shop?.weekly_finance_email || "").trim());
  const [savingAuto, setSavingAuto] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);

  // PostgREST plafonne chaque réponse à 1 000 lignes quel que soit .limit() : lecture par pages, sinon les dépenses
  // publicitaires (une ligne par jour et par compte, jusqu'à 37 mois d'historique) sont tronquées sans erreur.
  const fetchAllPages = async (build: () => any): Promise<{ rows: any[]; failed: boolean }> => {
    const rows: any[] = [];
    for (let from = 0; from < 20000; from += 1000) {
      const page = await build().range(from, from + 999);
      if (page.error) return { rows, failed: true };
      rows.push(...(page.data || []));
      if (!page.data || page.data.length < 1000) break;
    }
    return { rows, failed: false };
  };

  const reloadAll = async () => {
    const [exp, pay, ads] = await Promise.all([
      fetchAllPages(() => supabase.from("shop_expenses" as any).select("*").eq("shop_id", shopId)
        .order("expense_date", { ascending: false }).order("id", { ascending: false })),
      fetchAllPages(() => supabase.from("commission_payments").select("id, amount, created_at").eq("shop_id", shopId).eq("status", "paid")
        .order("created_at", { ascending: false }).order("id", { ascending: false })),
      fetchAllPages(() => (supabase as any).from("ad_spend_daily").select("id, spend_date, amount, currency").eq("shop_id", shopId)
        .order("spend_date", { ascending: false }).order("id", { ascending: false })),
    ]);
    // Une lecture en échec ne doit pas s'afficher comme « 0 FCFA » : on le dit.
    setLoadFailed(exp.failed || pay.failed || ads.failed);
    setExpenses(exp.rows as Expense[]);
    setPayments(pay.rows);
    setAdSpend(ads.rows.map((r: any) => ({ spend_date: r.spend_date, amount: Number(r.amount || 0), currency: r.currency || "XOF" })));
    setLoading(false);
  };
  useEffect(() => { setLoading(true); reloadAll(); }, [shopId]);

  const startKey = useMemo(() => periodStartKey(period), [period]);

  const filtered = useMemo(() => {
    // Dépenses publicitaires converties en FCFA ; une devise sans parité fixe (USD...) n'est pas additionnée à des FCFA.
    const ads: { spend_date: string; amount: number }[] = [];
    const skipped = new Set<string>();
    adSpend.forEach(a => {
      if (!isInPeriod(a.spend_date, startKey)) return;
      const converted = toFcfa(a.amount, a.currency);
      if (converted === null) { skipped.add(String(a.currency).toUpperCase()); return; }
      ads.push({ spend_date: a.spend_date, amount: converted });
    });
    return {
      orders: orders.filter(o => isInPeriod(o.created_at, startKey)),
      expenses: expenses.filter(e => isInPeriod(e.expense_date, startKey)),
      platformPayments: payments.filter(p => isInPeriod(p.created_at, startKey)),
      adSpend: ads,
      skippedCurrencies: Array.from(skipped),
    };
  }, [orders, expenses, payments, adSpend, startKey]);

  const stats = useMemo(() => {
    const confirmed = filtered.orders.filter(o => VALIDATED_STATUSES.includes(o.order_status));
    const delivered = filtered.orders.filter(o => o.order_status === "delivered");

    const cashIn = filtered.orders.filter(isCashedIn).reduce((s, o) => s + Number(o.total || 0), 0);
    const revenue = confirmed.reduce((s, o) => s + Number(o.total || 0), 0);

    const expByCat: Record<string, number> = {};
    filtered.expenses.forEach(e => { expByCat[e.category] = (expByCat[e.category] || 0) + Number(e.amount); });

    const adSpendTotal = filtered.adSpend.reduce((s, a) => s + Number(a.amount || 0), 0);
    if (adSpendTotal > 0) {
      expByCat["ads"] = (expByCat["ads"] || 0) + adSpendTotal;
    }

    const manualExpenses = filtered.expenses.reduce((s, e) => s + Number(e.amount), 0);
    const operatingExpenses = manualExpenses + adSpendTotal;
    const platformFees = filtered.platformPayments.reduce((s, p) => s + Number(p.amount), 0);
    // « Dépenses totales » = tout ce qui est déduit du bénéfice, frais Ecomfy compris : les chiffres se recoupent.
    const totalExpenses = operatingExpenses + platformFees;

    const commissionDue = Number(shop?.commission_balance_due) || 0;
    const profit = cashIn - totalExpenses;

    // Margins & Advanced Metrics
    const margin = cashIn > 0 ? (profit / cashIn) * 100 : 0;
    const roas = adSpendTotal > 0 ? (cashIn / adSpendTotal) : 0;
    const cac = confirmed.length > 0 ? (adSpendTotal / confirmed.length) : 0; // Coût publicitaire par commande validée

    return {
      ordersCount: filtered.orders.length,
      confirmedCount: confirmed.length,
      deliveredCount: delivered.length,
      revenue, cashIn, totalExpenses, operatingExpenses, platformFees, commissionDue, profit, margin, expByCat, adSpendTotal,
      roas, cac
    };
  }, [filtered, shop]);

  const cashflowData = useMemo(() => {
    // Semaine : 7 jours ; mois : du 1er à aujourd'hui ; tout : un point par mois (les 24 derniers au plus).
    const monthly = period === "all";
    const bucketOf = (value: string) => { const day = dayOf(value); return monthly ? day.slice(0, 7) : day; };
    const map: Record<string, { cashIn: number; expenses: number }> = {};
    const today = new Date();

    if (monthly) {
      const days = [
        ...orders.map(o => dayOf(o.created_at)), ...expenses.map(e => dayOf(e.expense_date)),
        ...payments.map(p => dayOf(p.created_at)), ...adSpend.map(a => dayOf(a.spend_date)),
      ].filter(Boolean).sort();
      const first = days.length ? new Date(`${days[0].slice(0, 7)}-01T12:00:00`) : today;
      const cursor = new Date(Math.max(first.getTime(), new Date(today.getFullYear(), today.getMonth() - 23, 1, 12).getTime()));
      cursor.setDate(1);
      while (localDayKey(cursor).slice(0, 7) <= localDayKey(today).slice(0, 7)) {
        map[localDayKey(cursor).slice(0, 7)] = { cashIn: 0, expenses: 0 };
        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else {
      const start = startKey ? new Date(`${startKey}T12:00:00`) : today;
      for (const d = new Date(start); localDayKey(d) <= localDayKey(today); d.setDate(d.getDate() + 1)) {
        map[localDayKey(d)] = { cashIn: 0, expenses: 0 };
      }
    }

    const slot = (value: string) => map[bucketOf(value)];
    filtered.orders.forEach(o => { const s = slot(o.created_at); if (s && isCashedIn(o)) s.cashIn += Number(o.total || 0); });
    filtered.expenses.forEach(e => { const s = slot(e.expense_date); if (s) s.expenses += Number(e.amount); });
    filtered.adSpend.forEach(a => { const s = slot(a.spend_date); if (s) s.expenses += Number(a.amount); });
    filtered.platformPayments.forEach(p => { const s = slot(p.created_at); if (s) s.expenses += Number(p.amount); });

    return Object.keys(map).sort().map(key => {
      const date = new Date(monthly ? `${key}-01T12:00:00` : `${key}T12:00:00`);
      return {
        date: monthly
          ? date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })
          : date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" }),
        entrees: map[key].cashIn,
        sorties: map[key].expenses,
      };
    });
  }, [filtered, orders, expenses, payments, adSpend, period, startKey]);

  const addExpense = async () => {
    const amount = Math.round(Number(form.amount));
    if (!form.amount || !Number.isFinite(amount) || amount <= 0) { toast({ title: "Montant invalide", variant: "destructive" }); return; }
    if (amount > 1_000_000_000) { toast({ title: "Montant trop élevé", description: "Vérifiez le nombre de zéros.", variant: "destructive" }); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.expense_date)) { toast({ title: "Date invalide", variant: "destructive" }); return; }
    setSaving(true);
    const { data, error } = await supabase.from("shop_expenses" as any).insert({
      shop_id: shopId,
      category: form.category,
      amount,
      description: form.description.trim().slice(0, 500) || null,
      expense_date: form.expense_date,
    }).select().single();
    setSaving(false);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    // Le registre est trié par date décroissante : une dépense antidatée ne doit pas s'afficher tout en haut.
    setExpenses(prev => [data as any, ...prev].sort((a, b) => b.expense_date.localeCompare(a.expense_date)));
    setAddOpen(false);
    setForm({ category: "ads", amount: "", description: "", expense_date: localDayKey(new Date()) });
    toast({ title: "Dépense enregistrée" });
  };

  const removeExpense = async (id: string) => {
    if (!confirm("Supprimer cette dépense ?")) return;
    const { error } = await supabase.from("shop_expenses" as any).delete().eq("id", id);
    if (error) { toast({ title: "Suppression impossible", description: error.message, variant: "destructive" }); return; }
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const exportAccountingReport = () => {
    const rows: { date: string, type: string, category: string, desc: string, in: number, out: number }[] = [];

    filtered.orders.filter(isCashedIn).forEach(o => {
      rows.push({ date: dayOf(o.created_at), type: "Vente encaissée", category: "Commande", desc: o.order_number || `CMD-${o.id.split('-')[0]}`, in: Math.round(Number(o.total || 0)), out: 0 });
    });
    filtered.expenses.forEach(e => {
      const catLabel = CATEGORIES.find(c => c.value === e.category)?.label || e.category;
      rows.push({ date: dayOf(e.expense_date), type: "Dépense manuelle", category: catLabel, desc: e.description || "-", in: 0, out: Math.round(Number(e.amount)) });
    });
    filtered.adSpend.forEach(a => {
      rows.push({ date: dayOf(a.spend_date), type: "Dépense publicitaire", category: "Publicité", desc: "Dépense journalière synchronisée", in: 0, out: Math.round(Number(a.amount)) });
    });
    filtered.platformPayments.forEach(p => {
      rows.push({ date: dayOf(p.created_at), type: "Frais plateforme", category: "Commissions", desc: "Paiement facture Ecomfy", in: 0, out: Math.round(Number(p.amount)) });
    });

    rows.sort((a, b) => a.date.localeCompare(b.date));

    // Point-virgule : Excel en français lit une virgule comme une décimale et colle tout dans une seule colonne.
    const empty = '""';
    const lines = [["Date", "Type", "Catégorie", "Description", "Entrées (FCFA)", "Sorties (FCFA)"].map(csvCell).join(";")];
    rows.forEach(r => {
      lines.push([csvCell(r.date.split("-").reverse().join("/")), csvCell(r.type), csvCell(r.category), csvCell(r.desc), r.in, r.out].join(";"));
    });
    lines.push("");
    lines.push([csvCell("TOTAL"), empty, empty, empty, Math.round(stats.cashIn), Math.round(stats.totalExpenses)].join(";"));
    lines.push([csvCell("BÉNÉFICE NET"), empty, empty, empty, Math.round(stats.profit), empty].join(";"));
    lines.push([csvCell("ROAS"), empty, empty, empty, csvCell(stats.roas.toFixed(2).replace(".", ",")), empty].join(";"));
    lines.push([csvCell("CAC (FCFA)"), empty, empty, empty, Math.round(stats.cac), empty].join(";"));
    if (filtered.skippedCurrencies.length > 0) {
      lines.push(csvCell(`Dépenses publicitaires en ${filtered.skippedCurrencies.join(", ")} non converties, exclues des totaux`));
    }

    // BOM for Excel UTF-8 support
    const blob = new Blob(["\uFEFF" + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const periodTag = period === "week" ? "7j" : period === "month" ? "mois" : "tout";
    link.setAttribute("href", url);
    link.setAttribute("download", `Fiche_Comptable_${(shop?.business_name || "Boutique").replace(/[^\p{L}\p{N}]+/gu, "_")}_${periodTag}_${localDayKey(new Date())}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast({ title: "Fiche comptable exportée avec succès" });
  };

  const askAI = async () => {
    setAiLoading(true);
    setAiAdvice("");
    const { ordersCount, deliveredCount, revenue, cashIn, totalExpenses, platformFees, profit, margin, adSpendTotal, roas, cac, expByCat } = stats;
    const { data, error } = await supabase.functions.invoke("finance-advisor", {
      body: { stats: { ordersCount, deliveredCount, revenue, cashIn, totalExpenses, platformFees, profit, margin, adSpendTotal, roas, cac, expByCat, period, shopName: shop?.business_name } },
    });
    setAiLoading(false);
    if (error || !data?.success) {
      toast({ title: "L'IA n'a pas pu répondre", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    setAiAdvice(data.advice);
  };

  const sendWhatsAppSummary = () => {
    const phone = whatsappDigits(shop?.whatsapp_number) || whatsappDigits(shop?.phone_number);
    if (!phone) { toast({ title: "Aucun numéro WhatsApp valide (avec l'indicatif du pays) dans les paramètres", variant: "destructive" }); return; }
    const periodLabel = period === "week" ? "7 derniers jours" : period === "month" ? "ce mois" : "depuis l'ouverture";
    const lines = [
      `📊 *Résumé financier — ${shop?.business_name || "Boutique"}*`,
      `_Période : ${periodLabel}_`,
      ``,
      `🛒 Commandes : ${stats.ordersCount} (${stats.deliveredCount} livrées)`,
      `💰 Chiffre d'affaires : ${fmt(stats.revenue)} FCFA`,
      `✅ Encaissé (livré) : ${fmt(stats.cashIn)} FCFA`,
      ``,
      `💸 Dépenses totales : ${fmt(stats.totalExpenses)} FCFA`,
      `   dont frais Ecomfy payés : ${fmt(stats.platformFees)} FCFA`,
      ``,
      `📈 *Bénéfice net estimé : ${fmt(stats.profit)} FCFA*`,
      `📊 Marge Nette : ${stats.margin.toFixed(1)}%`,
      `🎯 CAC : ${fmt(stats.cac)} FCFA/Client`,
      `🔥 ROAS : ${stats.roas.toFixed(2)}x`,
      ``,
      `— Ecomfy Cloud`,
    ];
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank");
  };

  // Retourne true si l'enregistrement a réussi. Une adresse vide est permise (le résumé part alors vers l'e-mail du compte).
  const saveAutoEmail = async (enabled: boolean, recipient?: string): Promise<boolean> => {
    const cleaned = recipient?.trim();
    if (enabled && cleaned && !isValidEmail(cleaned)) {
      toast({ title: "Adresse e-mail invalide", description: "Corrigez l'adresse avant d'activer l'envoi.", variant: "destructive" });
      return false;
    }
    setSavingAuto(true);
    const payload: any = { shop_id: shopId, weekly_finance_email_enabled: enabled };
    if (cleaned !== undefined) payload.weekly_finance_email = cleaned || null;
    const { error } = await (supabase as any)
      .from("shop_secrets")
      .upsert(payload, { onConflict: "shop_id" });
    setSavingAuto(false);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return false; }
    setAutoEmail(enabled);
    if (cleaned !== undefined) { setEmailRecipient(cleaned); savedRecipient.current = cleaned; }
    toast({ title: enabled ? "Envoi automatique activé" : "Envoi automatique désactivé", description: enabled ? "Vous recevrez un résumé chaque lundi à 8h." : undefined });
    return true;
  };

  // À la sortie du champ : n'enregistre que si l'adresse a changé (sinon un clic dans le champ réécrit et notifie pour rien).
  const saveRecipientOnBlur = async () => {
    if (emailRecipient.trim() === savedRecipient.current) return;
    await saveAutoEmail(true, emailRecipient);
  };

  const sendNow = async () => {
    setSendingNow(true);
    // Le test lit l'adresse en base : on enregistre d'abord celle qui est affichée.
    if (emailRecipient.trim() !== savedRecipient.current && !(await saveAutoEmail(true, emailRecipient))) { setSendingNow(false); return; }
    const { data, error } = await supabase.functions.invoke("send-weekly-finance-summary", { body: { shop_id: shopId, test: true } });
    setSendingNow(false);
    if (error || !data?.success || !data.sent) {
      toast({ title: "Échec de l'envoi", description: data?.errors?.[0] || data?.error || error?.message || "Aucun e-mail n'a été envoyé.", variant: "destructive" });
      return;
    }
    toast({ title: "E-mail envoyé", description: "Vérifiez votre boîte de réception (et les courriers indésirables)." });
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6 font-inter pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-space font-bold text-slate-900 tracking-tight">Outil Comptable Expert</h2>
          <p className="text-sm text-slate-500 mt-1">Gérez votre trésorerie, vos marges et votre acquisition avec précision.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200 shadow-sm">
          {[
            { id: "week", label: "7 Jours" },
            { id: "month", label: "Ce Mois" },
            { id: "all", label: "Tout" }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id as any)}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                period === p.id 
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loadFailed && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
          <span>Une partie des données financières n'a pas pu être chargée : les montants affichés peuvent être incomplets.</span>
          <Button size="sm" variant="outline" className="shrink-0 border-red-200" onClick={() => { setLoading(true); reloadAll(); }}>Réessayer</Button>
        </div>
      )}
      {filtered.skippedCurrencies.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Des dépenses publicitaires en {filtered.skippedCurrencies.join(", ")} ne sont pas converties en FCFA et sont exclues des totaux.
          Passez votre compte publicitaire en FCFA/XOF ou ajoutez ces dépenses à la main.
        </div>
      )}

      {/* Command Center - Horizontal Action Bar */}
      <Card className="p-2 border-slate-100 shadow-sm bg-white overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          <Button variant="ghost" className="font-semibold hover:bg-slate-50" onClick={() => setAdsOpen(true)}>
            <Megaphone className="h-4 w-4 mr-2 text-pink-500" /> Connexions Publicitaires
          </Button>
          <div className="w-px h-6 bg-slate-200 mx-1" />
          <Button variant="ghost" className="font-semibold hover:bg-slate-50" onClick={() => setReportsOpen(true)}>
            <Bell className="h-4 w-4 mr-2 text-orange-500" /> Alertes & Rapports
          </Button>
          <div className="flex-1" />
          <Button variant="outline" className="font-bold border-slate-200 text-slate-700 shadow-sm" onClick={exportAccountingReport}>
            <Download className="h-4 w-4 mr-2" /> Exporter Fiche Comptable (.csv)
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Main Dashboard Area */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* KPI Row (Quickbooks/Premium Style) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-5 border-none shadow-md bg-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-blue-500" /> Ventes Validées</div>
                <div className="text-2xl font-bold text-slate-900">{fmt(stats.revenue)}</div>
                <div className="text-[10px] text-slate-400 mt-1 font-medium">FCFA (Hors livraisons en cours)</div>
              </div>
            </Card>

            <Card className="p-5 border-none shadow-md bg-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-50 rounded-bl-full transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Argent Encaissé</div>
                <div className="text-2xl font-bold text-emerald-600">{fmt(stats.cashIn)}</div>
                <div className="text-[10px] text-slate-400 mt-1 font-medium">FCFA (Livrées, hors remboursées)</div>
              </div>
            </Card>

            <Card className="p-5 border-none shadow-md bg-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-16 h-16 bg-red-50 rounded-bl-full transition-transform group-hover:scale-110" />
              <div className="relative z-10">
                <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-1.5"><TrendingDown className="h-3.5 w-3.5 text-red-500" /> Dépenses Totales</div>
                <div className="text-2xl font-bold text-red-600">{fmt(stats.totalExpenses)}</div>
                <div className="text-[10px] text-slate-400 mt-1 font-medium">
                  {stats.platformFees > 0 ? `FCFA (dont ${fmt(stats.platformFees)} de frais Ecomfy)` : "FCFA (Pub + Opérationnel)"}
                </div>
              </div>
            </Card>

            {/* Benefice Net (Accentuated Card) */}
            <Card className={`p-5 border-none shadow-lg relative overflow-hidden text-white ${stats.profit >= 0 ? "bg-[#0E7C66]" : "bg-red-600"}`}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl -mr-8 -mt-8" />
              <div className="relative z-10">
                <div className="text-xs font-semibold text-white/80 mb-2 uppercase tracking-wider flex items-center justify-between">
                  Bénéfice Net 
                  {stats.margin !== 0 && (
                    <Badge className="bg-white/20 hover:bg-white/30 text-white border-none font-bold shadow-sm">
                      {stats.margin.toFixed(1)}% Marge
                    </Badge>
                  )}
                </div>
                <div className="text-2xl font-bold tracking-tight">{fmt(stats.profit)}</div>
                <div className="text-[10px] text-white/70 mt-1 font-medium">FCFA (Après déduction)</div>
              </div>
            </Card>
          </div>

          {/* Advanced Metrics (New) */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4 border-slate-100 shadow-sm bg-white flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1 uppercase">Coût d'Acquisition Client (CAC)</div>
                <div className="text-xl font-bold text-slate-900">{fmt(stats.cac)} FCFA</div>
                <div className="text-[10px] text-slate-400">Coût publicitaire par vente</div>
              </div>
              <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center">
                <Users className="h-5 w-5 text-orange-500" />
              </div>
            </Card>
            <Card className="p-4 border-slate-100 shadow-sm bg-white flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-500 mb-1 uppercase">ROAS (Retour s/ Invest.)</div>
                <div className="text-xl font-bold text-slate-900">{stats.roas.toFixed(2)}x</div>
                <div className="text-[10px] text-slate-400">Revenus générés par la pub</div>
              </div>
              <div className="h-10 w-10 rounded-full bg-pink-50 flex items-center justify-center">
                <Activity className="h-5 w-5 text-pink-500" />
              </div>
            </Card>
          </div>

          {/* Cashflow Chart */}
          <Card className="p-6 border-slate-100 shadow-sm bg-white">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2"><Activity className="h-5 w-5 text-indigo-500" /> Flux de Trésorerie (Cashflow)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Analysez les entrées d'argent réel face à vos dépenses quotidiennes.</p>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-emerald-500" /><span className="text-xs font-semibold text-slate-600">Entrées</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-400" /><span className="text-xs font-semibold text-slate-600">Sorties</span></div>
              </div>
            </div>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={cashflowData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} width={60} />
                  <RechartsTooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="entrees" name="Entrées (Encaissé)" stroke="#10b981" strokeWidth={3} fill="url(#colorIn)" />
                  <Bar dataKey="sorties" name="Sorties (Dépenses)" fill="#f87171" radius={[4, 4, 0, 0]} barSize={12} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Dépenses Modernisées */}
          <Card className="p-6 border-slate-100 shadow-sm bg-white overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2"><Receipt className="h-5 w-5 text-slate-700" /> Registre des Dépenses</h3>
                <p className="text-xs text-slate-500 mt-0.5">Suivez précisément où va votre argent.</p>
              </div>
              <Button onClick={() => setAddOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-white shadow-md">
                <Plus className="h-4 w-4 mr-2" /> Ajouter une Dépense
              </Button>
            </div>

            {filtered.expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Wallet className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500 font-medium">Aucune dépense manuelle enregistrée sur cette période.</p>
                <p className="text-xs text-slate-400 mt-1">Les dépenses publicitaires sont importées automatiquement.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-left rounded-tl-xl">Catégorie</th>
                      <th className="px-4 py-3 font-semibold text-left">Description</th>
                      <th className="px-4 py-3 font-semibold text-left">Date</th>
                      <th className="px-4 py-3 font-semibold text-right">Montant</th>
                      <th className="px-4 py-3 font-semibold text-center rounded-tr-xl">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.expenses.map(e => {
                      const cat = CATEGORIES.find(c => c.value === e.category);
                      const Icon = cat?.icon || Wallet;
                      return (
                        <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-2 font-medium">
                              <span className={`h-7 w-7 rounded-md inline-flex items-center justify-center ${cat?.color}`}><Icon className="h-3.5 w-3.5" /></span>
                              {cat?.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 truncate max-w-[200px]">{e.description || "-"}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{new Date(e.expense_date).toLocaleDateString("fr-FR")}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900">{fmt(e.amount)} FCFA</td>
                          <td className="px-4 py-3 text-center">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeExpense(e.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Right Sidebar - AI Assistant */}
        <div className="space-y-6">
          
          {/* AI Financial Advisor - Hero Card */}
          <Card className="relative overflow-hidden border-none shadow-xl bg-gradient-to-b from-[#0B1527] to-[#122340] text-white p-1">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
            <div className="bg-[#122340]/50 backdrop-blur-md rounded-[14px] p-6 h-full border border-white/10 relative z-10 flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-cyan-400 to-[#0E7C66] p-[2px] shadow-[0_0_15px_rgba(14,124,102,0.5)]">
                  <div className="bg-[#0B1527] h-full w-full rounded-[10px] flex items-center justify-center">
                    <BrainCircuit className="h-6 w-6 text-cyan-400" />
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">Expert Comptable IA</h3>
                  <p className="text-xs text-cyan-200/70 font-medium">Analyse des marges & acquisition</p>
                </div>
              </div>

              <div className="text-sm text-slate-300 mb-6 flex-1">
                L'Expert IA analyse votre CAC, votre ROAS et vos charges de structure pour vous dicter où investir pour optimiser vos bénéfices.
              </div>

              {aiAdvice ? (
                <div className="bg-slate-900/80 rounded-xl p-4 text-sm text-slate-200 border border-slate-700/50 shadow-inner mb-6 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar">
                  {aiAdvice}
                </div>
              ) : (
                <div className="bg-[#0B1527]/50 rounded-xl p-4 text-sm text-slate-400 border border-dashed border-slate-600/50 mb-6 flex flex-col items-center justify-center text-center">
                  <span className="font-bold text-slate-300">Aucun audit récent</span>
                  <span className="text-xs mt-1">Prêt à scanner vos {stats.ordersCount} transactions.</span>
                </div>
              )}

              <Button 
                onClick={askAI} 
                disabled={aiLoading}
                className="w-full bg-gradient-to-r from-cyan-500 to-[#0E7C66] hover:from-cyan-400 hover:to-[#0E7C66] text-white shadow-[0_4px_14px_0_rgba(14,124,102,0.39)] border-none font-bold"
              >
                {aiLoading ? (
                  <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Calculs en cours...</>
                ) : (
                  <><Sparkles className="h-5 w-5 mr-2" /> Générer mon Bilan Expert</>
                )}
              </Button>
            </div>
          </Card>

          {/* Dépenses breakdown */}
          <Card className="p-6 border-slate-100 shadow-sm bg-white">
            <h3 className="font-bold text-slate-900 mb-4 text-sm">Répartition des Sorties</h3>
            <div className="space-y-4">
              {CATEGORIES.map(cat => {
                const val = stats.expByCat[cat.value] || 0;
                const pct = stats.totalExpenses > 0 ? (val / stats.totalExpenses) * 100 : 0;
                const Icon = cat.icon;
                if (val === 0 && pct === 0) return null; // Hide empty categories for cleaner look
                return (
                  <div key={cat.value}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                        <span className={`h-6 w-6 rounded-md inline-flex items-center justify-center ${cat.color}`}><Icon className="h-3 w-3" /></span>
                        {cat.label}
                      </span>
                      <span className="font-bold text-slate-900">{fmt(val)} FCFA</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-slate-800 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {stats.platformFees > 0 && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                      <span className="h-6 w-6 rounded-md inline-flex items-center justify-center text-teal-700 bg-teal-100"><CreditCard className="h-3 w-3" /></span>
                      Frais Ecomfy
                    </span>
                    <span className="font-bold text-slate-900">{fmt(stats.platformFees)} FCFA</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-slate-800 transition-all" style={{ width: `${(stats.platformFees / stats.totalExpenses) * 100}%` }} />
                  </div>
                </div>
              )}
              {stats.totalExpenses === 0 && (
                 <div className="text-center text-xs text-slate-400 py-4">Aucune dépense enregistrée</div>
              )}
            </div>
          </Card>

        </div>
      </div>

      {/* --- MODALS FOR CONFIGURATION --- */}

      {/* Dialog: Comptes Publicitaires */}
      <Dialog open={adsOpen} onOpenChange={setAdsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle className="text-xl">Connexions Publicitaires</DialogTitle></DialogHeader>
          <div className="pt-4">
            <AdAccountsManager shopId={shopId} userId={shop?.user_id} onTotalsChanged={reloadAll} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Rapports & Alertes */}
      <Dialog open={reportsOpen} onOpenChange={setReportsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle className="text-xl">Alertes & Rapports</DialogTitle></DialogHeader>
          <div className="space-y-6 pt-4">
             <Button variant="outline" onClick={sendWhatsAppSummary} className="w-full justify-between hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-colors h-12">
                <span className="flex items-center gap-3"><MessageCircle className="h-5 w-5" /> Partager bilan par WhatsApp</span>
                <ArrowRight className="h-4 w-4 opacity-50" />
              </Button>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-slate-700" />
                    <span className="text-sm font-bold text-slate-900">Rapport auto (Lundi 8h)</span>
                  </div>
                  <Switch checked={autoEmail} disabled={savingAuto} onCheckedChange={(v) => saveAutoEmail(v, emailRecipient)} />
                </div>
                {autoEmail && (
                  <div className="flex flex-col gap-3">
                    <Label className="text-xs text-slate-500">Adresse de réception (vide : e-mail de votre compte)</Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="email" 
                        placeholder="Ex: contact@maboutique.com" 
                        className="h-10 text-sm"
                        value={emailRecipient}
                        onChange={e => setEmailRecipient(e.target.value)}
                        onBlur={saveRecipientOnBlur}
                      />
                      <Button size="icon" className="h-10 w-10 shrink-0 bg-slate-900" onClick={sendNow} disabled={sendingNow} title="Tester l'envoi">
                        {sendingNow ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Adding Expense */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle className="text-xl">Enregistrer une Dépense</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid gap-2">
              <Label>Catégorie</Label>
              <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value} className="py-2.5">
                    <div className="flex items-center gap-2"><c.icon className="h-4 w-4 opacity-70"/> {c.label}</div>
                  </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Montant (FCFA)</Label>
              <Input type="number" min="0" step="1" className="h-11 font-bold text-lg" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="ex: 15000" />
            </div>
            <div className="grid gap-2">
              <Label>Date</Label>
              <Input type="date" className="h-11" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Description (optionnel)</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="ex: Facture fournisseur, Achat cartons..." rows={2} className="resize-none" />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setAddOpen(false)}>Annuler</Button>
              <Button onClick={addExpense} disabled={saving} className="bg-slate-900 text-white px-8">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}