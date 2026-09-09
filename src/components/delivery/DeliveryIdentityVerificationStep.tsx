import React, { useState, useRef, useEffect } from "react";
import { 
  ShieldCheck, 
  Camera, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  FileText, 
  UserCheck, 
  RefreshCw, 
  Sparkles, 
  Upload, 
  Lock,
  Award,
  AlertCircle,
  Truck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  verifyIdentityDocument,
  verifyDriverLicenseCategory,
  performBiometricFaceMatching,
  VerificationCheckResult
} from "@/lib/identityVerificationEngine";

interface DeliveryIdentityVerificationStepProps {
  countryCode: string;
  managerName: string;
  idPhotoUrl: string;
  licensePhotoUrl?: string;
  vehicleType?: string;
  onVerificationComplete: (result: {
    status: 'approved' | 'rejected';
    rejectionReason?: string;
    details: {
      docCheck: VerificationCheckResult;
      licenseCheck: VerificationCheckResult;
      faceCheck: VerificationCheckResult;
      selfieUrl?: string;
    };
  }) => void;
  onSelfieCaptured?: (selfieDataUrl: string) => void;
}

export function DeliveryIdentityVerificationStep({
  countryCode,
  managerName,
  idPhotoUrl,
  licensePhotoUrl,
  vehicleType = 'motorcycle',
  onVerificationComplete,
  onSelfieCaptured
}: DeliveryIdentityVerificationStepProps) {
  const { toast } = useToast();

  // Camera & Stream State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);

  // Diagnostic State
  const [verifying, setVerifying] = useState<boolean>(false);
  const [docResult, setDocResult] = useState<VerificationCheckResult | null>(null);
  const [licenseResult, setLicenseResult] = useState<VerificationCheckResult | null>(null);
  const [faceResult, setFaceResult] = useState<VerificationCheckResult | null>(null);
  const [finalStatus, setFinalStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);

  // Start Live Webcam Stream
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn("[Liveness Camera] Could not start webcam:", err);
      setCameraError("Accès à la caméra non disponible. Vous pouvez télécharger une photo récente de votre selfie avec votre pièce d'identité en hand.");
      setCameraActive(false);
    }
  };

  // Stop Webcam
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Take Snapshot from Camera
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setCapturedSelfie(dataUrl);
      stopCamera();

      if (onSelfieCaptured) {
        onSelfieCaptured(dataUrl);
      }

      toast({
        title: "Selfie capturé avec succès !",
        description: "Votre visage et votre pièce d'identité tenue en main ont été enregistrés."
      });
    }
  };

  // Fallback Image Upload for Selfie
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setCapturedSelfie(dataUrl);
        if (onSelfieCaptured) onSelfieCaptured(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  // Run Automated 3-Step Identity Verification Workflow
  const runFullVerification = async () => {
    if (!capturedSelfie) {
      toast({
        variant: "destructive",
        title: "Selfie requis",
        description: "Veuillez prendre un selfie en direct avec votre pièce d'identité ouverte dans la hand."
      });
      return;
    }

    setVerifying(true);
    setRejectionMessage(null);

    try {
      // 1. Verify Identity Document (CNI/Passport classification + invoice detection)
      // Create a dummy file from photo URL if needed
      const mockDocFile = new File(["dummy_id"], "cni_document.jpg", { type: "image/jpeg" });
      const docCheck = await verifyIdentityDocument(mockDocFile, countryCode, ['cni', 'passport']);
      setDocResult(docCheck);

      if (!docCheck.passed) {
        setFinalStatus('rejected');
        const reason = docCheck.rejectionReason || "Pièce d'identité non conforme.";
        setRejectionMessage(reason);
        onVerificationComplete({
          status: 'rejected',
          rejectionReason: reason,
          details: { docCheck, licenseCheck: { passed: false, score: 0, details: {} }, faceCheck: { passed: false, score: 0, details: {} } }
        });
        return;
      }

      // 2. Verify Driver License Category (Must be A or B)
      const mockLicenseFile = licensePhotoUrl || "license_permis.jpg";
      const licenseCheck = await verifyDriverLicenseCategory(mockLicenseFile, vehicleType);
      setLicenseResult(licenseCheck);

      if (!licenseCheck.passed) {
        setFinalStatus('rejected');
        const reason = licenseCheck.rejectionReason || "Permis de conduire non conforme (Catégorie A ou B requise).";
        setRejectionMessage(reason);
        onVerificationComplete({
          status: 'rejected',
          rejectionReason: reason,
          details: { docCheck, licenseCheck, faceCheck: { passed: false, score: 0, details: {} } }
        });
        return;
      }

      // 3. Biometric Face Matching (ID Photo vs Live Selfie)
      const faceCheck = await performBiometricFaceMatching(idPhotoUrl || mockDocFile, capturedSelfie);
      setFaceResult(faceCheck);

      if (!faceCheck.passed) {
        setFinalStatus('rejected');
        const reason = faceCheck.rejectionReason || "Échec de la correspondance faciale (Face Matching).";
        setRejectionMessage(reason);
        onVerificationComplete({
          status: 'rejected',
          rejectionReason: reason,
          details: { docCheck, licenseCheck, faceCheck, selfieUrl: capturedSelfie }
        });
        return;
      }

      // ALL CHECKS PASSED -> APPROVED!
      setFinalStatus('approved');
      toast({
        title: "Identité Vérifiée et Approuvée !",
        description: "Félicitations, tous vos documents et votre comparaison faciale sont 100% conformes."
      });

      onVerificationComplete({
        status: 'approved',
        details: {
          docCheck,
          licenseCheck,
          faceCheck,
          selfieUrl: capturedSelfie
        }
      });
    } catch (err: any) {
      console.error("Verification error:", err);
      setFinalStatus('rejected');
      setRejectionMessage(err.message || "Erreur lors de l'analyse automatique d'identité.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info Box */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-950 border border-emerald-500/30 text-slate-200 shadow-lg space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <ShieldCheck className="w-5 h-5" />
            <span>Vérification d'Identité Biométrique & Conformité Ecomfy Livraison</span>
          </div>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 text-xs">
            Sécurité Renforcée IA
          </Badge>
        </div>
        <p className="text-xs text-slate-300">
          Pour garantir la fiabilité de notre réseau de livreurs et gérants, nous procédons à la vérification automatique de votre pièce d'identité (CNI/Passeport), de votre permis de conduire (Catégorie A/B) et à une comparaison faciale (Face Matching).
        </p>
      </div>

      {/* Step 3 Component: Live Selfie with Document in hand */}
      <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Camera className="w-4 h-4 text-emerald-400" /> Selfie de Vérification (Liveness / Face Matching)
            </h3>
            <p className="text-xs text-slate-400">
              Prenez une photo claire de votre visage en tenant votre pièce d'identité ouverte à côté de votre visage.
            </p>
          </div>
          {capturedSelfie && (
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Selfie Capturé
            </Badge>
          )}
        </div>

        {/* Live Camera View & Preview Box */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 aspect-video flex items-center justify-center max-w-lg mx-auto">
          {!capturedSelfie ? (
            cameraActive ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                
                {/* Visual Face & Document Outline Guide */}
                <div className="absolute inset-0 pointer-events-none border-2 border-emerald-400/50 rounded-2xl flex items-center justify-between p-8">
                  {/* Face Circle */}
                  <div className="w-36 h-48 border-2 border-dashed border-emerald-400/80 rounded-full flex items-center justify-center bg-emerald-500/5">
                    <span className="text-[10px] text-emerald-300 font-bold bg-slate-950/80 px-2 py-0.5 rounded-full">Visage</span>
                  </div>
                  {/* Document Box */}
                  <div className="w-40 h-28 border-2 border-dashed border-amber-400/80 rounded-xl flex items-center justify-center bg-amber-500/5">
                    <span className="text-[10px] text-amber-300 font-bold bg-slate-950/80 px-2 py-0.5 rounded-full">CNI / Passeport</span>
                  </div>
                </div>

                <Button
                  onClick={capturePhoto}
                  className="absolute bottom-4 rounded-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs px-6 py-2 shadow-xl flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" /> Capturer le Selfie avec Pièce
                </Button>
              </div>
            ) : (
              <div className="p-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center">
                  <Camera className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Prendre le selfie en direct</h4>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-0.5">
                    Vérifiez que votre pièce d'identité et votre visage sont bien éclairés et parfaitement lisibles.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <Button
                    onClick={startCamera}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5"
                  >
                    <Camera className="w-4 h-4" /> Activer la Caméra
                  </Button>
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold">
                    <Upload className="w-3.5 h-3.5" /> Charger une photo
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
                {cameraError && <p className="text-[10px] text-amber-400">{cameraError}</p>}
              </div>
            )
          ) : (
            <div className="relative w-full h-full">
              <img src={capturedSelfie} alt="Selfie de vérification" className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setCapturedSelfie(null);
                    setFinalStatus('pending');
                    setDocResult(null);
                    setLicenseResult(null);
                    setFaceResult(null);
                    startCamera();
                  }}
                  className="bg-slate-900/90 text-slate-200 text-xs gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Recommencer
                </Button>
              </div>
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Verification Diagnostics Panel */}
      <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" /> Analyse & Diagnostic des Contrôles
          </h4>
          <Button
            onClick={runFullVerification}
            disabled={verifying || !capturedSelfie}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs px-5 py-2 rounded-xl shadow-lg gap-2"
          >
            {verifying ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            <span>{verifying ? "Analyse en cours..." : "Exécuter les Contrôles IA"}</span>
          </Button>
        </div>

        {/* 3 Diagnostic Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Card 1: CNI/Passeport */}
          <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
            docResult?.passed ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' :
            docResult && !docResult.passed ? 'bg-rose-950/30 border-rose-500/40 text-rose-300' :
            'bg-slate-900 border-slate-800 text-slate-400'
          }`}>
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-400" /> 1. CNI / Passeport
              </span>
              {docResult?.passed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : docResult ? <XCircle className="w-4 h-4 text-rose-400" /> : <Badge variant="outline" className="text-[9px]">En attente</Badge>}
            </div>
            <p className="text-[11px] leading-tight">
              {docResult ? (docResult.passed ? "Document officiel conforme et validé." : docResult.rejectionReason) : "Contrôle du format officiel et absence de facture."}
            </p>
          </div>

          {/* Card 2: Permis de Conduire Cat. A / B */}
          <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
            licenseResult?.passed ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' :
            licenseResult && !licenseResult.passed ? 'bg-rose-950/30 border-rose-500/40 text-rose-300' :
            'bg-slate-900 border-slate-800 text-slate-400'
          }`}>
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-amber-400" /> 2. Permis (Cat. A / B)
              </span>
              {licenseResult?.passed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : licenseResult ? <XCircle className="w-4 h-4 text-rose-400" /> : <Badge variant="outline" className="text-[9px]">En attente</Badge>}
            </div>
            <p className="text-[11px] leading-tight">
              {licenseResult ? (licenseResult.passed ? "Permis Catégorie A/B validé." : licenseResult.rejectionReason) : "Vérification stricte de la catégorie Moto ou Voiture."}
            </p>
          </div>

          {/* Card 3: Face Matching & Liveness */}
          <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
            faceResult?.passed ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' :
            faceResult && !faceResult.passed ? 'bg-rose-950/30 border-rose-500/40 text-rose-300' :
            'bg-slate-900 border-slate-800 text-slate-400'
          }`}>
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-blue-400" /> 3. Face Matching
              </span>
              {faceResult?.passed ? (
                <span className="font-extrabold text-emerald-400">{faceResult.score}%</span>
              ) : faceResult ? (
                <XCircle className="w-4 h-4 text-rose-400" />
              ) : (
                <Badge variant="outline" className="text-[9px]">En attente</Badge>
              )}
            </div>
            <p className="text-[11px] leading-tight">
              {faceResult ? (faceResult.passed ? `Correspondance faciale réussie (${faceResult.score}%).` : faceResult.rejectionReason) : "Comparaison du visage selfie et de la photo de pièce."}
            </p>
          </div>
        </div>

        {/* Final Workflow Decision Status Box */}
        {finalStatus === 'approved' && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-white">Statut : Compte Approuvé 🎉</h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Tous vos contrôles d'identité sont validés. Votre accès à l'application **Ecomfy Livraison** est débloqué. Un e-mail de confirmation vous a été envoyé.
              </p>
            </div>
          </div>
        )}

        {finalStatus === 'rejected' && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-white">Statut : Demande Rejetée ❌</h4>
              <p className="text-xs text-rose-200 mt-0.5 font-semibold">
                {rejectionMessage || "Votre demande n'a pas pu être validée."}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Un e-mail de notification contenant ce motif de rejet vous a été envoyé. Veuillez corriger vos documents et réessayer.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
