import type { ThemeProps } from "../types";
import {
  CTAButton,
  WhatsAppButton,
  PriceBlock,
  HeroImage,
  Benefits,
  AudioTestimonials,
  FAQ,
  Guarantees,
  ShopFooter,
  StickyMobileCTA,
  InlineCheckoutContainer,
} from "../ThemeShared";

export default function LandingAd({ data, onCheckout, checkoutContent }: ThemeProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <section
        className="relative px-4 pt-6 pb-8 sm:pt-12 sm:pb-14 text-center"
        style={{ background: `linear-gradient(135deg, ${data.primaryColor}, #1f2937)` }}
      >
        <div className="max-w-3xl mx-auto text-white space-y-4">
          <div className="inline-block text-[10px] font-bold uppercase tracking-widest bg-white/15 px-2 py-1 rounded-full">
            Offre du jour
          </div>
          <h1 className="text-3xl sm:text-5xl font-black leading-tight">{data.product?.name}</h1>
          {data.shortDescription && (
            <p className="text-base sm:text-lg text-white/90">{data.shortDescription}</p>
          )}
          <div className="mx-auto max-w-md">
            <HeroImage
              src={data.primaryImage}
              alt={data.product?.name}
              className="w-full aspect-square object-cover rounded-2xl shadow-2xl"
            />
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 inline-flex flex-col gap-3">
            <PriceBlock data={data} alignment="center" />
            <div className="flex flex-wrap gap-2 justify-center">
              <CTAButton data={data} onCheckout={onCheckout} big className="shadow-xl" />
              <WhatsAppButton data={data} />
            </div>
            {data.shop?.theme_config?.checkout_form_position === "top" && (
              <div className="mt-4 text-left text-slate-900">
                <InlineCheckoutContainer data={data} checkoutContent={checkoutContent} />
              </div>
            )}
          </div>
        </div>
      </section>
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-10">
        <section className="text-center space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold">Vous vivez ce problème ?</h2>
          <p className="text-gray-600">
            {data.product?.problem_description ||
              "Vous cherchez une solution simple, efficace et abordable, sans vous compliquer la vie."}
          </p>
        </section>
        <section className="rounded-2xl bg-white shadow-sm p-5 sm:p-6 space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold" style={{ color: data.primaryColor }}>
            La solution : {data.product?.name}
          </h2>
          {data.shortDescription && <p>{data.shortDescription}</p>}
        </section>
        <Benefits data={data} title="Ce que vous obtenez" />
        <AudioTestimonials data={data} title="Écoutez nos clients satisfaits" />
        <section
          className="text-center rounded-xl p-5 text-white"
          style={{ background: data.primaryColor }}
        >
          <div className="text-sm uppercase tracking-wide font-bold opacity-90">⏳ Stock limité</div>
          <div className="text-lg sm:text-xl font-bold mt-1">Profitez de l'offre avant rupture</div>
        </section>
        <FAQ data={data} />
        <Guarantees data={data} />
        <section className="text-center space-y-3 rounded-2xl bg-white p-5 sm:p-8 shadow-sm">
          <h2 className="text-2xl font-extrabold">Passez commande maintenant</h2>
          <PriceBlock data={data} alignment="center" />
          <div className="flex flex-wrap gap-2 justify-center">
            <CTAButton data={data} onCheckout={onCheckout} big />
            <WhatsAppButton data={data} />
          </div>
          {data.shop?.theme_config?.checkout_form_position !== "top" && (
            <div className="mt-8 text-left text-slate-900">
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