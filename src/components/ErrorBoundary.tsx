import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, LogIn, ChevronDown } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Error Boundary catch:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleResetAuth = () => {
    try {
      sessionStorage.clear();
    } catch (e) {}
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/auth";
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
            Une interruption temporaire d'affichage s'est produite. Veuillez rafraîchir la page ou réaccéder à l'espace de connexion Ecomfy.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            <Button onClick={this.handleReload} size="lg" className="btn-interactive shadow-md gap-2">
              <RefreshCw className="w-4 h-4" />
              Rafraîchir la page
            </Button>
            <Button onClick={this.handleResetAuth} variant="outline" size="lg" className="shadow-xs gap-2">
              <LogIn className="w-4 h-4" />
              Page de Connexion
            </Button>
          </div>

          {/* Technical Error Details Collapsible for instant debugging */}
          {this.state.error && (
            <details className="w-full max-w-lg text-left bg-slate-900 text-slate-200 rounded-2xl p-4 text-xs font-mono border border-slate-800 shadow-inner overflow-hidden">
              <summary className="cursor-pointer font-bold text-amber-400 flex items-center justify-between">
                <span>Détails de l'erreur ({this.state.error.name})</span>
                <ChevronDown className="h-4 w-4" />
              </summary>
              <div className="mt-3 space-y-2 whitespace-pre-wrap break-all text-[11px]">
                <p className="text-rose-400 font-bold">{this.state.error.message}</p>
                {this.state.error.stack && (
                  <p className="text-slate-400 text-[10px] leading-tight max-h-40 overflow-y-auto">
                    {this.state.error.stack}
                  </p>
                )}
              </div>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
