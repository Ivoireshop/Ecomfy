import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthReady } from '@/hooks/useAuthReady';
import { useToast } from './use-toast';

// Fonction utilitaire pour convertir la clé VAPID base64 en Uint8Array
const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const useWebPush = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(false);
  const { session } = useAuthReady();
  const { toast } = useToast();

  useEffect(() => {
    // Vérifier si les Service Workers et PushManager sont supportés
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      if (session?.user) {
        checkSubscription();
      }
    }
  }, [session?.user]);

  const checkSubscription = async () => {
    try {
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        setIsSubscribed(false);
        return;
      }
      registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription && session?.user) {
        // Vérifier si la souscription existe dans notre nouvelle base de données Supabase (VAPID)
        const subJSON = subscription.toJSON();
        if (subJSON.endpoint) {
          const { data, error } = await supabase
            .from('push_subscriptions')
            .select('id')
            .eq('endpoint', subJSON.endpoint)
            .eq('user_id', session.user.id)
            .maybeSingle();
            
          if (!data) {
            // C'est une ancienne souscription (ex: Firebase FCM) ou orpheline
            // On la supprime pour forcer l'utilisateur à se réinscrire avec VAPID
            console.log("Ancienne souscription détectée, désinscription forcée...");
            await subscription.unsubscribe();
            setIsSubscribed(false);
            return;
          }
        }
      }
      
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Erreur lors de la vérification de la souscription:', error);
    }
  };

  const subscribe = async () => {
    if (!isSupported) {
      toast({
        title: "Non supporté",
        description: "Votre navigateur ne supporte pas les notifications Web Push.",
        variant: "destructive"
      });
      return;
    }

    if (!session?.user) {
      toast({
        title: "Non authentifié",
        description: "Vous devez être connecté pour activer les notifications.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        toast({
          title: "Permission refusée",
          description: "Vous devez autoriser les notifications dans votre navigateur.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      }
      registration = await navigator.serviceWorker.ready;

      // Clé publique VAPID (à remplacer par la vraie clé générée ou injectée via env)
      // On utilise import.meta.env pour récupérer la clé publique
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      
      if (!vapidPublicKey) {
        throw new Error("Clé VAPID publique manquante dans la configuration.");
      }

      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      // Extraire les infos pour la base de données
      const subJSON = subscription.toJSON();
      
      if (!subJSON.endpoint || !subJSON.keys?.p256dh || !subJSON.keys?.auth) {
        throw new Error("La souscription générée est invalide.");
      }

      // Sauvegarder dans Supabase
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: session.user.id,
            endpoint: subJSON.endpoint,
            p256dh: subJSON.keys.p256dh,
            auth: subJSON.keys.auth,
            last_used_at: new Date().toISOString()
          },
          { onConflict: 'endpoint' }
        );

      if (error) throw error;

      setIsSubscribed(true);
      toast({
        title: "Notifications activées !",
        description: "Vous recevrez une alerte pour chaque nouvelle commande.",
      });

    } catch (error: any) {
      console.error('Erreur de souscription push:', error);
      toast({
        title: "Erreur d'activation",
        description: (error?.message || error?.toString() || "Une erreur est survenue lors de l'activation des notifications.") + (error?.details ? ` - ${error.details}` : '') + (error?.hint ? ` - ${error.hint}` : ''),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    setIsLoading(true);
    try {
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        setIsSubscribed(false);
        setIsLoading(false);
        return;
      }
      registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        const subJSON = subscription.toJSON();
        
        // Supprimer côté navigateur
        await subscription.unsubscribe();
        
        // Supprimer côté base de données si connecté
        if (session?.user && subJSON.endpoint) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('endpoint', subJSON.endpoint);
        }
      }
      setIsSubscribed(false);
      toast({
        title: "Notifications désactivées",
        description: "Vous ne recevrez plus d'alertes pour les nouvelles commandes."
      });
    } catch (error) {
      console.error('Erreur lors de la désinscription:', error);
      toast({
        title: "Erreur",
        description: "Impossible de désactiver les notifications.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    subscribe,
    unsubscribe
  };
};
