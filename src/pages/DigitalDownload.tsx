import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, FileText, Loader2, Clock, AlertCircle } from "lucide-react";
import { DownloadList, formatFileSize, getDownloadLink, listDownloads, requestDownloadEmail } from "@/lib/digitalProducts";

/** /telechargement/:token — page de l'acheteur : fichiers de sa commande, disponibles une fois le paiement confirmé. */
export default function DigitalDownload() {
  const { token = "" } = useParams();
  const [data, setData] = useState<DownloadList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await listDownloads(token));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lien de téléchargement introuvable.");
    }
  }, [token]);

  useEffect(() => { if (token) void load(); }, [load, token]);

  // Lien perdu : formulaire n° de commande + e-mail (renvoi du mail, jamais d'affichage du lien).
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [recoverMsg, setRecoverMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const recover = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setRecoverMsg(null);
    try {
      setRecoverMsg({ text: await requestDownloadEmail(orderNumber.trim(), email.trim()), ok: true });
    } catch (err) {
      setRecoverMsg({ text: err instanceof Error ? err.message : "Envoi impossible.", ok: false });
    } finally {
      setSending(false);
    }
  };

  // Paiement pas encore confirmé : le webhook arrive en quelques secondes, on réessaie sans que l'acheteur recharge.
  // (Hook placé avant le return conditionnel ci-dessous : l'ordre des hooks doit rester identique à chaque rendu.)
  useEffect(() => {
    if (!data || data.paid) return;
    const t = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(t);
  }, [data, load]);

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 md:p-8 space-y-4">
          <h1 className="text-xl font-bold text-center">Retrouver mes téléchargements</h1>
          <p className="text-sm text-muted-foreground text-center">
            Saisissez le numéro de votre commande et l'adresse e-mail utilisée à l'achat : nous vous renvoyons le lien.
          </p>
          <form onSubmit={recover} className="space-y-3">
            <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="Numéro de commande" required aria-label="Numéro de commande" />
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Adresse e-mail de l'achat" required aria-label="Adresse e-mail" />
            <Button type="submit" className="w-full" disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Recevoir mon lien
            </Button>
          </form>
          {recoverMsg && <p className={`text-sm text-center ${recoverMsg.ok ? "text-emerald-600" : "text-destructive"}`} role="status">{recoverMsg.text}</p>}
        </Card>
      </div>
    );
  }

  const download = async (fileId: string) => {
    setBusyFile(fileId);
    setNotice(null);
    try {
      const { url } = await getDownloadLink(token, fileId);
      // Le lien signé dure 60 secondes : on le suit tout de suite.
      window.location.href = url;
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Téléchargement impossible.");
    } finally {
      setBusyFile(null);
    }
  };

  const primary = data?.shop?.primary_color || "#2563eb";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-xl w-full p-6 md:p-8">
        {!data && !error && (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Chargement…</div>
        )}

        {error && (
          <div className="text-center py-6 space-y-3">
            <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
            <p className="font-semibold">{error}</p>
            <p className="text-sm text-muted-foreground">Vérifiez le lien reçu après votre achat, ou <a className="underline" href="/telechargement">recevez-le à nouveau par e-mail</a>.</p>
          </div>
        )}

        {data && !data.paid && (
          <div className="text-center py-6 space-y-3">
            <Clock className="h-10 w-10 mx-auto" style={{ color: primary }} />
            <h1 className="text-xl font-bold">En attente de la confirmation du paiement</h1>
            <p className="text-sm text-muted-foreground">
              Vos fichiers apparaîtront ici dès que {data.shop?.name || "la boutique"} aura reçu votre paiement. Cette page se met à jour toute seule.
            </p>
          </div>
        )}

        {data && data.paid && (
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h1 className="text-xl font-bold">Vos téléchargements</h1>
              <p className="text-sm text-muted-foreground">
                {data.shop?.name}{data.order_number ? ` · Commande ${data.order_number}` : ""}
              </p>
            </div>

            {data.items.length === 0 && (
              <p className="text-sm text-center text-muted-foreground">Cette commande ne contient pas de produit numérique à télécharger.</p>
            )}

            {data.items.map((item, i) => (
              <div key={`${item.product_name}-${i}`} className="space-y-2">
                <h2 className="font-semibold text-sm">{item.product_name}</h2>
                {item.files.length === 0 ? (
                  <p className="text-sm text-muted-foreground rounded-lg bg-muted/40 p-3">
                    Aucun fichier à télécharger pour ce produit : la boutique vous le remettra directement
                    {data.shop?.contact ? ` (${data.shop.contact})` : ""}.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {item.files.map((f) => (
                      <li key={f.id} className="flex items-center gap-3 rounded-lg border p-3">
                        <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{f.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(f.file_size)}
                            {f.remaining !== null && ` · ${f.remaining} téléchargement${f.remaining > 1 ? "s" : ""} restant${f.remaining > 1 ? "s" : ""}`}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          disabled={busyFile === f.id || f.remaining === 0}
                          onClick={() => download(f.id)}
                          style={{ backgroundColor: primary }}
                        >
                          {busyFile === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                          Télécharger
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {notice && <p className="text-sm text-destructive text-center" role="alert">{notice}</p>}
            <p className="text-xs text-muted-foreground text-center">
              Gardez ce lien : il vous permet de retélécharger vos fichiers. Ne le partagez pas.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
