// Tarifs côté serveur (correctif C6). Seule source de vérité pour les montants de process-payment :
// le montant envoyé par le navigateur n'est jamais cru, il est comparé à celui-ci.
// Module pur (aucune dépendance Deno), testé par supabase/tests/pricing.test.ts.
// Toute modification de prix doit être faite ici ET dans l'interface (voir les écrans cités en commentaire).

export const SHOP_ACTIVATION_FEE = 1300; // ShopEditor.tsx
export const MIN_COMMISSION_PAYMENT = 100; // PayCommissionDialog.tsx

// Packs de crédits IA : taille -> prix (XOF). AICreditsBadge.tsx et Subscription.tsx.
export const CREDIT_PACKS: Readonly<Record<number, number>> = {
  10: 1000,
  20: 2000,
  30: 2500,
  40: 3000,
  50: 5000,
};

// Plans payants : prix mensuel et prix annuel (12 mois, -20 %). PricingDashboard.tsx, SubscriptionCard.tsx.
export const PLAN_PRICES: Readonly<Record<string, { monthly: number; annual?: number }>> = {
  starter: { monthly: 12000 },
  pro_monthly: { monthly: 12000, annual: 118800 },
  premium_academy_pro: { monthly: 35000, annual: 342000 },
};

export type PriceInput = {
  paymentType: string;
  plan?: string | null;
  billingCycle?: string | null;
  creditsPack?: { size: number; price: number } | null;
  /** Solde de commission dû de la boutique, lu en base (commission_payment uniquement). */
  commissionBalanceDue?: number | null;
};

export type PriceResult =
  | { ok: true; amount: number; /** true si le montant peut être inférieur au montant exact (paiement partiel) */ max?: boolean }
  | { ok: false; error: string };

/** Montant attendu pour une demande de paiement. `amount` est le montant annoncé par le navigateur. */
export function checkAmount(input: PriceInput, amount: number): PriceResult {
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Montant invalide." };

  switch (input.paymentType) {
    case "credits": {
      const size = input.creditsPack?.size;
      const price = size !== undefined ? CREDIT_PACKS[size] : undefined;
      if (price === undefined) return { ok: false, error: "Pack de crédits inconnu." };
      if (input.creditsPack!.price !== price || amount !== price) {
        return { ok: false, error: "Le prix de ce pack a changé. Rechargez la page." };
      }
      return { ok: true, amount: price };
    }
    case "shop_activation":
      return amount === SHOP_ACTIVATION_FEE
        ? { ok: true, amount: SHOP_ACTIVATION_FEE }
        : { ok: false, error: "Montant d'activation incorrect." };
    case "shop_subscription":
    case "subscription": {
      const plan = input.plan || (input.paymentType === "subscription" ? "pro_monthly" : "starter");
      const prices = Object.prototype.hasOwnProperty.call(PLAN_PRICES, plan) ? PLAN_PRICES[plan] : undefined;
      if (!prices) return { ok: false, error: "Plan inconnu." };
      const cycle = input.billingCycle || "monthly";
      if (cycle !== "monthly" && cycle !== "annual") return { ok: false, error: "Période de facturation inconnue." };
      const expected = cycle === "annual" ? prices.annual : prices.monthly;
      if (expected === undefined) return { ok: false, error: "Ce plan n'a pas de formule annuelle." };
      return amount === expected ? { ok: true, amount: expected } : { ok: false, error: "Montant du plan incorrect." };
    }
    case "commission_payment": {
      const due = Number(input.commissionBalanceDue);
      if (!Number.isFinite(due) || due <= 0) return { ok: false, error: "Aucune commission à régler." };
      // Paiement partiel autorisé (apply_commission_payment), mais jamais plus que le solde dû.
      if (amount < MIN_COMMISSION_PAYMENT) return { ok: false, error: `Minimum ${MIN_COMMISSION_PAYMENT} FCFA.` };
      if (amount > Math.ceil(due)) return { ok: false, error: "Le montant dépasse la commission due." };
      return { ok: true, amount, max: true };
    }
    default:
      return { ok: false, error: "Type de paiement inconnu." };
  }
}

export type CustomerPaymentCheck =
  | { ok: true; amount: number }
  | { ok: false; error: string; status: number };

