// Connecteur GeniusPay (agrégateur Wave / Orange Money / MTN / Moov / carte). Implémente OperatorConnector.
// Configuration injectée (voir ./index.ts) : aucune lecture d'environnement ici, donc testable sous Node avec un fetch simulé.
import { verifyWebhookSignature } from "../webhookSignature.ts";
import type {
  FetchPaymentResult,
  InitiatePaymentRequest,
  InitiatePaymentResult,
  InitiatePayoutRequest,
  InitiatePayoutResult,
  OperatorConnector,
  ParsedWebhookEvent,
  RemotePaymentStatus,
  WebhookVerification,
} from "./types.ts";

export interface GeniusPayConfig {
  /** Ex. https://geniuspay.ci/api/v1/merchant (sans barre finale). */
  apiUrl: string;
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
  fetch?: typeof fetch;
  /** Horloge injectable pour la tolérance de l'horodatage des webhooks (tests). */
  nowSeconds?: () => number;
}

const SUCCESS_STATUS = ["completed", "paid", "success", "succeeded"];
const PENDING_STATUS = ["pending", "processing", "created", "initiated", "in_progress"];
const FAILED_STATUS = ["failed", "cancelled", "canceled", "expired", "declined", "rejected", "error"];

export function mapGeniusPayStatus(status: unknown): RemotePaymentStatus {
  const s = String(status ?? "").toLowerCase();
  if (SUCCESS_STATUS.includes(s)) return "SUCCEEDED";
  if (PENDING_STATUS.includes(s)) return "PENDING";
  if (FAILED_STATUS.includes(s)) return "FAILED";
  return "UNKNOWN";
}

const PAYOUT_FAIL_EVENT = /\.(fail|failed|rejected|cancel|cancelled|canceled|error)$/;
const PAYOUT_SUCCESS_EVENT = /\.(success|succeeded|completed|paid)$/;
const PAYMENT_FAIL = /(fail|cancel|expire|declin|reject|error)/;

export class GeniusPayConnector implements OperatorConnector {
  readonly id = "geniuspay";

  private readonly cfg: GeniusPayConfig;

  constructor(cfg: GeniusPayConfig) {
    this.cfg = cfg;
  }

  private get http(): typeof fetch {
    return this.cfg.fetch ?? fetch;
  }

  private authHeaders(): Record<string, string> {
    return { "X-API-Key": this.cfg.apiKey ?? "", "X-API-Secret": this.cfg.apiSecret ?? "" };
  }

  isConfigured(): boolean {
    return !!(this.cfg.apiKey && this.cfg.apiSecret);
  }

