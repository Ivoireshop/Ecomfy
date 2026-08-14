import { useEffect, useState } from "react";
import type { ThemeProps } from "../types";
import {
  CTAButton,
  WhatsAppButton,
  HeroImage,
  Benefits,
  AudioTestimonials,
  FAQ,
  Guarantees,
  ShopFooter,
  StickyMobileCTA,
  InlineCheckoutContainer,
} from "../ThemeShared";
import { formatPrice } from "../dataAdapter";

function Countdown() {
  const [target] = useState(() => Date.now() + 1000 * 60 * 60 * 12);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target - now);
  const h = String(Math.floor(diff / 3_600_000)).padStart(2, "0");
  const m = String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, "0");
  const s = String(Math.floor((diff % 60_000) / 1000)).padStart(2, "0");
  return (
    <div className="flex justify-center gap-2 font-mono text-2xl sm:text-3xl">
      {[h, m, s].map((v, i) => (
        <div key={i} className="px-3 py-1 rounded bg-black/80 text-white font-bold">
          {v}
        </div>
      ))}
    </div>
  );
}

export default function PromoOffer({ data, onCheckout, checkoutContent }: ThemeProps) {
  const discount = data.discount || 30;
  return (
    <div className="min-h-screen bg-red-50 text-slate-900">
      <div className="bg-red-600 text-white text-center py-2 text-sm font-bold tracking-wide">
        🔥 PROMO — Jusqu'à -{discount}% — Stock limité
      </div>
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        <section className="grid md:grid-cols-2 gap-5 items-center">
          <div className="relative">
            <HeroImage
              src={data.primaryImage}
              alt={data.product?.name}
              className="w-full aspect-square object-cover rounded-2xl border-4 border-red-500"
            />
            <div className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full h-16 w-16 flex flex-col items-center justify-center font-extrabold text-sm shadow-lg rotate-12">
              <span className="text-xs">-</span>
              <span className="text-xl leading-none">{discount}%</span>
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-black">{data.product?.name}</h1>
            {data.shortDescription && <p className="text-slate-700">{data.shortDescription}</p>}
            <div className="space-y-1">
              {data.oldPrice && (
                <div className="text-base text-slate-500 line-through">
                  Prix normal : {formatPrice(data.oldPrice, data.currency)}
                </div>
              )}
              <div className="text-3xl sm:text-4xl font-extrabold text-red-600">
                {formatPrice(data.price, data.currency)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <CTAButton data={data} onCheckout={onCheckout} big className="!bg-red-600" />
              <WhatsAppButton data={data} />
            </div>
            {data.shop?.theme_config?.checkout_form_position === "top" && (
              <div className="pt-2 text-slate-900">
                <InlineCheckoutContainer data={data} checkoutContent={checkoutContent} />
              </div>
            )}
          </div>
        </section>
        <section className="rounded-xl bg-white p-5 text-center space-y-3 shadow-sm border border-red-200">
          <div className="text-sm uppercase tracking-wider font-bold text-red-600">L'offre se termine dans</div>
          <Countdown />
          <div className="text-xs text-slate-500">Quantité limitée — premier arrivé, premier servi</div>
        </section>
        <Benefits data={data} title="Pourquoi c'est une affaire" />
        <AudioTestimonials data={data} />
        <Guarantees data={data} />
        <FAQ data={data} />
        <section className="text-center rounded-2xl bg-red-600 text-white p-6 space-y-3">
          <h2 className="text-2xl font-extrabold">Ne ratez pas cette offre</h2>
          <CTAButton data={data} onCheckout={onCheckout} big className="!bg-white !text-red-600 hover:!bg-red-50" />
          {data.shop?.theme_config?.checkout_form_position !== "top" && (
            <div className="pt-4 text-left text-slate-900">
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