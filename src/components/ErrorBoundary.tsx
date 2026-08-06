import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Error Boundary catch:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground text-center">
          <div className="p-4 rounded-full bg-amber-500/10 text-amber-600 mb-4 animate-bounce">
            <AlertTriangle className="w-10 h-10" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            Une erreur inattendue est survenue
          </h1>
          <p className="text-muted-foreground max-w-md mb-6 leading-relaxed text-sm sm:text-base">
            Une interruption temporaire d'affichage s'est produite. Veuillez rafraîchir la page pour reprendre votre navigation sur Ecomfy.
          </p>
          <Button onClick={this.handleReload} size="lg" className="btn-interactive shadow-md gap-2">
            <RefreshCw className="w-4 h-4" />
            Rafraîchir la page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