/** Ecomfy Pay (checkout client) : le montant doit être compatible avec la commande ou le lien de paiement. */
export function checkCustomerPayment(args: {
  amount: number;
  shopId: string;
  order?: { shop_id: string; total: number | string | null; payment_status?: string | null } | null;
  /** Total attendu de la commande (orderExpectedTotal) : indispensable dès qu'il y a une commande. */
  orderExpected?: number | null;
  link?: { shop_id: string; amount: number | string; is_active: boolean; allow_custom_amount: boolean } | null;
  orderId?: string | null;
  paymentLinkId?: string | null;
}): CustomerPaymentCheck {
  const { amount, shopId, order, orderExpected, link, orderId, paymentLinkId } = args;
  if (!orderId && !paymentLinkId) {
    return { ok: false, status: 400, error: "Commande ou lien de paiement requis." };
  }
  if (orderId) {
    if (!order || order.shop_id !== shopId) return { ok: false, status: 404, error: "Commande introuvable." };
    if (String(order.payment_status || "").toUpperCase() === "PAID") {
      return { ok: false, status: 409, error: "Cette commande est déjà payée." };
    }
    // Le total attendu vient des lignes de commande et des prix de `products` (lots compris), pas de orders.total
    // qui peut avoir été fixé par le navigateur si le trigger recompute_order_totals est absent.
    if (typeof orderExpected !== "number" || !Number.isFinite(orderExpected) || orderExpected <= 0) {
      return { ok: false, status: 400, error: "Commande sans article valide." };
    }
    if (Math.abs(orderExpected - amount) > 1) {
      return { ok: false, status: 400, error: "Le montant ne correspond pas aux articles de la commande." };
    }
    return { ok: true, amount: Math.round(orderExpected) };
  }
  if (!link || link.shop_id !== shopId || !link.is_active) {
    return { ok: false, status: 404, error: "Lien de paiement introuvable." };
  }
  const linkAmount = Number(link.amount);
  if (link.allow_custom_amount) {
    if (amount < linkAmount) return { ok: false, status: 400, error: "Montant inférieur au minimum du lien." };
    return { ok: true, amount };
  }
  if (Math.abs(linkAmount - amount) > 0.5) return { ok: false, status: 400, error: "Le montant ne correspond pas au lien." };
  return { ok: true, amount: linkAmount };
}

export type OrderLine = { product_id: string; quantity: number | string; bundle_index?: number | null };
export type ProductForTotal = { shop_id: string; price: number | string; bundle_offers?: unknown };

const NUMERIC = /^[0-9]+(\.[0-9]+)?$/; // même règle que le trigger enforce_order_item_price

/**
 * Total attendu d'une commande, calculé comme le trigger enforce_order_item_price :
 * sans lot, round(prix x quantité, 2) ; avec `bundle_index`, round(prix du lot x quantité / quantité du lot, 2),
 * à condition que la quantité atteigne celle du lot. Les prix viennent de `products`, jamais de la ligne de commande.
 */
export function orderExpectedTotal(
  shopId: string,
  lines: OrderLine[],
  products: Record<string, ProductForTotal | undefined>,
): { ok: true; total: number } | { ok: false; error: string } {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  let sum = 0;
  let counted = 0;
  for (const line of lines) {
    const qty = Number(line.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 999) continue; // refusées par le trigger : jamais comptées
    const product = Object.prototype.hasOwnProperty.call(products, line.product_id) ? products[line.product_id] : undefined;
    if (!product || product.shop_id !== shopId) return { ok: false, error: "Produit indisponible." };
    const base = Number(product.price);
    if (!Number.isFinite(base) || base < 0) return { ok: false, error: "Prix du produit invalide." };
    if (line.bundle_index === null || line.bundle_index === undefined) {
      sum += round2(base * qty);
    } else {
      const offers = Array.isArray(product.bundle_offers) ? (product.bundle_offers as unknown[]) : [];
      const offer = Number.isInteger(line.bundle_index) ? (offers[line.bundle_index] as { price?: unknown; quantity?: unknown } | undefined) : undefined;
      const oq = offer && NUMERIC.test(String(offer.quantity)) ? Number(offer.quantity) : NaN;
      const op = offer && NUMERIC.test(String(offer.price)) ? Number(offer.price) : NaN;
      if (!Number.isFinite(oq) || !Number.isFinite(op) || oq < 1) return { ok: false, error: "Offre en lot invalide." };
      if (qty < oq) return { ok: false, error: "Quantité inférieure à celle de l'offre en lot." };
      sum += round2((op * qty) / oq);
    }
    counted += 1;
  }
  if (counted === 0) return { ok: false, error: "Commande sans article." };
  return { ok: true, total: round2(sum) };
}

/** Montant renvoyé par GeniusPay (`GET /payments/{ref}`) comparé à celui enregistré à l'initialisation. */
export function remoteAmountMatches(remote: unknown, expected: unknown, tolerance = 1): boolean {
  const r = typeof remote === "string" && remote.trim() === "" ? NaN : Number(remote);
  const e = Number(expected);
  return Number.isFinite(r) && Number.isFinite(e) && Math.abs(r - e) <= tolerance;
}
