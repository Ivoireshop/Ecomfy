import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CreditCard, Smartphone, Receipt, Download } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { ListPagination } from "@/components/ListPagination";
import { usePagedList } from "@/hooks/usePagedList";
import { readAll, readPage } from "@/lib/pagination";

const PAYMENTS_PAGE_SIZE = 20;

const STATUS_LABELS: Record<string, string> = {
  completed: "Complété",
  pending: "En attente",
  failed: "Échoué",
  cancelled: "Annulé",
};

interface Payment {
  id: string;
  amount: number;
  currency: string;
  payment_method: string;
  provider?: string;
  status: string;
  transaction_id?: string;
  created_at: string;
}

const PaymentHistory = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (!session) {
          navigate("/auth");
        }
      }
    );

    return () => authSubscription.unsubscribe();
  }, [navigate]);

  const userId = session?.user?.id;
  const { rows: payments, total, page, pageSize, setPage, loading, error, reload } = usePagedList<Payment>({
    enabled: !!userId,
    filterKey: userId ?? "",
    pageSize: PAYMENTS_PAGE_SIZE,
    fetchPage: ({ page, pageSize }) =>
      readPage<Payment>(page, pageSize, (from, to) =>
        supabase.from("payments").select("*", { count: "exact" })
          .eq("user_id", userId as string)
          .order("created_at", { ascending: false }).order("id", { ascending: false })
          .range(from, to)),
  });

  const getStatusBadge = (status: string) => {
    const label = STATUS_LABELS[status] ?? status;
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">{label}</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500">{label}</Badge>;
      case "failed":
        return <Badge variant="destructive">{label}</Badge>;
      default:
        return <Badge variant="secondary">{label}</Badge>;
    }
  };

  const getPaymentMethodIcon = (method: string, provider?: string) => {
    if (method === "card" || method === "bank_card") {
      return <CreditCard className="h-4 w-4 mr-2" />;
    }
    return <Smartphone className="h-4 w-4 mr-2" />;
  };

  const getPaymentMethodLabel = (method: string, provider?: string) => {
    if (method === "card" || method === "bank_card") {
      return "Carte bancaire";
    }
    if (provider) {
      return `Mobile Money (${provider.charAt(0).toUpperCase() + provider.slice(1)})`;
    }
    return "Mobile Money";
  };

  const formatAmount = (amount: number, currency: string) => {
    return `${amount.toLocaleString()} ${currency}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // L'export porte sur tout l'historique, pas seulement sur la page affichée.
  const exportToCSV = async () => {
    if (!userId || exporting) return;
    setExporting(true);
    let all: Payment[];
    try {
      all = await readAll<Payment>((from, to) =>
        supabase.from("payments").select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }).order("id", { ascending: false })
          .range(from, to));
    } catch (e) {
      console.error("Erreur lors de l'export des paiements:", e);
      toast({ title: "Export impossible", description: "L'historique n'a pas pu être lu en entier. Réessayez.", variant: "destructive" });
      return;
    } finally {
      setExporting(false);
    }
    if (all.length === 0) {
      toast({
        title: "Aucune donnée",
        description: "Il n'y a aucun paiement à exporter",
        variant: "destructive",
      });
      return;
    }

    // En-têtes CSV
    const headers = ["Date", "Méthode de paiement", "Fournisseur", "Montant", "Devise", "Statut", "ID Transaction"];
    
    // Données
    const csvData = all.map(payment => [
      new Date(payment.created_at).toLocaleString("fr-FR"),
      payment.payment_method === "card" || payment.payment_method === "bank_card" ? "Carte bancaire" : "Mobile Money",
      payment.provider ? payment.provider.charAt(0).toUpperCase() + payment.provider.slice(1) : "N/A",
      payment.amount.toString(),
      payment.currency,
      STATUS_LABELS[payment.status] ?? payment.status,
      payment.transaction_id || "N/A"
    ]);

    // Création du contenu CSV
    const csvContent = [
      headers.join(","),
      ...csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    // Création et téléchargement du fichier
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `historique_paiements_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export réussi",
      description: "L'historique des paiements a été exporté en CSV",
    });
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Historique des paiements
          </h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Tous vos paiements
                </CardTitle>
                <CardDescription>
                  Consultez l'historique complet de vos transactions
                </CardDescription>
              </div>
              {total > 0 && (
                <Button onClick={exportToCSV} disabled={exporting} variant="outline" className="gap-2">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Exporter en CSV
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : error ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-sm text-destructive">Impossible de charger l'historique des paiements.</p>
                <Button size="sm" variant="outline" onClick={reload}>Réessayer</Button>
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucun paiement enregistré</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Méthode</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Transaction ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">
                          {formatDate(payment.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            {getPaymentMethodIcon(payment.payment_method, payment.provider)}
                            {getPaymentMethodLabel(payment.payment_method, payment.provider)}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatAmount(payment.amount, payment.currency)}
                        </TableCell>
                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {payment.transaction_id ? (
                            payment.transaction_id.length > 20 ? 
                              `${payment.transaction_id.slice(0, 20)}...` : 
                              payment.transaction_id
                          ) : (
                            "N/A"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <ListPagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} disabled={loading} />
          </CardContent>
        </Card>

        {total > 0 && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Total: {total.toLocaleString("fr-FR")} transaction{total > 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentHistory;
