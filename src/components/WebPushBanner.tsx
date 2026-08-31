import { useWebPush } from "@/hooks/useWebPush";
import { Bell, Share, Smartphone } from "lucide-react";
import { Button } from "./ui/button";

export const WebPushBanner = () => {
  const { isSupported, isSubscribed, permission, isLoading, subscribe } = useWebPush();

  const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone = typeof window !== "undefined" && ((window.navigator as any).standalone || window.matchMedia("(display-mode: standalone)").matches);

  if (isSubscribed || permission === 'denied') {
    return null;
  }

  // iOS Safari outside standalone PWA mode
  if (isIOS && !isStandalone) {
    return (
      <div className="bg-gradient-to-r from-emerald-950/90 via-teal-900/80 to-slate-900 border border-emerald-500/30 text-white rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center shadow-lg">
        <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center shrink-0 border border-emerald-500/30">
          <Smartphone className="w-6 h-6 animate-pulse" />
        </div>
        <div className="flex-1 text-center md:text-left">
          <h4 className="font-extrabold text-base mb-1 text-white flex items-center justify-center md:justify-start gap-2">
            <span>📲 Notifications de commandes sur iPhone (iOS)</span>
          </h4>
          <p className="text-xs text-emerald-200/90 leading-relaxed">
            Pour recevoir les notifications de commandes sur votre iPhone même écran verrouillé :
            <br />
            <strong>1.</strong> Touchez l'icône <strong>Partager <Share className="inline w-3.5 h-3.5 mx-0.5" /></strong> en bas dans Safari.
            <br />
            <strong>2.</strong> Touchez <strong>"Sur l'écran d'accueil"</strong>.
            <br />
            <strong>3.</strong> Ouvrez l'icône Ecomfy depuis votre écran d'accueil et touchez <strong>"Activer les notifications"</strong>.
          </p>
        </div>
      </div>
    );
  }

  if (!isSupported) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-[#0E7C66]/10 to-[#0E7C66]/5 border border-[#0E7C66]/20 rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center shadow-sm">
      <div className="w-12 h-12 bg-white dark:bg-slate-800 text-[#0E7C66] rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-[#0E7C66]/20">
        <Bell className="w-6 h-6" />
      </div>
      <div className="flex-1 text-center md:text-left">
        <h4 className="font-extrabold text-slate-900 dark:text-white mb-1 text-sm sm:text-base">🔔 Activez les alertes de commandes mobiles</h4>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
          Recevez une alerte sonore et visuelle en temps réel sur votre téléphone à chaque nouvelle commande.
        </p>
      </div>
      <Button 
        onClick={subscribe}
        disabled={isLoading}
        className="bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold px-5 py-2.5 rounded-xl whitespace-nowrap shadow-md shadow-[#0E7C66]/20 transition-all shrink-0"
      >
        {isLoading ? "Activation..." : "Activer les notifications"}
      </Button>
    </div>
  );
};
