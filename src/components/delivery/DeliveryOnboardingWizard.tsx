import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Building2, 
  Users, 
  ShieldCheck, 
  Truck, 
  FileText, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Camera, 
  AlertCircle, 
  Upload, 
  RefreshCw, 
  Lock, 
  Store,
  Sparkles,
  MapPin,
  XCircle,
  FileCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { deliveryService } from "@/lib/deliveryService";
import { validateDocument, compressImageForUpload } from "@/lib/documentValidation";
import { kycVerificationService, KYCAnalysisResult } from "@/lib/kycAbstractionService";
import { validateVehicleLicenseCategory } from "@/lib/vehicleLicenseMatcher";
import { DeliveryIdentityVerificationStep } from "./DeliveryIdentityVerificationStep";
import { DeliveryProfileType, DeliveryVehicleType } from "@/types/delivery";

const COUNTRIES_LIST = [
  { code: "CI", name: "Côte d'Ivoire" },
  { code: "SN", name: "Sénégal" },
  { code: "CM", name: "Cameroun" },
  { code: "BF", name: "Burkina Faso" },
  { code: "ML", name: "Mali" },
  { code: "TG", name: "Togo" },
  { code: "BJ", name: "Bénin" },
  { code: "GA", name: "Gabon" },
  { code: "CD", name: "RDC (Congo)" },
  { code: "FR", name: "France" },
];

