import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadDeliveryDoc, type DeliveryDocField } from "@/lib/deliveryKycStorage";
import type { DocumentCategory } from "@/lib/documentValidation";

interface DeliveryDocUploadProps {
  label: string;
  hint?: string;
  field: DeliveryDocField;
  category?: DocumentCategory;
  /** Chemin déjà enregistré dans le bucket privé (ou vide). */
  value?: string | null;
  onChange: (path: string) => void;
  accept?: string;
  required?: boolean;
}

/**
 * Dépose réellement le fichier dans le bucket privé (contrôles de type, taille et résolution avant l'envoi)
 * et renvoie son chemin. Aucune URL temporaire (blob:/data:) n'est jamais enregistrée.
 */
export function DeliveryDocUpload({ label, hint, field, category = "national_id", value, onChange, accept = "image/*,.pdf", required }: DeliveryDocUploadProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);

  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);

  const handle = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const path = await uploadDeliveryDoc(field, file, category);
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
      setPreview(previewRef.current);
      setFileName(file.name);
      onChange(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  };

  const done = !!value;
  return (
    <div className={`p-4 rounded-xl border space-y-2 h-full ${done ? "bg-emerald-950/20 border-emerald-500/30" : "bg-slate-950 border-slate-800"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label className="text-xs font-bold text-white">{label}{required ? " *" : ""}</Label>
          {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
        </div>
        {busy ? (
          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
        ) : done ? (
          <span className="flex items-center gap-1 text-[11px] text-emerald-300 shrink-0"><CheckCircle2 className="w-4 h-4" /> Envoyé</span>
        ) : (
          <Upload className="w-4 h-4 text-slate-500 shrink-0" />
        )}
      </div>

      {preview ? (
        <img src={preview} alt={label} className="h-24 rounded-md border border-slate-800 object-cover" />
      ) : done && fileName ? (
        <p className="text-[11px] text-slate-400 flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {fileName}</p>
      ) : done ? (
        <p className="text-[11px] text-slate-400">Document déjà enregistré. Importez un fichier pour le remplacer.</p>
      ) : null}

      <Input
        type="file"
        accept={accept}
        disabled={busy}
        aria-label={label}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handle(f);
          e.target.value = "";
        }}
        className="bg-slate-900 border-slate-800 text-xs text-slate-300"
      />
      {error && <p role="alert" className="text-[11px] text-rose-300">{error}</p>}
    </div>
  );
}
