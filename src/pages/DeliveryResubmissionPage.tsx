import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { deliveryService } from "@/lib/deliveryService";
import { DeliveryDocUpload } from "@/components/delivery/DeliveryDocUpload";
import { DeliverySelfieCapture } from "@/components/delivery/DeliverySelfieCapture";
import { DriverLicenseFields } from "@/components/delivery/DriverLicenseFields";
import { licenseFormProblems, type LicenseFormState } from "@/lib/driverLicenseForm";
import { DeliveryNotificationBell } from "@/components/delivery/DeliveryNotificationBell";
import { REJECTION_REASON_LABELS, type DeliveryCompany } from "@/types/delivery";

/**
 * Correction d'un dossier refusé ou à compléter. Les documents sont réellement déposés dans le bucket privé ;
 * seules les pièces modifiées sont envoyées, le reste du dossier reste tel qu'enregistré.
 */
export default function DeliveryResubmissionPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [company, setCompany] = useState<DeliveryCompany | null>(null);

  const [idPhoto, setIdPhoto] = useState("");
  const [selfie, setSelfie] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [taxDoc, setTaxDoc] = useState("");
  const [tradeDoc, setTradeDoc] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idExpiry, setIdExpiry] = useState("");
  const [license, setLicense] = useState<LicenseFormState | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await deliveryService.getMyCompany();
        setCompany(data);
        if (data) {
          setIdPhoto(data.manager_id_photo_url ?? "");
          setSelfie(data.manager_selfie_with_id_url ?? "");
          setWarehouse(data.warehouse_photo_url ?? "");
          setTaxDoc(data.tax_document_url ?? "");
          setTradeDoc(data.trade_register_document_url ?? "");
          setIdNumber(data.kyc?.id_number ?? "");
          setIdExpiry(data.kyc?.id_expiry ?? "");
          const d = data.drivers?.[0];
          if (data.profile_type === "driver" && d) {
            setLicense({
              vehicleType: d.vehicle_type,
              plate: d.vehicle_license_plate ?? "",
              licenseNumber: d.license_number ?? "",
              categories: d.license_categories ?? [],
              licenseExpiry: d.license_expiry ?? "",
              licensePhoto: d.license_photo_url ?? "",
            });
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleResubmit = async () => {
    if (!company) return;
    const problems: string[] = [];
    if (!idPhoto) problems.push("La photo de la pièce d'identité est requise.");
    if (!selfie) problems.push("Le selfie avec la pièce d'identité est requis.");
    if (idExpiry && idExpiry < new Date().toISOString().slice(0, 10)) problems.push("Votre pièce d'identité est expirée : importez une pièce valable.");
    if (license) problems.push(...licenseFormProblems(license, idExpiry));
    if (problems.length) {
      toast({ variant: "destructive", title: "Dossier incomplet", description: problems[0] });
      return;
    }

    setSubmitting(true);
    try {
      const changed = <T,>(next: T, prev: T | null | undefined) => (next && next !== prev ? next : undefined);
      const driver = company.drivers?.[0];
      await deliveryService.resubmitApplication(company.id, {
        company: {
          manager_id_photo_url: changed(idPhoto, company.manager_id_photo_url),
          manager_selfie_with_id_url: changed(selfie, company.manager_selfie_with_id_url),
          warehouse_photo_url: changed(warehouse, company.warehouse_photo_url),
          tax_document_url: changed(taxDoc, company.tax_document_url),
          trade_register_document_url: changed(tradeDoc, company.trade_register_document_url),
        },
        kyc: {
          id_number: changed(idNumber.trim(), company.kyc?.id_number),
          id_expiry: changed(idExpiry, company.kyc?.id_expiry),
        },
        drivers: license && driver
          ? [{
              id: driver.id,
              vehicle_type: license.vehicleType,
              vehicle_license_plate: license.plate.trim() || undefined,
              license_number: license.licenseNumber.trim(),
              license_categories: license.categories,
              license_expiry: license.licenseExpiry,
              license_photo_url: license.licensePhoto,
              national_id_photo_url: idPhoto,
              selfie_with_id_url: selfie,
              id_number: idNumber.trim() || undefined,
              id_expiry: idExpiry || undefined,
            }]
          : [],
      });

      toast({ title: "Dossier resoumis", description: "Vos documents sont transmis à l'équipe pour un nouvel examen." });
      navigate("/delivery/status");
    } catch (e) {
      toast({ variant: "destructive", title: "Resoumission refusée", description: e instanceof Error ? e.message : "Erreur." });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <p className="text-slate-400">Aucun dossier trouvé pour resoumission.</p>
      </div>
    );
  }

  const blocked = company.verification_status === "approved" || company.verification_status === "suspended";
  const message = company.verification_status === "action_required" ? company.reviewer_comments : company.rejection_reason;
  const inputCls = "bg-slate-950 border-slate-800 text-white text-xs";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <Button variant="ghost" onClick={() => navigate("/delivery/status")} className="text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour au statut
          </Button>
          <DeliveryNotificationBell />
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-emerald-400" /> Corriger mon dossier
            </CardTitle>
            <CardDescription className="text-slate-300 text-xs">
              Remplacez uniquement ce qui est demandé. Les pièces que vous ne changez pas restent enregistrées.
            </CardDescription>
            {message && (
              <div className="mt-3 p-3.5 rounded-xl bg-rose-950/40 border border-rose-900 text-rose-200 text-xs">
                <span className="font-bold text-rose-300 block mb-1">
                  {company.verification_status === "action_required" ? "Ce que l'équipe attend de vous :" : "Motif indiqué par l'équipe :"}
                </span>
                {company.rejection_reason_code && company.verification_status !== "action_required" && (
                  <p className="font-semibold">{REJECTION_REASON_LABELS[company.rejection_reason_code]}</p>
                )}
                <p>{message}</p>
              </div>
            )}
            {blocked && (
              <p className="mt-3 text-xs text-amber-300">
                Ce dossier ne peut pas être resoumis dans son état actuel ({company.verification_status === "approved" ? "déjà approuvé" : "suspendu : contactez le support"}).
              </p>
            )}
          </CardHeader>

          <CardContent className="space-y-5 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="space-y-1.5">
                <Label htmlFor="r-idn" className="text-xs text-slate-300">N° de pièce d'identité</Label>
                <Input id="r-idn" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className="bg-slate-900 border-slate-800 text-white text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-ide" className="text-xs text-slate-300">Date d'expiration</Label>
                <Input id="r-ide" type="date" value={idExpiry} onChange={(e) => setIdExpiry(e.target.value)} className="bg-slate-900 border-slate-800 text-white text-xs" />
              </div>
            </div>

            <DeliveryDocUpload label="Pièce d'identité" hint="Lisible, entière et en cours de validité." field="manager_id" category="national_id" required value={idPhoto} onChange={setIdPhoto} />
            <DeliverySelfieCapture field="manager_selfie" value={selfie} onChange={setSelfie} />

            {company.profile_type === "manager" && (
              <>
                <DeliveryDocUpload label="Photo de l'entrepôt principal" field="warehouse" category="warehouse_photo" accept="image/*" value={warehouse} onChange={setWarehouse} />
                {company.has_tax_registration && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DeliveryDocUpload label="Attestation fiscale" field="tax_document" category="tax_document" value={taxDoc} onChange={setTaxDoc} />
                    <DeliveryDocUpload label="Extrait RCCM" field="trade_register" category="tax_document" value={tradeDoc} onChange={setTradeDoc} />
                  </div>
                )}
                <p className="text-[11px] text-slate-500">Pour corriger un livreur (permis, pièces), utilisez la liste « Livreurs » de la page de statut.</p>
              </>
            )}

            {license && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-white">Permis de conduire et véhicule</h4>
                <DriverLicenseFields value={license} onChange={setLicense} idExpiry={idExpiry} />
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-between border-t border-slate-800 pt-4">
            <Button variant="outline" onClick={() => navigate("/delivery/status")} className="bg-slate-900 hover:text-white border-slate-800 text-slate-300 text-xs">Annuler</Button>
            <Button onClick={handleResubmit} disabled={submitting || blocked} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs px-6 py-2 rounded-xl">
              {submitting ? "Envoi…" : "Resoumettre mon dossier"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
