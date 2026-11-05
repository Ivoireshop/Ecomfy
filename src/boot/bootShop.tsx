import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import ShopApp from "../ShopApp.tsx";

/**
 * Boutique publique (visiteurs des publicités) : aucun service worker, pas de i18n au démarrage.
 * - Le service worker précharge ~8 Mo en arrière-plan dès la fin du chargement et concurrence l'image
 *   produit et le paiement. Il reste réservé aux pages du site complet.
 * - L'i18n ne sert qu'à la traduction automatique de l'interface hors français : on ne la charge
 *   que si le navigateur du visiteur n'est pas en français.
 */
const prefersFrench = (): boolean => {
  try {
    const stored = localStorage.getItem("ecomfy_lang");
    const first = (stored || (navigator.languages && navigator.languages[0]) || navigator.language || "fr")
      .toLowerCase()
      .split("-")[0];
    return first === "fr";
  } catch {
    return true;
  }
};

export default function bootShop(container: HTMLElement) {
  createRoot(container).render(
    <HelmetProvider>
      <ShopApp />
    </HelmetProvider>
  );
  if (!prefersFrench()) {
    const load = () => void import("../i18n");
    const ric = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => number) | undefined;
    if (ric) ric(load, { timeout: 1500 });
    else setTimeout(load, 300);
  }
}
