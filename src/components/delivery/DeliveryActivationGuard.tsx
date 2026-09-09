import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ShieldCheck, 
  Clock, 
  XCircle, 
  AlertTriangle, 
  Truck, 
  RefreshCw, 
  ArrowRight,
  Lock,
  FileCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { deliveryService } from "@/lib/deliveryService";
import { DeliveryCompany } from "@/types/delivery";

interface DeliveryActivationGuardProps {
  children: React.ReactNode;
}

export function DeliveryActivationGuard({ children }: DeliveryActivationGuardProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [company, setCompany] = useState<DeliveryCompany | null>(null);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const data = await deliveryService.getMyCompany();
      setCompany(data);
    } catch (err) {
      console.error("[DeliveryActivationGuard] Error checking status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[400px] bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-slate-400 text-xs font-semibold">Vérification de l'activation Ecomfy Livraison...</p>
        </div>
      </div>
    );
  }

  // Case 1: Approved -> UNLOCK FULL ACCESS
  if (company && company.verification_status === "approved") {
    return <>{children}</>;
  }

  // Case 2: No application yet
  if (!company) {
    return (
      <div className="min-h-[450px] bg-slate-950 text-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-900 border-slate-800 text-center">
          <CardHeader>
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-2 text-emerald-400">
              <Lock className="w-7 h-7" />
            </div>
            <CardTitle className="text-xl font-bold">Vérification d'Identité Requise</CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              L'accès aux fonctionnalités sensibles de livraison (Missions, Encaissements COD) nécessite la vérification et l'activation préalable de votre dossier.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center pt-2">
            <Button
              onClick={() => navigate("/delivery/register")}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs px-6 py-2 rounded-xl"
            >
              Soumettre mon Dossier de Vérification
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Case 3: Pending, Processing, Manual Review
  const isPending = ['pending_verification', 'processing', 'under_review', 'manual_review'].includes(company.verification_status);
  const isRejected = ['rejected', 'resubmission_required', 'action_required'].includes(company.verification_status);

  return (
    <div className="min-h-[450px] bg-slate-950 text-slate-100 p-6 flex items-center justify-center">
      <Card className="max-w-lg w-full bg-slate-900/90 border-slate-800 shadow-2xl backdrop-blur-xl">
        <CardHeader className="text-center pb-4">
          {isPending && (
            <div className="space-y-3">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 animate-pulse">
                <Clock className="w-8 h-8" />
              </div>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs px-3 py-1">
                Vérification d'Identité en Cours
              </Badge>
              <CardTitle className="text-xl font-bold text-white">
                Dossier en Analyse de Conformité
              </CardTitle>
              <CardDescription className="text-slate-300 text-xs max-w-sm mx-auto">
                Votre dossier d'identité et vos pièces justificatives sont actuellement examinés par le service de sécurité Ecomfy. Votre accès sera débloqué dès approbation.
              </CardDescription>
            </div>
          )}

          {isRejected && (
            <div className="space-y-3">
              <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
                <XCircle className="w-8 h-8" />
              </div>
              <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-xs px-3 py-1">
                Correction de Document Requise
              </Badge>
              <CardTitle className="text-xl font-bold text-white">
                Accès Suspendu — Action Requise
              </CardTitle>
              <CardDescription className="text-slate-300 text-xs max-w-sm mx-auto">
                Certaines pièces de votre dossier nécessitent une correction pour valider l'activation de votre compte Ecomfy Livraison.
              </CardDescription>
            </div>
          )}
        </CardHeader>

        {company.rejection_reason && (
          <CardContent className="pt-2">
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-900 text-rose-200 text-xs">
              <span className="font-bold text-rose-300 block mb-1">Motif de la demande de correction :</span>
              <p>{company.rejection_reason}</p>
            </div>
          </CardContent>
        )}

        <CardFooter className="flex items-center justify-between border-t border-slate-800 pt-4">
          <Button
            variant="outline"
            onClick={checkStatus}
            size="sm"
            className="border-slate-800 text-slate-300 hover:bg-slate-800 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Actualiser le statut
          </Button>

          {isRejected ? (
            <Button
              onClick={() => navigate("/delivery/resubmit")}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs gap-1.5"
            >
              <FileCheck className="w-4 h-4" /> Corriger mon Dossier
            </Button>
          ) : (
            <Button
              onClick={() => navigate("/delivery/status")}
              className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs gap-1.5"
            >
              Voir le Statut Complété <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
