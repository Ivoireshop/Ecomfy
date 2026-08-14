import type { ThemeProps } from "../types";
import {
  CTAButton,
  WhatsAppButton,
  PriceBlock,
  HeroImage,
  Benefits,
  AudioTestimonials,
  FAQ,
  ShopFooter,
  StickyMobileCTA,
  InlineCheckoutContainer,
} from "../ThemeShared";

function Chapter({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <section className="relative pl-10 sm:pl-14 border-l-2 border-rose-200 py-2 space-y-2">
      <div className="absolute -left-4 sm:-left-5 top-2 h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-rose-500 text-white font-bold flex items-center justify-center text-sm">
        {index}
      </div>
      <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
      <div className="text-slate-700">{children}</div>
    </section>
  );
}

export default function Storytelling({ data, onCheckout, checkoutContent }: ThemeProps) {
  return (
    <div className="min-h-screen bg-rose-50/40 text-slate-800">
      <section className="max-w-3xl mx-auto px-4 pt-8 pb-6 text-center space-y-3">
        <div className="text-xs tracking-widest uppercase text-rose-500 font-bold">Une histoire vraie</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight">{data.product?.name}</h1>
        {data.shortDescription && <p className="text-slate-600">{data.shortDescription}</p>}
      </section>
      <div className="max-w-3xl mx-auto px-4">
        <HeroImage
          src={data.primaryImage}
          alt={data.product?.name}
          className="w-full aspect-[4/3] object-cover rounded-2xl shadow-md"
        />
        {data.shop?.theme_config?.checkout_form_position === "top" && (
          <div className="pt-4 text-left text-slate-900">
            <InlineCheckoutContainer data={data} checkoutContent={checkoutContent} />
          </div>
        )}
      </div>
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-10">
        <Chapter index={1} title="Au départ…">
          <p>Comme beaucoup, vous cherchiez une solution simple, fiable, qui tient ses promesses — sans complications.</p>
        </Chapter>
        <Chapter index={2} title="Le déclic">
          <p>{data.shortDescription || "Et puis, vous avez découvert ce produit."}</p>
        </Chapter>
        <Chapter index={3} title="La transformation">
          <Benefits data={data} title="" />
        </Chapter>
        <Chapter index={4} title="Les voix de nos clients">
          <AudioTestimonials data={data} title="" />
        </Chapter>
        <Chapter index={5} title="À votre tour">
          <PriceBlock data={data} />
          <div className="flex flex-wrap gap-2 mt-3">
            <CTAButton data={data} onCheckout={onCheckout} big />
            <WhatsAppButton data={data} />
          </div>
          {data.shop?.theme_config?.checkout_form_position !== "top" && (
            <div className="pt-4 text-left text-slate-900">
              <InlineCheckoutContainer data={data} checkoutContent={checkoutContent} />
            </div>
          )}
        </Chapter>
        <FAQ data={data} />
      </main>
      <ShopFooter data={data} />
      <StickyMobileCTA data={data} onCheckout={onCheckout} />
      <div className="h-16 md:hidden" />
    </div>
  );
}