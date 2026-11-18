import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";
import { Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { lookupProductByStockQr, recordStockMovement, type ScannedProduct } from "@/lib/stockQr";

interface StockQrScannerProps {
  open: boolean;
  shopId: string;
  onClose: () => void;
  /** Appelé après un mouvement enregistré, pour rafraîchir la liste des produits. */
  onStockChanged?: () => void;
}

/** Scanne le QR d'un produit puis enregistre une entrée ou une sortie de stock (journal stock_movements). */
export function StockQrScanner({ open, shopId, onClose, onStockChanged }: StockQrScannerProps) {
  const [product, setProduct] = useState<ScannedProduct | null>(null);
  const [delta, setDelta] = useState(1);
  const [manualCode, setManualCode] = useState("");
  const [busy, setBusy] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const stopScanner = () => {
    scannerRef.current?.clear().catch(() => {});
    scannerRef.current = null;
  };

  const lookup = async (raw: string) => {
    const code = raw.trim();
    if (!code || busy) return;
    setBusy(true);
    const found = await lookupProductByStockQr(code);
    setBusy(false);
    if (!found || found.shop_id !== shopId) {
      toast({ title: "QR code inconnu", description: "Ce code n'appartient à aucun produit de cette boutique.", variant: "destructive" });
      return;
    }
    stopScanner();
    setProduct(found);
    setDelta(1);
  };

  useEffect(() => {
    if (!open || product) return;
    const timer = setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        "stock-qr-reader",
        { fps: 10, qrbox: { width: 220, height: 220 }, supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] },
        false,
      );
      scannerRef.current = scanner;
      scanner.render((text) => { void lookup(text); }, () => {});
    }, 100);
    return () => { clearTimeout(timer); stopScanner(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product]);

  const close = () => {
    stopScanner();
    setProduct(null);
    setManualCode("");
    onClose();
  };

  const apply = async (kind: "in" | "out" | "return") => {
    if (!product || delta < 1) return;
    setBusy(true);
    const res = await recordStockMovement({
      shopId: product.shop_id,
      productId: product.product_id,
      type: kind === "in" ? "restock" : kind === "out" ? "adjustment" : "return_restock",
      quantity: kind === "out" ? -delta : delta,
      notes: kind === "return" ? "Retour client (scan QR)" : "Scan QR stock",
    });
    setBusy(false);
    if (!res.ok) {
      toast({ title: "Erreur", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: `Stock mis à jour : ${res.newStock}` });
    setProduct({ ...product, stock_quantity: res.newStock });
    onStockChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Scanner le stock</DialogTitle>
          <DialogDescription>Scannez l'étiquette d'un produit pour ajouter ou retirer des unités.</DialogDescription>
        </DialogHeader>

        {!product ? (
          <div className="space-y-3">
            <div id="stock-qr-reader" className="w-full rounded-xl overflow-hidden" />
            <form
              className="flex gap-2"
              onSubmit={(e) => { e.preventDefault(); void lookup(manualCode); }}
            >
              <Input placeholder="Ou saisir le code (ECP-…)" value={manualCode} onChange={(e) => setManualCode(e.target.value)} />
              <Button type="submit" variant="outline" disabled={busy || !manualCode.trim()}>OK</Button>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <p className="font-bold">{product.name}</p>
              {product.sku && <p className="text-xs text-muted-foreground">{product.sku}</p>}
              <p className="mt-2 text-3xl font-bold">{product.stock_quantity}</p>
              <p className="text-xs text-muted-foreground">en stock</p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="icon" aria-label="Moins" onClick={() => setDelta((d) => Math.max(1, d - 1))}><Minus className="h-4 w-4" /></Button>
              <Input
                type="number" min={1} value={delta} className="w-24 text-center"
                onChange={(e) => setDelta(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
              />
              <Button variant="outline" size="icon" aria-label="Plus" onClick={() => setDelta((d) => d + 1)}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={busy} onClick={() => apply("out")}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Retirer ${delta}`}
              </Button>
              <Button disabled={busy} onClick={() => apply("in")}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Ajouter ${delta}`}
              </Button>
            </div>
            <Button variant="secondary" className="w-full" disabled={busy} onClick={() => apply("return")}>
              Retour client : remettre {delta} en stock
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setProduct(null)}>Scanner un autre produit</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
