import { useState } from "react";
import type { ThemeData } from "./types";
import { formatPrice } from "./dataAdapter";

export function CTAButton({
  data,
  label,
  className = "",
  style,
  big,
  onCheckout,
}: {
  data: ThemeData;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  big?: boolean;
  onCheckout?: () => void;
}) {
  if (onCheckout) {
    return (
      <button
        onClick={onCheckout}
        className={`inline-flex items-center justify-center font-bold rounded-md transition active:scale-95 ${
          big ? "px-6 py-4 text-base sm:text-lg" : "px-5 py-3 text-sm sm:text-base"
        } ${className}`}
        style={{ background: data.primaryColor, color: "#fff", ...style }}
      >
        {label || data.ctaText}
      </button>
    );
  }
  return (
    <a
      href={data.classicCheckoutUrl}
      className={`inline-flex items-center justify-center font-bold rounded-md transition active:scale-95 ${
        big ? "px-6 py-4 text-base sm:text-lg" : "px-5 py-3 text-sm sm:text-base"
      } ${className}`}
      style={{ background: data.primaryColor, color: "#fff", ...style }}
    >
      {label || data.ctaText}
    </a>
  );
}

export function WhatsAppButton({ data, className = "" }: { data: ThemeData; className?: string }) {
  if (!data.whatsappUrl) return null;
  return (
    <a
      href={data.whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold px-4 py-3 text-sm bg-emerald-500 text-white hover:bg-emerald-600 transition ${className}`}
    >
      💬 WhatsApp
    </a>
  );
}

export function PriceBlock({ data, alignment = "left" }: { data: ThemeData; alignment?: "left" | "center" }) {
  return (
    <div className={`flex items-baseline gap-2 flex-wrap ${alignment === "center" ? "justify-center" : ""}`}>
      <span className="text-2xl sm:text-3xl font-extrabold" style={{ color: data.primaryColor }}>
        {formatPrice(data.price, data.currency)}
      </span>
      {data.oldPrice && (
        <>
          <span className="text-base text-gray-400 line-through">{formatPrice(data.oldPrice, data.currency)}</span>
          {data.discount > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-red-500 text-white">-{data.discount}%</span>
          )}
        </>
      )}
    </div>
  );
}

export function HeroImage({
  src,
  alt,
  className = "",
  priority = true,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  if (!src) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center text-gray-300 ${className}`}>
        Pas d'image
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      // @ts-ignore — fetchpriority is a valid HTML attribute
      fetchpriority={priority ? "high" : undefined}
      className={className}
    />
  );
}

export function GalleryStrip({ data }: { data: ThemeData }) {
  const imgs = data.images.slice(0, 8);
  if (imgs.length <= 1) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
      {imgs.map((img, i) => (
        <img
          key={i}
          src={img.image_url}
          alt={`Image ${i + 1}`}
          loading="lazy"
          className="h-20 w-20 sm:h-24 sm:w-24 object-cover rounded-md flex-shrink-0 snap-start border"
        />
      ))}
    </div>
  );
}

export function Benefits({ data, title = "Bénéfices" }: { data: ThemeData; title?: string }) {
  const items = data.benefits.length
    ? data.benefits
    : data.shortDescription
    ? [data.shortDescription]
    : [];
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
      <ul className="grid sm:grid-cols-2 gap-2">
        {items.map((b, i) => (
          <li key={i} className="flex gap-2 items-start text-sm sm:text-base">
            <span style={{ color: data.primaryColor }} className="font-bold">✓</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LongDescription({ data, title = "Description" }: { data: ThemeData; title?: string }) {
  if (!data.longDescriptionHTML) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
      <div
        className="prose prose-sm sm:prose-base max-w-none"
        dangerouslySetInnerHTML={{ __html: data.longDescriptionHTML }}
      />
    </section>
  );
}

export function AudioTestimonials({ data, title = "Témoignages audio de nos clients" }: { data: ThemeData; title?: string }) {
  if (!data.audios.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.audios.map((a) => (
          <div key={a.id} className="rounded-lg border p-3 bg-white/60">
            {a.customer_name && <div className="text-sm font-semibold">{a.customer_name}</div>}
            {a.title && <div className="text-xs text-gray-600 mb-1.5">{a.title}</div>}
            <audio controls preload="none" src={a.audio_url} className="w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function FAQ({ data }: { data: ThemeData }) {
  const [open, setOpen] = useState<number | null>(0);
  if (!data.faq.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-xl sm:text-2xl font-bold">Questions fréquentes</h2>
      <div className="divide-y rounded-md border bg-white/60">
        {data.faq.map((item, i) => (
          <div key={i}>
            <button
              type="button"
              onClick={() => setOpen((p) => (p === i ? null : i))}
              className="w-full text-left flex justify-between gap-3 px-3 py-3 font-semibold text-sm sm:text-base"
              aria-expanded={open === i}
            >
              <span>{item.q}</span>
              <span className="text-gray-400 flex-shrink-0">{open === i ? "−" : "+"}</span>
            </button>
            {open === i && <div className="px-3 pb-3 text-sm text-gray-700 whitespace-pre-line">{item.a}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

export function Guarantees({ data }: { data: ThemeData }) {
  const items = [
    { icon: "🚚", text: "Livraison disponible" },
    { icon: "🛡️", text: "Paiement sécurisé" },
    { icon: "💬", text: "Support réactif" },
    { icon: "✅", text: "Produit vérifié" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs sm:text-sm">
      {items.map((it, i) => (
        <div key={i} className="rounded-md border p-2 bg-white/60">
          <div className="text-xl">{it.icon}</div>
          <div className="mt-1">{it.text}</div>
        </div>
      ))}
    </div>
  );
}

export function ShopFooter({ data }: { data: ThemeData }) {
  return (
    <footer className="text-center text-xs text-gray-500 py-6 border-t mt-8 flex justify-center gap-2 flex-wrap">
      <span>{data.shop?.business_name || "Boutique"}</span>
      {!(data.shop?.theme_config?.hide_ecomfy_branding === true) && (
        <span>— Propulsé par Ecomfy</span>
      )}
    </footer>
  );
}

export function StickyMobileCTA({ data, onCheckout }: { data: ThemeData; onCheckout?: () => void }) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 p-2 bg-white/95 backdrop-blur border-t flex gap-2 md:hidden">
      <CTAButton data={data} className="flex-1" onCheckout={onCheckout} />
      {data.whatsappUrl && (
        <a
          href={data.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp"
          className="h-12 w-12 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xl shadow-lg"
        >
          💬
        </a>
      )}
    </div>
  );
}

export function InlineCheckoutContainer({
  data,
  checkoutContent,
}: {
  data: ThemeData;
  checkoutContent?: React.ReactNode;
}) {
  if (!checkoutContent) return null;
  return (
    <div id="inline-checkout-form" className="w-full bg-white rounded-2xl shadow-sm border p-4 sm:p-6 scroll-mt-24">
      {checkoutContent}
    </div>
  );
}