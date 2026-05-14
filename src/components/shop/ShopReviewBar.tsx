import DOMPurify from "dompurify";

interface ShopReviewBarProps {
  themeConfig?: any;
  placement: "above" | "below";
}

const sanitizeReviewHtml = (html: string) => DOMPurify.sanitize(html, {
  ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "span", "div", "img", "a", "ul", "ol", "li"],
  ALLOWED_ATTR: ["href", "src", "alt", "title", "target", "rel", "style", "class"],
});

function ReviewBarBlock({ html, textColor, bgColor, className, scroll }: { html?: string; textColor: string; bgColor: string; className: string; scroll?: boolean }) {
  if (!html?.trim()) return null;

  if (scroll) {
    return (
      <div className={className} style={{ color: textColor, backgroundColor: bgColor }}>
        <div className="relative overflow-hidden py-2">
          <div
            className="whitespace-nowrap inline-block animate-[marquee_22s_linear_infinite] text-sm font-medium [&_*]:inline [&_p]:mr-10 [&_a]:underline [&_img]:hidden"
            dangerouslySetInnerHTML={{ __html: sanitizeReviewHtml(html + html) }}
          />
        </div>
        <style>{`@keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
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

export function ShopReviewBar({ themeConfig = {}, placement }: ShopReviewBarProps) {
  const desktopActive = themeConfig.review_desktop_active !== false;
  const mobileActive = themeConfig.review_mobile_active !== false;
  const desktopPlacement = themeConfig.review_desktop_above ? "above" : "below";
  const mobilePlacement = themeConfig.review_mobile_above ? "above" : "below";

  return (
    <>
      {desktopActive && desktopPlacement === placement && (
        <ReviewBarBlock
          className="hidden md:block"
          html={themeConfig.review_bar_desktop_content}
          textColor={themeConfig.review_desktop_text || "#FFFFFF"}
          bgColor={themeConfig.review_desktop_bg || "#803160"}
          scroll={!!themeConfig.review_desktop_scroll}
        />
      )}
      {mobileActive && mobilePlacement === placement && (
        <ReviewBarBlock
          className="block md:hidden"
          html={themeConfig.review_bar_mobile_content || themeConfig.review_bar_desktop_content}
          textColor={themeConfig.review_mobile_text || "#FFFFFF"}
          bgColor={themeConfig.review_mobile_bg || "#000000"}
          scroll={!!themeConfig.review_mobile_scroll}
        />
      )}
    </>
  );
}