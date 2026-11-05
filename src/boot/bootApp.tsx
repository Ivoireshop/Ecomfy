import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "../App.tsx";
import "../i18n";
import { initPwaAutoUpdate } from "../registerPwaUpdate";

/** Site complet : landing, tableau de bord, studio, etc. */
export default function bootApp(container: HTMLElement) {
  initPwaAutoUpdate();
  createRoot(container).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );
}
