/**
 * Dernière session du Studio IA, conservée dans le navigateur pour survivre à un rafraîchissement.
 * Le résultat lui-même (image ou vidéo) vit déjà dans le stockage et la Bibliothèque : on ne garde ici
 * que de quoi le ré-afficher, ou reprendre l'attente d'une vidéo encore en préparation.
 */

export type StudioMode = "image" | "video";

export interface StudioSettingsState {
  aspectRatio: string;
  style: string;
  videoDuration: string;
}

export interface StudioSession {
  mode: StudioMode;
  prompt: string;
  settings: StudioSettingsState | null;
  /** URL du dernier résultat affiché. */
  resultUrl: string | null;
  /** Nature du résultat (peut différer du mode courant si l'utilisateur a changé d'onglet depuis). */
  resultMode: StudioMode;
  /** Vidéo en cours de préparation côté serveur (reprise de l'attente après rafraîchissement). */
  pendingVideoId: string | null;
  savedAt: number;
}

export type StudioSessionInput = Omit<StudioSession, "savedAt">;

/** Image de référence ajoutée par l'utilisateur (data-URL déjà réduite à 800 px par l'uploader). */
export interface StoredMedia {
  id: string;
  url: string;
  name: string;
  type: string;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// Passé ce délai, un résultat n'est plus ré-affiché : il reste dans la Bibliothèque.
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
// Les images de référence sont stockées à part : un quota dépassé ne doit pas faire perdre le reste.
export const MAX_MEDIA_BYTES = 1_500_000;

const sessionKey = (userId: string) => `studio-session:${userId}`;
const mediaKey = (userId: string) => `studio-media:${userId}`;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    // Stockage bloqué (navigation privée, données de site refusées) : le Studio fonctionne sans.
    return null;
  }
}

const isStr = (v: unknown): v is string => typeof v === "string";
const isStrOrNull = (v: unknown) => v === null || typeof v === "string";

function validSettings(v: unknown): boolean {
  if (v === null) return true;
  const s = v as Partial<Record<keyof StudioSettingsState, unknown>> | undefined;
  return !!s && isStr(s.aspectRatio) && isStr(s.style) && isStr(s.videoDuration);
}

export function loadStudioSession(
  userId: string,
  now: number = Date.now(),
  storage: StorageLike | null = defaultStorage(),
): StudioSession | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(sessionKey(userId));
    if (!raw) return null;
    const p = JSON.parse(raw);
    const isMode = (m: unknown) => m === "image" || m === "video";
    const valid =
      p &&
      isMode(p.mode) &&
      isStr(p.prompt) &&
      typeof p.savedAt === "number" &&
      isStrOrNull(p.resultUrl) &&
      isStrOrNull(p.pendingVideoId) &&
      validSettings(p.settings ?? null);
    if (!valid || now - p.savedAt > SESSION_TTL_MS) {
      storage.removeItem(sessionKey(userId));
      return null;
    }
    return {
      mode: p.mode,
      prompt: p.prompt,
      settings: p.settings ?? null,
      resultUrl: p.resultUrl,
      // Sessions écrites avant l'ajout de ce champ : le résultat suit alors le mode.
      resultMode: isMode(p.resultMode) ? p.resultMode : p.mode,
      pendingVideoId: p.pendingVideoId,
      savedAt: p.savedAt,
    };
  } catch {
    return null;
  }
}

export function saveStudioSession(
  userId: string,
  session: StudioSessionInput,
  now: number = Date.now(),
  storage: StorageLike | null = defaultStorage(),
) {
  if (!storage) return;
  try {
    // Ni résultat, ni attente, ni texte saisi : rien à retrouver.
    if (!session.resultUrl && !session.pendingVideoId && !session.prompt.trim()) {
      storage.removeItem(sessionKey(userId));
      return;
    }
    // Une data-URL (plusieurs Mo) dépasserait le quota : seules les URL distantes sont conservées.
    const resultUrl = session.resultUrl && !session.resultUrl.startsWith("data:") ? session.resultUrl : null;
    storage.setItem(sessionKey(userId), JSON.stringify({ ...session, resultUrl, savedAt: now }));
  } catch {
    // Quota dépassé ou stockage indisponible : la persistance est un confort, jamais bloquante.
  }
}

export function loadStudioMedia(
  userId: string,
  now: number = Date.now(),
  storage: StorageLike | null = defaultStorage(),
): StoredMedia[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(mediaKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.savedAt !== "number" || !Array.isArray(parsed.items)) return [];
    if (now - parsed.savedAt > SESSION_TTL_MS) {
      storage.removeItem(mediaKey(userId));
      return [];
    }
    return parsed.items.filter(
      (m) => m && isStr(m.id) && isStr(m.url) && m.url.startsWith("data:image/") && isStr(m.name) && isStr(m.type),
    );
  } catch {
    return [];
  }
}

export function saveStudioMedia(
  userId: string,
  media: StoredMedia[],
  now: number = Date.now(),
  storage: StorageLike | null = defaultStorage(),
) {
  if (!storage) return;
  try {
    const size = media.reduce((n, m) => n + m.url.length, 0);
    // Trop volumineux pour le quota : on ne garde rien plutôt qu'une sélection tronquée.
    if (media.length === 0 || size > MAX_MEDIA_BYTES) {
      storage.removeItem(mediaKey(userId));
      return;
    }
    storage.setItem(mediaKey(userId), JSON.stringify({ savedAt: now, items: media }));
  } catch {
    // voir saveStudioSession
  }
}

export function clearStudioSession(userId: string, storage: StorageLike | null = defaultStorage()) {
  try {
    storage?.removeItem(sessionKey(userId));
    storage?.removeItem(mediaKey(userId));
  } catch {
    // voir saveStudioSession
  }
}
