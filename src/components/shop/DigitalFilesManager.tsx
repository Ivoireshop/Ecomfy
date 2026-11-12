import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, Trash2, Download, FileText, AlertTriangle } from "lucide-react";
import {
  DIGITAL_MAX_FILES,
  DigitalFile,
  deleteDigitalFile,
  formatFileSize,
  getDownloadLimit,
  listDigitalFiles,
  previewDigitalFile,
  setDownloadLimit,
  uploadDigitalFile,
  validateDigitalFile,
} from "@/lib/digitalProducts";

interface Props {
  productId: string;
  shopId: string;
  /** Produit marqué « numérique » dans l'éditeur (la section n'a de sens que dans ce cas). */
  isDigital: boolean;
}

/** Fichiers vendus d'un produit numérique : dépôt dans un bucket privé, remis à l'acheteur après paiement. */
export function DigitalFilesManager({ productId, shopId, isDigital }: Props) {
  const [files, setFiles] = useState<DigitalFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [limit, setLimit] = useState<string>("5");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [rows, lim] = await Promise.all([listDigitalFiles(productId), getDownloadLimit(productId)]);
        if (cancelled) return;
        setFiles(rows);
        setLimit(lim === null ? "" : String(lim));
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : "Impossible de lire les fichiers.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productId]);

  const handlePick = async (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    setUploading(true);
    let count = files.length;
    try {
      for (const file of Array.from(picked)) {
        const problem = validateDigitalFile(file, count);
        if (problem) { toast.error(`${file.name} : ${problem}`); continue; }
        try {
          const created = await uploadDigitalFile(shopId, productId, file, count);
          setFiles((prev) => [...prev, created]);
          count += 1;
        } catch (e) {
          toast.error(`${file.name} : ${e instanceof Error ? e.message : "échec du dépôt"}`);
        }
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (file: DigitalFile) => {
    if (!window.confirm(`Supprimer « ${file.file_name} » ? Les clients qui l'ont acheté ne pourront plus le télécharger.`)) return;
    try {
      await deleteDigitalFile(file);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression impossible.");
    }
  };

  const handlePreview = async (file: DigitalFile) => {
    try {
      window.open(await previewDigitalFile(file), "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lien indisponible.");
    }
  };

  const saveLimit = async () => {
    const trimmed = limit.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (!Number.isInteger(value) || value < 1 || value > 100)) {
      toast.error("Entrez un nombre entre 1 et 100, ou laissez vide pour illimité.");
      return;
    }
    try {
      await setDownloadLimit(productId, value);
      toast.success("Limite enregistrée.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Limite non enregistrée.");
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>;
  }

  return (
    <div className="space-y-4">
      {!isDigital && (
        <p className="text-xs text-muted-foreground">
          Activez « Produit numérique » dans les options avancées : les fichiers ci-dessous ne sont remis aux clients que pour un produit numérique.
        </p>
      )}
      {isDigital && files.length === 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Aucun fichier : vos clients paieront sans rien recevoir. Ajoutez le fichier, ou gardez ce produit comme service (vous le livrez vous-même).</span>
        </div>
      )}

      {files.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 p-3">
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{f.file_name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(f.file_size)}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label="Télécharger pour vérifier" onClick={() => handlePreview(f)}>
                <Download className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label="Supprimer le fichier" onClick={() => handleDelete(f)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handlePick(e.target.files)} />
        <Button type="button" variant="outline" disabled={uploading || files.length >= DIGITAL_MAX_FILES} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          {uploading ? "Envoi en cours…" : "Ajouter un fichier"}
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          PDF, ZIP, EPUB, Word, Excel, PowerPoint, audio, vidéo, images — 50 Mo par fichier, {DIGITAL_MAX_FILES} fichiers au maximum.
          Les fichiers sont privés : le client les reçoit uniquement après paiement.
        </p>
      </div>

      <div className="flex items-end gap-2 max-w-sm">
        <div className="flex-1 space-y-1.5">
          <label className="text-sm font-medium" htmlFor="digital-limit">Téléchargements par fichier et par commande</label>
          <Input id="digital-limit" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Illimité" className="h-10" />
        </div>
        <Button type="button" variant="secondary" onClick={saveLimit}>Enregistrer</Button>
      </div>
    </div>
  );
}
