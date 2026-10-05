import { useState, useEffect } from "react";
import {
  affiliateService,
  FounderAffiliateListItem,
  PayoutPeriod,
} from "@/services/affiliateService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Wallet,
  TrendingUp,
  CheckCircle,
  Clock,
  Settings,
  Search,
  Eye,
  DollarSign,
  Filter,
  CreditCard,
  Building2,
  Calendar,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export function FounderAffiliateAdmin() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("ALL");
  const [periods, setPeriods] = useState<PayoutPeriod[]>([]);
  const [threshold, setThreshold] = useState<number>(10000);
  const [isEditingThreshold, setIsEditingThreshold] = useState(false);
  const [newThresholdInput, setNewThresholdInput] = useState<string>("10000");

  const [overview, setOverview] = useState<any>({
    totalAffiliates: 0,
    activeAffiliates: 0,
    totalReferredUsers: 0,
    totalSubscriptionsCount: 0,
    pendingAmount: 0,
    approvedAmount: 0,
    payableAmount: 0,
    paidAmount: 0,
    totalPaidAmount: 0,
    remainingPayableAmount: 0,
  });

  const [affiliatesList, setAffiliatesList] = useState<FounderAffiliateListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Detail Modal State
  const [selectedAffiliateItem, setSelectedAffiliateItem] = useState<FounderAffiliateListItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Mark as Paid Modal State
  const [isPaidModalOpen, setIsPaidModalOpen] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState<string>("");
  const [payoutMethod, setPayoutMethod] = useState<string>("orange_money");
  const [payoutReference, setPayoutReference] = useState<string>("");
  const [payoutNotes, setPayoutNotes] = useState<string>("");
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedPeriod]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [periodsData, thresholdData, overviewData, listData] = await Promise.all([
        affiliateService.getPayoutPeriods(),
        affiliateService.getMinimumPayoutThreshold(),
        affiliateService.getFounderOverview(selectedPeriod),
        affiliateService.getFounderAffiliateList(selectedPeriod),
      ]);

      setPeriods(periodsData);
      setThreshold(thresholdData);
      setNewThresholdInput(String(thresholdData));
      setOverview(overviewData);
      setAffiliatesList(listData);
    } catch (err) {
      console.error("Error loading founder affiliate data:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données du système d'affiliation.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveThreshold = async () => {
    const val = Number(newThresholdInput);
    if (isNaN(val) || val < 0) {
      toast({
        title: "Montant invalide",
        description: "Veuillez saisir un seuil valide en FCFA.",
        variant: "destructive",
      });
      return;
    }

    const ok = await affiliateService.updateMinimumPayoutThreshold(val);
    if (ok) {
      setThreshold(val);
      setIsEditingThreshold(false);
      toast({
        title: "Seuil mis à jour ! ✅",
        description: `Le seuil minimum de paiement est désormais fixé à ${formatCurrency(val)}.`,
      });
    } else {
      toast({
        title: "Erreur",
        description: "Échec de la mise à jour du seuil.",
        variant: "destructive",
      });
    }
  };

  const handleOpenPaidModal = (item: FounderAffiliateListItem) => {
    setSelectedAffiliateItem(item);
    setPayoutAmount(String(item.payable_amount));
    setPayoutMethod(item.payout_method?.provider || "orange_money");
    setPayoutReference("");
    setPayoutNotes("");
    setIsPaidModalOpen(true);
  };

  const handleConfirmPaidAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAffiliateItem) return;

    const amt = Number(payoutAmount);
    if (isNaN(amt) || amt <= 0) {
      toast({
        title: "Montant invalide",
        description: "Le montant à payer doit être supérieur à 0.",
        variant: "destructive",
      });
      return;
    }

    if (!payoutReference.trim()) {
      toast({
        title: "Référence requise",
        description: "Veuillez saisir le numéro de transaction ou la référence du paiement manuel.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingPayout(true);
    const result = await affiliateService.markPayoutPaid({
      affiliate_id: selectedAffiliateItem.affiliate.id,
      amount: amt,
      payment_method: payoutMethod,
      payment_reference: payoutReference.trim(),
      period_code: selectedPeriod !== "ALL" ? selectedPeriod : undefined,
      notes: payoutNotes.trim(),
    });

    setIsSubmittingPayout(false);

    if (result.success) {
      toast({
        title: "Paiement Confirmé ! 🎉",
        description: `Le paiement de ${formatCurrency(amt)} a été enregistré et les commissions sont désormais marquées comme PAYÉES.`,
      });
      setIsPaidModalOpen(false);
      setIsDetailOpen(false);
      loadData();
    } else {
      toast({
        title: "Erreur lors de l'enregistrement",
        description: result.error || "Impossible de marquer le versement comme payé.",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      maximumFractionDigits: 0,
    }).format(amount).replace("XOF", "FCFA");
  };

  const filteredAffiliates = affiliatesList.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.user_name?.toLowerCase().includes(q) ||
      item.user_email?.toLowerCase().includes(q) ||
      item.affiliate.affiliate_code.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header controls: Period selector & Minimum Threshold */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">Période Trimestrielle</h2>
            <p className="text-xs text-slate-500">Filtrer l'activité d'affiliation par trimestre</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[200px] bg-slate-50 border-slate-200 text-xs font-semibold">
              <SelectValue placeholder="Toutes les périodes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes les périodes (Historique complet)</SelectItem>
              {periods.map((p) => (
                <SelectItem key={p.code} value={p.code}>
                  {p.name} ({p.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Threshold setting inline editor */}
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="text-xs text-slate-500 font-medium">Seuil min :</span>
            {isEditingThreshold ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  className="w-24 h-7 text-xs px-2"
                  value={newThresholdInput}
                  onChange={(e) => setNewThresholdInput(e.target.value)}
                />
                <Button size="sm" onClick={handleSaveThreshold} className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700">
                  OK
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditingThreshold(false)} className="h-7 text-xs">
                  X
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-emerald-700">{formatCurrency(threshold)}</span>
                <button
                  onClick={() => setIsEditingThreshold(true)}
                  className="text-slate-400 hover:text-slate-600 text-xs underline"
                >
                  Modifier
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Overview KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Affiliés Totaux / Actifs</span>
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl md:text-2xl font-extrabold text-slate-900">
              {overview.totalAffiliates} <span className="text-xs font-semibold text-emerald-600">({overview.activeAffiliates} actifs)</span>
            </div>
            <p className="text-[11px] text-slate-400">{overview.totalReferredUsers} clients référés au total</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Abonnements Générés</span>
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-xl md:text-2xl font-extrabold text-slate-900">
              {overview.totalSubscriptionsCount}
            </div>
            <p className="text-[11px] text-slate-400">Souscriptions payées via affiliation</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Montant Disponible à Payer</span>
              <Wallet className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl md:text-2xl font-extrabold text-amber-600">
              {formatCurrency(overview.remainingPayableAmount)}
            </div>
            <p className="text-[11px] text-slate-400">Commissions validées dues aux affiliés</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Total Payé aux Affiliés</span>
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl md:text-2xl font-extrabold text-emerald-700">
              {formatCurrency(overview.totalPaidAmount)}
            </div>
            <p className="text-[11px] text-slate-400">Versements manuels confirmés</p>
          </CardContent>
        </Card>
      </div>

      {/* Affiliates List Table */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              Gestionnaires & Ambassadeurs Affiliés
            </CardTitle>
            <CardDescription className="text-xs">
              Consultez la performance individuelle et effectuez les versements manuels de commissions.
            </CardDescription>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <Input
              placeholder="Rechercher nom, email ou code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-slate-400">Chargement de la liste des affiliés...</div>
          ) : filteredAffiliates.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Users className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-medium">Aucun affilié trouvé.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b">
                  <tr>
                    <th className="p-3">Affilié</th>
                    <th className="p-3">Code</th>
                    <th className="p-3 text-center">Filleuls</th>
                    <th className="p-3 text-center">Abonnements</th>
                    <th className="p-3 text-right">Total Gagné</th>
                    <th className="p-3 text-right">Solde Disponible</th>
                    <th className="p-3 text-right">Déjà Payé</th>
                    <th className="p-3 text-center">Éligibilité</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAffiliates.map((item) => {
                    const isEligible = item.payable_amount >= threshold;
                    return (
                      <tr key={item.affiliate.id} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{item.user_name}</div>
                          <div className="text-[11px] text-slate-400">{item.user_email}</div>
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-700">
                          {item.affiliate.affiliate_code}
                        </td>
                        <td className="p-3 text-center font-semibold">{item.referred_count}</td>
                        <td className="p-3 text-center font-semibold">{item.subscriptions_count}</td>
                        <td className="p-3 text-right font-medium">{formatCurrency(item.total_earned)}</td>
                        <td className="p-3 text-right font-bold text-amber-600">
                          {formatCurrency(item.payable_amount)}
                        </td>
                        <td className="p-3 text-right font-semibold text-emerald-700">
                          {formatCurrency(item.paid_amount)}
                        </td>
                        <td className="p-3 text-center">
                          {isEligible ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                              Éligible (&ge; {formatCurrency(threshold)})
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-500">
                              Sous le seuil
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedAffiliateItem(item);
                              setIsDetailOpen(true);
                            }}
                            className="h-8 text-xs gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> Détail
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => handleOpenPaidModal(item)}
                            disabled={item.payable_amount <= 0}
                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                          >
                            <DollarSign className="w-3.5 h-3.5" /> Marquer Payé
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DETAIL MODAL */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" /> Détails de l'Affilié
            </DialogTitle>
            <DialogDescription>
              Fiche complète et coordonnées bancaires / Mobile Money de l'ambassadeur.
            </DialogDescription>
          </DialogHeader>

          {selectedAffiliateItem && (
            <div className="space-y-4 text-xs">
              {/* Profile summary */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-slate-400 block">Identité :</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedAffiliateItem.user_name}</span>
                  <span className="text-slate-500 block">{selectedAffiliateItem.user_email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Code & Taux :</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    {selectedAffiliateItem.affiliate.affiliate_code}
                  </span>
                  <span className="text-slate-500 block">
                    Taux : {(selectedAffiliateItem.affiliate.commission_rate * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Payment Method Details */}
              <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 space-y-2">
                <div className="font-bold text-emerald-900 text-sm flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" /> Moyen de Paiement Configuré
                </div>
                {selectedAffiliateItem.payout_method ? (
                  <div className="grid grid-cols-2 gap-2 text-slate-700">
                    <div>
                      <span className="font-semibold text-slate-500">Fournisseur : </span>
                      <span className="uppercase font-bold text-slate-900">
                        {selectedAffiliateItem.payout_method.provider.replace("_", " ")}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500">Titulaire : </span>
                      <span className="font-bold text-slate-900">
                        {selectedAffiliateItem.payout_method.account_name}
                      </span>
                    </div>
                    {selectedAffiliateItem.payout_method.account_phone && (
                      <div>
                        <span className="font-semibold text-slate-500">Numéro Téléphone : </span>
                        <span className="font-mono font-bold text-slate-900">
                          {selectedAffiliateItem.payout_method.account_phone}
                        </span>
                      </div>
                    )}
                    {selectedAffiliateItem.payout_method.bank_name && (
                      <div>
                        <span className="font-semibold text-slate-500">Banque : </span>
                        <span className="font-bold text-slate-900">
                          {selectedAffiliateItem.payout_method.bank_name}
                        </span>
                      </div>
                    )}
                    {selectedAffiliateItem.payout_method.account_number_iban && (
                      <div className="col-span-2">
                        <span className="font-semibold text-slate-500">IBAN / RIB : </span>
                        <span className="font-mono font-bold text-slate-900">
                          {selectedAffiliateItem.payout_method.account_number_iban}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-amber-700 flex items-center gap-2 font-medium">
                    <AlertCircle className="w-4 h-4" /> Aucun moyen de paiement configuré par cet affilié pour l'instant.
                  </div>
                )}
              </div>

              {/* Financial summary stats */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <div className="text-slate-400 text-[10px]">TOTAL GAGNÉ</div>
                  <div className="font-bold text-slate-900 text-sm">
                    {formatCurrency(selectedAffiliateItem.total_earned)}
                  </div>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="text-amber-700 text-[10px]">SOLDE DISPONIBLE</div>
                  <div className="font-bold text-amber-800 text-sm">
                    {formatCurrency(selectedAffiliateItem.payable_amount)}
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="text-emerald-700 text-[10px]">DÉJÀ PAYÉ</div>
                  <div className="font-bold text-emerald-800 text-sm">
                    {formatCurrency(selectedAffiliateItem.paid_amount)}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
              Fermer
            </Button>
            {selectedAffiliateItem && selectedAffiliateItem.payable_amount > 0 && (
              <Button
                onClick={() => {
                  setIsDetailOpen(false);
                  handleOpenPaidModal(selectedAffiliateItem);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Payer cet affilié
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MARK AS PAID MODAL */}
      <Dialog open={isPaidModalOpen} onOpenChange={setIsPaidModalOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleConfirmPaidAction}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-emerald-700">
                <DollarSign className="w-5 h-5 text-emerald-600" /> Confirmer le Paiement Manuel
              </DialogTitle>
              <DialogDescription>
                Confirmez le versement de commission effectué en dehors de la plateforme.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-4 text-xs">
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="text-emerald-800 font-semibold block">Affilié :</span>
                <span className="font-bold text-slate-900 text-sm">
                  {selectedAffiliateItem?.user_name} ({selectedAffiliateItem?.affiliate.affiliate_code})
                </span>
                <div className="mt-1 text-slate-600">
                  Coordonnées :{" "}
                  {selectedAffiliateItem?.payout_method ? (
                    <span className="font-bold">
                      {selectedAffiliateItem.payout_method.provider.toUpperCase()} -{" "}
                      {selectedAffiliateItem.payout_method.account_phone ||
                        selectedAffiliateItem.payout_method.account_number_iban}
                    </span>
                  ) : (
                    <span className="text-amber-600">Non renseignées</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-slate-700">Montant réellement payé (FCFA)</Label>
                <Input
                  type="number"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-slate-700">Méthode de Paiement Utilisée</Label>
                <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="orange_money">Orange Money 🟠</SelectItem>
                    <SelectItem value="wave">Wave 🌊</SelectItem>
                    <SelectItem value="mtn_money">MTN Mobile Money 🟡</SelectItem>
                    <SelectItem value="moov_money">Moov Money 🔵</SelectItem>
                    <SelectItem value="bank_transfer">Virement Bancaire 🏦</SelectItem>
                    <SelectItem value="cash">Comptant / Autre 💵</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-slate-700">Référence / Numéro de Transaction</Label>
                <Input
                  placeholder="ex: OM-20261005-9988 ou REF-WAVE-123"
                  value={payoutReference}
                  onChange={(e) => setPayoutReference(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-slate-700">Commentaire / Notes (Optionnel)</Label>
                <Input
                  placeholder="ex: Règlement des commissions du T4 2026"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPaidModalOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingPayout}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {isSubmittingPayout ? "Validation..." : "Confirmer & Marquer comme PAYÉ"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
