import { useParams, Link, useNavigate } from "react";
import { useCorporateGovernance } from "@/hooks/useCorporateGovernance";
import { INITIAL_GOVERNANCE_DOCUMENTS } from "@/data/initialGovernanceDocs";
import { CorporateDocument } from "@/types/corporate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import {
  FileText,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  User,
  Eye,
  FileCheck,
  Loader2,
  ShieldCheck
} from "lucide-react";

export default function GovernanceDocumentPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const { documents, loading, approveDocument, recordDocumentView } = useCorporateGovernance();

  const [checkedRead, setCheckedRead] = useState(false);
  const [checkedAware, setCheckedAware] = useState(false);
  const [checkedLegal, setCheckedLegal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const decodedParam = decodeURIComponent(documentId || "").toLowerCase().trim();

  // Try matching against loaded documents first, or fallback to initial seed docs
  const foundInDocs = documents.find((d) => {
    const idLower = d.id.toLowerCase();
    const titleLower = d.title.toLowerCase();
    return (
      idLower === decodedParam ||
      idLower.includes(decodedParam) ||
      decodedParam.includes(idLower) ||
      titleLower.includes(decodedParam)
    );
  });

  const seedFallback = INITIAL_GOVERNANCE_DOCUMENTS.find((s) => {
    const seedId = s.id.toLowerCase();
    const seedTitle = s.title.toLowerCase();
    return (
      seedId === decodedParam ||
      seedId.includes(decodedParam) ||
      decodedParam.includes(seedId) ||
      seedTitle.includes(decodedParam)
    );
  });

  const doc: CorporateDocument | undefined = foundInDocs || (seedFallback ? {
    id: seedFallback.id,
    title: seedFallback.title,
    category: seedFallback.category,
    legal_status: seedFallback.legal_status,
    summary: seedFallback.summary,
    author: seedFallback.author,
    is_mandatory: seedFallback.is_mandatory,
    target_roles: ["shareholder"],
    current_version: seedFallback.current_version,
    storage_path: null,
    content_markdown: seedFallback.content_markdown,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } : undefined);

  useEffect(() => {
    if (doc) {
      recordDocumentView(doc.id);
    }
  }, [doc?.id]);

  if (loading && !doc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <Loader2 className="w-10 h-10 animate-spin text-[#0E7C66]" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-400" />
        <h2 className="text-xl font-bold">Document non trouvé</h2>
        <p className="text-xs text-slate-400">Le document demandé n'existe pas ou a été déplacé.</p>
        <Button onClick={() => navigate("/corporate-governance")} className="bg-[#0E7C66] text-white font-bold rounded-xl text-xs">
          Retour au Centre Documentaire
        </Button>
      </div>
    );
  }

  const isApproved = !!doc.user_acceptance;

  const handleApproveSubmit = async () => {
    if (!checkedRead || !checkedAware || !checkedLegal) return;
    setIsSubmitting(true);
    try {
      await approveDocument(
        doc.id,
        doc.current_version,
        "J'ai lu, compris et approuvé ce document. Je reconnais que ce document s'interprète avec les statuts et formalités juridiques applicables d'Ecomfy."
      );
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans space-y-6 max-w-5xl mx-auto">
      
      {/* Top Nav Bar */}
      <div className="flex items-center justify-between">
        <Button
          onClick={() => navigate(-1)}
          variant="outline"
          className="border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs"
        >
          <ArrowLeft className="w-4 h-4 mr-2" /> Retour au Centre Documentaire
        </Button>

        <div className="flex items-center gap-2">
          <Badge className="bg-[#0E7C66]/20 text-emerald-400 border border-[#0E7C66]/40 text-xs font-bold uppercase">
            {doc.category}
          </Badge>
          <Badge variant="outline" className="text-slate-400 border-slate-700 text-xs font-mono">
            {doc.current_version}
          </Badge>
        </div>
      </div>

      {/* Header Banner */}
      <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-3">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <FileText className="w-7 h-7 text-emerald-400 shrink-0" />
          {doc.title}
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
          {doc.summary || "Document officiel de gouvernance de la plateforme SaaS Ecomfy."}
        </p>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800">
          <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-amber-400" /> Auteur : {doc.author || "Direction Ecomfy"}</span>
          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-purple-400" /> Mis à jour : {new Date(doc.updated_at).toLocaleDateString("fr-FR")}</span>
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium"><Eye className="w-3.5 h-3.5" /> Consultation Tracée</span>
        </div>
      </Card>

      {/* LEGAL DISCLAIMER BANNER */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 text-xs text-amber-300 space-y-1">
        <div className="font-bold flex items-center gap-2 text-amber-400 text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          AVERTISSEMENT JURIDIQUE & PÉRIMÈTRE LOGICIEL ECOMFY
        </div>
        <p className="text-amber-200/80 leading-relaxed">
          Ce document constitue un document de gouvernance, une politique interne ou un projet d'accord d'Ecomfy selon son statut. 
          <strong> Il ne remplace pas les statuts, actes sociaux, contrats ou formalités légalement requis.</strong> 
          Lorsque nécessaire, il doit être soumis à une revue juridique professionnelle avant signature ou mise en œuvre.
        </p>
      </div>

      {/* DOCUMENT MARKDOWN CONTENT */}
      <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl text-slate-200 text-xs sm:text-sm leading-relaxed font-sans whitespace-pre-wrap">
        {doc.content_markdown || "Contenu du document non disponible."}
      </Card>

      {/* APPROVAL CARD */}
      {isApproved ? (
        <Card className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 space-y-2">
          <div className="flex items-center gap-2 font-bold text-base">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            Document Lu et Approuvé
          </div>
          <p className="text-xs text-emerald-300">
            Vous avez validé ce document le {new Date(doc.user_acceptance?.timestamp || Date.now()).toLocaleString("fr-FR")}.
          </p>
          <div className="text-xs font-mono text-slate-400 pt-1">
            Déclaration enregistrée : "{doc.user_acceptance?.legal_statement}"
          </div>
        </Card>
      ) : (
        <Card className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-emerald-400" />
            Formulaire d'Engagement & Signature Électronique
          </h3>

          <div className="space-y-3 text-xs text-slate-300">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox id="chk-read" checked={checkedRead} onCheckedChange={(val: boolean) => setCheckedRead(val)} className="mt-0.5" />
              <span>J'ai lu l'intégralité de ce document de gouvernance.</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox id="chk-aware" checked={checkedAware} onCheckedChange={(val: boolean) => setCheckedAware(val)} className="mt-0.5" />
              <span>Je reconnais avoir pris connaissance de son contenu et de ses règles d'application.</span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox id="chk-legal" checked={checkedLegal} onCheckedChange={(val: boolean) => setCheckedLegal(val)} className="mt-0.5" />
              <span>Je comprends que ce document s'interprète avec les statuts et formalités juridiques applicables d'Ecomfy.</span>
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleApproveSubmit}
              disabled={!checkedRead || !checkedAware || !checkedLegal || isSubmitting}
              className="bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold rounded-xl px-6 py-3 shadow-lg text-xs"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileCheck className="w-4 h-4 mr-2" />}
              LIRE ET APPROUVER CE DOCUMENT
            </Button>
          </div>
        </Card>
      )}

    </div>
  );
}
