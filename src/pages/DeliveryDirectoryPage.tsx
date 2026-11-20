import { Link } from "react-router-dom";
import { ArrowLeft, Truck } from "lucide-react";
import DeliveryDirectoryBrowser from "@/components/delivery/DeliveryDirectoryBrowser";

/** Répertoire des structures de livraison et des livreurs indépendants vérifiés (cahier des charges §2). */
export default function DeliveryDirectoryPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="border-b border-slate-800 pb-5">
          <Link to="/shop-manager" className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" /> Retour à ma boutique
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-2 flex items-center gap-2">
            <Truck className="w-7 h-7 text-emerald-400" /> Répertoire des livreurs
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Structures de livraison et livreurs indépendants vérifiés par eComfy. Consultez leur fiche, puis transmettez-leur vos commandes
            depuis la liste de vos commandes (« Envoyer à un livreur »).
          </p>
        </div>
        <DeliveryDirectoryBrowser />
      </div>
    </div>
  );
}
