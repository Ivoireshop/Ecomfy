import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Truck, 
  Building2, 
  Users, 
  ArrowRight,
  RefreshCw,
  PhoneCall
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { deliveryService } from "@/lib/deliveryService";
import { DeliveryCompany } from "@/types/delivery";

export default function DeliveryStatusPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [company, setCompany] = useState<DeliveryCompany | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const data = await deliveryService.getMyCompany();
      setCompany(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-slate-400 text-sm">Vérification de votre dossier de candidature...</p>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-900 border-slate-800 text-center">
          <CardHeader>
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-2 text-slate-400">
              <Truck className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl font-bold">Aucun Dossier Enregistré</CardTitle>
            <CardDescription className="text-slate-400">
              Vous n'avez pas encore soumis de demande de partenariat de livraison sur Ecomfy.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button
              onClick={() => navigate("/delivery/register")}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold"
            >
              Soumettre ma Candidature
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const isApproved = company.verification_status === "approved";
  const isPending = company.verification_status === "pending_verification" || company.verification_status === "under_review";
  const isRejected = company.verification_status === "rejected";
  const isActionReq = company.verification_status === "action_required";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold">
            <Truck className="w-4 h-4 text-emerald-400" /> Module Ecomfy Livraison
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Statut de Candidature — {company.company_name}
          </h1>
          <p className="text-xs text-slate-400">
            Identifiant dossier : <code className="text-emerald-400">{company.id}</code>
          </p>
        </div>

        {/* Main Status Card */}
        <Card className="bg-slate-900/90 border-slate-800 shadow-2xl backdrop-blur-xl">
          <CardHeader className="text-center border-b border-slate-800 pb-6">
            {isPending && (
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 animate-pulse">
                  <Clock className="w-8 h-8" />
                </div>
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-sm px-3 py-1">
                  En Attente de Vérification par la Fondation
                </Badge>
                <CardTitle className="text-xl font-bold text-white">
                  Dossier en Cours d'Examen Humain
                </CardTitle>
                <CardDescription className="text-slate-300 text-xs max-w-lg mx-auto">
                  Votre candidature a bien été reçue. Notre équipe vérifie actuellement l'authenticité de vos pièces d'identité, photos d'entrepôt et agréments.
                </CardDescription>
              </div>
            )}

            {isApproved && (
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-sm px-3 py-1">
                  Partenaire Vérifié Ecomfy Certifié
                </Badge>
                <CardTitle className="text-xl font-bold text-white">
                  Félicitations ! Votre compte est Actif
                </CardTitle>
                <CardDescription className="text-slate-300 text-xs max-w-lg mx-auto">
                  Votre structure de livraison est désormais visible par l'ensemble des vendeurs Ecomfy pour la prise en charge de leurs colis.
                </CardDescription>
              </div>
            )}

            {isRejected && (
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
                  <XCircle className="w-8 h-8" />
                </div>
                <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-sm px-3 py-1">
                  Candidature Non Retenue
                </Badge>
                <CardTitle className="text-xl font-bold text-white">
                  Dossier Refusé par la Fondation
                </CardTitle>
                {company.rejection_reason && (
                  <div className="p-3 rounded-lg bg-red-950/40 border border-red-900 text-red-200 text-xs text-left">
                    <span className="font-semibold">Motif du refus :</span> {company.rejection_reason}
                  </div>
                )}
              </div>
            )}

            {isActionReq && (
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-sm px-3 py-1">
                  Complément d'Information Requis
                </Badge>
                <CardTitle className="text-xl font-bold text-white">
                  Action Requise de votre Part
                </CardTitle>
                {company.admin_notes && (
                  <div className="p-3 rounded-lg bg-purple-950/40 border border-purple-900 text-purple-200 text-xs text-left">
                    <span className="font-semibold">Instructions de la fondation :</span> {company.admin_notes}
                  </div>
                )}
              </div>
            )}
          </CardHeader>

          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Responsable :</span>
                <p className="font-semibold text-white mt-1">{company.manager_name}</p>
                <p className="text-[11px] text-slate-400">{company.manager_phone}</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-400">Villes Couvertes :</span>
                <p className="font-semibold text-emerald-400 mt-1 truncate">
                  {company.covered_cities?.join(", ") || company.city}
                </p>
                <p className="text-[11px] text-slate-400">{company.total_drivers_count} livreurs enregistrés</p>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t border-slate-800 pt-4">
            <Button
              variant="outline"
              onClick={fetchStatus}
              size="sm"
              className="border-slate-800 text-slate-300 hover:bg-slate-800"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Actualiser
            </Button>

            {isApproved ? (
              <Button
                onClick={() => navigate("/delivery/partner-dashboard")}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold"
              >
                Accéder au Espace Livreur <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => navigate("/delivery/register")}
                size="sm"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Mettre à jour le Dossier
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
