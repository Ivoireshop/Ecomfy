/* eslint-disable @typescript-eslint/ban-ts-comment -- module Deno hors du projet tsc (jamais typé par `npm run typecheck`) ; @ts-nocheck coupe les faux positifs de l'éditeur sur les imports npm:/jsr: */
// @ts-nocheck
/**
 * Estimation du coût fournisseur des générations du Studio, en USD.
 *
 * Ce sont des ESTIMATIONS pour piloter les plafonds et repérer une dérive : elles ne remplacent pas la facture
 * OpenAI / Replicate / Runway. Les tarifs ci-dessous sont les tarifs publics connus à la date de cette modification
 * (03/11/2026) ; à relire quand un fournisseur change ses prix. Un tarif peut aussi être forcé sans redéploiement
 * du code via les variables d'environnement AI_COST_*.
 *
 * Module pur : testé avec vitest.
 */

function envNumber(name: string, fallback: number): number {
  try {
    const raw = typeof Deno !== "undefined" ? Deno.env.get(name) : undefined;
    const n = raw === undefined || raw === "" ? NaN : Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

/** Plafond de coût estimé par utilisateur et par jour (UTC), tous profils confondus (fondateurs et abonnés compris). */
export function dailyCostCapUsd(): number {
  return envNumber("AI_DAILY_COST_CAP_USD", 5);
}

/** Prix d'une image selon le modèle, la qualité et le format (tarif public). */
export function estimateImageCostUsd(model: string, quality: string, size: string): number {
  const square = size === "1024x1024";
  if (model.startsWith("gpt-image")) {
    const table: Record<string, [number, number]> = {
      // [carré, rectangulaire]
      low: [0.011, 0.016],
      medium: [0.042, 0.063],
      high: [0.167, 0.25],
    };
    const [sq, rect] = table[quality] ?? table.high;
    return envNumber("AI_COST_IMAGE_GPT_IMAGE", square ? sq : rect);
  }
  // dall-e-3
  const hd = quality === "hd";
  const base = square ? (hd ? 0.08 : 0.04) : hd ? 0.12 : 0.08;
  return envNumber("AI_COST_IMAGE_DALLE3", base);
}

/** Appel de chat (audit visuel d'une photo, synthèse du prompt) : de l'ordre du centime, plafonné par max_tokens. */
export function estimateTextCallCostUsd(): number {
  return envNumber("AI_COST_TEXT_CALL", 0.01);
}

/** Animation d'une image en vidéo, selon le fournisseur. À ajuster d'après les factures réelles. */
export function estimateVideoAnimationCostUsd(provider: "replicate" | "runway", seconds: number): number {
  if (provider === "replicate") return envNumber("AI_COST_VIDEO_REPLICATE", 0.1);
  return envNumber("AI_COST_VIDEO_RUNWAY_PER_SECOND", 0.05) * Math.max(1, seconds);
}

/** Crédits achetés débités pour une vidéo quand l'essai gratuit est épuisé (une image coûte 1). */
export const VIDEO_CREDIT_COST = 3;
export const IMAGE_CREDIT_COST = 1;

/** Image générée via OpenRouter (modèles Gemini image) : tarif par image, à ajuster d'après la facture. */
export function estimateOpenRouterImageCostUsd(): number {
  return envNumber("AI_COST_IMAGE_OPENROUTER", 0.04);
}

/** Rédaction d'une fiche produit (gpt-4o, JSON d'environ 1 500 jetons en sortie, photo éventuelle en entrée). */
export function estimateSheetTextCostUsd(withImage: boolean): number {
  return envNumber("AI_COST_PRODUCT_SHEET_TEXT", withImage ? 0.04 : 0.025);
}
