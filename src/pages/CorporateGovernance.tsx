import { useState } from "react";
import { Link } from "react-router-dom";
import { useCorporateGovernance } from "@/hooks/useCorporateGovernance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Crown,
  ShieldCheck,
  Building2,
  FileText,
  TrendingUp,
  PieChart,
  Users,
  Briefcase,
  AlertTriangle,
  Clock,
  Sparkles,
  Loader2,
  PlusCircle,
  FileCheck,
  History,
  Lock,
  ArrowRight,
  ShieldAlert,
  UserX,
  Code,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

export default function CorporateGovernance() {
  const {
    loading,
    company,
    shareholders,
    documents,
    proposals,
    ipAssets,
    auditLogs,
    fetchCorporateData,
    createProposal,
    updateProposalStatus
  } = useCorporateGovernance();

  // New Proposal Form State
  const [isProposalDialogOpen, setIsProposalDialogOpen] = useState(false);
  const [proposalTitle, setProposalTitle] = useState("");
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [proposedPct, setProposedPct] = useState<number>(5.0);
  const [proposalRationale, setProposalRationale] = useState("");
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);

  // Workflow update state
  const [selectedProposal, setSelectedProposal] = useState<any>(null);

  const handleCreateProposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposalTitle || !beneficiaryId || !proposedPct || !proposalRationale) return;

    setIsSubmittingProposal(true);
    try {
      await createProposal({
        title: proposalTitle,
        beneficiary_shareholder_id: beneficiaryId,
        proposed_percentage: proposedPct,
        rationale: proposalRationale,
        proposed_by: "ulrich-admin",
      });

      setIsProposalDialogOpen(false);
      setProposalTitle("");
      setBeneficiaryId("");
      setProposedPct(5.0);
      setProposalRationale("");
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingProposal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-[#0E7C66]" />
          <p className="text-sm text-slate-400 font-medium">Chargement du Module Corporate & Governance Ecomfy...</p>
        </div>
      </div>
    );
  }

  // Cap Table Metrics
  const totalShares = company?.total_authorized_shares || 1000000;
  const mainFounderAllocation = shareholders.find(s => s.is_main_founder || s.email.includes("djateulrich"))?.allocation;
  const mainFounderPct = mainFounderAllocation?.target_percentage || 80;

  const totalAllocatedPct = shareholders.reduce((sum, s) => sum + (s.allocation?.target_percentage || 0), 0);
  const vestingBeneficiariesCount = shareholders.filter(s => s.allocation?.status === "vesting").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 space-y-8 font-sans">
      {/* 1. LEGAL DISCLAIMER BANNER */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 relative overflow-hidden backdrop-blur-sm">
        <div className="flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
              Avertissement Juridique & Périmètre Logiciel Ecomfy
            </h4>
            <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
              Ce module est un système de gouvernance, de documentation et de traçabilité interne. 
              <strong> Il ne remplace pas les statuts, actes de cession, formalités légales ou conseils d'un professionnel du droit.</strong> 
              Aucune validation informatique ne constitue automatiquement un transfert juridique d'actions sans formalisation légale.
            </p>
          </div>
        </div>
      </div>

      {/* 2. HEADER BARNER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Crown className="w-3.5 h-3.5 text-amber-400" /> Ecomfy SaaS Startup Governance
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Ecomfy Corporate & Governance
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Gestion du Cap Table, moteurs de vesting, documentation juridique, traçabilité des décisions et onboarding des associés.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl">
            <Link to="/associate-space">
              <Users className="w-4 h-4 mr-2 text-emerald-400" /> Mon Espace Associé
            </Link>
          </Button>
          <Button onClick={() => setIsProposalDialogOpen(true)} className="bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold rounded-xl px-5 shadow-lg shadow-[#0E7C66]/20">
            <PlusCircle className="w-4 h-4 mr-2" /> Nouvelle Proposition Cap Table
          </Button>
        </div>
      </div>

      {/* 3. CAP TABLE METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Fondateur Principal</span>
            <Crown className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white">{mainFounderPct} %</div>
            <p className="text-xs text-amber-400/90 font-medium mt-1">ULRICH DJATÉ YAPI (800 000 actions)</p>
          </div>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Capital de Référence</span>
            <Building2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white">{totalShares.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-1">Actions autorisées (Configurable)</p>
          </div>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Bénéficiaires Vesting</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-purple-300">{vestingBeneficiariesCount} Associés</div>
            <p className="text-xs text-slate-400 mt-1">Désiré Tano (10%) & Couboura Amena (10%)</p>
          </div>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Attribution Cible Totale</span>
            <PieChart className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-emerald-400">{totalAllocatedPct} %</div>
            <p className="text-xs text-slate-400 mt-1">100% Attribué (80% Fondateur + 20% Vesting)</p>
          </div>
        </Card>
      </div>

      {/* 4. MAIN OPERATIONAL TABS */}
      <Tabs defaultValue="captable" className="w-full">
        <TabsList className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex flex-wrap gap-1.5">
          <TabsTrigger value="captable" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <PieChart className="w-4 h-4" /> Cap Table
          </TabsTrigger>
          <TabsTrigger value="vesting" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <Clock className="w-4 h-4" /> Moteur de Vesting
          </TabsTrigger>
          <TabsTrigger value="proposals" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <FileText className="w-4 h-4" /> Proposals & Modifications
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <FileCheck className="w-4 h-4" /> Centre Documentaire
          </TabsTrigger>
          <TabsTrigger value="ip" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <Code className="w-4 h-4" /> Propriété Intellectuelle
          </TabsTrigger>
          <TabsTrigger value="offboarding" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <UserX className="w-4 h-4" /> Offboarding
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <History className="w-4 h-4" /> Audit Logs
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CAP TABLE TABLE */}
        <TabsContent value="captable" className="mt-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
            <CardHeader className="p-0 mb-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-emerald-400" /> Structure Officielle du Cap Table Ecomfy
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs mt-1">
                  Répartition des actions autorisées, détenues, acquises et sous régime de vesting.
                </CardDescription>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 font-bold">
                Base: 1 000 000 Actions
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-4">Associé / Membre</th>
                      <th className="p-4">Rôle Corporate</th>
                      <th className="p-4">Participation Cible</th>
                      <th className="p-4">Actions Cible</th>
                      <th className="p-4">Acquises (%)</th>
                      <th className="p-4">Actions Acquises</th>
                      <th className="p-4">Statut Vesting</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {shareholders.map((s) => {
                      const isMain = s.is_main_founder || s.email.includes("djateulrich");
                      const alloc = s.allocation;
                      return (
                        <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4 font-bold text-white flex items-center gap-2.5">
                            {isMain ? (
                              <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                            ) : (
                              <Users className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                            <div>
                              <div>{s.full_name}</div>
                              <div className="text-[11px] font-normal text-slate-500">{s.email}</div>
                            </div>
                          </td>
                          <td className="p-4">
                            {isMain ? (
                              <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
                                Fondateur Principal
                              </Badge>
                            ) : (
                              <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                                Associé / Vesting
                              </Badge>
                            )}
                          </td>
                          <td className="p-4 font-extrabold text-emerald-400 text-sm">
                            {alloc?.target_percentage || 0} %
                          </td>
                          <td className="p-4 font-mono">
                            {(alloc?.target_shares || 0).toLocaleString()}
                          </td>
                          <td className="p-4 font-semibold text-slate-200">
                            {alloc?.vested_percentage || (isMain ? 80 : 0)} %
                          </td>
                          <td className="p-4 font-mono text-slate-300">
                            {(alloc?.vested_shares || (isMain ? 800000 : 0)).toLocaleString()}
                          </td>
                          <td className="p-4">
                            {isMain ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Acquis (Original)
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                                Vesting (48 Mois)
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Ecom IA Mastery Note Row */}
                    <tr className="bg-slate-950/40">
                      <td className="p-4 font-bold text-slate-400 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-slate-500" />
                        Ecom IA Mastery
                      </td>
                      <td className="p-4 text-slate-500">Partenaire Extérieur</td>
                      <td className="p-4 font-bold text-slate-400">0 %</td>
                      <td className="p-4 text-slate-500">0</td>
                      <td className="p-4 text-slate-500">0 %</td>
                      <td className="p-4 text-slate-500">0</td>
                      <td className="p-4">
                        <Badge variant="outline" className="text-slate-500 border-slate-800">
                          Non attribué (0%)
                        </Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: VESTING ENGINE */}
        <TabsContent value="vesting" className="mt-6 space-y-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" /> Moteur de Vesting Ecomfy
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs mt-1">
                Suivi des échéances de 48 mois avec 12 mois de cliff. L'atteinte d'un jalon génère le statut <strong>VESTING ELIGIBLE</strong> nécessitant une formalisation juridique.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-6">
              {shareholders.filter(s => s.allocation?.status === "vesting").map((beneficiary) => {
                const alloc = beneficiary.allocation;
                const plan = beneficiary.vesting_plan;
                return (
                  <div key={beneficiary.id} className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-white text-base flex items-center gap-2">
                          <Users className="w-4 h-4 text-purple-400" /> {beneficiary.full_name}
                        </h4>
                        <p className="text-xs text-slate-400">{beneficiary.email} — Objectif: {alloc?.target_percentage}% ({alloc?.target_shares.toLocaleString()} actions)</p>
                      </div>
                      <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 font-semibold">
                        Durée : 48 mois | Cliff : 12 mois
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Progression du Vesting (Cliff non encore atteint)</span>
                        <span className="text-purple-300 font-bold">0 % Acquis</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700">
                        <div className="bg-gradient-to-r from-purple-600 to-indigo-500 h-full rounded-full w-[25%]" />
                      </div>
                    </div>

                    {/* Milestone Warning */}
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-3">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        À l'échéance du cliff (12 mois), les conditions généreront le statut <strong>VESTING ELIGIBLE</strong>. Une validation et les formalités juridiques applicables seront requises avant toute modification du capital.
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: PROPOSALS & MODIFICATIONS */}
        <TabsContent value="proposals" className="mt-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
            <CardHeader className="p-0 mb-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-400" /> Proposals & Workflow de Modification du Capital
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs mt-1">
                  Aucune modification directe du Cap Table n'est autorisée. Toute modification passe par 6 étapes de validation.
                </CardDescription>
              </div>
              <Button onClick={() => setIsProposalDialogOpen(true)} className="bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold rounded-xl text-xs">
                <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Nouvelle Proposition
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-4">
                {proposals.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                    Aucune proposition de modification en cours. Cliquez sur "Nouvelle Proposition" pour démarrer un workflow.
                  </div>
                ) : (
                  proposals.map((prop) => (
                    <div key={prop.id} className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-500">#{prop.proposal_number}</span>
                          <h4 className="font-bold text-white text-sm">{prop.title}</h4>
                          <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px]">
                            {prop.status.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400">{prop.rationale}</p>
                        <div className="text-[11px] text-slate-500">
                          Attribution proposée : {prop.current_percentage}% ➔ <strong className="text-emerald-400">{prop.proposed_percentage}%</strong> ({prop.proposed_shares.toLocaleString()} actions)
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {prop.status === "proposed" && (
                          <Button size="sm" onClick={() => updateProposalStatus(prop.id, "approval_required")} className="bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl">
                            Soumettre au Vote
                          </Button>
                        )}
                        {prop.status === "approval_required" && (
                          <Button size="sm" onClick={() => updateProposalStatus(prop.id, "legal_formalization_required")} className="bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-xl">
                            Approuver & Exiger Formalisation
                          </Button>
                        )}
                        {prop.status === "legal_formalization_required" && (
                          <Button size="sm" onClick={() => updateProposalStatus(prop.id, "cap_table_updated")} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl">
                            Valider Actes & Mettre à jour Cap Table
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: DOCUMENT CENTER */}
        <TabsContent value="documents" className="mt-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-400" /> Ecomfy Document Center
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs mt-1">
                Chartes, pactes d'associés, conventions de cession PI et accords de vesting versionnés.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {documents.map((doc) => (
                  <div key={doc.id} className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">
                          {doc.category.toUpperCase()}
                        </Badge>
                        <span className="text-[11px] font-mono text-slate-500">{doc.current_version}</span>
                      </div>
                      <h4 className="font-bold text-white text-base leading-snug">{doc.title}</h4>
                    </div>
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Statut : Obligatoire</span>
                      <Button variant="outline" size="sm" className="rounded-xl text-xs border-slate-700">
                        Consulter
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: INTELLECTUAL PROPERTY */}
        <TabsContent value="ip" className="mt-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Code className="w-5 h-5 text-purple-400" /> Registre de Propriété Intellectuelle Ecomfy
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs mt-1">
                Actifs logiciels, codes sources, prompts IA, marques et conventions de cession.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-3">
                {ipAssets.map((ip) => (
                  <div key={ip.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                        <Code className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">{ip.asset_name}</h4>
                        <p className="text-xs text-slate-400">Créateur : {ip.creator_name} ➔ Propriétaire Juridique : <strong>{ip.legal_owner}</strong></p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Cédé & Sécurisé
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 6: OFFBOARDING */}
        <TabsContent value="offboarding" className="mt-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <UserX className="w-5 h-5 text-red-400" /> Procédure d'Offboarding & Sortie d'Associé
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs mt-1">
                Protocole sécurisé lors du départ d'un associé (Révocation sessions, gel du vesting, avis juridique requis pour les actions acquises).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                <h4 className="font-bold text-white text-sm">Checklist Obligatoire de Sortie</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Désactivation du compte utilisateur</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Révocation des sessions & tokens</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Restitution des actifs de propriété intellectuelle</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Gel du plan de vesting non acquis</div>
                </div>
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 font-medium">
                  Statut pour les actions acquises : <strong className="underline">LEGAL REVIEW REQUIRED</strong> (Avis et décision juridique nécessaires).
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 7: AUDIT LOGS */}
        <TabsContent value="audit" className="mt-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-400" /> Journal d'Audit Inaltérable
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs mt-1">
                Traçabilité horodatée de toutes les propositions, signatures, activations et événements de gouvernance.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span className="text-indigo-400 font-mono">[{log.action}]</span>
                        <span>{log.target_entity}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">{log.user_email} — IP: {log.ip_address || "127.0.0.1"}</div>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(log.timestamp).toLocaleString("fr-FR")}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG: CREATE PROPOSAL */}
      <Dialog open={isProposalDialogOpen} onOpenChange={setIsProposalDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-emerald-400" /> Nouvelle Proposition Cap Table
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Initier un workflow de proposition de modification d'attribution de participation.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateProposalSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Titre de la Proposition</label>
              <Input
                placeholder="ex: Attribution proposée à Désiré Tano (+5%)"
                value={proposalTitle}
                onChange={(e) => setProposalTitle(e.target.value)}
                required
                className="bg-slate-950 border-slate-800 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Associé Bénéficiaire</label>
              <Select value={beneficiaryId} onValueChange={setBeneficiaryId}>
                <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl">
                  <SelectValue placeholder="Sélectionner un associé" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  {shareholders.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name} ({s.allocation?.target_percentage || 0}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Pourcentage Cible Proposé (%)</label>
              <Input
                type="number"
                step="0.1"
                value={proposedPct}
                onChange={(e) => setProposedPct(parseFloat(e.target.value))}
                required
                className="bg-slate-950 border-slate-800 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Motif & Justification</label>
              <Textarea
                placeholder="Expliquez la raison stratégique de cette modification..."
                value={proposalRationale}
                onChange={(e) => setProposalRationale(e.target.value)}
                required
                className="bg-slate-950 border-slate-800 rounded-xl min-h-[90px]"
              />
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsProposalDialogOpen(false)} className="rounded-xl border-slate-700">
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmittingProposal} className="bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold rounded-xl">
                {isSubmittingProposal ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PlusCircle className="w-4 h-4 mr-2" />}
                Soumettre la Proposal
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
