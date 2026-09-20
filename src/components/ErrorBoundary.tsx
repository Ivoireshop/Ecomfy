import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RefreshCw, LogIn, ChevronDown, Copy, Check, Home } from "lucide-react";
import { logError, generateCorrelationId, redactSensitiveData } from "@/lib/error-handler";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  correlationId: string | null;
  copiedRef: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    correlationId: null,
    copiedRef: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const ref = generateCorrelationId();
    logError("ReactErrorBoundary", error, ref);
    this.setState({ errorInfo, correlationId: ref });
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, correlationId: null });
    window.location.reload();
  };

  private handleResetAuth = () => {
    try {
      sessionStorage.clear();
    } catch (e) {}
    this.setState({ hasError: false, error: null, errorInfo: null, correlationId: null });
    window.location.href = "/auth";
  };

  private handleCopyRef = () => {
    if (this.state.correlationId) {
      navigator.clipboard?.writeText(this.state.correlationId);
      this.setState({ copiedRef: true });
      setTimeout(() => this.setState({ copiedRef: false }), 2000);
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDev = import.meta.env.DEV;

      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-100 text-center relative overflow-hidden">
          {/* Subtle Ambient Background Gradient */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 blur-[120px] rounded-full pointer-events-none" />

          <div className="p-4 rounded-3xl bg-amber-500/15 text-amber-400 mb-5 animate-pulse border border-amber-500/20 shadow-xl">
            <AlertTriangle className="w-10 h-10" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 text-white">
            Une interruption temporaire s'est produite
          </h1>
          <p className="text-slate-400 max-w-md mb-4 leading-relaxed text-sm sm:text-base">
            Le système a interrompu le rendu de cette section par mesure de sécurité. Aucune donnée n'a été perdue.
          </p>

          {/* Anonymous Error Reference Badge */}
          {this.state.correlationId && (
            <div className="mb-6 flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3.5 py-1.5 rounded-2xl text-xs">
              <span className="text-slate-400 font-medium">Référence incident :</span>
              <span className="font-mono font-bold text-amber-400">{this.state.correlationId}</span>
              <button
                type="button"
                onClick={this.handleCopyRef}
                className="ml-1 text-slate-400 hover:text-white transition-colors"
                title="Copier la référence"
              >
                {this.state.copiedRef ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
            <Button onClick={this.handleReload} size="lg" className="rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-lg gap-2">
              <RefreshCw className="w-4 h-4" />
              Rafraîchir la page
            </Button>
            <Button onClick={this.handleResetAuth} variant="outline" size="lg" className="rounded-2xl border-slate-800 text-slate-300 hover:bg-slate-900 gap-2">
              <LogIn className="w-4 h-4" />
              Page de connexion
            </Button>
            <Button onClick={() => (window.location.href = "/")} variant="ghost" size="lg" className="rounded-2xl text-slate-400 hover:text-white gap-2">
              <Home className="w-4 h-4" />
              Accueil
            </Button>
          </div>

          {/* Technical Error Details strictly restricted to Local Dev mode only */}
          {isDev && this.state.error && (
            <details className="w-full max-w-lg text-left bg-slate-900/90 text-slate-200 rounded-3xl p-4 text-xs font-mono border border-amber-500/30 shadow-2xl backdrop-blur-md overflow-hidden">
              <summary className="cursor-pointer font-bold text-amber-400 flex items-center justify-between">
                <span>⚡ Mode Dev : Détails techniques ({this.state.error.name})</span>
                <ChevronDown className="h-4 w-4" />
              </summary>
              <div className="mt-3 space-y-2 whitespace-pre-wrap break-all text-[11px]">
                <p className="text-rose-400 font-bold">{redactSensitiveData(this.state.error.message)}</p>
                {this.state.error.stack && (
                  <p className="text-slate-400 text-[10px] leading-tight max-h-40 overflow-y-auto font-mono bg-slate-950 p-3 rounded-xl border border-slate-800">
                    {redactSensitiveData(this.state.error.stack)}
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

