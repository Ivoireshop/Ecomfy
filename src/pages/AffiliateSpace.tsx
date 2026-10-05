import { useState, useEffect } from "react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { supabase } from "@/integrations/supabase/client";
import {
  affiliateService,
  AffiliateProfile,
  AffiliatePayoutMethod,
  AffiliateCommission,
  AffiliatePayout,
  AffiliateStats,
} from "@/services/affiliateService";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  CheckCircle,
  Share2,
  Wallet,
  Users,
  Clock,
  TrendingUp,
  CreditCard,
  Building2,
  PhoneCall,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export default function AffiliateSpace() {
  const { user, isReady } = useAuthReady();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [profile, setProfile] = useState<AffiliateProfile | null>(null);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [payoutMethod, setPayoutMethod] = useState<AffiliatePayoutMethod | null>(null);
  const [commissions, setCommissions] = useState<AffiliateCommission[]>([]);
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);

  // Payout method form state
  const [provider, setProvider] = useState<
    "orange_money" | "wave" | "mtn_money" | "moov_money" | "bank_transfer"
  >("orange_money");
  const [accountName, setAccountName] = useState("");
  const [accountPhone, setAccountPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountIban, setAccountIban] = useState("");
  const [isSavingMethod, setIsSavingMethod] = useState(false);

  useEffect(() => {
    if (!isReady || !user?.id) return;
    loadAffiliateData(user.id);
  }, [isReady, user?.id]);

  const loadAffiliateData = async (userId: string) => {
    setLoading(true);
    try {
      // 1. Get or create profile
      const affProfile = await affiliateService.getOrCreateProfile(userId);
      setProfile(affProfile);

      if (affProfile) {
        // 2. Fetch stats, payout method, commissions, payouts, referrals
        const [statsData, methodData, commsData, payoutsData, refsData] = await Promise.all([
          affiliateService.getStats(affProfile.id),
          affiliateService.getPayoutMethod(affProfile.id),
          affiliateService.getCommissions(affProfile.id),
          affiliateService.getPayouts(affProfile.id),
          affiliateService.getReferrals(affProfile.id),
        ]);

        setStats(statsData);
        setPayoutMethod(methodData);
        setCommissions(commsData);
        setPayouts(payoutsData);
        setReferrals(refsData);

        if (methodData) {
          setProvider(methodData.provider);
          setAccountName(methodData.account_name || "");
          setAccountPhone(methodData.account_phone || "");
          setBankName(methodData.bank_name || "");
          setAccountIban(methodData.account_number_iban || "");
        }
      }
    } catch (err) {
      console.error("Error loading affiliate space:", err);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données de votre espace affilié.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const referralLink = profile?.affiliate_code
    ? `${window.location.origin}/auth?ref=${profile.affiliate_code}`
    : (user?.id ? `${window.location.origin}/auth?ref=ECOMFY-${user.id.substring(0, 6).toUpperCase()}` : "");

  const handleCopyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({
      title: "Lien copié ! 🚀",
      description: "Votre lien d'affiliation est dans votre presse-papiers.",
    });
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSavePayoutMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!accountName.trim()) {
      toast({
        title: "Champ requis",
        description: "Veuillez entrer le nom du titulaire du compte.",
        variant: "destructive",
      });
      return;
    }

    if (provider !== "bank_transfer" && !accountPhone.trim()) {
      toast({
        title: "Numéro de téléphone requis",
        description: "Veuillez entrer votre numéro de téléphone pour le transfert Mobile Money.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingMethod(true);
    const success = await affiliateService.savePayoutMethod({
      affiliate_id: profile.id,
      provider,
      account_name: accountName.trim(),
      account_phone: accountPhone.trim(),
      bank_name: bankName.trim(),
      account_number_iban: accountIban.trim(),
    });

    setIsSavingMethod(false);

    if (success) {
      toast({
        title: "Succès ! ✅",
        description: "Votre moyen de paiement a été enregistré avec succès.",
      });
      loadAffiliateData(user!.id);
    } else {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le moyen de paiement.",
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAYABLE":
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200">Payable</Badge>;
      case "APPROVED":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Validé</Badge>;
      case "PAID":
        return <Badge className="bg-green-600 text-white">Payé</Badge>;
      case "PENDING":
        return <Badge variant="outline" className="text-amber-600 border-amber-300">En attente</Badge>;
      case "CANCELLED":
      case "REVERSED":
        return <Badge variant="destructive">Annulé</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 min-h-screen">
      <Header title="Programme d'Affiliation Ecomfy" />

      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pb-20 md:pb-6">
          {/* Hero Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-800 p-6 md:p-8 text-white shadow-lg">
            <div className="relative z-10 max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-200 text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> Programme Ambassadeur Offciel
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Gagnez <span className="text-emerald-300 font-black">20% de commission</span> sur chaque abonnement recommandé !
              </h1>
              <p className="text-emerald-100/90 text-sm md:text-base leading-relaxed">
                Partagez votre lien d'affiliation Ecomfy avec d'autres marchands et créateurs. Recevez des commissions récurrentes directement sur Orange Money, Wave, MTN, Moov ou compte bancaire.
              </p>
            </div>

            <div className="absolute right-[-20px] bottom-[-20px] opacity-10 pointer-events-none">
              <Wallet className="w-64 h-64 text-white" />
            </div>
          </div>

          {/* Referral Link Quick Access */}
          <Card className="border-emerald-100 shadow-sm bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800">
                <Share2 className="w-4 h-4 text-emerald-600" /> Mon Lien d'Affiliation Personnel
              </CardTitle>
              <CardDescription>
                Copiez ce lien et partagez-le sur vos réseaux sociaux, WhatsApp ou votre site web.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <div className="relative flex-1 w-full">
                  <Input
                    readOnly
                    value={referralLink || "Chargement de votre lien..."}
                    className="font-mono text-xs sm:text-sm pr-12 bg-slate-50 border-slate-200"
                  />
                  <div className="absolute right-3 top-2.5 text-xs text-emerald-600 font-semibold uppercase">
                    20%
                  </div>
                </div>
                <Button
                  onClick={handleCopyLink}
                  disabled={!referralLink || loading}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center justify-center gap-2 shrink-0"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-white" /> Copié !
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" /> Copier le lien
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Stats Overview Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Total Gagné</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-lg md:text-2xl font-bold text-slate-900">
                  {formatCurrency(stats?.totalEarned || 0)}
                </div>
                <p className="text-[11px] text-slate-400">Cumul historique validé</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>En Attente</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-lg md:text-2xl font-bold text-slate-900">
                  {formatCurrency(stats?.pendingAmount || 0)}
                </div>
                <p className="text-[11px] text-slate-400">En cours de vérification</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Disponible (Payable)</span>
                  <Wallet className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-lg md:text-2xl font-bold text-emerald-600">
                  {formatCurrency(stats?.payableAmount || 0)}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  {stats?.isEligibleForPayout ? (
                    <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                      <CheckCircle className="w-3 h-3" /> Seuil atteint (&ge; 10 000 FCFA)
                    </span>
                  ) : (
                    <span className="text-amber-600 flex items-center gap-0.5">
                      <AlertCircle className="w-3 h-3" /> Seuil min: 10 000 FCFA
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                  <span>Déjà Payé</span>
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-lg md:text-2xl font-bold text-slate-900">
                  {formatCurrency(stats?.paidAmount || 0)}
                </div>
                <p className="text-[11px] text-slate-400">Versé par Ecomfy</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-slate-200/70 p-1 rounded-xl">
              <TabsTrigger value="overview" className="text-xs sm:text-sm font-medium">
                Mon Affiliation & Paiement
              </TabsTrigger>
              <TabsTrigger value="referrals" className="text-xs sm:text-sm font-medium">
                Mes Filleuls ({stats?.referredCount || 0})
              </TabsTrigger>
              <TabsTrigger value="commissions" className="text-xs sm:text-sm font-medium">
                Commissions ({commissions.length})
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs sm:text-sm font-medium">
                Historique Paiements ({payouts.length})
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: OVERVIEW & PAYMENT METHOD CONFIG */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Payout method setup form */}
                <Card className="lg:col-span-2 border-slate-200 bg-white">
                  <CardHeader>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-600" /> Moyen de Réception des Commissions
                    </CardTitle>
                    <CardDescription>
                      Sélectionnez comment vous souhaitez recevoir vos gains trimestriels (Mobile Money ou Virement bancaire).
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSavePayoutMethod} className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-slate-700">Méthode de Paiement</Label>
                        <Select
                          value={provider}
                          onValueChange={(val: any) => setProvider(val)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choisir un moyen de paiement" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="orange_money">Orange Money 🟠</SelectItem>
                            <SelectItem value="wave">Wave 🌊</SelectItem>
                            <SelectItem value="mtn_money">MTN Mobile Money 🟡</SelectItem>
                            <SelectItem value="moov_money">Moov Money 🔵</SelectItem>
                            <SelectItem value="bank_transfer">Compte Bancaire / Virement 🏦</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-slate-700">Nom complet du Titulaire</Label>
                          <Input
                            placeholder="ex: Ulrich DJATE"
                            value={accountName}
                            onChange={(e) => setAccountName(e.target.value)}
                            required
                          />
                        </div>

                        {provider !== "bank_transfer" ? (
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-slate-700">Numéro de Téléphone (Mobile Money)</Label>
                            <Input
                              type="tel"
                              placeholder="ex: 0708091011"
                              value={accountPhone}
                              onChange={(e) => setAccountPhone(e.target.value)}
                              required
                            />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-slate-700">Nom de la Banque</Label>
                            <Input
                              placeholder="ex: Ecobank, SGBCI..."
                              value={bankName}
                              onChange={(e) => setBankName(e.target.value)}
                            />
                          </div>
                        )}
                      </div>

                      {provider === "bank_transfer" && (
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold text-slate-700">Numéro de Compte / IBAN / RIB</Label>
                          <Input
                            placeholder="ex: CI092 01001 0123456789 12"
                            value={accountIban}
                            onChange={(e) => setAccountIban(e.target.value)}
                          />
                        </div>
                      )}

                      <div className="pt-2 flex items-center justify-between">
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <PhoneCall className="w-3.5 h-3.5 text-emerald-600" /> Vos coordonnées restent confidentielles et sécurisées.
                        </div>
                        <Button
                          type="submit"
                          disabled={isSavingMethod}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                        >
                          {isSavingMethod ? "Enregistrement..." : "Enregistrer le moyen de paiement"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                {/* Affiliate status summary card */}
                <Card className="border-slate-200 bg-white">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-bold text-slate-800">
                      Règles & Prochain Paiement
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-xs text-slate-600">
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 space-y-1">
                      <div className="font-bold text-emerald-900 text-sm">Taux de Commission : 20%</div>
                      <p className="text-emerald-800/80">
                        Calculé sur le montant réellement payé pour chaque abonnement Ecomfy mensuel ou annuel.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between font-medium">
                        <span>Exemple 12 000 FCFA :</span>
                        <span className="font-bold text-slate-900">2 400 FCFA / vente</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Exemple 35 000 FCFA :</span>
                        <span className="font-bold text-slate-900">7 000 FCFA / vente</span>
                      </div>
                    </div>

                    <div className="border-t pt-3 space-y-2">
                      <div className="font-semibold text-slate-800">Seuil de paiement minimum :</div>
                      <div className="text-sm font-bold text-emerald-700">10 000 FCFA</div>
                      <p className="text-[11px] text-slate-500">
                        Si vos commissions accumulées sont inférieures à 10 000 FCFA en fin de trimestre, le montant est automatiquement reporté au trimestre suivant sans expiration.
                      </p>
                    </div>

                    <div className="border-t pt-3 space-y-1">
                      <div className="font-semibold text-slate-800">Cycle de Versement :</div>
                      <p className="text-[11px] text-slate-500">
                        Les paiements sont traités manuellement à la fin de chaque trimestre (T1, T2, T3, T4).
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* TAB 2: REFERRALS / FILLEULS */}
            <TabsContent value="referrals">
              <Card className="border-slate-200 bg-white">
                <CardHeader>
                  <CardTitle className="text-base font-bold">Liste de vos Filleuls</CardTitle>
                  <CardDescription>
                    Utilisateurs inscrits grâce à votre lien d'affiliation.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {referrals.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 space-y-3">
                      <Users className="w-12 h-12 mx-auto text-slate-300" />
                      <p className="text-sm">Vous n'avez pas encore de filleuls inscrits.</p>
                      <p className="text-xs text-slate-500">
                        Partagez votre lien <span className="font-mono text-emerald-600 font-semibold">{referralLink}</span> pour commencer à générer des filleuls !
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left text-slate-600">
                        <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b">
                          <tr>
                            <th className="p-3">Utilisateur Référé</th>
                            <th className="p-3">Code Utilisé</th>
                            <th className="p-3">Date d'Inscription</th>
                            <th className="p-3 text-right">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {referrals.map((ref) => (
                            <tr key={ref.id} className="hover:bg-slate-50/50">
                              <td className="p-3 font-medium text-slate-900">
                                {ref.referred_user_id.substring(0, 8)}...
                              </td>
                              <td className="p-3 font-mono text-emerald-700 font-bold">{ref.referral_code_used}</td>
                              <td className="p-3">{new Date(ref.created_at).toLocaleDateString("fr-FR")}</td>
                              <td className="p-3 text-right">
                                <Badge className="bg-emerald-100 text-emerald-800">Inscrit</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 3: COMMISSIONS LIST */}
            <TabsContent value="commissions">
              <Card className="border-slate-200 bg-white">
                <CardHeader>
                  <CardTitle className="text-base font-bold">Détail de vos Commissions</CardTitle>
                  <CardDescription>
                    Chaque abonnement payé par un de vos filleuls génère une commission de 20%.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {commissions.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 space-y-3">
                      <TrendingUp className="w-12 h-12 mx-auto text-slate-300" />
                      <p className="text-sm">Aucune commission enregistrée pour le moment.</p>
                      <p className="text-xs text-slate-500">
                        Dès qu'un de vos filleuls souscrit un abonnement Ecomfy payant, vos 20% apparaissent ici.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left text-slate-600">
                        <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b">
                          <tr>
                            <th className="p-3">Date</th>
                            <th className="p-3">Période</th>
                            <th className="p-3">Montant Abonnement</th>
                            <th className="p-3">Taux</th>
                            <th className="p-3">Commission (20%)</th>
                            <th className="p-3 text-right">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {commissions.map((comm) => (
                            <tr key={comm.id} className="hover:bg-slate-50/50">
                              <td className="p-3">{new Date(comm.created_at).toLocaleDateString("fr-FR")}</td>
                              <td className="p-3 font-semibold text-slate-700">{comm.period_code || "En cours"}</td>
                              <td className="p-3 font-medium">{formatCurrency(comm.amount_paid)}</td>
                              <td className="p-3">{(comm.commission_rate * 100).toFixed(0)}%</td>
                              <td className="p-3 font-bold text-emerald-700">
                                {formatCurrency(comm.commission_amount)}
                              </td>
                              <td className="p-3 text-right">{getStatusBadge(comm.status)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 4: PAYOUT HISTORY */}
            <TabsContent value="history">
              <Card className="border-slate-200 bg-white">
                <CardHeader>
                  <CardTitle className="text-base font-bold">Historique des Versements</CardTitle>
                  <CardDescription>
                    Liste permanente de tous les paiements qui vous ont été versés par Ecomfy.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {payouts.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 space-y-3">
                      <Wallet className="w-12 h-12 mx-auto text-slate-300" />
                      <p className="text-sm">Aucun versement effectué pour le moment.</p>
                      <p className="text-xs text-slate-500">
                        Vos versements confirmés par le fondateur apparaîtront ici avec leur référence.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left text-slate-600">
                        <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b">
                          <tr>
                            <th className="p-3">Date</th>
                            <th className="p-3">Période</th>
                            <th className="p-3">Montant Versé</th>
                            <th className="p-3">Méthode</th>
                            <th className="p-3">Référence / Trans ID</th>
                            <th className="p-3 text-right">Statut</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {payouts.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50/50">
                              <td className="p-3">{new Date(p.paid_at).toLocaleDateString("fr-FR")}</td>
                              <td className="p-3 font-semibold text-slate-700">{p.period_code || "Direct"}</td>
                              <td className="p-3 font-bold text-emerald-700">{formatCurrency(p.amount_paid)}</td>
                              <td className="p-3 uppercase font-medium">{p.payment_method}</td>
                              <td className="p-3 font-mono text-slate-500">{p.payment_reference || "N/A"}</td>
                              <td className="p-3 text-right">
                                <Badge className="bg-green-600 text-white">Payé</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
        <MobileBottomNav />
    </div>
  );
}
