import type { ThemeProps } from "../types";
import {
  CTAButton,
  PriceBlock,
  HeroImage,
  GalleryStrip,
  Benefits,
  AudioTestimonials,
  FAQ,
  Guarantees,
  ShopFooter,
  StickyMobileCTA,
  LongDescription,
} from "../ThemeShared";

export default function MobileFirst({ data, onCheckout }: ThemeProps) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="max-w-md mx-auto px-3 pt-3 pb-6 space-y-4">
        <HeroImage
          src={data.primaryImage}
          alt={data.product?.name}
          className="w-full aspect-square object-cover rounded-2xl"
        />
        <GalleryStrip data={data} />
        <h1 className="text-2xl font-extrabold leading-snug">{data.product?.name}</h1>
        {data.shortDescription && <p className="text-sm text-slate-600">{data.shortDescription}</p>}
        <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
          <PriceBlock data={data} />
          <CTAButton data={data} onCheckout={onCheckout} />
        </div>
        <Guarantees data={data} />
        <Benefits data={data} title="Pourquoi l'acheter" />
        <LongDescription data={data} title="Description complète" />
        <AudioTestimonials data={data} />
        <FAQ data={data} />
        <div className="rounded-xl bg-slate-900 text-white p-4 text-center space-y-2">
          <div className="text-sm font-semibold opacity-80">Prêt à commander ?</div>
          <CTAButton data={data} onCheckout={onCheckout} big className="w-full" />
        </div>
      </div>
      <ShopFooter data={data} />
      <StickyMobileCTA data={data} onCheckout={onCheckout} />
      <div className="h-16" />
    </div>
  );
}