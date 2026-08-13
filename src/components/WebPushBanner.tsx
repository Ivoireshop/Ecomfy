import { useWebPush } from "@/hooks/useWebPush";
import { Bell } from "lucide-react";
import { Button } from "./ui/button";

export const WebPushBanner = () => {
  const { isSupported, isSubscribed, permission, isLoading, subscribe } = useWebPush();

  // If not supported or already subscribed, don't show the banner.
  // Exception: on iOS, PWA might need to be installed first. The banner could explain this.
  if (!isSupported) {
    // If not supported, we check if they are on an iPhone/iPad
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS) {
      return (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center shadow-sm">
          <div className="w-12 h-12 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center shrink-0">
            <Bell className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold mb-1">Notifications Push (iOS)</h4>
            <p className="text-sm">Pour recevoir des alertes de nouvelles commandes sur votre iPhone, <strong>vous devez d'abord installer l'application sur votre écran d'accueil</strong> (Bouton Partager &gt; Sur l'écran d'accueil).</p>
          </div>
        </div>
      );
    }
    return null;
  }

  if (isSubscribed || permission === 'denied') {
    return null; // Déjà abonné ou refusé définitivement
  }

  return (
    <div className="bg-gradient-to-r from-[#0E7C66]/10 to-[#0E7C66]/5 border border-[#0E7C66]/20 rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center shadow-sm">
      <div className="w-12 h-12 bg-white text-[#0E7C66] rounded-full flex items-center justify-center shrink-0 shadow-sm border border-[#0E7C66]/20">
        <Bell className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-slate-800 mb-1">Activez les alertes de commandes</h4>
        <p className="text-sm text-slate-600">
          Recevez une notification en temps réel (même l'application fermée) pour ne rater aucune commande.
        </p>
      </div>
      <Button 
        onClick={subscribe}
        disabled={isLoading}
        className="bg-[#0E7C66] hover:bg-[#0E7C66]/90 text-white whitespace-nowrap"
      >
        {isLoading ? "Activation..." : "Activer les notifications"}
      </Button>
    </div>
  );
};
