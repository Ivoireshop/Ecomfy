import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FinancialMetrics,
  TransactionDetail,
  SubscriptionDetail,
  ActivatedShopDetail,
  PayingClientDetail,
} from "@/services/financialMetricsService";
import {
  Search,
  Download,
  DollarSign,
  TrendingUp,
  Store,
  Users,
  CheckCircle2,
  Calendar,
  Filter,
  CreditCard,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

interface RevenueAuditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  financialMetrics: FinancialMetrics | null;
  initialTab?: "revenue" | "mrr" | "shops" | "clients";
  onRefresh?: () => void;
}

export const RevenueAuditModal: React.FC<RevenueAuditModalProps> = ({
  open,
  onOpenChange,
  financialMetrics,
  initialTab = "revenue",
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Sync initialTab when modal opens
  React.useEffect(() => {
    if (open && initialTab) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    if (!financialMetrics?.validatedTransactions) return [];
    return financialMetrics.validatedTransactions.filter((tx) => {
      // Search text filter
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (tx.user_email || "").toLowerCase().includes(q) ||
        (tx.user_id || "").toLowerCase().includes(q) ||
        (tx.id || "").toLowerCase().includes(q) ||
        (tx.reference || "").toLowerCase().includes(q) ||
        (tx.payment_method || "").toLowerCase().includes(q) ||
        (tx.description || "").toLowerCase().includes(q);

      // Type filter
      const matchType = typeFilter === "all" || tx.type === typeFilter;

      // Status filter
      const matchStatus =
        statusFilter === "all" || (tx.status || "").toLowerCase() === statusFilter.toLowerCase();

      return matchSearch && matchType && matchStatus;
    });
  }, [financialMetrics?.validatedTransactions, searchQuery, typeFilter, statusFilter]);

  // Sum of filtered transactions
  const totalFilteredRevenue = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => acc + tx.amount, 0);
  }, [filteredTransactions]);

  // Filtered Subscriptions
  const filteredSubscriptions = useMemo(() => {
    if (!financialMetrics?.subscriptions) return [];
    return financialMetrics.subscriptions.filter((sub) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        sub.user_email.toLowerCase().includes(q) ||
        sub.shop_name.toLowerCase().includes(q) ||
        sub.plan_name.toLowerCase().includes(q)
      );
    });
  }, [financialMetrics?.subscriptions, searchQuery]);

  const totalFilteredMRR = useMemo(() => {
    return filteredSubscriptions.reduce((acc, sub) => acc + sub.monthly_amount, 0);
  }, [filteredSubscriptions]);

  // Filtered Activated Shops
  const filteredShops = useMemo(() => {
    if (!financialMetrics?.activatedShops) return [];
    return financialMetrics.activatedShops.filter((shop) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        shop.name.toLowerCase().includes(q) ||
        shop.slug.toLowerCase().includes(q) ||
        shop.owner_email.toLowerCase().includes(q) ||
        shop.transaction_reference.toLowerCase().includes(q)
      );
    });
  }, [financialMetrics?.activatedShops, searchQuery]);

  // Filtered Paying Clients
  const filteredClients = useMemo(() => {
    if (!financialMetrics?.payingClients) return [];
    return financialMetrics.payingClients.filter((client) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        client.user_email.toLowerCase().includes(q) ||
        client.user_id.toLowerCase().includes(q)
      );
    });
  }, [financialMetrics?.payingClients, searchQuery]);

  // Export CSV Handler
  const exportToCSV = () => {
    if (!filteredTransactions.length) return;
    const headers = ["Date", "Client Email", "ID User", "Type", "Reference", "Methode", "Montant (FCFA)", "Statut"];
    const rows = filteredTransactions.map((tx) => [
      new Date(tx.created_at).toLocaleString("fr-FR"),
      `"${tx.user_email || "Client"}"`,
      `"${tx.user_id}"`,
      `"${tx.type}"`,
      `"${tx.reference || tx.id}"`,
      `"${tx.payment_method}"`,
      tx.amount,
      `"${tx.status}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ecomfy_audit_revenus_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] bg-slate-950 text-white border-slate-800 rounded-3xl p-6 overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <DialogHeader className="space-y-2 pb-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-space font-extrabold text-white flex items-center gap-2">
                  Audit Financier & Transparence Ecomfy
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  Traçabilité en temps réel des transactions commercialement validées en base de données.
                </DialogDescription>
              </div>
            </div>

            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                className="rounded-full border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs gap-2"
              >
                <RefreshCw className="h-3.5 w-3.5 text-emerald-400" />
                Actualiser
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Global Summary Metric Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Revenus Cumulés</div>
            <div className="text-lg font-space font-extrabold text-emerald-400">
              {(financialMetrics?.cumulativeRevenue || 0).toLocaleString()} <span className="text-xs">FCFA</span>
            </div>
            <div className="text-[10px] text-slate-500">{financialMetrics?.completedPaymentsCount || 0} paiements validés</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">MRR Récurrent</div>
            <div className="text-lg font-space font-extrabold text-blue-400">
              {(financialMetrics?.mrr || 0).toLocaleString()} <span className="text-xs">FCFA</span>
            </div>
            <div className="text-[10px] text-slate-500">{financialMetrics?.activeSubscriptionsCount || 0} abonnements actifs</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Boutiques Activées</div>
            <div className="text-lg font-space font-extrabold text-amber-400">
              {financialMetrics?.activatedStoresCount || 0}
            </div>
            <div className="text-[10px] text-slate-500">Activations 1 300 FCFA</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Clients Payants</div>
            <div className="text-lg font-space font-extrabold text-purple-400">
              {financialMetrics?.payingUsersCount || 0}
            </div>
            <div className="text-[10px] text-slate-500">Utilisateurs uniques</div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3">
            <TabsList className="bg-slate-900 border border-slate-800 p-1 rounded-full text-xs">
              <TabsTrigger value="revenue" className="rounded-full px-4 py-1.5 font-bold data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                <TrendingUp className="h-3.5 w-3.5 mr-1.5 inline" />
                Revenus Cumulés
              </TabsTrigger>
              <TabsTrigger value="mrr" className="rounded-full px-4 py-1.5 font-bold data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                <DollarSign className="h-3.5 w-3.5 mr-1.5 inline" />
                MRR & Abonnements
              </TabsTrigger>
              <TabsTrigger value="shops" className="rounded-full px-4 py-1.5 font-bold data-[state=active]:bg-amber-500 data-[state=active]:text-white">
                <Store className="h-3.5 w-3.5 mr-1.5 inline" />
                Boutiques Activées
              </TabsTrigger>
              <TabsTrigger value="clients" className="rounded-full px-4 py-1.5 font-bold data-[state=active]:bg-purple-500 data-[state=active]:text-white">
                <Users className="h-3.5 w-3.5 mr-1.5 inline" />
                Clients Payants
              </TabsTrigger>
            </TabsList>

            {/* Global Search Bar */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Rechercher e-mail, ref, boutique..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 bg-slate-900 border-slate-800 text-xs text-white placeholder:text-slate-500 rounded-full"
              />
            </div>
          </div>

          {/* TAB 1: REVENUS CUMULÉS */}
          <TabsContent value="revenue" className="flex-1 flex flex-col overflow-hidden space-y-3 m-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-bold text-slate-400">Filtres :</span>
                
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-36 h-7 text-xs bg-slate-900 border-slate-800 rounded-full">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="activation">Activation (1300)</SelectItem>
                    <SelectItem value="subscription">Abonnement</SelectItem>
                    <SelectItem value="payment">Paiement direct</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32 h-7 text-xs bg-slate-900 border-slate-800 rounded-full">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                    <SelectItem value="all">Tous statuts</SelectItem>
                    <SelectItem value="completed">Validé / Payé</SelectItem>
                    <SelectItem value="pending">En attente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                className="h-7 text-xs rounded-full border-slate-800 bg-slate-900 hover:bg-slate-800 text-emerald-400 gap-1.5"
              >
                <Download className="h-3 w-3" />
                Exporter CSV
              </Button>
            </div>

            {/* Transactions Table */}
            <div className="flex-1 overflow-auto border border-slate-800 rounded-2xl bg-slate-900/50">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Client (E-mail)</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Description / Ref</th>
                    <th className="py-2.5 px-3">Méthode</th>
                    <th className="py-2.5 px-3 text-right">Montant</th>
                    <th className="py-2.5 px-3 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                        Aucune transaction trouvée pour ces critères d'audit.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-300">
                          {new Date(tx.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-2.5 px-3 font-sans font-medium text-white max-w-[160px] truncate" title={tx.user_email}>
                          {tx.user_email}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <Badge
                            variant="outline"
                            className={
                              tx.type === "activation"
                                ? "border-amber-500/40 text-amber-300 bg-amber-500/10 text-[10px]"
                                : "border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[10px]"
                            }
                          >
                            {tx.type === "activation" ? "Activation 1300" : "Paiement"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-300 max-w-[200px] truncate" title={tx.description || tx.reference}>
                          {tx.description || tx.reference || tx.id}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-400 capitalize">
                          {tx.payment_method}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                          {tx.amount.toLocaleString()} FCFA
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">
                            Payé
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {/* Table Footer Total */}
                <tfoot className="bg-slate-900 border-t border-slate-800 font-bold sticky bottom-0">
                  <tr>
                    <td colSpan={5} className="py-2.5 px-3 font-sans text-slate-300 uppercase text-[10px]">
                      TOTAL AUDITÉ ({filteredTransactions.length} TRANSACTIONS)
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-400 text-sm font-space font-extrabold">
                      {totalFilteredRevenue.toLocaleString()} FCFA
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </TabsContent>

          {/* TAB 2: MRR & ABONNEMENTS */}
          <TabsContent value="mrr" className="flex-1 flex flex-col overflow-hidden space-y-3 m-0">
            <div className="text-xs text-slate-400">
              Abonnements récurrents actifs générant du revenu mensuel (MRR).
            </div>
            <div className="flex-1 overflow-auto border border-slate-800 rounded-2xl bg-slate-900/50">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Client (E-mail)</th>
                    <th className="py-2.5 px-3">Boutique</th>
                    <th className="py-2.5 px-3">Formule / Plan</th>
                    <th className="py-2.5 px-3">Date Activation</th>
                    <th className="py-2.5 px-3 text-right">Montant Mensuel</th>
                    <th className="py-2.5 px-3 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredSubscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                        Aucun abonnement récurrent trouvé. (Seules les formules récurrentes actives constituent le MRR).
                      </td>
                    </tr>
                  ) : (
                    filteredSubscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-sans font-medium text-white">{sub.user_email}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-300">{sub.shop_name}</td>
                        <td className="py-2.5 px-3 font-sans">
                          <Badge variant="outline" className="border-blue-500/40 text-blue-300 bg-blue-500/10 text-[10px]">
                            {sub.plan_name}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {new Date(sub.start_date).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-blue-400">
                          {sub.monthly_amount.toLocaleString()} FCFA/mois
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-[10px]">Actif</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-900 border-t border-slate-800 font-bold sticky bottom-0">
                  <tr>
                    <td colSpan={4} className="py-2.5 px-3 font-sans text-slate-300 uppercase text-[10px]">
                      TOTAL MRR AUDITÉ ({filteredSubscriptions.length} ABONNÉS)
                    </td>
                    <td className="py-2.5 px-3 text-right text-blue-400 text-sm font-space font-extrabold">
                      {totalFilteredMRR.toLocaleString()} FCFA/mois
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </TabsContent>

          {/* TAB 3: BOUTIQUES ACTIVÉES */}
          <TabsContent value="shops" className="flex-1 flex flex-col overflow-hidden space-y-3 m-0">
            <div className="text-xs text-slate-400">
              Liste des boutiques ayant validé les frais d'activation de 1 300 FCFA.
            </div>
            <div className="flex-1 overflow-auto border border-slate-800 rounded-2xl bg-slate-900/50">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Nom de la Boutique</th>
                    <th className="py-2.5 px-3">Propriétaire (E-mail)</th>
                    <th className="py-2.5 px-3">Date d'Activation</th>
                    <th className="py-2.5 px-3">Référence Transaction</th>
                    <th className="py-2.5 px-3 text-right">Frais d'Activation</th>
                    <th className="py-2.5 px-3 text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredShops.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                        Aucune boutique activée enregistrée en base.
                      </td>
                    </tr>
                  ) : (
                    filteredShops.map((shop) => (
                      <tr key={shop.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-sans font-medium text-white flex items-center space-x-1.5">
                          <span>{shop.name}</span>
                          {shop.slug && (
                            <a
                              href={`/shop/${shop.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-500 hover:text-amber-400"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-300">{shop.owner_email}</td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {new Date(shop.activation_date).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px] truncate max-w-[150px]">
                          {shop.transaction_reference}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-amber-400">
                          {shop.activation_fee.toLocaleString()} FCFA
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">
                            Activée
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-900 border-t border-slate-800 font-bold sticky bottom-0">
                  <tr>
                    <td colSpan={4} className="py-2.5 px-3 font-sans text-slate-300 uppercase text-[10px]">
                      TOTAL BOUTIQUES ACTIVÉES ({filteredShops.length} BOUTIQUES UNIQUES)
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-400 text-sm font-space font-extrabold">
                      {(filteredShops.length * 1300).toLocaleString()} FCFA
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </TabsContent>

          {/* TAB 4: CLIENTS PAYANTS */}
          <TabsContent value="clients" className="flex-1 flex flex-col overflow-hidden space-y-3 m-0">
            <div className="text-xs text-slate-400">
              Liste des utilisateurs uniques ayant effectué au moins 1 transaction commercialement validée.
            </div>
            <div className="flex-1 overflow-auto border border-slate-800 rounded-2xl bg-slate-900/50">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Client (E-mail)</th>
                    <th className="py-2.5 px-3">ID Utilisateur</th>
                    <th className="py-2.5 px-3 text-center">Nbre de Paiements</th>
                    <th className="py-2.5 px-3">Premier Paiement</th>
                    <th className="py-2.5 px-3">Dernier Paiement</th>
                    <th className="py-2.5 px-3 text-right">Total Dépensé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                        Aucun client payant trouvé.
                      </td>
                    </tr>
                  ) : (
                    filteredClients.map((client) => (
                      <tr key={client.user_id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-sans font-medium text-white">{client.user_email}</td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px] truncate max-w-[140px]" title={client.user_id}>
                          {client.user_id}
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          <Badge variant="outline" className="border-purple-500/40 text-purple-300 bg-purple-500/10 text-[10px]">
                            {client.payments_count} achat(s)
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {new Date(client.first_payment_date).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {new Date(client.last_payment_date).toLocaleDateString("fr-FR")}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-purple-400">
                          {client.total_spent.toLocaleString()} FCFA
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-900 border-t border-slate-800 font-bold sticky bottom-0">
                  <tr>
                    <td colSpan={5} className="py-2.5 px-3 font-sans text-slate-300 uppercase text-[10px]">
                      TOTAL CLIENTS PAYANTS ({filteredClients.length} CLIENTS UNIQUES)
                    </td>
                    <td className="py-2.5 px-3 text-right text-purple-400 text-sm font-space font-extrabold">
                      {filteredClients.reduce((acc, c) => acc + c.total_spent, 0).toLocaleString()} FCFA
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
