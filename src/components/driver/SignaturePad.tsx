import { useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SignaturePadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (signatureDataUrl: string) => void;
}

export function SignaturePad({ open, onOpenChange, onSave }: SignaturePadProps) {
  const sigCanvas = useRef<SignatureCanvas>(null);

  const handleClear = () => {
    sigCanvas.current?.clear();
  };

  const handleSave = () => {
    if (sigCanvas.current?.isEmpty()) {
      return;
    }
    const dataUrl = sigCanvas.current?.getTrimmedCanvas().toDataURL("image/png");
    if (dataUrl) {
      onSave(dataUrl);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] w-[95vw] rounded-xl p-4">
        <DialogHeader>
          <DialogTitle>Signature du client</DialogTitle>
        </DialogHeader>
        
        <div className="border-2 border-dashed border-slate-300 rounded-lg overflow-hidden bg-slate-50 my-4 touch-none">
          <SignatureCanvas 
            ref={sigCanvas}
            penColor="black"
            canvasProps={{
              className: "signature-canvas w-full h-48",
            }}
          />
        </div>
        
        <div className="flex justify-between gap-3">
          <Button variant="outline" onClick={handleClear} className="w-1/3">
            Effacer
          </Button>
          <Button onClick={handleSave} className="w-2/3">
            Valider
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
