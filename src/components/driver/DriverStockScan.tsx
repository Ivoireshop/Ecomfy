import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";
import { CheckCircle2, Circle, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchDeliveryScanStatus, scanProductForDelivery } from "@/lib/driverStockScan";

/**
 * Chargement des colis : le livreur scanne l'étiquette de chaque produit de la commande ; le serveur retire la quantité
 * commandée du stock de la boutique. N'apparaît que si la boutique a activé le stock par QR.
 */
export function DriverStockScan({ deliveryId, canScan }: { deliveryId: string; canScan: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const busyRef = useRef(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const { data } = useQuery({
    queryKey: ["driver-scan-status", deliveryId],
    queryFn: () => fetchDeliveryScanStatus(deliveryId),
  });

  const stopScanner = () => {
    scannerRef.current?.clear().catch(() => {});
    scannerRef.current = null;
  };

  const handleCode = async (raw: string) => {
    const code = raw.trim();
    if (!code || busyRef.current) return;
    busyRef.current = true;
    const res = await scanProductForDelivery(deliveryId, code);
    // Petite pause : la caméra relit le même QR plusieurs fois par seconde.
    setTimeout(() => { busyRef.current = false; }, 1500);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (res.alreadyScanned) toast.info(`${res.productName} : déjà scanné`);
    else if (res.insufficientStock) toast.warning(`${res.productName} ×${res.quantity} chargé — stock boutique insuffisant, prévenez la boutique`);
    else toast.success(`${res.productName} ×${res.quantity} chargé`);
    setManualCode("");
    queryClient.invalidateQueries({ queryKey: ["driver-scan-status", deliveryId] });
  };

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        "driver-stock-reader",
        { fps: 10, qrbox: { width: 220, height: 220 }, supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] },
        false,
      );
      scannerRef.current = scanner;
      scanner.render((text) => { void handleCode(text); }, () => {});
    }, 100);
    return () => { clearTimeout(timer); stopScanner(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!data?.enabled || data.items.length === 0) return null;

  const done = data.items.filter((i) => i.scanned).length;
  const allDone = done === data.items.length;

  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-slate-800 flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-primary" />
          Chargement des colis
        </h2>
        <span className={`text-sm font-bold ${allDone ? "text-green-700" : "text-orange-600"}`}>
          {done}/{data.items.length}
        </span>
      </div>
      <ul className="space-y-2">
        {data.items.map((item) => (
          <li key={item.product_id} className="flex items-center gap-2 text-sm">
            {item.scanned
              ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              : <Circle className="w-5 h-5 text-slate-300 shrink-0" />}
            <span className="flex-1 text-slate-700">{item.name}</span>
            <span className="font-semibold text-slate-900">×{item.quantity}</span>
          </li>
        ))}
      </ul>
      {canScan && !allDone && (
        <Button className="w-full mt-4 rounded-xl" onClick={() => setOpen(true)}>
          <ScanLine className="w-4 h-4 mr-2" />
          Scanner un colis
        </Button>
      )}

      <Dialog open={open} onOpenChange={(o) => { if (!o) { stopScanner(); setOpen(false); } }}>
        <DialogContent className="max-w-sm w-[95vw]">
          <DialogHeader>
            <DialogTitle>Scanner les produits</DialogTitle>
            <DialogDescription>
              Scannez l'étiquette de chaque produit de la commande. Le stock de la boutique est mis à jour à chaque scan.
            </DialogDescription>
          </DialogHeader>
          <div id="driver-stock-reader" className="w-full rounded-xl overflow-hidden" />
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void handleCode(manualCode); }}>
            <Input placeholder="Ou saisir le code (ECP-…)" value={manualCode} onChange={(e) => setManualCode(e.target.value)} />
            <Button type="submit" variant="outline" disabled={!manualCode.trim()}>OK</Button>
          </form>
          <p className="text-xs text-slate-500 text-center">{done}/{data.items.length} produits chargés</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
