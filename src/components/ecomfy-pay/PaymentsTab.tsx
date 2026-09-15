import React, { useState } from "react";
import { EcomfyPayment } from "@/types/ecomfyPay";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, CreditCard, ArrowDownRight, RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";
import { PaymentMethodLogo } from "./PaymentMethodLogo";

interface PaymentsTabProps {
  payments: EcomfyPayment[];
  onRefresh: () => void;
  formatPrice: (amount: number) => string;
}

export const PaymentsTab: React.FC<PaymentsTabProps> = ({
  payments,
  onRefresh,
  formatPrice,
}) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filtered = payments.filter((p) => {
    const matchesSearch =
      p.internal_reference.toLowerCase().includes(search.toLowerCase()) ||
      (p.customer_name && p.customer_name.toLowerCase().includes(search.toLowerCase())) ||
      (p.customer_phone && p.customer_phone.includes(search));
    const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par référence, client ou téléphone..."
            className="pl-9 h-10 text-xs rounded-xl border-slate-200"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {["ALL", "SUCCEEDED", "PENDING", "FAILED"].map((st) => (
            <Button
              key={st}
              variant={statusFilter === st ? "default" : "outline"}
              size="sm"
              className={`h-9 px-3 text-xs font-semibold rounded-xl shrink-0 ${
                statusFilter === st ? "bg-[#0E7C66] text-white" : "border-slate-200 text-slate-700"
              }`}
              onClick={() => setStatusFilter(st)}
            >
              {st === "ALL" ? "Tous" : st === "SUCCEEDED" ? "Succès" : st === "PENDING" ? "En attente" : "Échoués"}
            </Button>
          ))}

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-slate-500 hover:text-slate-900 shrink-0"
            onClick={onRefresh}
            title="Rafraîchir"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700 text-sm">Aucun paiement trouvé</p>
            <p className="text-xs text-slate-400 mt-1">
              Les paiements effectués par vos clients s'afficheront ici en temps réel.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Référence Interne</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Méthode</th>
                  <th className="py-3 px-4">Montant Brut</th>
                  <th className="py-3 px-4">Net Vendeur</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {p.internal_reference}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">
                        {p.customer_name || "Client anonyme"}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {p.customer_phone || p.customer_email || "—"}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <PaymentMethodLogo id={p.payment_method_code || p.payment_method} size={28} />
                        <span className="capitalize font-semibold text-slate-800">
                          {p.payment_method.replace("_", " ")}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {formatPrice(p.amount)} FCFA
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-700">
                      +{formatPrice(p.net_merchant_amount)} FCFA
                    </td>
                    <td className="py-3 px-4">
                      {p.status === "SUCCEEDED" ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-0 gap-1 text-[10px]">
                          <CheckCircle2 className="w-3 h-3" /> Réussi
                        </Badge>
                      ) : p.status === "PENDING" ? (
                        <Badge className="bg-amber-100 text-amber-800 border-0 gap-1 text-[10px]">
                          <Clock className="w-3 h-3" /> En attente
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-100 text-rose-800 border-0 gap-1 text-[10px]">
                          <XCircle className="w-3 h-3" /> Échoué
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs whitespace-nowrap">
                      {new Date(p.created_at).toLocaleString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
