/**
 * Centralized Configuration for Ecomfy OpenAI Image Generation Engine
 */
export const OPENAI_CONFIG = {
  // Official State-of-the-Art OpenAI Models
  IMAGE_MODEL: "gpt-image-1", // Flagship OpenAI Image Engine
  IMAGE_MODEL_FALLBACK: "gpt-image-2",
  VISION_MODEL: "gpt-4o",
  TEXT_MODEL: "gpt-4o",

  // Generation Settings
  IMAGE_QUALITY: "high" as const, // High quality mode for commercial product rendering
  DEFAULT_SIZE: "1024x1024",
  
  // Aspect Ratio to Resolution Mapping
  ASPECT_RATIO_MAP: {
    "1:1": "1024x1024",
    "9:16": "1024x1792",
    "16:9": "1792x1024",
  } as Record<string, string>,

  // Operational Constraints
  MAX_GENERATION_RETRIES: 2,
  MAX_REFERENCE_IMAGES: 1,
  MAX_FILE_SIZE_MB: 10,
  ESTIMATED_COST_USD: 0.08,

  // Vision & Prompt Engine Settings
  VISION_MAX_TOKENS: 1000,
  VISION_TEMPERATURE: 0.2,
  PROMPT_ENGINE_MAX_TOKENS: 1200,
  PROMPT_ENGINE_TEMPERATURE: 0.3,
};

export function getOpenAiApiKey(): string {
  const envKey = Deno.env.get("OPENAI_API_KEY");
  if (envKey && envKey.trim().length > 0) return envKey.trim();
  return "";
}
