import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ExternalLink,
  Eye,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  UserCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { deliveryService } from "@/lib/deliveryService";
import { getDriverLicenseIssues, VEHICLE_LICENSE_REQUIREMENTS } from "@/lib/vehicleLicenseMatcher";
import { allDossierGaps, companyDossierGaps, driverDossierGaps, formatCoordinates, idNeedsBackSide, mapsUrl, missingItemsMessage } from "@/lib/deliveryDossier";
import { DeliveryDocThumb } from "@/components/delivery/DeliveryDocThumb";
import { DeliveryAuditTimeline } from "@/components/delivery/DeliveryAuditTimeline";
import { DeliveryNotificationBell } from "@/components/delivery/DeliveryNotificationBell";
import {
  REJECTION_REASON_LABELS,
  type DeliveryCompany,
  type DeliveryDriver,
  type DeliveryVerificationStatus,
  type StructuredRejectionReasonCode,
} from "@/types/delivery";

type TabKey = DeliveryVerificationStatus | "all";

const STATUS_LABEL: Record<string, string> = {
  pending_verification: "En attente",
  under_review: "En examen",
  action_required: "Complément demandé",
  approved: "Approuvé",
  rejected: "Refusé",
  suspended: "Suspendu",
};

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  pending_verification: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  under_review: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  rejected: "bg-red-500/20 text-red-300 border-red-500/40",
  suspended: "bg-red-500/20 text-red-300 border-red-500/40",
  action_required: "bg-purple-500/20 text-purple-300 border-purple-500/40",
};

const DRIVER_STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvé",
  rejected: "Refusé",
  suspended: "Suspendu",
};

const CHECKLIST = [
  { key: "name", label: "Le nom et le prénom correspondent à la pièce d'identité" },
  { key: "dob", label: "La date de naissance correspond à la pièce" },
  { key: "doc", label: "La pièce est lisible, entière, non expirée et authentique" },
  { key: "face", label: "Le visage du selfie correspond à la photo de la pièce, qui est bien tenue" },
] as const;

