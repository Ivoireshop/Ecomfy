/**
 * Resize Supabase Storage images on the fly via the render endpoint.
 * Falls back to the original URL for non-Supabase hosts (Cloudinary,
 * external CDNs, data URIs, etc.).
 *
 * Critical for low-bandwidth visitors (2G/3G/Android entry-level): a 1.5 MB
 * product photo becomes ~30-80 KB when requested at 200-400 px.
 */
export function thumbUrl(url: string | null | undefined, width = 320, quality = 70): string {
  if (!url) return "";
  // Only rewrite Supabase Storage public object URLs
  // e.g. https://xxx.supabase.co/storage/v1/object/public/<bucket>/<path>
  if (!url.includes("/storage/v1/object/public/")) return url;
  try {
    const u = new URL(url);
    u.pathname = u.pathname.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
    u.searchParams.set("width", String(width));
    u.searchParams.set("quality", String(quality));
    u.searchParams.set("resize", "contain");
    return u.toString();
  } catch {
    return url;
  }
}
