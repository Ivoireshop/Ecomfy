/* eslint-disable @typescript-eslint/ban-ts-comment -- module Deno hors du projet tsc (jamais typé par `npm run typecheck`) ; @ts-nocheck coupe les faux positifs de l'éditeur sur les imports npm:/jsr: */
// @ts-nocheck
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { classifyOpenAiFailure, fetchWithTimeout, runWithRetry } from "./ai-retry.ts";
import type { AttemptOutcome, Failure } from "./ai-retry.ts";
import { OPENAI_CONFIG } from "./openai-config.ts";

/**
 * Moteur d'image OpenAI partagé par generate-ai-image (Studio) et generate-ad-visual (visuels publicitaires).
 * Les deux avaient chacun leur copie de la boucle « 3 modèles × (édition + génération) » : jusqu'à 6 appels
 * facturables par clic, sans délai maximal. Voir _shared/ai-retry.ts pour la politique de tentatives.
 */

export const MAX_IMAGE_ATTEMPTS = 1 + OPENAI_CONFIG.MAX_GENERATION_RETRIES;
// Au-delà, le client a abandonné (coupure à ~150 s) : un nouvel appel serait payé pour rien.
export const IMAGE_BUDGET_MS = 130_000;
export const IMAGE_ATTEMPT_TIMEOUT_MS = 90_000;

export interface EngineReport {
  ok: boolean;
  url?: string;
  model: string | null;
  attempts: number;
  trail: string[];
  failure?: Failure;
  referenceIgnored?: boolean;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const mime = parts[0].match(/:(.*?);/)?.[1] ?? "image/png";
  const bstr = atob(parts[1]);
  const u8 = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
  return new Blob([u8], { type: mime });
}

type ImagesApiResponse = { data?: Array<{ url?: string; b64_json?: string }> } | null;

function readImageUrl(data: ImagesApiResponse): string | null {
  return data?.data?.[0]?.url || (data?.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null);
}

const emptyResponse = (status: number): Failure => ({
  kind: "retryable", code: "empty_response", status, detail: "aucune image dans la réponse",
});

/**
 * Génère l'image avec un budget TOTAL de MAX_IMAGE_ATTEMPTS appels :
 *  - panne passagère (429 de débit, 5xx, délai dépassé) : même modèle, après une attente ;
 *  - modèle indisponible pour ce compte                  : modèle suivant ;
 *  - refus définitif (filtre de sécurité, clé, solde)    : arrêt immédiat, rien n'est rejoué.
 * Avec une photo de référence, l'édition est tentée d'abord ; si l'API d'édition rejette l'image (format, taille), on
 * génère sans elle ET on le signale (`referenceIgnored`) au lieu de livrer en silence un autre produit.
 */
