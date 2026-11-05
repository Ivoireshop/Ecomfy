import { Toaster as Sonner } from "@/components/ui/sonner";
import { useCommunityNotifications } from "@/hooks/useCommunityNotifications";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";
import { useNativePush } from "@/hooks/useNativePush";
import { useWebPush } from "@/hooks/useWebPush";

/**
 * Notifications du marchand connecté (commandes, communauté, push).
 * Elles ne servent à rien à un visiteur anonyme arrivé d'une publicité : `ShopApp` ne charge ce fichier
 * que si une session est enregistrée dans le navigateur, et seulement après l'affichage de la page.
 */
const ShopSessionExtras = () => {
  useCommunityNotifications();
  useOrderNotifications();
  useNativePush();
  useWebPush();
  return <Sonner />;
};

export default ShopSessionExtras;
