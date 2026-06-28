import type { ThemeProps } from "../types";
import {
  CTAButton,
  WhatsAppButton,
  PriceBlock,
  HeroImage,
  GalleryStrip,
  Benefits,
  LongDescription,
  AudioTestimonials,
  FAQ,
  Guarantees,
  ShopFooter,
  StickyMobileCTA,
} from "../ThemeShared";

export default function ClassicPremium({ data }: ThemeProps) {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-8">
        <div className="grid md:grid-cols-2 gap-6 lg:gap-10">
          <div className="space-y-3">
            <HeroImage
              src={data.primaryImage}
              alt={data.product?.name}
              className="w-full aspect-square object-cover rounded-xl border"
            />
            <GalleryStrip data={data} />
          </div>
          <div className="space-y-4">
            {data.shop?.business_name && (
              <div className="text-xs uppercase tracking-wide text-gray-500">{data.shop.business_name}</div>
            )}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight">{data.product?.name}</h1>
            {data.shortDescription && <p className="text-gray-600">{data.shortDescription}</p>}
            <PriceBlock data={data} />
            <div className="flex flex-wrap gap-2 pt-2">
              <CTAButton data={data} big />
              <WhatsAppButton data={data} />
            </div>
            <Guarantees data={data} />
          </div>
        </div>

        <div className="mt-10 space-y-10">
          <Benefits data={data} title="Pourquoi choisir ce produit" />
          <LongDescription data={data} />
          <AudioTestimonials data={data} />
          <FAQ data={data} />

          <section className="text-center space-y-3 py-6 rounded-xl bg-gray-50">
            <h2 className="text-xl sm:text-2xl font-bold">Prêt à passer commande ?</h2>
            <CTAButton data={data} big />
          </section>
        </div>
      </div>
      <ShopFooter data={data} />
      <StickyMobileCTA data={data} />
      <div className="h-16 md:hidden" />
    </div>
  );
}