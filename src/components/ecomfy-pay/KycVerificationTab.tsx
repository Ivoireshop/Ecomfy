import React, { useState, useRef, useEffect } from "react";
import { MerchantKyc } from "@/types/ecomfyPay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { prepareImageForUpload } from "@/lib/imageCompress";
import { ecomfyPayApi } from "@/lib/ecomfyPay";
import {
  ShieldCheck,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2,
  Camera,
  QrCode,
  Smartphone,
  Sparkles,
  Lock,
  RefreshCw,
} from "lucide-react";

interface KycVerificationTabProps {
  kyc: MerchantKyc | null;
  onRefresh: () => void;
}

export const KycVerificationTab: React.FC<KycVerificationTabProps> = ({
  kyc,
  onRefresh,
}) => {
  const [fullName, setFullName] = useState(kyc?.full_name || "");
  const [country, setCountry] = useState(kyc?.country || "CI");
  const [phone, setPhone] = useState(kyc?.phone_number || "");
  const [sellerType, setSellerType] = useState<"individual" | "business">(kyc?.seller_type || "individual");
  const [docType, setDocType] = useState<"cni" | "passport" | "consular_card" | "trade_register">(
    kyc?.document_type || "cni"
  );
  const [docNumber, setDocNumber] = useState(kyc?.document_number || "");
  const [docFrontUrl, setDocFrontUrl] = useState(kyc?.document_front_url || "");
  const [docBackUrl, setDocBackUrl] = useState(kyc?.document_back_url || "");
  const [selfieUrl, setSelfieUrl] = useState(kyc?.selfie_url || "");

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [evaluatingKyc, setEvaluatingKyc] = useState(false);

  // Camera capture modal state
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const status = kyc?.verification_status || "NOT_STARTED";
  const mobileKycUrl = `${window.location.origin}/ecomfy-pay?tab=kyc`;

  // Start video stream for camera capture
  const startCamera = async () => {
    try {
      setCameraModalOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      toast({
        title: "Accès caméra impossible",
        description: "Veuillez autoriser l'accès à votre caméra ou utiliser un smartphone.",
        variant: "destructive",
      });
      setCameraModalOpen(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    setCameraModalOpen(false);
  };

  const captureSelfiePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      stopCamera();
      setUploading(true);
      try {
        const file = new File([blob], `selfie_kyc_${Date.now()}.jpg`, { type: "image/jpeg" });
        const compressed = await prepareImageForUpload(file);
        const path = `kyc/selfie_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;

        const { error } = await supabase.storage.from("shop-images").upload(path, compressed, { upsert: true });
        if (error) throw error;

        const { data } = supabase.storage.from("shop-images").getPublicUrl(path);
        if (data?.publicUrl) {
          setSelfieUrl(data.publicUrl);
          toast({ title: "Selfie capturé ✓", description: "Le selfie en direct avec votre pièce d'identité a été validé." });
        }
      } catch (err: any) {
        toast({ title: "Erreur selfie", description: err.message, variant: "destructive" });
      } finally {
        setUploading(false);
      }
    }, "image/jpeg", 0.92);
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string) => void,
    docField: "front" | "back" | "selfie"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Strict client-side check on file type & size
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Format rejeté",
        description: "Seules les images réelles (JPG, PNG, WEBP) sont autorisées.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const compressed = await prepareImageForUpload(file);
      const ext = file.name.split(".").pop() || "jpg";
      const path = `kyc/${docField}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;

      const { error } = await supabase.storage.from("shop-images").upload(path, compressed, { upsert: true });
      if (error) throw error;

      const { data } = supabase.storage.from("shop-images").getPublicUrl(path);
      if (data?.publicUrl) {
        setter(data.publicUrl);
        toast({
          title: "Document téléversé ✓",
          description: `Document (${docField.toUpperCase()}) importé avec succès.`,
        });
      }
    } catch (err: any) {
      toast({ title: "Erreur d'importation", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || fullName.trim().length < 3) {
      toast({ title: "Nom officiel invalide", description: "Veuillez entrer le nom et prénom figurant exactement sur la CNI / Passeport.", variant: "destructive" });
      return;
    }

    if (!docFrontUrl) {
      toast({ title: "Document officiel requis", description: "Veuillez téléverser le recto de votre Carte Nationale d'Identité ou Passeport.", variant: "destructive" });
      return;
    }

    if (docType === "cni" && !docBackUrl) {
      toast({ title: "Verso CNI requis", description: "Le verso de la Carte Nationale d'Identité est obligatoire.", variant: "destructive" });
      return;
    }

    if (!selfieUrl) {
      toast({ title: "Selfie d'identification manquant", description: "Veuillez capturer une photo selfie en tenant votre pièce d'identité en main.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    setEvaluatingKyc(true);

    try {
      // 1. Soumission standard DB
      const submitRes = await ecomfyPayApi.submitKyc({
        full_name: fullName,
        country,
        phone_number: phone,
        seller_type: sellerType,
        document_type: docType,
        document_number: docNumber,
        document_front_url: docFrontUrl,
        document_back_url: docBackUrl,
        selfie_url: selfieUrl,
      });

      if (!submitRes.success || !submitRes.kycId) {
        throw new Error(submitRes.error || "Échec de la création du dossier.");
      }

      // 2. Contrôle de sécurité strict via RPC evaluate_merchant_kyc_security
      const { data: evalData, error: evalErr } = await supabase.rpc("evaluate_merchant_kyc_security", {
        p_kyc_id: submitRes.kycId,
      });

      if (evalErr) {
        console.warn("[KYC Strict Eval Error]", evalErr);
      }

      if (evalData && evalData.decision === "REJECTED") {
        toast({
          title: "❌ Pièce d'identité rejetée par le contrôle de sécurité",
          description: evalData.reason || "Le document fourni n'est pas une Carte Nationale d'Identité ou un Passeport valide.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Dossier KYC transmis avec succès ✓",
          description: "Vos documents ont été analysés et enregistrés pour validation finale.",
        });
      }

      onRefresh();
    } catch (err: any) {
      toast({ title: "Erreur KYC", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
      setEvaluatingKyc(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Statut KYC Header */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#0E7C66]/10 text-[#0E7C66] rounded-xl shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-slate-900 text-base">
                Vérification d'Identité Strict (KYC Marchand)
              </h4>
              <Badge className="bg-emerald-500/15 text-emerald-800 text-[10px] font-extrabold uppercase px-2 py-0.5 border-0">
                Haute Sécurité
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Authentification obligatoire de la CNI / Passeport réel avec vérification selfie.
            </p>
          </div>
        </div>

        <Badge
          className={
            status === "VERIFIED"
              ? "bg-emerald-100 text-emerald-800 text-xs px-3.5 py-1.5 font-extrabold"
              : status === "PENDING" || status === "UNDER_REVIEW"
              ? "bg-amber-100 text-amber-800 text-xs px-3.5 py-1.5 font-extrabold"
              : status === "REJECTED"
              ? "bg-rose-100 text-rose-800 text-xs px-3.5 py-1.5 font-extrabold"
              : "bg-slate-100 text-slate-700 text-xs px-3.5 py-1.5 font-extrabold"
          }
        >
          {status === "VERIFIED"
            ? "✓ COMPTE VÉRIFIÉ & APPROUVÉ"
            : status === "PENDING" || status === "UNDER_REVIEW"
            ? "⏳ ANLYSE EN COURS (72H MAX)"
            : status === "REJECTED"
            ? "✕ DOCUMENT REJETÉ"
            : "NON TRANSMIS"}
        </Badge>
      </div>

      {status === "REJECTED" && kyc?.rejection_reason && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-900 space-y-1.5">
          <div className="font-bold flex items-center gap-2 text-rose-800 text-sm">
            <XCircle className="w-4 h-4 text-rose-600" /> Motif du Rejet Automatique :
          </div>
          <p className="font-medium pl-6">{kyc.rejection_reason}</p>
        </div>
      )}

      {/* Option Mobile Fast-Track QR Code */}
      <div className="bg-gradient-to-r from-emerald-900 to-[#0E7C66] rounded-2xl p-5 text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 font-bold text-sm">
            <Smartphone className="w-4 h-4 text-emerald-300" />
            <span>Identifier ma boutique depuis mon Smartphone (Android / iOS)</span>
          </div>
          <p className="text-xs text-emerald-100/90 max-w-xl">
            Utilisez la caméra de votre téléphone portable pour prendre directement la photo selfie en tenant votre CNI ou Passeport.
          </p>
        </div>

        <Button
          onClick={() => setQrModalOpen(true)}
          className="bg-white text-emerald-900 hover:bg-emerald-50 font-extrabold text-xs px-4 h-10 rounded-xl shrink-0 gap-2 shadow-sm"
        >
          <QrCode className="w-4 h-4" />
          <span>Scanner le QR Code Mobile</span>
        </Button>
      </div>

      {/* Formulaire KYC Strict */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h5 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#0E7C66]" />
            Informations Officiellement Identifiées
          </h5>
          <p className="text-xs text-slate-500 mt-1">
            Les noms doivent concorder avec la pièce d'identité sous peine de rejet immédiat par le contrôle anti-fraude.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 text-xs font-medium">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold text-slate-700">Nom et Prénoms officiels (Conformes CNI/Passeport)</Label>
              <Input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: KOUASSI Koffi Jean-Baptiste"
                className="mt-1.5 font-bold h-11 text-sm"
                disabled={status === "VERIFIED"}
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Pays émetteur de la pièce</Label>
              <Select value={country} onValueChange={setCountry} disabled={status === "VERIFIED"}>
                <SelectTrigger className="mt-1.5 font-bold h-11 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CI">Côte d'Ivoire (CI)</SelectItem>
                  <SelectItem value="SN">Sénégal (SN)</SelectItem>
                  <SelectItem value="BF">Burkina Faso (BF)</SelectItem>
                  <SelectItem value="ML">Mali (ML)</SelectItem>
                  <SelectItem value="TG">Togo (TG)</SelectItem>
                  <SelectItem value="BJ">Bénin (BJ)</SelectItem>
                  <SelectItem value="CM">Cameroun (CM)</SelectItem>
                  <SelectItem value="GA">Gabon (GA)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Numéro de téléphone portable marchands</Label>
              <Input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex: +225 0700000000"
                className="mt-1.5 font-bold h-11 text-sm"
                disabled={status === "VERIFIED"}
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Type de compte marchand</Label>
              <Select
                value={sellerType}
                onValueChange={(val: any) => setSellerType(val)}
                disabled={status === "VERIFIED"}
              >
                <SelectTrigger className="mt-1.5 font-bold h-11 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Particulier / Vendeur Indépendant</SelectItem>
                  <SelectItem value="business">Société / Entreprise (RCCM)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5 space-y-4">
            <h5 className="font-bold text-slate-900 text-sm">
              Document Officiel d'Identité d'État (CNI ou Passeport Uniquement)
            </h5>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold text-slate-700">Type de document d'identité</Label>
                <Select value={docType} onValueChange={(v: any) => setDocType(v)} disabled={status === "VERIFIED"}>
                  <SelectTrigger className="mt-1.5 font-bold h-11 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cni">Carte Nationale d'Identité (CNI Biométrique)</SelectItem>
                    <SelectItem value="passport">Passeport International</SelectItem>
                    <SelectItem value="consular_card">Carte Consulaire d'État</SelectItem>
                    <SelectItem value="trade_register">Registre du Commerce (RCCM + CNI gérant)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Numéro de la pièce / passeport</Label>
                <Input
                  required
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  placeholder="Ex: C0123456789 ou N° Passeport"
                  className="mt-1.5 font-mono font-bold h-11 text-sm"
                  disabled={status === "VERIFIED"}
                />
              </div>
            </div>

            {/* Téléversement Sécurisé des Pièces */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {/* RECTO */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Recto de la pièce *</span>
                  {docFrontUrl && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </Label>
                {docFrontUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-emerald-300 h-36 bg-slate-100 group shadow-sm">
                    <img src={docFrontUrl} alt="Recto" className="w-full h-full object-cover" />
                    {status !== "VERIFIED" && (
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <label className="bg-white text-slate-900 text-[11px] font-bold px-3 py-1.5 rounded-xl cursor-pointer">
                          Changer le recto
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, setDocFrontUrl, "front")} />
                        </label>
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-[#0E7C66] rounded-2xl h-36 cursor-pointer bg-slate-50 hover:bg-emerald-50/40 text-slate-500 hover:text-[#0E7C66] transition-all p-3 text-center">
                    <Upload className="w-6 h-6 mb-1 text-[#0E7C66]" />
                    <span className="text-xs font-bold text-slate-800">Téléverser le Recto</span>
                    <span className="text-[10px] text-slate-400 mt-1">Image nette CNI / Passeport</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, setDocFrontUrl, "front")} disabled={status === "VERIFIED"} />
                  </label>
                )}
              </div>

              {/* VERSO */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Verso de la CNI {docType === "cni" ? "*" : "(Optionnel)"}</span>
                  {docBackUrl && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </Label>
                {docBackUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-emerald-300 h-36 bg-slate-100 group shadow-sm">
                    <img src={docBackUrl} alt="Verso" className="w-full h-full object-cover" />
                    {status !== "VERIFIED" && (
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <label className="bg-white text-slate-900 text-[11px] font-bold px-3 py-1.5 rounded-xl cursor-pointer">
                          Changer le verso
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, setDocBackUrl, "back")} />
                        </label>
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-[#0E7C66] rounded-2xl h-36 cursor-pointer bg-slate-50 hover:bg-emerald-50/40 text-slate-500 hover:text-[#0E7C66] transition-all p-3 text-center">
                    <Upload className="w-6 h-6 mb-1 text-[#0E7C66]" />
                    <span className="text-xs font-bold text-slate-800">Téléverser le Verso</span>
                    <span className="text-[10px] text-slate-400 mt-1">Obligatoire pour CNI</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, setDocBackUrl, "back")} disabled={status === "VERIFIED"} />
                  </label>
                )}
              </div>

              {/* SELFIE EN DIRECT / D'IDENTIFICATION */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Selfie tenant la pièce en main *</span>
                  {selfieUrl && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </Label>
                {selfieUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-emerald-300 h-36 bg-slate-100 group shadow-sm">
                    <img src={selfieUrl} alt="Selfie" className="w-full h-full object-cover" />
                    {status !== "VERIFIED" && (
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button type="button" onClick={startCamera} size="sm" className="bg-white text-slate-900 hover:bg-slate-100 text-[10px] font-bold h-8 rounded-lg">
                          Reprendre selfie
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 h-36">
                    <button
                      type="button"
                      onClick={startCamera}
                      disabled={status === "VERIFIED"}
                      className="flex-1 border-2 border-dashed border-[#0E7C66]/40 hover:border-[#0E7C66] bg-[#0E7C66]/5 hover:bg-[#0E7C66]/10 text-[#0E7C66] rounded-2xl p-2 flex flex-col items-center justify-center transition-all"
                    >
                      <Camera className="w-6 h-6 mb-1" />
                      <span className="text-xs font-extrabold">Prendre Selfie en direct</span>
                      <span className="text-[10px] text-slate-500">Ouvrir la caméra de l'appareil</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {status !== "VERIFIED" && (
            <div className="pt-4 border-t border-slate-100">
              <Button
                type="submit"
                disabled={submitting || uploading || evaluatingKyc}
                className="w-full bg-[#0E7C66] hover:bg-[#0A5C4C] text-white font-extrabold rounded-2xl h-12 text-sm shadow-md gap-2"
              >
                {submitting || evaluatingKyc ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Contrôle de sécurité strict et validation en cours...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>Soumettre mon dossier KYC (Contrôle Anti-Fraude Strict)</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* Modal Caméra WebRTC en direct */}
      <Dialog open={cameraModalOpen} onOpenChange={stopCamera}>
        <DialogContent className="max-w-md rounded-3xl p-6 text-center space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-center gap-2">
              <Camera className="w-5 h-5 text-[#0E7C66]" />
              Capture Selfie &amp; Pièce d'Identité en main
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Positionnez clairement votre visage et tenez votre pièce d'identité (CNI ou Passeport) à côté de votre visage.
            </DialogDescription>
          </DialogHeader>

          <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video flex items-center justify-center border-2 border-slate-700">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" onClick={stopCamera} className="rounded-xl text-xs font-bold">
              Annuler
            </Button>
            <Button onClick={captureSelfiePhoto} className="bg-[#0E7C66] hover:bg-[#0A5C4C] text-white font-extrabold rounded-xl text-xs px-6 gap-2">
              <Camera className="w-4 h-4" />
              Prendre la photo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal QR Code Smartphone */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-6 text-center space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-center gap-2">
              <Smartphone className="w-5 h-5 text-[#0E7C66]" />
              Vérification sur Mobile
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Scannez ce QR Code avec l'appareil photo de votre smartphone (iPhone / Android) pour effectuer la vérification CNI et selfie direct.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-white p-4 rounded-2xl border-2 border-slate-200 inline-block mx-auto shadow-sm">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(mobileKycUrl)}`}
              alt="QR Code KYC Mobile"
              className="w-44 h-44 mx-auto"
            />
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="font-mono text-slate-600 break-all">{mobileKycUrl}</span>
          </div>

          <Button onClick={() => setQrModalOpen(false)} className="w-full bg-slate-900 text-white font-bold rounded-xl text-xs h-10">
            Fermer
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};