  async initiatePayment(req: InitiatePaymentRequest): Promise<InitiatePaymentResult> {
    const payload = {
      amount: req.amount,
      currency: req.currency,
      description: req.description,
      customer: {
        name: req.customer.name || "Client",
        phone: req.customer.phone || undefined,
        email: req.customer.email || undefined,
      },
      metadata: {
        internal_reference: req.internalReference,
        payment_id: req.paymentId,
        merchant_id: req.merchantId,
        shop_id: req.shopId,
        type: "ecomfy_pay_customer_order",
      },
      success_url: req.successUrl,
      error_url: req.errorUrl,
    };

    let resp: Response;
    try {
      resp = await this.http(`${this.cfg.apiUrl}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.authHeaders() },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      return { ok: false, reason: `network: ${(e as Error)?.message ?? e}` };
    }
    const json: any = await resp.json().catch(() => ({}));

    if (resp.ok && json?.data?.checkout_url) {
      const ref = json.data.reference || json.data.id;
      return { ok: true, checkoutUrl: json.data.checkout_url, providerReference: ref ? String(ref) : undefined };
    }
    if (resp.ok && json?.checkout_url) {
      return { ok: true, checkoutUrl: json.checkout_url };
    }
    return { ok: false, httpStatus: resp.status, reason: json?.message || json?.error || `HTTP ${resp.status}` };
  }

  async fetchPayment(providerReference: string): Promise<FetchPaymentResult> {
    let resp: Response;
    try {
      resp = await this.http(`${this.cfg.apiUrl}/payments/${encodeURIComponent(providerReference)}`, {
        method: "GET",
        headers: this.authHeaders(),
      });
    } catch {
      return { kind: "unavailable" };
    }
    if (!resp.ok) return { kind: "unavailable", httpStatus: resp.status };
    const json: any = await resp.json().catch(() => ({}));
    const remote = json?.data || json;
    const amount = remote?.amount;
    return {
      kind: "ok",
      status: mapGeniusPayStatus(remote?.status),
      amount: amount === undefined || amount === null || amount === "" ? null : amount,
      currency: remote?.currency ? String(remote.currency) : null,
    };
  }

  async initiatePayout(req: InitiatePayoutRequest): Promise<InitiatePayoutResult> {
    const payload = {
      amount: req.amount,
      currency: req.currency,
      reference: req.withdrawalReference,
      destination: {
        type: req.method,
        phone: req.phone ?? undefined,
        name: req.name ?? undefined,
        operator: req.operator || undefined,
      },
    };

    let resp: Response;
    try {
      resp = await this.http(`${this.cfg.apiUrl}/payouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.authHeaders() },
        body: JSON.stringify(payload),
      });
    } catch {
      return { outcome: "UNKNOWN" };
    }
    const json: any = await resp.json().catch(() => ({}));

    if (resp.ok && json?.success) {
      const ref = json.data?.reference || json.data?.id;
      return { outcome: "ACCEPTED", providerReference: ref ? String(ref) : undefined };
    }
    if (resp.status >= 400 && resp.status < 500) {
      return {
        outcome: "REJECTED",
        httpStatus: resp.status,
        reason: json?.message || json?.error || `Refusé par le prestataire (HTTP ${resp.status})`,
      };
    }
    return { outcome: "UNKNOWN", httpStatus: resp.status };
  }

  async verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookVerification> {
    if (!this.cfg.webhookSecret) {
      return { ok: false, status: 500, reason: "Webhook secret not configured" };
    }
    const check = await verifyWebhookSignature({
      secret: this.cfg.webhookSecret,
      rawBody,
      signature: headers.get("x-webhook-signature") || "",
      timestamp: headers.get("x-webhook-timestamp") || "",
      nowSeconds: this.cfg.nowSeconds?.(),
    });
    return check.ok ? { ok: true } : { ok: false, status: 401, reason: check.reason };
  }

  parseWebhook(rawBody: string, headers: Headers): ParsedWebhookEvent {
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return { kind: "invalid", error: "Invalid JSON", status: 400 };
    }

    const event = payload?.event || headers.get("x-webhook-event") || "payment.success";
    const data = payload?.data || payload;
    const meta = data?.metadata || {};

    const internalRef = meta?.internal_reference || data?.internal_reference;
    const providerRef = data?.reference || data?.id;
    if (!internalRef && !providerRef) {
      return { kind: "invalid", error: "Missing transaction reference" };
    }

    const eventName = String(event || "").toLowerCase();
    const status = String(data?.status ?? "").toLowerCase();
    const delivery = headers.get("x-webhook-delivery");

    // Retraits : jamais traités comme des paiements.
    if (/^(payout|withdrawal|transfer)\./.test(eventName)) {
      const failed = PAYOUT_FAIL_EVENT.test(eventName) || ["failed", "rejected", "cancelled", "canceled"].includes(status);
      const succeeded = PAYOUT_SUCCESS_EVENT.test(eventName) || (!PAYOUT_FAIL_EVENT.test(eventName) && ["completed", "success", "succeeded"].includes(status));
      if (!succeeded && !failed) return { kind: "ignored", eventType: eventName };

      const candidates = [meta?.withdrawal_reference, data?.merchant_reference, data?.reference, data?.id]
        .filter((v): v is string => typeof v === "string" && v.length > 0);
      if (candidates.length === 0) return { kind: "invalid", error: "Missing withdrawal reference" };

      return {
        kind: "payout",
        outcome: succeeded ? "SUCCEEDED" : "FAILED",
        eventType: String(event),
        eventId: delivery || `${candidates[0]}_${eventName}`,
        withdrawalCandidates: candidates,
        providerReference: typeof data?.id === "string" ? data.id : null,
        failureReason: succeeded ? null : (data?.failure_reason || data?.message || null),
      };
    }

    // Succès ou échec explicite uniquement : un événement intermédiaire ne doit jamais faire échouer un paiement.
    const isSuccess = event === "payment.success" || data?.status === "completed" || data?.status === "success";
    const isFailure = !isSuccess && (PAYMENT_FAIL.test(eventName) || PAYMENT_FAIL.test(status));
    if (!isSuccess && !isFailure) return { kind: "ignored", eventType: eventName };

    return {
      kind: "payment",
      outcome: isSuccess ? "SUCCEEDED" : "FAILED",
      eventType: String(event),
      eventId: delivery || `${providerRef || internalRef}_${event}`,
      internalReference: internalRef || null,
      providerReference: providerRef ? String(providerRef) : null,
      failureReason: isFailure ? (data?.failure_reason || data?.message || null) : null,
    };
  }
}
