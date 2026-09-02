import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CorporateDocument } from "@/types/corporate";
import {
  FileCheck,
  AlertTriangle,
  Clock,
  ShieldCheck,
  User,
  Loader2,
  CheckCircle2,
  Download,
  Share2,
  Eye,
  FileText,
  Lock
} from "lucide-react";

interface GovernanceDocumentViewerModalProps {
  document: CorporateDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (docId: string, version: string, statement: string) => Promise<void>;
  onRecordView: (docId: string) => void;
}

export function GovernanceDocumentViewerModal({
  document,
  isOpen,
  onClose,
  onApprove,
  onRecordView,
}: GovernanceDocumentViewerModalProps) {
  const [checkedRead, setCheckedRead] = useState(false);
  const [checkedAware, setCheckedAware] = useState(false);
  const [checkedLegal, setCheckedLegal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && document) {
      onRecordView(document.id);
      setCheckedRead(false);
      setCheckedAware(false);
      setCheckedLegal(false);
    }
  }, [isOpen, document?.id]);

  if (!document) return null;

  const isApproved = !!document.user_acceptance;

  const handleApproveSubmit = async () => {
    if (!checkedRead || !checkedAware || !checkedLegal) return;
    setIsSubmitting(true);
    try {
      await onApprove(
        document.id,
        document.current_version,
        "J'ai lu, compris et approuvé ce document. Je reconnais que ce document s'interprète avec les statuts et formalités juridiques applicables d'Ecomfy."
      );
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getLegalStatusBadge = (status?: string) => {
    switch (status) {
      case "APPROVED INTERNALLY":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">Approuvé Interne</Badge>;
      case "INTERNAL POLICY":
        return <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">Politique Interne</Badge>;
      case "DRAFT":
        return <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30">Projet / Draft</Badge>;
      case "READY FOR LEGAL REVIEW":
        return <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30">Prêt pour Revue Juridique</Badge>;
      case "EXECUTED":
        return <Badge className="bg-emerald-600 text-white font-extrabold">Formellement Signé & Exécuté</Badge>;
      default:
        return <Badge className="bg-slate-800 text-slate-300 border border-slate-700">Document Gouvernance</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="bg-slate-950 border-slate-800 text-white rounded-3xl max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
        
        {/* Modal Header */}
        <div className="p-6 bg-slate-900 border-b border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#0E7C66]/20 text-emerald-400 border border-[#0E7C66]/40 text-xs font-bold uppercase">
                {document.category}
              </Badge>
              {getLegalStatusBadge(document.legal_status)}
              <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                Version {document.current_version}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Eye className="w-3.5 h-3.5 text-blue-400" /> Vue Enregistrée (VIEWED)
            </div>
          </div>

          <DialogTitle className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-400 shrink-0" />
            {document.title}
          </DialogTitle>

          <DialogDescription className="text-xs text-slate-400 flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-amber-400" /> Auteur : {document.author || "Direction Ecomfy"}</span>
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-purple-400" /> Mis à jour : {new Date(document.updated_at).toLocaleDateString("fr-FR")}</span>
          </DialogDescription>
        </div>

        {/* Modal Scrollable Body - Native smooth overflow-y-auto */}
        <div className="flex-1 overflow-y-auto max-h-[calc(85vh-140px)] p-4 sm:p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-950">
          
          {/* LEGAL DISCLAIMER BANNER */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-300 space-y-1">
            <div className="font-bold flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              AVERTISSEMENT JURIDIQUE & PÉRIMÈTRE LOGICIEL ECOMFY
            </div>
            <p className="text-amber-200/80 leading-relaxed text-[11px]">
              Ce document constitue un document de gouvernance, une politique interne ou un projet d'accord d'Ecomfy selon son statut. 
              <strong> Il ne remplace pas les statuts, actes sociaux, contrats ou formalités légalement requis.</strong> 
              Lorsque nécessaire, il doit être soumis à une revue juridique professionnelle avant signature ou mise en œuvre.
            </p>
          </div>

          {/* DOCUMENT MARKDOWN CONTENT */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 text-slate-200 text-xs sm:text-sm leading-relaxed font-sans space-y-4 whitespace-pre-wrap select-text">
            {document.content_markdown || "Contenu du document non disponible."}
          </div>

          {/* APPROVAL SECTION OR STATUS */}
          {isApproved ? (
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Document Lu et Approuvé
              </div>
              <p className="text-xs text-emerald-300/80">
                Vous avez validé ce document le {new Date(document.user_acceptance?.timestamp || Date.now()).toLocaleString("fr-FR")}.
              </p>
              <div className="text-[11px] font-mono text-slate-400">
                Déclaration : "{document.user_acceptance?.legal_statement}"
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h4 className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                Formulaire d'Engagement & Signature Électronique
              </h4>

              <div className="space-y-2.5 text-xs text-slate-300">
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
                  className="bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold rounded-xl px-6 py-2.5 shadow-lg text-xs"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileCheck className="w-4 h-4 mr-2" />}
                  LIRE ET APPROUVER CE DOCUMENT
                </Button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <DialogFooter className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between sm:justify-between gap-4">
          <span className="text-[11px] text-slate-400 font-mono truncate">
            Réf: {document.id} | Horodatage sécurisé
          </span>
          <Button
            type="button"
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl px-6 py-2.5 text-xs border border-slate-600 shadow-md transition-all shrink-0"
          >
            Fermer la page
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
