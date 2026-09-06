import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Truck, 
  ShieldCheck, 
  Building2, 
  Users, 
  FileText, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Upload, 
  AlertCircle,
  HelpCircle,
  MapPin,
  Phone,
  Store,
  Sparkles,
  Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { deliveryService, RegisterCompanyPayload } from "@/lib/deliveryService";

// List of African & International Countries for selection
const COUNTRIES_LIST = [
  { code: "CI", name: "Côte d'Ivoire", taxName: "DFE & Registre de Commerce" },
  { code: "SN", name: "Sénégal", taxName: "NINEA & RCCM" },
  { code: "CM", name: "Cameroun", taxName: "Niu & Carte Contribuables" },
  { code: "BF", name: "Burkina Faso", taxName: "IFU & RCCM" },
  { code: "ML", name: "Mali", taxName: "NIF & RCCM" },
  { code: "TG", name: "Togo", taxName: "NIF & Carte Professionnelle" },
  { code: "BJ", name: "Bénin", taxName: "IFU & RCCM" },
  { code: "GA", name: "Gabon", taxName: "NIF & Registre Commerce" },
  { code: "CD", name: "RDC (Congo)", taxName: "Id. Nat & Id. Fiscale" },
  { code: "FR", name: "France", taxName: "SIRET / SIREN" },
  { code: "OTHER", name: "Autre pays (International)", taxName: "Registre fiscal national" },
];

