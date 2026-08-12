import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const InstallPwaBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Check if user previously dismissed it
      const dismissed = localStorage.getItem('pwa_install_dismissed');
      if (!dismissed) {
        setShowBanner(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast({
        title: "Installation en cours",
        description: "L'application s'installe sur votre appareil.",
      });
      setShowBanner(false);
    } else {
      console.log('User dismissed the A2HS prompt');
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa_install_dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-4 rounded-xl shadow-lg mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
      <div className="flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-lg">
          <Download className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-bold text-lg">Installez l'application Ecomfy</h3>
          <p className="text-sm text-white/90">
            Pour une expérience plus rapide et des notifications en temps réel, installez l'application sur votre appareil.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <Button 
          variant="secondary" 
          className="flex-1 sm:flex-none font-bold"
          onClick={handleInstall}
        >
          Installer
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-white hover:bg-white/20 rounded-full"
          onClick={handleDismiss}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};
