import { useState } from "react";
import { Image as ImageIcon } from "lucide-react";

/** Vignette d'un produit : une icône remplace l'image absente ou introuvable dans le stockage. */
export function ProductThumb({ src, lazy }: { src?: string; lazy?: boolean }) {
  // On retient l'adresse en échec : une nouvelle image est de nouveau essayée.
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <ImageIcon className="h-5 w-5 text-muted-foreground/40" aria-label="Aucune image" />
      </div>
    );
  }
  return (
    <img src={src} alt="" loading={lazy ? "lazy" : undefined} className="h-full w-full object-cover" onError={() => setFailed(src)} />
  );
}
