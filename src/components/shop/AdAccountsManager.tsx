import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, RefreshCw, Trash2, Megaphone, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";

interface AdAccount {
  id: string;
  provider: string;
  account_id: string;
  account_label: string | null;
  currency: string | null;
  total_spend: number | null;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));

interface Props {
  shopId: string;
  userId: string;
  onTotalsChanged?: () => void;
}

export function AdAccountsManager({ shopId, userId, onTotalsChanged }: Props) {
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [form, setForm] = useState({ provider: "meta", account_id: "", access_token: "", account_label: "" });

  const load = async () => {
    const { data } = await (supabase as any)
      .from("ad_accounts")
      .select("id, provider, account_id, account_label, currency, total_spend, last_synced_at, last_sync_status, last_sync_error")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });
    setAccounts((data as AdAccount[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [shopId]);

  const add = async () => {
    if (!form.account_id.trim() || !form.access_token.trim()) {
      toast({ title: "ID du compte et token requis", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data, error } = await (supabase as any).from("ad_accounts").insert({
      shop_id: shopId,
      user_id: userId,
      provider: form.provider,
      account_id: form.account_id.trim(),
      access_token: form.access_token.trim(),
      account_label: form.account_label.trim() || null,
    }).select().single();
    if (error) {
      setSaving(false);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    // Sync immédiat
    await sync(data.id, true);
    setSaving(false);
    setOpen(false);
    setForm({ provider: "meta", account_id: "", access_token: "", account_label: "" });
    load();
    onTotalsChanged?.();
  };

  const sync = async (id: string, silent = false) => {
    setSyncingId(id);
    const { data, error } = await supabase.functions.invoke("sync-ad-spend", { body: { ad_account_id: id } });
    setSyncingId(null);
    if (error || !data?.success) {
      toast({ title: "Synchronisation échouée", description: data?.error || error?.message || "Vérifiez l'ID et le token", variant: "destructive" });
      load();
      return;
    }
    if (!silent) {
      toast({ title: "Synchronisé", description: `${data.days} jour(s), ${fmt(data.total)} ${data.currency}` });
    }
    load();
    onTotalsChanged?.();
  };

  const remove = async (id: string) => {
    if (!confirm("Déconnecter ce compte publicitaire ? L'historique des dépenses synchronisées sera supprimé.")) return;
    const { error } = await (supabase as any).from("ad_accounts").delete().eq("id", id);
    if (error) { toast({ title: "Erreur", variant: "destructive" }); return; }
    load();
    onTotalsChanged?.();
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold flex items-center gap-2"><Megaphone className="h-4 w-4 text-pink-600" /> Comptes publicitaires connectés</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Synchronisez automatiquement vos dépenses Meta Ads (Facebook/Instagram). Mise à jour à chaque clic sur « Actualiser ».
          </p>
        </div>
        <Button onClick={() => setOpen(true)} size="sm"><Plus className="h-4 w-4 mr-1" /> Connecter</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">
          Aucun compte connecté. Cliquez sur « Connecter » pour ajouter votre compte publicitaire Meta.
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map(acc => (
            <div key={acc.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="uppercase text-[10px]">{acc.provider}</Badge>
                  <span className="text-sm font-medium truncate">{acc.account_label || `act_${acc.account_id}`}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>ID: {acc.account_id}</span>
                  {acc.last_sync_status === "success" && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> {acc.last_synced_at ? new Date(acc.last_synced_at).toLocaleString("fr-FR") : ""}</span>}
                  {acc.last_sync_status === "error" && <span className="flex items-center gap-1 text-red-600" title={acc.last_sync_error || ""}><AlertCircle className="h-3 w-3" /> Erreur</span>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-pink-700">{fmt(Number(acc.total_spend || 0))} {acc.currency || "XOF"}</p>
                <p className="text-[10px] text-muted-foreground">dépense totale</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="outline" onClick={() => sync(acc.id)} disabled={syncingId === acc.id} title="Actualiser">
                  {syncingId === acc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(acc.id)} title="Déconnecter">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Connecter un compte publicitaire</DialogTitle>
            <DialogDescription>
              Les dépenses seront ajoutées automatiquement à la catégorie « Publicité » de votre finance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Plateforme</Label>
              <Select value={form.provider} onValueChange={(v) => setForm(f => ({ ...f, provider: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="meta">Meta (Facebook / Instagram)</SelectItem>
                  <SelectItem value="tiktok" disabled>TikTok (bientôt)</SelectItem>
                  <SelectItem value="google" disabled>Google Ads (bientôt)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ID du compte publicitaire</Label>
              <Input
                placeholder="ex: 1234567890 (sans le préfixe act_)"
                value={form.account_id}
                onChange={(e) => setForm(f => ({ ...f, account_id: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Trouvé dans <b>Business Manager → Paramètres → Comptes publicitaires</b>.
              </p>
            </div>
            <div>
              <Label>Token d'accès (Access Token)</Label>
              <Input
                type="password"
                placeholder="Long-lived access token Meta"
                value={form.access_token}
                onChange={(e) => setForm(f => ({ ...f, access_token: e.target.value }))}
              />
              <a
                href="https://developers.facebook.com/tools/explorer/"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-primary inline-flex items-center gap-1 mt-1 hover:underline"
              >
                Générer un token <ExternalLink className="h-3 w-3" />
              </a>
              <p className="text-[11px] text-muted-foreground mt-1">
                Permission requise : <code>ads_read</code>. Le token est stocké chiffré et n'est jamais affiché à nouveau.
              </p>
            </div>
            <div>
              <Label>Libellé (optionnel)</Label>
              <Input
                placeholder="ex: Compte principal"
                value={form.account_label}
                onChange={(e) => setForm(f => ({ ...f, account_label: e.target.value }))}
              />
            </div>
            <Button onClick={add} disabled={saving} className="w-full">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Connexion + synchronisation…</> : "Connecter et synchroniser"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}