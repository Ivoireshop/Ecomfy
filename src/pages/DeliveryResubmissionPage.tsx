import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ShieldCheck, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  FileCheck, 
  RefreshCw, 
  ArrowLeft,
  Truck,
  Camera
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { deliveryService } from "@/lib/deliveryService";
import { validateDocument, compressImageForUpload } from "@/lib/documentValidation";
import { DeliveryCompany } from "@/types/delivery";

export default function DeliveryResubmissionPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [company, setCompany] = useState<DeliveryCompany | null>(null);

  // Replacement Files State
  const [newIdPhotoUrl, setNewIdPhotoUrl] = useState<string>("");
  const [newLicensePhotoUrl, setNewLicensePhotoUrl] = useState<string>("");
  const [newSelfieUrl, setNewSelfieUrl] = useState<string>("");
  const [newWarehouseUrl, setNewWarehouseUrl] = useState<string>("");

  const fetchCompanyData = async () => {
    setLoading(true);
    try {
      const data = await deliveryService.getMyCompany();
      setCompany(data);
      if (data) {
        setNewIdPhotoUrl(data.manager_id_photo_url || "");
        setNewWarehouseUrl(data.warehouse_photo_url || "");
        if (data.drivers && data.drivers[0]) {
          setNewLicensePhotoUrl(data.drivers[0].license_photo_url || "");
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const handleFileUpload = async (file: File, onSuccess: (url: string) => void, category: string) => {
    try {
      const validation = await validateDocument(file, category as any);
      if (!validation.valid) {
        toast({ variant: "destructive", title: "Document non conforme", description: validation.reason });
        return;
      }

      const compressed = await compressImageForUpload(file);
      // Simulate file URL upload
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        onSuccess(url);
        toast({ title: "Nouveau document chargé", description: "Document prêt pour re-vérification." });
      };
      reader.readAsDataURL(compressed);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur d'upload", description: e.message });
    }
  };

  const handleResubmit = async () => {
    if (!company) return;
    setSubmitting(true);
    try {
      await deliveryService.processIdentityVerification({
        companyId: company.id,
        userEmail: "gerant@ecomfy.cloud",
        userName: company.manager_name,
        verificationStatus: "pending_verification",
        rejectionReason: undefined
      });

      toast({
        title: "Dossier resoumis avec succès !",
        description: "Vos nouveaux documents ont été enregistrés et transmis pour re-vérification."
      });

      navigate("/delivery/status");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur de resoumission", description: e.message });
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/delivery/status")}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour au Statut
          </Button>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
            <RefreshCw className="w-3.5 h-3.5" /> Correction Sélective de Documents
          </div>
        </div>

        {/* Status Alert */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-emerald-400" /> Resoumission des Documents Rejetés
            </CardTitle>
            <CardDescription className="text-slate-300 text-xs">
              Remplacez uniquement les pièces ayant fait l'objet d'un rejet. Les pièces validées restent enregistrées.
            </CardDescription>

            {company.rejection_reason && (
              <div className="mt-3 p-3.5 rounded-xl bg-rose-950/40 border border-rose-900 text-rose-200 text-xs">
                <span className="font-bold text-rose-300 block mb-1">Raison indiquée par le service de sécurité :</span>
                <p>{company.rejection_reason}</p>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-6 pt-2">
            {/* Document 1: CNI / Passeport */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">1. Pièce d'Identité Officielle (CNI / Passeport)</h4>
                  <p className="text-[11px] text-slate-400">Assurez-vous que le document est lisible, non expiré et de bonne résolution.</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {newIdPhotoUrl ? "Prêt à remplacer" : "Inchangé"}
                </Badge>
              </div>

              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f, setNewIdPhotoUrl, 'national_id');
                  }}
                  className="bg-slate-900 border-slate-800 text-xs text-slate-300"
                />
              </div>
            </div>

            {/* Document 2: Permis de conduire */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">2. Permis de Conduire (Catégorie A / B)</h4>
                  <p className="text-[11px] text-slate-400">Catégorie A obligatoire pour Moto, Catégorie B pour Voiture.</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {newLicensePhotoUrl ? "Prêt à remplacer" : "Inchangé"}
                </Badge>
              </div>

              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f, setNewLicensePhotoUrl, 'driver_license');
                  }}
                  className="bg-slate-900 border-slate-800 text-xs text-slate-300"
                />
              </div>
            </div>

            {/* Document 3: Selfie Liveness avec pièce en main */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">3. Nouveau Selfie de Vérification en Direct</h4>
                  <p className="text-[11px] text-slate-400">Votre visage et votre document doivent être clairement visibles.</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {newSelfieUrl ? "Selfie capturé" : "Non modifié"}
                </Badge>
              </div>

              <div className="flex items-center gap-3">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f, setNewSelfieUrl, 'profile_photo');
                  }}
                  className="bg-slate-900 border-slate-800 text-xs text-slate-300"
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between border-t border-slate-800 pt-4">
            <Button
              variant="outline"
              onClick={() => navigate("/delivery/status")}
              className="border-slate-800 text-slate-300 text-xs"
            >
              Annuler
            </Button>

            <Button
              onClick={handleResubmit}
              disabled={submitting}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs px-6 py-2 rounded-xl"
            >
              {submitting ? "Resoumission..." : "Resoumettre mes Documents pour Analyse"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
