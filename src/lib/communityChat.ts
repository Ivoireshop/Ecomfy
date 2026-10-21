/** Longueur maximale d'un message du salon (miroir de la contrainte SQL `community_messages_chat_body_len`). */
export const COMMUNITY_MAX_BODY = 2000;

/**
 * ConnectUs range ses publications, réactions et notifications sous forme de JSON dans `community_messages`.
 * Ces lignes ne sont pas des messages du salon (miroir de la colonne calculée `kind` côté SQL).
 */
export const isConnectUsPayload = (body: string | null | undefined): boolean =>
  /^\s*\{\s*"connectus_type"/.test((body || "").slice(0, 64));

const MENTION_RE = /@([a-zA-ZÀ-ÖØ-öø-ÿ0-9_.-]+)/g;

/** Retire la ponctuation finale qui n'appartient pas au prénom (« Merci @Jean. » → « jean »). */
const cleanMention = (raw: string) => raw.replace(/[._-]+$/, "").toLowerCase();

/** Prénoms (en minuscules) mentionnés dans un message. */
export const extractMentions = (body: string): string[] =>
  Array.from(body.matchAll(MENTION_RE))
    .map((m) => cleanMention(m[1]))
    .filter(Boolean);

/** Prénom tel qu'il est inséré après un « @ » : sans caractères spéciaux ni ponctuation finale. */
export const mentionName = (fullName: string | null | undefined): string =>
  (fullName || "").trim().split(/\s+/)[0].replace(/[^a-zA-ZÀ-ÖØ-öø-ÿ0-9_.-]/g, "").replace(/[._-]+$/, "");

/** Jeton de comparaison d'une mention : le prénom en minuscules. */
export const mentionToken = (fullName: string | null | undefined): string =>
  mentionName(fullName).toLowerCase();

/** Découpe un message en segments texte / mention pour l'affichage. */
export const splitMentions = (body: string): { text: string; mention: boolean }[] => {
  const out: { text: string; mention: boolean }[] = [];
  let last = 0;
  for (const m of body.matchAll(MENTION_RE)) {
    const start = m.index ?? 0;
    const name = m[1].replace(/[._-]+$/, "");
    if (!name) continue;
    const end = start + 1 + name.length;
    if (start > last) out.push({ text: body.slice(last, start), mention: false });
    out.push({ text: body.slice(start, end), mention: true });
    last = end;
  }
  if (last < body.length) out.push({ text: body.slice(last), mention: false });
  return out;
};
