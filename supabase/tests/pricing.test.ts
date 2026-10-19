// Tests du correctif C6 : tarifs serveur (_shared/pricing.ts).
// Exécution (Node >= 22.6, aucun accès réseau requis) :
//   node --experimental-strip-types --test supabase/tests/pricing.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CREDIT_PACKS, PLAN_PRICES, checkAmount, checkCustomerPayment, orderExpectedTotal, remoteAmountMatches } from "../functions/_shared/pricing.ts";
import { priceLine } from "../../src/lib/bundlePricing.ts";

const credits = (size: number, price: number, amount = price) =>
  checkAmount({ paymentType: "credits", creditsPack: { size, price } }, amount);

test("scénario d'attaque : 10 000 crédits pour 1 FCFA refusé", () => {
  assert.equal(credits(10000, 1, 1).ok, false);
  assert.equal(credits(50, 1, 1).ok, false); // pack connu, prix falsifié
  assert.equal(credits(50, 5000, 1).ok, false); // prix du pack correct mais montant débité falsifié
  assert.equal(credits(50, 1, 5000).ok, false); // pack falsifié, montant correct
});

test("tous les packs au tarif serveur sont acceptés", () => {
  for (const [size, price] of Object.entries(CREDIT_PACKS)) {
    assert.deepEqual(credits(Number(size), price), { ok: true, amount: price });
  }
});

test("cas limites de pack : taille négative, NaN, __proto__, montant nul ou négatif", () => {
  assert.equal(credits(-5, 1000, 1000).ok, false);
  assert.equal(credits(NaN, 1000, 1000).ok, false);
  assert.equal(checkAmount({ paymentType: "credits", creditsPack: null }, 1000).ok, false);
  assert.equal(credits(10, 1000, 0).ok, false);
  assert.equal(credits(10, 1000, -1000).ok, false);
  assert.equal(credits(10, 1000, NaN).ok, false);
});

test("activation de boutique : 1300 exactement", () => {
  assert.equal(checkAmount({ paymentType: "shop_activation" }, 1300).ok, true);
  assert.equal(checkAmount({ paymentType: "shop_activation" }, 1).ok, false);
  assert.equal(checkAmount({ paymentType: "shop_activation" }, 1301).ok, false);
});

test("plans : mensuel, annuel, plan inconnu, annuel sans formule annuelle", () => {
  const sub = (plan: string | null, billingCycle: string | null, amount: number, paymentType = "shop_subscription") =>
    checkAmount({ paymentType, plan, billingCycle }, amount).ok;
  assert.equal(sub("pro_monthly", "monthly", 12000), true);
  assert.equal(sub("pro_monthly", "annual", 118800), true);
  assert.equal(sub("premium_academy_pro", "monthly", 35000), true);
  assert.equal(sub("premium_academy_pro", "annual", 342000), true);
  assert.equal(sub("starter", null, 12000), true); // SubscriptionCard n'envoie pas de cycle
  assert.equal(sub("pro_monthly", "monthly", 100), false);
  assert.equal(sub("premium_academy_pro", "monthly", 12000), false); // payer le prix du plan Pro pour obtenir Premium
  assert.equal(sub("pro_monthly", "annual", 12000), false); // payer 1 mois pour 12
  assert.equal(sub("starter", "annual", 118800), false);
  assert.equal(sub("enterprise", "monthly", 1), false);
  assert.equal(sub("constructor", "monthly", 1), false); // clé héritée de Object.prototype
  assert.equal(sub("pro_monthly", "weekly", 12000), false);
  // type « subscription » sans plan : retombe sur pro_monthly comme le webhook
  assert.equal(sub(null, null, 12000, "subscription"), true);
  assert.equal(sub(null, null, 1, "subscription"), false);
});

test("commission : paiement partiel autorisé, jamais au-delà du solde, minimum 100", () => {
  const c = (amount: number, due: number | null) => checkAmount({ paymentType: "commission_payment", commissionBalanceDue: due }, amount).ok;
  assert.equal(c(12000, 12000), true);
  assert.equal(c(500, 12000), true);
  assert.equal(c(99, 12000), false);
  assert.equal(c(12001, 12000), false);
  assert.equal(c(500, 0), false);
  assert.equal(c(500, null), false);
});

test("type de paiement inconnu refusé", () => {
  assert.equal(checkAmount({ paymentType: "gift" }, 1000).ok, false);
});

// --- Ecomfy Pay (checkout client) ---
const shop = "shop-1";
const order = { shop_id: shop, total: 100000, payment_status: "pending" };
const expected = 100000; // total recalculé depuis order_items x products (orderExpectedTotal)

test("scénario d'attaque : payer 1 FCFA une commande de 100 000 FCFA refusé", () => {
  assert.equal(checkCustomerPayment({ amount: 1, shopId: shop, order, orderExpected: expected, orderId: "o1" }).ok, false);
});