export default function DeliveryRegisterPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState<{
    company_name: string;
    country: string;
    country_code: string;
    city: string;
    headquarters_address: string;
    manager_name: string;
    manager_phone: string;
    manager_whatsapp: string;
    manager_photo_url: string;
    manager_id_photo_url: string;
    owner_photo_url: string;
    warehouse_photo_url: string;
    has_tax_registration: boolean;
    tax_id_number: string;
    tax_document_url: string;
    trade_register_number: string;
    covered_cities_str: string;
  }>({
    company_name: "",
    country: "Côte d'Ivoire",
    country_code: "CI",
    city: "Abidjan",
    headquarters_address: "",
    manager_name: "",
    manager_phone: "",
    manager_whatsapp: "",
    manager_photo_url: "",
    manager_id_photo_url: "",
    owner_photo_url: "",
    warehouse_photo_url: "",
    has_tax_registration: false,
    tax_id_number: "",
    tax_document_url: "",
    trade_register_number: "",
    covered_cities_str: "Abidjan, Bouaké, Yamoussoukro, San-Pédro",
  });

  // Storage Hubs State
  const [hubs, setHubs] = useState<Array<{ city: string; address: string; hub_name: string; phone: string; photo_url: string }>>([
    { city: "Abidjan", address: "Koumassi Boulevard de Marseille", hub_name: "Entrepôt Principal Abidjan", phone: "", photo_url: "" }
  ]);

  // Drivers State
  const [drivers, setDrivers] = useState<Array<{ full_name: string; phone: string; whatsapp: string; vehicle_type: string; photo_url: string; national_id_photo_url: string; license_photo_url: string }>>([
    { full_name: "", phone: "", whatsapp: "", vehicle_type: "motorcycle", photo_url: "", national_id_photo_url: "", license_photo_url: "" }
  ]);

  // Helper for simulated / Supabase file upload
  const handleFileUpload = async (
    file: File, 
    onSuccess: (url: string) => void
  ) => {
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `delivery_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `delivery-docs/${fileName}`;

      // Upload to public Supabase bucket 'shop-assets' or 'delivery-docs'
      const { data, error } = await supabase.storage
        .from('shop-assets')
        .upload(filePath, file);

      if (error) {
        // Fallback to Base64 data URL for preview if bucket fails
        const reader = new FileReader();
        reader.onloadend = () => {
          onSuccess(reader.result as string);
          setUploading(false);
          toast({ title: "Image chargée", description: "Aperçu de l'image prêt." });
        };
        reader.readAsDataURL(file);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from('shop-assets')
        .getPublicUrl(filePath);

      onSuccess(publicUrlData.publicUrl);
      toast({ title: "Document envoyé avec succès", description: "Image stockée de façon sécurisée." });
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Erreur lors du chargement", description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const addHub = () => {
    setHubs([...hubs, { city: "", address: "", hub_name: "", phone: "", photo_url: "" }]);
  };

  const removeHub = (index: number) => {
    setHubs(hubs.filter((_, i) => i !== index));
  };

  const addDriver = () => {
    setDrivers([...drivers, { full_name: "", phone: "", whatsapp: "", vehicle_type: "motorcycle", photo_url: "", national_id_photo_url: "", license_photo_url: "" }]);
  };

  const removeDriver = (index: number) => {
    if (drivers.length <= 1) {
      toast({ variant: "destructive", title: "Au moins 1 livreur", description: "Vous devez ajouter au moins un livreur rattaché." });
      return;
    }
    setDrivers(drivers.filter((_, i) => i !== index));
  };

  const validateStep = (step: number): boolean => {
    if (step === 1) {
      if (!formData.company_name.trim() || !formData.manager_name.trim() || !formData.manager_phone.trim() || !formData.manager_whatsapp.trim()) {
        toast({ variant: "destructive", title: "Champs requis manquants", description: "Veuillez remplir le nom de l'entreprise, le responsable et ses coordonnées WhatsApp." });
        return false;
      }
    } else if (step === 2) {
      if (!formData.headquarters_address.trim() || !formData.warehouse_photo_url) {
        toast({ variant: "destructive", title: "Entrepôt requis", description: "Veuillez indiquer l'adresse de l'entrepôt principal et charger sa photo." });
        return false;
      }
    } else if (step === 3) {
      for (let i = 0; i < drivers.length; i++) {
        const d = drivers[i];
        if (!d.full_name.trim() || !d.phone.trim() || !d.photo_url || !d.national_id_photo_url) {
          toast({ variant: "destructive", title: `Livreur #${i+1} incomplet`, description: "Chaque livreur doit avoir un nom, téléphone, photo de profil et photo de pièce d'identité." });
          return false;
        }
      }
    } else if (step === 4) {
      if (!formData.manager_photo_url || !formData.manager_id_photo_url || !formData.owner_photo_url) {
        toast({ variant: "destructive", title: "Documents du responsable manquants", description: "Veuillez fournir les photos de profil et pièces d'identité du gérant/propriétaire." });
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(4)) return;

    setSubmitting(true);
    try {
      const citiesArray = formData.covered_cities_str
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      const selectedCountryObj = COUNTRIES_LIST.find((c) => c.code === formData.country_code);

      const payload: RegisterCompanyPayload = {
        company_name: formData.company_name,
        country: selectedCountryObj?.name || formData.country,
        country_code: formData.country_code,
        city: formData.city,
        headquarters_address: formData.headquarters_address,
        manager_name: formData.manager_name,
        manager_phone: formData.manager_phone,
        manager_whatsapp: formData.manager_whatsapp,
        manager_photo_url: formData.manager_photo_url,
        manager_id_photo_url: formData.manager_id_photo_url,
        owner_photo_url: formData.owner_photo_url,
        warehouse_photo_url: formData.warehouse_photo_url,
        has_tax_registration: formData.has_tax_registration,
        tax_id_number: formData.tax_id_number,
        tax_document_url: formData.tax_document_url,
        trade_register_number: formData.trade_register_number,
        covered_cities: citiesArray.length > 0 ? citiesArray : [formData.city],
        total_drivers_count: drivers.length,
        hubs: hubs.filter((h) => h.city.trim() && h.address.trim()),
        drivers: drivers,
      };

      await deliveryService.registerDeliveryCompany(payload);

      toast({
        title: "Candidature soumise avec succès !",
        description: "Votre dossier 'Ecomfy Livraison' a été transmis à la Fondation Ecomfy. Votre statut est 'En attente de vérification'.",
      });

      navigate("/delivery/status");
    } catch (err: any) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Erreur lors de la soumission",
        description: err.message || "Une erreur est survenue lors de l'enregistrement.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCountryInfo = COUNTRIES_LIST.find((c) => c.code === formData.country_code) || COUNTRIES_LIST[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Header Banner */}
      <div className="max-w-4xl mx-auto mb-8 text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold tracking-wide uppercase">
          <Truck className="w-4 h-4" /> Ecomfy Livraison — Partenaires Officiels
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-emerald-400 bg-clip-text text-transparent">
          Devenez une Structure de Livraison Certifiée Ecomfy
        </h1>
        <p className="text-slate-400 text-base max-w-2xl mx-auto">
          Rejoignez le réseau de confiance Ecomfy. Recevez des milliers de commandes d'e-commerçants vérifiés et gérez les livraisons avec paiements sécurisés.
        </p>

        {/* Security Alert Badge */}
        <div className="mt-4 p-4 rounded-xl bg-slate-900/80 border border-amber-500/30 text-amber-300 text-sm flex items-start gap-3 text-left max-w-2xl mx-auto shadow-lg backdrop-blur-md">
          <ShieldCheck className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">Vérification Rigoureuse par la Fondation Ecomfy :</span>
            <span className="block text-slate-300 text-xs mt-1">
              Les structures partenaires manipulant les encaissements à la livraison (COD), vos pièces justificatives seront auditées par notre équipe avant toute activation.
            </span>
          </div>
        </div>
      </div>

      {/* Stepper Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="grid grid-cols-4 gap-2 sm:gap-4 relative">
          {[
            { step: 1, title: "Entreprise & Gérant", icon: Building2 },
            { step: 2, title: "Entrepôts & Villes", icon: MapPin },
            { step: 3, title: "Livreurs & Pièces", icon: Users },
            { step: 4, title: "Identité & Validation", icon: ShieldCheck },
          ].map((s) => {
            const Icon = s.icon;
            const isActive = currentStep === s.step;
            const isDone = currentStep > s.step;
            return (
              <div
                key={s.step}
                className={`flex flex-col items-center p-3 rounded-xl border transition-all text-center ${
                  isActive
                    ? "bg-emerald-950/40 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-950"
                    : isDone
                    ? "bg-slate-900 border-slate-700 text-slate-300"
                    : "bg-slate-900/40 border-slate-800 text-slate-600"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm mb-1 ${
                    isActive
                      ? "bg-emerald-500 text-slate-950"
                      : isDone
                      ? "bg-slate-700 text-emerald-400"
                      : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-5 h-5" /> : s.step}
                </div>
                <span className="text-xs font-medium hidden sm:block truncate max-w-full">{s.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Wizard Form Card */}
      <Card className="max-w-4xl mx-auto bg-slate-900/90 border-slate-800 shadow-2xl backdrop-blur-xl">
        <CardHeader className="border-b border-slate-800">
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            {currentStep === 1 && <><Building2 className="w-5 h-5 text-emerald-400" /> Étape 1 : Informations Générales & Responsable</>}
            {currentStep === 2 && <><MapPin className="w-5 h-5 text-emerald-400" /> Étape 2 : Entrepôts & Villes de Couverture</>}
            {currentStep === 3 && <><Users className="w-5 h-5 text-emerald-400" /> Étape 3 : Liste des Livreurs Rattachés</>}
            {currentStep === 4 && <><ShieldCheck className="w-5 h-5 text-emerald-400" /> Étape 4 : Pièces d'Identité & Finalisation</>}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {currentStep === 1 && "Veuillez saisir les coordonnées de votre société et de son responsable principal."}
            {currentStep === 2 && "Déclarez vos points de stockage et les villes desservies par vos livreurs."}
            {currentStep === 3 && "Renseignez les pièces d'identité de chaque livreur rattaché à votre structure."}
            {currentStep === 4 && "Chargez la photo et la pièce d'identité du gérant/fondateur."}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* STEP 1: General Info & Manager */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-200">Nom de la Structure de Livraison *</Label>
                  <Input
                    placeholder="Ex: Express Logistics CI"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-200">Pays d'Opération Principal *</Label>
                  <select
                    value={formData.country_code}
                    onChange={(e) => {
                      const sel = COUNTRIES_LIST.find((c) => c.code === e.target.value);
                      setFormData({
                        ...formData,
                        country_code: e.target.value,
                        country: sel ? sel.name : "International",
                      });
                    }}
                    className="w-full h-10 rounded-md bg-slate-950 border border-slate-800 text-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {COUNTRIES_LIST.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-200">Ville du Siège Social *</Label>
                  <Input
                    placeholder="Ex: Abidjan, Dakar, Douala"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-200">Nom & Prénom du Responsable / Gérant *</Label>
                  <Input
                    placeholder="Ex: Koffi Marc"
                    value={formData.manager_name}
                    onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-200">Téléphone Direct du Gérant *</Label>
                  <Input
                    placeholder="+225 0700000000"
                    value={formData.manager_phone}
                    onChange={(e) => setFormData({ ...formData, manager_phone: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-200">Numéro WhatsApp Professionnel *</Label>
                  <Input
                    placeholder="+225 0700000000"
                    value={formData.manager_whatsapp}
                    onChange={(e) => setFormData({ ...formData, manager_whatsapp: e.target.value })}
                    className="bg-slate-950 border-slate-800 text-white"
                  />
                </div>
              </div>

              {/* Optional Country Tax Fields */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-400" /> Documents Fiscaux & Registre
                    </h4>
                    <p className="text-xs text-slate-400">
                      Champs optionnels selon les exigences de votre pays ({selectedCountryInfo.taxName})
                    </p>
                  </div>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
                    Facultatif
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-300">Numéro du Registre de Commerce (ex: RCCM / SIRET)</Label>
                    <Input
                      placeholder="Ex: CI-ABJ-03-2024-B12"
                      value={formData.trade_register_number}
                      onChange={(e) => setFormData({ ...formData, trade_register_number: e.target.value })}
                      className="bg-slate-900 border-slate-800 text-white text-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-slate-300">Numéro d'Immatriculation Fiscale (ex: DFE / NIF)</Label>
                    <Input
                      placeholder="Ex: 2400981X"
                      value={formData.tax_id_number}
                      onChange={(e) => setFormData({ ...formData, tax_id_number: e.target.value })}
                      className="bg-slate-900 border-slate-800 text-white text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Storage Hubs & Covered Cities */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-slate-200">Adresse Complète du Siège / Entrepôt Principal *</Label>
                <Input
                  placeholder="Ex: Abidjan, Marcory Zone 4, Rue des Brasseries"
                  value={formData.headquarters_address}
                  onChange={(e) => setFormData({ ...formData, headquarters_address: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-white"
                />
              </div>

              {/* Warehouse Photo Upload */}
              <div className="space-y-2">
                <Label className="text-slate-200">Photo de l'Entrepôt / Point de Stockage Principal *</Label>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
                  {formData.warehouse_photo_url ? (
                    <img
                      src={formData.warehouse_photo_url}
                      alt="Entrepôt"
                      className="w-24 h-20 object-cover rounded-lg border border-slate-700"
                    />
                  ) : (
                    <div className="w-24 h-20 rounded-lg bg-slate-900 border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500">
                      <Store className="w-6 h-6 mb-1" />
                      <span className="text-[10px]">Aucune photo</span>
                    </div>
                  )}

                  <div className="flex-1 space-y-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, (url) => setFormData({ ...formData, warehouse_photo_url: url }));
                      }}
                      className="bg-slate-900 border-slate-800 text-xs text-slate-300"
                    />
                    <p className="text-[11px] text-slate-400">
                      Photo claire montrant la devanture ou l'intérieur de l'entrepôt.
                    </p>
                  </div>
                </div>
              </div>

              {/* Storage Hubs per City */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Points de Stockage / Hubs par Ville</h3>
                    <p className="text-xs text-slate-400">Ajoutez chaque agence ou point de relais disponible.</p>
                  </div>
                  <Button
                    type="button"
                    onClick={addHub}
                    variant="outline"
                    size="sm"
                    className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-950"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Ajouter un Hub
                  </Button>
                </div>

                {hubs.map((hub, index) => (
                  <div key={index} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 relative">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-400">Hub / Point de relais #{index + 1}</span>
                      {hubs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeHub(index)}
                          className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Supprimer
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        placeholder="Ville (Ex: Bouaké)"
                        value={hub.city}
                        onChange={(e) => {
                          const updated = [...hubs];
                          updated[index].city = e.target.value;
                          setHubs(updated);
                        }}
                        className="bg-slate-900 border-slate-800 text-xs text-white"
                      />
                      <Input
                        placeholder="Adresse exacte du hub"
                        value={hub.address}
                        onChange={(e) => {
                          const updated = [...hubs];
                          updated[index].address = e.target.value;
                          setHubs(updated);
                        }}
                        className="bg-slate-900 border-slate-800 text-xs text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Covered Cities */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <Label className="text-slate-200">Liste des Villes Couvertes par vos Livraisons (séparées par des virgules) *</Label>
                <Input
                  placeholder="Ex: Abidjan, Bouaké, Yamoussoukro, San-Pédro, Korhogo"
                  value={formData.covered_cities_str}
                  onChange={(e) => setFormData({ ...formData, covered_cities_str: e.target.value })}
                  className="bg-slate-950 border-slate-800 text-white"
                />
                <p className="text-xs text-slate-400">
                  Cette liste permettra au système Ecomfy d'orienter automatiquement les vendeurs vers votre structure en priorité.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: Drivers List & Identification */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-200">Livreurs Rattachés à la Structure</h3>
                  <p className="text-xs text-slate-400">Pour chaque livreur : photo, pièce d'identité et permis de conduire (si véhicule à moteur).</p>
                </div>
                <Button
                  type="button"
                  onClick={addDriver}
                  variant="outline"
                  size="sm"
                  className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-950"
                >
                  <Plus className="w-4 h-4 mr-1" /> Ajouter un Livreur
                </Button>
              </div>

              {drivers.map((driver, index) => (
                <div key={index} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                      <Users className="w-4 h-4" /> Livreur #{index + 1}
                    </span>
                    {drivers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDriver(index)}
                        className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Retirer ce livreur
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-300">Nom & Prénom *</Label>
                      <Input
                        placeholder="Ex: Yao Jean"
                        value={driver.full_name}
                        onChange={(e) => {
                          const updated = [...drivers];
                          updated[index].full_name = e.target.value;
                          setDrivers(updated);
                        }}
                        className="bg-slate-900 border-slate-800 text-xs text-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-300">Téléphone *</Label>
                      <Input
                        placeholder="+225 0100000000"
                        value={driver.phone}
                        onChange={(e) => {
                          const updated = [...drivers];
                          updated[index].phone = e.target.value;
                          setDrivers(updated);
                        }}
                        className="bg-slate-900 border-slate-800 text-xs text-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-slate-300">Véhicule</Label>
                      <select
                        value={driver.vehicle_type}
                        onChange={(e) => {
                          const updated = [...drivers];
                          updated[index].vehicle_type = e.target.value;
                          setDrivers(updated);
                        }}
                        className="w-full h-9 rounded-md bg-slate-900 border border-slate-800 text-white text-xs px-2"
                      >
                        <option value="motorcycle">Moto</option>
                        <option value="car">Voiture</option>
                        <option value="tricycle">Tricycle</option>
                        <option value="van">Camionnette / Van</option>
                      </select>
                    </div>
                  </div>

                  {/* Driver Image Uploads */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    {/* Photo Livreur */}
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-300">Photo du Livreur *</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileUpload(file, (url) => {
                              const updated = [...drivers];
                              updated[index].photo_url = url;
                              setDrivers(updated);
                            });
                          }
                        }}
                        className="bg-slate-900 border-slate-800 text-[10px] text-slate-300"
                      />
                      {driver.photo_url && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> Photo chargée
                        </div>
                      )}
                    </div>

                    {/* CNI Livreur */}
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-300">Pièce d'Identité (CNI/Passeport) *</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileUpload(file, (url) => {
                              const updated = [...drivers];
                              updated[index].national_id_photo_url = url;
                              setDrivers(updated);
                            });
                          }
                        }}
                        className="bg-slate-900 border-slate-800 text-[10px] text-slate-300"
                      />
                      {driver.national_id_photo_url && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> CNI chargée
                        </div>
                      )}
                    </div>

                    {/* Permis Livreur */}
                    <div className="space-y-1">
                      <Label className="text-[11px] text-slate-300">Permis de Conduire (Facultatif)</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileUpload(file, (url) => {
                              const updated = [...drivers];
                              updated[index].license_photo_url = url;
                              setDrivers(updated);
                            });
                          }
                        }}
                        className="bg-slate-900 border-slate-800 text-[10px] text-slate-300"
                      />
                      {driver.license_photo_url && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" /> Permis chargé
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STEP 4: Manager/Owner Verification Documents */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" /> Documents Officiels du Gérant & Propriétaire
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Photo de profil Gérant */}
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-200">Photo de Profil du Gérant *</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, (url) => setFormData({ ...formData, manager_photo_url: url }));
                      }}
                      className="bg-slate-900 border-slate-800 text-xs text-slate-300"
                    />
                    {formData.manager_photo_url && (
                      <img src={formData.manager_photo_url} alt="Gérant" className="w-20 h-20 rounded-lg object-cover border border-emerald-500/40" />
                    )}
                  </div>

                  {/* Photo CNI Gérant */}
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-200">Pièce d'Identité du Gérant *</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, (url) => setFormData({ ...formData, manager_id_photo_url: url }));
                      }}
                      className="bg-slate-900 border-slate-800 text-xs text-slate-300"
                    />
                    {formData.manager_id_photo_url && (
                      <img src={formData.manager_id_photo_url} alt="CNI Gérant" className="w-20 h-20 rounded-lg object-cover border border-emerald-500/40" />
                    )}
                  </div>

                  {/* Photo du Propriétaire */}
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-200">Photo du Propriétaire / Fondateur *</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, (url) => setFormData({ ...formData, owner_photo_url: url }));
                      }}
                      className="bg-slate-900 border-slate-800 text-xs text-slate-300"
                    />
                    {formData.owner_photo_url && (
                      <img src={formData.owner_photo_url} alt="Propriétaire" className="w-20 h-20 rounded-lg object-cover border border-emerald-500/40" />
                    )}
                  </div>
                </div>
              </div>

              {/* Terms & Certification Confirmation */}
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 text-xs space-y-2">
                <div className="flex items-center gap-2 font-semibold text-emerald-400 text-sm">
                  <CheckCircle2 className="w-4 h-4" /> Certification sur l'honneur
                </div>
                <p>
                  En soumettant cette demande, vous certifiez l'exactitude des informations et documents fournis. Vous vous engagez à reverser promptement les encaissements COD aux vendeurs de la plateforme Ecomfy selon le cycle de reversement convenu.
                </p>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t border-slate-800 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrev}
            disabled={currentStep === 1 || submitting}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Précédent
          </Button>

          {currentStep < 4 ? (
            <Button
              type="button"
              onClick={handleNext}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold"
            >
              Étape Suivante <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || uploading}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-extrabold shadow-lg shadow-emerald-950/50"
            >
              {submitting ? "Soumission en cours..." : "Soumettre à la Fondation Ecomfy"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
