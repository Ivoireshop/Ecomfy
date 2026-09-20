import React from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import { getFriendlyErrorMessage } from "@/lib/error-handler";

interface ApiErrorStateProps {
  error: any;
  title?: string;
  onRetry?: () => void;
  onBack?: () => void;
  className?: string;
}

export function ApiErrorState({
  error,
  title = "Erreur de chargement",
  onRetry,
  onBack,
  className = "",
}: ApiErrorStateProps) {
  const friendlyMessage = getFriendlyErrorMessage(error);

  return (
    <div className={`p-6 rounded-3xl border border-destructive/20 bg-destructive/5 text-card-foreground flex flex-col items-center justify-center text-center max-w-lg mx-auto my-6 shadow-sm ${className}`}>
      <div className="p-3 rounded-2xl bg-destructive/10 text-destructive mb-3">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-bold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{friendlyMessage}</p>
      
      <div className="flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <Button onClick={onRetry} size="sm" className="rounded-xl font-bold gap-1.5 shadow-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Réessayer
          </Button>
        )}
        {onBack && (
          <Button onClick={onBack} variant="outline" size="sm" className="rounded-xl font-medium gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Retour
          </Button>
        )}
      </div>
    </div>
  );
}
