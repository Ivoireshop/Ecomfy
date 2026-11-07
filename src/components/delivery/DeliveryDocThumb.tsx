import { useEffect, useState } from "react";
import { FileText, ImageOff } from "lucide-react";
import { getDeliveryDocUrls, isPdfPath } from "@/lib/deliveryKycStorage";

/** Pièce du bucket privé affichée via un lien signé de courte durée (jamais d'URL publique). */
export function DeliveryDocThumb({ path, label }: { path?: string | null; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setUrl(null);
    setFailed(false);
    if (!path) return;
    getDeliveryDocUrls([path]).then(([signed]) => {
      if (!active) return;
      if (signed) setUrl(signed);
      else setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [path]);

  return (
    <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-center">
      <span className="text-[10px] text-slate-400 block">{label}</span>
      {!path ? (
        <div className="h-28 bg-slate-900 rounded flex items-center justify-center text-xs text-slate-600">Absente</div>
      ) : failed ? (
        <div className="h-28 bg-slate-900 rounded flex flex-col items-center justify-center gap-1 text-xs text-rose-300">
          <ImageOff className="w-5 h-5" /> Illisible
        </div>
      ) : !url ? (
        <div className="h-28 bg-slate-900 rounded animate-pulse" />
      ) : isPdfPath(path) ? (
        <a href={url} target="_blank" rel="noreferrer" className="h-28 bg-slate-900 rounded flex flex-col items-center justify-center gap-1 text-xs text-emerald-300 hover:bg-slate-800">
          <FileText className="w-6 h-6" /> Ouvrir le PDF
        </a>
      ) : (
        <a href={url} target="_blank" rel="noreferrer" aria-label={`Ouvrir ${label} en grand`}>
          <img src={url} alt={label} className="w-full h-28 object-cover rounded-md border border-slate-800 hover:opacity-90" />
        </a>
      )}
    </div>
  );
}
