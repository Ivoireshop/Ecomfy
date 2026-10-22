// Assainissement du HTML riche d'une fiche produit (éditeur de description du marchand).
// Une seule liste de balises pour l'éditeur, l'aperçu live, la fiche publique et les thèmes : ce que le marchand voit
// est ce que le client voit. Avant, la fiche publique supprimait <font> (couleur du texte) et <iframe> (vidéo) alors
// que l'éditeur et l'aperçu les acceptaient.
import DOMPurify from "dompurify";

// Seuls les lecteurs vidéo connus peuvent être intégrés : une iframe arbitraire permettrait d'afficher n'importe quelle page.
const ALLOWED_IFRAME_HOSTS = new Set([
  "www.youtube.com",
  "www.youtube-nocookie.com",
  "player.vimeo.com",
]);

const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "strike", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "code", "pre", "img", "a",
  "span", "div", "hr", "table", "thead", "tbody", "tr", "th", "td", "font", "iframe",
];

const ALLOWED_ATTR = [
  "href", "src", "alt", "title", "class", "style", "target", "rel", "width", "height", "loading",
  "color", "size", "face", "allowfullscreen", "frameborder",
];

let hooksInstalled = false;

function installHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "IFRAME") {
      let allowed = false;
      try {
        const url = new URL(node.getAttribute("src") || "", "https://invalid.local");
        allowed = url.protocol === "https:" && ALLOWED_IFRAME_HOSTS.has(url.hostname);
      } catch {
        allowed = false;
      }
      if (!allowed) node.parentNode?.removeChild(node);
      return;
    }
    if (node.tagName === "A" && node.getAttribute("target") === "_blank") {
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}

export function sanitizeProductHtml(html: string | null | undefined): string {
  if (!html) return "";
  installHooks();
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}

/** Texte brut d'un contenu HTML, pour les balises meta (description de partage / moteurs de recherche). */
export function htmlToPlainText(html: string | null | undefined, maxLength = 160): string {
  if (!html) return "";
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trimEnd()}…` : text;
}

/** URL d'intégration d'une vidéo YouTube ou Vimeo ; null si le lien n'est pas pris en charge. */
export function toVideoEmbedUrl(input: string): string | null {
  const value = (input || "").trim();
  const yt = value.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = value.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}
