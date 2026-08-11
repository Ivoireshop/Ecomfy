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
  LongDescription,
} from "../ThemeShared";

export default function HealthWellness({ data, onCheckout }: ThemeProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-emerald-50/40 text-slate-800">
      <header className="max-w-4xl mx-auto px-4 pt-6 pb-8 sm:pt-10 grid md:grid-cols-2 gap-6 items-center">
        <div className="order-2 md:order-1 space-y-4">
          <div className="inline-block text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
            Bien-être naturel
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">{data.product?.name}</h1>
          {data.shortDescription && <p className="text-lg text-slate-600">{data.shortDescription}</p>}
          <PriceBlock data={data} />
          <div className="flex flex-wrap gap-2">
            <CTAButton data={data} onCheckout={onCheckout} big style={{ background: "#059669" }} />
            <WhatsAppButton data={data} />
          </div>
        </div>
        <div className="order-1 md:order-2">
          <HeroImage
            src={data.primaryImage}
            alt={data.product?.name}
            className="w-full aspect-square object-cover rounded-3xl shadow-lg"
          />
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 pb-10 space-y-10">
        <Benefits data={data} title="Les bienfaits" />
        <section className="rounded-2xl bg-white shadow-sm p-5 space-y-2">
          <h2 className="text-xl font-bold">Mode d'utilisation</h2>
          <p className="text-slate-600 whitespace-pre-line">
            {data.product?.usage_instructions ||
              "Suivez les instructions fournies avec le produit pour des résultats optimaux."}
          </p>
        </section>
        <AudioTestimonials data={data} title="Témoignages audio" />
        <LongDescription data={data} title="En savoir plus" />
        <section className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
          <strong>Précautions :</strong> Tenir hors de portée des enfants. En cas de doute, consultez un professionnel de santé.
        </section>
        <FAQ data={data} />
        <Guarantees data={data} />
        <section className="text-center space-y-3 py-6">
          <h2 className="text-2xl font-bold">Prenez soin de vous dès aujourd'hui</h2>
          <CTAButton data={data} onCheckout={onCheckout} big style={{ background: "#059669" }} />
        </section>
      </main>
      <ShopFooter data={data} />
      <StickyMobileCTA data={data} onCheckout={onCheckout} />
      <div className="h-16 md:hidden" />
    </div>
  );
}