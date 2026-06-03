import DOMPurify from "dompurify";

interface ShopReviewBarProps {
  themeConfig?: any;
  placement: "above" | "below";
}

const sanitizeReviewHtml = (html: string) => DOMPurify.sanitize(html, {
  ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "span", "div", "img", "a", "ul", "ol", "li"],
  ALLOWED_ATTR: ["href", "src", "alt", "title", "target", "rel", "style", "class"],
});

type AnimMode = "static" | "scroll" | "blink";

function ReviewBarBlock({ html, textColor, bgColor, className, mode, speed, blinkAlign = "center" }: { html?: string; textColor: string; bgColor: string; className: string; mode: AnimMode; speed: number; blinkAlign?: "center" | "left" | "right" }) {
  if (!html?.trim()) return null;

  if (mode === "scroll") {
    // Single copy traveling fully across — no duplicated text visible.
    return (
      <div className={className} style={{ color: textColor, backgroundColor: bgColor }}>
        <div className="relative overflow-hidden py-2">
          <div
            className="whitespace-nowrap inline-block text-sm font-medium [&_*]:!inline [&_*]:!whitespace-nowrap [&_p]:!m-0 [&_p]:!mr-6 [&_div]:!m-0 [&_div]:!mr-6 [&_br]:!hidden [&_h1]:!text-sm [&_h2]:!text-sm [&_h3]:!text-sm [&_ul]:!hidden [&_ol]:!hidden [&_a]:underline [&_img]:hidden"
            style={{ animation: `vp-review-marquee ${speed}s linear infinite`, paddingLeft: "100%" }}
            dangerouslySetInnerHTML={{ __html: sanitizeReviewHtml(html) }}
          />
        </div>
        <style>{`@keyframes vp-review-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }`}</style>
      </div>
    );
  }

  if (mode === "blink") {
    const alignClass = blinkAlign === "left" ? "text-left" : blinkAlign === "right" ? "text-right" : "text-center";
    const imgClass = blinkAlign === "left" ? "[&_img]:mx-0" : blinkAlign === "right" ? "[&_img]:ml-auto [&_img]:mr-0" : "[&_img]:mx-auto";
    return (
      <div className={className} style={{ color: textColor, backgroundColor: bgColor }}>
        <div
          className={`mx-auto max-w-7xl px-3 py-2 ${alignClass} text-sm font-medium leading-relaxed [&_a]:underline ${imgClass} [&_img]:max-h-28 [&_img]:max-w-full [&_img]:rounded-md [&_p]:mb-1.5 [&_p:last-child]:mb-0`}
          style={{ animation: `vp-review-blink ${speed}s ease-in-out infinite` }}
          dangerouslySetInnerHTML={{ __html: sanitizeReviewHtml(html) }}
        />
        <style>{`@keyframes vp-review-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }`}</style>
      </div>
    );
  }

  return (
    <div className={className} style={{ color: textColor, backgroundColor: bgColor }}>
      <div
        className="mx-auto max-w-7xl px-3 py-2 text-center text-sm font-medium leading-relaxed [&_a]:underline [&_img]:mx-auto [&_img]:max-h-28 [&_img]:max-w-full [&_img]:rounded-md [&_p]:mb-1.5 [&_p:last-child]:mb-0"
        dangerouslySetInnerHTML={{ __html: sanitizeReviewHtml(html) }}
      />
    </div>
  );
}

function resolveMode(cfg: any, prefix: "review_desktop" | "review_mobile"): AnimMode {
  const explicit = cfg[`${prefix}_anim`];
  if (explicit === "static" || explicit === "scroll" || explicit === "blink") return explicit;
  // Backward compatibility with old scroll boolean
  if (cfg[`${prefix}_scroll`]) return "scroll";
  return "static";
}

function resolveSpeed(cfg: any, prefix: "review_desktop" | "review_mobile", mode: AnimMode): number {
  const raw = Number(cfg[`${prefix}_speed`]);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return mode === "blink" ? 1.5 : 22;
}

export function ShopReviewBar({ themeConfig = {}, placement }: ShopReviewBarProps) {
  const desktopActive = themeConfig.review_desktop_active !== false;
  const mobileActive = themeConfig.review_mobile_active !== false;
  const desktopPlacement = themeConfig.review_desktop_above ? "above" : "below";
  const mobilePlacement = themeConfig.review_mobile_above ? "above" : "below";
  const desktopMode = resolveMode(themeConfig, "review_desktop");
  const mobileMode = resolveMode(themeConfig, "review_mobile");
  const desktopBlinkAlign = themeConfig.review_desktop_blink_align || "center";
  const mobileBlinkAlign = themeConfig.review_mobile_blink_align || "center";

  const desktopHtml = buildContent(themeConfig, "desktop");
  const mobileHtml = buildContent(themeConfig, "mobile") || desktopHtml;

  return (
    <>
      {desktopActive && desktopPlacement === placement && (
        <ReviewBarBlock
          className="hidden md:block"
          html={desktopHtml}
          textColor={themeConfig.review_desktop_text || "#FFFFFF"}
          bgColor={themeConfig.review_desktop_bg || "#803160"}
          mode={desktopMode}
          speed={resolveSpeed(themeConfig, "review_desktop", desktopMode)}
          blinkAlign={desktopBlinkAlign}
        />
      )}
      {mobileActive && mobilePlacement === placement && (
        <ReviewBarBlock
          className="block md:hidden"
          html={mobileHtml}
          textColor={themeConfig.review_mobile_text || themeConfig.review_desktop_text || "#FFFFFF"}
          bgColor={themeConfig.review_mobile_bg || themeConfig.review_desktop_bg || "#803160"}
          mode={mobileMode}
          speed={resolveSpeed(themeConfig, "review_mobile", mobileMode)}
          blinkAlign={mobileBlinkAlign}
        />
      )}
    </>
  );
}

function buildContent(cfg: any, prefix: "desktop" | "mobile"): string {
  const key = prefix === "desktop" ? "review_desktop_messages" : "review_mobile_messages";
  const sepKey = prefix === "desktop" ? "review_desktop_separator" : "review_mobile_separator";
  const arr = cfg?.[key];
  const messages: string[] = Array.isArray(arr) ? arr.filter((m: any) => typeof m === "string" && m.trim()) : [];
  if (messages.length === 0) {
    return prefix === "desktop"
      ? (cfg?.review_bar_desktop_content || "")
      : (cfg?.review_bar_mobile_content || "");
  }
  const separator = cfg?.[sepKey] ?? " • ";
  const sepHtml = `<span class="vp-review-sep" style="opacity:0.6;margin:0 0.5em;">${escapeHtml(separator)}</span>`;
  return messages.join(sepHtml);
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}