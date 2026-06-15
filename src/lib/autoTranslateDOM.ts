/**
 * Auto-translates the entire DOM into the active language.
 *
 * Strategy:
 *  - Walks visible text nodes + a few attributes (placeholder, title, alt, aria-label, value of submit/button).
 *  - Batches unique source strings and sends them to the `translate-product` edge function.
 *  - Caches translations in localStorage keyed by (lang + source text).
 *  - Uses a MutationObserver to handle React re-renders and dynamic content.
 *  - Skips: <script>, <style>, <code>, <pre>, [contenteditable], [data-no-translate],
 *    inputs the user is typing in, and strings that look non-translatable
 *    (pure numbers, urls, emails, single emojis, very short tokens).
 *
 * Source language is always assumed to be French (the app's authoring language).
 * When the active language is `fr`, the translator detaches and restores originals.
 */

import { supabase } from "@/integrations/supabase/client";

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "KBD", "SAMP",
  "TEXTAREA", "INPUT", "SELECT", "OPTION", "SVG", "PATH", "CANVAS",
]);

const ATTR_TARGETS: Array<[string, string[]]> = [
  ["INPUT", ["placeholder", "title", "aria-label"]],
  ["TEXTAREA", ["placeholder", "title", "aria-label"]],
  ["BUTTON", ["title", "aria-label"]],
  ["A", ["title", "aria-label"]],
  ["IMG", ["alt", "title"]],
  ["*", ["aria-label", "title"]],
];

function shouldSkipNode(node: Node): boolean {
  let el: Node | null = node;
  while (el && el.nodeType === Node.TEXT_NODE) el = el.parentNode;
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    const e = el as HTMLElement;
    if (SKIP_TAGS.has(e.tagName)) return true;
    if (e.hasAttribute("data-no-translate")) return true;
    if (e.getAttribute("contenteditable") === "true") return true;
    if (e.getAttribute("translate") === "no") return true;
    el = e.parentElement;
  }
  return false;
}

function isTranslatable(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return false;
  // Skip pure numbers / amounts / dates
  if (/^[\s\d.,:%+\-/€$£¥₣]+$/.test(t)) return false;
  // Skip URLs / emails
  if (/^https?:\/\//i.test(t) || /\S+@\S+\.\S+/.test(t)) return false;
  // Skip currency tokens like "1500 FCFA"
  if (/^\d[\d\s.,]*\s*(FCFA|XOF|EUR|USD)$/i.test(t)) return false;
  // Must contain at least one letter
  if (!/[a-zA-ZÀ-ÿ]/.test(t)) return false;
  return true;
}

type Entry = { node: Text | { el: Element; attr: string }; original: string };

const STORAGE_PREFIX = "vp_tr_";
const memCache = new Map<string, string>(); // key = lang|original -> translated
let currentLang = "fr";
let observer: MutationObserver | null = null;
let pending = new Map<string, Entry[]>(); // original -> entries waiting
let flushTimer: number | null = null;
let isApplyingTranslation = false;

function cacheKey(lang: string, src: string) {
  return `${STORAGE_PREFIX}${lang}__${src}`;
}

function getCached(lang: string, src: string): string | undefined {
  const k = `${lang}|${src}`;
  if (memCache.has(k)) return memCache.get(k);
  try {
    const v = localStorage.getItem(cacheKey(lang, src));
    if (v != null) {
      memCache.set(k, v);
      return v;
    }
  } catch { /* ignore */ }
  return undefined;
}

function setCached(lang: string, src: string, dst: string) {
  memCache.set(`${lang}|${src}`, dst);
  try { localStorage.setItem(cacheKey(lang, src), dst); } catch { /* ignore */ }
}

function applyTranslation(entry: Entry, translated: string) {
  if (!translated.trim()) return;
  isApplyingTranslation = true;
  if ("el" in entry.node) {
    try { entry.node.el.setAttribute(entry.node.attr, translated); } catch { /* ignore */ }
  } else {
    try { entry.node.nodeValue = translated; } catch { /* ignore */ }
  }
  window.setTimeout(() => { isApplyingTranslation = false; }, 0);
}

function queueEntry(original: string, entry: Entry) {
  const cached = getCached(currentLang, original);
  if (cached !== undefined) {
    applyTranslation(entry, cached);
    return;
  }
  const list = pending.get(original) ?? [];
  list.push(entry);
  pending.set(original, list);
  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer != null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flush();
  }, 250);
}

