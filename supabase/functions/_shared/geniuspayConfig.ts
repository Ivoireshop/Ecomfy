/**
 * Centralized GeniusPay API Configuration
 * Supports environment variable overrides (GENIUSPAY_BASE_URL) with default fallback to https://geniuspay.ci
 */

export const GENIUSPAY_BASE_URL = (
  Deno.env.get("GENIUSPAY_BASE_URL") || "https://geniuspay.ci"
).replace(/\/+$/, "");

export const GENIUSPAY_API_URL = `${GENIUSPAY_BASE_URL}/api/v1/merchant`;
