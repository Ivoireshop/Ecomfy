// Tests du Studio IA : nouvelle tentative contrôlée, estimation des coûts, branchement des fonctions.
// Exécution (aucun réseau ni base requis) :
//   npx vitest run supabase/tests/studio-ai-retry.test.ts
// Le comportement des RPC (réservation, remboursement, plafond) est testé sur la base de DEV par
// supabase/tests/studio_ai_generation_log.sql.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classifyOpenAiFailure,
  classifyProviderFailure,
  fetchWithTimeout,
  isOperatorAlertCode,
  runWithRetry,
  userMessageForFailure,
} from "../functions/_shared/ai-retry.ts";
import type { AttemptOutcome, Failure } from "../functions/_shared/ai-retry.ts";
import { estimateImageCostUsd, estimateVideoAnimationCostUsd } from "../functions/_shared/ai-cost.ts";

const src = (p: string) => readFileSync(new URL(`../functions/${p}`, import.meta.url), "utf8");
const noSleep = async () => {};

const fail = (status: number, body = ""): AttemptOutcome<string> => ({ ok: false, failure: classifyOpenAiFailure(status, body) });
const ok = (v = "url"): AttemptOutcome<string> => ({ ok: true, value: v });

// --- classification ---------------------------------------------------------------------------------------------

test("classification : pannes passagères = retryable", () => {
  assert.equal(classifyOpenAiFailure(429, '{"error":{"code":"rate_limit_exceeded"}}').kind, "retryable");
  assert.equal(classifyOpenAiFailure(500, "oops").kind, "retryable");
  assert.equal(classifyOpenAiFailure(503, "").kind, "retryable");
  assert.equal(classifyOpenAiFailure(0, "ECONNRESET").code, "network");
  assert.equal(classifyOpenAiFailure(-1, "aborted").code, "timeout");
});

test("classification : solde OpenAI épuisé et clé invalide ne se rejouent pas", () => {
  assert.deepEqual(
    [classifyOpenAiFailure(429, '{"error":{"code":"insufficient_quota"}}').kind, classifyOpenAiFailure(429, "insufficient_quota").code],
    ["fatal", "provider_quota"],
  );
  assert.equal(classifyOpenAiFailure(401, "invalid api key").code, "provider_auth");
});

test("classification : modèle indisponible = modèle suivant, filtre de sécurité = arrêt", () => {
  assert.equal(classifyOpenAiFailure(404, "").kind, "model_unavailable");
  assert.equal(classifyOpenAiFailure(400, '{"error":{"code":"model_not_found"}}').kind, "model_unavailable");
  assert.equal(classifyOpenAiFailure(403, "Your organization must be verified to use the model `gpt-image-1`").kind, "model_unavailable");
  const policy = classifyOpenAiFailure(400, '{"error":{"code":"content_policy_violation"}}');
  assert.deepEqual([policy.kind, policy.code], ["fatal", "content_policy"]);
  assert.equal(classifyOpenAiFailure(400, "moderation_blocked").code, "content_policy");
  assert.equal(classifyOpenAiFailure(400, "Invalid image format").code, "bad_request");
});

test("les messages utilisateur ne contiennent aucun détail fournisseur", () => {
  for (const code of ["content_policy", "rate_limited", "timeout", "provider_quota", "provider_auth", "model_unavailable", "bad_request", "internal_error"]) {
    const m = userMessageForFailure(code);
    assert.ok(m.length > 20, code);
    assert.ok(!/openai|api key|gpt|http|quota_exceeded/i.test(m), `${code} : ${m}`);
  }
  assert.ok(isOperatorAlertCode("provider_quota") && isOperatorAlertCode("provider_auth") && !isOperatorAlertCode("content_policy"));
});

// --- runWithRetry -----------------------------------------------------------------------------------------------

test("retry : un succès du premier coup = un seul appel", async () => {
  let calls = 0;
  const r = await runWithRetry(["m1", "m2"], async () => (calls++, ok()), { sleep: noSleep });
  assert.deepEqual([r.ok, r.attempts, r.model, calls], [true, 1, "m1", 1]);
});

test("retry : une panne passagère est rejouée sur le MÊME modèle puis réussit", async () => {
  const seen: string[] = [];
  const r = await runWithRetry(["m1", "m2"], async (m, n) => (seen.push(m), n < 3 ? fail(503) : ok()), { sleep: noSleep });
  assert.deepEqual([r.ok, r.attempts, r.model], [true, 3, "m1"]);
  assert.deepEqual(seen, ["m1", "m1", "m1"]);
});

