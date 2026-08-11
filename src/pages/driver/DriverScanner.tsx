import { useEffect, useRef, useState } from "react";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function DriverScanner() {
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, []);

  const startScanner = () => {
    setIsScanning(true);
    
    // Slight delay to ensure the DOM element #reader is rendered
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        },
        /* verbose= */ false
      );
      
      scannerRef.current = scanner;
      
      scanner.render(
        (decodedText) => {
          // Success
          scanner.clear();
          setIsScanning(false);
          
          // Try to extract an ID from the text (could be a direct UUID or a URL)
          let deliveryId = decodedText;
          
          // Simple URL parser check (if the QR is a link)
          if (decodedText.includes('/')) {
            const parts = decodedText.split('/');
            deliveryId = parts[parts.length - 1];
          }

          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(deliveryId)) {
            toast.success("Colis scanné avec succès");
            navigate(`/delivery/driver/mission/${deliveryId}`);
          } else {
            toast.error("Code QR invalide pour une livraison");
          }
        },
        (error) => {
          // Ignore frequent failure errors, only log if critical
        }
      );
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
    }
    setIsScanning(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
      {!isScanning ? (
        <div className="text-center space-y-6">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Camera className="w-12 h-12 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Scanner un colis</h2>
            <p className="text-slate-500 mt-2 max-w-[280px] mx-auto">
              Placez le QR Code du colis dans le cadre pour l'identifier automatiquement.
            </p>
          </div>
          <Button onClick={startScanner} size="lg" className="w-full h-14 text-lg rounded-xl">
            Ouvrir la caméra
          </Button>
        </div>
      ) : (
        <div className="w-full max-w-sm flex flex-col items-center">
          <div id="reader" className="w-full rounded-2xl overflow-hidden shadow-lg border border-slate-200 bg-black" />
          <Button 
            variant="outline" 
            onClick={stopScanner}
            className="mt-6 w-full rounded-xl flex items-center gap-2"
          >
            <X className="w-5 h-5" />
            Annuler
          </Button>
        </div>
      )}
    </div>
  );
}
