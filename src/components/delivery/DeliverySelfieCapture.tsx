import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadDeliveryDoc, type DeliveryDocField } from "@/lib/deliveryKycStorage";

interface DeliverySelfieCaptureProps {
  field: DeliveryDocField;
  value?: string | null;
  onChange: (path: string) => void;
}

/**
 * Selfie avec la pièce d'identité en main : photo prise à la caméra (ou fichier de repli), déposée dans le bucket privé.
 * Aucune analyse automatique n'est faite ici : la comparaison visage/pièce est réalisée par un humain au back-office.
 */
export function DeliverySelfieCapture({ field, value, onChange }: DeliverySelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null | undefined;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  };
  useEffect(() => stopCamera, []);

  const send = async (blob: Blob, previewUrl: string) => {
    setBusy(true);
    setError(null);
    try {
      const path = await uploadDeliveryDoc(field, blob, "profile_photo");
      setPreview(previewUrl);
      onChange(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  };

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraOn(true);
      }
    } catch {
      setError("Caméra indisponible. Importez plutôt une photo récente de vous tenant votre pièce d'identité.");
    }
  };

  const snap = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return setError("Capture impossible, réessayez.");
      stopCamera();
      void send(blob, canvas.toDataURL("image/jpeg", 0.7));
    }, "image/jpeg", 0.9);
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Camera className="w-4 h-4 text-emerald-400" /> Selfie avec votre pièce d'identité
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Votre visage et votre pièce d'identité ouverte, bien lisibles sur la même photo. Elle est examinée par l'équipe Ecomfy, jamais affichée publiquement.
        </p>
      </div>

      <video ref={videoRef} playsInline muted className={`w-full max-h-72 rounded-xl bg-black ${cameraOn ? "" : "hidden"}`} />
      <canvas ref={canvasRef} className="hidden" />
      {!cameraOn && preview && <img src={preview} alt="Selfie envoyé" className="max-h-56 rounded-xl border border-slate-800" />}

      <div className="flex flex-wrap items-center gap-2">
        {cameraOn ? (
          <>
            <Button type="button" onClick={snap} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs">
              <Camera className="w-4 h-4 mr-1.5" /> Prendre la photo
            </Button>
            <Button type="button" variant="outline" onClick={stopCamera} className="bg-slate-900 hover:text-white border-slate-700 text-slate-300 text-xs">Annuler</Button>
          </>
        ) : (
          <Button type="button" variant="outline" onClick={startCamera} disabled={busy} className="bg-slate-900 hover:text-white border-slate-700 text-slate-200 text-xs">
            {value ? <RefreshCw className="w-4 h-4 mr-1.5" /> : <Camera className="w-4 h-4 mr-1.5" />}
            {value ? "Refaire le selfie" : "Ouvrir la caméra"}
          </Button>
        )}
        {busy && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />}
        {value && !busy && <span className="flex items-center gap-1 text-[11px] text-emerald-300"><CheckCircle2 className="w-4 h-4" /> Selfie envoyé</span>}
      </div>

      {!cameraOn && (
        <div className="space-y-1">
          <p className="text-[11px] text-slate-500">Ou importez une photo :</p>
          <Input
            type="file"
            accept="image/*"
            disabled={busy}
            aria-label="Importer un selfie"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void send(f, URL.createObjectURL(f));
              e.target.value = "";
            }}
            className="max-w-xs bg-slate-900 border-slate-800 text-xs text-slate-300"
          />
        </div>
      )}
      {error && <p role="alert" className="text-[11px] text-rose-300">{error}</p>}
    </div>
  );
}
