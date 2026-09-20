import { useLocation, useNavigate, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, ArrowLeft, Search, Sparkles, Compass, MessageSquare, LifeBuoy } from "lucide-react";
import { logError } from "@/lib/error-handler";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    logError("NotFoundRoute", `User attempted to access non-existent route: ${location.pathname}`);
  }, [location.pathname]);

  const handleGoBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden select-none">
      {/* Dynamic Background Glowing Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#0E7C66]/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />

      {/* Header Logo Bar */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between z-10 py-2">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0E7C66] to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-[#0E7C66]/30 group-hover:scale-105 transition-transform">
            <Sparkles className="h-5 w-5 fill-white/20" />
          </div>
          <span className="text-xl font-black tracking-tight text-white font-sans">
            Ecomfy<span className="text-[#0E7C66]">.</span>
          </span>
        </Link>
        <Badge variant="outline" className="border-slate-800 text-slate-400 bg-slate-900/60 px-3 py-1 rounded-full text-xs gap-1.5 backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> Status : Opérationnel
        </Badge>
      </header>

      {/* Main Content Hero */}
      <main className="w-full max-w-2xl mx-auto my-auto py-12 text-center z-10 flex flex-col items-center">
        {/* Animated Badge & Illustration Box */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0E7C66] to-indigo-600 rounded-3xl blur-xl opacity-30 animate-pulse" />
          <div className="relative p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl shadow-2xl flex items-center justify-center gap-4">
            <Compass className="h-14 w-14 sm:h-16 sm:w-16 text-[#0E7C66] animate-spin-slow" />
            <div className="text-left">
              <span className="text-5xl sm:text-7xl font-black bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent tracking-tighter">
                404
              </span>
              <p className="text-xs font-bold font-mono uppercase tracking-widest text-[#0E7C66] mt-1">
                Route Introuvable
              </p>
            </div>
          </div>
        </div>

        {/* Text Details */}
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
          Oups ! Vous vous êtes aventuré loin du réseau
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-lg mb-8 leading-relaxed">
          La page demandée <code className="text-amber-400 font-mono text-xs bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">{location.pathname}</code> n'existe pas ou a été déplacée. Rassurez-vous, votre boutique et vos données sont totalement en sécurité.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto rounded-2xl bg-[#0E7C66] hover:bg-[#0b6352] text-white font-bold shadow-xl shadow-[#0E7C66]/20 gap-2 h-12 px-6"
          >
            <Link to="/">
              <Home className="h-4 w-4" /> Retour à l'accueil
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleGoBack}
            className="w-full sm:w-auto rounded-2xl border-slate-800 text-slate-200 hover:bg-slate-900 hover:text-white font-semibold gap-2 h-12 px-6 bg-slate-900/50 backdrop-blur-md"
          >
            <ArrowLeft className="h-4 w-4" /> Page précédente
          </Button>
        </div>
      </main>

      {/* Footer Support Bar */}
      <footer className="w-full max-w-6xl mx-auto z-10 pt-4 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Ecomfy Cloud Platform. Tous droits réservés.</p>
        <div className="flex items-center gap-4">
          <a
            href="https://wa.me/2250707070707"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-400 transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" /> Support WhatsApp
          </a>
          <span className="text-slate-800">•</span>
          <Link to="/docs" className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors">
            <LifeBuoy className="h-3.5 w-3.5" /> Centre d'aide
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default NotFound;
