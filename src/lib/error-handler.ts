/**
 * Ecomfy Error Handler & Sanitizer Utility
 * 
 * Provides safe error message sanitization, secret redaction,
 * correlation ID generation, and user-friendly error formatting.
 */

// Patterns to detect sensitive secrets in error text
const SENSITIVE_PATTERNS = [
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT Tokens
  /sbp_[a-zA-Z0-9]{20,}/g, // Supabase service keys
  /sk-[a-zA-Z0-9]{20,}/g, // OpenAI / API secret keys
  /pk_[a-zA-Z0-9]{20,}/g, // Public API secret keys
  /password=["':]?([^"'\s&]+)/gi,
  /token=["':]?([^"'\s&]+)/gi,
  /secret=["':]?([^"'\s&]+)/gi,
  /authorization:\s*bearer\s+[^\s]+/gi,
];

/**
 * Sanitizes a string or object string representation by redacting sensitive data.
 */
export function redactSensitiveData(input: any): string {
  if (input === null || input === undefined) return "";
  
  let text = typeof input === "string" ? input : typeof input === "object" ? JSON.stringify(input) : String(input);
  
  SENSITIVE_PATTERNS.forEach((pattern) => {
    text = text.replace(pattern, "[REDACTED_SECRET]");
  });

  return text;
}

/**
 * Generates an anonymous, safe correlation reference code (e.g. ERR-8F92A1).
 */
export function generateCorrelationId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ERR-${code}`;
}

/**
 * Translates raw API / Supabase / network errors into clean, friendly French messages for users.
 */
export function getFriendlyErrorMessage(error: any): string {
  if (!error) return "Une erreur inattendue est survenue. Veuillez réessayer.";

  const rawMessage = typeof error === "string" ? error : error?.message || error?.error_description || "";
  const code = error?.code || error?.status;

  // Network / Offline errors
  if (rawMessage.includes("Failed to fetch") || rawMessage.includes("NetworkError") || rawMessage.includes("network")) {
    return "Problème de connexion réseau. Veuillez vérifier votre connexion internet et réessayer.";
  }

  // Auth / Permissions errors
  if (code === "42501" || rawMessage.includes("permission") || rawMessage.includes("policy") || code === 403) {
    return "Vous n'avez pas les autorisations nécessaires pour effectuer cette action.";
  }

  if (code === "PGRST301" || code === 401 || rawMessage.includes("JWT") || rawMessage.includes("token")) {
    return "Votre session a expiré ou est invalide. Veuillez vous reconnecter.";
  }

  // Not found
  if (code === "PGRST116" || code === 404) {
    return "La ressource demandée est introuvable ou a été supprimée.";
  }

  // Duplicate / Conflict
  if (code === "23505" || rawMessage.includes("duplicate key") || rawMessage.includes("already exists")) {
    return "Cet enregistrement existe déjà dans le système.";
  }

  // Rate limits / Quota
  if (code === 429 || rawMessage.includes("rate limit") || rawMessage.includes("quota")) {
    return "Trop de requêtes effectuées. Veuillez patienter un instant avant de réessayer.";
  }

  // Standard safe user messages or generic fallback
  if (rawMessage && !rawMessage.includes("relation") && !rawMessage.includes("column") && !rawMessage.includes("PostgREST") && rawMessage.length < 120) {
    return redactSensitiveData(rawMessage);
  }

  return "Une erreur serveur temporaire s'est produite. Nos équipes ont été notifiées.";
}

/**
 * Safe logger for development & debugging without exposing secrets in logs.
 */
export function logError(context: string, error: any, correlationId?: string) {
  const safeMessage = redactSensitiveData(error?.message || error);
  const ref = correlationId || generateCorrelationId();
  
  if (import.meta.env.DEV) {
    console.error(`[Ecomfy Error] [${ref}] [${context}]`, safeMessage, error);
  } else {
    // Production safe logging
    console.error(`[Ecomfy Error] [${ref}] [${context}]`, safeMessage);
  }
  
  return ref;
}
