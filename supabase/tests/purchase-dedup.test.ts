// Tests du Purchase fiable : le navigateur et le serveur calculent le MÊME event_id (condition de la déduplication Meta),
// et track-conversion / webhook / balayage s'appuient bien sur l'identifiant canonique et le registre des envois.
// Exécution : npx vitest run supabase/tests/purchase-dedup.test.ts   (aucun accès réseau)
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { orderEventId as browserOrderEventId, purchaseEventId as browserPurchaseEventId } from "../../src/lib/trackingIds.ts";
import { orderEventId as serverOrderEventId, purchaseEventId as serverPurchaseEventId } from "../functions/_shared/tracking-event-id.ts";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("navigateur et serveur calculent le même event_id", () => {
  for (const n of ["CMD-1042", "20261105-0007", "A/B 12", "é-1", 99, "x".repeat(40)]) {
    assert.equal(browserPurchaseEventId(n), serverPurchaseEventId(n), String(n));
    for (const ev of ["Purchase", "InitiateCheckout", "AddToCart"]) {
      assert.equal(browserOrderEventId(ev, n), serverOrderEventId(ev, n), `${ev} ${n}`);
    }
  }
});

test("Purchase : ord_<numéro>, caractères spéciaux neutralisés", () => {
  assert.equal(serverPurchaseEventId("CMD-1042"), "ord_CMD-1042");
  assert.equal(serverPurchaseEventId("A/B 12"), "ord_A_B_12");
  assert.match(serverPurchaseEventId("é'\"<>"), /^ord_[a-zA-Z0-9_-]+$/);
});

test("autres événements d'une commande : jamais le même identifiant que le Purchase", () => {
  assert.notEqual(serverOrderEventId("InitiateCheckout", "CMD-1"), serverPurchaseEventId("CMD-1"));
  assert.equal(serverOrderEventId("InitiateCheckout", "CMD-1"), "initiatecheckout_ord_CMD-1");
  assert.equal(serverOrderEventId("Purchase", "CMD-1"), serverPurchaseEventId("CMD-1"));
});

test("track-conversion : event_id du Purchase recalculé, envoi réservé puis consigné", () => {
  const src = read("../functions/track-conversion/index.ts");
  assert.match(src, /event_id = purchaseEventId\(order\.order_number\)/, "identifiant canonique");
  assert.match(src, /claim_purchase_send/, "réservation avant envoi");
  assert.match(src, /deduplicated: true/, "un Purchase déjà parti n'est pas renvoyé");
  assert.match(src, /finish_purchase_send/, "résultat consigné");
  // Le pendant « destinations déjà servies » doit exister pour les 4 plateformes.
  for (const k of ["meta:", "tiktok:", "snapchat:", '"ga4"']) assert.ok(src.includes(k), k);
  // L'identifiant fourni par l'appelant n'est plus utilisé tel quel pour un Purchase.
  assert.match(src, /let event_id: string = body\?\.event_id/);
});

test("webhook et balayage passent par le même envoi idempotent", () => {
  const webhook = read("../functions/ecomfy-pay-webhook/index.ts");
  const settlement = read("../functions/ecomfy-pay-settlement/index.ts");
  const shared = read("../functions/_shared/purchase-capi.ts");
  assert.match(webhook, /sendServerPurchase\(/);
  assert.match(settlement, /list_purchases_to_resend/);
  assert.match(settlement, /sendServerPurchase\(/);
  assert.match(shared, /purchaseEventId\(orderNumber\)/);
  assert.ok(!/ord_\$\{orderNumber/.test(webhook), "plus de construction manuelle de l'identifiant dans le webhook");
});

test("page de retour de paiement : Purchase navigateur sans doublon serveur", () => {
  const page = read("../../src/pages/OrderConfirmed.tsx");
  assert.match(page, /get_payment_return_status/);
  assert.match(page, /serverMirror: false/);
  const lib = read("../../src/lib/tracking.ts");
  assert.match(lib, /options\.serverMirror === false\) return/);
});