test("retry : le budget total est respecté, tous modèles confondus (avant : jusqu'à 6 appels)", async () => {
  let calls = 0;
  const r = await runWithRetry(["m1", "m2", "m3"], async () => (calls++, fail(500)), { maxAttempts: 3, sleep: noSleep });
  assert.deepEqual([r.ok, r.attempts, calls], [false, 3, 3]);
  assert.equal(r.failure?.code, "provider_error");
  assert.deepEqual(r.trail, ["provider_error", "provider_error", "provider_error"]);
});

test("retry : un refus définitif s'arrête immédiatement, sans second appel", async () => {
  for (const [status, body, code] of [[400, "content_policy_violation", "content_policy"], [401, "", "provider_auth"], [429, "insufficient_quota", "provider_quota"]] as const) {
    let calls = 0;
    const r = await runWithRetry(["m1", "m2"], async () => (calls++, fail(status, body)), { sleep: noSleep });
    assert.deepEqual([r.ok, calls, r.failure?.code], [false, 1, code], code);
  }
});

test("retry : modèle indisponible -> modèle suivant (et seulement dans ce cas)", async () => {
  const seen: string[] = [];
  const r = await runWithRetry(["m1", "m2"], async (m) => (seen.push(m), m === "m1" ? fail(404) : ok()), { sleep: noSleep });
  assert.deepEqual([r.ok, r.model, seen], [true, "m2", ["m1", "m2"]]);
});

test("retry : tous les modèles indisponibles -> échec sans boucler", async () => {
  let calls = 0;
  const r = await runWithRetry(["m1", "m2"], async () => (calls++, fail(404)), { maxAttempts: 5, sleep: noSleep });
  assert.deepEqual([r.ok, calls, r.failure?.code], [false, 2, "model_unavailable"]);
});

test("retry : attente exponentielle entre deux tentatives, aucune attente après la dernière", async () => {
  const waits: number[] = [];
  await runWithRetry(["m1"], async () => fail(500), { maxAttempts: 3, baseDelayMs: 1000, sleep: async (ms) => void waits.push(ms) });
  assert.equal(waits.length, 2);
  assert.ok(waits[0] >= 1000 && waits[0] < 1300, String(waits[0]));
  assert.ok(waits[1] >= 2000 && waits[1] < 2300, String(waits[1]));
});

test("retry : plus d'appel quand l'échéance approche (le client a déjà abandonné)", async () => {
  let t = 0;
  let calls = 0;
  const r = await runWithRetry(
    ["m1"],
    async () => (calls++, (t += 60_000), fail(500)),
    { maxAttempts: 5, deadlineAt: 130_000, minAttemptMs: 20_000, now: () => t, sleep: noSleep },
  );
  // 1er appel à t=0 (reste 130 s) -> t=60 s ; 2e à t=60 s (reste 70 s) -> t=120 s ; 3e refusé (reste 10 s < 20 s).
  assert.deepEqual([r.ok, calls], [false, 2]);
});

test("retry : la durée restante est transmise à chaque appel", async () => {
  let t = 0;
  const remaining: number[] = [];
  await runWithRetry(["m1"], async (_m, _n, rem) => (remaining.push(rem), (t += 30_000), fail(500)), {
    maxAttempts: 3, deadlineAt: 100_000, now: () => t, sleep: noSleep,
  });
  assert.deepEqual(remaining, [100_000, 70_000, 40_000]);
});

// --- fetchWithTimeout -------------------------------------------------------------------------------------------

test("fetchWithTimeout : réponse normale, erreur réseau et délai dépassé ne lèvent jamais", async () => {
  const good = await fetchWithTimeout("x://", {}, 1000, (async () => new Response('{"a":1}', { status: 200 })) as unknown as typeof fetch);
  assert.deepEqual([good.ok, good.status, good.json()], [true, 200, { a: 1 }]);

  const net = await fetchWithTimeout("x://", {}, 1000, (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch);
  assert.deepEqual([net.ok, net.status], [false, 0]);

  const slow = await fetchWithTimeout("x://", {}, 20, ((_u: string, init: RequestInit) =>
    new Promise((_res, rej) => init.signal!.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))))) as unknown as typeof fetch);
  assert.deepEqual([slow.ok, slow.status], [false, -1]);
  assert.equal(classifyOpenAiFailure(slow.status, slow.text).code, "timeout");
});

// --- coûts ------------------------------------------------------------------------------------------------------

test("coût : tarifs gpt-image-1 et dall-e-3 selon qualité et format", () => {
  assert.equal(estimateImageCostUsd("gpt-image-1", "high", "1024x1024"), 0.167);
  assert.equal(estimateImageCostUsd("gpt-image-1", "high", "1024x1792"), 0.25);
  assert.equal(estimateImageCostUsd("gpt-image-1", "low", "1024x1024"), 0.011);
  assert.equal(estimateImageCostUsd("dall-e-3", "standard", "1024x1792"), 0.08);
  assert.equal(estimateImageCostUsd("dall-e-3", "hd", "1024x1024"), 0.08);
  assert.ok(estimateVideoAnimationCostUsd("runway", 10) > estimateVideoAnimationCostUsd("runway", 5));
});

