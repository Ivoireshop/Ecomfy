import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// SEO: consolidate traffic on the canonical brand domain visuelpro.cloud.
// Redirect any visit on the lovable.app published/preview hosts to the same path
// on visuelpro.cloud so search engines don't index duplicate URLs.
(() => {
  try {
    const host = window.location.hostname;
    const isLovableHost = /\.lovable\.(app|dev)$/.test(host);
    if (isLovableHost) {
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
