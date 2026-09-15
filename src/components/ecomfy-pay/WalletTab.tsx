import React from "react";
import { Wallet, WalletLedgerEntry, WithdrawalRequest } from "@/types/ecomfyPay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Clock, History, AlertCircle } from "lucide-react";

interface WalletTabProps {
  wallet: Wallet | null;
  ledger: WalletLedgerEntry[];
  withdrawals: WithdrawalRequest[];
  onOpenWithdrawal: () => void;
  formatPrice: (amount: number) => string;
}

export const WalletTab: React.FC<WalletTabProps> = ({
  wallet,
  ledger,
  withdrawals,
  onOpenWithdrawal,
  formatPrice,
}) => {
  const availableBalance = wallet?.available_balance || 0;
  const pendingBalance = wallet?.pending_balance || 0;

  return (
    <div className="space-y-6">
      {/* Solde & Action de retrait */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-700">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Ecomfy Wallet · Solde Disponible
          </span>
          <h2 className="text-3xl sm:text-4xl font-black mt-1 tracking-tight">
            {formatPrice(availableBalance)}{" "}
            <span className="text-base font-normal text-slate-400">FCFA</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Solde en attente de règlement (72h) :{" "}
            <span className="font-bold text-amber-400">
              {formatPrice(pendingBalance)} FCFA
            </span>
          </p>
        </div>

        <Button
          size="lg"
          className="bg-[#0E7C66] hover:bg-[#0A5C4C] text-white font-bold rounded-2xl px-6 h-12 text-sm shadow-lg shrink-0 gap-2"
          onClick={onOpenWithdrawal}
          disabled={availableBalance <= 0}
        >
          <ArrowUpRight className="w-4 h-4" /> Demander un retrait
        </Button>
      </div>

      {/* Demandes de Retrait En Cours & Passées */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
        <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
          <ArrowDownLeft className="w-5 h-5 text-[#0E7C66]" /> Demandes de Retrait
        </h4>

        {withdrawals.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            Aucune demande de retrait effectuée.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Référence</th>
                  <th className="py-2.5 px-3">Méthode &amp; Destination</th>
                  <th className="py-2.5 px-3">Montant</th>
                  <th className="py-2.5 px-3">Statut</th>
                  <th className="py-2.5 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {withdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      {w.withdrawal_reference}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800 capitalize block">
                        {w.payout_method.replace("_", " ")}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        {w.destination_phone || w.destination_name || "Compte Vendeur"}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      {formatPrice(w.amount)} FCFA
                    </td>
                    <td className="py-3 px-3">
                      <Badge
                        className={
                          w.status === "SUCCEEDED"
                            ? "bg-emerald-100 text-emerald-800 text-[10px]"
                            : w.status === "PROCESSING" || w.status === "REQUESTED"
                            ? "bg-amber-100 text-amber-800 text-[10px]"
                            : "bg-rose-100 text-rose-800 text-[10px]"
                        }
                      >
                        {w.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-xs">
                      {new Date(w.created_at).toLocaleString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Livre Journal Immuable (Ledger Mouvements) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm space-y-4">
        <h4 className="font-bold text-slate-900 text-base flex items-center gap-2">
          <History className="w-5 h-5 text-slate-600" /> Registre Financier Immuable (Ledger)
        </h4>

        {ledger.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            Aucun mouvement enregistré dans le registre comptable.
          </p>
        ) : (
          <div className="space-y-2">
            {ledger.map((entry) => {
              const isCredit = entry.amount > 0;

              return (
                <div
                  key={entry.id}
                  className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center justify-between gap-3 text-xs sm:text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900 block truncate">
                      {entry.description}
                    </span>
                    <span className="text-[11px] text-slate-400 block truncate">
                      Réf: {entry.reference_id || "N/A"} • {new Date(entry.created_at).toLocaleString("fr-FR")}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`font-black text-sm block ${
                        isCredit ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      {isCredit ? "+" : ""}
                      {formatPrice(entry.amount)} FCFA
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Solde Avail: {formatPrice(entry.running_available_balance)} FCFA
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
