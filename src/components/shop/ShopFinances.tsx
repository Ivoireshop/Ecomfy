import { useEffect, useMemo, useState } from "react";
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
import { Loader2, Plus, Trash2, TrendingUp, TrendingDown, Wallet, Megaphone, Package, Truck, Users, Sparkles, MessageCircle, Mail, Send } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { AdAccountsManager } from "@/components/shop/AdAccountsManager";

interface Order { id: string; total: number; order_status: string; payment_status: string; created_at: string; }
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
  const [adSpend, setAdSpend] = useState<{ spend_date: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"week" | "month" | "all">("month");
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ category: "ads", amount: "", description: "", expense_date: new Date().toISOString().slice(0, 10) });
  const [aiAdvice, setAiAdvice] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [autoEmail, setAutoEmail] = useState<boolean>(!!shop?.weekly_finance_email_enabled);
  const [emailRecipient, setEmailRecipient] = useState<string>(shop?.weekly_finance_email || "");
  const [savingAuto, setSavingAuto] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);

  const reloadAll = async () => {
    const [exp, pay, ads] = await Promise.all([
      supabase.from("shop_expenses" as any).select("*").eq("shop_id", shopId).order("expense_date", { ascending: false }),
      supabase.from("commission_payments").select("*").eq("shop_id", shopId).eq("status", "paid"),
      (supabase as any).from("ad_spend_daily").select("spend_date, amount").eq("shop_id", shopId),
    ]);
    setExpenses(((exp.data as any[]) || []) as Expense[]);
    setPayments((pay.data as any[]) || []);
    setAdSpend(((ads.data as any[]) || []).map((r: any) => ({ spend_date: r.spend_date, amount: Number(r.amount || 0) })));
    setLoading(false);
  };
  useEffect(() => { reloadAll(); }, [shopId]);

  const filtered = useMemo(() => {
    const now = new Date();
    let from: Date | null = null;
    if (period === "week") { from = new Date(now); from.setDate(now.getDate() - 7); }
    if (period === "month") { from = new Date(now.getFullYear(), now.getMonth(), 1); }
    const inRange = (d: string) => !from || new Date(d).getTime() >= from.getTime();
    return {
      orders: orders.filter(o => inRange(o.created_at)),
      expenses: expenses.filter(e => inRange(e.expense_date)),
      platformPayments: payments.filter(p => inRange(p.created_at)),
      adSpend: adSpend.filter(a => inRange(a.spend_date)),
    };
  }, [orders, expenses, payments, adSpend, period]);

  const stats = useMemo(() => {
    const confirmed = filtered.orders.filter(o => ["confirmed","processing","shipped","delivered"].includes(o.order_status));
    const delivered = filtered.orders.filter(o => o.order_status === "delivered");
    const cashIn = delivered.reduce((s, o) => s + Number(o.total || 0), 0);
    const revenue = confirmed.reduce((s, o) => s + Number(o.total || 0), 0);
    const expByCat: Record<string, number> = {};
    filtered.expenses.forEach(e => { expByCat[e.category] = (expByCat[e.category] || 0) + Number(e.amount); });
    const adSpendTotal = filtered.adSpend.reduce((s, a) => s + Number(a.amount || 0), 0);
    if (adSpendTotal > 0) {
      expByCat["ads"] = (expByCat["ads"] || 0) + adSpendTotal;
    }
    const manualExpenses = filtered.expenses.reduce((s, e) => s + Number(e.amount), 0);
    const totalExpenses = manualExpenses + adSpendTotal;
    const platformFees = filtered.platformPayments.reduce((s, p) => s + Number(p.amount), 0);
    const commissionDue = Number(shop?.commission_balance_due) || 0;
    const profit = cashIn - totalExpenses - platformFees;
    return {
      ordersCount: filtered.orders.length,
      confirmedCount: confirmed.length,
      deliveredCount: delivered.length,
      revenue, cashIn, totalExpenses, platformFees, commissionDue, profit, expByCat, adSpendTotal,
    };
  }, [filtered, shop]);

  const addExpense = async () => {
    if (!form.amount || Number(form.amount) <= 0) { toast({ title: "Montant invalide", variant: "destructive" }); return; }
    setSaving(true);
    const { data, error } = await supabase.from("shop_expenses" as any).insert({
      shop_id: shopId,
      category: form.category,
      amount: Number(form.amount),
      description: form.description || null,
      expense_date: form.expense_date,
    }).select().single();
    setSaving(false);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    setExpenses(prev => [data as any, ...prev]);
    setAddOpen(false);
    setForm({ category: "ads", amount: "", description: "", expense_date: new Date().toISOString().slice(0, 10) });
    toast({ title: "Dépense enregistrée" });
  };

  const removeExpense = async (id: string) => {
    if (!confirm("Supprimer cette dépense ?")) return;
    const { error } = await supabase.from("shop_expenses" as any).delete().eq("id", id);
    if (error) { toast({ title: "Erreur", variant: "destructive" }); return; }
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const askAI = async () => {
    setAiLoading(true);
    setAiAdvice("");
    const { data, error } = await supabase.functions.invoke("finance-advisor", {
      body: { stats: { ...stats, period, shopName: shop?.business_name } },
    });
    setAiLoading(false);
    if (error || !data?.success) {
      toast({ title: "L'IA n'a pas pu répondre", description: data?.error || error?.message, variant: "destructive" });
      return;
    }
    setAiAdvice(data.advice);
  };

  const sendWhatsAppSummary = () => {
    const phone = (shop?.whatsapp_number || shop?.phone_number || "").replace(/\D/g, "");
    if (!phone) { toast({ title: "Aucun numéro WhatsApp configuré dans les paramètres", variant: "destructive" }); return; }
    const periodLabel = period === "week" ? "7 derniers jours" : period === "month" ? "ce mois" : "depuis l'ouverture";
    const lines = [
      `📊 *Résumé financier — ${shop?.business_name || "Boutique"}*`,
      `_Période : ${periodLabel}_`,
      ``,
      `🛒 Commandes : ${stats.ordersCount} (${stats.deliveredCount} livrées)`,
      `💰 Chiffre d'affaires confirmé : ${fmt(stats.revenue)} FCFA`,
      `✅ Encaissé (livré) : ${fmt(stats.cashIn)} FCFA`,
      ``,
      `💸 Dépenses totales : ${fmt(stats.totalExpenses)} FCFA`,
      ...Object.entries(stats.expByCat).map(([cat, val]) => `   • ${CATEGORIES.find(c => c.value === cat)?.label || cat} : ${fmt(val)} FCFA`),
      `🏦 Frais plateforme payés : ${fmt(stats.platformFees)} FCFA`,
      `⏳ Commission due VisualPro : ${fmt(stats.commissionDue)} FCFA`,
      ``,
      `${stats.profit >= 0 ? "📈" : "📉"} *Bénéfice net estimé : ${fmt(stats.profit)} FCFA*`,
      ``,
      `— VisualPro Cloud`,
    ];
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank");
  };

  const saveAutoEmail = async (enabled: boolean, recipient?: string) => {
    setSavingAuto(true);
    const payload: any = { weekly_finance_email_enabled: enabled };
    if (recipient !== undefined) payload.weekly_finance_email = recipient || null;
    const { error } = await supabase.from("shops").update(payload).eq("id", shopId);
    setSavingAuto(false);
    if (error) { toast({ title: "Erreur", description: error.message, variant: "destructive" }); return; }
    setAutoEmail(enabled);
    toast({ title: enabled ? "Envoi automatique activé" : "Envoi automatique désactivé", description: enabled ? "Vous recevrez un résumé chaque lundi à 8h." : undefined });
  };

  const sendNow = async () => {
    setSendingNow(true);
    const { data, error } = await supabase.functions.invoke("send-weekly-finance-summary", { body: { shop_id: shopId } });
    setSendingNow(false);
    if (error || !data?.success) { toast({ title: "Échec de l'envoi", description: data?.errors?.[0] || error?.message, variant: "destructive" }); return; }
    toast({ title: "Email envoyé", description: `Vérifiez votre boîte (${data.sent} envoi).` });
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Gestion financière</h2>
          <p className="text-sm text-muted-foreground">Pilotez votre boutique comme un pro, sans être comptable.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">7 derniers jours</SelectItem>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="all">Depuis l'ouverture</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Dépense</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><TrendingUp className="h-3.5 w-3.5" /> Encaissé</div>
          <p className="text-2xl font-bold text-emerald-700">{fmt(stats.cashIn)}</p>
          <p className="text-[10px] text-muted-foreground">FCFA — {stats.deliveredCount} livrées</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><Wallet className="h-3.5 w-3.5" /> CA confirmé</div>
          <p className="text-2xl font-bold text-blue-700">{fmt(stats.revenue)}</p>
          <p className="text-[10px] text-muted-foreground">FCFA — {stats.confirmedCount} commandes</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-pink-500/10 to-pink-500/5 border-pink-500/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><TrendingDown className="h-3.5 w-3.5" /> Dépenses</div>
          <p className="text-2xl font-bold text-pink-700">{fmt(stats.totalExpenses)}</p>
          <p className="text-[10px] text-muted-foreground">FCFA — {filtered.expenses.length} entrées</p>
        </Card>
        <Card className={`p-4 border-2 ${stats.profit >= 0 ? "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30" : "bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/30"}`}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">{stats.profit >= 0 ? "📈" : "📉"} Bénéfice net</div>
          <p className={`text-2xl font-bold ${stats.profit >= 0 ? "text-primary" : "text-red-700"}`}>{fmt(stats.profit)}</p>
          <p className="text-[10px] text-muted-foreground">FCFA après dépenses</p>
        </Card>
      </div>

      {/* Plateforme + breakdown */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-bold mb-3 flex items-center gap-2">🏦 Frais plateforme VisualPro</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Activation boutique payée</span><Badge variant={shop?.activation_fee_paid ? "default" : "secondary"}>{shop?.activation_fee_paid ? "Oui" : "Non"}</Badge></div>
            <div className="flex justify-between"><span>Frais déjà payés</span><span className="font-semibold">{fmt(stats.platformFees)} FCFA</span></div>
            <div className="flex justify-between"><span>Commission due</span><span className="font-semibold text-orange-600">{fmt(stats.commissionDue)} FCFA</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Seuil de paiement</span><span>{fmt(Number(shop?.commission_threshold) || 12000)} FCFA</span></div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold mb-3">Dépenses par catégorie</h3>
          <div className="space-y-2.5">
            {CATEGORIES.map(cat => {
              const val = stats.expByCat[cat.value] || 0;
              const pct = stats.totalExpenses > 0 ? (val / stats.totalExpenses) * 100 : 0;
              const Icon = cat.icon;
              return (
                <div key={cat.value}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5"><span className={`h-5 w-5 rounded inline-flex items-center justify-center ${cat.color}`}><Icon className="h-3 w-3" /></span>{cat.label}</span>
                    <span className="font-semibold">{fmt(val)} FCFA</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {stats.totalExpenses === 0 && <p className="text-xs text-muted-foreground text-center py-4">Aucune dépense enregistrée pour cette période.</p>}
          </div>
        </Card>
      </div>

      {/* AI + WhatsApp actions */}
      <Card className="p-5 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="font-bold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Assistant comptable IA</h3>
            <p className="text-xs text-muted-foreground">Conseils personnalisés selon vos chiffres actuels.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={sendWhatsAppSummary}><MessageCircle className="h-4 w-4 mr-1" /> Résumé WhatsApp</Button>
            <Button onClick={askAI} disabled={aiLoading}>{aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />} Analyser</Button>
          </div>
        </div>
        {aiAdvice && (
          <div className="bg-background rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed border">{aiAdvice}</div>
        )}
      </Card>

      {/* Weekly auto email */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-bold flex items-center gap-2"><Mail className="h-4 w-4" /> Résumé hebdomadaire par email</h3>
            <p className="text-xs text-muted-foreground">Envoi automatique chaque <b>lundi à 8h00</b> avec le bilan des 7 derniers jours.</p>
          </div>
          <Switch checked={autoEmail} disabled={savingAuto} onCheckedChange={(v) => saveAutoEmail(v, emailRecipient)} />
        </div>
        <div className="grid sm:grid-cols-[1fr_auto] gap-2 items-end">
          <div>
            <Label className="text-xs">Email de réception</Label>
            <Input
              type="email"
              placeholder="vide = email du compte"
              value={emailRecipient}
              onChange={e => setEmailRecipient(e.target.value)}
              onBlur={() => autoEmail && saveAutoEmail(true, emailRecipient)}
            />
          </div>
          <Button variant="outline" onClick={sendNow} disabled={sendingNow}>
            {sendingNow ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            Envoyer un test
          </Button>
        </div>
        {autoEmail && <p className="text-[11px] text-emerald-600 mt-2">✓ Activé — prochain envoi automatique lundi à 8h00.</p>}
      </Card>

      {/* Expenses list */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold">Historique des dépenses</h3>
          <span className="text-xs text-muted-foreground">{filtered.expenses.length} entrée(s)</span>
        </div>
        {filtered.expenses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune dépense pour cette période. Cliquez sur « Dépense » pour en ajouter une.</p>
        ) : (
          <div className="space-y-2">
            {filtered.expenses.map(e => {
              const cat = CATEGORIES.find(c => c.value === e.category);
              const Icon = cat?.icon || Wallet;
              return (
                <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`h-9 w-9 rounded-lg inline-flex items-center justify-center ${cat?.color}`}><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{e.description || cat?.label || "Dépense"}</p>
                      <p className="text-[11px] text-muted-foreground">{cat?.label} • {new Date(e.expense_date).toLocaleDateString("fr-FR")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{fmt(e.amount)} FCFA</span>
                    <Button variant="ghost" size="icon" onClick={() => removeExpense(e.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Add expense dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajouter une dépense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Catégorie</Label>
              <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Montant (FCFA)</Label>
              <Input type="number" min="0" step="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="ex: 15000" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
            </div>
            <div>
              <Label>Description (optionnel)</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="ex: Pub Facebook campagne robe rouge" rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
              <Button onClick={addExpense} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Enregistrer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}