export async function generateOpenAiImage(
  apiKey: string,
  prompt: string,
  size: string,
  referenceImage: string | undefined,
  startTime: number,
): Promise<EngineReport> {
  const deadlineAt = startTime + IMAGE_BUDGET_MS;
  const trail: string[] = [];
  let attempts = 0;
  let referenceIgnored = false;
  let lastFailure: Failure | undefined;
  let lastModel: string | null = null;

  const timeoutFor = (remainingMs: number) => Math.max(5_000, Math.min(IMAGE_ATTEMPT_TIMEOUT_MS, remainingMs));

  if (referenceImage) {
    let imageBlob: Blob | null = null;
    try {
      if (referenceImage.startsWith("data:")) {
        imageBlob = dataUrlToBlob(referenceImage);
      } else {
        const ref = await fetch(referenceImage);
        if (ref.ok) imageBlob = await ref.blob();
      }
    } catch (blobErr) {
      console.warn("[OpenAI Edits Blob Conversion Failed]:", blobErr);
    }

    if (imageBlob) {
      const edits = await runWithRetry<string>(
        [OPENAI_CONFIG.IMAGE_MODEL, OPENAI_CONFIG.IMAGE_MODEL_FALLBACK],
        async (model, _n, remaining): Promise<AttemptOutcome<string>> => {
          console.log(`[OpenAI Edits] Trying model ${model} via /v1/images/edits...`);
          const formData = new FormData();
          formData.append("image", imageBlob as Blob, "product_reference.png");
          formData.append("prompt", prompt.substring(0, 950));
          formData.append("model", model);
          formData.append("n", "1");
          formData.append("size", size);
          const res = await fetchWithTimeout(
            "https://api.openai.com/v1/images/edits",
            { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: formData },
            timeoutFor(remaining),
          );
          if (res.ok) {
            const url = readImageUrl(res.json());
            return url ? { ok: true, value: url } : { ok: false, failure: emptyResponse(res.status) };
          }
          return { ok: false, failure: classifyOpenAiFailure(res.status, res.text) };
        },
        { maxAttempts: MAX_IMAGE_ATTEMPTS, deadlineAt },
      );
      attempts += edits.attempts;
      trail.push(...edits.trail.map((c) => `edits:${c}`));
      lastModel = edits.model;
      if (edits.ok) return { ok: true, url: edits.value, model: edits.model, attempts, trail };
      lastFailure = edits.failure;
      // Seuls un rejet de l'image (bad_request) ou l'indisponibilité du modèle justifient de continuer sans la référence.
      const canFallBack = lastFailure && (lastFailure.code === "bad_request" || lastFailure.code === "model_unavailable");
      if (!canFallBack) return { ok: false, model: lastModel, attempts, trail, failure: lastFailure };
    }
    referenceIgnored = true;
  }

  const remainingAttempts = MAX_IMAGE_ATTEMPTS - attempts;
  if (remainingAttempts <= 0) return { ok: false, model: lastModel, attempts, trail, failure: lastFailure, referenceIgnored };

  console.log(`[OpenAI Call] Executing /v1/images/generations with Vision-Guided Prompt Engine...`);
  const gen = await runWithRetry<string>(
    [OPENAI_CONFIG.IMAGE_MODEL, OPENAI_CONFIG.IMAGE_MODEL_FALLBACK, "dall-e-3"],
    async (model, _n, remaining): Promise<AttemptOutcome<string>> => {
      console.log(`[OpenAI Call] Requesting model ${model} (${size}, quality: ${OPENAI_CONFIG.IMAGE_QUALITY})...`);
      const bodyPayload: Record<string, unknown> = { model, prompt: prompt.substring(0, 3800), size, n: 1 };
      bodyPayload.quality = model.startsWith("gpt-image") ? OPENAI_CONFIG.IMAGE_QUALITY : "hd";
      const res = await fetchWithTimeout(
        "https://api.openai.com/v1/images/generations",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        },
        timeoutFor(remaining),
      );
      if (res.ok) {
        const url = readImageUrl(res.json());
        return url ? { ok: true, value: url } : { ok: false, failure: emptyResponse(res.status) };
      }
      return { ok: false, failure: classifyOpenAiFailure(res.status, res.text) };
    },
    { maxAttempts: remainingAttempts, deadlineAt },
  );
  attempts += gen.attempts;
  trail.push(...gen.trail.map((c) => `generations:${c}`));
  if (gen.ok) return { ok: true, url: gen.value, model: gen.model, attempts, trail, referenceIgnored };
  return { ok: false, model: gen.model ?? lastModel, attempts, trail, failure: gen.failure ?? lastFailure, referenceIgnored };
}

/**
 * Copie l'image dans le stockage permanent (bucket `generated-images`). Une data-URL de plusieurs Mo ou une URL
 * OpenAI qui expire en ~1 h ne doivent pas finir dans la base : `persisted` dit si la copie a réussi.
 */
export async function persistGeneratedImage(
  supabaseClient: SupabaseClient,
  userId: string,
  imageUrl: string,
): Promise<{ url: string; persisted: boolean }> {
  try {
    let imageBytes: Uint8Array | null = null;
    let contentType = "image/png";

    if (imageUrl.startsWith("data:")) {
      const parts = imageUrl.split(",");
      const mimeMatch = parts[0].match(/:(.*?);/);
      if (mimeMatch) contentType = mimeMatch[1];
      const bstr = atob(parts[1]);
      imageBytes = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) imageBytes[i] = bstr.charCodeAt(i);
    } else {
      const imageRes = await fetch(imageUrl);
      if (imageRes.ok) {
        imageBytes = new Uint8Array(await imageRes.arrayBuffer());
        const headerType = imageRes.headers.get("content-type");
        if (headerType) contentType = headerType;
      }
    }

    if (imageBytes) {
      const storagePath = `${userId}/${Date.now()}_${crypto.randomUUID().substring(0, 8)}.png`;
      const { error: uploadError } = await supabaseClient.storage
        .from("generated-images")
        .upload(storagePath, imageBytes, { contentType, upsert: true });
      if (uploadError) {
        console.warn("[Engine Storage Upload Warning]:", uploadError);
      } else {
        const { data: publicUrlData } = supabaseClient.storage.from("generated-images").getPublicUrl(storagePath);
        if (publicUrlData?.publicUrl) return { url: publicUrlData.publicUrl, persisted: true };
      }
    }
  } catch (storageErr) {
    console.warn("[Engine Storage Exception]:", storageErr);
  }
  return { url: imageUrl, persisted: false };
}
