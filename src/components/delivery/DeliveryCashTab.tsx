import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Banknote } from "lucide-react";
import { toast } from "sonner";
import { deliveryRpc, type ProviderPaymentRow } from "@/lib/deliveryRpc";

interface DeliveryCashTabProps {
  providerId: string;
}

const STEP_LABELS: Record<ProviderPaymentRow["status"], { label: string; className: string }> = {
  collected_by_driver: { label: "Chez le livreur", className: "bg-orange-100 text-orange-700 hover:bg-orange-100" },
  remitted_to_company: { label: "Reçu — à reverser à la boutique", className: "bg-blue-100 text-blue-700 hover:bg-blue-100" },
  remitted_to_shop: { label: "Reversé à la boutique", className: "bg-green-100 text-green-700 hover:bg-green-100" },
};

const fcfa = (n: number) => `${Number(n).toLocaleString("fr-FR")} FCFA`;
const day = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

/** Caisse du prestataire : argent encaissé à la livraison, de la main du livreur jusqu'à la boutique. */
export function DeliveryCashTab({ providerId }: DeliveryCashTabProps) {
  const queryClient = useQueryClient();

  const { data: payments, isLoading } = useQuery({
    queryKey: ["provider-payments", providerId],
    queryFn: () => deliveryRpc<ProviderPaymentRow>("get_provider_payments", { _provider_id: providerId }),
  });

  const advance = useMutation({
    mutationFn: async ({ paymentId, status }: { paymentId: string; status: "remitted_to_company" | "remitted_to_shop" }) => {
      const { data, error } = await supabase
        .from("delivery_payments")
        .update({ status })
        .eq("id", paymentId)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("mise à jour refusée.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-payments", providerId] });
      queryClient.invalidateQueries({ queryKey: ["provider-deliveries", providerId] });
      toast.success("Caisse mise à jour");
    },
    onError: (error: Error) => toast.error("Erreur : " + error.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const rows = payments ?? [];
  const sum = (status: ProviderPaymentRow["status"]) =>
    rows.filter((r) => r.status === status).reduce((acc, r) => acc + Number(r.amount_collected), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white shadow-sm border-slate-100">
          <div className="text-sm font-medium text-slate-500">À récupérer auprès des livreurs</div>
          <div className="text-2xl font-bold text-orange-600 mt-1" data-testid="cash-with-drivers">{fcfa(sum("collected_by_driver"))}</div>
        </Card>
        <Card className="p-4 bg-white shadow-sm border-slate-100">
          <div className="text-sm font-medium text-slate-500">À reverser aux boutiques</div>
          <div className="text-2xl font-bold text-blue-600 mt-1" data-testid="cash-to-shops">{fcfa(sum("remitted_to_company"))}</div>
        </Card>
        <Card className="p-4 bg-white shadow-sm border-slate-100">
          <div className="text-sm font-medium text-slate-500">Déjà reversé</div>
          <div className="text-2xl font-bold text-green-600 mt-1" data-testid="cash-remitted">{fcfa(sum("remitted_to_shop"))}</div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Banknote className="w-5 h-5 text-primary" />
            Argent encaissé à la livraison
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-center p-8 text-slate-500">
              Aucun encaissement. Une livraison terminée sur une commande non payée en ligne apparaît ici.
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((p) => {
                const step = STEP_LABELS[p.status];
                return (
                  <div key={p.payment_id} className="border border-slate-100 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3 bg-slate-50">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold font-mono text-slate-800">{p.order_number || p.delivery_id.substring(0, 8).toUpperCase()}</span>
                        <Badge className={step.className}>{step.label}</Badge>
                      </div>
                      <div className="text-sm text-slate-600">
                        {p.customer_name} · livreur : {p.driver_name || "—"} · encaissé le {day(p.collected_at)}
                        {p.remitted_to_company_at && ` · reçu le ${day(p.remitted_to_company_at)}`}
                        {p.remitted_to_shop_at && ` · reversé le ${day(p.remitted_to_shop_at)}`}
                      </div>
                    </div>
                    <div className="font-bold text-slate-900 md:w-36 md:text-right">{fcfa(p.amount_collected)}</div>
                    <div className="md:w-56">
                      {p.status === "collected_by_driver" && (
                        <Button size="sm" className="w-full" disabled={advance.isPending}
                          onClick={() => advance.mutate({ paymentId: p.payment_id, status: "remitted_to_company" })}>
                          Argent reçu du livreur
                        </Button>
                      )}
                      {p.status === "remitted_to_company" && (
                        <Button size="sm" variant="outline" className="w-full" disabled={advance.isPending}
                          onClick={() => advance.mutate({ paymentId: p.payment_id, status: "remitted_to_shop" })}>
                          Reversé à la boutique
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