async function flush() {
  if (pending.size === 0) return;
  const lang = currentLang;
  if (lang === "fr") { pending.clear(); return; }

  // Chunk to avoid oversized payloads
  const all = Array.from(pending.entries());
  pending = new Map();
  const CHUNK = 60;
  for (let i = 0; i < all.length; i += CHUNK) {
    const slice = all.slice(i, i + CHUNK);
    const texts: Record<string, string> = {};
    slice.forEach(([orig], idx) => { texts[`k${i + idx}`] = orig; });
    try {
      const { data, error } = await supabase.functions.invoke("translate-ui", {
        body: { texts, target_lang: lang, source_lang: "fr" },
      });
      if (error || !data?.success) continue;
      const out = (data.translations ?? {}) as Record<string, string>;
      slice.forEach(([orig, entries], idx) => {
        const t = out[`k${i + idx}`];
        if (typeof t !== "string" || !t) return;
        setCached(lang, orig, t);
        entries.forEach((e) => applyTranslation(e, t));
      });
    } catch {
      // swallow; retry on next mutation
    }
  }
}

function walk(root: Node) {
  if (shouldSkipNode(root)) return;

  // Element attributes
  if (root.nodeType === Node.ELEMENT_NODE) {
    const el = root as Element;
    for (const [tag, attrs] of ATTR_TARGETS) {
      if (tag !== "*" && el.tagName !== tag) continue;
      for (const a of attrs) {
        const v = el.getAttribute(a);
        if (v && isTranslatable(v)) {
          queueEntry(v, { node: { el, attr: a }, original: v });
        }
      }
    }
  }

  // Text nodes
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      if (shouldSkipNode(n)) return NodeFilter.FILTER_REJECT;
      const t = n.nodeValue ?? "";
      if (!isTranslatable(t)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const text = n as Text;
    const original = text.nodeValue ?? "";
    queueEntry(original.replace(/\s+/g, " ").trim(), { node: text, original });
  }

  // Also descend into element children for attributes (TreeWalker above only covers text)
  if (root.nodeType === Node.ELEMENT_NODE) {
    (root as Element).querySelectorAll("*").forEach((child) => {
      if (shouldSkipNode(child)) return;
      for (const [tag, attrs] of ATTR_TARGETS) {
        if (tag !== "*" && child.tagName !== tag) continue;
        for (const a of attrs) {
          const v = child.getAttribute(a);
          if (v && isTranslatable(v)) {
            queueEntry(v, { node: { el: child, attr: a }, original: v });
          }
        }
      }
    });
  }
}

function startObserver() {
  if (observer) observer.disconnect();
  observer = new MutationObserver((mutations) => {
    if (isApplyingTranslation) return;
    for (const m of mutations) {
      if (m.type === "characterData" && m.target.nodeType === Node.TEXT_NODE) {
        const t = m.target as Text;
        const original = (t.nodeValue ?? "").replace(/\s+/g, " ").trim();
        if (!isTranslatable(original) || shouldSkipNode(t)) continue;
        const cached = getCached(currentLang, original);
        if (cached !== undefined) {
          if (t.nodeValue !== cached) t.nodeValue = cached;
        } else {
          queueEntry(original, { node: t, original });
        }
      } else if (m.type === "childList") {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === Node.TEXT_NODE) {
            const t = n as Text;
            const original = (t.nodeValue ?? "").replace(/\s+/g, " ").trim();
            if (!isTranslatable(original) || shouldSkipNode(t)) return;
            queueEntry(original, { node: t, original });
          } else if (n.nodeType === Node.ELEMENT_NODE) {
            walk(n);
          }
        });
      } else if (m.type === "attributes" && m.target.nodeType === Node.ELEMENT_NODE) {
        const el = m.target as Element;
        const a = m.attributeName ?? "";
        const v = el.getAttribute(a);
        if (v && isTranslatable(v) && !shouldSkipNode(el)) {
          queueEntry(v, { node: { el, attr: a }, original: v });
        }
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["placeholder", "title", "aria-label", "alt"],
  });
}

function stopObserver() {
  observer?.disconnect();
  observer = null;
}

/** Public: enable/disable auto-translation for a given language. */
export function setAutoTranslateLanguage(lang: string) {
  currentLang = lang;
  if (lang === "fr") {
    stopObserver();
    pending.clear();
    // We can't easily restore original FR text once swapped.
    // Force a reload so React re-renders the canonical French strings.
    if (typeof window !== "undefined" && (window as { __vp_translated?: boolean }).__vp_translated) {
      (window as { __vp_translated?: boolean }).__vp_translated = false;
      window.location.reload();
    }
    return;
  }
  (window as { __vp_translated?: boolean }).__vp_translated = true;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { walk(document.body); startObserver(); }, { once: true });
  } else {
    walk(document.body);
    startObserver();
  }
}