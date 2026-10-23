// Interface commune des connecteurs opérateurs d'Ecomfy Pay (GeniusPay aujourd'hui ; Wave, Orange Money, MTN, Moov en direct demain).
// Les Edge Functions (ecomfy-pay-initiate, ecomfy-pay-webhook, ecomfy-pay-withdraw) ne parlent qu'à cette interface :
// ajouter un opérateur = écrire un connecteur et l'inscrire dans ./index.ts, sans toucher aux fonctions.
//
// Règles de contrat :
//   - un connecteur ne lève jamais d'exception pour un incident côté opérateur (réseau, 4xx, 5xx, réponse illisible) :
//     il renvoie un résultat typé, que l'appelant traduit en statut HTTP et en écritures en base ;
//   - un connecteur n'écrit jamais en base : il ne fait que parler à l'opérateur ;
//   - aucune dépendance Deno ici ni dans les connecteurs (la configuration est injectée) : testable sous Node.

/** Identifiant stable du connecteur ; stocké dans ecomfy_payments.provider et payment_events.provider. */
export type OperatorProviderId = string;

/** Moyen de paiement choisi par le client (ecomfy_payments.payment_method / wallet_ledger.operator). */
export type PaymentMethod = "wave" | "orange_money" | "mtn" | "moov" | "card";

/** Opérateur de versement d'un retrait (withdrawal_requests.payout_operator). */
export type PayoutOperator = "wave" | "orange_money" | "mtn" | "moov";

/** Statut d'un paiement vu par l'opérateur, normalisé. UNKNOWN = statut non reconnu : ne jamais le traiter comme un succès. */
export type RemotePaymentStatus = "SUCCEEDED" | "PENDING" | "FAILED" | "UNKNOWN";

// ---------------------------------------------------------------------------------------------------------------------
// Encaissement
// ---------------------------------------------------------------------------------------------------------------------

export interface InitiatePaymentRequest {
  /** ECM-PAY-… : référence interne, renvoyée telle quelle par l'opérateur dans ses webhooks. */
  internalReference: string;
  paymentId: string;
  merchantId: string;
  shopId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod | string;
  description: string;
  customer: { name?: string | null; phone?: string | null; email?: string | null };
  successUrl: string;
  errorUrl: string;
}

export type InitiatePaymentResult =
  | {
      ok: true;
      /** Page de l'opérateur où rediriger le client. */
      checkoutUrl: string;
      /** Référence côté opérateur, quand il en fournit une (sert à rattacher le webhook et à confirmer le paiement). */
      providerReference?: string;
    }
  | {
      ok: false;
      /** Statut HTTP renvoyé par l'opérateur ; absent en cas d'erreur réseau. */
      httpStatus?: number;
      reason: string;
    };

export type FetchPaymentResult =
  /** Opérateur injoignable ou réponse d'erreur : l'appelant doit réessayer plus tard, sans rien inscrire. */
  | { kind: "unavailable"; httpStatus?: number }
  | {
      kind: "ok";
      status: RemotePaymentStatus;
      /** Montant réellement encaissé, tel que renvoyé par l'opérateur ; null s'il est absent. */
      amount: number | string | null;
      currency: string | null;
    };

// ---------------------------------------------------------------------------------------------------------------------
// Versement (retrait)
// ---------------------------------------------------------------------------------------------------------------------

export interface InitiatePayoutRequest {
  /** Référence du retrait côté Ecomfy (withdrawal_requests.withdrawal_reference). */
  withdrawalReference: string;
  amount: number;
  currency: string;
  method: string; // « mobile_money » | « bank_transfer »
  phone?: string | null;
  name?: string | null;
  operator?: PayoutOperator | null;
}

export type InitiatePayoutResult =
  /** Transfert pris en charge : le retrait passe en PROCESSING. */
  | { outcome: "ACCEPTED"; providerReference?: string }
  /** Refus définitif (4xx) : le montant doit retourner au solde disponible. */
  | { outcome: "REJECTED"; httpStatus: number; reason: string }
  /** Réseau, 5xx ou réponse ambiguë : le sort du transfert est inconnu, le retrait reste REQUESTED et sera clôturé par le webhook. */
  | { outcome: "UNKNOWN"; httpStatus?: number };

// ---------------------------------------------------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------------------------------------------------

export type WebhookVerification =
  | { ok: true }
  /** status 500 = secret non configuré (l'opérateur réessaiera) ; 401 = signature absente ou fausse. */
  | { ok: false; status: 401 | 500; reason: string };

export type ParsedWebhookEvent =
  /** Livraison inexploitable (JSON invalide, référence absente) : à acquitter sans rien écrire. */
  | { kind: "invalid"; error: string; status?: number }
  /** Événement intermédiaire (créé, en cours…) : à acquitter sans rien écrire. */
  | { kind: "ignored"; eventType: string }
  | {
      kind: "payment";
      outcome: "SUCCEEDED" | "FAILED";
      eventType: string;
      /** Identifiant d'idempotence de la livraison. */
      eventId: string;
      internalReference: string | null;
      providerReference: string | null;
      failureReason: string | null;
    }
  | {
      kind: "payout";
      outcome: "SUCCEEDED" | "FAILED";
      eventType: string;
      eventId: string;
      /** Références possibles du retrait (référence Ecomfy ou de l'opérateur), par ordre de préférence. */
      withdrawalCandidates: string[];
      providerReference: string | null;
      failureReason: string | null;
    };

// ---------------------------------------------------------------------------------------------------------------------
// Connecteur
// ---------------------------------------------------------------------------------------------------------------------

export interface OperatorConnector {
  readonly id: OperatorProviderId;

  /** Identifiants API présents ? Sinon (dev), l'appelant garde le paiement en PENDING / le retrait en REQUESTED. */
  isConfigured(): boolean;

  /** Crée le paiement chez l'opérateur et renvoie la page de paiement. */
  initiatePayment(req: InitiatePaymentRequest): Promise<InitiatePaymentResult>;

  /** Relit un paiement chez l'opérateur : le webhook ne fait jamais confiance à son seul contenu. */
  fetchPayment(providerReference: string): Promise<FetchPaymentResult>;

  /** Demande le versement d'un retrait. */
  initiatePayout(req: InitiatePayoutRequest): Promise<InitiatePayoutResult>;

  /** Authentifie une livraison de webhook sur le corps brut et les en-têtes (avant toute lecture de son contenu). */
  verifyWebhook(rawBody: string, headers: Headers): Promise<WebhookVerification>;

  /** Normalise une livraison authentifiée en événement Ecomfy. */
  parseWebhook(rawBody: string, headers: Headers): ParsedWebhookEvent;
}