test("scénario d'attaque : total de commande falsifié à 1 FCFA, total attendu issu des prix produits", () => {
  // orders.total = 1 inséré par le navigateur (trigger absent ou contourné) : le total attendu reste 100 000
  assert.equal(checkCustomerPayment({ amount: 1, shopId: shop, order: { ...order, total: 1 }, orderExpected: expected, orderId: "o1" }).ok, false);
});

test("commande : montant exact accepté, tolérance d'arrondi d'1 FCFA, le montant débité est celui du serveur", () => {
  assert.deepEqual(checkCustomerPayment({ amount: 100000, shopId: shop, order, orderExpected: expected, orderId: "o1" }), { ok: true, amount: 100000 });
  assert.deepEqual(checkCustomerPayment({ amount: 8000, shopId: shop, order, orderExpected: 8000.4, orderId: "o1" }), { ok: true, amount: 8000 });
  assert.equal(checkCustomerPayment({ amount: 99998, shopId: shop, order, orderExpected: expected, orderId: "o1" }).ok, false);
  assert.equal(checkCustomerPayment({ amount: 100002, shopId: shop, order, orderExpected: expected, orderId: "o1" }).ok, false);
});

test("commande sans total attendu calculable (aucun article, produit indisponible, lot invalide) refusée", () => {
  assert.equal(checkCustomerPayment({ amount: 100000, shopId: shop, order, orderExpected: null, orderId: "o1" }).ok, false);
  assert.equal(checkCustomerPayment({ amount: 100000, shopId: shop, order, orderId: "o1" }).ok, false);
  assert.equal(checkCustomerPayment({ amount: 1, shopId: shop, order, orderExpected: 0, orderId: "o1" }).ok, false);
});

test("commande d'une autre boutique, absente ou déjà payée refusée", () => {
  const base = { amount: 100000, shopId: shop, orderExpected: expected, orderId: "o1" };
  assert.equal(checkCustomerPayment({ ...base, order: { ...order, shop_id: "autre" } }).ok, false);
  assert.equal(checkCustomerPayment({ ...base, order: null }).ok, false);
  assert.equal(checkCustomerPayment({ ...base, order: { ...order, payment_status: "PAID" } }).ok, false);
});

test("ni commande ni lien : refusé (ancien comportement : montant libre)", () => {
  assert.equal(checkCustomerPayment({ amount: 1, shopId: shop }).ok, false);
});

test("lien de paiement : montant fixe, montant libre avec minimum, lien inactif ou d'une autre boutique", () => {
  const link = { shop_id: shop, amount: 5000, is_active: true, allow_custom_amount: false };
  assert.equal(checkCustomerPayment({ amount: 5000, shopId: shop, link, paymentLinkId: "l1" }).ok, true);
  assert.equal(checkCustomerPayment({ amount: 1, shopId: shop, link, paymentLinkId: "l1" }).ok, false);
  const open = { ...link, allow_custom_amount: true };
  assert.equal(checkCustomerPayment({ amount: 7000, shopId: shop, link: open, paymentLinkId: "l1" }).ok, true);
  assert.equal(checkCustomerPayment({ amount: 1, shopId: shop, link: open, paymentLinkId: "l1" }).ok, false);
  assert.equal(checkCustomerPayment({ amount: 5000, shopId: shop, link: { ...link, is_active: false }, paymentLinkId: "l1" }).ok, false);
  assert.equal(checkCustomerPayment({ amount: 5000, shopId: shop, link: { ...link, shop_id: "autre" }, paymentLinkId: "l1" }).ok, false);
});

// --- Total attendu d'une commande (orderExpectedTotal), même règle que le trigger SQL ---
const prods = {
  p1: { shop_id: shop, price: 5000 },
  p2: { shop_id: shop, price: 10000, bundle_offers: [{ quantity: 3, price: 24000, label: "Lot de 3" }, { quantity: "x", price: 5 }, { quantity: 2 }] },
  autre: { shop_id: "autre-boutique", price: 100 },
};
const total = (lines: any[], p: any = prods) => orderExpectedTotal(shop, lines, p);

test("total attendu : quantité x prix produit, sans tenir compte de unit_price envoyé", () => {
  assert.deepEqual(total([{ product_id: "p1", quantity: 2, unit_price: 1 }]), { ok: true, total: 10000 });
  assert.deepEqual(total([{ product_id: "p1", quantity: "2" }, { product_id: "p2", quantity: 1 }]), { ok: true, total: 20000 });
});

test("total attendu : lot de 3 à 24 000 = 8 000 l'unité, appliqué à toute quantité >= 3", () => {
  assert.deepEqual(total([{ product_id: "p2", quantity: 3, bundle_index: 0 }]), { ok: true, total: 24000 });
  assert.deepEqual(total([{ product_id: "p2", quantity: 5, bundle_index: 0 }]), { ok: true, total: 40000 });
});

test("total attendu : lot invalide refusé (quantité trop faible, index hors tableau, négatif, malformé, produit sans lot)", () => {
  for (const [product_id, quantity, bundle_index] of [["p2", 2, 0], ["p2", 3, 9], ["p2", 3, -1], ["p2", 3, 1], ["p2", 3, 2], ["p1", 1, 0], ["p2", 3, 0.5]] as const) {
    assert.equal(total([{ product_id, quantity, bundle_index }]).ok, false, `${product_id} x${quantity} lot ${bundle_index}`);
  }
});

