import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DocumentCategory, LegalStatus } from "@/types/corporate";
import { PlusCircle, FileText, Loader2 } from "lucide-react";

interface CreateDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: {
    title: string;
    category: DocumentCategory;
    legal_status: LegalStatus;
    summary: string;
    content_markdown: string;
    is_mandatory: boolean;
  }) => Promise<any>;
}

export function CreateDocumentModal({ isOpen, onClose, onCreate }: CreateDocumentModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("governance");
  const [legalStatus, setLegalStatus] = useState<LegalStatus>("INTERNAL POLICY");
  const [summary, setSummary] = useState("");
  const [contentMarkdown, setContentMarkdown] = useState("");
  const [isMandatory, setIsMandatory] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !summary || !contentMarkdown) return;

    setIsSubmitting(true);
    try {
      await onCreate({
        title,
        category,
        legal_status: legalStatus,
        summary,
        content_markdown: contentMarkdown,
        is_mandatory: isMandatory,
      });

      setTitle("");
      setSummary("");
      setContentMarkdown("");
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white rounded-3xl sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-emerald-400" />
            Nouveau Document de Gouvernance Ecomfy
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Rédigez et publiez une nouvelle charte, politique interne ou projet d'accord dans le Centre Documentaire.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300">Titre Officiel du Document</label>
            <Input
              placeholder="ex: Doc 11 — Charte d'Éthique & Sécurité Données"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="bg-slate-950 border-slate-800 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Catégorie</label>
              <Select value={category} onValueChange={(val: any) => setCategory(val)}>
                <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl">
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="governance">Gouvernance</SelectItem>
                  <SelectItem value="shareholders">Actionnariat</SelectItem>
                  <SelectItem value="vesting">Vesting</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                  <SelectItem value="intellectual_property">Propriété Intellectuelle</SelectItem>
                  <SelectItem value="confidentiality">Confidentialité</SelectItem>
                  <SelectItem value="partnership">Partenariat</SelectItem>
                  <SelectItem value="investment">Investissement</SelectItem>
                  <SelectItem value="employment">Sortie / Offboarding</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Statut Juridique Initial</label>
              <Select value={legalStatus} onValueChange={(val: any) => setLegalStatus(val)}>
                <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl">
                  <SelectValue placeholder="Statut juridique" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="DRAFT">Projet / Draft</SelectItem>
                  <SelectItem value="INTERNAL POLICY">Politique Interne</SelectItem>
                  <SelectItem value="APPROVED INTERNALLY">Approuvé Interne</SelectItem>
                  <SelectItem value="READY FOR LEGAL REVIEW">Prêt pour Revue Juridique</SelectItem>
                  <SelectItem value="EXECUTED">Formellement Exécuté</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300">Résumé Synthétique</label>
            <Input
              placeholder="Brève synthèse des objectifs et règles du document..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
              className="bg-slate-950 border-slate-800 rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300">Contenu Légal (Markdown)</label>
            <Textarea
              placeholder="# Article 1 — Objet&#10;&#10;Contenu rédigé du document..."
              value={contentMarkdown}
              onChange={(e) => setContentMarkdown(e.target.value)}
              required
              className="bg-slate-950 border-slate-800 rounded-xl min-h-[140px] font-mono text-xs"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer pt-1">
            <Checkbox checked={isMandatory} onCheckedChange={(val: boolean) => setIsMandatory(val)} />
            <span className="text-slate-300 font-medium">Document obligatoire pour tous les associés</span>
          </label>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl border-slate-700">
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold rounded-xl">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PlusCircle className="w-4 h-4 mr-2" />}
              Publier le Document
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
