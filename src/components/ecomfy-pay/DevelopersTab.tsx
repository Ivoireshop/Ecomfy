import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Code2, Copy, FlaskConical, KeyRound, Loader2, RefreshCw, Trash2, Webhook, ExternalLink, ShieldAlert, Zap } from "lucide-react";
import {
  API_BASE_URL, payDevApi, WEBHOOK_EVENTS,
  type ApiKeyRow, type DeliveryRow, type SandboxPaymentRow, type WebhookEndpointRow,
} from "@/lib/ecomfyPayDevApi";

interface DevelopersTabProps {
  shopId?: string;
  /** KYC validé : condition pour créer une clé de production. */
  kycVerified: boolean;
  formatPrice: (amount: number) => string;
}

const dateFr = (iso: string | null) => (iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");
const modeBadge = (live: boolean) => (
  <Badge className={`text-[10px] font-bold border-0 ${live ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
    {live ? "PRODUCTION" : "TEST"}
  </Badge>
);

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: "Copié ✓" });
  } catch {
    toast({ title: "Copie impossible", description: "Sélectionnez le texte et copiez-le à la main.", variant: "destructive" });
  }
}

/** Secret montré une seule fois : après fermeture, il n'est plus récupérable (seule son empreinte est conservée pour les clés). */
const SecretBanner: React.FC<{ title: string; secret: string; onClose: () => void }> = ({ title, secret, onClose }) => (
  <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 space-y-2">
    <p className="text-sm font-bold text-emerald-900">{title}</p>
    <p className="text-xs text-emerald-800">Copiez-le maintenant : il ne sera plus jamais affiché. Ne le mettez jamais dans le code d'un site ou d'une application mobile.</p>
    <div className="flex items-center gap-2">
      <code className="flex-1 min-w-0 truncate rounded-lg bg-white border border-emerald-200 px-3 py-2 text-xs font-mono text-slate-800">{secret}</code>
      <Button size="sm" variant="outline" onClick={() => copy(secret)}><Copy className="w-3.5 h-3.5 mr-1" /> Copier</Button>
      <Button size="sm" variant="ghost" onClick={onClose}>J'ai copié</Button>
    </div>
  </div>
);

export const DevelopersTab: React.FC<DevelopersTabProps> = ({ shopId, kycVerified, formatPrice }) => {
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [endpoints, setEndpoints] = useState<WebhookEndpointRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [sandboxPayments, setSandboxPayments] = useState<SandboxPaymentRow[]>([]);
  const [secret, setSecret] = useState<{ title: string; value: string } | null>(null);

  const [keyName, setKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState<"test" | "live" | null>(null);

  const [hookUrl, setHookUrl] = useState("");
  const [hookLive, setHookLive] = useState(false);
  const [hookDesc, setHookDesc] = useState("");
  const [hookEvents, setHookEvents] = useState<string[]>([]);
  const [creatingHook, setCreatingHook] = useState(false);

  const load = useCallback(async () => {
    if (!shopId) { setLoading(false); return; }
    setLoading(true);
    const [k, e, d, s] = await Promise.all([
      payDevApi.listKeys(shopId), payDevApi.listEndpoints(shopId), payDevApi.listDeliveries(shopId), payDevApi.listSandboxPayments(shopId),
    ]);
    setKeys(k); setEndpoints(e); setDeliveries(d); setSandboxPayments(s);
    setLoading(false);
  }, [shopId]);

  useEffect(() => { void load(); }, [load]);

  if (!shopId) {
    return <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center text-sm text-slate-500">Créez d'abord une boutique pour utiliser l'API.</div>;
  }

  const createKey = async (live: boolean) => {
    setCreatingKey(live ? "live" : "test");
    const res = await payDevApi.createKey(shopId, live, keyName.trim() || (live ? "Production" : "Test"));
    setCreatingKey(null);
    if (!res.success) { toast({ title: "Clé non créée", description: res.error, variant: "destructive" }); return; }
    setSecret({ title: live ? "Votre clé secrète de PRODUCTION" : "Votre clé secrète de TEST", value: res.secret ?? "" });
    setKeyName("");
    void load();
  };

  const revokeKey = async (k: ApiKeyRow) => {
    if (!window.confirm(`Révoquer la clé « ${k.name} » ? Les intégrations qui l'utilisent cesseront de fonctionner immédiatement.`)) return;
    if (await payDevApi.revokeKey(k.id)) { toast({ title: "Clé révoquée" }); void load(); }
    else toast({ title: "Révocation impossible", variant: "destructive" });
  };

  const createHook = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingHook(true);
    const res = await payDevApi.createEndpoint(shopId, hookUrl.trim(), hookLive, hookEvents, hookDesc.trim());
    setCreatingHook(false);
    if (!res.success) { toast({ title: "Destination non créée", description: res.error, variant: "destructive" }); return; }
    setSecret({ title: "Secret de signature de cette destination", value: res.secret ?? "" });
    setHookUrl(""); setHookDesc(""); setHookEvents([]);
    void load();
  };

  const rotate = async (h: WebhookEndpointRow) => {
    if (!window.confirm("Générer un nouveau secret ? L'ancien cesse de fonctionner : mettez à jour votre serveur aussitôt.")) return;
    const res = await payDevApi.rotateSecret(h.id);
    if (res.success) setSecret({ title: "Nouveau secret de signature", value: res.secret ?? "" });
    else toast({ title: "Rotation impossible", description: res.error, variant: "destructive" });
  };

  const toggleHook = async (h: WebhookEndpointRow, active: boolean) => {
    setEndpoints((prev) => prev.map((x) => (x.id === h.id ? { ...x, is_active: active } : x)));
    if (!(await payDevApi.setEndpointActive(h.id, active))) { toast({ title: "Modification impossible", variant: "destructive" }); void load(); }
  };

  const deleteHook = async (h: WebhookEndpointRow) => {
    if (!window.confirm("Supprimer cette destination et son historique d'envois ?")) return;
    if (await payDevApi.deleteEndpoint(h.id)) void load();
    else toast({ title: "Suppression impossible", variant: "destructive" });
  };

  const toggleEvent = (ev: string, on: boolean) => setHookEvents((prev) => (on ? [...prev, ev] : prev.filter((x) => x !== ev)));

  const curl = `curl ${API_BASE_URL}/v1/payments \\
  -H "Authorization: Bearer ecm_sk_test_…" \\
  -H "Idempotency-Key: commande-1042" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 5000, "payment_method": "wave", "success_url": "https://votre-site.com/merci"}'`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-[#0E7C66]" />
            <h2 className="font-extrabold text-slate-900">API Ecomfy Pay</h2>
          </div>
          <Link to="/developers/ecomfy-pay" className="inline-flex items-center gap-1 text-sm font-semibold text-[#0E7C66] hover:underline">
            Documentation <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
        <p className="text-sm text-slate-600">
          Encaissez depuis votre propre site ou application : créez un paiement par API, redirigez le client, puis recevez le résultat par webhook.
          Commencez en <strong>mode test</strong> (sandbox) : aucun argent réel, résultats au choix.
        </p>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500">URL de base</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs font-mono">{API_BASE_URL}/v1</code>
            <Button size="sm" variant="outline" onClick={() => copy(`${API_BASE_URL}/v1`)}><Copy className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-slate-700 flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> Premier appel (curl)</summary>
          <pre className="mt-2 rounded-xl bg-slate-900 text-slate-100 text-xs p-4 overflow-x-auto">{curl}</pre>
        </details>
      </div>

      {secret && <SecretBanner title={secret.title} secret={secret.value} onClose={() => setSecret(null)} />}

      {/* Clés */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2"><KeyRound className="w-4 h-4 text-slate-700" /><h3 className="font-extrabold text-slate-900">Clés secrètes</h3></div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 flex-1 min-w-[180px]">
            <Label htmlFor="key-name" className="text-xs">Nom (facultatif)</Label>
            <Input id="key-name" value={keyName} maxLength={60} onChange={(e) => setKeyName(e.target.value)} placeholder="Serveur de ma boutique" />
          </div>
          <Button variant="outline" disabled={creatingKey !== null} onClick={() => createKey(false)}>
            {creatingKey === "test" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FlaskConical className="w-4 h-4 mr-1" />} Créer une clé de test
          </Button>
          <Button disabled={creatingKey !== null || !kycVerified} className="bg-[#0E7C66] hover:bg-[#0b6552] text-white" onClick={() => createKey(true)}>
            {creatingKey === "live" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <KeyRound className="w-4 h-4 mr-1" />} Créer une clé de production
          </Button>
        </div>
        {!kycVerified && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" /> La clé de production est disponible une fois votre vérification d'identité (KYC) validée. La clé de test est disponible tout de suite.
          </p>
        )}
        {loading ? <div className="py-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div> : keys.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune clé pour l'instant.</p>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
            {keys.map((k) => (
              <div key={k.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${k.revoked_at ? "opacity-50" : ""}`}>
                {modeBadge(k.livemode)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{k.name}{k.revoked_at && " (révoquée)"}</p>
                  <p className="text-xs text-slate-500 font-mono">{k.key_prefix}…{k.last4}</p>
                </div>
                <p className="text-xs text-slate-500">Créée {dateFr(k.created_at)} · dernier usage {dateFr(k.last_used_at)}</p>
                {!k.revoked_at && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => revokeKey(k)}><Trash2 className="w-3.5 h-3.5 mr-1" /> Révoquer</Button>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Webhooks */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2"><Webhook className="w-4 h-4 text-slate-700" /><h3 className="font-extrabold text-slate-900">Webhooks</h3></div>
        <p className="text-sm text-slate-600">Ecomfy appelle votre serveur à chaque résultat de paiement. Chaque envoi est signé (en-tête <code className="text-xs">Ecomfy-Signature</code>) ; les échecs sont repris pendant 24 h.</p>
        <form onSubmit={createHook} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="hook-url" className="text-xs">URL de votre serveur (https)</Label>
            <Input id="hook-url" required type="url" value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} placeholder="https://votre-site.com/webhooks/ecomfy" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hook-desc" className="text-xs">Description (facultatif)</Label>
            <Input id="hook-desc" maxLength={120} value={hookDesc} onChange={(e) => setHookDesc(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mode</Label>
            <div className="flex items-center gap-2 h-10">
              <Switch checked={hookLive} onCheckedChange={setHookLive} aria-label="Mode production" />
              <span className="text-sm">{hookLive ? "Production (paiements réels)" : "Test (sandbox)"}</span>
            </div>
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label className="text-xs">Événements (aucun coché = tous)</Label>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {WEBHOOK_EVENTS.map((ev) => (
                <label key={ev} className="flex items-center gap-1.5 text-xs font-mono text-slate-700">
                  <Checkbox checked={hookEvents.includes(ev)} onCheckedChange={(c) => toggleEvent(ev, c === true)} /> {ev}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2"><Button type="submit" disabled={creatingHook} variant="outline">{creatingHook && <Loader2 className="w-4 h-4 animate-spin mr-1" />} Ajouter la destination</Button></div>
        </form>

        {endpoints.length > 0 && (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
            {endpoints.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                {modeBadge(h.livemode)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-slate-800 truncate">{h.url}</p>
                  <p className="text-xs text-slate-500 truncate">{h.events.includes("*") ? "Tous les événements" : h.events.join(", ")}{h.description ? ` · ${h.description}` : ""}</p>
                </div>
                <Switch checked={h.is_active} onCheckedChange={(v) => toggleHook(h, v)} aria-label="Activer la destination" />
                <Button size="sm" variant="ghost" onClick={() => rotate(h)}><RefreshCw className="w-3.5 h-3.5 mr-1" /> Nouveau secret</Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => deleteHook(h)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            ))}
          </div>
        )}

        {deliveries.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Derniers envois</h4>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500"><tr>
                  <th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Événement</th><th className="text-left px-3 py-2">Destination</th>
                  <th className="text-left px-3 py-2">État</th><th className="text-left px-3 py-2">Tentatives</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {deliveries.map((d) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2 whitespace-nowrap">{dateFr(d.created_at)}</td>
                      <td className="px-3 py-2 font-mono">{d.event_type} {modeBadge(d.livemode)}</td>
                      <td className="px-3 py-2 max-w-[220px] truncate font-mono">{d.endpoint_url}</td>
                      <td className="px-3 py-2">
                        {d.status === "succeeded" && <span className="text-emerald-700 font-semibold">Livré ({d.last_http_status})</span>}
                        {d.status === "pending" && <span className="text-amber-700 font-semibold">{d.attempts === 0 ? "En attente" : `Reprise ${dateFr(d.next_attempt_at)}`}{d.last_error ? ` · ${d.last_error}` : ""}</span>}
                        {d.status === "failed" && <span className="text-red-700 font-semibold">Abandonné{d.last_error ? ` · ${d.last_error}` : ""}</span>}
                      </td>
                      <td className="px-3 py-2">{d.attempts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Sandbox */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2"><FlaskConical className="w-4 h-4 text-amber-600" /><h3 className="font-extrabold text-slate-900">Paiements de test récents</h3></div>
        {sandboxPayments.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun paiement de test. Créez-en un avec votre clé de test : la page de paiement sandbox vous laisse choisir le résultat.</p>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
            {sandboxPayments.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="font-mono text-xs text-slate-600">{p.public_id}</span>
                <span className="font-semibold">{formatPrice(p.amount)} FCFA</span>
                <Badge variant="outline" className="text-[10px] uppercase">{p.status}{p.failure_code ? ` · ${p.failure_code}` : ""}</Badge>
                {p.client_reference && <span className="text-xs text-slate-500">{p.client_reference}</span>}
                <span className="flex-1" />
                <span className="text-xs text-slate-500">{dateFr(p.created_at)}</span>
                {p.status === "pending" && p.checkout_url && (
                  <a className="text-xs font-semibold text-[#0E7C66] hover:underline" href={p.checkout_url} target="_blank" rel="noopener noreferrer">Ouvrir la page de paiement</a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