test("total attendu : produit d'une autre boutique, inconnu ou clé héritée refusé", () => {
  assert.equal(total([{ product_id: "autre", quantity: 1 }]).ok, false);
  assert.equal(total([{ product_id: "inconnu", quantity: 1 }]).ok, false);
  assert.equal(total([{ product_id: "constructor", quantity: 1 }]).ok, false);
});

test("total attendu : aucune ligne valide refusée, lignes de quantité nulle, négative ou fractionnaire ignorées", () => {
  assert.equal(total([]).ok, false);
  assert.equal(total([{ product_id: "p1", quantity: 0 }, { product_id: "p1", quantity: -3 }, { product_id: "p1", quantity: 1.5 }]).ok, false);
  assert.deepEqual(total([{ product_id: "p1", quantity: 1 }, { product_id: "p2", quantity: -9 }]), { ok: true, total: 5000 });
});

test("l'interface (priceLine) et le serveur (orderExpectedTotal) calculent le même total", () => {
  const product = { price: 3333, bundle_offers: [{ quantity: 3, price: 10000 }, { quantity: 7, price: 20000 }] };
  for (const idx of [null, 0, 1]) {
    for (const qty of [1, 2, 3, 4, 7, 10, 999]) {
      const ui = priceLine(product, idx, qty);
      const srv = orderExpectedTotal("s", [{ product_id: "p", quantity: qty, bundle_index: ui.bundleIndex }], { p: { shop_id: "s", ...product } });
      assert.ok(srv.ok, `serveur refuse idx=${idx} qty=${qty}`);
      assert.equal((srv as any).total, ui.total, `idx=${idx} qty=${qty}`);
    }
  }
  // quantité inférieure au lot : l'interface retombe sur le prix de base et n'envoie pas de bundle_index
  assert.deepEqual(priceLine(product, 0, 2), { total: 6666, bundleIndex: null });
});

// --- Montant renvoyé par GeniusPay (ecomfy-pay-webhook) ---
test("montant GeniusPay : égal accepté, écart d'1 FCFA toléré, 1 FCFA contre 100 000 refusé", () => {
  assert.equal(remoteAmountMatches(100000, "100000.00"), true);
  assert.equal(remoteAmountMatches("100000", 100000), true);
  assert.equal(remoteAmountMatches(99999.5, 100000), true);
  assert.equal(remoteAmountMatches(1, 100000), false);
  assert.equal(remoteAmountMatches(100002, 100000), false);
});

test("montant GeniusPay absent ou illisible : refusé (jamais de crédit sans montant)", () => {
  for (const bad of [undefined, null, "", "abc", NaN]) assert.equal(remoteAmountMatches(bad, 100000), false);
  assert.equal(remoteAmountMatches(100000, undefined), false);
});

// --- Cohérence avec l'interface : un prix modifié d'un seul côté casserait les achats légitimes ---
const src = (p: string) => readFileSync(new URL(`../../src/${p}`, import.meta.url), "utf8");

test("AICreditsBadge.tsx et Subscription.tsx affichent les prix du serveur", () => {
  const pairs = (text: string) => [...text.matchAll(/size:\s*(\d+),\s*price:\s*(\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  for (const file of ["components/AICreditsBadge.tsx", "pages/Subscription.tsx"]) {
    const found = pairs(src(file));
    assert.ok(found.length >= 3, `${file} : packs introuvables`);
    for (const [size, price] of found) assert.equal(CREDIT_PACKS[size], price, `${file} : pack ${size}`);
  }
});

test("ecomfy-pay-webhook compare le montant GeniusPay avant de créditer", () => {
  const wh = readFileSync(new URL("../functions/ecomfy-pay-webhook/index.ts", import.meta.url), "utf8");
  const cmp = wh.indexOf("remoteAmountMatches(remoteAmount");
  assert.ok(cmp > 0, "comparaison absente");
  assert.ok(cmp < wh.indexOf('"credit_merchant_wallet_pending"'), "la comparaison doit précéder le crédit du portefeuille");
  assert.ok(cmp < wh.indexOf('payment_status: "PAID"'), "la comparaison doit précéder le marquage PAID");
});

test("PricingDashboard.tsx, SubscriptionCard.tsx et ShopEditor.tsx envoient les prix du serveur", () => {
  const dash = src("pages/PricingDashboard.tsx");
  assert.match(dash, /isAnnual \? 9900 : 12000/);
  assert.match(dash, /isAnnual \? 28500 : 35000/);
  assert.equal(PLAN_PRICES.pro_monthly.annual, 9900 * 12);
  assert.equal(PLAN_PRICES.premium_academy_pro.annual, 28500 * 12);
  assert.match(src("components/shop/SubscriptionCard.tsx"), /amount: 12000/);
  assert.match(src("pages/ShopEditor.tsx"), /amount: 1300/);
});
