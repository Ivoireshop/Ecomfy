import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

// SEO: consolidate public traffic on the canonical brand domain visuelpro.cloud.
// Do not redirect Lovable preview/editor hosts: inside the builder this can create
// a blank iframe while the custom domain reloads or rejects the embedded preview.
(() => {
  try {
    const host = window.location.hostname;
    const isPublishedLovableHost = host === "visualpro-african-ai-creations.lovable.app";
    const isEmbeddedPreview = window.self !== window.top;
    if (isPublishedLovableHost && !isEmbeddedPreview) {
      const target =
        "https://visuelpro.cloud" +
        window.location.pathname +
        window.location.search +
        window.location.hash;
      window.location.replace(target);
      return;
    }
  } catch {
    // ignore — fall through to normal render
  }
  createRoot(document.getElementById("root")!).render(<App />);
})();
