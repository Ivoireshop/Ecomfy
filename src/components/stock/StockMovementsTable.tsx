import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StockMovement } from "@/hooks/useStockManagement";
import { ArrowUpRight, ArrowDownLeft, RotateCcw, Truck, CheckCircle2, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface StockMovementsTableProps {
  movements: StockMovement[];
  isLoading?: boolean;
}

export function StockMovementsTable({ movements, isLoading }: StockMovementsTableProps) {
  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm text-slate-500 animate-pulse">
        Chargement de l'historique des mouvements...
      </div>
    );
  }

  if (!movements || movements.length === 0) {
    return (
      <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        <p className="text-sm font-medium text-slate-600">Aucun mouvement de stock enregistré</p>
        <p className="text-xs text-slate-400 mt-1">
          Les réapprovisionnements, remises aux livreurs et livraisons apparaîtront ici automatiquement.
        </p>
      </div>
    );
  }

  const getMovementBadge = (type: StockMovement['movement_type']) => {
    switch (type) {
      case 'restock':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1">
            <ArrowUpRight className="w-3 h-3 text-emerald-600" /> Entrée Stock
          </Badge>
        );
      case 'driver_handover':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 gap-1">
            <Truck className="w-3 h-3 text-blue-600" /> Remise Livreur
          </Badge>
        );
      case 'delivered':
        return (
          <Badge className="bg-purple-100 text-purple-800 border-purple-200 gap-1">
            <CheckCircle2 className="w-3 h-3 text-purple-600" /> Livré Client
          </Badge>
        );
      case 'return_restock':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1">
            <RotateCcw className="w-3 h-3 text-amber-600" /> Retour Entrepôt
          </Badge>
        );
      case 'failed_delivery':
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-200 gap-1">
            <ShieldAlert className="w-3 h-3 text-rose-600" /> Échec Livraison
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <ArrowDownLeft className="w-3 h-3" /> Ajustement
          </Badge>
        );
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <Table>
        <TableHeader className="bg-slate-50/80">
          <TableRow>
            <TableHead className="text-xs font-semibold text-slate-700">Date & Heure</TableHead>
            <TableHead className="text-xs font-semibold text-slate-700">Produit</TableHead>
            <TableHead className="text-xs font-semibold text-slate-700">Code Unité / QR</TableHead>
            <TableHead className="text-xs font-semibold text-slate-700">Type de Mouvement</TableHead>
            <TableHead className="text-xs font-semibold text-slate-700 text-right">Variation</TableHead>
            <TableHead className="text-xs font-semibold text-slate-700 text-right">Nouveau Stock</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((m) => (
            <TableRow key={m.id} className="hover:bg-slate-50/50 transition-colors">
              <TableCell className="text-xs text-slate-600 font-mono">
                {format(new Date(m.created_at), "dd MMM yyyy, HH:mm", { locale: fr })}
              </TableCell>
              <TableCell className="font-medium text-xs text-slate-900">
                {m.products?.name || "Produit inconnu"}
                {m.products?.sku && (
                  <span className="block text-[10px] text-slate-400 font-mono">
                    SKU: {m.products.sku}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-xs font-mono text-slate-600">
                {m.unit_code ? (
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                    {m.unit_code}
                  </span>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </TableCell>
              <TableCell>{getMovementBadge(m.movement_type)}</TableCell>
              <TableCell className={`text-xs font-bold text-right font-mono ${
                m.quantity > 0 ? "text-emerald-600" : m.quantity < 0 ? "text-rose-600" : "text-slate-600"
              }`}>
                {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
              </TableCell>
              <TableCell className="text-xs font-semibold text-right text-slate-900 font-mono">
                {m.new_stock}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
