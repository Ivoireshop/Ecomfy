import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ArrowLeft, CreditCard, Smartphone, Receipt } from "lucide-react";
import { Session } from "@supabase/supabase-js";

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
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  useEffect(() => {
    if (session?.user) {
      loadPayments();
    }
  }, [session]);

  const loadPayments = async () => {
    try {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", session?.user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error("Erreur lors du chargement des paiements:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger l'historique des paiements",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Complété</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500">En attente</Badge>;
      case "failed":
        return <Badge variant="destructive">Échoué</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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

  if (isLoading) {
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
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Historique des paiements
          </h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Tous vos paiements
            </CardTitle>
            <CardDescription>
              Consultez l'historique complet de vos transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
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
          </CardContent>
        </Card>

        {payments.length > 0 && (
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Total: {payments.length} transaction{payments.length > 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentHistory;