const formatDate = (iso?: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

type DriverDecision = "approved" | "rejected" | "suspended";

export default function DeliveryAdminPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [applications, setApplications] = useState<DeliveryCompany[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<TabKey>("pending_verification");
  const [searchTerm, setSearchTerm] = useState("");

  const [selected, setSelected] = useState<DeliveryCompany | null>(null);
  const [open, setOpen] = useState(false);
  const [auditKey, setAuditKey] = useState(0);

  // Décision sur la structure
  const [reasonCode, setReasonCode] = useState<StructuredRejectionReasonCode | "">("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [cascade, setCascade] = useState(true);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  // Décision sur un livreur
  const [driverTarget, setDriverTarget] = useState<{ driver: DeliveryDriver; decision: DriverDecision } | null>(null);
  const [driverCode, setDriverCode] = useState<StructuredRejectionReasonCode | "">("");
  const [driverReason, setDriverReason] = useState("");
  const [driverNote, setDriverNote] = useState("");

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const [list, statusCounts] = await Promise.all([
        deliveryService.getAdminApplications(activeTab),
        deliveryService.getAdminStatusCounts(),
      ]);
      setApplications(list);
      setCounts(statusCounts);
      setSelected((current) => (current ? list.find((a) => a.id === current.id) ?? current : current));
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Erreur de chargement", description: "Impossible de récupérer les candidatures." });
    } finally {
      setLoading(false);
    }
  }, [activeTab, toast]);

  useEffect(() => {
    void fetchApplications();
  }, [fetchApplications]);

  const handleInspect = async (app: DeliveryCompany) => {
    setSelected(app);
    setReasonCode("");
    setReason("");
    setMessage("");
    setChecks({});
    setCascade(app.profile_type === "driver");
    setNote("");
    setOpen(true);
    try {
      setNote(await deliveryService.getInternalNote(app.id));
    } catch {
      /* note interne indisponible : le formulaire reste utilisable */
    }
  };

  const allChecked = CHECKLIST.every((c) => checks[c.key]);

  const decide = async (decision: "approved" | "rejected" | "action_required" | "suspended") => {
    if (!selected) return;
    if (decision === "approved" && !allChecked) {
      toast({ variant: "destructive", title: "Contrôle humain incomplet", description: "Cochez les quatre vérifications avant de valider." });
      return;
    }
    if ((decision === "rejected" || decision === "suspended") && (!reasonCode || !reason.trim())) {
      toast({ variant: "destructive", title: "Motif obligatoire", description: "Choisissez le code du motif et expliquez-le au candidat." });
      return;
    }
    if (decision === "action_required" && !message.trim()) {
      toast({ variant: "destructive", title: "Message requis", description: "Précisez au candidat ce qu'il doit fournir." });
      return;
    }

    setSubmitting(true);
    try {
      const checked = CHECKLIST.filter((c) => checks[c.key]).map((c) => c.label).join(" ; ");
      const fullNote = [note.trim(), decision === "approved" && checked ? `Contrôle manuel effectué : ${checked}.` : ""].filter(Boolean).join("\n");
      const result = await deliveryService.submitDecision({
        companyId: selected.id,
        decision,
        reasonCode: reasonCode || undefined,
        reason: reason.trim() || undefined,
        message: message.trim() || undefined,
        note: fullNote || undefined,
        cascadeDrivers: decision === "approved" && cascade,
      });

      const blocked = result.driversBlocked.length;
      toast({
        title: decision === "approved" ? "Structure validée" : decision === "action_required" ? "Complément demandé" : decision === "rejected" ? "Dossier refusé" : "Structure suspendue",
        description: [
          result.emailSent ? "E-mail envoyé au candidat." : result.emailNote === "not_configured" ? "E-mail non envoyé (envoi non configuré) ; le candidat est notifié dans l'application." : "E-mail non envoyé ; le candidat est notifié dans l'application.",
          result.driversApproved.length ? `${result.driversApproved.length} livreur(s) approuvé(s).` : "",
          blocked ? `${blocked} livreur(s) non conforme(s) laissé(s) en attente.` : "",
        ].filter(Boolean).join(" "),
      });
      setAuditKey((k) => k + 1);
      await fetchApplications();
      if (decision !== "approved" || !blocked) setOpen(false);
    } catch (err) {
      toast({ variant: "destructive", title: "Décision refusée", description: err instanceof Error ? err.message : "Erreur." });
    } finally {
      setSubmitting(false);
    }
  };

  const openDriverDecision = (driver: DeliveryDriver, decision: DriverDecision) => {
    setDriverTarget({ driver, decision });
    setDriverCode("");
    setDriverReason("");
    setDriverNote("");
  };

  /** Ouvre le refus d'un livreur avec le motif « verso manquant » déjà renseigné : l'administrateur n'a qu'à confirmer. */
  const requestDriverBack = (driver: DeliveryDriver) => {
    const what = driverDossierGaps(driver).map((g) => g.label.replace(`${driver.full_name} : `, "")).join(" et ");
    setDriverTarget({ driver, decision: "rejected" });
    setDriverCode("MISSING_BACK_SIDE");
    setDriverReason(`Merci d'importer : ${what}.`);
    setDriverNote("");
  };

  const submitDriverDecision = async () => {
    if (!driverTarget) return;
    const { driver, decision } = driverTarget;
    if (decision !== "approved" && (!driverCode || !driverReason.trim())) {
      toast({ variant: "destructive", title: "Motif obligatoire", description: "Choisissez le code du motif et expliquez-le." });
      return;
    }
    setSubmitting(true);
    try {
      const result = await deliveryService.submitDecision({
        driverId: driver.id,
        decision,
        reasonCode: driverCode || undefined,
        reason: driverReason.trim() || undefined,
        note: driverNote.trim() || undefined,
      });
      toast({
        title: decision === "approved" ? "Livreur approuvé" : decision === "rejected" ? "Livreur refusé" : "Livreur suspendu",
        description: result.emailSent ? "E-mail envoyé au candidat." : "Le candidat est notifié dans l'application.",
      });
      setDriverTarget(null);
      setAuditKey((k) => k + 1);
      await fetchApplications();
    } catch (err) {
      toast({ variant: "destructive", title: "Décision refusée", description: err instanceof Error ? err.message : "Erreur." });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredApps = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return applications;
    return applications.filter((app) =>
      [app.company_name, app.city, app.manager_name].some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [applications, searchTerm]);

  const selectedGaps = selected ? companyDossierGaps(selected) : [];
  const idExpired = !!selected?.kyc?.id_expiry && selected.kyc.id_expiry < new Date().toISOString().slice(0, 10);
  const tabs: Array<{ key: TabKey; label: string; style: string }> = [
    { key: "pending_verification", label: "En attente", style: "data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950" },
    { key: "action_required", label: "Complément", style: "data-[state=active]:bg-purple-500 data-[state=active]:text-white" },
    { key: "approved", label: "Validées", style: "data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950" },
    { key: "rejected", label: "Refusées", style: "data-[state=active]:bg-red-500 data-[state=active]:text-white" },
    { key: "suspended", label: "Suspendues", style: "data-[state=active]:bg-red-600 data-[state=active]:text-white" },
    { key: "all", label: "Toutes", style: "" },
  ];
  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase">
              <ShieldCheck className="w-4 h-4" /> Espace Fondation — Vérification Ecomfy Livraison
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-2">Back-Office Ecomfy Livraison</h1>
            <p className="text-xs text-slate-400">
              Contrôle humain des pièces d'identité, des selfies et des permis. Chaque décision est journalisée par le serveur et notifiée au candidat.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DeliveryNotificationBell onNew={() => void fetchApplications()} />
            <Button onClick={() => void fetchApplications()} variant="outline" size="sm" className="bg-slate-900 hover:text-white border-slate-800 text-slate-300 hover:bg-slate-900">
              <RefreshCw className="w-4 h-4 mr-2" /> Actualiser
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as TabKey)} className="w-full sm:w-auto">
            <TabsList className="bg-slate-900 border border-slate-800 p-1 flex-wrap h-auto">
              {tabs.map((t) => (
                <TabsTrigger key={t.key} value={t.key} className={`text-xs font-semibold ${t.style}`}>
                  {t.label} ({t.key === "all" ? totalCount : counts[t.key] ?? 0})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <Input
              aria-label="Rechercher un dossier"
              placeholder="Rechercher par nom, ville, gérant…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-800 text-xs text-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-500 text-sm">Chargement des candidatures…</div>
        ) : filteredApps.length === 0 ? (
          <div className="py-20 text-center text-slate-500 text-sm bg-slate-900/50 rounded-2xl border border-slate-800">
            Aucune candidature pour ce filtre.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredApps.map((app) => {
              const drivers = app.drivers ?? [];
              const approved = drivers.filter((d) => d.verification_status === "approved").length;
              return (
                <Card key={app.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                          <span className="truncate">{app.company_name}</span>
                          {app.trust_badge_active && <BadgeCheck className="w-5 h-5 text-emerald-400 shrink-0" aria-label="Partenaire vérifié" />}
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" /> {app.city}, {app.country}
                        </CardDescription>
                      </div>
                      <Badge className={`text-[10px] shrink-0 ${STATUS_STYLE[app.verification_status] ?? ""}`}>
                        {STATUS_LABEL[app.verification_status] ?? app.verification_status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                      <div className="flex justify-between text-slate-400"><span>Profil :</span><span className="text-white font-medium">{app.profile_type === "driver" ? "Livreur indépendant" : "Société"}</span></div>
                      <div className="flex justify-between text-slate-400"><span>Responsable :</span><span className="text-white font-medium">{app.manager_name}</span></div>
                      <div className="flex justify-between text-slate-400"><span>Livreurs approuvés :</span><span className="text-white font-bold">{approved}/{drivers.length}</span></div>
                      <div className="flex justify-between text-slate-400"><span>Reçu le :</span><span className="text-white">{new Date(app.verification_requested_at ?? app.created_at).toLocaleDateString("fr-FR")}</span></div>
                    </div>
                    {app.verification_status !== "approved" && allDossierGaps(app).length > 0 && (
                      <p className="flex items-start gap-1.5 text-[11px] text-amber-300"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> Dossier incomplet : {allDossierGaps(app).length} élément(s) à demander (verso, localisation).</p>
                    )}
                  </CardContent>
                  <CardFooter className="pt-3 border-t border-slate-800">
                    <Button onClick={() => void handleInspect(app)} variant="outline" size="sm" className="w-full bg-slate-900 border-slate-700 text-emerald-400 hover:bg-slate-800 hover:text-emerald-300">
                      <Eye className="w-4 h-4 mr-2" /> Examiner le dossier
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        {/* Examen d'un dossier */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-800 text-slate-100">
            {selected && (
              <>
                <DialogHeader className="border-b border-slate-800 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <DialogTitle className="text-xl font-bold text-white">{selected.company_name}</DialogTitle>
                      <DialogDescription className="text-xs text-slate-400">
                        {selected.profile_type === "driver" ? "Livreur indépendant" : "Société de livraison"} · {selected.city}, {selected.country} · {selected.manager_phone}
                      </DialogDescription>
                    </div>
                    <Badge className={`shrink-0 whitespace-nowrap ${STATUS_STYLE[selected.verification_status] ?? ""}`}>{STATUS_LABEL[selected.verification_status] ?? selected.verification_status}</Badge>
                  </div>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                  {/* Identité déclarée */}
                  <section>
                    <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2"><UserCheck className="w-4 h-4" /> Identité déclarée à comparer aux pièces</h3>
                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      {[
                        ["Prénom", selected.manager_first_name ?? "—"],
                        ["Nom", selected.manager_last_name ?? "—"],
                        ["Naissance", formatDate(selected.kyc?.date_of_birth)],
                        ["Pièce", `${selected.kyc?.id_type === "passport" ? "Passeport" : "CNI"} ${selected.kyc?.id_number ?? "—"}`],
                      ].map(([k, v]) => (
                        <div key={k} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                          <dt className="text-[10px] text-slate-500">{k}</dt>
                          <dd className="text-white font-medium break-words">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className={`mt-2 text-xs flex items-center gap-1.5 ${idExpired ? "text-rose-300" : "text-slate-400"}`}>
                      {idExpired && <AlertTriangle className="w-3.5 h-3.5" />} Expiration de la pièce : {formatDate(selected.kyc?.id_expiry)}{idExpired ? " — EXPIRÉE" : ""}
                    </p>
                  </section>

                  {/* Pièces (liens signés) */}
                  <section>
                    <h3 className="text-sm font-semibold text-emerald-400 mb-3">Pièces du responsable</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <DeliveryDocThumb path={selected.manager_id_photo_url} label={idNeedsBackSide(selected.kyc?.id_type) ? "Pièce d'identité — recto" : "Passeport"} />
                      {idNeedsBackSide(selected.kyc?.id_type) && <DeliveryDocThumb path={selected.manager_id_back_photo_url} label="Pièce d'identité — verso" />}
                      <DeliveryDocThumb path={selected.manager_selfie_with_id_url} label="Selfie avec la pièce" />
                      {selected.profile_type === "manager" && <DeliveryDocThumb path={selected.warehouse_photo_url} label="Entrepôt principal" />}
                    </div>
                  </section>

                  {/* Localisation de l'entrepôt */}
                  {selected.profile_type === "manager" && (
                    <section>
                      <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2"><MapPin className="w-4 h-4" /> Localisation de l'entrepôt</h3>
                      {selected.location ? (
                        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                          <p className="text-white font-medium">{formatCoordinates(selected.location)}</p>
                          <p className="text-slate-400">
                            {selected.location.source === "gps" ? "Position GPS du téléphone ou de l'ordinateur" : "Point placé sur la carte par le candidat"}
                            {selected.location.source === "gps" && selected.location.accuracy_m ? ` · précision ≈ ${selected.location.accuracy_m} m` : ""}
                            {" · adresse déclarée : "}{selected.headquarters_address}
                          </p>
                          <a href={mapsUrl(selected.location)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-emerald-300 hover:text-emerald-200 underline font-semibold">
                            Ouvrir dans Google Maps (itinéraire) <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ) : (
                        <p className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Localisation non renseignée : demandez-la au candidat avant de valider.</p>
                      )}
                    </section>
                  )}

                  {/* KYB */}
                  {selected.profile_type === "manager" && (
                    <section>
                      <h3 className="text-sm font-semibold text-emerald-400 mb-3">Structure (KYB)</h3>
                      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800"><dt className="text-[10px] text-slate-500">Immatriculée</dt><dd className="text-white font-medium">{selected.has_tax_registration ? "Oui" : "Non déclarée"}</dd></div>
                        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800"><dt className="text-[10px] text-slate-500">NIF</dt><dd className="text-white font-medium">{selected.tax_id_number ?? "—"}</dd></div>
                        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800"><dt className="text-[10px] text-slate-500">RCCM</dt><dd className="text-white font-medium">{selected.trade_register_number ?? "—"}</dd></div>
                        <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800"><dt className="text-[10px] text-slate-500">Adresse</dt><dd className="text-white font-medium break-words">{selected.headquarters_address}</dd></div>
                      </dl>
                      {(selected.tax_document_url || selected.trade_register_document_url) && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                          <DeliveryDocThumb path={selected.tax_document_url} label="Attestation fiscale" />
                          <DeliveryDocThumb path={selected.trade_register_document_url} label="Extrait RCCM" />
                        </div>
                      )}
                    </section>
                  )}

                  {/* Livreurs et permis */}
                  <section>
                    <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2"><Truck className="w-4 h-4" /> Livreurs et permis ({selected.drivers?.length ?? 0})</h3>
                    {!selected.drivers?.length ? (
                      <p className="p-3 rounded-lg bg-slate-950 text-xs text-slate-500">Aucun livreur rattaché.</p>
                    ) : (
                      <div className="space-y-3">
                        {selected.drivers.map((drv) => {
                          const issues = getDriverLicenseIssues({
                            vehicleType: drv.vehicle_type,
                            categories: drv.license_categories ?? [],
                            licenseExpiry: drv.license_expiry,
                            idExpiry: drv.id_expiry,
                          });
                          if (!drv.license_number) issues.push("Numéro de permis manquant.");
                          if (!drv.license_photo_url || !drv.national_id_photo_url || !drv.photo_url) issues.push("Photo, pièce d'identité ou permis manquant.");
                          const backGaps = driverDossierGaps(drv);
                          issues.push(...backGaps.map((g) => g.label.replace(`${drv.full_name} : `, "Manquant : ")));
                          return (
                            <div key={drv.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="text-xs">
                                  <p className="font-bold text-white text-sm">{drv.full_name}</p>
                                  <p className="text-slate-400">
                                    Né(e) le {formatDate(drv.date_of_birth)} · pièce {drv.id_number ?? "—"} (exp. {formatDate(drv.id_expiry)}) · {drv.phone}
                                  </p>
                                  <p className="text-slate-300 mt-1">
                                    {VEHICLE_LICENSE_REQUIREMENTS[drv.vehicle_type]?.label ?? drv.vehicle_type}{drv.vehicle_license_plate ? ` (${drv.vehicle_license_plate})` : ""} ·
                                    permis n° {drv.license_number ?? "—"} · catégories <strong>{drv.license_categories?.join(", ") || "aucune"}</strong> · exp. {formatDate(drv.license_expiry)}
                                  </p>
                                </div>
                                <Badge className={STATUS_STYLE[drv.verification_status === "pending" ? "pending_verification" : drv.verification_status] ?? ""}>
                                  {DRIVER_STATUS_LABEL[drv.verification_status] ?? drv.verification_status}{drv.is_active ? " · actif" : ""}
                                </Badge>
                              </div>

                              {issues.length > 0 ? (
                                <div role="alert" className="p-2.5 rounded-lg border border-rose-500/40 bg-rose-950/30 text-rose-200 text-xs space-y-1">
                                  {issues.map((i) => <p key={i} className="flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />{i}</p>)}
                                  <p className="text-rose-300/80">Le serveur refusera l'approbation tant que ces points ne sont pas corrigés.</p>
                                </div>
                              ) : (
                                <p className="text-xs text-emerald-300 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Catégories compatibles et dates valables. Comparez la photo du permis aux données déclarées.</p>
                              )}

                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                <DeliveryDocThumb path={drv.national_id_photo_url} label={idNeedsBackSide(drv.id_type) ? "Pièce — recto" : "Passeport"} />
                                {idNeedsBackSide(drv.id_type) && <DeliveryDocThumb path={drv.national_id_back_photo_url} label="Pièce — verso" />}
                                <DeliveryDocThumb path={drv.license_photo_url} label="Permis — recto" />
                                <DeliveryDocThumb path={drv.license_back_photo_url} label="Permis — verso" />
                                <DeliveryDocThumb path={drv.selfie_with_id_url ?? drv.photo_url} label="Selfie" />
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {drv.verification_status !== "approved" && (
                                  <Button size="sm" disabled={issues.length > 0} onClick={() => openDriverDecision(drv, "approved")} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs">Approuver</Button>
                                )}
                                {drv.verification_status !== "approved" && backGaps.length > 0 && (
                                  <Button size="sm" variant="outline" onClick={() => requestDriverBack(drv)} className="bg-slate-900 hover:text-white border-purple-500/40 text-purple-300 hover:bg-purple-950 text-xs">Demander le verso</Button>
                                )}
                                {drv.verification_status !== "rejected" && (
                                  <Button size="sm" variant="outline" onClick={() => openDriverDecision(drv, "rejected")} className="bg-slate-900 hover:text-white border-red-500/40 text-red-400 hover:bg-red-950 text-xs">Refuser</Button>
                                )}
                                {drv.verification_status === "approved" && (
                                  <Button size="sm" variant="outline" onClick={() => openDriverDecision(drv, "suspended")} className="bg-slate-900 hover:text-white border-amber-500/40 text-amber-300 hover:bg-amber-950 text-xs">Suspendre</Button>
                                )}
                              </div>
                              {drv.rejection_reason && drv.verification_status !== "approved" && (
                                <p className="text-[11px] text-rose-300">Motif enregistré : {drv.rejection_reason}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <DeliveryAuditTimeline companyId={selected.id} refreshKey={auditKey} />

                  {/* Décision sur la structure */}
                  <section className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400" /> Décision sur la structure</h3>

                    <fieldset className="space-y-2">
                      <legend className="text-xs text-slate-300 mb-1">Contrôle humain (obligatoire pour valider) :</legend>
                      {CHECKLIST.map((c) => (
                        <label key={c.key} className="flex items-start gap-2 text-xs text-slate-200 cursor-pointer">
                          <input type="checkbox" checked={!!checks[c.key]} onChange={(e) => setChecks((prev) => ({ ...prev, [c.key]: e.target.checked }))} className="mt-0.5 accent-emerald-500" />
                          {c.label}
                        </label>
                      ))}
                    </fieldset>

                    {(selected.drivers?.length ?? 0) > 0 && (
                      <label className="flex items-start gap-2 text-xs text-slate-200 cursor-pointer">
                        <input type="checkbox" checked={cascade} onChange={(e) => setCascade(e.target.checked)} className="mt-0.5 accent-emerald-500" />
                        En validant, approuver aussi les livreurs en attente dont le permis est conforme (les autres restent en attente)
                      </label>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-300">Code du motif (refus ou suspension)</Label>
                        <Select value={reasonCode} onValueChange={(v) => setReasonCode(v as StructuredRejectionReasonCode)}>
                          <SelectTrigger className="bg-slate-900 border-slate-800 text-xs text-white"><SelectValue placeholder="Sélectionner le motif…" /></SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                            {Object.entries(REJECTION_REASON_LABELS).map(([code, label]) => (
                              <SelectItem key={code} value={code} className="text-xs">{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="adm-reason" className="text-xs text-slate-300">Explication au candidat (refus ou suspension)</Label>
                        <Input id="adm-reason" placeholder="Ex: la photo de la CNI est tronquée sur les bords." value={reason} onChange={(e) => setReason(e.target.value)} className="bg-slate-900 border-slate-800 text-xs text-white" />
                      </div>
                    </div>

                    {allDossierGaps(selected).length > 0 && selected.verification_status !== "approved" && (
                      <div role="status" className="p-3 rounded-lg bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 space-y-2">
                        <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Éléments absents du dossier :</p>
                        {allDossierGaps(selected).map((g) => <p key={g.label}>• {g.label}</p>)}
                        <Button type="button" size="sm" variant="outline" onClick={() => setMessage(missingItemsMessage(allDossierGaps(selected)))}
                          className="bg-slate-900 hover:text-white border-purple-500/40 text-purple-300 hover:bg-purple-950 text-xs">
                          Pré-remplir la demande (verso, localisation…)
                        </Button>
                        <p className="text-amber-300/80">Relisez le message ci-dessous puis cliquez sur « Demander un complément ». Le serveur refuse de valider tant que ces éléments manquent.</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="adm-msg" className="text-xs text-slate-300">Message au candidat (complément demandé) — visible de lui</Label>
                      <Textarea id="adm-msg" placeholder="Ex: Merci d'envoyer un selfie où la pièce est entièrement visible." value={message} onChange={(e) => setMessage(e.target.value)} className="bg-slate-900 border-slate-800 text-xs text-white" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="adm-note" className="text-xs text-slate-300">Note interne — jamais visible du candidat</Label>
                      <Textarea id="adm-note" placeholder="Observations de l'équipe." value={note} onChange={(e) => setNote(e.target.value)} className="bg-slate-900 border-slate-800 text-xs text-white" />
                    </div>
                  </section>
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2 border-t border-slate-800 pt-4">
                  <Button type="button" variant="outline" onClick={() => void decide("action_required")} disabled={submitting} className="bg-slate-900 hover:text-white border-purple-500/40 text-purple-300 hover:bg-purple-950">Demander un complément</Button>
                  <Button type="button" variant="outline" onClick={() => void decide("rejected")} disabled={submitting} className="bg-slate-900 hover:text-white border-red-500/40 text-red-400 hover:bg-red-950"><XCircle className="w-4 h-4 mr-1" /> Refuser</Button>
                  {selected.verification_status === "approved" && (
                    <Button type="button" variant="outline" onClick={() => void decide("suspended")} disabled={submitting} className="bg-slate-900 hover:text-white border-amber-500/40 text-amber-300 hover:bg-amber-950">Suspendre</Button>
                  )}
                  {selected.verification_status !== "approved" && (
                    <Button type="button" onClick={() => void decide("approved")} disabled={submitting || !allChecked || selectedGaps.length > 0} title={selectedGaps.length > 0 ? "Verso ou localisation manquant : demandez-le d'abord au candidat." : undefined} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold"><CheckCircle2 className="w-4 h-4 mr-1" /> Valider et attribuer le badge</Button>
                  )}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Décision sur un livreur */}
        <Dialog open={!!driverTarget} onOpenChange={(o) => { if (!o) setDriverTarget(null); }}>
          <DialogContent className="max-w-lg bg-slate-900 border-slate-800 text-slate-100">
            {driverTarget && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-white">
                    {driverTarget.decision === "approved" ? "Approuver" : driverTarget.decision === "rejected" ? "Refuser" : "Suspendre"} {driverTarget.driver.full_name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400">
                    {driverTarget.decision === "approved"
                      ? "Le livreur devient actif et peut recevoir des courses. Vérifiez la photo du permis avant de confirmer."
                      : "Le candidat verra le motif et pourra corriger ce livreur."}
                  </DialogDescription>
                </DialogHeader>
                {driverTarget.decision !== "approved" && (
                  <div className="space-y-3">
                    <Select value={driverCode} onValueChange={(v) => setDriverCode(v as StructuredRejectionReasonCode)}>
                      <SelectTrigger aria-label="Code du motif" className="bg-slate-950 border-slate-800 text-xs text-white"><SelectValue placeholder="Code du motif…" /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-800 text-white text-xs">
                        {Object.entries(REJECTION_REASON_LABELS).map(([code, label]) => <SelectItem key={code} value={code} className="text-xs">{label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input aria-label="Explication au candidat" placeholder="Explication visible du candidat" value={driverReason} onChange={(e) => setDriverReason(e.target.value)} className="bg-slate-950 border-slate-800 text-xs text-white" />
                  </div>
                )}
                <Textarea aria-label="Note interne" placeholder="Note interne (jamais visible du candidat)" value={driverNote} onChange={(e) => setDriverNote(e.target.value)} className="bg-slate-950 border-slate-800 text-xs text-white" />
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setDriverTarget(null)} className="bg-slate-900 hover:text-white border-slate-700 text-slate-300 text-xs">Annuler</Button>
                  <Button onClick={() => void submitDriverDecision()} disabled={submitting} className={driverTarget.decision === "approved" ? "bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs" : "bg-red-600 hover:bg-red-700 text-white text-xs"}>
                    {submitting ? "Envoi…" : "Confirmer"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
