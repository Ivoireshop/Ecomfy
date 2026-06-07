import { useEffect, useState } from "react";

declare const __BUILD_ID__: string;
declare const __BUILD_TIME__: string;

const BUILD_ID = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "unknown";
const BUILD_TIME = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "unknown";

export default function Health() {
  const [serverHtml, setServerHtml] = useState<string>("checking...");

  useEffect(() => {
    document.title = "Health · VisuelPro";
    // Verify the HTML currently served matches this build by fetching index.html
    fetch("/", { cache: "no-store" })
      .then((r) => r.text())
      .then((html) => {
        const match = html.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/);
        setServerHtml(match ? match[1] : "no-bundle-detected");
      })
      .catch(() => setServerHtml("fetch-failed"));
  }, []);

  const payload = {
    status: "ok",
    buildId: BUILD_ID,
    buildTime: BUILD_TIME,
    servedBundle: serverHtml,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    href: typeof window !== "undefined" ? window.location.href : "",
    checkedAt: new Date().toISOString(),
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
      <div className="w-full max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold">Health check</h1>
        <p className="text-sm text-muted-foreground">
          Confirme que la dernière version est bien servie en production.
        </p>
        <pre className="text-xs bg-muted p-4 rounded-md overflow-auto border border-border">
{JSON.stringify(payload, null, 2)}
        </pre>
        <p className="text-xs text-muted-foreground">
          JSON brut disponible sur <code>/healthz.json</code> (via fetch côté client).
        </p>
      </div>
    </main>
  );
}
