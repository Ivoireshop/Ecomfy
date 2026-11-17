import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { MetaAdsService, type MetaConnectionStatus } from "@/services/metaAdsService";
import { Loader2, Plus, RefreshCw, Trash2, Megaphone, CheckCircle2, AlertCircle, Clock, Briefcase, ShieldCheck, Unplug } from "lucide-react";

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
  token_expires_at: string | null;
  business_name: string | null;
  connection_method: "manual" | "oauth" | null;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(Number(n) || 0));

interface Props {
  shopId: string;
  userId?: string;
  onTotalsChanged?: () => void;
}

export function AdAccountsManager({ shopId, onTotalsChanged }: Props) {
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [connection, setConnection] = useState<MetaConnectionStatus | null>(null);

  const load = async () => {
    // Le jeton n'est jamais sélectionné : la colonne access_token n'est plus lisible depuis le navigateur.
    const { data } = await (supabase as any)
      .from("ad_accounts")
      .select("id, provider, account_id, account_label, currency, total_spend, last_synced_at, last_sync_status, last_sync_error, token_expires_at, business_name, connection_method")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });
    setAccounts((data as AdAccount[]) || []);
    setLoading(false);
  };

  const loadConnection = async () => {
    try { setConnection(await MetaAdsService.status(shopId)); } catch { setConnection(null); }
  };

  useEffect(() => { load(); loadConnection(); }, [shopId]);

  // Avertir l'utilisateur si une connexion est sur le point d'expirer
  useEffect(() => {
    if (loading || accounts.length === 0) return;
    const now = Date.now();
    const expiring = accounts.filter(a => a.token_expires_at && new Date(a.token_expires_at).getTime() - now < 7 * 86400000);
    if (expiring.length > 0) {
      const days = Math.ceil((new Date(expiring[0].token_expires_at!).getTime() - now) / 86400000);
      toast({
        title: days <= 0 ? "Connexion Meta expirée" : `Connexion Meta : expire dans ${days} jour${days > 1 ? "s" : ""}`,
        description: "Reconnectez votre compte Meta pour continuer la synchronisation des dépenses publicitaires.",
        variant: "destructive",
      });
    }
  }, [loading, accounts]);

  const startConnection = async () => {
    setConnecting(true);
    try {
      await MetaAdsService.startConnection(shopId); // redirige vers Meta
    } catch (e) {
      setConnecting(false);
      toast({ title: "Connexion Meta impossible", description: e instanceof Error ? e.message : "Réessayez.", variant: "destructive" });
    }
  };

  const sync = async (id: string) => {
    setSyncingId(id);
    const err = await MetaAdsService.syncAccount(id);
    setSyncingId(null);
    if (err) toast({ title: "Synchronisation échouée", description: err, variant: "destructive" });
    else toast({ title: "Synchronisé" });
    load();
    onTotalsChanged?.();
  };

  const remove = async (id: string) => {
    if (!confirm("Déconnecter ce compte publicitaire ? L'historique des dépenses synchronisées sera supprimé.")) return;
    const { error } = await (supabase as any).from("ad_accounts").delete().eq("id", id);
    if (error) { toast({ title: "Déconnexion impossible", description: error.message, variant: "destructive" }); return; }
    load();
    onTotalsChanged?.();
  };

  const disconnectMeta = async () => {
    if (!confirm("Révoquer l'accès d'Ecomfy à votre compte Meta ? Les comptes déjà synchronisés gardent leur historique mais ne se mettront plus à jour.")) return;
    try {
      await MetaAdsService.disconnect(shopId);
      toast({ title: "Accès Meta révoqué" });
      loadConnection();
      load();
    } catch (e) {
      toast({ title: "Révocation impossible", description: e instanceof Error ? e.message : "Réessayez.", variant: "destructive" });
    }
  };

  const hasLegacy = accounts.some(a => a.connection_method !== "oauth");

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-bold flex items-center gap-2"><Megaphone className="h-4 w-4 text-pink-600" /> Comptes publicitaires connectés</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Connectez votre Business Manager Meta (Facebook / Instagram) pour synchroniser vos dépenses publicitaires.
          </p>
        </div>
        <Button onClick={startConnection} size="sm" disabled={connecting}>
          {connecting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          {connection?.connected ? "Ajouter des comptes" : "Se connecter avec Facebook"}
        </Button>
      </div>

      <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-slate-50 border rounded-lg p-2.5 mb-4">
        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
        <span>
          Connexion sécurisée par Meta : vous ne saisissez aucun mot de passe ni jeton. Ecomfy a un accès en <b>lecture seule</b> aux dépenses
          et ne peut modifier ni vos campagnes ni votre budget. Vous pouvez révoquer l'accès à tout moment.
        </span>
      </div>

      {connection?.connected && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-3">
          <span className="text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Meta autorisé{connection.metaUserName ? ` par ${connection.metaUserName}` : ""}
            {connection.expiresAt ? ` · valable jusqu'au ${new Date(connection.expiresAt).toLocaleDateString("fr-FR")}` : ""}
          </span>
          <Button size="sm" variant="ghost" className="h-7 text-red-600" onClick={disconnectMeta}>
            <Unplug className="h-3.5 w-3.5 mr-1" /> Révoquer l'accès
          </Button>
        </div>
      )}
      {connection?.expired && (
        <p className="text-xs text-red-600 mb-3 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> La connexion Meta a expiré : reconnectez-vous.</p>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">
          Aucun compte connecté. Cliquez sur « Se connecter avec Facebook » pour choisir votre Business Manager et vos comptes publicitaires.
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map(acc => (
            <div key={acc.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="uppercase text-[10px]">{acc.provider}</Badge>
                  <span className="text-sm font-medium truncate">{acc.account_label || `act_${acc.account_id.replace(/^act_/i, "")}`}</span>
                  {acc.business_name && <Badge variant="secondary" className="text-[10px] gap-1"><Briefcase className="h-3 w-3" />{acc.business_name}</Badge>}
                  {acc.connection_method !== "oauth" && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">Jeton manuel</Badge>}
                  {acc.token_expires_at && (() => {
                    const days = Math.ceil((new Date(acc.token_expires_at).getTime() - Date.now()) / 86400000);
                    if (days > 7) return null;
                    return (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <Clock className="h-3 w-3" />
                        {days <= 0 ? "Connexion expirée" : `Expire dans ${days}j`}
                      </Badge>
                    );
                  })()}
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
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

      {hasLegacy && (
        <p className="text-[11px] text-amber-700 mt-3">
          Certains comptes utilisent un jeton saisi à la main. Reconnectez-les avec Facebook : le jeton manuel sera remplacé par une connexion sécurisée.
        </p>
      )}
    </Card>
  );
}
