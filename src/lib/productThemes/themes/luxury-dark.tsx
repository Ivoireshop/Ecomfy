import type { ThemeProps } from "../types";
import {
  CTAButton,
  HeroImage,
  GalleryStrip,
  AudioTestimonials,
  FAQ,
  ShopFooter,
  StickyMobileCTA,
  InlineCheckoutContainer,
} from "../ThemeShared";
import { formatPrice } from "../dataAdapter";

export default function LuxuryDark({ data, onCheckout, checkoutContent }: ThemeProps) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <section className="relative">
        <HeroImage
          src={data.primaryImage}
          alt={data.product?.name}
          className="w-full h-[70vh] sm:h-[80vh] object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 p-6 sm:p-12 max-w-4xl mx-auto">
          <div className="text-[10px] tracking-[0.3em] uppercase opacity-70">
            {data.shop?.business_name}
          </div>
          <h1 className="text-3xl sm:text-5xl font-light tracking-tight mt-2">{data.product?.name}</h1>
          {data.shortDescription && (
            <p className="mt-3 text-neutral-300 max-w-xl text-sm sm:text-base">{data.shortDescription}</p>
          )}
          <div className="mt-5 flex items-baseline gap-4">
            <span className="text-2xl sm:text-3xl font-light">{formatPrice(data.price, data.currency)}</span>
            {data.oldPrice && (
              <span className="text-sm text-neutral-500 line-through">{formatPrice(data.oldPrice, data.currency)}</span>
            )}
          </div>
            <div className="mt-5">
              <CTAButton data={data} onCheckout={onCheckout} big className="!bg-white !text-neutral-900 hover:!bg-neutral-100" />
            </div>
            {data.shop?.theme_config?.checkout_form_position === "top" && (
              <div className="mt-6 text-neutral-900">
                <InlineCheckoutContainer data={data} checkoutContent={checkoutContent} />
              </div>
            )}
        </div>
      </section>
      <main className="max-w-3xl mx-auto px-6 py-16 space-y-16">
        <GalleryStrip data={data} />
        {data.longDescriptionHTML && (
          <section>
            <div className="text-[10px] tracking-[0.3em] uppercase opacity-70 mb-3">Détails</div>
            <div
              className="prose prose-invert max-w-none prose-p:text-neutral-300"
              dangerouslySetInnerHTML={{ __html: data.longDescriptionHTML }}
            />
          </section>
        )}
        {data.benefits.length > 0 && (
          <section>
            <div className="text-[10px] tracking-[0.3em] uppercase opacity-70 mb-4">Caractéristiques</div>
            <ul className="space-y-2 text-sm">
              {data.benefits.map((b, i) => (
                <li key={i} className="border-b border-neutral-800 py-2 text-neutral-200">
                  {b}
                </li>
              ))}
            </ul>
          </section>
        )}
        <AudioTestimonials data={data} />
        <FAQ data={data} />
        <section className="text-center border-t border-neutral-800 pt-10">
          <h2 className="text-2xl font-light tracking-wide">Une pièce d'exception</h2>
          <div className="mt-5">
            <CTAButton data={data} onCheckout={onCheckout} big className="!bg-white !text-neutral-900" />
          </div>
          {data.shop?.theme_config?.checkout_form_position === "bottom" && (
            <div className="mt-8 text-left text-neutral-900">
              <InlineCheckoutContainer data={data} checkoutContent={checkoutContent} />
            </div>
          )}
        </section>
      </main>
      <ShopFooter data={data} />
      <StickyMobileCTA data={data} onCheckout={onCheckout} />
      <div className="h-16 md:hidden" />
    </div>
  );
}