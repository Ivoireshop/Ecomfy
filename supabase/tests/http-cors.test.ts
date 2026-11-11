// Tests de _shared/http.ts : CORS par niveau, préflight, erreurs génériques (audit M3).
// Exécution : npx vitest run supabase/tests/http-cors.test.ts
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  GENERIC_SERVER_ERROR,
  buildAllowedOrigins,
  corsHeadersFor,
  wrapHandler,
} from "../functions/_shared/http.ts";

const allowed = buildAllowedOrigins("https://app.example.com/", "https://preview.example.com, pas-une-url");

test("niveau app : origine de la liste blanche reflétée, avec Vary: Origin", () => {
  const h = corsHeadersFor("app", "https://ecomfy.cloud", allowed)!;
  assert.equal(h["Access-Control-Allow-Origin"], "https://ecomfy.cloud");
  assert.equal(h.Vary, "Origin");
  assert.equal(corsHeadersFor("app", "https://app.example.com", allowed)!["Access-Control-Allow-Origin"], "https://app.example.com");
  assert.equal(corsHeadersFor("app", "https://preview.example.com", allowed)!["Access-Control-Allow-Origin"], "https://preview.example.com");
});

test("niveau app : origine inconnue refusée, jamais de *", () => {
  assert.equal(corsHeadersFor("app", "https://evil.example", allowed), null);
  assert.equal(corsHeadersFor("app", "https://ecomfy.cloud.evil.example", allowed), null);
  assert.equal(corsHeadersFor("app", "null", allowed), null);
  assert.equal(corsHeadersFor("app", "http://ecomfy.cloud", allowed), null); // http ≠ https
});

test("niveau app : développement local et application native acceptés, pas un localhost distant", () => {
  assert.ok(corsHeadersFor("app", "http://localhost:8080", allowed));
  assert.ok(corsHeadersFor("app", "http://127.0.0.1:5173", allowed));
  assert.ok(corsHeadersFor("app", "capacitor://localhost", allowed));
  assert.ok(corsHeadersFor("app", "https://localhost", allowed));
  assert.equal(corsHeadersFor("app", "http://localhost.evil.example", allowed), null);
  assert.equal(corsHeadersFor("app", "https://localhost:8080", allowed), null);
});

test("niveau app : sans Origin (serveur à serveur) rien à ajouter", () => {
  assert.deepEqual(corsHeadersFor("app", null, allowed), {});
});

test("niveau public : *, niveau server : aucun en-tête", () => {
  assert.equal(corsHeadersFor("public", "https://boutique-cliente.com", allowed)!["Access-Control-Allow-Origin"], "*");
  assert.equal(corsHeadersFor("server", "https://ecomfy.cloud", allowed), null);
});

test("wrapHandler : écrase le * écrit par la fonction et ajoute Vary", async () => {
  const handler = wrapHandler(
    "app",
    () => new Response("{}", { headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" } }),
  );
  const ok = await handler(new Request("https://f/x", { headers: { origin: "https://ecomfy.cloud" } }));
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://ecomfy.cloud");
  assert.equal(ok.headers.get("vary"), "Origin");
  assert.equal(ok.headers.get("content-type"), "application/json");

  const refused = await handler(new Request("https://f/x", { headers: { origin: "https://evil.example" } }));
  assert.equal(refused.headers.get("access-control-allow-origin"), null);
  assert.equal(refused.status, 200); // la réponse existe, c'est le navigateur qui la bloque
});

test("wrapHandler : préflight 204 pour une origine permise, 403 sinon", async () => {
  const handler = wrapHandler("app", () => new Response("jamais appelé", { status: 418 }));
  const pre = await handler(
    new Request("https://f/x", { method: "OPTIONS", headers: { origin: "https://ecomfy.cloud" } }),
  );
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get("access-control-allow-headers") ?? "", /authorization/);
  assert.match(pre.headers.get("access-control-allow-headers") ?? "", /x-supabase-client-platform/);

  const bad = await handler(
    new Request("https://f/x", { method: "OPTIONS", headers: { origin: "https://evil.example" } }),
  );
  assert.equal(bad.status, 403);
  assert.equal(bad.headers.get("access-control-allow-origin"), null);
});

test("wrapHandler : exception non rattrapée → 500 générique sans message interne", async () => {
  const handler = wrapHandler("public", () => {
    throw new Error("connection to db-prod-01.internal refused, password=hunter2");
  });
  const res = await handler(new Request("https://f/x", { method: "POST" }));
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.deepEqual(body, { success: false, error: GENERIC_SERVER_ERROR });
  assert.equal(res.headers.get("access-control-allow-origin"), "*");
});

test("wrapHandler : un flux (SSE) traverse sans être consommé", async () => {
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode("data: salut\n\n"));
      c.close();
    },
  });
  const handler = wrapHandler("public", () => new Response(stream, { headers: { "Content-Type": "text/event-stream" } }));
  const res = await handler(new Request("https://f/x"));
  assert.equal(await res.text(), "data: salut\n\n");
});

test("wrapHandler niveau server : aucun en-tête CORS, y compris sur préflight", async () => {
  const handler = wrapHandler("server", () => new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } }));
  const res = await handler(new Request("https://f/x", { headers: { origin: "https://ecomfy.cloud" } }));
  assert.equal(res.headers.get("access-control-allow-origin"), null);
  const pre = await handler(new Request("https://f/x", { method: "OPTIONS", headers: { origin: "https://ecomfy.cloud" } }));
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), null);
});
