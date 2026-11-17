import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { AlertCircle, Briefcase, CheckCircle2, Loader2, Megaphone, User } from "lucide-react";
import {
  MetaAdsService, type MetaAdAccountChoice, type MetaBusiness,
} from "@/services/metaAdsService";

const PERSONAL = "__personal__";

/** Attend la restauration de la session (jusqu'à ~6 s), en tentant un rafraîchissement si un jeton est stocké. */
async function waitForSession(): Promise<boolean> {
  for (let i = 0; i < 12; i++) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return true;
    if (i === 3) {
      const { data: refreshed } = await supabase.auth.refreshSession().catch(() => ({ data: { session: null } }));
      if (refreshed.session) return true;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

type Phase = "exchanging" | "choose" | "saving" | "error";

/** Retour de Meta après l'autorisation : ?code=...&state=... (le code n'est utilisable qu'une fois). */
export default function MetaAdsCallback() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const handled = useRef(false);

  const [phase, setPhase] = useState<Phase>("exchanging");
  const [errorMessage, setErrorMessage] = useState("");
  const [shopId, setShopId] = useState("");
  const [userName, setUserName] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<MetaBusiness[]>([]);
  const [canListBusinesses, setCanListBusinesses] = useState(true);
  const [scope, setScope] = useState<string>(PERSONAL);
  const [accounts, setAccounts] = useState<MetaAdAccountChoice[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const backToShop = (id = shopId) => navigate(id ? `/shop-editor/${id}` : "/dashboard", { replace: true });

  const loadAccounts = async (id: string, value: string) => {
    setScope(value);
    setLoadingAccounts(true);
    setSelected(new Set());
    try {
      setAccounts(await MetaAdsService.listAccounts(id, value === PERSONAL ? null : value));
    } catch (e) {
      setAccounts([]);
      toast({ title: "Comptes introuvables", description: e instanceof Error ? e.message : "Réessayez.", variant: "destructive" });
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const code = params.get("code");
    const state = params.get("state");
    if (params.get("error") || !code || !state) {
      setErrorMessage("Autorisation Meta refusée ou annulée.");
      setPhase("error");
      return;
    }
    (async () => {
      try {
        // Cette page n'est pas sous ProtectedRoute : au rechargement complet (retour de Meta), une session pas encore
        // restaurée y renverrait vers /auth puis /dashboard et le code d'autorisation serait perdu.
        if (!(await waitForSession())) {
          setErrorMessage("Votre session a expiré. Reconnectez-vous à Ecomfy, puis relancez la connexion Meta.");
          setPhase("error");
          return;
        }
        const res = await MetaAdsService.exchangeCode(code, state);
        setShopId(res.shopId);
        setUserName(res.metaUserName);
        setBusinesses(res.businesses);
        setCanListBusinesses(res.canListBusinesses);
        setPhase("choose");
        // Premier Business Manager d'office ; sinon comptes personnels.
        await loadAccounts(res.shopId, res.businesses[0]?.id ?? PERSONAL);
      } catch (e) {
        setErrorMessage(e instanceof Error ? e.message : "Connexion Meta impossible.");
        setPhase("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (accountId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId); else next.add(accountId);
      return next;
    });

  const connect = async () => {
    if (selected.size === 0) return;
    setPhase("saving");
    try {
      const chosen = accounts
        .filter((a) => selected.has(a.account_id))
        .map((a) => ({ account_id: a.account_id, business_id: scope === PERSONAL ? null : scope }));
      const res = await MetaAdsService.connectAccounts(shopId, chosen);
      // Première synchronisation immédiate de chaque compte relié.
      const errors: string[] = res.failed.map((f) => `${f.account_id} : ${f.error}`);
      for (const c of res.connected) {
        const err = await MetaAdsService.syncAccount(c.id);
        if (err) errors.push(`${c.account_id} : ${err}`);
      }
      toast({
        title: `${res.connected.length} compte(s) connecté(s)`,
        description: errors.length ? errors.join(" · ") : "Les dépenses publicitaires sont synchronisées.",
        variant: errors.length ? "destructive" : "default",
      });
      backToShop();
    } catch (e) {
      toast({ title: "Connexion impossible", description: e instanceof Error ? e.message : "Réessayez.", variant: "destructive" });
      setPhase("choose");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg p-6 space-y-4">
        <h1 className="font-bold text-lg flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-pink-600" /> Connect Ads — Meta
        </h1>

        {phase === "exchanging" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Validation de l'autorisation Meta…
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 text-sm text-red-600"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {errorMessage}</div>
            <Button variant="outline" onClick={() => backToShop()} className="w-full">Retour à ma boutique</Button>
          </div>
        )}

        {(phase === "choose" || phase === "saving") && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 inline mr-1" />
              Connecté{userName ? <> en tant que <b>{userName}</b></> : null}. Choisissez le Business Manager puis les comptes publicitaires à suivre.
              Ecomfy ne lit que les dépenses (lecture seule) et ne peut rien modifier dans vos campagnes.
            </p>

            <div className="flex flex-wrap gap-2">
              {businesses.map((b) => (
                <Button key={b.id} size="sm" variant={scope === b.id ? "default" : "outline"} disabled={phase === "saving"} onClick={() => loadAccounts(shopId, b.id)}>
                  <Briefcase className="h-3.5 w-3.5 mr-1" /> {b.name}
                </Button>
              ))}
              <Button size="sm" variant={scope === PERSONAL ? "default" : "outline"} disabled={phase === "saving"} onClick={() => loadAccounts(shopId, PERSONAL)}>
                <User className="h-3.5 w-3.5 mr-1" /> Comptes personnels
              </Button>
            </div>
            {!canListBusinesses && (
              <p className="text-xs text-amber-600">
                La permission « Business Manager » n'a pas été accordée : seuls vos comptes personnels sont listés. Reconnectez-vous en l'acceptant pour voir vos Business Managers.
              </p>
            )}

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {loadingAccounts ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : accounts.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">Aucun compte publicitaire ici.</div>
              ) : (
                accounts.map((a) => (
                  <label key={a.account_id} className="flex items-center gap-3 p-3 rounded-lg border bg-card cursor-pointer">
                    <Checkbox checked={selected.has(a.account_id)} onCheckedChange={() => toggle(a.account_id)} disabled={phase === "saving"} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{a.name}</div>
                      <div className="text-xs text-muted-foreground">ID : {a.account_id}{a.currency ? ` · ${a.currency}` : ""}</div>
                    </div>
                    {a.status !== null && a.status !== 1 && <Badge variant="outline" className="text-[10px]">Inactif</Badge>}
                  </label>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => backToShop()} disabled={phase === "saving"}>Annuler</Button>
              <Button className="flex-1" onClick={connect} disabled={selected.size === 0 || phase === "saving"}>
                {phase === "saving"
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Connexion + synchronisation…</>
                  : `Connecter ${selected.size || ""} compte${selected.size > 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
