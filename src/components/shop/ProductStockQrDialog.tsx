import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getProductStockQr } from "@/lib/stockQr";

interface ProductStockQrDialogProps {
  product: { id: string; name: string; sku?: string | null } | null;
  onClose: () => void;
}

/** QR code de stock d'un produit : le code est généré côté base à la première ouverture, puis réutilisé. */
export function ProductStockQrDialog({ product, onClose }: ProductStockQrDialogProps) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const productId = product?.id;

  useEffect(() => {
    setCode(null);
    setError(null);
    if (!productId) return;
    let cancelled = false;
    (async () => {
      const res = await getProductStockQr(productId);
      if (cancelled) return;
      if (res.disabled) {
        setError("Activez d'abord « Stock par QR code » dans les paramètres de la boutique.");
        return;
      }
      if (!res.code) {
        setError("Impossible de générer le QR code. Réessayez.");
        return;
      }
      setCode(res.code);
    })();
    return () => { cancelled = true; };
  }, [productId]);

  const print = () => {
    const svg = labelRef.current?.querySelector("svg");
    if (!svg || !product || !code) return;
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
    const w = window.open("", "_blank", "width=420,height=560");
    if (!w) return;
    w.document.write(
      `<!doctype html><title>${esc(product.name)}</title><body style="font-family:sans-serif;text-align:center;margin:24px">` +
        `<div style="width:260px;margin:0 auto">${svg.outerHTML}</div>` +
        `<p style="font-weight:700;font-size:16px;margin:12px 0 2px">${esc(product.name)}</p>` +
        (product.sku ? `<p style="font-size:12px;margin:0">${esc(product.sku)}</p>` : "") +
        `<p style="font-family:monospace;font-size:13px;margin:6px 0">${esc(code)}</p>` +
        `<script>window.onload=()=>{window.print()}</scr` + `ipt></body>`,
    );
    w.document.close();
  };

  return (
    <Dialog open={!!product} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>QR code stock</DialogTitle>
          <DialogDescription>
            Collez cette étiquette sur le produit ou son carton. Scannez-la pour ajuster le stock en un geste.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2" ref={labelRef}>
          {error ? (
            <p className="text-sm text-destructive text-center">{error}</p>
          ) : !code ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div className="bg-white p-3 rounded-xl border">
                <QRCode value={code} size={200} />
              </div>
              <p className="font-semibold text-center">{product?.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{code}</p>
            </>
          )}
        </div>
        <Button onClick={print} disabled={!code} className="gap-2">
          <Printer className="h-4 w-4" /> Imprimer l'étiquette
        </Button>
      </DialogContent>
    </Dialog>
  );
}
