import { useEffect, useState } from "react";
import { Lock, AlertTriangle, ShoppingBag, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { PayCommissionDialog } from "./PayCommissionDialog";

interface Props {
  shopId: string;
  paymentDeadline?: string | null;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.round(n)));

export function LockedOrdersScreen({ shopId, paymentDeadline }: Props) {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.rpc("get_locked_orders_summary" as any, { _shop_id: shopId });
      if (active) {
        setSummary(data || null);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [shopId]);

  const balanceDue = Number(summary?.balance_due) || 0;
  const lockedCount = Number(summary?.locked_orders_count) || 0;
  const lockedCommission = Number(summary?.locked_commission_added) || 0;
  const perOrder = Number(summary?.commission_per_order) || 50;
  const deadline = summary?.payment_deadline || paymentDeadline;

  return (
    <div className="max-w-2xl mx-auto py-6 px-2">
      <Card className="p-6 border-2 border-red-200 bg-red-50/50">
        <div className="flex items-start gap-3 mb-4">
          <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <Lock className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-red-900">Espace commandes verrouillé</h2>
            <p className="text-sm text-red-800/80 mt-1">
              Votre boutique reste accessible aux clients et continue de recevoir des commandes,
              mais les détails (numéros clients, adresses, livraison) sont masqués tant que votre
              montant dû n'est pas réglé.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="h-24 animate-pulse bg-red-100/60 rounded" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-white rounded-lg p-4 border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <ShoppingBag className="h-3.5 w-3.5" /> Commandes pendant verrouillage
                </div>
                <div className="text-2xl font-bold">{lockedCount}</div>
              </div>
              <div className="bg-white rounded-lg p-4 border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Wallet className="h-3.5 w-3.5" /> Commission ajoutée
                </div>
                <div className="text-2xl font-bold">+{fmt(lockedCommission)} <span className="text-sm font-normal">FCFA</span></div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{lockedCount} × {fmt(perOrder)} FCFA</div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-5 border-2 border-red-300 mb-4">
              <div className="text-xs text-muted-foreground">Montant total à payer (actualisé)</div>
              <div className="text-3xl font-bold text-red-700 mt-1">{fmt(balanceDue)} FCFA</div>
              {deadline && (
                <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                  Échéance : {new Date(deadline).toLocaleString("fr-FR")}
                </div>
              )}
            </div>

            <Button
              size="lg"
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold"
              onClick={() => setPayOpen(true)}
              disabled={balanceDue <= 0}
            >
              Payer maintenant {fmt(balanceDue)} FCFA
            </Button>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Aucune commande n'est perdue. Après confirmation du paiement, vous retrouvez l'accès
              complet à toutes les commandes reçues pendant la période de verrouillage (numéros
              clients, livraison, traitement).
            </p>
          </>
        )}
      </Card>

      <PayCommissionDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        shopId={shopId}
        balanceDue={balanceDue}
      />
    </div>
  );
}