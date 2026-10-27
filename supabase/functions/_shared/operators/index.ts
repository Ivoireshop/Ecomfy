// Registre des connecteurs opérateurs d'Ecomfy Pay. Seul fichier de la couche qui lit l'environnement Deno.
// Ajouter un opérateur : écrire un connecteur (OperatorConnector), puis l'ajouter à CONNECTORS ci-dessous.
import { GENIUSPAY_API_URL } from "../geniuspayConfig.ts";
import { GeniusPayConnector } from "./geniuspay.ts";
import type { OperatorConnector } from "./types.ts";

export * from "./types.ts";

const CONNECTORS: Record<string, () => OperatorConnector> = {
  geniuspay: () =>
    new GeniusPayConnector({
      apiUrl: GENIUSPAY_API_URL,
      apiKey: Deno.env.get("GENIUSPAY_API_KEY") || undefined,
      apiSecret: Deno.env.get("GENIUSPAY_API_SECRET") || undefined,
      webhookSecret: Deno.env.get("GENIUSPAY_WEBHOOK_SECRET") || undefined,
    }),
};

export const DEFAULT_PROVIDER = "geniuspay";

/** Connecteur d'un opérateur, ou null s'il est inconnu (jamais d'identifiant libre transmis tel quel à l'extérieur). */
export function getConnector(id: string | null | undefined): OperatorConnector | null {
  const make = CONNECTORS[(id || DEFAULT_PROVIDER).toLowerCase()];
  return make ? make() : null;
}

/** Connecteur utilisé pour les nouveaux encaissements et retraits : ECOMFY_PAY_PROVIDER, sinon GeniusPay. */
export function getDefaultConnector(): OperatorConnector {
  return getConnector(Deno.env.get("ECOMFY_PAY_PROVIDER")) ?? getConnector(DEFAULT_PROVIDER)!;
}
