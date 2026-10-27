const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Convertit une URL de vidéo (YouTube watch / youtu.be / shorts / embed, Vimeo)
 * en URL intégrable dans une iframe. Retourne null si le lien n'est pas
 * reconnu comme une vidéo intégrable.
 */
export function toVideoEmbedUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.split("/")[1];
    return id && YOUTUBE_ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const id =
      parts[0] === "watch"
        ? url.searchParams.get("v")
        : ["embed", "shorts", "live", "v"].includes(parts[0])
          ? parts[1]
          : null;
    return id && YOUTUBE_ID.test(id) ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).find((p) => /^\d+$/.test(p));
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }

  return null;
}
