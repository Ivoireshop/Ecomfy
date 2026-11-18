// Validation des entrées de l'API Ecomfy Pay. Aucune dépendance Deno : testable sous Node.
// Les erreurs portent le nom du paramètre fautif (`param`), comme dans la documentation.

export const PAYMENT_METHODS = ["wave", "orange_money", "mtn", "moov", "card"] as const;
export const MIN_AMOUNT = 200; // minimum GeniusPay en XOF
export const MAX_AMOUNT = 10_000_000;
export const SCENARIOS = ["success", "insufficient_funds", "declined", "cancelled", "expired"] as const;

export type Scenario = (typeof SCENARIOS)[number];

export interface CreatePaymentInput {
  amount: number;
  currency: "XOF";
  payment_method: (typeof PAYMENT_METHODS)[number];
  description?: string;
  customer: { name?: string; phone?: string; email?: string };
  success_url: string;
  cancel_url?: string;
  client_reference?: string;
  metadata: Record<string, string>;
}

export type Validated<T> = { ok: true; value: T } | { ok: false; param: string; message: string };

const ALLOWED_FIELDS = new Set([
  "amount", "currency", "payment_method", "description", "customer", "success_url", "cancel_url", "client_reference", "metadata",
]);

const fail = (param: string, message: string): { ok: false; param: string; message: string } => ({ ok: false, param, message });
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** URL de retour : https obligatoire ; en mode test, http://localhost et 127.0.0.1 sont acceptés (développement local). */
export function validateReturnUrl(value: unknown, livemode: boolean, param: string): Validated<string> {
  if (typeof value !== "string" || !value.trim()) return fail(param, `${param} doit être une URL.`);
  if (value.length > 500) return fail(param, `${param} dépasse 500 caractères.`);
  let u: URL;
  try { u = new URL(value); } catch { return fail(param, `${param} n'est pas une URL valide.`); }
  if (u.username || u.password) return fail(param, `${param} ne doit pas contenir d'identifiants.`);
  const local = u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  if (u.protocol !== "https:" && !(local && !livemode)) {
    return fail(param, livemode ? `${param} doit commencer par https://.` : `${param} doit commencer par https:// (http://localhost est accepté en mode test).`);
  }
  return { ok: true, value: u.toString() };
}

export function validateCreatePayment(body: unknown, livemode: boolean): Validated<CreatePaymentInput> {
  if (!isObject(body)) return fail("body", "Le corps de la requête doit être un objet JSON.");
  for (const k of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(k)) return fail(k, `Paramètre inconnu : ${k}.`);
  }

  const { amount, currency, payment_method, description, customer, success_url, cancel_url, client_reference, metadata } = body;

  if (typeof amount !== "number" || !Number.isInteger(amount)) return fail("amount", "amount doit être un entier (en francs CFA, sans décimales).");
  if (amount < MIN_AMOUNT) return fail("amount", `amount minimum : ${MIN_AMOUNT} XOF.`);
  if (amount > MAX_AMOUNT) return fail("amount", `amount maximum : ${MAX_AMOUNT} XOF.`);

  if (currency !== undefined && currency !== "XOF") return fail("currency", "Seule la devise XOF est disponible.");

  if (typeof payment_method !== "string" || !(PAYMENT_METHODS as readonly string[]).includes(payment_method)) {
    return fail("payment_method", `payment_method doit valoir : ${PAYMENT_METHODS.join(", ")}.`);
  }

  if (description !== undefined && (typeof description !== "string" || description.length > 200)) {
    return fail("description", "description doit être un texte de 200 caractères au plus.");
  }

  const cust: CreatePaymentInput["customer"] = {};
  if (customer !== undefined) {
    if (!isObject(customer)) return fail("customer", "customer doit être un objet.");
    for (const k of Object.keys(customer)) {
      if (!["name", "phone", "email"].includes(k)) return fail(`customer.${k}`, `Paramètre inconnu : customer.${k}.`);
    }
    if (customer.name !== undefined) {
      if (typeof customer.name !== "string" || !customer.name.trim() || customer.name.length > 120) return fail("customer.name", "customer.name doit être un texte de 1 à 120 caractères.");
      cust.name = customer.name.trim();
    }
    if (customer.phone !== undefined) {
      const phone = typeof customer.phone === "string" ? customer.phone.replace(/[\s.-]/g, "") : "";
      if (!/^\+?[0-9]{8,15}$/.test(phone)) return fail("customer.phone", "customer.phone doit contenir de 8 à 15 chiffres (préfixe + accepté).");
      cust.phone = phone;
    }
    if (customer.email !== undefined) {
      if (typeof customer.email !== "string" || customer.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
        return fail("customer.email", "customer.email n'est pas une adresse valide.");
      }
      cust.email = customer.email.trim();
    }
  }

  if (success_url === undefined) return fail("success_url", "success_url est obligatoire : la page où renvoyer le client après le paiement.");
  const su = validateReturnUrl(success_url, livemode, "success_url");
  if (!su.ok) return su;
  let cu: string | undefined;
  if (cancel_url !== undefined) {
    const r = validateReturnUrl(cancel_url, livemode, "cancel_url");
    if (!r.ok) return r;
    cu = r.value;
  }

  if (client_reference !== undefined && (typeof client_reference !== "string" || !client_reference.trim() || client_reference.length > 100)) {
    return fail("client_reference", "client_reference doit être un texte de 1 à 100 caractères.");
  }

  const meta: Record<string, string> = {};
  if (metadata !== undefined) {
    if (!isObject(metadata)) return fail("metadata", "metadata doit être un objet.");
    const keys = Object.keys(metadata);
    if (keys.length > 20) return fail("metadata", "metadata accepte 20 clés au plus.");
    for (const k of keys) {
      if (k.length === 0 || k.length > 40) return fail(`metadata.${k}`, "Les clés de metadata font de 1 à 40 caractères.");
      const v = metadata[k];
      if (typeof v !== "string" || v.length > 500) return fail(`metadata.${k}`, "Les valeurs de metadata sont des textes de 500 caractères au plus.");
      meta[k] = v;
    }
  }

  return {
    ok: true,
    value: {
      amount,
      currency: "XOF",
      payment_method: payment_method as CreatePaymentInput["payment_method"],
      ...(description !== undefined ? { description } : {}),
      customer: cust,
      success_url: su.value,
      ...(cu ? { cancel_url: cu } : {}),
      ...(client_reference !== undefined ? { client_reference: (client_reference as string).trim() } : {}),
      metadata: meta,
    },
  };
}

export function validateScenario(body: unknown): Validated<Scenario> {
  const s = isObject(body) ? body.scenario : undefined;
  if (typeof s !== "string" || !(SCENARIOS as readonly string[]).includes(s)) {
    return fail("scenario", `scenario doit valoir : ${SCENARIOS.join(", ")}.`);
  }
  return { ok: true, value: s as Scenario };
}

/** JSON à clés triées : deux corps équivalents donnent la même chaîne (empreinte d'idempotence). */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Clé d'idempotence : 1 à 255 caractères imprimables. */
export function validateIdempotencyKey(value: string | null): Validated<string | null> {
  if (value === null) return { ok: true, value: null };
  if (!/^[\x21-\x7e]{1,255}$/.test(value)) return fail("Idempotency-Key", "Idempotency-Key : 1 à 255 caractères visibles, sans espace.");
  return { ok: true, value };
}

export const PAYMENT_ID_RE = /^pay_(test|live)_[0-9a-f]{24}$/;
export const SECRET_KEY_RE = /^ecm_sk_(test|live)_[0-9a-f]{64}$/;
