import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  FileText,
  Lock,
  ShieldCheck,
  Truck,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { deliveryService } from "@/lib/deliveryService";
import { VEHICLE_LICENSE_REQUIREMENTS } from "@/lib/vehicleLicenseMatcher";
import { DeliveryDocUpload } from "./DeliveryDocUpload";
import { DeliverySelfieCapture } from "./DeliverySelfieCapture";
import { DriverLicenseFields } from "./DriverLicenseFields";
import { WarehouseLocationPicker, type WarehouseLocationValue } from "./WarehouseLocationPicker";
import { emptyLicenseForm, licenseFormProblems, type LicenseFormState } from "@/lib/driverLicenseForm";
import { idNeedsBackSide } from "@/lib/deliveryDossier";
import type { DeliveryProfileType, IdDocumentType } from "@/types/delivery";

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

const todayIso = () => new Date().toISOString().slice(0, 10);
const eighteenYearsAgoIso = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
};

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-slate-200">{label}</Label>
      {children}
    </div>
  );
}

export function DeliveryOnboardingWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [profileType, setProfileType] = useState<DeliveryProfileType>("manager");

  // Étape 1 : identité déclarée (comparée à la pièce par un humain)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [countryCode, setCountryCode] = useState("CI");
  const [city, setCity] = useState("Abidjan");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [idType, setIdType] = useState<IdDocumentType>("cni");
  const [idNumber, setIdNumber] = useState("");
  const [idExpiry, setIdExpiry] = useState("");

  // Étape 2 : pièce d'identité (chemin dans le bucket privé)
  const [idPhoto, setIdPhoto] = useState("");
  const [idPhotoBack, setIdPhotoBack] = useState("");

  // Étape 3 : permis + véhicule (livreur) ou structure + KYB (gérant)
  const [license, setLicense] = useState<LicenseFormState>(emptyLicenseForm());
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [warehousePhoto, setWarehousePhoto] = useState("");
  const [location, setLocation] = useState<WarehouseLocationValue | null>(null);
  const [hasTax, setHasTax] = useState(false);
  const [taxId, setTaxId] = useState("");
  const [taxDoc, setTaxDoc] = useState("");
  const [tradeRegister, setTradeRegister] = useState("");
  const [tradeDoc, setTradeDoc] = useState("");

  // Étape 4 : selfie avec la pièce
  const [selfie, setSelfie] = useState("");

  const isDriver = profileType === "driver";
  const needsBack = idNeedsBackSide(idType);

  const problemsFor = (target: number): string[] => {
    const out: string[] = [];
    if (target === 1) {
      if (!firstName.trim() || !lastName.trim()) out.push("Indiquez votre prénom et votre nom, tels qu'inscrits sur votre pièce d'identité.");
      if (!phone.trim()) out.push("Indiquez votre téléphone.");
      if (!city.trim()) out.push("Indiquez votre ville.");
      if (!dateOfBirth) out.push("Indiquez votre date de naissance.");
      else if (dateOfBirth > eighteenYearsAgoIso()) out.push("Vous devez être majeur pour vous inscrire.");
      if (idNumber.trim().length < 4) out.push("Indiquez le numéro de votre pièce d'identité.");
      if (idExpiry && idExpiry < todayIso()) out.push("Votre pièce d'identité est expirée.");
    }
    if (target === 2) {
      if (!idPhoto) out.push(needsBack ? "Importez la photo du recto de votre pièce d'identité." : "Importez la photo de la page de votre passeport.");
      if (needsBack && !idPhotoBack) out.push("Importez la photo du verso de votre pièce d'identité.");
    }
    if (target === 3) {
      if (isDriver) out.push(...licenseFormProblems(license, idExpiry));
      else {
        if (!companyName.trim()) out.push("Indiquez le nom de votre société ou boutique.");
        if (!address.trim()) out.push("Indiquez l'adresse du siège ou de l'entrepôt.");
        if (!warehousePhoto) out.push("Importez la photo de votre entrepôt principal.");
        if (!location) out.push("Indiquez la localisation de votre entrepôt : utilisez votre position ou placez le point sur la carte.");
        if (hasTax && !taxId.trim() && !tradeRegister.trim()) out.push("Indiquez votre numéro fiscal (NIF) ou de registre du commerce (RCCM).");
      }
    }
    if (target === 4 && !selfie) out.push("Prenez ou importez le selfie avec votre pièce d'identité.");
    return out;
  };

  const goNext = () => {
    const problems = problemsFor(step);
    if (problems.length) {
      toast({ variant: "destructive", title: "Informations à compléter", description: problems[0] });
      return;
    }
    setStep((s) => Math.min(s + 1, 5));
  };

  const allProblems = [1, 2, 3, 4].flatMap((s) => problemsFor(s));

  const handleFinalSubmit = async () => {
    if (allProblems.length) {
      toast({ variant: "destructive", title: "Dossier incomplet", description: allProblems[0] });
      return;
    }
    setSubmitting(true);
    try {
      const country = COUNTRIES_LIST.find((c) => c.code === countryCode)?.name || "Côte d'Ivoire";
      await deliveryService.registerApplication({
        company: {
          profile_type: profileType,
          company_name: companyName.trim() || `${firstName.trim()} ${lastName.trim()} Express`,
          country,
          country_code: countryCode,
          city: city.trim(),
          headquarters_address: address.trim() || city.trim(),
          manager_first_name: firstName.trim(),
          manager_last_name: lastName.trim(),
          manager_phone: phone.trim(),
          manager_whatsapp: whatsapp.trim() || phone.trim(),
          manager_id_photo_url: idPhoto,
          manager_id_back_photo_url: needsBack ? idPhotoBack : undefined,
          manager_selfie_with_id_url: selfie,
          warehouse_photo_url: isDriver ? undefined : warehousePhoto,
          warehouse_latitude: isDriver ? undefined : location?.latitude,
          warehouse_longitude: isDriver ? undefined : location?.longitude,
          warehouse_accuracy_m: isDriver ? undefined : location?.accuracy_m ?? undefined,
          warehouse_location_source: isDriver ? undefined : location?.source,
          has_tax_registration: !isDriver && hasTax,
          tax_id_number: !isDriver && hasTax ? taxId.trim() : undefined,
          tax_document_url: !isDriver && hasTax ? taxDoc || undefined : undefined,
          trade_register_number: !isDriver && hasTax ? tradeRegister.trim() || undefined : undefined,
          trade_register_document_url: !isDriver && hasTax ? tradeDoc || undefined : undefined,
          covered_cities: [city.trim()],
        },
        kyc: { id_type: idType, id_number: idNumber.trim(), id_expiry: idExpiry || undefined, date_of_birth: dateOfBirth },
        hubs: [{ city: city.trim(), address: address.trim() || city.trim() }],
        drivers: isDriver
          ? [{
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              phone: phone.trim(),
              whatsapp: whatsapp.trim() || undefined,
              date_of_birth: dateOfBirth,
              vehicle_type: license.vehicleType,
              vehicle_license_plate: license.plate.trim() || undefined,
              id_type: idType,
              id_number: idNumber.trim(),
              id_expiry: idExpiry || undefined,
              license_number: license.licenseNumber.trim(),
              license_categories: license.categories,
              license_expiry: license.licenseExpiry,
              national_id_photo_url: idPhoto,
              national_id_back_photo_url: needsBack ? idPhotoBack : undefined,
              license_photo_url: license.licensePhoto,
              license_back_photo_url: license.licenseBackPhoto,
              selfie_with_id_url: selfie,
            }]
          : [],
      });

      toast({
        title: "Dossier transmis",
        description: "L'équipe Ecomfy examine vos pièces. Vous serez notifié de la décision.",
      });
      navigate("/delivery/status");
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Envoi impossible", description: e instanceof Error ? e.message : "Erreur de soumission." });
    } finally {
      setSubmitting(false);
    }
  };

  const steps = [
    { num: 1, label: "Profil & identité", icon: Users },
    { num: 2, label: "Pièce d'identité", icon: FileText },
    { num: 3, label: isDriver ? "Permis & véhicule" : "Structure & KYB", icon: Truck },
    { num: 4, label: "Selfie avec la pièce", icon: Camera },
    { num: 5, label: "Récapitulatif", icon: ShieldCheck },
  ];

  const inputCls = "bg-slate-950 border-slate-800 text-white text-xs";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="grid grid-cols-5 gap-2 text-center text-xs">
        {steps.map((s) => {
          const Icon = s.icon;
          const isActive = step === s.num;
          const isDone = step > s.num;
          return (
            <button
              key={s.num}
              type="button"
              onClick={() => isDone && setStep(s.num)}
              aria-current={isActive ? "step" : undefined}
              className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                isActive ? "bg-emerald-950 border-emerald-500 text-emerald-400 font-bold shadow-lg"
                : isDone ? "bg-slate-900 border-slate-700 text-slate-300 cursor-pointer"
                : "bg-slate-950/60 border-slate-700 text-slate-400 cursor-default"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] hidden sm:block truncate max-w-full">{s.label}</span>
            </button>
          );
        })}
      </div>

      <Card className="bg-slate-900/90 border-slate-800 shadow-2xl backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white">
            Étape {step} : {steps[step - 1].label}
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            {step === 1 && "Saisissez votre identité exactement comme sur votre pièce : l'équipe la compare au document."}
            {step === 2 && (needsBack ? "Importez le recto et le verso de votre pièce d'identité : photos nettes, entières, pièce non expirée." : "Importez la page de votre passeport comportant votre photo : image nette et entière, passeport non expiré.")}
            {step === 3 && (isDriver ? "Déclarez votre permis : la catégorie doit correspondre au véhicule utilisé." : "Présentez votre structure ; un numéro fiscal ou de registre du commerce renforce votre dossier.")}
            {step === 4 && "Une photo de vous tenant votre pièce d'identité ouverte, visage et document lisibles."}
            {step === 5 && "Relisez avant d'envoyer : votre dossier sera examiné par une personne de l'équipe."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs text-slate-300 font-bold">Votre profil sur Ecomfy Livraison *</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {([
                    { v: "manager", icon: Building2, title: "Société de livraison", text: "Vous gérez une structure et ses livreurs (vous pourrez les ajouter après l'inscription)." },
                    { v: "driver", icon: Truck, title: "Livreur indépendant", text: "Vous livrez vous-même avec votre véhicule : moto, tricycle, voiture ou van." },
                  ] as const).map(({ v, icon: Icon, title, text }) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={profileType === v}
                      onClick={() => setProfileType(v)}
                      className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                        profileType === v ? "bg-emerald-950/80 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500" : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <Icon className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        <span className="block font-bold text-xs text-white">{title}</span>
                        <span className="block text-[11px] mt-0.5 opacity-80">{text}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field id="w-first" label="Prénom *"><Input id="w-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ex: Jean" className={inputCls} /></Field>
                <Field id="w-last" label="Nom de famille *"><Input id="w-last" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Ex: Kouassi" className={inputCls} /></Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field id="w-dob" label="Date de naissance *"><Input id="w-dob" type="date" max={eighteenYearsAgoIso()} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputCls} /></Field>
                <Field id="w-country" label="Pays *">
                  <select id="w-country" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="w-full h-9 rounded-md bg-slate-950 border border-slate-800 text-white px-2 text-xs">
                    {COUNTRIES_LIST.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </Field>
                <Field id="w-city" label="Ville principale *"><Input id="w-city" value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} /></Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field id="w-phone" label="Téléphone *"><Input id="w-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+225 0700000000" className={inputCls} /></Field>
                <Field id="w-wa" label="WhatsApp"><Input id="w-wa" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="Identique au téléphone si vide" className={inputCls} /></Field>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-white flex items-center gap-2"><Lock className="w-3.5 h-3.5 text-emerald-400" /> Pièce d'identité (visible de vous et de l'équipe uniquement)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field id="w-idtype" label="Type *">
                    <select id="w-idtype" value={idType} onChange={(e) => setIdType(e.target.value as IdDocumentType)} className="w-full h-9 rounded-md bg-slate-900 border border-slate-800 text-white px-2 text-xs">
                      <option value="cni">Carte nationale d'identité</option>
                      <option value="passport">Passeport</option>
                    </select>
                  </Field>
                  <Field id="w-idnum" label="Numéro *"><Input id="w-idnum" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className="bg-slate-900 border-slate-800 text-white text-xs" /></Field>
                  <Field id="w-idexp" label="Date d'expiration"><Input id="w-idexp" type="date" value={idExpiry} onChange={(e) => setIdExpiry(e.target.value)} className="bg-slate-900 border-slate-800 text-white text-xs" /></Field>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className={`grid grid-cols-1 gap-4 ${needsBack ? "sm:grid-cols-2" : ""}`}>
              <DeliveryDocUpload
                label={needsBack ? "Carte nationale d'identité — recto" : "Passeport — page photo"}
                hint="Image nette et entière (JPG, PNG, WEBP) ou PDF. Une facture ou un reçu sera refusé par l'équipe."
                field="manager_id"
                category="national_id"
                required
                value={idPhoto}
                onChange={setIdPhoto}
              />
              {needsBack && (
                <DeliveryDocUpload
                  label="Carte nationale d'identité — verso"
                  hint="Le dos de la carte, lisible et entier."
                  field="manager_id_back"
                  category="national_id"
                  required
                  value={idPhotoBack}
                  onChange={setIdPhotoBack}
                />
              )}
            </div>
          )}

          {step === 3 && isDriver && <DriverLicenseFields value={license} onChange={setLicense} idExpiry={idExpiry} />}

          {step === 3 && !isDriver && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field id="w-company" label="Nom de la société ou boutique *"><Input id="w-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Ex: Express Logistics CI" className={inputCls} /></Field>
                <Field id="w-addr" label="Adresse du siège ou de l'entrepôt *"><Input id="w-addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ex: Marcory Zone 4, Abidjan" className={inputCls} /></Field>
              </div>
              <DeliveryDocUpload label="Photo de l'entrepôt principal" hint="Façade ou intérieur, lisible." field="warehouse" category="warehouse_photo" accept="image/*" required value={warehousePhoto} onChange={setWarehousePhoto} />
              <WarehouseLocationPicker required value={location} onChange={setLocation} />

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                <label className="flex items-center gap-2 text-xs font-bold text-white cursor-pointer">
                  <input type="checkbox" checked={hasTax} onChange={(e) => setHasTax(e.target.checked)} className="accent-emerald-500" />
                  Ma structure est immatriculée (NIF / RCCM)
                </label>
                {hasTax && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field id="w-nif" label="Numéro fiscal (NIF)"><Input id="w-nif" value={taxId} onChange={(e) => setTaxId(e.target.value)} className="bg-slate-900 border-slate-800 text-white text-xs" /></Field>
                      <Field id="w-rccm" label="Registre du commerce (RCCM)"><Input id="w-rccm" value={tradeRegister} onChange={(e) => setTradeRegister(e.target.value)} className="bg-slate-900 border-slate-800 text-white text-xs" /></Field>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <DeliveryDocUpload label="Attestation fiscale (facultatif)" field="tax_document" category="tax_document" value={taxDoc} onChange={setTaxDoc} />
                      <DeliveryDocUpload label="Extrait RCCM (facultatif)" field="trade_register" category="tax_document" value={tradeDoc} onChange={setTradeDoc} />
                    </div>
                  </div>
                )}
                {!hasTax && <p className="text-[11px] text-slate-500">Sans immatriculation, votre dossier reste examiné sur l'identité du responsable et la photo de l'entrepôt.</p>}
              </div>
            </div>
          )}

          {step === 4 && <DeliverySelfieCapture field="manager_selfie" value={selfie} onChange={setSelfie} />}

          {step === 5 && (
            <div className="space-y-4">
              <ul className="space-y-2 text-xs">
                {[
                  { ok: !!idPhoto && (!needsBack || !!idPhotoBack), text: `Pièce d'identité (${idType === "passport" ? "passeport" : "CNI recto et verso"}, n° ${idNumber.trim() || "—"})` },
                  { ok: !!selfie, text: "Selfie avec la pièce d'identité" },
                  isDriver
                    ? { ok: licenseFormProblems(license, idExpiry).length === 0, text: `Permis ${license.categories.join("+") || "—"} pour ${VEHICLE_LICENSE_REQUIREMENTS[license.vehicleType].label}` }
                    : { ok: !!warehousePhoto && !!companyName.trim(), text: `Structure « ${companyName.trim() || "—"} »${hasTax ? " (immatriculée)" : ""}` },
                  ...(isDriver ? [] : [{ ok: !!location, text: location ? `Localisation de l'entrepôt (${location.source === "gps" ? "GPS" : "carte"})` : "Localisation de l'entrepôt" }]),
                ].map((row) => (
                  <li key={row.text} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="font-semibold text-slate-200">{row.text}</span>
                    {row.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-label="fourni" /> : <XCircle className="w-4 h-4 text-rose-400" aria-label="manquant" />}
                  </li>
                ))}
              </ul>
              {allProblems.length > 0 && (
                <div role="alert" className="p-3 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-200 text-xs space-y-1">
                  {allProblems.map((p) => <p key={p}>• {p}</p>)}
                </div>
              )}
              <p className="text-[11px] text-slate-500">
                Aucun contrôle n'est automatique : une personne de l'équipe compare votre identité, votre pièce, votre selfie{isDriver ? " et votre permis" : ""}.
                Vous serez notifié ici et par e-mail.
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between border-t border-slate-800 pt-4">
          <Button type="button" variant="outline" onClick={() => setStep((s) => Math.max(s - 1, 1))} disabled={step === 1 || submitting} className="bg-slate-900 hover:text-white border-slate-800 text-slate-300 hover:bg-slate-800 text-xs">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Précédent
          </Button>
          {step < 5 ? (
            <Button type="button" onClick={goNext} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs gap-1.5">
              Étape suivante <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button type="button" onClick={handleFinalSubmit} disabled={submitting || allProblems.length > 0} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs px-6 py-2 rounded-xl shadow-lg">
              {submitting ? "Envoi en cours…" : "Envoyer mon dossier à Ecomfy"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