export function DeliveryOnboardingWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Profile Type: Gérant or Livreur
  const [profileType, setProfileType] = useState<DeliveryProfileType>('manager');

  // Step 1: Personal & Store/Vehicle Info
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [dateOfBirth, setDateOfBirth] = useState<string>("");
  const [countryCode, setCountryCode] = useState<string>("CI");
  const [phone, setPhone] = useState<string>("");
  const [whatsapp, setWhatsapp] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [city, setCity] = useState<string>("Abidjan");
  const [companyName, setCompanyName] = useState<string>("");
  const [vehicleType, setVehicleType] = useState<DeliveryVehicleType>('motorcycle');

  // Step 2: Document Selection & Verification State
  const [selectedDocType, setSelectedDocType] = useState<'cni' | 'passport'>('cni');
  const [idDocUrl, setIdDocUrl] = useState<string>("");
  const [idDocAnalysis, setIdDocAnalysis] = useState<KYCAnalysisResult | null>(null);

  // Step 3: Driver License State
  const [licenseUrl, setLicenseUrl] = useState<string>("");
  const [licenseAnalysis, setLicenseAnalysis] = useState<{ passed: boolean; reason?: string } | null>(null);

  // Step 4: Selfie Liveness State
  const [selfieUrl, setSelfieUrl] = useState<string>("");
  const [faceMatchResult, setFaceMatchResult] = useState<{ passed: boolean; score?: number } | null>(null);

  // Document Upload & Analysis Handler
  const handleDocUpload = async (file: File, docType: 'cni' | 'passport' | 'driver_license') => {
    try {
      // 1. Basic validation & compression
      const basicCheck = await validateDocument(file, docType === 'driver_license' ? 'driver_license' : 'national_id');
      if (!basicCheck.valid) {
        toast({ variant: "destructive", title: "Document invalide", description: basicCheck.reason });
        return;
      }

      const compressed = await compressImageForUpload(file);
      
      // 2. KYC Abstraction Analysis
      const analysis = await kycVerificationService.analyzeDocument(compressed, docType, {
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dateOfBirth,
        country_code: countryCode,
        profile_type: profileType
      });

      if (docType === 'driver_license') {
        const categoryCheck = validateVehicleLicenseCategory(vehicleType, ['A', 'B']);
        if (!categoryCheck.passed) {
          setLicenseAnalysis({ passed: false, reason: categoryCheck.rejection_reason });
          toast({ variant: "destructive", title: "Permis non conforme", description: categoryCheck.rejection_reason });
          return;
        }
        setLicenseAnalysis({ passed: true });
        setLicenseUrl(URL.createObjectURL(compressed));
        toast({ title: "Permis validé !", description: `Conforme pour le véhicule ${vehicleType.toUpperCase()}` });
      } else {
        setIdDocAnalysis(analysis);
        if (!analysis.valid) {
          toast({ variant: "destructive", title: "Document rejeté", description: analysis.rejection_reason });
          return;
        }
        setIdDocUrl(URL.createObjectURL(compressed));
        toast({ title: "Document d'identité conforme", description: "Nom et type de document validés par l'IA." });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur d'analyse", description: e.message });
    }
  };

  const handleFinalSubmit = async () => {
    if (!idDocUrl || (profileType === 'driver' && !licenseUrl) || !selfieUrl) {
      toast({ variant: "destructive", title: "Documents manquants", description: "Veuillez compléter toutes les étapes obligatoires." });
      return;
    }

    setSubmitting(true);
    try {
      const isApproved = idDocAnalysis?.valid && (profileType === 'manager' || licenseAnalysis?.passed) && faceMatchResult?.passed;
      const finalStatus = isApproved ? 'approved' : 'rejected';
      const rejectionReason = isApproved ? undefined : (idDocAnalysis?.rejection_reason || licenseAnalysis?.reason || "Vérification biométrique incomplète.");

      const registered = await deliveryService.registerDeliveryCompany({
        company_name: companyName || `${firstName} ${lastName} Express`,
        country: COUNTRIES_LIST.find(c => c.code === countryCode)?.name || "Côte d'Ivoire",
        country_code: countryCode,
        city: city,
        headquarters_address: address || city,
        manager_name: `${firstName} ${lastName}`.trim(),
        manager_phone: phone,
        manager_whatsapp: whatsapp || phone,
        manager_photo_url: selfieUrl,
        manager_id_photo_url: idDocUrl,
        owner_photo_url: selfieUrl,
        warehouse_photo_url: idDocUrl,
        has_tax_registration: false,
        covered_cities: [city],
        total_drivers_count: 1,
        hubs: [{ city, address: address || city }],
        drivers: profileType === 'driver' ? [{
          full_name: `${firstName} ${lastName}`,
          phone: phone,
          vehicle_type: vehicleType,
          photo_url: selfieUrl,
          national_id_photo_url: idDocUrl,
          license_photo_url: licenseUrl
        }] : []
      });

      await deliveryService.processIdentityVerification({
        companyId: registered.id,
        userEmail: "demandeur@ecomfy.cloud",
        userName: `${firstName} ${lastName}`,
        verificationStatus: finalStatus,
        rejectionReason: rejectionReason,
        faceMatchScore: faceMatchResult?.score || 92
      });

      if (isApproved) {
        toast({
          title: "Accès Ecomfy Livraison Activé ! 🎉",
          description: "Votre compte est validé et prêt à recevoir des commandes de livraison."
        });
      } else {
        toast({
          variant: "destructive",
          title: "Demande non validée ❌",
          description: rejectionReason || "Certaines informations nécessitent une correction."
        });
      }

      navigate("/delivery/status");
    } catch (e: any) {
      console.error(e);
      toast({ variant: "destructive", title: "Erreur de soumission", description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Visual Stepper */}
      <div className="grid grid-cols-5 gap-2 text-center text-xs">
        {[
          { num: 1, label: "Profil & Infos", icon: Users },
          { num: 2, label: "Pièce d'Identité", icon: FileText },
          { num: 3, label: profileType === 'driver' ? "Permis & Véhicule" : "Boutique / Entrepôt", icon: Truck },
          { num: 4, label: "Selfie Liveness", icon: Camera },
          { num: 5, label: "Récapitulatif", icon: ShieldCheck },
        ].map((s) => {
          const Icon = s.icon;
          const isActive = step === s.num;
          const isDone = step > s.num;
          return (
            <div
              key={s.num}
              onClick={() => isDone && setStep(s.num)}
              className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                isActive
                  ? "bg-emerald-950 border-emerald-500 text-emerald-400 font-bold shadow-lg"
                  : isDone
                  ? "bg-slate-900 border-slate-700 text-slate-300"
                  : "bg-slate-950/60 border-slate-800 text-slate-600"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] hidden sm:block truncate max-w-full">{s.label}</span>
            </div>
          );
        })}
      </div>

      <Card className="bg-slate-900/90 border-slate-800 shadow-2xl backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            {step === 1 && <><Users className="w-5 h-5 text-emerald-400" /> Étape 1 : Choix du Profil & Informations Personnelles</>}
            {step === 2 && <><FileText className="w-5 h-5 text-emerald-400" /> Étape 2 : Importation de la Pièce d'Identité</>}
            {step === 3 && <><Truck className="w-5 h-5 text-emerald-400" /> Étape 3 : {profileType === 'driver' ? "Permis de Conduire & Véhicule" : "Informations Boutique / Siège"}</>}
            {step === 4 && <><Camera className="w-5 h-5 text-emerald-400" /> Étape 4 : Selfie Biométrique (Visage & Pièce tenue en hand)</>}
            {step === 5 && <><ShieldCheck className="w-5 h-5 text-emerald-400" /> Étape 5 : Récapitulatif & Validation Finale</>}
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            {step === 1 && "Sélectionnez votre rôle et saisissez vos informations d'identité officielles."}
            {step === 2 && "Sélectionnez votre document et assurez-vous qu'il soit net et non expiré."}
            {step === 3 && "Vérifiez que la catégorie de votre permis correspond au véhicule utilisé."}
            {step === 4 && "Prenez une photo en direct avec la pièce tenue dans votre hand."}
            {step === 5 && "Vérifiez la checklist des documents validés avant soumission finale."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {/* STEP 1: Profile Choice & Personal Data */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Profile Selector */}
              <div className="space-y-2">
                <Label className="text-xs text-slate-300 font-bold">Sélectionnez votre profil sur Ecomfy Livraison *</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setProfileType('manager')}
                    className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                      profileType === 'manager'
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Building2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-xs text-white">Gérant / Propriétaire de Boutique</h4>
                      <p className="text-[11px] mt-0.5 opacity-80">Représente une entreprise ou une boutique utilisant le service de livraison.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProfileType('driver')}
                    className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                      profileType === 'driver'
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Truck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-xs text-white">Livreur Indépendant / Flotte</h4>
                      <p className="text-[11px] mt-0.5 opacity-80">Effectue les livraisons avec son véhicule motorisé (Moto, Voiture, Van).</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Personal Data Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-200">Prénom *</Label>
                  <Input placeholder="Ex: Jean" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-slate-950 border-slate-800 text-white text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-200">Nom de famille *</Label>
                  <Input placeholder="Ex: Kouassi" value={lastName} onChange={(e) => setLastName(e.target.value)} className="bg-slate-950 border-slate-800 text-white text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-200">Date de Naissance *</Label>
                  <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="bg-slate-950 border-slate-800 text-white text-xs" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-200">Pays de Résidence *</Label>
                  <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="w-full h-9 rounded-md bg-slate-950 border border-slate-800 text-white px-2 text-xs">
                    {COUNTRIES_LIST.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-200">Ville Principal *</Label>
                  <Input placeholder="Ex: Abidjan" value={city} onChange={(e) => setCity(e.target.value)} className="bg-slate-950 border-slate-800 text-white text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-200">Téléphone Direct *</Label>
                  <Input placeholder="+225 0700000000" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-slate-950 border-slate-800 text-white text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-200">WhatsApp Pro *</Label>
                  <Input placeholder="+225 0700000000" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="bg-slate-950 border-slate-800 text-white text-xs" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: ID Document Upload & Pre-check */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs text-slate-200 font-bold">Choisissez le type de pièce d'identité officielle à importer *</Label>
                <div className="flex gap-4">
                  <label className={`flex-1 p-3 rounded-xl border flex items-center gap-2 cursor-pointer text-xs font-semibold ${selectedDocType === 'cni' ? 'bg-emerald-950 border-emerald-500 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                    <input type="radio" name="docType" checked={selectedDocType === 'cni'} onChange={() => setSelectedDocType('cni')} className="hidden" />
                    <FileText className="w-4 h-4 text-emerald-400" /> Carte Nationale d'Identité (CNI)
                  </label>

                  <label className={`flex-1 p-3 rounded-xl border flex items-center gap-2 cursor-pointer text-xs font-semibold ${selectedDocType === 'passport' ? 'bg-emerald-950 border-emerald-500 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                    <input type="radio" name="docType" checked={selectedDocType === 'passport'} onChange={() => setSelectedDocType('passport')} className="hidden" />
                    <FileText className="w-4 h-4 text-emerald-400" /> Passeport International
                  </label>
                </div>
              </div>

              {/* Upload Drop Zone */}
              <div className="p-6 rounded-2xl bg-slate-950 border border-dashed border-slate-800 text-center space-y-3">
                <Upload className="w-8 h-8 text-emerald-400 mx-auto" />
                <div>
                  <h4 className="text-xs font-bold text-white">Importer votre {selectedDocType.toUpperCase()}</h4>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5">
                    Le document doit être net, entier, non expiré et comporter les filigranes officiels. Les factures et reçus sont automatiquement rejetés.
                  </p>
                </div>
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleDocUpload(f, selectedDocType);
                  }}
                  className="max-w-xs mx-auto bg-slate-900 border-slate-800 text-xs text-slate-300"
                />

                {idDocAnalysis && (
                  <div className={`p-3 rounded-xl border text-xs text-left max-w-md mx-auto mt-3 ${idDocAnalysis.valid ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/40 border-rose-500/40 text-rose-300'}`}>
                    <div className="flex items-center justify-between font-bold">
                      <span>Analyse IA Document :</span>
                      {idDocAnalysis.valid ? <Badge className="bg-emerald-500/20 text-emerald-300">Conforme</Badge> : <Badge className="bg-rose-500/20 text-rose-300">Non conforme</Badge>}
                    </div>
                    <p className="text-[11px] mt-1">{idDocAnalysis.valid ? "Document reconnu et nom d'identité validé." : idDocAnalysis.rejection_reason}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Driver License & Vehicle OR Store Details */}
          {step === 3 && (
            <div className="space-y-5">
              {profileType === 'driver' ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-200 font-bold">Quel type de véhicule utilisez-vous pour les livraisons ? *</Label>
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value as any)}
                      className="w-full h-10 rounded-md bg-slate-950 border border-slate-800 text-white px-3 text-xs"
                    >
                      <option value="motorcycle">Moto / Scooter (Catégorie A requise)</option>
                      <option value="tricycle">Tricycle Motorisé (Catégorie A requise)</option>
                      <option value="car">Voiture / Véhicule Léger (Catégorie B requise)</option>
                      <option value="van">Camionnette / Van (Catégorie B/C requise)</option>
                    </select>
                  </div>

                  <div className="p-6 rounded-2xl bg-slate-950 border border-dashed border-slate-800 text-center space-y-3">
                    <Truck className="w-8 h-8 text-amber-400 mx-auto" />
                    <div>
                      <h4 className="text-xs font-bold text-white">Importer votre Permis de Conduire</h4>
                      <p className="text-[11px] text-slate-400">
                        La catégorie du permis doit strictement correspondre au véhicule déclaré ({vehicleType.toUpperCase()}).
                      </p>
                    </div>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleDocUpload(f, 'driver_license');
                      }}
                      className="max-w-xs mx-auto bg-slate-900 border-slate-800 text-xs text-slate-300"
                    />

                    {licenseAnalysis && (
                      <div className={`p-3 rounded-xl border text-xs text-left max-w-md mx-auto mt-3 ${licenseAnalysis.passed ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/40 border-rose-500/40 text-rose-300'}`}>
                        <span className="font-bold block">Résultat du contrôle de Permis :</span>
                        <p className="text-[11px] mt-0.5">{licenseAnalysis.passed ? "Catégorie de permis conforme et validée." : licenseAnalysis.reason}</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-200">Nom de votre Boutique / Société *</Label>
                    <Input placeholder="Ex: Express Logistics CI" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="bg-slate-950 border-slate-800 text-white text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-200">Adresse du Siège ou Entrepôt Principal *</Label>
                    <Input placeholder="Ex: Marcory Zone 4, Abidjan" value={address} onChange={(e) => setAddress(e.target.value)} className="bg-slate-950 border-slate-800 text-white text-xs" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Selfie Biométrique & Liveness */}
          {step === 4 && (
            <DeliveryIdentityVerificationStep
              countryCode={countryCode}
              managerName={`${firstName} ${lastName}`}
              idPhotoUrl={idDocUrl}
              licensePhotoUrl={licenseUrl}
              vehicleType={vehicleType}
              onVerificationComplete={(res) => {
                setFaceMatchResult({
                  passed: res.status === 'approved',
                  score: res.details.faceCheck.score
                });
                if (res.details.selfieUrl) {
                  setSelfieUrl(res.details.selfieUrl);
                }
              }}
            />
          )}

          {/* STEP 5: Checklist & Final Submission Summary */}
          {step === 5 && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Checklist des Documents Soumis & Vérifiés
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-semibold text-slate-200">Pièce d'Identité ({selectedDocType.toUpperCase()})</span>
                    {idDocAnalysis?.valid ? <Badge className="bg-emerald-500/20 text-emerald-300">✓ Conforme</Badge> : <Badge className="bg-rose-500/20 text-rose-300">✕ Non valide</Badge>}
                  </div>

                  {profileType === 'driver' && (
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="font-semibold text-slate-200">Permis de Conduire ({vehicleType.toUpperCase()})</span>
                      {licenseAnalysis?.passed ? <Badge className="bg-emerald-500/20 text-emerald-300">✓ Catégorie Validée</Badge> : <Badge className="bg-rose-500/20 text-rose-300">✕ Permis non conforme</Badge>}
                    </div>
                  )}

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="font-semibold text-slate-200">Selfie Biométrique Liveness</span>
                    {faceMatchResult?.passed ? <Badge className="bg-emerald-500/20 text-emerald-300">✓ Match ({faceMatchResult.score}%)</Badge> : <Badge className="bg-rose-500/20 text-rose-300">✕ Non valide</Badge>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between border-t border-slate-800 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep(prev => Math.max(prev - 1, 1))}
            disabled={step === 1 || submitting}
            className="border-slate-800 text-slate-300 hover:bg-slate-800 text-xs"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Précédent
          </Button>

          {step < 5 ? (
            <Button
              type="button"
              onClick={() => {
                if (step === 1 && (!firstName || !lastName || !phone)) {
                  toast({ variant: "destructive", title: "Champs requis", description: "Veuillez indiquer vos nom, prénom et téléphone." });
                  return;
                }
                setStep(prev => Math.min(prev + 1, 5));
              }}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs gap-1.5"
            >
              Étape Suivante <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleFinalSubmit}
              disabled={submitting}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs px-6 py-2 rounded-xl shadow-lg"
            >
              {submitting ? "Soumission en cours..." : "Soumettre à la Fondation Ecomfy"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