// --- branchement dans les fonctions -----------------------------------------------------------------------------

test("generate-ai-image : réservation avant l'appel payant, moteur partagé, plus de décompte tardif ni profil inexistant", () => {
  const code = src("generate-ai-image/index.ts");
  const iStart = code.indexOf('startGeneration(userId, "image")');
  const iOpenAi = code.indexOf("generateOpenAiImage(OPENAI_API_KEY");
  const iVision = code.indexOf("analyzeImageWithGpt4oMini(imageToAnalyze)");
  assert.ok(iStart > 0 && iStart < iVision && iStart < iOpenAi, "la réservation doit précéder le premier appel OpenAI");
  assert.match(code, /finishGeneration\(gen\.logId, \{\s*status: "failed"/);
  assert.match(code, /finishGeneration\(gen\.logId, \{ status: "succeeded"/);
  assert.ok(!/is_founder|subscription_status/.test(code), "colonnes inexistantes de profiles");
  assert.ok(!/purchased_credits|free_generations_remaining/.test(code), "le décompte passe par start/finish_studio_generation");
  assert.ok(!/body\.userId|reqBody\.userId/.test(code));
});

test("moteur d'image partagé : budget total borné, aucune boucle libre sur les modèles, délai par appel", () => {
  const eng = src("_shared/openai-image-engine.ts");
  assert.match(eng, /MAX_IMAGE_ATTEMPTS = 1 \+ OPENAI_CONFIG\.MAX_GENERATION_RETRIES/);
  assert.ok(!/for \(const modelCandidate of models\)/.test(eng), "plus de boucle libre sur les modèles");
  assert.ok(!/await fetch\("https:\/\/api\.openai\.com/.test(eng), "tous les appels OpenAI passent par fetchWithTimeout");
  for (const f of ["generate-ai-image", "generate-ad-visual"]) {
    assert.match(src(`${f}/index.ts`), /generateOpenAiImage\(/, f);
    assert.ok(!/api\.openai\.com\/v1\/images/.test(src(`${f}/index.ts`)), `${f} : plus de copie locale du moteur`);
  }
});

test("generate-ad-visual : plus d'appel gratuit, réservation avant tout appel payant, bibliothèque seulement si copie stockée", () => {
  const code = src("generate-ad-visual/index.ts");
  const iStart = code.indexOf('startGeneration(userId, "ad_visual")');
  assert.ok(iStart > 0);
  assert.ok(iStart < code.indexOf("analyzeImageWithGpt4oMini(productImage)"));
  assert.ok(iStart < code.indexOf("generateOpenAiImage(OPENAI_API_KEY"));
  assert.match(code, /finishGeneration\(gen\.logId, \{\s*status: "failed"/);
  assert.match(code, /finishGeneration\(gen\.logId, \{ status: "succeeded"/);
  assert.match(code, /if \(stored\.persisted\)/);
  assert.ok(!/err\.message \|\|/.test(code), "pas de message brut d'erreur interne renvoyé au navigateur");
  assert.ok(/getAuthenticatedUserId\(req\)/.test(code) && /enforceUserAiQuota\(/.test(code));
});

test("generate-feature-image : utilisateur réel uniquement, réservation, pas de contournement du filtre, cache sans facturation", () => {
  const code = src("generate-feature-image/index.ts");
  assert.ok(!/x-forwarded-for|guest-/.test(code), "plus d'identité d'invité");
  assert.ok(!/purchased_credits\s*[:=]|Decrement credits/.test(code), "le décompte passe par start/finish_studio_generation");
  const iStart = code.indexOf('startGeneration(userId, "feature_image")');
  assert.ok(iStart > 0 && iStart < code.indexOf("analyzeImageWithGpt4oMini(") && iStart < code.indexOf("optimizePromptWithGpt4oMini("));
  // cache : le crédit est rendu
  assert.match(code, /Cache HIT[\s\S]*?status: "cancelled"[\s\S]*?errorCode: "cache_hit"/);
  // un refus du filtre de sécurité n'est pas confié aux moteurs de secours
  assert.match(code, /content_policy"\) blocked = lastFailure/);
  assert.match(code, /if \(!imageUrl && !blocked\) \{\s*const openRouterKey/);
  assert.match(code, /if \(!imageUrl && !blocked\) \{\s*console\.log\("Using High-Definition/);
  // moteur gratuit seul : crédit rendu
  assert.match(code, /degraded && !paidEngineUsed[\s\S]*?status: "cancelled"[\s\S]*?degraded_fallback/);
});

test("generate-product-sheet : débit seulement pour une vraie fiche IA, règle d'accueil conservée, plafond du jour, images bornées", () => {
  const code = src("generate-product-sheet/index.ts");
  // plus de débit anticipé : consumeAiCredit n'apparaît qu'après la production de la fiche
  const iCharge = code.indexOf('consumeAiCredit(userId, "product_sheet"');
  assert.ok(iCharge > code.indexOf("generateWithOpenAI({"), "le débit doit suivre la génération");
  assert.match(code, /if \(usage\.aiContent\) \{[\s\S]*?consumeAiCredit/);
  assert.ok(!/return creditsRequiredResponse|error: "credits_required"/.test(code), "la fiche produit ne bloque pas faute de crédits (accueil)");
  assert.match(code, /todaySpendUsd\(userId\)[\s\S]*?spent === null[\s\S]*?dailyLimitResponse\(\)/);
  assert.match(code, /Math\.min\(5, Math\.max\(0, Math\.floor\(Number\(image_count\)\)/);
  assert.ok(!/slice\(0, image_count\)/.test(code), "nombre d'images non borné");
  assert.match(code, /runWithRetry<string>\(/);
  assert.ok(!/for \(const model of modelsToTry\)/.test(code));
  assert.match(code, /logOnce\("failed", \{ errorCode: "ai_unavailable" \}\)/);
});

test("generate-video : réservation avant le premier appel payant, clôture unique, plus de compteur codé en dur", () => {
  const code = src("generate-video/index.ts");
  const iStart = code.indexOf('startGeneration(userId, "video")');
  assert.ok(iStart > 0);
  assert.ok(iStart < code.indexOf("analyzeImageWithGpt4oMini("), "la réservation doit précéder l'audit visuel");
  assert.ok(iStart < code.indexOf("optimizePromptWithGpt4oMini("));
  assert.ok(!/videoGenerationsRemaining\s*=\s*999/.test(code));
  assert.match(code, /finally \{[\s\S]*?await close\(outcome\.status, outcome\.errorCode\)/);
  assert.match(code, /catch \(reserved\) \{[\s\S]*?await close\("failed"/);
});

test("ai-generation-log : fail-closed si le décompte est indisponible", () => {
  const code = src("_shared/ai-generation-log.ts");
  assert.match(code, /if \(error\) \{[\s\S]*?quota_unavailable/);
  assert.match(code, /catch \(e\) \{[\s\S]*?quota_unavailable/);
});

// --- fournisseurs vidéo et voix (Replicate, Runway, ElevenLabs) -------------------------------------------------

test("fournisseurs vidéo/voix : solde épuisé = provider_quota, quel que soit le statut", () => {
  assert.equal(classifyProviderFailure(402, '{"detail":"Insufficient credit"}').code, "provider_quota");
  assert.equal(classifyProviderFailure(400, '{"error":"You do not have enough credits to run this task"}').code, "provider_quota");
  assert.equal(classifyProviderFailure(401, '{"detail":{"status":"quota_exceeded"}}').code, "provider_quota");
});

test("fournisseurs vidéo/voix : clé refusée, contenu refusé, panne passagère", () => {
  assert.equal(classifyProviderFailure(401, '{"detail":"Invalid token"}').code, "provider_auth");
  assert.equal(classifyProviderFailure(403, "forbidden").code, "provider_auth");
  assert.equal(classifyProviderFailure(422, "NSFW content detected").code, "content_policy");
  assert.equal(classifyProviderFailure(429, "Request was throttled").kind, "retryable");
  assert.equal(classifyProviderFailure(502, "").code, "provider_error");
  assert.equal(classifyProviderFailure(0, "fetch failed").code, "network");
});

test("fournisseurs vidéo/voix : le message affiché ne contient aucun détail fournisseur", () => {
  for (const code of ["animation_failed", "keyframe_failed", "download_failed", "provider_quota", "content_policy"]) {
    const msg = userMessageForFailure(code);
    assert.ok(msg.length > 20 && !/\d{4}|replicate|runway|eleven|http/i.test(msg), code);
  }
});

test("branchement : generate-video classe les échecs, generate-voiceover ne renvoie plus de texte brut", () => {
  const video = src("generate-video/index.ts");
  assert.ok(video.includes("classifyProviderFailure") && video.includes("noteAnimationFailure"));
  assert.ok(video.includes("failure?.code ?? \"animation_failed\""));
  const voice = src("generate-voiceover/index.ts");
  assert.ok(voice.includes("classifyProviderFailure") && !voice.includes("Erreur Eleven Labs: ${"));
  assert.ok(!/status: 500/.test(voice));
});
